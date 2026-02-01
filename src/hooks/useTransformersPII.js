/**
 * PII Detection Hook using Transformers.js
 * Uses Xenova/bert-base-NER for Named Entity Recognition
 * Combined with regex patterns for comprehensive coverage
 */

import { useCallback, useRef, useEffect, useState } from 'react';

const MODEL_NAME = 'Xenova/bert-base-NER';
const CACHE_NAME = 'transformers-models-cache';
const MODEL_CACHE_KEY = `${MODEL_NAME}-v1`;

export function useTransformersPII() {
  const workerRef = useRef(null);
  const pendingCallbacksRef = useRef(new Map());
  const requestIdRef = useRef(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);

  // Initialize Web Worker
  useEffect(() => {
    if (!window.Worker) {
      setError('Web Workers not supported');
      return;
    }

    try {
      workerRef.current = new Worker(
        new URL('../workers/transformersPIIWorker.js', import.meta.url),
        { type: 'module' }
      );

      // Listen for worker messages
      workerRef.current.addEventListener('message', (e) => {
        const { type, id, result, error: workerError, progress } = e.data;

        switch (type) {
          case 'MODEL_LOADING':
            setIsModelLoading(true);
            setLoadingProgress(progress || 0);
            break;

          case 'MODEL_LOADED':
            setIsModelLoaded(true);
            setIsModelLoading(false);
            setLoadingProgress(100);
            break;

          case 'MODEL_ERROR':
            setError(workerError || 'Failed to load model');
            setIsModelLoaded(false);
            setIsModelLoading(false);
            break;

          case 'DETECTION_COMPLETE':
            const callback = pendingCallbacksRef.current.get(id);
            if (callback) {
              callback.resolve(result);
              pendingCallbacksRef.current.delete(id);
            }
            break;

          case 'DETECTION_ERROR':
            const errorCallback = pendingCallbacksRef.current.get(id);
            if (errorCallback) {
              errorCallback.reject(new Error(workerError));
              pendingCallbacksRef.current.delete(id);
            }
            break;

          default:
            break;
        }
      });

      workerRef.current.addEventListener('error', (error) => {
        console.error('Transformers.js Worker error:', error);
        setError('Worker crashed: ' + error.message);
        workerRef.current = null;
      });

      // Don't auto-initialize - let user trigger download manually
      // workerRef.current.postMessage({ type: 'INIT_MODEL' });
    } catch (error) {
      console.error('Failed to initialize Transformers.js worker:', error);
      setError(error.message);
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

  /**
   * Detect PII using Transformers.js NER model
   * @param {string} text - Text to analyze
   * @returns {Promise<Array>} Array of detected entities
   */
  const detectPII = useCallback(async (text) => {
    if (!text || text.trim().length === 0) {
      return [];
    }

    if (!workerRef.current) {
      throw new Error('Worker not initialized');
    }

    if (!isModelLoaded) {
      throw new Error('Model not loaded yet. Please wait.');
    }

    return new Promise((resolve, reject) => {
      const id = requestIdRef.current++;
      pendingCallbacksRef.current.set(id, { resolve, reject });

      workerRef.current.postMessage({
        type: 'DETECT_PII',
        text,
        id
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingCallbacksRef.current.has(id)) {
          pendingCallbacksRef.current.delete(id);
          reject(new Error('Detection timeout'));
        }
      }, 30000);
    });
  }, [isModelLoaded]);

  /**
   * Check if model is cached
   * @returns {Promise<boolean>}
   */
  const isModelCached = useCallback(async () => {
    if (!('caches' in window)) return false;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(MODEL_CACHE_KEY);
      return !!cachedResponse;
    } catch (error) {
      console.warn('Cache check failed:', error);
      return false;
    }
  }, []);

  /**
   * Manually initialize the model (triggers download)
   */
  const initModel = useCallback(() => {
    if (workerRef.current && !isModelLoaded) {
      workerRef.current.postMessage({ type: 'INIT_MODEL' });
    }
  }, [isModelLoaded]);

  /**
   * Clear cached model (for debugging/updates)
   */
  const clearModelCache = useCallback(async () => {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(MODEL_CACHE_KEY);
      setIsModelLoaded(false);
      setLoadingProgress(0);
    } catch (error) {
      console.error('Failed to clear model cache:', error);
    }
  }, []);

  return {
    detectPII,
    isModelLoaded,
    isModelLoading,
    loadingProgress,
    error,
    isModelCached,
    initModel,
    clearModelCache
  };
}
