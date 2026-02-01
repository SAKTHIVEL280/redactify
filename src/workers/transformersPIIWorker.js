/**
 * Transformers.js Web Worker for PII Detection
 * Uses BERT NER model for Named Entity Recognition
 * Combined with regex patterns for comprehensive PII detection
 */

import { pipeline, env } from '@xenova/transformers';

// Configure Transformers.js
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

// Stable, production-ready BERT NER model
const MODEL_NAME = 'Xenova/bert-base-NER';
const CACHE_NAME = 'transformers-models-cache';
let nerPipeline = null;
let isInitializing = false;

// Entity type mapping (BIO format support)
const ENTITY_TYPE_MAP = {
  'PER': 'name',
  'B-PER': 'name',
  'I-PER': 'name',
  'ORG': 'organization',
  'B-ORG': 'organization',
  'I-ORG': 'organization',
  'LOC': 'location',
  'B-LOC': 'location',
  'I-LOC': 'location'
};

/**
 * Cache model files using Cache API
 */
async function cacheModelFiles() {
  if (!self.caches) {
    console.warn('Cache API not available');
    return false;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    // Cache will be populated automatically by Transformers.js
    return true;
  } catch (error) {
    console.error('Failed to setup cache:', error);
    return false;
  }
}

/**
 * Initialize NER pipeline with progress tracking
 */
