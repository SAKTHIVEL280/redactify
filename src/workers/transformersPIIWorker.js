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

const MODEL_NAME = 'Xenova/bert-base-multilingual-cased-ner-hrl';
const CACHE_NAME = 'transformers-models-cache';
let nerPipeline = null;
let isInitializing = false;

// Entity type mapping to PII categories
// Note: MISC is disabled - it causes too many false positives
const ENTITY_TYPE_MAP = {
  'PER': 'name',        // Person
  'PERSON': 'name',
  'LOC': 'location',    // Location
  'LOCATION': 'location',
  'ORG': 'organization',// Organization
  'ORGANIZATION': 'organization',
  // 'MISC': 'misc'     // Disabled - too many false positives
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
      const output = await nerPipeline(chunk.text);
      
      // Filter out subword tokens and low-quality detections
      const validOutput = output.filter(entity => {
        const word = entity.word || '';
        const entityType = entity.entity;
        
        // Skip entity types we don't want to detect (e.g., MISC)
        if (!ENTITY_TYPE_MAP[entityType]) return false;
        
        const type = ENTITY_TYPE_MAP[entityType];
        
        // Always remove subword tokens
        if (word.startsWith('##')) return false;
        
        // Remove single letters or too short words
        if (word.length <= 1) return false;
        
        // Remove punctuation-only
        if (/^[^\w\s]+$/.test(word)) return false;
        
        // For names, require at least 2 characters
        if (type === 'name' && word.length < 2) return false;
        
        // For organizations and locations, require at least 3 characters
        if ((type === 'organization' || type === 'location') && word.length < 3) return false;
        
        return true;
      });
      
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
        suggested: getSuggestedReplacement(entity.entity, entity.word)
      }));

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
  const type = ENTITY_TYPE_MAP[entityType] || 'misc';
  
  switch (type) {
    case 'name':
      return '[Name Redacted]';
    case 'location':
      return '[Location Redacted]';
    case 'organization':
      return '[Organization Redacted]';
    case 'misc':
      return '[Redacted]';
    default:
      return '[Redacted]';
  }
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
