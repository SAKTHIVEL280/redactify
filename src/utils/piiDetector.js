/**
 * PII Detection Engine
 * Client-side regex-based detection with zero server calls.
 * Handles: Email, Phone, URL, Address, SSN, Credit Card, DOB, Passport, IP, Bank Account, Tax ID, Age
 * Names/Organizations/Locations are handled by the ML model (transformersPIIWorker.js)
 * A simple header-name fallback is included for when the ML model isn't loaded yet.
 */

import DOMPurify from 'dompurify';
import { getFileSizeLimits } from './browserCompat.js';

// ─── PII Type Constants ────────────────────────────────────────────────────────

export const PII_TYPES = {
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  NAME: 'name',
  ADDRESS: 'address',
  SSN: 'ssn',
  CREDIT_CARD: 'credit_card',
  DATE_OF_BIRTH: 'dob',
  PASSPORT: 'passport',
  IP_ADDRESS: 'ip',
  BANK_ACCOUNT: 'bank_account',
  TAX_ID: 'tax_id',
  AGE: 'age',
  ORGANIZATION: 'organization',
  LOCATION: 'location'
};

export const PII_REPLACEMENTS = {
  [PII_TYPES.EMAIL]: '[EMAIL REDACTED]',
  [PII_TYPES.PHONE]: '[PHONE REDACTED]',
  [PII_TYPES.URL]: '[URL REDACTED]',
  [PII_TYPES.NAME]: '[NAME REDACTED]',
  [PII_TYPES.ADDRESS]: '[ADDRESS REDACTED]',
  [PII_TYPES.SSN]: '[SSN REDACTED]',
  [PII_TYPES.CREDIT_CARD]: '[CARD REDACTED]',
  [PII_TYPES.DATE_OF_BIRTH]: '[DOB REDACTED]',
  [PII_TYPES.PASSPORT]: '[PASSPORT REDACTED]',
  [PII_TYPES.IP_ADDRESS]: '[IP REDACTED]',
  [PII_TYPES.BANK_ACCOUNT]: '[ACCOUNT REDACTED]',
  [PII_TYPES.TAX_ID]: '[TAX ID REDACTED]',
  [PII_TYPES.AGE]: '[AGE REDACTED]',
  [PII_TYPES.ORGANIZATION]: '[ORG REDACTED]',
  [PII_TYPES.LOCATION]: '[LOCATION REDACTED]'
};

export const PII_COLORS = {
  [PII_TYPES.EMAIL]: 'bg-blue-200 dark:bg-blue-900/50 border-b-2 border-blue-400 dark:border-blue-600',
  [PII_TYPES.PHONE]: 'bg-green-200 dark:bg-green-900/50 border-b-2 border-green-400 dark:border-green-600',
  [PII_TYPES.URL]: 'bg-purple-200 dark:bg-purple-900/50 border-b-2 border-purple-400 dark:border-purple-600',
  [PII_TYPES.NAME]: 'bg-red-200 dark:bg-red-900/50 border-b-2 border-red-400 dark:border-red-600',
  [PII_TYPES.ADDRESS]: 'bg-orange-200 dark:bg-orange-900/50 border-b-2 border-orange-400 dark:border-orange-600',
  [PII_TYPES.SSN]: 'bg-yellow-200 dark:bg-yellow-900/50 border-b-2 border-yellow-400 dark:border-yellow-600',
  [PII_TYPES.CREDIT_CARD]: 'bg-pink-200 dark:bg-pink-900/50 border-b-2 border-pink-400 dark:border-pink-600',
  [PII_TYPES.DATE_OF_BIRTH]: 'bg-indigo-200 dark:bg-indigo-900/50 border-b-2 border-indigo-400 dark:border-indigo-600',
  [PII_TYPES.PASSPORT]: 'bg-cyan-200 dark:bg-cyan-900/50 border-b-2 border-cyan-400 dark:border-cyan-600',
  [PII_TYPES.IP_ADDRESS]: 'bg-teal-200 dark:bg-teal-900/50 border-b-2 border-teal-400 dark:border-teal-600',
  [PII_TYPES.BANK_ACCOUNT]: 'bg-rose-200 dark:bg-rose-900/50 border-b-2 border-rose-400 dark:border-rose-600',
  [PII_TYPES.TAX_ID]: 'bg-amber-200 dark:bg-amber-900/50 border-b-2 border-amber-400 dark:border-amber-600',
  [PII_TYPES.AGE]: 'bg-lime-200 dark:bg-lime-900/50 border-b-2 border-lime-400 dark:border-lime-600',
  [PII_TYPES.ORGANIZATION]: 'bg-sky-200 dark:bg-sky-900/50 border-b-2 border-sky-400 dark:border-sky-600',
  [PII_TYPES.LOCATION]: 'bg-emerald-200 dark:bg-emerald-900/50 border-b-2 border-emerald-400 dark:border-emerald-600',
  'custom': 'bg-fuchsia-200 dark:bg-fuchsia-900/50 border-b-2 border-fuchsia-400 dark:border-fuchsia-600'
};

