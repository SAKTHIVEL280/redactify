/**
 * Transformers.js Web Worker — ML-based PII Detection
 * Uses Xenova/bert-base-NER (BERT Named Entity Recognition)
 *
 * Detects:  Names (PER), Organizations (ORG), Locations (LOC)
 * Regex in piiDetector.js handles the structured patterns (email, phone, SSN …)
 *
 * Key fixes over previous version:
 *  1. Chunks are always exact substrings → offsets are always correct
 *  2. Sub-word tokens (##) are NOT discarded — they're merged via BIO tags
 *  3. Merged entity values are read from the original text, not concatenated tokens
 *  4. False-positive filter is concise and data-driven
 */

import { pipeline, env } from '@xenova/transformers';

// ─── Config ────────────────────────────────────────────────────────────────────

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

const MODEL_NAME = 'Xenova/bert-base-NER';

let nerPipeline = null;
let isInitializing = false;

// Map NER tags → our PII categories
const TYPE_MAP = {
  PER: 'name',
  ORG: 'organization',
  LOC: 'location'
  // MISC intentionally omitted — too many false positives
};

// ─── Text Chunking ─────────────────────────────────────────────────────────────

/**
 * Split `text` into chunks of at most `maxLen` characters.
 * Every chunk is an **exact substring** of the original, so
 * `chunk.offset + localPosition` always gives the correct absolute position.
 */
function chunkText(text, maxLen = 384) {
  if (text.length <= maxLen) {
    return [{ text, offset: 0 }];
  }

  const chunks = [];
  let pos = 0;

  while (pos < text.length) {
    // Last chunk — take whatever remains
    if (text.length - pos <= maxLen) {
      chunks.push({ text: text.substring(pos), offset: pos });
      break;
    }

    let breakAt = pos + maxLen;
    const earliest = pos + Math.floor(maxLen * 0.3); // Don't break too early

    // Try paragraph break
    let best = text.lastIndexOf('\n\n', breakAt);
    if (best >= earliest) {
      breakAt = best + 2;
    } else {
      // Line break
      best = text.lastIndexOf('\n', breakAt);
      if (best >= earliest) {
        breakAt = best + 1;
      } else {
        // Sentence end
        best = text.lastIndexOf('. ', breakAt);
        if (best >= earliest) {
          breakAt = best + 2;
        } else {
          // Word boundary
          best = text.lastIndexOf(' ', breakAt);
          if (best >= earliest) {
            breakAt = best + 1;
          }
          // else: hard break at maxLen (rare)
        }
      }
    }

    chunks.push({ text: text.substring(pos, breakAt), offset: pos });
    pos = breakAt;
  }

  return chunks;
}

// ─── Model Initialisation ──────────────────────────────────────────────────────

async function initializeModel() {
  if (nerPipeline || isInitializing) return nerPipeline;
  isInitializing = true;

  try {
    self.postMessage({ type: 'MODEL_LOADING', progress: 0 });

    const fileProgress = {};
    let totalFiles = 0;

    nerPipeline = await pipeline('token-classification', MODEL_NAME, {
      quantized: true,
      progress_callback: (data) => {
        if (!data?.file) return;
        if (data.status === 'initiate') {
          totalFiles++;
          fileProgress[data.file] = 0;
        } else if (data.status === 'progress' && typeof data.progress === 'number') {
          fileProgress[data.file] = data.progress;
        } else if (data.status === 'done') {
          fileProgress[data.file] = 100;
        }
        const vals = Object.values(fileProgress);
        const overall =
          vals.length > 0
            ? Math.round(vals.reduce((s, v) => s + v, 0) / Math.max(totalFiles, vals.length))
            : 0;
        self.postMessage({ type: 'MODEL_LOADING', progress: overall });
      }
    });

    self.postMessage({ type: 'MODEL_LOADED', progress: 100 });
    isInitializing = false;
    return nerPipeline;
  } catch (error) {
    isInitializing = false;
    nerPipeline = null;
    self.postMessage({ type: 'MODEL_ERROR', error: error.message });
    throw error;
  }
}

