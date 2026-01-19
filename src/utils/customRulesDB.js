// IndexedDB utility for Custom Regex Rules storage with localStorage fallback
import { checkIndexedDB, localStorageFallback } from './browserCompat';

const DB_NAME = 'ResumeRedactorDB';
const DB_VERSION = 3; // Incremented to ensure fresh store creation
const CUSTOM_RULES_STORE = 'customRules';
const LOCALSTORAGE_KEY = 'redactify_custom_rules';

// Track if we're using fallback storage
let useLocalStorageFallback = false;

// Initialize IndexedDB with custom rules store and localStorage fallback
const initDB = async () => {
  // Check if IndexedDB is available
  const idbCheck = await checkIndexedDB();
  
  if (!idbCheck.available) {
    console.warn('IndexedDB not available, using localStorage fallback:', idbCheck.reason);
    useLocalStorageFallback = true;
    return null;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('IndexedDB error, falling back to localStorage:', request.error);
      useLocalStorageFallback = true;
      resolve(null);
    };
    request.onsuccess = () => {
      useLocalStorageFallback = false;
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(CUSTOM_RULES_STORE)) {
        const store = db.createObjectStore(CUSTOM_RULES_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('enabled', 'enabled', { unique: false });
      }
    };
  });
};

// Add custom rule
export const addCustomRule = async (rule) => {
  try {
    const data = {
      name: rule.name,
      pattern: rule.pattern,
      replacement: rule.replacement || '[REDACTED]',
      description: rule.description || '',
      enabled: rule.enabled !== undefined ? rule.enabled : true,
      createdAt: new Date().toISOString()
    };
    
    if (useLocalStorageFallback) {
      const id = localStorageFallback.add('customRules', data);
      return { success: true, id };
    }
    
    const db = await initDB();
    const transaction = db.transaction([CUSTOM_RULES_STORE], 'readwrite');
    const store = transaction.objectStore(CUSTOM_RULES_STORE);
    
    const id = await new Promise((resolve, reject) => {
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return { success: true, id };
  } catch (error) {
    console.error('Error adding custom rule:', error);
    return { success: false, error: error.message };
  }
};

// Get all custom rules
export const getAllCustomRules = async () => {
  try {
    if (useLocalStorageFallback) {
      return localStorageFallback.getAll('customRules');
    }
    
    const db = await initDB();
    const transaction = db.transaction([CUSTOM_RULES_STORE], 'readonly');
    const store = transaction.objectStore(CUSTOM_RULES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error retrieving custom rules:', error);
    return [];
  }
};

// Get enabled custom rules only
export const getEnabledCustomRules = async () => {
  try {
    const allRules = await getAllCustomRules();
    return allRules.filter(rule => rule.enabled);
  } catch (error) {
    console.error('Error retrieving enabled custom rules:', error);
    return [];
  }
};

// Update custom rule
export const updateCustomRule = async (id, updates) => {
  try {
    if (useLocalStorageFallback) {
      const success = localStorageFallback.update('customRules', id, updates);
      return { success };
    }
    
    const db = await initDB();
    const transaction = db.transaction([CUSTOM_RULES_STORE], 'readwrite');
    const store = transaction.objectStore(CUSTOM_RULES_STORE);
    
    const existing = await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (!existing) {
      return { success: false, error: 'Rule not found' };
    }
    
    const updated = { ...existing, ...updates, id };
    
    await new Promise((resolve, reject) => {
      const request = store.put(updated);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating custom rule:', error);
    return { success: false, error: error.message };
  }
};

// Delete custom rule
export const deleteCustomRule = async (id) => {
  try {
    if (useLocalStorageFallback) {
      const success = localStorageFallback.delete('customRules', id);
      return { success };
    }
    
    const db = await initDB();
    const transaction = db.transaction([CUSTOM_RULES_STORE], 'readwrite');
    const store = transaction.objectStore(CUSTOM_RULES_STORE);
    
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting custom rule:', error);
    return { success: false, error: error.message };
  }
};

// Toggle custom rule enabled state
export const toggleCustomRule = async (id) => {
  try {
    if (useLocalStorageFallback) {
      const rules = localStorageFallback.getAll('customRules');
      const rule = rules.find(r => r.id === id);
      if (!rule) {
        return { success: false, error: 'Rule not found' };
      }
      const enabled = !rule.enabled;
      const success = localStorageFallback.update('customRules', id, { enabled });
      return { success, enabled };
    }
    
    const db = await initDB();
    const transaction = db.transaction([CUSTOM_RULES_STORE], 'readwrite');
    const store = transaction.objectStore(CUSTOM_RULES_STORE);
    
    const existing = await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (!existing) {
      return { success: false, error: 'Rule not found' };
    }
    
    existing.enabled = !existing.enabled;
    
    await new Promise((resolve, reject) => {
      const request = store.put(existing);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return { success: true, enabled: existing.enabled };
  } catch (error) {
    console.error('Error toggling custom rule:', error);
    return { success: false, error: error.message };
  }
};