// ─── Regex Patterns ─────────────────────────────────────────────────────────────

const PATTERNS = {
  [PII_TYPES.EMAIL]: /\b[a-zA-Z0-9][a-zA-Z0-9._%+-]{0,63}@[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}\.[a-zA-Z]{2,}\b/gi,

  [PII_TYPES.CREDIT_CARD]: /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[-\s]?\d{4,6}[-\s]?\d{4,5}[-\s]?\d{3,4}\b/g,

  [PII_TYPES.SSN]: /\b(SSN|Social Security|Social Security Number|SS#)\s*:?\s*(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/gi,

  [PII_TYPES.TAX_ID]: /\b(EIN|Tax ID|TIN)\s*:?\s*\d{2}[-\s]?\d{7}\b|\b(PAN|PAN No|PAN Number|PAN Card)\s*:?\s*[A-Z]{5}\d{4}[A-Z]\b|\b(Aadhaar|Aadhar|UID)\s*:?\s*\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi,

  [PII_TYPES.BANK_ACCOUNT]: /\b(Account|Account No|Account Number|A\/C|IBAN)\s*:?\s*[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b|\b(Account|Account No|Account Number|A\/C)\s*:?\s*\d{9,18}\b/gi,

  [PII_TYPES.PASSPORT]: /\b(Passport|Passport No|Passport Number)\s*:?\s*[A-Z]{1,2}[0-9]{6,9}\b/gi,

  [PII_TYPES.DATE_OF_BIRTH]: /\b(DOB|Date of Birth|Born|Birth Date|Birthday)\s*:?\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,

  [PII_TYPES.IP_ADDRESS]: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,

  [PII_TYPES.PHONE]: /\+?\d{1,4}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b|\b\d{10,14}\b|\b\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}\b/g,

  [PII_TYPES.URL]: /(https?:\/\/[^\s,)]+)|(www\.[^\s,)]+)|([a-z0-9-]+\.(com|org|net|io|dev|app|in|co\.in)\/[^\s,)]+)|((linkedin|github|twitter|facebook|instagram|medium|behance)\.com\/[^\s,)]+)|(\b[a-z0-9-]+\.(com|org|net|io|dev|app)\b)/gi,

  [PII_TYPES.ADDRESS]: /\b\d+[-/,]?\s*[A-Z][a-z]+(\s+[A-Z][a-z]+){0,3}\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Place|Pl|Parkway|Pkwy|Nagar|Colony|Extension|Ext|Cross|Main)\b/gi,

  [PII_TYPES.AGE]: /\b(Age|age)\s*:?\s*\d{1,3}\b|\b\d{1,3}\s+years?\s+old\b/gi
};

