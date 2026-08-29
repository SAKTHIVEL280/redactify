/**
 * Client-Side Asymmetric License Verifier for Redactify
 * Algorithm: ECDSA with NIST P-256 (secp256r1) and SHA-256 (IEEE P1363 standard 64-byte signature)
 * Uses native Web Crypto SubtleCrypto API with zero third-party dependencies.
 */

// Production Public Key in SPKI Base64 format (corresponds to server-side private key)
export const REDACTIFY_PUBLIC_KEY_B64 = 
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9NtZyen3oWG75MWBglOEi9LehGxyopQSC0L/kjQAITRQchd04fV+CaiQbkAzJOTnuLjXnL0zKweJpy4AVOl4mA==';

let cachedCryptoKey = null;

/**
 * Deterministically reconstruct the canonical string representation for signing
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
 * Import the static public key into Web Crypto SubtleCrypto
 */
async function getPublicKey() {
  if (cachedCryptoKey) return cachedCryptoKey;

  const binaryDer = Uint8Array.from(atob(REDACTIFY_PUBLIC_KEY_B64), c => c.charCodeAt(0));
  cachedCryptoKey = await crypto.subtle.importKey(
    'spki',
    binaryDer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  return cachedCryptoKey;
}

/**
 * Mathematically verify the digital signature on a license data object.
 * Returns true if and only if the license was authentically signed by the server private key.
 */
export async function verifyLicenseSignature(licenseData) {
  if (!licenseData || typeof licenseData !== 'object') {
    return false;
  }

  const signature = licenseData.signature;
  if (!signature || typeof signature !== 'string') {
    // Missing digital signature — forged or legacy unverified payload
    return false;
  }

  try {
    const pubKey = await getPublicKey();
    const canonicalString = canonicalizeLicense(licenseData);
    const dataBytes = new TextEncoder().encode(canonicalString);

    // Decode Base64 IEEE P1363 signature (64 bytes for P-256)
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    if (sigBytes.length !== 64) {
      return false;
    }

    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      pubKey,
      sigBytes,
      dataBytes
    );

    return isValid;
  } catch (err) {
    console.warn('Asymmetric license signature verification failed:', err.message || err);
    return false;
  }
}
