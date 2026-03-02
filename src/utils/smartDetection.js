/**
 * Smart PII Detection — Orchestrator
 *
 * Combines:
 *   ML model  → Names, Organisations, Locations  (via worker / hook)
 *   Regex     → Email, Phone, SSN, Credit Card …  (via piiDetector.js)
 *   Context   → Sets intelligent redact/ignore defaults
 *
 * Exported functions used by Redactor.jsx:
 *   detectSmartPII(text, mlDetectFn)  — full detection pipeline
 *   mergeDetections(arr1, arr2)       — merge + deduplicate two arrays
 *   detectPatternPII(text)            — regex-only (backward compat)
 */

import { detectPII } from './piiDetector';
import { applyContextAwareFiltering } from './contextAwareDetection';

// ─── Pattern-only detection (re-export for backward compat) ────────────────────

/**
 * Run regex-based detection only. Equivalent to `detectPII` from piiDetector.js.
 */
export function detectPatternPII(text) {
  return detectPII(text);
}

// ─── Merge & Dedup ─────────────────────────────────────────────────────────────

/**
 * Priority order — earlier = higher priority when two detections overlap.
 * `custom` rules always win; structured patterns beat ML-based generic types.
 */
const PRIORITY = [
  'custom',
  'email', 'phone', 'ssn', 'credit_card', 'ip', 'dob',
  'passport', 'bank_account', 'tax_id', 'address', 'age', 'url',
  'name', 'organization', 'location'
];

function priorityOf(type) {
  const idx = PRIORITY.indexOf(type);
  return idx === -1 ? PRIORITY.length : idx; // unknown types go last
}

/**
 * Merge two arrays of detections, removing overlaps.
 * When two detections overlap, the one with higher priority wins.
 * Returns a sorted array with fresh sequential IDs.
 */
export function mergeDetections(detectionsA, detectionsB) {
  const all = [...(detectionsA || []), ...(detectionsB || [])];
  if (all.length === 0) return [];

  // Sort by start position, then by priority (higher priority first)
  all.sort((a, b) => a.start - b.start || priorityOf(a.type) - priorityOf(b.type));

  const merged = [];

  for (const det of all) {
    // Check overlap with already-accepted detections
    const overlapIdx = merged.findIndex(
      (d) =>
        (det.start >= d.start && det.start < d.end) ||
        (det.end > d.start && det.end <= d.end) ||
        (det.start <= d.start && det.end >= d.end)
    );

    if (overlapIdx !== -1) {
      const existing = merged[overlapIdx];
      // Replace only if new detection has strictly higher priority
      if (priorityOf(det.type) < priorityOf(existing.type)) {
        merged[overlapIdx] = det;
      }
      // Otherwise keep existing
    } else {
      merged.push(det);
    }
  }

  // Sort by position and assign fresh IDs
  merged.sort((a, b) => a.start - b.start);

  return merged.map((d, idx) => ({
    ...d,
    id: `pii-${idx}`
  }));
}

// ─── Full Smart Detection Pipeline ─────────────────────────────────────────────

/**
 * Main entry point used by Redactor.jsx.
 *
 * 1. Runs ML detection (names, orgs, locations) + regex (email, phone …) **in parallel**
 * 2. Merges + deduplicates
 * 3. Applies context-aware filtering (sets `redact` flag, never removes items)
 *
 * @param {string} text          — Document text
 * @param {Function} mlDetectFn  — `detectPII` from useTransformersPII hook (or null)
 * @returns {Promise<Array>}     — Merged, context-filtered detections
 */
export async function detectSmartPII(text, mlDetectFn) {
  if (!text || text.trim().length === 0) return [];

  // Run both detection strategies in parallel
  const [mlDetections, regexDetections] = await Promise.all([
    mlDetectFn
      ? mlDetectFn(text).catch(() => []) // graceful fallback if ML fails
      : Promise.resolve([]),
    Promise.resolve(detectPII(text))
  ]);

  // Merge and deduplicate
  const merged = mergeDetections(mlDetections, regexDetections);

  // Apply context-aware filtering (sets redact flag, keeps all items)
  const contextFiltered = applyContextAwareFiltering(merged, text);

  return contextFiltered;
}