// ─── Entity Detection ──────────────────────────────────────────────────────────

/**
 * Run the NER model over `text` and return clean, merged entities.
 */
async function detectEntities(text) {
  if (!nerPipeline) await initializeModel();
  if (!nerPipeline) throw new Error('Model not initialised');

  const chunks = chunkText(text);
  const rawTokens = [];

  for (const chunk of chunks) {
    try {
      const results = await nerPipeline(chunk.text);

      for (const token of results) {
        const tag = token.entity || '';
        const baseType = tag.replace(/^[BI]-/, '');
        const mappedType = TYPE_MAP[baseType];
        if (!mappedType) continue; // skip MISC / O / unknown
        if (token.score < 0.5) continue; // low confidence

        const absStart = (token.start ?? 0) + chunk.offset;
        const absEnd = (token.end ?? 0) + chunk.offset;

        rawTokens.push({
          type: mappedType,
          tag,
          start: absStart,
          end: absEnd,
          confidence: token.score
        });
      }
    } catch (_err) {
      // Skip failed chunk, continue with the rest
    }
  }

  if (rawTokens.length === 0) return [];

  // Sort by position in text
  rawTokens.sort((a, b) => a.start - b.start);

  // ── Step 1: Merge BIO-tagged sub-tokens into whole entities ──────────────

  const bioMerged = [];
  let current = null;

  for (const token of rawTokens) {
    const isBegin = token.tag.startsWith('B-') || !token.tag.startsWith('I-');
    const isContinue = token.tag.startsWith('I-');

    if (
      current &&
      isContinue &&
      token.type === current.type &&
      token.start - current.end <= 1 // adjacent or overlapping
    ) {
      // Extend the current entity
      current.end = Math.max(current.end, token.end);
      current.confidence = Math.max(current.confidence, token.confidence);
    } else {
      if (current) bioMerged.push(current);
      current = {
        type: token.type,
        start: token.start,
        end: token.end,
        confidence: token.confidence
      };
    }
  }
  if (current) bioMerged.push(current);

  // ── Step 2: Read actual values from original text ────────────────────────

  const entities = [];
  for (const ent of bioMerged) {
    const raw = text.substring(ent.start, ent.end);
    const trimmed = raw.trim();
    if (trimmed.length < 2) continue;

    // Adjust positions to match trimmed value
    const leadingSpaces = raw.length - raw.trimStart().length;
    entities.push({
      type: ent.type,
      value: trimmed,
      start: ent.start + leadingSpaces,
      end: ent.start + leadingSpaces + trimmed.length,
      confidence: ent.confidence
    });
  }

  // ── Step 3: Merge nearby same-type entities ──────────────────────────────
  //   e.g. "John" (B-PER) + "Smith" (B-PER) with 1-char gap → "John Smith"

  const merged = mergeNearbyEntities(entities, text);

  // ── Step 4: Filter false positives ───────────────────────────────────────

  return filterFalsePositives(merged);
}

/**
 * Merge entities of the same type that are separated by only whitespace.
 */
function mergeNearbyEntities(entities, text) {
  if (entities.length <= 1) return entities;

  const result = [];
  let cur = { ...entities[0] };

  for (let i = 1; i < entities.length; i++) {
    const next = entities[i];
    const gap = next.start - cur.end;
    const between = text.substring(cur.end, next.start);

    // Merge if same type, small gap, only whitespace between
    if (next.type === cur.type && gap >= 0 && gap <= 5 && /^\s*$/.test(between)) {
      cur.end = next.end;
      cur.value = text.substring(cur.start, cur.end).trim();
      cur.confidence = Math.max(cur.confidence, next.confidence);
      // Adjust start for any leading spaces in new value
      const raw = text.substring(cur.start, cur.end);
      const leading = raw.length - raw.trimStart().length;
      cur.start = cur.start + leading;
      cur.end = cur.start + cur.value.length;
    } else {
      result.push(cur);
      cur = { ...next };
    }
  }
  result.push(cur);

  return result;
}

