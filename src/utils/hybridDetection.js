/**
 * Hybrid PII Detection System
 * Combines regex-based detection (fast) with ML-based detection (accurate)
 * 
 * Strategy:
 * 1. Run regex patterns for structured data (emails, phones, SSN, etc.) - Instant
 * 2. Run Transformers.js NER for unstructured data (names, locations, orgs) - Slower but accurate
 * 3. Merge results, removing duplicates and low-confidence detections
 * 4. Apply custom rules (user-defined patterns)
 */

import { detectPII as detectPIIRegex } from './piiDetector';
import DOMPurify from 'dompurify';

/**
 * Merge detection results from multiple sources
 * @param {Array} regexDetections - Results from regex patterns
 * @param {Array} mlDetections - Results from ML model
 * @param {Array} customDetections - Results from custom rules
 * @returns {Array} Merged and deduplicated detections
 */
export function mergeDetections(regexDetections = [], mlDetections = [], customDetections = []) {
  const allDetections = [
    ...regexDetections.map(d => ({ ...d, source: 'regex' })),
    ...mlDetections.map(d => ({ ...d, source: 'ml' })),
    ...customDetections.map(d => ({ ...d, source: 'custom' }))
  ];

  // Sort by position
  allDetections.sort((a, b) => a.start - b.start);

  // Remove duplicates and overlaps
  const merged = [];
  const seen = new Set();

  for (const detection of allDetections) {
    // Check if this detection overlaps with any existing detection
    const hasOverlap = merged.some(existing => {
      return (
        (detection.start >= existing.start && detection.start < existing.end) ||
        (detection.end > existing.start && detection.end <= existing.end) ||
        (detection.start <= existing.start && detection.end >= existing.end)
      );
    });

    if (!hasOverlap) {
      // Also check for exact duplicates
      const key = `${detection.start}-${detection.end}-${detection.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(detection);
      }
    } else {
      // If overlap exists, keep the one with higher confidence
      const overlappingIndex = merged.findIndex(existing => 
        (detection.start >= existing.start && detection.start < existing.end) ||
        (detection.end > existing.start && detection.end <= existing.end) ||
        (detection.start <= existing.start && detection.end >= existing.end)
      );

      if (overlappingIndex !== -1) {
        const existing = merged[overlappingIndex];
        // Prefer ML detections over regex for names/entities
        if (
          detection.source === 'ml' && 
          existing.source === 'regex' &&
          detection.confidence > 0.8
        ) {
          merged[overlappingIndex] = detection;
        } else if (
          detection.confidence > existing.confidence
        ) {
          merged[overlappingIndex] = detection;
        }
      }
    }
  }

  // Re-sort and re-assign IDs
  merged.sort((a, b) => a.start - b.start);
  return merged.map((detection, index) => ({
    ...detection,
    id: `pii-${index}`
  }));
}

/**
 * Hybrid PII detection combining regex and ML
 * @param {string} text - Text to analyze
 * @param {Function} mlDetect - ML detection function (optional, from useTransformersPII)
 * @param {Array} customRules - Custom regex rules
 * @param {boolean} useML - Whether to use ML detection (Pro feature or based on text length)
 * @returns {Promise<Array>} Detected PII items
 */
export async function detectPIIHybrid(
  text, 
  mlDetect = null, 
  customRules = [], 
  useML = true
) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Always run regex detection (fast, structured data)
  const regexDetections = detectPIIRegex(text, customRules);

  // Run ML detection if available and enabled (slow, unstructured data)
  let mlDetections = [];
  if (useML && mlDetect && typeof mlDetect === 'function') {
    try {
      mlDetections = await mlDetect(text);
    } catch (error) {
      console.warn('ML detection failed, using regex only:', error);
      // Fallback to regex-only
    }
  }

  // Merge all detections
  return mergeDetections(regexDetections, mlDetections, []);
}

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['mark', 'span', 'br', 'p', 'div'],
    ALLOWED_ATTR: ['class', 'title', 'data-pii-id'],
    KEEP_CONTENT: true
  });
}

/**
 * Calculate detection statistics
 * @param {Array} detections - Array of PII detections
 * @returns {Object} Statistics about detections
 */
export function getDetectionStats(detections) {
  const stats = {
    total: detections.length,
    bySource: {
      regex: 0,
      ml: 0,
      custom: 0
    },
    byType: {},
    avgConfidence: 0,
    highConfidence: 0, // >= 0.9
    mediumConfidence: 0, // 0.7-0.9
    lowConfidence: 0 // < 0.7
  };

  if (detections.length === 0) return stats;

  let totalConfidence = 0;

  detections.forEach(d => {
    // Count by source
    stats.bySource[d.source] = (stats.bySource[d.source] || 0) + 1;

    // Count by type
    stats.byType[d.type] = (stats.byType[d.type] || 0) + 1;

    // Calculate confidence stats
    totalConfidence += d.confidence || 1.0;
    
    const conf = d.confidence || 1.0;
    if (conf >= 0.9) stats.highConfidence++;
    else if (conf >= 0.7) stats.mediumConfidence++;
    else stats.lowConfidence++;
  });

  stats.avgConfidence = totalConfidence / detections.length;

  return stats;
}

/**
 * Filter detections by confidence threshold
 * @param {Array} detections - Array of PII detections
 * @param {number} threshold - Minimum confidence (0-1)
 * @returns {Array} Filtered detections
 */
export function filterByConfidence(detections, threshold = 0.5) {
  return detections.filter(d => (d.confidence || 1.0) >= threshold);
}

/**
 * Group detections by type
 * @param {Array} detections - Array of PII detections
 * @returns {Object} Detections grouped by type
 */
export function groupByType(detections) {
  return detections.reduce((acc, detection) => {
    if (!acc[detection.type]) {
      acc[detection.type] = [];
    }
    acc[detection.type].push(detection);
    return acc;
  }, {});
}

/**
 * Validate file before processing
 * @param {File} file - File to validate
 * @returns {Object} Validation result
 */
export function validateFile(file) {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size > MAX_SIZE) {
    return { 
      valid: false, 
      error: `File too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB` 
    };
  }

  if (!ALLOWED_TYPES.includes(file.type) && file.type !== '') {
    return { 
      valid: false, 
      error: 'Unsupported file type. Please upload TXT, PDF, or DOCX files.' 
    };
  }

  return { valid: true };
}
