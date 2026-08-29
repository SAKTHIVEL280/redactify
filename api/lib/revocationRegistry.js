/**
 * Shared Revocation Registry for Redactify
 * Maintains revoked license keys and payment IDs with Supabase backing
 * and in-memory caching.
 */

// In-memory set of revoked license keys and payment IDs
const revokedKeys = new Set();
const revokedPaymentIds = new Set();
const revocationDetails = new Map();

/**
 * Record a revocation event
 */
export async function recordRevocation({ licenseKey, paymentId, reason = 'refund', revokedAt = new Date().toISOString() }) {
  if (licenseKey) revokedKeys.add(licenseKey);
  if (paymentId) revokedPaymentIds.add(paymentId);

  const detail = { reason, revokedAt };
  if (licenseKey) revocationDetails.set(licenseKey, detail);
  if (paymentId) revocationDetails.set(paymentId, detail);

  // Sync to Supabase if credentials exist
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseUrl && serviceKey) {
    try {
      if (paymentId) {
        await fetch(`${supabaseUrl}/rest/v1/pro_licenses?payment_id=eq.${encodeURIComponent(paymentId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          },
          body: JSON.stringify({
            is_active: false,
            revoked_at: revokedAt,
            revocation_reason: reason
          })
        });
      } else if (licenseKey) {
        await fetch(`${supabaseUrl}/rest/v1/pro_licenses?license_key=eq.${encodeURIComponent(licenseKey)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          },
          body: JSON.stringify({
            is_active: false,
            revoked_at: revokedAt,
            revocation_reason: reason
          })
        });
      }
    } catch (err) {
      console.error('Supabase revocation sync error (cached locally):', err.message || err);
    }
  }

  return { success: true, revokedAt, reason };
}

/**
 * Check if a license key or payment ID is revoked
 */
export async function isRevoked(licenseKey, paymentId) {
  // Check in-memory cache first
  if (licenseKey && revokedKeys.has(licenseKey)) {
    return { revoked: true, ...revocationDetails.get(licenseKey) };
  }
  if (paymentId && revokedPaymentIds.has(paymentId)) {
    return { revoked: true, ...revocationDetails.get(paymentId) };
  }

  // Check Supabase if configured
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseUrl && serviceKey) {
    try {
      const filter = paymentId 
        ? `payment_id=eq.${encodeURIComponent(paymentId)}`
        : `license_key=eq.${encodeURIComponent(licenseKey)}`;

      const res = await fetch(
        `${supabaseUrl}/rest/v1/pro_licenses?${filter}&is_active=eq.false&select=license_key,payment_id,revoked_at,revocation_reason&limit=1`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          }
        }
      );

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const detail = {
            revoked: true,
            reason: rows[0].revocation_reason || 'refund',
            revokedAt: rows[0].revoked_at || new Date().toISOString()
          };
          if (licenseKey) {
            revokedKeys.add(licenseKey);
            revocationDetails.set(licenseKey, detail);
          }
          if (paymentId) {
            revokedPaymentIds.add(paymentId);
            revocationDetails.set(paymentId, detail);
          }
          return detail;
        }
      }
    } catch (err) {
      console.error('Supabase revocation check error:', err.message || err);
    }
  }

  return { revoked: false };
}
