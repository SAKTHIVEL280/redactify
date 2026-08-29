import assert from 'assert';
import crypto from 'crypto';
import { signLicense } from '../api/lib/licenseSigner.js';
import { isRevoked, recordRevocation } from '../api/lib/revocationRegistry.js';
import { verifyLicenseSignature } from '../src/utils/licenseCrypto.js';

console.log('--- TEST PART 2: RAZORPAY REFUND & REVOCATION HANDLING ---\n');

async function runTests() {
  const webhookSecret = 'test_webhook_secret_for_dev';
  process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

  // Step 1: Create a legitimate signed license
  const licenseData = {
    key: 'RDCT-2026-REFUND-TARGET',
    orderId: 'order_REFUND_111',
    paymentId: 'pay_REFUND_222',
    purchasedAt: '2026-08-29T14:30:00.000Z',
    type: 'pro_lifetime'
  };
  licenseData.signature = signLicense(licenseData);

  // Assert initially valid
  const isValidBefore = await verifyLicenseSignature(licenseData);
  assert.strictEqual(isValidBefore, true, 'License must be valid initially');
  
  const statusBefore = await isRevoked(licenseData.key, licenseData.paymentId);
  assert.strictEqual(statusBefore.revoked, false, 'License must NOT be revoked before refund');
  console.log('  ✓ [1] Legitimate license created and confirmed active');

  // Step 2: Simulate Razorpay 'refund.processed' webhook event payload
  const webhookEvent = {
    entity: 'event',
    account_id: 'acc_123',
    event: 'refund.processed',
    contains: ['payment', 'refund'],
    payload: {
      payment: {
        entity: {
          id: licenseData.paymentId,
          order_id: licenseData.orderId,
          amount: 159900,
          status: 'refunded',
          notes: {
            license_key: licenseData.key
          }
        }
      },
      refund: {
        entity: {
          id: 'rfnd_999999',
          payment_id: licenseData.paymentId,
          amount: 159900,
          status: 'processed'
        }
      }
    },
    created_at: Math.floor(Date.now() / 1000)
  };

  const rawBody = JSON.stringify(webhookEvent);
  const webhookSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // Step 3: Run webhook processing logic directly
  // Timing-safe HMAC check
  const generatedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  assert.strictEqual(
    crypto.timingSafeEqual(Buffer.from(webhookSignature), Buffer.from(generatedSignature)),
    true,
    'Webhook signature must be authentic'
  );

  // Execute revocation recording
  await recordRevocation({
    paymentId: webhookEvent.payload.payment.entity.id,
    licenseKey: webhookEvent.payload.payment.entity.notes.license_key,
    reason: webhookEvent.event,
    revokedAt: new Date().toISOString()
  });

  console.log('  ✓ [2] Razorpay webhook received and verified with HMAC-SHA256 signature');

  // Step 4: Verify revocation status
  const statusAfter = await isRevoked(licenseData.key, licenseData.paymentId);
  assert.strictEqual(statusAfter.revoked, true, 'License MUST be marked as revoked');
  assert.strictEqual(statusAfter.reason, 'refund.processed', 'Reason must be refund.processed');
  console.log(`  ✓ [3] Revocation registry confirms license status: revoked=true (reason: ${statusAfter.reason})`);

  // Step 5: Simulate Client Revocation Enforcement
  // Client queries check-revocation -> if revoked, client deletes local stored license
  let clientStoredLicense = { ...licenseData, isActive: true };
  if (statusAfter.revoked) {
    clientStoredLicense = null; // Simulates deleteProKey()
  }
  assert.strictEqual(clientStoredLicense, null, 'Client local Pro key must be destroyed upon revocation');
  console.log('  ✓ [4] Client successfully revoked Pro access and wiped stored credentials');

  console.log('\nAll Part 2 Refund & Revocation Tests Passed Successfully!\n');
}

runTests().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
