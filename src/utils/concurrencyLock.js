/**
 * Client-Side Concurrency Lock Manager
 * Coordinates simultaneous redaction jobs across devices logged into the same account.
 * Lock TTL: 45s server-side with a 15s heartbeat during active processing.
 */

let activeHeartbeatTimer = null;
let currentActiveLicenseKey = null;

/**
 * Get or create a persistent unique device ID for this browser profile
 */
export function getDeviceId() {
  const STORAGE_KEY = 'redactify_device_id';
  try {
    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId) {
      deviceId = 'dev_' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch (e) {
    return 'dev_ephemeral_' + Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Attempt to acquire an exclusive redaction job lock
 */
export async function acquireRedactionLock(licenseKey) {
  if (!licenseKey) {
    return { acquired: true }; // Free tier or no license
  }

  // If client is offline, allow local processing (preserves offline functionality)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { acquired: true, offline: true };
  }

  const deviceId = getDeviceId();
  currentActiveLicenseKey = licenseKey;

  try {
    const res = await fetch('/api/concurrency-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'acquire',
        licenseKey,
        deviceId
      })
    });

    if (!res.ok) {
      // Server error or non-responsive — fail open for user productivity
      console.warn('Concurrency lock check unavailable, proceeding locally');
      return { acquired: true };
    }

    const data = await res.json();

    if (data.acquired) {
      // Start 15s heartbeat interval while redaction is active
      stopHeartbeat();
      activeHeartbeatTimer = setInterval(async () => {
        try {
          if (currentActiveLicenseKey) {
            await fetch('/api/concurrency-lock', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'heartbeat',
                licenseKey: currentActiveLicenseKey,
                deviceId
              })
            });
          }
        } catch (hbErr) {
          console.warn('Lock heartbeat error:', hbErr);
        }
      }, 15000);

      return { acquired: true };
    } else {
      // Blocked by another device
      return {
        acquired: false,
        remainingSeconds: data.remainingSeconds || 45,
        message: data.message || 'Document processing in progress on another device.'
      };
    }
  } catch (error) {
    console.warn('Network error acquiring concurrency lock:', error.message || error);
    // Allow local redaction if network is unreachable
    return { acquired: true, offlineFallback: true };
  }
}

/**
 * Release active lock upon completion or cancellation
 */
export async function releaseRedactionLock() {
  stopHeartbeat();

  if (!currentActiveLicenseKey) return;

  const keyToRelease = currentActiveLicenseKey;
  currentActiveLicenseKey = null;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  try {
    const deviceId = getDeviceId();
    await fetch('/api/concurrency-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'release',
        licenseKey: keyToRelease,
        deviceId
      })
    });
  } catch (err) {
    console.warn('Error releasing lock:', err);
  }
}

function stopHeartbeat() {
  if (activeHeartbeatTimer) {
    clearInterval(activeHeartbeatTimer);
    activeHeartbeatTimer = null;
  }
}