async function initializeModel() {
  if (nerPipeline || isInitializing) {
    return nerPipeline;
  }

  isInitializing = true;

  try {
    self.postMessage({ 
      type: 'MODEL_LOADING', 
      progress: 0 
    });

    // Setup cache
    await cacheModelFiles();

    // Create pipeline with progress callback
    nerPipeline = await pipeline('token-classification', MODEL_NAME, {
      quantized: true,
      progress_callback: (progress) => {
        const percentage = Math.round((progress.loaded / progress.total) * 100);
        self.postMessage({ 
          type: 'MODEL_LOADING', 
          progress: percentage 
        });
      }
    });

    self.postMessage({ 
      type: 'MODEL_LOADED',
      progress: 100
    });

    isInitializing = false;
    return nerPipeline;
  } catch (error) {
    isInitializing = false;
    self.postMessage({ 
      type: 'MODEL_ERROR', 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Process text and detect entities
 * @param {string} text - Input text
 * @returns {Array} Detected entities with positions
 */
async function detectEntities(text) {
  if (!nerPipeline) {
    await initializeModel();
  }

  if (!nerPipeline) {
    throw new Error('Model failed to initialize');
  }

  // For very long texts, split into chunks (max 512 tokens for BERT)
  const MAX_CHUNK_LENGTH = 400; // Conservative to avoid token limit
  const chunks = [];
  
  if (text.length > MAX_CHUNK_LENGTH) {
    // Split by sentences/paragraphs to maintain context
    const sentences = text.split(/[.!?\n]+/);
    let currentChunk = '';
    let currentOffset = 0;

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > MAX_CHUNK_LENGTH && currentChunk) {
        chunks.push({ text: currentChunk, offset: currentOffset });
        currentOffset += currentChunk.length;
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk) {
      chunks.push({ text: currentChunk, offset: currentOffset });
    }
  } else {
    chunks.push({ text, offset: 0 });
  }

  // Process each chunk
  const allEntities = [];
  
  for (const chunk of chunks) {
    try {
      // Standard NER pipeline call
      const output = await nerPipeline(chunk.text);
      
      console.log('[WORKER] Raw output:', output.length, 'entities');
      
      // Filter valid entities
      const validOutput = output.filter(entity => {
        const word = entity.word || '';
        const entityType = entity.entity;
        
        // Must be a recognized entity type
        if (!ENTITY_TYPE_MAP[entityType]) return false;
        
        // Skip subword tokens
        if (word.startsWith('##')) return false;
        
        // Minimum length
        if (word.length < 2) return false;
        
        // Skip punctuation-only
        if (/^[^\w\s@.-]+$/.test(word)) return false;
        
        // Minimum confidence
        if (entity.score < 0.7) return false;
        
        return true;
      });
      
      console.log('[WORKER] After filtering:', validOutput.length, 'entities');
      
      // Convert to standardized format
      const entities = validOutput.map((entity, index) => ({
        id: `ner-${chunk.offset}-${index}`,
        type: ENTITY_TYPE_MAP[entity.entity] || 'misc',
        originalType: entity.entity,
        value: entity.word,
        start: entity.start + chunk.offset,
        end: entity.end + chunk.offset,
        confidence: entity.score,
        redact: true,
        suggested: getSuggestedReplacement(entity.entity)
      }));

      allEntities.push(...entities);
    } catch (error) {
      console.error('Error processing chunk:', error);
    }
  }

  // Merge adjacent entities of the same type
  const mergedEntities = mergeAdjacentEntities(allEntities);
  
  // Apply smart filtering to remove false positives
  const filteredEntities = filterFalsePositives(mergedEntities);

  return filteredEntities;
}

/**
 * Filter out common false positive detections
 * Removes organizations that are likely common words/acronyms
 */
function filterFalsePositives(entities) {
  // Common false positive patterns for organizations
  const ORG_BLACKLIST = [
    /^AI$/i,                           // "AI" alone
    /^CBSE?$/i,                        // "CBS", "CBSE"
    /^Tech$/i,                         // "Tech" alone
    /^Systems?$/i,                     // "System", "Systems"
    /^Tools?$/i,                       // "Tool", "Tools"
    /^Co$/i,                           // "Co" alone
    /^Da$/i,                           // "Da" alone
    /^Re$/i,                           // "Re" alone
    /^Media$/i,                        // "Media" alone
    /^Multi$/i,                        // "Multi" alone
    /^Too$/i,                          // "Too" alone
    /^Art$/i,                          // "Art" alone
    /^Intelligence$/i,                 // "Intelligence" alone
    /^Machine$/i,                      // "Machine" alone
    /^Learning$/i,                     // "Learning" alone
    /^Platform$/i,                     // "Platform" alone
    /^Con$/i,                          // "Con" alone
    /^SA$/i,                           // "SA" alone
  ];

  // Skills/technologies that are commonly misdetected as organizations
  const TECH_KEYWORDS = [
    'python', 'react', 'javascript', 'typescript', 'java', 'html', 'css',
    'sql', 'mongodb', 'nodejs', 'django', 'flask', 'vue', 'angular',
    'comfyui', 'yolo', 'chatgpt', 'claude', 'cursor', 'vscode', 'ai', 'ml'
  ];

  // Common generic words that shouldn't be organizations
  const GENERIC_WORDS = ['tools', 'tech', 'systems', 'platform', 'media', 'art', 'intelligence', 'machine', 'learning'];

  return entities.filter(entity => {
    // Keep non-organization entities
    if (entity.type !== 'organization') return true;

    const value = entity.value.trim();
    const lowerValue = value.toLowerCase();
    
    // Split into words for analysis
    const words = value.split(/\s+/).filter(w => w.length > 0);
    
    // Remove if the ENTIRE phrase matches blacklist patterns
    if (ORG_BLACKLIST.some(pattern => pattern.test(value))) {
      console.log('[WORKER] Filtered blacklisted org:', value);
      return false;
    }

    // Remove if ANY word in the phrase is a blacklisted word
    const hasBlacklistedWord = words.some(word => 
      ORG_BLACKLIST.some(pattern => pattern.test(word))
    );
    if (hasBlacklistedWord) {
      console.log('[WORKER] Filtered org with blacklisted word:', value);
      return false;
    }

    // Remove if it's mostly generic words (e.g., "Art Intelligence Machine Learning")
    const genericWordCount = words.filter(word => 
      GENERIC_WORDS.includes(word.toLowerCase())
    ).length;
    if (genericWordCount >= Math.ceil(words.length * 0.7)) { // 70% or more are generic
      console.log('[WORKER] Filtered mostly generic org:', value);
      return false;
    }

    // Remove single-word organizations that are < 4 characters (likely acronyms)
    if (words.length === 1 && value.length < 4) {
      console.log('[WORKER] Filtered short org:', value);
      return false;
    }

    // Remove if it's a known tech keyword
    if (TECH_KEYWORDS.includes(lowerValue)) {
      console.log('[WORKER] Filtered tech keyword as org:', value);
      return false;
    }

    // Remove fragments that are too short (single word < 8 chars)
    if (words.length === 1 && value.length < 8) {
      console.log('[WORKER] Filtered single short word org:', value);
      return false;
    }

    // For multi-word orgs, check if it's just a list of common words
    if (words.length >= 3) {
      const allCommon = words.every(word => {
        const lower = word.toLowerCase();
        return GENERIC_WORDS.includes(lower) || 
               TECH_KEYWORDS.includes(lower) ||
               word.length <= 3;
      });
      if (allCommon) {
        console.log('[WORKER] Filtered all-common-words org:', value);
        return false;
      }
    }

    // Keep if confidence is very high (>0.9) AND it's not obviously generic
    if (entity.confidence > 0.9 && value.length >= 3 && words.length >= 2) {
      return true;
    }

    // For organizations, require minimum confidence of 0.75 (higher than default 0.7)
    if (entity.confidence < 0.75) {
      console.log('[WORKER] Filtered low confidence org:', value, entity.confidence);
      return false;
    }

    return true;
  });
}

/**
 * Merge adjacent entities that are part of the same entity
 * Example: "John" + "Smith" -> "John Smith"
 * Example: "SAKTHIVEL" + "E" -> "SAKTHIVEL E"
 */
function mergeAdjacentEntities(entities) {
  if (entities.length === 0) return [];

  // Sort by start position
  entities.sort((a, b) => a.start - b.start);

  const merged = [];
  let current = entities[0];

  for (let i = 1; i < entities.length; i++) {
    const next = entities[i];
    
    // Calculate gap between entities
    const gap = next.start - current.end;
    
    // Check if adjacent and same type (allowing for spaces/newlines between)
    // Special case: merge names even with slightly larger gaps
    const shouldMerge = (
      next.type === current.type && 
      gap <= 3 && // Allow up to 3 characters gap (spaces, newlines)
      (next.type === 'name' || gap <= 1) // Names can have larger gaps
    );

    if (shouldMerge) {
      // Merge entities
      current = {
        ...current,
        value: current.value + ' ' + next.value.trim(),
        end: next.end,
        confidence: Math.max(current.confidence, next.confidence)
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  // Add last entity
  merged.push(current);

  return merged;
}

/**
 * Get suggested replacement text
 */
function getSuggestedReplacement(entityType) {
  const type = ENTITY_TYPE_MAP[entityType] || 'misc';
  
  const replacements = {
    name: '[Name Redacted]',
    location: '[Location Redacted]',
    organization: '[Organization Redacted]',
    misc: '[Redacted]'
  };
  
  return replacements[type] || '[Redacted]';
}

// Listen for messages from main thread
self.addEventListener('message', async (e) => {
  const { type, text, id } = e.data;

  switch (type) {
    case 'INIT_MODEL':
      try {
        await initializeModel();
      } catch (error) {
        self.postMessage({
          type: 'MODEL_ERROR',
          error: error.message
        });
      }
      break;

    case 'DETECT_PII':
      try {
        const entities = await detectEntities(text);
        self.postMessage({
          type: 'DETECTION_COMPLETE',
          id,
          result: entities
        });
      } catch (error) {
        self.postMessage({
          type: 'DETECTION_ERROR',
          id,
          error: error.message
        });
      }
      break;

    default:
      console.warn('Unknown message type:', type);
  }
});
