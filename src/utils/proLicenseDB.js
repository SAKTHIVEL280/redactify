// IndexedDB utility for Pro license key storage with encryption
// Falls back to localStorage in Safari private mode
import { checkIndexedDB, localStorageFallback } from './browserCompat.js';
import { verifyLicenseSignature } from './licenseCrypto.js';

const DB_NAME = 'ResumeRedactorDB';
const DB_VERSION = 5; // Must match customRulesDB version
const STORE_NAME = 'proLicense';
const LOCALSTORAGE_KEY = 'redactify_pro_license_encrypted';

// Track if we're using fallback storage
let useLocalStorageFallback = false;

// Derive encryption key from a stable vault seed
// Ensures consistent key derivation across browser sessions & cookie clears
async function getEncryptionKey() {
  let salt = 'redactify-pro-vault-seed-v1';
  try {
    const storedSalt = localStorage.getItem('redactify_vault_salt');
    if (storedSalt) {
      salt = storedSalt;
    } else {
      localStorage.setItem('redactify_vault_salt', salt);
    }
  } catch (e) {
    // Ignore localStorage access errors (e.g. strict private mode)
  }

  const stableFingerprint = 'redactify-pro-v1-' + salt;
  const encoder = new TextEncoder();
  const data = encoder.encode(stableFingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt data using AES-GCM
async function encryptData(data) {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    // Convert to base64 for storage (stack-safe for large buffers)
    return btoa(Array.from(combined, (b) => String.fromCharCode(b)).join(''));
  } catch (error) {
    console.warn('Encryption warning:', error.message || error);
    throw error;
  }
}

// Decrypt data using AES-GCM
async function decryptData(encryptedBase64) {
  try {
    const key = await getEncryptionKey();
    
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    if (combined.length < 13) {
      throw new Error('Invalid encrypted payload length');
    }
    
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  } catch (error) {
    // Re-throw clean Error message without verbose DOMException stack trace
    throw new Error('License key decryption failed (key or payload mismatch)');
  }
}

// Initialize IndexedDB with localStorage fallback
const initDB = async () => {
  // Check if IndexedDB is available
  const idbCheck = await checkIndexedDB();
  
  if (!idbCheck.available) {
    console.warn('IndexedDB not available, using localStorage fallback:', idbCheck.reason);
    useLocalStorageFallback = true;
    return null; // Return null to indicate fallback mode
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      const error = request.error;
      console.error('IndexedDB error, falling back to localStorage:', error);
      useLocalStorageFallback = true;
      resolve(null); // Don't reject, use fallback
    };
    
    request.onsuccess = () => {
      useLocalStorageFallback = false;
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create proLicense store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      
      // Also create customRules store if it doesn't exist (shared database)
      if (!db.objectStoreNames.contains('customRules')) {
        const store = db.createObjectStore('customRules', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('enabled', 'enabled', { unique: false });
      }
    };
  });
};

// Store Pro license key with localStorage fallback
export const storeProKey = async (licenseData) => {
  try {
    if (!licenseData) {
      throw new Error('License data is required');
    }

    const plainData = {
      key: licenseData.key || licenseData.licenseKey,
      orderId: licenseData.orderId || licenseData.order_id,
      paymentId: licenseData.paymentId || licenseData.payment_id,
      purchasedAt: licenseData.purchasedAt || licenseData.purchased_at || new Date().toISOString(),
      expiresAt: null, // One-time purchase, no expiry
      type: licenseData.type || 'pro_lifetime',
      signature: licenseData.signature,
      isActive: true
    };

    // Mathematically verify asymmetric ECDSA P-256 signature
    const isValidSignature = await verifyLicenseSignature(plainData);
    if (!isValidSignature) {
      throw new Error('License signature verification failed: invalid, forged, or missing cryptographic signature.');
    }
    
    // Encrypt verified data for local storage
    const encryptedData = await encryptData(plainData);
    
    const data = {
      id: 'pro_license',
      encrypted: encryptedData,
      timestamp: Date.now()
    };

    // Try IndexedDB first
    const db = await initDB();
    if (db && !useLocalStorageFallback) {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      // Fallback to localStorage
      await localStorageFallback.setItem(LOCALSTORAGE_KEY, data);
    }
    
    // Notify application of license activation
    window.dispatchEvent(new CustomEvent('licenseStatusChanged', { detail: { isPro: true, data: plainData } }));
    return { success: true, data: plainData };
  } catch (error) {
    console.error('Error storing Pro key:', error);
    return { success: false, error: error.message };
  }
};

