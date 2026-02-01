/**
 * Transformers.js Web Worker for PII Detection
 * Uses ONNX Runtime Web to run quantized BERT model for Named Entity Recognition
 * Model: Xenova/bert-base-multilingual-cased-ner-hrl (~20MB quantized)
 * 
 * Features:
 * - Cache API for model persistence across sessions
 * - Progress reporting during model download
 * - Chunked text processing for large documents
 * - Entity type mapping to PII categories
 */

import { pipeline, env } from '@xenova/transformers';

// Configure Transformers.js
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

// GLiNER-PII: Purpose-built for PII detection with 60+ categories
const MODEL_NAME = 'knowledgator/gliner-pii-edge-v1.0';
const CACHE_NAME = 'transformers-models-cache';
let nerPipeline = null;
let isInitializing = false;

// GLiNER PII Categories - Zero-shot, runtime configurable
const PII_LABELS = [
  // Core Identity
  'person name', 'email address', 'phone number', 'ssn', 'passport number',
  // Financial
  'credit card number', 'bank account number', 'routing number', 'tax id',
  // Location
  'street address', 'city', 'state', 'zip code', 'country', 'location',
  // Personal Info
  'date of birth', 'age', 'gender', 'nationality', 'ethnicity',
  // Professional
  'organization', 'company name', 'job title', 'employee id',
  // Medical
  'medical record number', 'health insurance number', 'diagnosis',
  // Online
  'ip address', 'username', 'password', 'url', 'social media handle',
  // Government
  'driver license', 'vehicle registration', 'national id',
  // Other
  'biometric data', 'signature', 'photo', 'video'
];

// Simplified mapping for display
const ENTITY_TYPE_MAP = {
  'person name': 'name',
  'email address': 'email',
  'phone number': 'phone',
  'ssn': 'ssn',
  'credit card number': 'credit_card',
  'street address': 'address',
  'date of birth': 'dob',
  'ip address': 'ip',
  'url': 'url',
  'organization': 'organization',
  'company name': 'organization',
  'location': 'location',
  'city': 'location',
  'state': 'location'
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
      quantized: true, // Use int8 quantization (~20MB)
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
      // GLiNER: Pass labels for zero-shot detection
      const output = await nerPipeline(chunk.text, {
        labels: PII_LABELS,
        threshold: 0.5 // Minimum confidence
      });
      
      console.log('[WORKER DEBUG] Raw GLiNER output:', output.length, 'entities');
      console.log('[WORKER DEBUG] First 5 entities:', output.slice(0, 5));
      
      // GLiNER returns cleaner output, less filtering needed
      const validOutput = output.filter(entity => {
        const word = entity.word || entity.text || '';
        const label = entity.entity || entity.label || '';
        
        // Must have a valid label we care about
        if (!ENTITY_TYPE_MAP[label] && !PII_LABELS.includes(label)) {
          return false;
        }
        
        // Skip very short matches
        if (word.length <= 2) return false;
        
        // Skip low confidence
        if (entity.score < 0.5) return false;
        
        // Remove punctuation-only
        if (/^[^\w\s@.-]+$/.test(word)) return false;
        
        return true;
      });
      
      console.log('[WORKER DEBUG] After filtering:', validOutput.length, 'entities');
      
      // Convert to standardized format
      const entities = validOutput.map((entity, index) => {
        const label = entity.entity || entity.label || '';
        const text = entity.word || entity.text || '';
        const mappedType = ENTITY_TYPE_MAP[label] || label.replace(/\s+/g, '_');
        
        return {
          id: `gliner-${chunk.offset}-${index}`,
          type: mappedType,
          originalType: label,
          value: text,
          start: (entity.start || entity.offset || 0) + chunk.offset,
          end: (entity.end || (entity.start || 0) + text.length) + chunk.offset,
          confidence: entity.score || 0,
          redact: true,
          suggested: getSuggestedReplacement(label, text)
        };
      });

      allEntities.push(...entities);
    } catch (error) {
      console.error('Error processing chunk:', error);
    }
  }

  // Merge adjacent entities of the same type
  const mergedEntities = mergeAdjacentEntities(allEntities);

  return mergedEntities;
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
 * Get suggested replacement text based on entity type
 */
function getSuggestedReplacement(entityType, originalValue) {
  // Handle direct GLiNER labels or mapped types
  const label = entityType.toLowerCase();
  
  // Email patterns
  if (label.includes('email')) return '[email redacted]';
  if (label.includes('phone')) return '[phone redacted]';
  
  // Identity
  if (label.includes('name') && !label.includes('user')) return '[Name Redacted]';
  if (label.includes('ssn') || label.includes('social security')) return '[SSN redacted]';
  if (label.includes('passport')) return '[passport redacted]';
  if (label.includes('license') || label.includes('driver')) return '[ID redacted]';
  
  // Financial
  if (label.includes('credit card')) return '[card redacted]';
  if (label.includes('bank') || label.includes('account')) return '[account redacted]';
  if (label.includes('routing')) return '[routing redacted]';
  
  // Location
  if (label.includes('address')) return '[address redacted]';
  if (label.includes('city') || label.includes('location')) return '[Location Redacted]';
  if (label.includes('zip') || label.includes('postal')) return '[ZIP redacted]';
  
  // Organization
  if (label.includes('organization') || label.includes('company')) return '[Organization Redacted]';
  
  // Personal
  if (label.includes('dob') || label.includes('date of birth')) return '[DOB redacted]';
  if (label.includes('age')) return '[age redacted]';
  
  // Online
  if (label.includes('ip')) return '[IP redacted]';
  if (label.includes('url') || label.includes('website')) return '[URL redacted]';
  if (label.includes('username')) return '[username redacted]';
  
  // Default
  return '[Redacted]';
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
