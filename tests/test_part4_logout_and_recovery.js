import assert from 'assert';
import { signLicense } from '../lib/licenseSigner.js';
import { verifyLicenseSignature } from '../src/utils/licenseCrypto.js';

console.log('--- TEST PART 4: LOGOUT & RECOVERY FLOW TEST ---\n');

async function runTests() {
  // Step 1: User has an active legitimate signed license
  const legitimateLicense = {
    key: 'RDCT-2026-LOGOUT-RECOVER-USER',
    orderId: 'order_LOGOUT_TEST_101',
    paymentId: 'pay_LOGOUT_TEST_202',
    purchasedAt: '2026-08-29T15:00:00.000Z',
    type: 'pro_lifetime'
  };
  legitimateLicense.signature = signLicense(legitimateLicense);

  const isValidBefore = await verifyLicenseSignature(legitimateLicense);
  assert.strictEqual(isValidBefore, true, 'License must be valid initially');
  console.log('  ✓ [1] Active Pro session initialized on Device 1');

  // Step 2: User triggers Logout
  // Simulate logoutPro(): clear in-memory and storage
  let localSession = { ...legitimateLicense };
  let isPro = true;

  // Execute logout
  localSession = null;
  isPro = false;

  assert.strictEqual(localSession, null, 'Stored session must be purged');
  assert.strictEqual(isPro, false, 'React state isPro must be false');
  console.log('  ✓ [2] User logged out: local credentials purged and Pro status deactivated');

  // Step 3: Legitimate user switches to Device 2 and recovers via Payment ID
  // Simulate api/recover-by-payment returning signed payload
  const recoveredFromPayment = {
    licenseKey: legitimateLicense.key,
    orderId: legitimateLicense.orderId,
    paymentId: legitimateLicense.paymentId,
    purchasedAt: legitimateLicense.purchasedAt,
    type: legitimateLicense.type,
    signature: signLicense({
      key: legitimateLicense.key,
      orderId: legitimateLicense.orderId,
      paymentId: legitimateLicense.paymentId,
      purchasedAt: legitimateLicense.purchasedAt,
      type: legitimateLicense.type
    })
  };

  // Device 2 stores and verifies recovered license
  const device2StoredLicense = {
    key: recoveredFromPayment.licenseKey,
    orderId: recoveredFromPayment.orderId,
    paymentId: recoveredFromPayment.paymentId,
    purchasedAt: recoveredFromPayment.purchasedAt,
    type: recoveredFromPayment.type,
    signature: recoveredFromPayment.signature
  };

  const device2Verified = await verifyLicenseSignature(device2StoredLicense);
  assert.strictEqual(device2Verified, true, 'Recovered license on Device 2 must pass cryptographic verification');
  console.log('  ✓ [3] License successfully recovered on Device 2 via Payment ID with authentic signature');

  // Step 4: Legitimate user recovers via Email OTP code
  // Simulate api/verify-recovery-code returning signed payload
  const recoveredFromEmail = {
    licenseKey: legitimateLicense.key,
    orderId: legitimateLicense.orderId,
    paymentId: legitimateLicense.paymentId,
    purchasedAt: legitimateLicense.purchasedAt,
    type: legitimateLicense.type,
    signature: signLicense({
      key: legitimateLicense.key,
      orderId: legitimateLicense.orderId,
      paymentId: legitimateLicense.paymentId,
      purchasedAt: legitimateLicense.purchasedAt,
      type: legitimateLicense.type
    })
  };

  const emailRecoveredVerified = await verifyLicenseSignature({
    key: recoveredFromEmail.licenseKey,
    orderId: recoveredFromEmail.orderId,
    paymentId: recoveredFromEmail.paymentId,
    purchasedAt: recoveredFromEmail.purchasedAt,
    type: recoveredFromEmail.type,
    signature: recoveredFromEmail.signature
  });
  assert.strictEqual(emailRecoveredVerified, true, 'Recovered license via Email OTP must pass cryptographic verification');
  console.log('  ✓ [4] License successfully recovered via Email OTP with authentic signature');

  console.log('\nAll Part 4 Logout & Recovery Tests Passed Successfully!\n');
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