// Retrieve Pro license key with localStorage fallback
export const getProKey = async () => {
  try {
    const db = await initDB();
    
    let result;
    if (db && !useLocalStorageFallback) {
      // Try IndexedDB
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      result = await new Promise((resolve) => {
        const request = store.get('pro_license');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
    } else {
      // Fallback to localStorage
      result = await localStorageFallback.getItem(LOCALSTORAGE_KEY);
    }

    if (result && result.encrypted) {
      try {
        const decryptedData = await decryptData(result.encrypted);
        if (decryptedData && decryptedData.isActive) {
          // Cryptographic asymmetric signature verification
          const isSignatureValid = await verifyLicenseSignature(decryptedData);
          if (!isSignatureValid) {
            console.warn('License signature verification failed for stored record. Cleaning up forged record.');
            await deleteProKey();
            return { isValid: false, data: null, error: 'Cryptographic signature verification failed' };
          }
          return { isValid: true, data: decryptedData };
        }
      } catch (decryptError) {
        console.warn('Decryption failed for stored license key. Cleaning up stale record:', decryptError.message || decryptError);
        await deleteProKey();
      }
    }
    
    return { isValid: false, data: null };
  } catch (error) {
    console.error('Error retrieving Pro key:', error);
    return { isValid: false, data: null };
  }
};

// Verify Pro status
export const verifyProStatus = async () => {
  const result = await getProKey();
  return result.isValid;
};

// Check if license was revoked remotely (refund / chargeback)
export const checkRevocationStatus = async () => {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { revoked: false, offline: true };
    }
    const current = await getProKey();
    if (!current.isValid || !current.data) return { revoked: false };

    const { key, paymentId } = current.data;
    const response = await fetch(`/api/check-revocation?key=${encodeURIComponent(key || '')}&paymentId=${encodeURIComponent(paymentId || '')}`);
    if (!response.ok) return { revoked: false };
    
    const resData = await response.json();
    if (resData.revoked) {
      console.warn('License has been revoked remotely. Revoking local Pro access.');
      await deleteProKey();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('licenseStatusChanged', { detail: { isPro: false, revoked: true, reason: resData.reason } }));
      }
      return { revoked: true, reason: resData.reason };
    }
    return { revoked: false };
  } catch (err) {
    return { revoked: false, error: err.message };
  }
};

// Delete Pro license (for testing/refund scenarios) with localStorage fallback
export const deleteProKey = async () => {
  try {
    const db = await initDB();
    
    if (db && !useLocalStorageFallback) {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await store.delete('pro_license');
    }
    await localStorageFallback.removeItem(LOCALSTORAGE_KEY);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('redactify_pro_license_encrypted');
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting Pro key:', error);
    return { success: false, error: error.message };
  }
};

// Real logout: invalidates local license, purges local storage/IDB, releases locks
export const logoutPro = async () => {
  try {
    await deleteProKey();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('redactify_pro_license_encrypted');
      localStorage.removeItem('redactify_vault_salt');
      localStorage.removeItem(LOCALSTORAGE_KEY);
    }
    
    // Release any active concurrency lock held by this device
    try {
      const { releaseRedactionLock } = await import('./concurrencyLock.js');
      await releaseRedactionLock();
    } catch (e) {
      // Ignore lock release failures during logout
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('licenseStatusChanged', { detail: { isPro: false, loggedOut: true } }));
    }
    return { success: true };
  } catch (error) {
    console.error('Error during logout:', error);
    return { success: false, error: error.message };
  }
};