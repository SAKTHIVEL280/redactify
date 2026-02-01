/**
 * Smart PII Detection - Combines ML (for names, orgs) + Regex (for patterns like email, phone)
 * 
 * Strategy:
 * - ML Model: Detects names, organizations, locations (context-aware)
 * - Regex: Detects emails, phones, SSN, credit cards, IP addresses (pattern-based)
 * 
 * This avoids false positives from regex date detection while catching all PII types.
 */

// Pattern-based PII that ML can't detect
const PATTERN_REGEX = {
  email: /\b[a-zA-Z0-9][a-zA-Z0-9._%+-]{0,63}@[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}\.[a-zA-Z]{2,}\b/gi,
  phone: /\+?\d{1,4}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b|\b\d{10,14}\b|\b\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  ssn: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
  credit_card: /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[-\s]?\d{4,6}[-\s]?\d{4,5}[-\s]?\d{3,4}\b/g,
  ip_address: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  url: /(https?:\/\/[^\s,)]+)|(www\.[^\s,)]+)|([a-z0-9-]+\.(com|org|net|io|dev|app|in|co\.in)\/[^\s,)]+)|((linkedin|github|twitter|facebook|instagram|medium|behance)\.com\/[^\s,)]+)/gi,
};

const PATTERN_REPLACEMENTS = {
  email: '[email redacted]',
  phone: '[phone redacted]',
  ssn: '[SSN redacted]',
  credit_card: '[card redacted]',
  ip_address: '[IP redacted]',
  url: '[URL redacted]',
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
  const priorityOrder = ['email', 'phone', 'ssn', 'credit_card', 'ip_address', 'name', 'organization', 'location'];

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
 * Smart detection combining ML + Regex
 * @param {string} text - Text to analyze
 * @param {Function} mlDetectFn - ML detection function
 * @returns {Promise<Array>} Combined detections
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

  console.log('[SMART DETECTION] Merged:', merged.length, 'total detections');

  return merged;
}