// ─── False-Positive Filtering ──────────────────────────────────────────────────

const ORG_BLACKLIST = new Set([
  'ai', 'ml', 'nlp', 'api', 'rest', 'graphql', 'sql', 'nosql',
  'html', 'css', 'js', 'ts', 'php', 'ui', 'ux', 'ci', 'cd',
  'aws', 'gcp', 'azure', 'saas', 'paas', 'iaas',
  'python', 'java', 'react', 'angular', 'vue', 'node', 'django',
  'flask', 'ruby', 'swift', 'kotlin', 'rust', 'go', 'scala',
  'spring', 'laravel', 'express', 'fastapi', 'rails',
  'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible',
  'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
  'agile', 'scrum', 'kanban', 'devops',
  'tech', 'system', 'systems', 'platform', 'media', 'tools',
  'data', 'cloud', 'intelligence', 'machine', 'learning',
  'deep', 'neural', 'network', 'model', 'automation',
  'comfyui', 'yolo', 'chatgpt', 'cursor', 'vscode',
  'figma', 'photoshop', 'illustrator', 'sketch',
  'linux', 'windows', 'macos', 'ios', 'android',
  'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence',
  'slack', 'notion', 'trello', 'asana',
]);

function filterFalsePositives(entities) {
  return entities.filter((ent) => {
    const val = ent.value.trim();
    const lower = val.toLowerCase();

    // ── Names ──────────────────────────────────────────────────────────────

    if (ent.type === 'name') {
      if (val.length < 2) return false;
      if (/^\d+$/.test(val)) return false; // pure numbers
      if (/^[^a-zA-Z]+$/.test(val)) return false; // no letters at all
      // Require minimum confidence for names
      if (ent.confidence < 0.60) return false;
      return true;
    }

    // ── Organisations ──────────────────────────────────────────────────────

    if (ent.type === 'organization') {
      if (val.length < 3) return false;
      const words = lower.split(/\s+/);
      // Single-word org that's in the blacklist
      if (words.length === 1 && ORG_BLACKLIST.has(lower)) return false;
      // All-caps short acronym (< 5 chars, single word)
      if (words.length === 1 && val.length < 5 && /^[A-Z]+$/.test(val)) return false;
      // Multi-word but every word is blacklisted → skip
      if (words.length > 1 && words.every((w) => ORG_BLACKLIST.has(w))) return false;
      if (ent.confidence < 0.65) return false;
      return true;
    }

    // ── Locations ──────────────────────────────────────────────────────────

    if (ent.type === 'location') {
      if (val.length < 2) return false;
      if (/^\d+$/.test(val)) return false;
      if (ent.confidence < 0.60) return false;
      return true;
    }

    return false; // Discard MISC / unknown
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getSuggestedReplacement(type) {
  return (
    {
      name: '[NAME REDACTED]',
      organization: '[ORG REDACTED]',
      location: '[LOCATION REDACTED]'
    }[type] || '[REDACTED]'
  );
}

// ─── Message Handler ───────────────────────────────────────────────────────────

self.addEventListener('message', async (e) => {
  const { type, text, id } = e.data;

  if (type === 'INIT_MODEL') {
    try {
      await initializeModel();
    } catch (_) {
      // Error already reported via postMessage inside initializeModel
    }
    return;
  }

  if (type === 'DETECT_PII') {
    try {
      const entities = await detectEntities(text);

      const result = entities.map((entity, idx) => ({
        ...entity,
        id: `ml-${idx}`,
        suggested: getSuggestedReplacement(entity.type),
        redact: true
      }));

      self.postMessage({ type: 'DETECTION_COMPLETE', id, result });
    } catch (error) {
      self.postMessage({ type: 'DETECTION_ERROR', id, error: error.message });
    }
  }
});
