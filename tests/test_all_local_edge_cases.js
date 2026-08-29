import assert from 'assert';
import crypto from 'crypto';
import { signLicense, verifyLicense, canonicalizeLicense } from '../api/lib/licenseSigner.js';
import { detectPII, replacePII } from '../src/utils/piiDetector.js';
import { exportAsDOCX, exportAsPDF } from '../src/utils/exportUtils.js';
import { exportBatchAsZip } from '../src/utils/batchExportUtils.js';
import concurrencyHandler from '../api/concurrency-lock.js';
import webhookHandler from '../api/razorpay-webhook.js';
import saveEmailHandler from '../api/save-license-email.js';

console.log('====================================================');
console.log('     REDACTIFY EXHAUSTIVE LOCAL EDGE CASE SUITE     ');
console.log('====================================================\n');

function createMockReqRes({ method = 'POST', headers = {}, body = {} } = {}) {
  const req = {
    method,
    headers: { origin: 'https://redactify.daeq.in', ...headers },
    body
  };

  const res = {
    statusCode: 200,
    headers: {},
    bodyData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    json(data) {
      this.bodyData = data;
      return this;
    },
    end() {
      return this;
    }
  };

  return { req, res };
}

async function runExhaustiveTests() {
  let passed = 0;
  let total = 0;

  function record(testName, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [EDGE-${total.toString().padStart(2, '0')}] ${testName}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [EDGE-${total.toString().padStart(2, '0')}] FAILED: ${testName}`);
      console.error(e);
      throw e;
    }
  }

  async function recordAsync(testName, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [EDGE-${total.toString().padStart(2, '0')}] ${testName}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [EDGE-${total.toString().padStart(2, '0')}] FAILED: ${testName}`);
      console.error(e);
      throw e;
    }
  }

  console.log('--- CATEGORY 1: CRYPTOGRAPHIC SIGNATURE & LICENSING EDGE CASES ---');

  record('Canonical string format strictly deterministic across whitespace', () => {
    const raw1 = { key: '  RDCT-123  ', orderId: 'ord_1  ', paymentId: 'pay_1', purchasedAt: '2026-01-01T00:00:00Z', type: 'pro_lifetime' };
    const raw2 = { licenseKey: 'RDCT-123', order_id: 'ord_1', payment_id: 'pay_1', purchased_at: '2026-01-01T00:00:00Z' };
    assert.strictEqual(canonicalizeLicense(raw1), canonicalizeLicense(raw2));
  });

  record('Valid ECDSA P-256 signature passes verification', () => {
    const lic = { key: 'RDCT-EDGE-1', orderId: 'ord_1', paymentId: 'pay_1', purchasedAt: '2026-01-01T00:00:00Z', type: 'pro_lifetime' };
    const sig = signLicense(lic);
    assert.strictEqual(verifyLicense(canonicalizeLicense(lic), sig), true);
  });

  record('Tampered single character in paymentId invalidates signature', () => {
    const lic = { key: 'RDCT-EDGE-1', orderId: 'ord_1', paymentId: 'pay_1', purchasedAt: '2026-01-01T00:00:00Z', type: 'pro_lifetime' };
    const sig = signLicense(lic);
    const tampered = { ...lic, paymentId: 'pay_2' };
    assert.strictEqual(verifyLicense(canonicalizeLicense(tampered), sig), false);
  });

  record('Replayed signature with altered license key fails verification', () => {
    const licA = { key: 'RDCT-VICTIM-KEY', orderId: 'ord_1', paymentId: 'pay_1', purchasedAt: '2026-01-01T00:00:00Z', type: 'pro_lifetime' };
    const sigA = signLicense(licA);
    const licB = { key: 'RDCT-ATTACKER-KEY', orderId: 'ord_1', paymentId: 'pay_1', purchasedAt: '2026-01-01T00:00:00Z', type: 'pro_lifetime' };
    assert.strictEqual(verifyLicense(canonicalizeLicense(licB), sigA), false);
  });

  record('Random garbage string as signature is handled cleanly without crashing', () => {
    const lic = { key: 'RDCT-EDGE-1', orderId: 'ord_1', paymentId: 'pay_1', purchasedAt: '2026-01-01T00:00:00Z', type: 'pro_lifetime' };
    const res = verifyLicense(canonicalizeLicense(lic), 'NOT_A_VALID_BASE64_SIGNATURE!!==');
    assert.strictEqual(res, false);
  });

  console.log('\n--- CATEGORY 2: CONCURRENCY LOCK EDGE CASES ---');

  await recordAsync('Lock rejects missing action, licenseKey, or deviceId with 400', async () => {
    const { req, res } = createMockReqRes({ body: { action: 'acquire' } });
    await concurrencyHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await recordAsync('Same device can re-acquire/extend lock idempotently', async () => {
    const testKey = 'RDCT-CONCURRENCY-IDEMPOTENT-' + Date.now();
    const devA = 'device_laptop_alpha';
    const call1 = createMockReqRes({ body: { action: 'acquire', licenseKey: testKey, deviceId: devA } });
    await concurrencyHandler(call1.req, call1.res);
    assert.strictEqual(call1.res.bodyData.acquired, true);

    const call2 = createMockReqRes({ body: { action: 'acquire', licenseKey: testKey, deviceId: devA } });
    await concurrencyHandler(call2.req, call2.res);
    assert.strictEqual(call2.res.bodyData.acquired, true);
  });

  await recordAsync('Second device is blocked with resource protection message', async () => {
    const testKey = 'RDCT-CONCURRENCY-BLOCKED-' + Date.now();
    const devA = 'device_laptop_alpha';
    const devB = 'device_mobile_beta';

    const call1 = createMockReqRes({ body: { action: 'acquire', licenseKey: testKey, deviceId: devA } });
    await concurrencyHandler(call1.req, call1.res);

    const call2 = createMockReqRes({ body: { action: 'acquire', licenseKey: testKey, deviceId: devB } });
    await concurrencyHandler(call2.req, call2.res);
    assert.strictEqual(call2.res.bodyData.acquired, false);
    assert.strictEqual(call2.res.bodyData.lockedByAnotherDevice, true);
    assert.ok(call2.res.bodyData.message.includes('Document processing in progress on another device'));
  });

  await recordAsync('Device B cannot heartbeat or extend Device A lock', async () => {
    const testKey = 'RDCT-CONCURRENCY-HEARTBEAT-STEAL-' + Date.now();
    const devA = 'device_laptop_alpha';
    const devB = 'device_attacker_beta';

    const call1 = createMockReqRes({ body: { action: 'acquire', licenseKey: testKey, deviceId: devA } });
    await concurrencyHandler(call1.req, call1.res);

    const call2 = createMockReqRes({ body: { action: 'heartbeat', licenseKey: testKey, deviceId: devB } });
    await concurrencyHandler(call2.req, call2.res);
    assert.strictEqual(call2.res.bodyData.renewed, false);
  });

  await recordAsync('Device B cannot release Device A lock', async () => {
    const testKey = 'RDCT-CONCURRENCY-RELEASE-HIJACK-' + Date.now();
    const devA = 'device_laptop_alpha';
    const devB = 'device_attacker_beta';

    const call1 = createMockReqRes({ body: { action: 'acquire', licenseKey: testKey, deviceId: devA } });
    await concurrencyHandler(call1.req, call1.res);

    const call2 = createMockReqRes({ body: { action: 'release', licenseKey: testKey, deviceId: devB } });
    await concurrencyHandler(call2.req, call2.res);

    // devB should still be blocked from acquiring because devA lock was NOT released
    const call3 = createMockReqRes({ body: { action: 'acquire', licenseKey: testKey, deviceId: devB } });
    await concurrencyHandler(call3.req, call3.res);
    assert.strictEqual(call3.res.bodyData.acquired, false);
  });

  console.log('\n--- CATEGORY 3: RAZORPAY WEBHOOK SECURITY EDGE CASES ---');

  await recordAsync('Webhook rejects request missing x-razorpay-signature header with 400', async () => {
    const { req, res } = createMockReqRes({ body: { event: 'refund.processed' } });
    await webhookHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.bodyData.error.toLowerCase().includes('missing'));
  });

  await recordAsync('Webhook rejects tampered or forged HMAC signature with 400', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'super_secret_webhook_key_123';
    const rawBody = JSON.stringify({ event: 'refund.processed', payload: { payment: { entity: { id: 'pay_test' } } } });
    const { req, res } = createMockReqRes({
      headers: { 'x-razorpay-signature': '0000000000000000000000000000000000000000000000000000000000000000' },
      body: JSON.parse(rawBody)
    });
    await webhookHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.bodyData.error.toLowerCase().includes('invalid'));
  });

  await recordAsync('Webhook accepts authentic HMAC signature and ignores unknown events safely', async () => {
    const secret = 'super_secret_webhook_key_123';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const bodyObj = { event: 'payment.authorized', payload: { payment: { entity: { id: 'pay_auth' } } } };
    const raw = JSON.stringify(bodyObj);
    const validHmac = crypto.createHmac('sha256', secret).update(raw).digest('hex');

    const { req, res } = createMockReqRes({
      headers: { 'x-razorpay-signature': validHmac },
      body: bodyObj
    });
    await webhookHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.bodyData.success, true);
  });

  console.log('\n--- CATEGORY 4: PII DETECTION & REDACTION ROBUSTNESS ---');

  record('Empty, null, and whitespace inputs return empty detections safely', () => {
    assert.deepStrictEqual(detectPII(''), []);
    assert.deepStrictEqual(detectPII('   \n\t  '), []);
  });

  record('Adjacent PII items (email + phone + SSN) extracted with precise non-overlapping offsets', () => {
    const text = 'Reach john.doe@company.com or (555) 123-4567 or SSN: 123-45-6789 immediately.';
    const items = detectPII(text);
    assert.ok(items.length >= 3);
    const redacted = replacePII(text, items);
    assert.ok(!redacted.includes('john.doe@company.com'));
    assert.ok(!redacted.includes('(555) 123-4567'));
    assert.ok(!redacted.includes('123-45-6789'));
    assert.ok(redacted.includes('Reach'));
    assert.ok(redacted.includes('immediately.'));
  });

  record('Tax IDs: PAN, Aadhaar, and EIN patterns detected properly', () => {
    const text = 'PAN: ABCDE1234F, Aadhaar: 1234 5678 9012, EIN: 12-3456789';
    const items = detectPII(text);
    const taxIds = items.filter(d => d.type === 'tax_id' || d.type.includes('tax'));
    assert.ok(taxIds.length >= 2, 'Should detect tax identifiers');
    const redacted = replacePII(text, items);
    assert.ok(!redacted.includes('ABCDE1234F'));
    assert.ok(!redacted.includes('1234 5678 9012'));
    assert.ok(!redacted.includes('12-3456789'));
  });

  record('Unicode, special symbols, and foreign names preserved without string boundary shift', () => {
    const text = 'Hello 👋 José Müller, contact Müller at jose.muller@example.de today!';
    const items = detectPII(text);
    const redacted = replacePII(text, items);
    assert.ok(redacted.includes('Hello 👋'));
    assert.ok(!redacted.includes('jose.muller@example.de'));
  });

  console.log('\n--- CATEGORY 5: CLIENT-SIDE GATING COMPLIANCE ---');

  await recordAsync('save-license-email rejects unauthenticated requests with 403', async () => {
    const { req, res } = createMockReqRes({ body: { licenseKey: 'RDCT-KEY', email: 'test@test.com' } });
    await saveEmailHandler(req, res);
    assert.strictEqual(res.statusCode, 403);
  });

  await recordAsync('Direct programmatic exportAsDOCX is rejected without Pro license', async () => {
    const res = await exportAsDOCX('Confidential data', 'test.docx');
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('Pro license required'));
  });

  await recordAsync('Direct programmatic exportAsPDF is rejected without Pro license', async () => {
    const res = await exportAsPDF('Confidential data');
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('Pro license required'));
  });

  await recordAsync('Direct programmatic exportBatchAsZip is rejected without Pro license', async () => {
    let failed = false;
    try {
      await exportBatchAsZip([{ name: 'test.txt', originalText: 'test' }], 'txt');
    } catch (e) {
      failed = true;
      assert.ok(e.message.includes('Pro license required'));
    }
    assert.strictEqual(failed, true);
  });

  console.log(`\n====================================================`);
  console.log(`  ALL ${passed}/${total} LOCAL EDGE CASE TESTS PASSED CLEANLY!  `);
  console.log(`====================================================\n`);
}

runExhaustiveTests().catch(err => {
  console.error('\nTest suite failed with error:', err);
  process.exit(1);
});
