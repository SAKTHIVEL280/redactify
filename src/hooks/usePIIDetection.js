/**
 * Custom hook for PII detection with optional Web Worker support
 * Uses Web Worker for large documents to prevent UI blocking
 */

import { useCallback, useRef, useEffect } from 'react';
import { detectPII } from '../utils/piiDetector';

const LARGE_DOCUMENT_THRESHOLD = 5000; // Use worker for docs > 5000 chars

export function usePIIDetection() {
  const workerRef = useRef(null);
  const pendingCallbacksRef = useRef(new Map());
  const requestIdRef = useRef(0);

  // Initialize Web Worker
  useEffect(() => {
    // Only create worker in production or if explicitly enabled
    const useWorker = import.meta.env.PROD || import.meta.env.VITE_USE_WORKER === 'true';
    
    if (useWorker && window.Worker) {
      try {
        workerRef.current = new Worker(
          new URL('../workers/piiDetectionWorker.js', import.meta.url),
          { type: 'module' }
        );

        workerRef.current.addEventListener('message', (e) => {
          const { type, id, result, error } = e.data;
          
          if (type === 'DETECTION_COMPLETE' || type === 'DETECTION_ERROR') {
            const callback = pendingCallbacksRef.current.get(id);
            if (callback) {
              if (type === 'DETECTION_COMPLETE') {
                callback.resolve(result);
              } else {
                callback.reject(new Error(error));
              }
              pendingCallbacksRef.current.delete(id);
            }
          }
        });

        workerRef.current.addEventListener('error', (error) => {
          console.error('PII Detection Worker error:', error);
          // Fallback to main thread on worker error
          workerRef.current = null;
        });
      } catch (error) {
        console.warn('Failed to initialize Web Worker, using main thread:', error);
        workerRef.current = null;
      }
    }

    return () => {
      // Clear all pending callbacks
      pendingCallbacksRef.current.forEach((callback) => {
        callback.reject(new Error('Worker terminated'));
      });
      pendingCallbacksRef.current.clear();
      
      // Terminate worker
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Detect PII with automatic worker selection
  const detect = useCallback(async (text, customRules = []) => {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const shouldUseWorker = workerRef.current && text.length > LARGE_DOCUMENT_THRESHOLD;

    if (shouldUseWorker) {
      // Use Web Worker for large documents
      return new Promise((resolve, reject) => {
        const id = requestIdRef.current++;
        pendingCallbacksRef.current.set(id, { resolve, reject });

        workerRef.current.postMessage({
          type: 'DETECT_PII',
          text,
          customRules,
          id
        });

        // Timeout fallback
        setTimeout(() => {
          if (pendingCallbacksRef.current.has(id)) {
            pendingCallbacksRef.current.delete(id);
            console.warn('Worker timeout, falling back to main thread');
            resolve(detectPII(text, customRules));
          }
        }, 10000);
      });
    } else {
      // Use main thread for small documents
      return Promise.resolve(detectPII(text, customRules));
    }
  }, []);

  return { detect };
}
