/**
 * Browser Compatibility Detection and Fallbacks
 * Handles Safari private mode, missing APIs, and provides polyfills
 */

/**
 * Check if IndexedDB is available and functional
 * Safari private mode blocks IndexedDB
 */
export async function checkIndexedDB() {
  if (!window.indexedDB) {
    return { available: false, reason: 'IndexedDB not supported' };
  }

  try {
    // Try to open a test database
    const testDB = await new Promise((resolve, reject) => {
      const request = indexedDB.open('__test__');
      request.onsuccess = () => {
        const db = request.result;
        db.close();
        indexedDB.deleteDatabase('__test__');
        resolve(true);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('blocked'));
    });
    
    return { available: true };
  } catch (error) {
    return { 
      available: false, 
      reason: error.message || 'IndexedDB blocked (Safari private mode?)',
      isPrivateMode: true
    };
  }
}

/**
 * Check Web Worker support
 */
export function checkWebWorkers() {
  return {
    available: typeof Worker !== 'undefined',
    reason: typeof Worker === 'undefined' ? 'Web Workers not supported' : null
  };
}

/**
 * Check Cache API support
 */
export function checkCacheAPI() {
  return {
    available: 'caches' in window,
    reason: !('caches' in window) ? 'Cache API not supported' : null
  };
}

/**
 * Check if browser supports optional chaining and other ES2020 features
 */
export function checkES2020Support() {
  try {
    // Test optional chaining
    const test = { a: { b: 1 } };
    const result = test?.a?.b;
    
    // Test nullish coalescing
    const nullish = null ?? 'default';
    
    // Test BigInt
    const bigInt = BigInt(9007199254740991);
    
    return { available: true };
  } catch (error) {
    return { 
      available: false, 
      reason: 'ES2020 features not supported',
      needsPolyfill: true
    };
  }
}

/**
 * Comprehensive browser compatibility check
 */
export async function checkBrowserCompatibility() {
  const checks = {
    indexedDB: await checkIndexedDB(),
    webWorkers: checkWebWorkers(),
    cacheAPI: checkCacheAPI(),
    es2020: checkES2020Support()
  };

  const issues = [];
  const warnings = [];

  if (!checks.indexedDB.available) {
    if (checks.indexedDB.isPrivateMode) {
      warnings.push({
        feature: 'IndexedDB',
        message: 'IndexedDB is disabled (Safari private mode detected). Pro features will use localStorage instead.',
        severity: 'warning'
      });
    } else {
      issues.push({
        feature: 'IndexedDB',
        message: 'IndexedDB not available. Pro features may not work correctly.',
        severity: 'error'
      });
    }
  }

  if (!checks.webWorkers.available) {
    warnings.push({
      feature: 'Web Workers',
      message: 'Web Workers not supported. Large documents may cause UI freezing.',
      severity: 'warning'
    });
  }

  if (!checks.cacheAPI.available) {
    warnings.push({
      feature: 'Cache API',
      message: 'Cache API not available. AI model won\'t be cached (will re-download each session).',
      severity: 'warning'
    });
  }

  if (!checks.es2020.available) {
    issues.push({
      feature: 'ES2020',
      message: 'Your browser is too old. Please update to a modern browser.',
      severity: 'error'
    });
  }

  return {
    compatible: issues.length === 0,
    checks,
    issues,
    warnings,
    browserInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    }
  };
}

/**
 * LocalStorage fallback for IndexedDB
 * Used in Safari private mode
 */
export const localStorageFallback = {
  async getItem(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('LocalStorage getItem failed:', error);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('LocalStorage setItem failed:', error);
      return false;
    }
  },

  async removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('LocalStorage removeItem failed:', error);
      return false;
    }
  },

  async getAllKeys() {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.error('LocalStorage getAllKeys failed:', error);
      return [];
    }
  },

  // Collection-based methods for IndexedDB fallback
  add(collectionName, data) {
    try {
      const key = `redactify_${collectionName}`;
      const collection = JSON.parse(localStorage.getItem(key) || '[]');
      const id = Date.now() + Math.random();
      const item = { ...data, id };
      collection.push(item);
      localStorage.setItem(key, JSON.stringify(collection));
      return id;
    } catch (error) {
      console.error('LocalStorage add failed:', error);
      return null;
    }
  },

  getAll(collectionName) {
    try {
      const key = `redactify_${collectionName}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (error) {
      console.error('LocalStorage getAll failed:', error);
      return [];
    }
  },

  update(collectionName, id, updates) {
    try {
      const key = `redactify_${collectionName}`;
      const collection = JSON.parse(localStorage.getItem(key) || '[]');
      const index = collection.findIndex(item => item.id === id);
      if (index === -1) return false;
      collection[index] = { ...collection[index], ...updates, id };
      localStorage.setItem(key, JSON.stringify(collection));
      return true;
    } catch (error) {
      console.error('LocalStorage update failed:', error);
      return false;
    }
  },

  delete(collectionName, id) {
    try {
      const key = `redactify_${collectionName}`;
      const collection = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = collection.filter(item => item.id !== id);
      localStorage.setItem(key, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('LocalStorage delete failed:', error);
      return false;
    }
  }
};

/**
 * Get recommended file size limits based on available memory
 */
export function getFileSizeLimits() {
  // Default limits (conservative)
  const limits = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    warningSize: 5 * 1024 * 1024,   // 5MB
    maxTextLength: 1000000          // 1M characters
  };

  // Check if we can get memory info (Chrome only)
  if (performance.memory) {
    const availableMemory = performance.memory.jsHeapSizeLimit;
    // Allow up to 1/4 of available heap for file processing
    const recommendedMax = Math.floor(availableMemory / 4);
    limits.maxFileSize = Math.min(recommendedMax, 50 * 1024 * 1024); // Cap at 50MB
  }

  return limits;
}

/**
 * Show compatibility warnings to user
 */
export function showCompatibilityWarnings(compatResult) {
  const messages = [];

  if (compatResult.warnings.length > 0) {
    compatResult.warnings.forEach(warning => {
      messages.push(`⚠️ ${warning.feature}: ${warning.message}`);
    });
  }

  if (compatResult.issues.length > 0) {
    compatResult.issues.forEach(issue => {
      messages.push(`❌ ${issue.feature}: ${issue.message}`);
    });
  }

  return messages;
}
