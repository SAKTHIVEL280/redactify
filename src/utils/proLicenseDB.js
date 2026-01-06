// IndexedDB utility for Pro license key storage with encryption
const DB_NAME = 'ResumeRedactorDB';
const DB_VERSION = 2; // Must match customRulesDB version
const STORE_NAME = 'proLicense';

// Derive encryption key from browser fingerprint
async function getEncryptionKey() {
  const browserFingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
  const encoder = new TextEncoder();
  const data = encoder.encode(browserFingerprint);
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
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

// Decrypt data using AES-GCM
async function decryptData(encryptedBase64) {
  try {
    const key = await getEncryptionKey();
    
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
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
    console.error('Decryption error:', error);
    throw error;
  }
}

// Initialize IndexedDB
const initDB = () => {
  return new Promise((resolve, reject) => {
    // Check IndexedDB availability (fails in Safari private mode)
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not available. Please disable private browsing mode.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      const error = request.error;
      if (error.name === 'InvalidStateError') {
        reject(new Error('IndexedDB not available in private mode. Please disable private browsing.'));
      } else {
        reject(error);
      }
    };
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Store Pro license key
export const storeProKey = async (licenseData) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const plainData = {
      key: licenseData.key,
      orderId: licenseData.orderId,
      paymentId: licenseData.paymentId,
      purchasedAt: licenseData.purchasedAt || new Date().toISOString(),
      expiresAt: null, // One-time purchase, no expiry
      isActive: true
    };
    
    // Encrypt sensitive data
    const encryptedData = await encryptData(plainData);
    
    const data = {
      id: 'pro_license',
      encrypted: encryptedData,
      timestamp: Date.now()
    };
    
    await store.put(data);
    return { success: true, data: plainData };
  } catch (error) {
    console.error('Error storing Pro key:', error);
    return { success: false, error: error.message };
  }
};

// Retrieve Pro license key
export const getProKey = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get('pro_license');
      request.onsuccess = async () => {
        const result = request.result;
        if (result && result.encrypted) {
          try {
            const decryptedData = await decryptData(result.encrypted);
            if (decryptedData && decryptedData.isActive) {
              resolve({ isValid: true, data: decryptedData });
            } else {
              resolve({ isValid: false, data: null });
            }
          } catch (decryptError) {
            console.error('Decryption failed:', decryptError);
            resolve({ isValid: false, data: null });
          }
        } else {
          resolve({ isValid: false, data: null });
        }
      };
      request.onerror = () => reject(request.error);
    });
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

// Delete Pro license (for testing/refund scenarios)
export const deleteProKey = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await store.delete('pro_license');
    return { success: true };
  } catch (error) {
    console.error('Error deleting Pro key:', error);
    return { success: false, error: error.message };
  }
};