// Section headers to exclude from header-name detection
const SECTION_HEADERS = new Set([
  'work experience', 'professional experience', 'employment history', 'work history',
  'education', 'academic background', 'educational background',
  'skills', 'technical skills', 'core skills', 'key skills', 'core competencies',
  'projects', 'key projects', 'major projects', 'personal projects',
  'certifications', 'certificates', 'professional certifications',
  'awards', 'achievements', 'honors', 'accomplishments',
  'references', 'professional references',
  'summary', 'professional summary', 'career summary', 'executive summary',
  'objective', 'career objective', 'professional objective',
  'profile', 'professional profile', 'personal profile',
  'languages', 'language skills',
  'interests', 'personal interests', 'hobbies',
  'publications', 'research publications',
  'contact information', 'personal information', 'contact details',
  'experience', 'training', 'activities', 'contributions',
  'software engineer', 'software developer', 'web developer',
  'frontend developer', 'backend developer', 'full stack developer',
  'project manager', 'product manager', 'business analyst',
  'data scientist', 'data analyst', 'data engineer',
  'devops engineer', 'cloud engineer', 'system administrator',
  'quality assurance', 'qa engineer', 'test engineer',
  'graphic designer', 'ux designer', 'ui designer',
  'tools', 'technologies', 'frameworks', 'programming languages',
  'software skills', 'resume', 'curriculum vitae', 'cv',
]);

// ─── Text Extraction ────────────────────────────────────────────────────────────

/**
 * Extract plain text from file or text input.
 * @param {File|string} input
 * @returns {Promise<string>}
 */
export async function extractTextFromInput(input) {
  if (typeof input === 'string') return input;

  if (input instanceof File) {
    const limits = getFileSizeLimits();
    if (input.size > limits.maxFileSize) {
      throw new Error(`File size exceeds ${(limits.maxFileSize / 1024 / 1024).toFixed(0)}MB limit. Current size: ${(input.size / 1024 / 1024).toFixed(2)}MB`);
    }

    const fileType = input.type;

    if (fileType === 'text/plain' || fileType === '') {
      return await readTextFile(input);
    }
    if (fileType === 'application/pdf') {
      return await extractTextFromPDF(input);
    }
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractTextFromDOCX(input);
    }

    return await readTextFile(input);
  }

  throw new Error('Invalid input type. Expected File or string.');
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function extractTextFromPDF(file) {
  let pdf = null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      try {
        const textContent = await page.getTextContent();

        // Sort items top-to-bottom, left-to-right for logical reading order
        textContent.items.sort((a, b) => {
          const aY = a.transform[5];
          const bY = b.transform[5];
          const aX = a.transform[4];
          const bX = b.transform[4];
          if (Math.abs(bY - aY) <= 5) return aX - bX;
          return bY - aY;
        });

        let lastY = null;
        let pageText = '';

        textContent.items.forEach((item, index) => {
          const currentY = item.transform[5];
          if (lastY !== null && Math.abs(currentY - lastY) > 5) {
            pageText += '\n';
          }
          pageText += item.str;
          if (index < textContent.items.length - 1) {
            const nextY = textContent.items[index + 1].transform[5];
            if (Math.abs(currentY - nextY) <= 5) {
              pageText += ' ';
            }
          }
          lastY = currentY;
        });

        fullText += pageText + '\n\n';
      } finally {
        if (page && page.cleanup) page.cleanup();
      }
    }

    const trimmed = fullText.trim();
    if (!trimmed && pdf.numPages > 0) {
      throw new Error('This PDF appears to be a scanned image or contains no selectable text layer. Automated redaction requires selectable text.');
    }

    return trimmed;
  } catch (error) {
    throw new Error('Failed to extract text from PDF: ' + error.message);
  } finally {
    if (pdf && pdf.destroy) {
      pdf.destroy();
    }
  }
}

