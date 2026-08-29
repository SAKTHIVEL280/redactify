import crypto from 'crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const payload = JSON.stringify({
  key: 'RDCT-2026-TEST',
  orderId: 'order_123',
  paymentId: 'pay_123',
  purchasedAt: '2026-08-29T14:00:00.000Z',
  type: 'pro_lifetime'
});

// Server side signing with Node crypto
const sigP1363 = crypto.sign('sha256', Buffer.from(payload), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363'
});
const sigBase64 = sigP1363.toString('base64');
console.log('Signature base64 (IEEE P1363, length 64 bytes):', sigBase64);

// Client side verification with Web Crypto SubtleCrypto
async function testClientVerify() {
  const cleanPem = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/[\r\n\s]/g, '');
  const keyBytes = Buffer.from(cleanPem, 'base64');

  const pubKey = await crypto.subtle.importKey(
    'spki',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  const sigBytes = Buffer.from(sigBase64, 'base64');
  const verified = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    pubKey,
    sigBytes,
    new TextEncoder().encode(payload)
  );

  console.log('Client Web Crypto subtle verification:', verified);

  // Now test an altered payload (tampering test)
  const tamperedPayload = JSON.stringify({
    key: 'RDCT-FORGED',
    orderId: 'order_123',
    paymentId: 'pay_123',
    purchasedAt: '2026-08-29T14:00:00.000Z',
    type: 'pro_lifetime'
  });

  const tamperedVerified = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    pubKey,
    sigBytes,
    new TextEncoder().encode(tamperedPayload)
  );

  console.log('Client Web Crypto tampered verification (must be false):', tamperedVerified);
}

testClientVerify().catch(console.error);
