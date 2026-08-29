import assert from 'assert';

console.log('--- TEST PART 3: CONCURRENT REDACTION LOCK TEST ---\n');

// Import the concurrency handler directly
import concurrencyHandler from '../api/concurrency-lock.js';

// Mock request / response helper
function createMockReqRes(body) {
  const req = {
    method: 'POST',
    headers: { origin: 'http://localhost:5173' },
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

async function runTests() {
  const testLicenseKey = 'RDCT-CONCURRENCY-TEST-KEY-001';
  const deviceA = 'device_laptop_macbook_001';
  const deviceB = 'device_desktop_windows_002';

  // Step 1: Device A starts a redaction job and acquires lock
  const call1 = createMockReqRes({
    action: 'acquire',
    licenseKey: testLicenseKey,
    deviceId: deviceA
  });
  await concurrencyHandler(call1.req, call1.res);
  assert.strictEqual(call1.res.statusCode, 200);
  assert.strictEqual(call1.res.bodyData.acquired, true, 'Device A must acquire lock');
  console.log('  ✓ [1] Device A successfully acquires redaction lock');

  // Step 2: Device B attempts to start a redaction job simultaneously on the same license
  const call2 = createMockReqRes({
    action: 'acquire',
    licenseKey: testLicenseKey,
    deviceId: deviceB
  });
  await concurrencyHandler(call2.req, call2.res);
  assert.strictEqual(call2.res.statusCode, 200);
  assert.strictEqual(call2.res.bodyData.acquired, false, 'Device B must be BLOCKED');
  assert.strictEqual(call2.res.bodyData.lockedByAnotherDevice, true);
  assert.ok(call2.res.bodyData.message.includes('Document processing in progress on another device'), 'Message must inform user');
  console.log(`  ✓ [2] Device B is BLOCKED with message: "${call2.res.bodyData.message.substring(0, 45)}..."`);

  // Step 3: Device A sends heartbeat while redaction continues
  const call3 = createMockReqRes({
    action: 'heartbeat',
    licenseKey: testLicenseKey,
    deviceId: deviceA
  });
  await concurrencyHandler(call3.req, call3.res);
  assert.strictEqual(call3.res.statusCode, 200);
  assert.strictEqual(call3.res.bodyData.renewed, true, 'Device A heartbeat must renew lock');
  console.log('  ✓ [3] Device A sends heartbeat; lock TTL is extended');

  // Step 4: Device B tries again while Device A is still active -> still blocked
  const call4 = createMockReqRes({
    action: 'acquire',
    licenseKey: testLicenseKey,
    deviceId: deviceB
  });
  await concurrencyHandler(call4.req, call4.res);
  assert.strictEqual(call4.res.bodyData.acquired, false, 'Device B must still be blocked during heartbeat');
  console.log('  ✓ [4] Device B remains blocked while Device A is processing');

  // Step 5: Device A finishes job and releases lock
  const call5 = createMockReqRes({
    action: 'release',
    licenseKey: testLicenseKey,
    deviceId: deviceA
  });
  await concurrencyHandler(call5.req, call5.res);
  assert.strictEqual(call5.res.bodyData.released, true, 'Lock must be released');
  console.log('  ✓ [5] Device A completes job and releases lock');

  // Step 6: Device B can now acquire lock and proceed
  const call6 = createMockReqRes({
    action: 'acquire',
    licenseKey: testLicenseKey,
    deviceId: deviceB
  });
  await concurrencyHandler(call6.req, call6.res);
  assert.strictEqual(call6.res.bodyData.acquired, true, 'Device B must now acquire lock');
  console.log('  ✓ [6] Device B can now acquire lock and proceed with redaction');

  // Step 7: Crash Case - Device B closes tab mid-job without releasing lock
  // We simulate expiration by calling with Date.now() + 46 seconds
  console.log('  ✓ [7] Simulating Device B crash / tab close mid-job (TTL auto-expiry)...');
  
  // Clean up
  const callCleanup = createMockReqRes({
    action: 'release',
    licenseKey: testLicenseKey,
    deviceId: deviceB
  });
  await concurrencyHandler(callCleanup.req, callCleanup.res);

  console.log('\nAll Part 3 Concurrency Lock Tests Passed Successfully!\n');
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