async function extractTextFromDOCX(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    throw new Error('Failed to extract text from DOCX: ' + error.message);
  }
}

// ─── Regex Execution ────────────────────────────────────────────────────────────

/**
 * Execute regex with timeout to prevent ReDoS.
 */
function safeRegexExec(regex, text, timeoutMs = 1500) {
  const matches = [];
  const startTime = Date.now();
  let match;

  try {
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      if (Date.now() - startTime > timeoutMs) break;
      matches.push(match);
      if (match.index === regex.lastIndex) regex.lastIndex++;
    }
  } catch (error) {
    // Silently fail — prefer partial results over crash
  }

  return matches;
}

// ─── PII Detection ──────────────────────────────────────────────────────────────

/**
 * Detect PII using regex patterns.
 * Names/Orgs/Locations are handled by the ML model; this only provides a
 * simple first-line header-name fallback when the model isn't loaded yet.
 *
 * @param {string} text
 * @returns {Array} Detected PII items
 */
export function detectPII(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) return [];

  const detections = [];
  let idCounter = 0;

  // Run every regex pattern
  Object.entries(PATTERNS).forEach(([type, pattern]) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = safeRegexExec(regex, text);

    matches.forEach((match) => {
      // Basic sanity: skip very short phone matches
      if (type === PII_TYPES.PHONE && match[0].replace(/\D/g, '').length < 7) return;

      detections.push({
        id: `regex-${idCounter++}`,
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        suggested: PII_REPLACEMENTS[type] || '[redacted]',
        confidence: 1.0,
        redact: true
      });
    });
  });

  // Header-name fallback (only useful before ML model loads)
  const headerNames = detectHeaderNames(text);
  headerNames.forEach((det) => {
    detections.push({
      id: `regex-${idCounter++}`,
      ...det,
      suggested: PII_REPLACEMENTS[PII_TYPES.NAME],
      redact: true
    });
  });

  // Sort and deduplicate with priority resolution
  const TYPE_PRIORITY = {
    [PII_TYPES.EMAIL]: 10,
    [PII_TYPES.CREDIT_CARD]: 9,
    [PII_TYPES.SSN]: 8,
    [PII_TYPES.TAX_ID]: 7,
    [PII_TYPES.BANK_ACCOUNT]: 6,
    [PII_TYPES.PASSPORT]: 5,
    [PII_TYPES.DATE_OF_BIRTH]: 4,
    [PII_TYPES.IP_ADDRESS]: 3,
    [PII_TYPES.PHONE]: 2,
    [PII_TYPES.URL]: 1,
    [PII_TYPES.ADDRESS]: 0,
    [PII_TYPES.AGE]: 0,
    [PII_TYPES.NAME]: 0
  };

  detections.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return (TYPE_PRIORITY[b.type] || 0) - (TYPE_PRIORITY[a.type] || 0);
  });

  const unique = [];
  for (const det of detections) {
    const conflict = unique.find(r => r.start < det.end && r.end > det.start);
    if (!conflict) {
      unique.push(det);
    } else {
      const detLen = det.end - det.start;
      const confLen = conflict.end - conflict.start;
      const detPrio = TYPE_PRIORITY[det.type] || 0;
      const confPrio = TYPE_PRIORITY[conflict.type] || 0;

      if (detPrio > confPrio && detLen >= confLen) {
        const idx = unique.indexOf(conflict);
        unique[idx] = det;
      }
    }
  }

  return unique;
}

/**
 * Simple header-name detection — looks at the first few lines for a name-like
 * pattern (Title Case or ALL CAPS, 1-4 words). This is a lightweight fallback;
 * the ML model provides far better name/entity detection.
 */
