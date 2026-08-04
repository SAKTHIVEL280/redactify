/**
 * Web Worker for PII Detection
 * Offloads heavy regex processing to prevent UI blocking
 * Used for large documents (>5000 characters)
 */

// Import PII detection patterns (replicate here for worker context)
const PII_TYPES = {
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  NAME: 'name',
  ADDRESS: 'address'
};

const PII_REPLACEMENTS = {
  [PII_TYPES.EMAIL]: '[EMAIL REDACTED]',
  [PII_TYPES.PHONE]: '[PHONE REDACTED]',
  [PII_TYPES.URL]: '[URL REDACTED]',
  [PII_TYPES.NAME]: '[NAME REDACTED]',
  [PII_TYPES.ADDRESS]: '[ADDRESS REDACTED]'
};

const PATTERNS = {
  [PII_TYPES.EMAIL]: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi,
  [PII_TYPES.PHONE]: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  [PII_TYPES.URL]: /(https?:\/\/[^\s]+)|(www\.[^\s,]+)|((linkedin|github|twitter|facebook|instagram)\.com\/[^\s,]+)/gi,
  [PII_TYPES.ADDRESS]: /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Place|Pl|Parkway|Pkwy)\b/gi
};

const COMMON_FIRST_NAMES = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Daniel', 'Matthew', 'Anthony', 'Donald', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua',
  'Emily', 'Ashley', 'Kimberly', 'Melissa', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Betty',
  'Christopher', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan'
];

const COMMON_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
];

const COMBINED_NAME_REGEX = new RegExp(`\\b(?:${COMMON_FIRST_NAMES.join('|')})\\s+(?:${COMMON_LAST_NAMES.join('|')})\\b`, 'gi');

function detectNames(text) {
  const detections = [];
  
  // Single-pass combined regex search for name combinations
  COMBINED_NAME_REGEX.lastIndex = 0;
  const startTime = Date.now();
  let match;
  
  while ((match = COMBINED_NAME_REGEX.exec(text)) !== null) {
    if (Date.now() - startTime > 1000) break; // Timeout safeguard
    detections.push({
      type: PII_TYPES.NAME,
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.95
    });
    if (match.index === COMBINED_NAME_REGEX.lastIndex) COMBINED_NAME_REGEX.lastIndex++;
  }
  
  // Pattern 2: Capitalized header names
  const headerPattern = /(?:^|\n)([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})(?:\n|$)/g;
  
  while ((match = headerPattern.exec(text)) !== null) {
    const nameMatch = match[1];
    const actualStart = match.index + (match[0].startsWith('\n') ? 1 : 0);
    
    const isDuplicate = detections.some(d => 
      d.start === actualStart && d.value === nameMatch
    );
    
    if (!isDuplicate) {
      detections.push({
        type: PII_TYPES.NAME,
        value: nameMatch,
        start: actualStart,
        end: actualStart + nameMatch.length,
        confidence: 0.85
      });
    }
  }
  
  return detections;
}

function detectPIIInWorker(text, customRules = []) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }
  
  const detections = [];
  let idCounter = 0;
  
  // Detect pattern-based PII
  Object.entries(PATTERNS).forEach(([type, pattern]) => {
    const regex = new RegExp(pattern);
    let match;
    
    regex.lastIndex = 0;
    
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        id: `pii-${idCounter++}`,
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        suggested: PII_REPLACEMENTS[type],
        confidence: 1.0,
        redact: true
      });
    }
  });
  
  // Detect names
  const nameDetections = detectNames(text);
  nameDetections.forEach(detection => {
    detections.push({
      id: `pii-${idCounter++}`,
      ...detection,
      suggested: PII_REPLACEMENTS[PII_TYPES.NAME],
      redact: true
    });
  });
  
  // Apply custom rules if provided
  if (customRules && customRules.length > 0) {
    customRules.forEach(rule => {
      if (!rule.enabled) return;
      
      try {
        const regex = new RegExp(rule.pattern, 'g');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          detections.push({
            id: `pii-${idCounter++}`,
            type: 'CUSTOM',
            customType: rule.name,
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            suggested: rule.replacement || '[REDACTED]',
            confidence: 1.0,
            redact: true
          });
        }
      } catch (e) {
        console.warn(`Invalid custom rule pattern: ${rule.name}`, e);
      }
    });
  }
  
  // Sort and deduplicate
  detections.sort((a, b) => a.start - b.start);
  
  const uniqueDetections = [];
  const seen = new Set();
  
  detections.forEach(detection => {
    const key = `${detection.start}-${detection.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDetections.push(detection);
    }
  });
  
  return uniqueDetections;
}

// Listen for messages from main thread
self.addEventListener('message', (e) => {
  const { type, text, customRules, id } = e.data;
  
  if (type === 'DETECT_PII') {
    try {
      const result = detectPIIInWorker(text, customRules || []);
      self.postMessage({
        type: 'DETECTION_COMPLETE',
        id,
        result
      });
    } catch (error) {
      self.postMessage({
        type: 'DETECTION_ERROR',
        id,
        error: error.message
      });
    }
  }
});
