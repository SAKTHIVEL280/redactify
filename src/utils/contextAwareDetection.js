/**
 * Context-Aware PII Filtering
 *
 * Analyses document structure (header, personal sections, body) to set
 * intelligent default `redact` flags on detected entities.
 *
 * IMPORTANT: This module NEVER removes entities from the list.  It only
 * sets `redact: true | false` so the user can always override the decision
 * from the sidebar.
 */

// ─── Document Structure Analysis ───────────────────────────────────────────────

/**
 * Identify header area, personal / contact sections, and overall structure.
 */
function analyseDocumentStructure(text) {
  const lines = text.split('\n');

  // Header = first ~15% of lines, capped between 3 and 12 lines
  const firstBlankIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '');
  const rawEnd = Math.max(3, Math.ceil(lines.length * 0.15));
  const headerEndIndex = Math.min(
    rawEnd,
    firstBlankIdx >= 1 ? firstBlankIdx : Math.min(12, lines.length)
  );

  const headerText = lines.slice(0, headerEndIndex).join('\n');

  // Find personal / contact sections by keyword
  const contactPatterns =
    /^(contact|about me|profile|personal|email|phone|address|location|summary|objective)/i;

  const personalSections = [];
  lines.forEach((line, idx) => {
    if (contactPatterns.test(line.trim())) {
      personalSections.push({
        startLine: idx,
        endLine: Math.min(idx + 6, lines.length)
      });
    }
  });

  return { headerText, headerEndIndex, personalSections, totalLines: lines.length };
}

/**
 * Check which line number a character position falls on.
 */
function lineAtPosition(text, charPos) {
  return text.substring(0, charPos).split('\n').length - 1;
}

/**
 * Is this entity inside the header or a known personal / contact section?
 */
function isInContactArea(entity, text, structure) {
  const line = lineAtPosition(text, entity.start);

  // Inside the header block?
  if (line < structure.headerEndIndex) return true;

  // Inside a labelled personal section?
  return structure.personalSections.some(
    (s) => line >= s.startLine && line <= s.endLine
  );
}

/**
 * Is this entity near (within 250 chars) other contact info?
 */
function isNearContactInfo(entity, allDetections) {
  const WINDOW = 250;
  return allDetections.some(
    (other) =>
      other !== entity &&
      ['email', 'phone', 'url'].includes(other.type) &&
      Math.abs(other.start - entity.start) < WINDOW
  );
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Walk through every detection and set a sensible `redact` default.
 *
 * Privacy-first approach:
 *   • Contact info (email, phone, SSN …) → always redact
 *   • Names  → always redact (user can un-check references they want to keep)
 *   • Organisations → default ignore (company names are usually public)
 *   • Locations → redact if in header / contact area, ignore elsewhere
 *
 * @param {Array}  detections  — merged detection array
 * @param {string} fullText    — the whole document text
 * @returns {Array} same array with `redact` and `contextReason` filled in
 */
export function applyContextAwareFiltering(detections, fullText) {
  if (!detections || detections.length === 0) return [];

  const structure = analyseDocumentStructure(fullText);

  return detections.map((entity) => {
    let redact = true;
    let reason = 'default';

    // ── Always redact structured contact / sensitive data ───────────────

    const sensitiveTypes = [
      'email', 'phone', 'ssn', 'credit_card', 'ip', 'dob',
      'passport', 'bank_account', 'tax_id', 'age', 'address', 'url'
    ];

    if (sensitiveTypes.includes(entity.type)) {
      redact = true;
      reason = 'sensitive_data';
    }

    // ── Names → redact by default (privacy-first) ──────────────────────

    else if (entity.type === 'name') {
      redact = true;
      reason = isInContactArea(entity, fullText, structure)
        ? 'personal_name'
        : 'name_in_body';
    }

    // ── Organisations → keep visible but default to ignore ─────────────

    else if (entity.type === 'organization') {
      redact = false;
      reason = 'organization_public';
    }

    // ── Locations → redact only if in personal area ────────────────────

    else if (entity.type === 'location') {
      const inContact = isInContactArea(entity, fullText, structure);
      const nearContact = isNearContactInfo(entity, detections);
      redact = inContact || nearContact;
      reason = redact ? 'personal_location' : 'work_location';
    }

    // ── Custom rules → always redact ───────────────────────────────────

    else if (entity.type === 'custom') {
      redact = true;
      reason = 'custom_rule';
    }

    return { ...entity, redact, contextReason: reason };
  });
  // NOTE: No .filter() — every entity stays visible for the user.
}