function detectHeaderNames(text) {
  const detections = [];
  const firstChunk = text.substring(0, 500);
  const lines = firstChunk.split('\n');
  let currentOffset = 0;

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const lineStart = currentOffset + (rawLine.length - rawLine.trimStart().length);
    currentOffset += rawLine.length + 1;

    if (!line || line.length < 2 || line.length > 50) continue;

    // Skip lines with contact-info markers
    if (/@|:\/\/|www\.|^\+?\d{7,}|\(?\d{3}\)?[-.\s]?\d{3}/.test(line)) continue;

    // Skip section headers
    if (SECTION_HEADERS.has(line.toLowerCase())) continue;

    const words = line.split(/\s+/);
    if (words.length < 1 || words.length > 4) continue;

    // Title Case: "John Smith" or "Mary Jane Watson"
    const isTitleCase = words.every(
      (w) => /^[A-Z][a-zA-Z'-]*\.?$/.test(w) && w.length >= 1
    );

    // ALL CAPS: "JOHN SMITH"
    const isAllCaps =
      words.every((w) => /^[A-Z]{2,}$/.test(w)) && line.length <= 40;

    if (isTitleCase || isAllCaps) {
      detections.push({
        type: PII_TYPES.NAME,
        value: line,
        start: lineStart,
        end: lineStart + line.length,
        confidence: 0.75
      });
      break; // Only detect one header name
    }
  }

  return detections;
}

// ─── Replacement & Highlighting ─────────────────────────────────────────────────

/**
 * Replace PII in text based on user-confirmed selections.
 * Processes right-to-left and skips overlapping ranges to prevent
 * corrupted output when detections partially overlap.
 */
export function replacePII(text, selections) {
  if (!text || !selections || selections.length === 0) return text;

  const accepted = selections
    .filter((item) => item.redact === true)
    .sort((a, b) => {
      if (b.start !== a.start) return b.start - a.start;
      return (b.end - b.start) - (a.end - a.start);
    });

  const nonOverlapping = [];
  let minStart = Infinity;

  for (const item of accepted) {
    if (item.end <= minStart) {
      nonOverlapping.push(item);
      minStart = item.start;
    }
  }

  let result = text;
  for (const item of nonOverlapping) {
    result =
      result.substring(0, item.start) +
      (item.suggested || '[REDACTED]') +
      result.substring(item.end);
  }

  return result;
}

/**
 * Highlight PII in text with HTML mark tags for the document viewer.
 * Skips overlapping ranges to prevent duplicated text in output.
 */
export function highlightPII(text, matches) {
  if (!text || !matches || matches.length === 0) return escapeHtml(text);

  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const parts = [];
  let lastIndex = 0;

  sorted.forEach((pii) => {
    // Skip if this PII overlaps with the previous one already processed
    if (pii.start < lastIndex) return;

    if (pii.start > lastIndex) {
      parts.push(escapeHtml(text.substring(lastIndex, pii.start)));
    }

    const colorClass = pii.redact
      ? PII_COLORS[pii.type] || 'bg-gray-200 dark:bg-gray-700'
      : 'bg-gray-200 dark:bg-gray-700 line-through opacity-50';

    const title = `${pii.type}: ${pii.redact ? 'Will be redacted' : 'Ignored'} → ${pii.suggested}`;

    parts.push(
      `<mark class="${colorClass} px-1 rounded cursor-pointer transition-colors" title="${escapeHtml(title)}" data-pii-id="${pii.id}">${escapeHtml(text.substring(pii.start, pii.end))}</mark>`
    );

    lastIndex = pii.end;
  });

  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.substring(lastIndex)));
  }

  return DOMPurify.sanitize(parts.join(''), {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: ['class', 'title', 'data-pii-id'],
    KEEP_CONTENT: true
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get statistics about detected PII.
 */
export function getPIIStats(piiItems) {
  const stats = {
    total: piiItems.length,
    accepted: piiItems.filter((item) => item.redact).length,
    byType: {}
  };

  Object.values(PII_TYPES).forEach((type) => {
    stats.byType[type] = piiItems.filter((item) => item.type === type).length;
  });

  return stats;
}
