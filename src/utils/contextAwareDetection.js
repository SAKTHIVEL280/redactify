/**
 * Context-Aware PII Detection
 * Analyzes document structure to understand what's actually private/sensitive
 */

/**
 * Analyze document structure and identify sections
 * @param {string} text - Full document text
 * @returns {Object} Document analysis with sections
 */
export function analyzeDocumentStructure(text) {
  const lines = text.split('\n');
  
  // Detect header (first 10% of document or until first empty line)
  const firstBlankLineIdx = lines.findIndex((line, i) => i > 0 && line.trim() === '');
  const headerEndIndex = Math.min(
    Math.ceil(lines.length * 0.1),
    firstBlankLineIdx >= 0 ? firstBlankLineIdx : lines.length
  );
  
  const headerLines = lines.slice(0, headerEndIndex);
  const bodyLines = lines.slice(headerEndIndex);
  
  // Identify contact/personal sections
  const personalSectionPatterns = [
    /^(contact|about|profile|personal|summary|objective)/i,
    /^(email|phone|address|location)/i
  ];
  
  const personalSections = [];
  lines.forEach((line, index) => {
    if (personalSectionPatterns.some(pattern => pattern.test(line.trim()))) {
      personalSections.push({
        startLine: index,
        endLine: Math.min(index + 5, lines.length), // Next 5 lines likely contain personal info
        type: 'personal'
      });
    }
  });
  
  return {
    headerText: headerLines.join('\n'),
    bodyText: bodyLines.join('\n'),
    headerEndIndex,
    personalSections,
    totalLines: lines.length
  };
}

/**
 * Check if an entity is in a personal/contact section
 * @param {Object} entity - Detected entity
 * @param {string} text - Full text
 * @param {Object} structure - Document structure from analyzeDocumentStructure
 * @returns {boolean}
 */
export function isInPersonalSection(entity, text, structure) {
  const position = entity.start;
  
  // Check if in header (first 10% of document)
  if (position < structure.headerText.length) {
    return true;
  }
  
  // Check if in identified personal sections
  const lines = text.split('\n');
  let currentPos = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const lineEnd = currentPos + lines[i].length + 1; // +1 for newline
    
    if (position >= currentPos && position < lineEnd) {
      // Found the line containing this entity
      return structure.personalSections.some(section => 
        i >= section.startLine && i <= section.endLine
      );
    }
    
    currentPos = lineEnd;
  }
  
  return false;
}

/**
 * Check if entity is near contact information (likely personal)
 * @param {Object} entity - Detected entity
 * @param {string} text - Full text
 * @param {Array} allDetections - All detected entities
 * @returns {boolean}
 */
export function isNearContactInfo(entity, text, allDetections) {
  const contextWindow = 200; // Characters before/after
  const start = Math.max(0, entity.start - contextWindow);
  const end = Math.min(text.length, entity.end + contextWindow);
  const context = text.slice(start, end);
  
  // Check if there's an email, phone, or URL near this entity
  const hasContactInfo = allDetections.some(other => 
    (other.type === 'email' || other.type === 'phone' || other.type === 'url') &&
    Math.abs(other.start - entity.start) < contextWindow
  );
  
  // Check for contact-related keywords in context
  const contactKeywords = /\b(email|phone|mobile|contact|reach|call|linkedin|github)\b/i;
  const hasContactKeyword = contactKeywords.test(context);
  
  return hasContactInfo || hasContactKeyword;
}

/**
 * Check if name is preceded by a label (e.g., "Name:", "By:")
 * @param {Object} entity - Detected entity
 * @param {string} text - Full text
 * @returns {boolean}
 */
export function hasPersonalLabel(entity, text) {
  const precedingText = text.slice(Math.max(0, entity.start - 50), entity.start);
  
  const labelPatterns = [
    /\b(name|candidate|applicant|by|author|from)\s*:?\s*$/i,
    /^[A-Z][a-z]+\s+[A-Z][a-z]+\s*$/  // "First Last" pattern at start
  ];
  
  return labelPatterns.some(pattern => pattern.test(precedingText.trim()));
}

