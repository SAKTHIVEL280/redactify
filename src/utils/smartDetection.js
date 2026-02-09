/**
 * Smart PII Detection - Combines ML (for names, orgs) + Regex (for patterns like email, phone)
 * NOW WITH CONTEXT-AWARE FILTERING
 * 
 * Strategy:
 * - ML Model: Detects names, organizations, locations (context-aware)
 * - Regex: Detects emails, phones, SSN, credit cards, IP addresses (pattern-based)
 * - Context Analysis: Understands document structure to avoid false positives
 * 
 * This avoids false positives from regex date detection while catching all PII types.
 */

import { applyContextAwareFiltering } from './contextAwareDetection';

// Pattern-based PII that ML can't detect
const PATTERN_REGEX = {
  email: /\b[a-zA-Z0-9][a-zA-Z0-9._%+-]{0,63}@[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}\.[a-zA-Z]{2,}\b/gi,
  phone: /\+?\d{1,4}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b|\b\d{10,14}\b|\b\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  ssn: /\b(SSN|Social Security|Social Security Number|SS#)\s*:?\s*(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/gi,
  credit_card: /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[-\s]?\d{4,6}[-\s]?\d{4,5}[-\s]?\d{3,4}\b/g,
  ip: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  url: /(https?:\/\/[^\s,)]+)|(www\.[^\s,)]+)|([a-z0-9-]+\.(com|org|net|io|dev|app|in|co\.in)\/[^\s,)]+)|((linkedin|github|twitter|facebook|instagram|medium|behance)\.com\/[^\s,)]+)/gi,
  address: /\b\d+[-/,]?\s*[A-Z][a-z]+(\s+[A-Z][a-z]+){0,3}\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Place|Pl|Parkway|Pkwy|Nagar|Colony|Extension|Ext|Cross|Main)\b/gi,
  dob: /\b(DOB|Date of Birth|Born|Birth Date|Birthday)\s*:?\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}[-/](0?[1-9]|1[0-2])[-/](19|20)\d{2}\b/gi,
  passport: /\b(Passport|Passport No|Passport Number)\s*:?\s*[A-Z]{1,2}[0-9]{6,9}\b/gi,
  bank_account: /\b(Account|Account No|Account Number|A\/C|IBAN)\s*:?\s*[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b|\b(Account|Account No|Account Number|A\/C)\s*:?\s*\d{9,18}\b/gi,
  tax_id: /\b(EIN|Tax ID|TIN)\s*:?\s*\d{2}[-\s]?\d{7}\b|\b[A-Z]{5}\d{4}[A-Z]\b|\b(Aadhaar|Aadhar|UID)\s*:?\s*\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi,
  age: /\b(Age|age)\s*:?\s*\d{1,3}\b|\b\d{1,3}\s+years?\s+old\b/gi,
};

const PATTERN_REPLACEMENTS = {
  email: '[email redacted]',
  phone: '[phone redacted]',
  ssn: '[SSN redacted]',
  credit_card: '[card redacted]',
  ip: '[IP redacted]',
  url: '[URL redacted]',
  address: '[address redacted]',
  dob: '[DOB redacted]',
  passport: '[passport redacted]',
  bank_account: '[account redacted]',
  tax_id: '[tax ID redacted]',
  age: '[age redacted]',
};

/**
 * Detect pattern-based PII using regex
 * @param {string} text - Text to analyze
 * @returns {Array} Array of detected PII entities
 */
export function detectPatternPII(text) {
  if (!text || text.trim().length === 0) return [];

  const detections = [];
  let idCounter = 0;

  // Detect each pattern type
  for (const [type, pattern] of Object.entries(PATTERN_REGEX)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const value = match[0];
      
      // Skip very short matches (likely false positives)
      if (type === 'phone' && value.length < 10) continue;
      if (type === 'email' && value.length < 5) continue;

      detections.push({
        id: `pattern-${type}-${idCounter++}`,
        type,
        value,
        start: match.index,
        end: match.index + value.length,
        confidence: 1.0,
        redact: true,
        suggested: PATTERN_REPLACEMENTS[type] || `[${type} redacted]`
      });
    }
  }

  return detections;
}

/**
 * Merge ML detections with pattern-based detections
 * Removes overlaps (pattern takes precedence for email/phone, ML for names)
 * @param {Array} mlDetections - Detections from ML model
 * @param {Array} patternDetections - Detections from regex patterns
 * @returns {Array} Merged, deduplicated detections
 */
export function mergeDetections(mlDetections, patternDetections) {
  const all = [...mlDetections, ...patternDetections];
  
  // Sort by start position
  all.sort((a, b) => a.start - b.start);

  // Remove overlaps - keep the one with higher priority
  const merged = [];
  const priorityOrder = ['email', 'phone', 'ssn', 'credit_card', 'ip', 'dob', 'passport', 'bank_account', 'tax_id', 'address', 'age', 'url', 'name', 'organization', 'location'];

  for (const detection of all) {
    // Check if overlaps with any already added detection
    const overlaps = merged.find(d => 
      (detection.start >= d.start && detection.start < d.end) ||
      (detection.end > d.start && detection.end <= d.end) ||
      (detection.start <= d.start && detection.end >= d.end)
    );

    if (overlaps) {
      // Keep the one with higher priority
      const detectionPriority = priorityOrder.indexOf(detection.type);
      const overlapsPriority = priorityOrder.indexOf(overlaps.type);
      
      if (detectionPriority !== -1 && detectionPriority < overlapsPriority) {
        // Replace with higher priority detection
        const index = merged.indexOf(overlaps);
        merged[index] = detection;
      }
      // Otherwise keep the existing one
    } else {
      merged.push(detection);
    }
  }

  // Sort again by position
  merged.sort((a, b) => a.start - b.start);

  return merged;
}

/**
 * Smart detection combining ML + Regex + Context Analysis
 * @param {string} text - Text to analyze
 * @param {Function} mlDetectFn - ML detection function
 * @returns {Promise<Array>} Combined detections with context-aware filtering
 */
export async function detectSmartPII(text, mlDetectFn) {
  if (!text || text.trim().length === 0) return [];

  // Run both in parallel
  const [mlDetections, patternDetections] = await Promise.all([
    mlDetectFn ? mlDetectFn(text).catch(() => []) : Promise.resolve([]),
    Promise.resolve(detectPatternPII(text))
  ]);

  console.log('[SMART DETECTION] ML:', mlDetections.length, 'Pattern:', patternDetections.length);

  // Merge and deduplicate
  const merged = mergeDetections(mlDetections, patternDetections);

  console.log('[SMART DETECTION] Merged:', merged.length, 'before context filtering');

  // Apply context-aware filtering to understand what's actually private
  const contextFiltered = applyContextAwareFiltering(merged, text);

  console.log('[SMART DETECTION] Context-filtered:', contextFiltered.length, 'final detections');

  return contextFiltered;
}
