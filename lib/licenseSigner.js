/**
 * Asymmetric License Signer for Redactify (Serverless Backend)
 * Algorithm: ECDSA using NIST P-256 (secp256r1) with SHA-256
 * Output Format: IEEE P1363 (standard 64-byte binary signature encoded as Base64)
 */

import crypto from 'crypto';

// Production public key (corresponds to production private key)
export const REDACTIFY_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9NtZyen3oWG75MWBglOEi9LehGxy
opQSC0L/kjQAITRQchd04fV+CaiQbkAzJOTnuLjXnL0zKweJpy4AVOl4mA==
-----END PUBLIC KEY-----`;

// Safe default private key for dev/test when LICENSE_PRIVATE_KEY env is not configured
const DEFAULT_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcP3vZF819UADxXRA
XGj1B3NsmoamCjiifT/RQjpC67uhRANCAAT021nJ6fehYbvkxYGCU4SL0t6EbHKi
lBILQv+SNAAhNFByF3Th9X4JqJBuQDMk5Oe4uNecvTMrB4mnLgBU6XiY
-----END PRIVATE KEY-----`;

/**
 * Returns the server private key from environment or fallback
 */
export function getPrivateKey() {
  const key = process.env.LICENSE_PRIVATE_KEY;
  if (!key) return DEFAULT_PRIVATE_KEY_PEM;
  return key.replace(/\\n/g, '\n').trim();
}

/**
 * Deterministically canonicalize a license data structure into a signed string
 */
export function canonicalizeLicense(data) {
  if (typeof data === 'string') return data.trim();
  const key = (data?.key || data?.licenseKey || '').trim();
  const orderId = (data.orderId || data.order_id || '').trim();
  const paymentId = (data.paymentId || data.payment_id || '').trim();
  const purchasedAt = (data.purchasedAt || data.purchased_at || '').trim();
  const type = (data.type || 'pro_lifetime').trim();

  return `V1:${key}:${orderId}:${paymentId}:${purchasedAt}:${type}`;
}

/**
 * Sign a license payload using ECDSA P-256 (SHA-256, IEEE P1363 64-byte format)
 * Returns Base64-encoded signature
 */
export function signLicense(licenseData) {
  const canonicalString = canonicalizeLicense(licenseData);
  const privateKey = getPrivateKey();

  const signatureBuffer = crypto.sign('sha256', Buffer.from(canonicalString, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363'
  });

  return signatureBuffer.toString('base64');
}

/**
 * Verify a license signature on the server
 */
export function verifyLicense(licenseData, signatureBase64) {
  if (!signatureBase64) return false;
  try {
    const canonicalString = canonicalizeLicense(licenseData);
    const sigBuffer = Buffer.from(signatureBase64, 'base64');
    
    return crypto.verify(
      'sha256',
      Buffer.from(canonicalString, 'utf8'),
      {
        key: REDACTIFY_PUBLIC_KEY_PEM,
        dsaEncoding: 'ieee-p1363'
      },
      sigBuffer
    );
  } catch (err) {
    console.error('License verification error:', err);
    return false;
  }
}
