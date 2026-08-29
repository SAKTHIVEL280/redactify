import assert from 'assert';
import { signLicense, canonicalizeLicense, REDACTIFY_PUBLIC_KEY_PEM } from '../lib/licenseSigner.js';
import { verifyLicenseSignature } from '../src/utils/licenseCrypto.js';

console.log('--- TEST PART 1: ASYMMETRIC LICENSE VERIFICATION PROOF ---\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test Case 1: Legitimate License signed by Server Private Key
  try {
    const legitimateLicense = {
      key: 'RDCT-2026-LEGITIMATE-USER',
      orderId: 'order_VALID_12345',
      paymentId: 'pay_VALID_12345',
      purchasedAt: '2026-08-29T14:00:00.000Z',
      type: 'pro_lifetime'
    };

    // Server generates authentic signature
    const signature = signLicense(legitimateLicense);
    assert.ok(signature, 'Signature must be generated');
    assert.strictEqual(typeof signature, 'string');
    assert.ok(signature.length > 50, 'Signature must be valid length');

    // Client verifies using public key
    legitimateLicense.signature = signature;
    const clientVerification = await verifyLicenseSignature(legitimateLicense);
    assert.strictEqual(clientVerification, true, 'Legitimate license must pass client verification');
    console.log('  ✓ [1] Legitimate Server-Signed License PASSES verification');
    passed++;
  } catch (e) {
    console.error('  ✗ [1] Failed:', e);
    failed++;
  }

  // Test Case 2: Prior Exploit - Forged License with No Signature
  try {
    const forgedNoSignature = {
      key: 'FORGED-PIRATE-LICENSE',
      orderId: 'order_FAKE_BYPASS',
      paymentId: 'pay_FAKE_BYPASS',
      purchasedAt: '2026-08-29T14:00:00.000Z',
      type: 'pro_lifetime',
      isActive: true
    };

    const clientVerification = await verifyLicenseSignature(forgedNoSignature);
    assert.strictEqual(clientVerification, false, 'Forged license without signature must FAIL verification');
    console.log('  ✓ [2] Prior Exploit (No Signature) FAILS verification as expected');
    passed++;
  } catch (e) {
    console.error('  ✗ [2] Failed:', e);
    failed++;
  }

  // Test Case 3: Forged License with Garbage / Random Signature
  try {
    const forgedBadSignature = {
      key: 'FORGED-PIRATE-LICENSE',
      orderId: 'order_FAKE_BYPASS',
      paymentId: 'pay_FAKE_BYPASS',
      purchasedAt: '2026-08-29T14:00:00.000Z',
      type: 'pro_lifetime',
      signature: Buffer.from(new Uint8Array(64).fill(42)).toString('base64'),
      isActive: true
    };

    const clientVerification = await verifyLicenseSignature(forgedBadSignature);
    assert.strictEqual(clientVerification, false, 'Forged license with fake signature must FAIL verification');
    console.log('  ✓ [3] Forged License with Fabricated Signature FAILS verification');
    passed++;
  } catch (e) {
    console.error('  ✗ [3] Failed:', e);
    failed++;
  }

  // Test Case 4: Tampered Legitimate License (e.g. Attacker steals a valid signature but changes orderId/key)
  try {
    const legitPayload = {
      key: 'RDCT-2026-LEGITIMATE-USER',
      orderId: 'order_VALID_12345',
      paymentId: 'pay_VALID_12345',
      purchasedAt: '2026-08-29T14:00:00.000Z',
      type: 'pro_lifetime'
    };
    const legitSig = signLicense(legitPayload);

    // Attacker modifies the license key
    const tamperedPayload = {
      ...legitPayload,
      key: 'RDCT-ATTACKER-COPIED-SIGNATURE',
      signature: legitSig
    };

    const clientVerification = await verifyLicenseSignature(tamperedPayload);
    assert.strictEqual(clientVerification, false, 'Tampered payload with mismatched signature must FAIL verification');
    console.log('  ✓ [4] Tampered License with Replayed Signature FAILS verification');
    passed++;
  } catch (e) {
    console.error('  ✗ [4] Failed:', e);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
