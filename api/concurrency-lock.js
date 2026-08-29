/**
 * Vercel Serverless Function: Concurrent Redaction Lock
 * Endpoint: /api/concurrency-lock
 * Method: POST
 * Body: { action: 'acquire' | 'heartbeat' | 'release', licenseKey, deviceId }
 * 
 * Manages active redaction job locks across multiple devices logged into the same account.
 * Lock TTL: 45 seconds (auto-expires if tab closes or device crashes).
 * Heartbeat: Renews every 15 seconds during active document processing.
 */

import { createRateLimiter, applyRateLimit } from '../lib/rateLimit.js';

const checkRateLimit = createRateLimiter(60 * 1000, 60); // 60 req/min/IP (covers heartbeats)

// In-memory active locks store with Supabase synchronization
// Map<licenseKey, { deviceId, lockedAt, expiresAt }>
const activeLocks = new Map();

const LOCK_TTL_MS = 45 * 1000; // 45 seconds auto-expiry timeout

async function supabaseLockOperation(action, licenseKey, deviceId, now) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    if (action === 'acquire') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/redaction_locks?license_key=eq.${encodeURIComponent(licenseKey)}&select=device_id,expires_at`,
        {
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const lock = rows[0];
          const expiresAtMs = new Date(lock.expires_at).getTime();
          if (lock.device_id !== deviceId && expiresAtMs > now) {
            const remainingSeconds = Math.max(1, Math.ceil((expiresAtMs - now) / 1000));
            return {
              success: true,
              acquired: false,
              lockedByAnotherDevice: true,
              remainingSeconds,
              message: 'Document processing in progress on another device. Simultaneous redactions on the same license are queued to protect system resources and document integrity. Please wait for the current job to complete.'
            };
          }
        }
      }

      const newExpiresAt = new Date(now + LOCK_TTL_MS).toISOString();
      const upsertRes = await fetch(`${supabaseUrl}/rest/v1/redaction_locks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: deviceId,
          locked_at: new Date(now).toISOString(),
          expires_at: newExpiresAt
        })
      });
      if (upsertRes.ok) {
        return {
          success: true,
          acquired: true,
          expiresAt: now + LOCK_TTL_MS,
          ttlSeconds: Math.round(LOCK_TTL_MS / 1000)
        };
      }
    } else if (action === 'heartbeat') {
      const newExpiresAt = new Date(now + LOCK_TTL_MS).toISOString();
      const patchRes = await fetch(
        `${supabaseUrl}/rest/v1/redaction_locks?license_key=eq.${encodeURIComponent(licenseKey)}&device_id=eq.${encodeURIComponent(deviceId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ expires_at: newExpiresAt })
        }
      );
      if (patchRes.ok) {
        const rows = await patchRes.json();
        const renewed = Array.isArray(rows) && rows.length > 0;
        return { success: true, renewed, expiresAt: now + LOCK_TTL_MS };
      }
    } else if (action === 'release') {
      await fetch(
        `${supabaseUrl}/rest/v1/redaction_locks?license_key=eq.${encodeURIComponent(licenseKey)}&device_id=eq.${encodeURIComponent(deviceId)}`,
        {
          method: 'DELETE',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
        }
      );
      return { success: true, released: true };
    }
  } catch (err) {
    console.warn('Supabase lock operation fallback to in-memory:', err.message || err);
  }
  return null;
}

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.daeq.in,http://localhost:5173,http://localhost:3000,http://localhost:4173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const origin = req.headers.origin;
  const isVercelPreview = origin && /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin);
  const isAllowed = !origin || allowedOrigins.includes(origin) || isVercelPreview || process.env.NODE_ENV !== 'production';

  if (origin && isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (applyRateLimit(req, res, checkRateLimit, 60)) return;

  const { action, licenseKey, deviceId } = req.body || {};

  if (!action || !licenseKey || !deviceId) {
    return res.status(400).json({ error: 'Missing required fields: action, licenseKey, deviceId' });
  }

  const normalizedKey = licenseKey.trim();
  const normalizedDevice = deviceId.trim();
  const now = Date.now();

  try {
    // Try Supabase persistent lock first if configured
    const dbResult = await supabaseLockOperation(action, normalizedKey, normalizedDevice, now);
    if (dbResult) {
      return res.status(200).json(dbResult);
    }

    // In-memory fallback
    const currentLock = activeLocks.get(normalizedKey);
    if (currentLock && currentLock.expiresAt <= now) {
      activeLocks.delete(normalizedKey);
    }

    // 1. ACQUIRE LOCK
    if (action === 'acquire') {
      const existing = activeLocks.get(normalizedKey);

      // If another device holds an unexpired lock
      if (existing && existing.deviceId !== normalizedDevice && existing.expiresAt > now) {
        const remainingSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
        return res.status(200).json({
          success: true,
          acquired: false,
          lockedByAnotherDevice: true,
          remainingSeconds,
          message: 'Document processing in progress on another device. Simultaneous redactions on the same license are queued to protect system resources and document integrity. Please wait for the current job to complete.'
        });
      }

      // Grant or refresh lock for this device
      const newExpiresAt = now + LOCK_TTL_MS;
      activeLocks.set(normalizedKey, {
        deviceId: normalizedDevice,
        lockedAt: now,
        expiresAt: newExpiresAt
      });

      return res.status(200).json({
        success: true,
        acquired: true,
        expiresAt: newExpiresAt,
        ttlSeconds: Math.round(LOCK_TTL_MS / 1000)
      });
    }

    // 2. HEARTBEAT (Extend lock while redaction job is running)
    if (action === 'heartbeat') {
      const existing = activeLocks.get(normalizedKey);

      if (!existing || existing.deviceId !== normalizedDevice) {
        return res.status(200).json({
          success: true,
          renewed: false,
          message: 'Lock expired or reassigned to another device'
        });
      }

      existing.expiresAt = now + LOCK_TTL_MS;
      return res.status(200).json({
        success: true,
        renewed: true,
        expiresAt: existing.expiresAt
      });
    }

    // 3. RELEASE LOCK (Job completed or aborted)
    if (action === 'release') {
      const existing = activeLocks.get(normalizedKey);

      if (existing && existing.deviceId === normalizedDevice) {
        activeLocks.delete(normalizedKey);
      }

      return res.status(200).json({
        success: true,
        released: true
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error('Concurrency lock error:', error);
    return res.status(500).json({ error: 'Lock operation failed' });
  }
}