/**
 * Check if organization is actually a proper institution
 * @param {string} value - Organization name
 * @param {string} text - Full text
 * @returns {boolean}
 */
export function isProperInstitution(value, text) {
  // Patterns that indicate real institutions
  const institutionPatterns = [
    /\b(university|college|institute|school|academy)\b/i,
    /\b(corporation|company|inc\.|ltd\.|llc|pvt)\b/i,
    /\b(hospital|medical|clinic)\b/i,
    /\b(government|ministry|department)\b/i
  ];
  
  // Check if the org name contains institution keywords
  const hasInstitutionKeyword = institutionPatterns.some(pattern => 
    pattern.test(value)
  );
  
  // Check if it's mentioned multiple times (likely important)
  const occurrences = (text.match(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
  
  // Real institutions are usually mentioned multiple times OR have institution keywords
  return hasInstitutionKeyword || occurrences >= 2;
}

/**
 * Determine if an entity should be redacted based on context
 * @param {Object} entity - Detected entity
 * @param {string} fullText - Full document text
 * @param {Array} allDetections - All detected entities
 * @returns {Object} { shouldRedact: boolean, reason: string }
 */
export function shouldRedactEntity(entity, fullText, allDetections) {
  const structure = analyzeDocumentStructure(fullText);
  
  // Always redact contact information and sensitive identifiers
  if (['email', 'phone', 'ssn', 'credit_card', 'ip', 'dob', 'passport', 'bank_account', 'tax_id', 'age', 'address'].includes(entity.type)) {
    return { shouldRedact: true, reason: 'sensitive_contact' };
  }
  
  // Always redact URLs (social media profiles)
  if (entity.type === 'url') {
    return { shouldRedact: true, reason: 'url' };
  }
  
  // For names
  if (entity.type === 'name') {
    const inPersonalSection = isInPersonalSection(entity, fullText, structure);
    const nearContact = isNearContactInfo(entity, fullText, allDetections);
    const hasLabel = hasPersonalLabel(entity, fullText);
    
    // Redact if in header, near contact info, or has personal label
    if (inPersonalSection || nearContact || hasLabel) {
      return { shouldRedact: true, reason: 'personal_name' };
    }
    
    // Otherwise, keep (might be a reference to someone else)
    return { shouldRedact: false, reason: 'reference_name' };
  }
  
  // For organizations
  if (entity.type === 'organization') {
    const isInstitution = isProperInstitution(entity.value, fullText);
    
    // Keep educational institutions and proper companies
    if (isInstitution) {
      return { shouldRedact: false, reason: 'institution' };
    }
    
    // Redact if it's not a clear institution (might be misdetected)
    return { shouldRedact: false, reason: 'unclear_org' };
  }
  
  // For locations - redact if in personal/header section (home address area), skip if in work/education
  if (entity.type === 'location') {
    const inPersonalSection = isInPersonalSection(entity, fullText, structure);
    const nearContact = isNearContactInfo(entity, fullText, allDetections);
    
    if (inPersonalSection || nearContact) {
      return { shouldRedact: true, reason: 'personal_location' };
    }
    return { shouldRedact: false, reason: 'location_public' };
  }
  
  // Default: don't redact
  return { shouldRedact: false, reason: 'default' };
}

/**
 * Apply context-aware filtering to detected entities
 * @param {Array} detections - All detected entities
 * @param {string} fullText - Full document text
 * @returns {Array} Filtered detections with only items that should be redacted
 */
export function applyContextAwareFiltering(detections, fullText) {
  return detections.map(entity => {
    const decision = shouldRedactEntity(entity, fullText, detections);
    
    return {
      ...entity,
      redact: decision.shouldRedact,
      contextReason: decision.reason
    };
  }).filter(entity => entity.redact); // Only return items that should be redacted
}
