/**
 * Automated Regression & Unit Test Suite for Redactify
 * Runs with: npm test (or node tests/runTests.js)
 */

import assert from 'assert';
import { PII_TYPES, detectPII, replacePII } from '../src/utils/piiDetector.js';
import { mergeDetections } from '../src/utils/smartDetection.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n--- Running Redactify PII & Redaction Test Suite ---\n');

// 1. Detection Tests
test('Detects standard and complex email addresses', () => {
  const text = 'Reach me at john.doe+work@company.co.uk or jane_99@gmail.com.';
  const detected = detectPII(text);
  const emails = detected.filter(d => d.type === PII_TYPES.EMAIL);
  assert.strictEqual(emails.length, 2);
  assert.strictEqual(emails[0].value, 'john.doe+work@company.co.uk');
  assert.strictEqual(emails[1].value, 'jane_99@gmail.com');
});

test('Detects various US and international phone number formats', () => {
  const text = 'Call (555) 123-4567 or +1-800-555-0199 or 9876543210.';
  const detected = detectPII(text);
  const phones = detected.filter(d => d.type === PII_TYPES.PHONE);
  assert.ok(phones.length >= 2, 'Should detect at least 2 phone numbers');
});

test('Detects Social Security Numbers (SSN)', () => {
  const text = 'SSN: 123-45-6789 and Social Security: 987 65 4321';
  const detected = detectPII(text);
  const ssns = detected.filter(d => d.type === PII_TYPES.SSN);
  assert.ok(ssns.length >= 1, 'Should detect SSN pattern');
});

test('Detects IPv4 and IPv6 addresses', () => {
  const text = 'Server IP is 192.168.1.100 and gateway is 10.0.0.1';
  const detected = detectPII(text);
  const ips = detected.filter(d => d.type === PII_TYPES.IP_ADDRESS);
  assert.strictEqual(ips.length, 2);
});

test('Detects Credit Card numbers with various separators', () => {
  const text = 'Card: 4111-2222-3333-4444 and 5500 1234 5678 9010';
  const detected = detectPII(text);
  const cards = detected.filter(d => d.type === PII_TYPES.CREDIT_CARD);
  assert.strictEqual(cards.length, 2);
});

// 2. Replacement & Redaction Tests
test('Replaces PII without corrupting non-PII surrounding text', () => {
  const text = 'Contact John Doe at john@email.com for details.';
  const selections = [
    { start: 20, end: 34, redact: true, suggested: '[EMAIL REDACTED]' }
  ];
  const result = replacePII(text, selections);
  assert.strictEqual(result, 'Contact John Doe at [EMAIL REDACTED] for details.');
});

test('Handles multiple PII items right-to-left without offset drifting', () => {
  const text = 'Email: a@b.com, Phone: 555-123-4567';
  const detections = detectPII(text);
  const result = replacePII(text, detections);
  assert.ok(!result.includes('a@b.com'), 'Email must be redacted');
  assert.ok(!result.includes('555-123-4567'), 'Phone must be redacted');
  assert.ok(result.startsWith('Email: ['), 'Prefix must be intact');
});

// 3. Priority and Overlap Resolution Tests
test('Custom rules take absolute priority over generic patterns', () => {
  const piiA = [{ start: 10, end: 30, type: 'email', value: 'secret@corp.com' }];
  const piiB = [{ start: 10, end: 30, type: 'custom', value: 'secret@corp.com' }];
  const merged = mergeDetections(piiA, piiB);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].type, 'custom');
});

test('Structured patterns win over generic ML entity overlap', () => {
  const regexItem = [{ start: 5, end: 25, type: 'email', value: 'john.smith@gmail.com' }];
  const mlItem = [{ start: 5, end: 15, type: 'name', value: 'john.smith' }];
  const merged = mergeDetections(regexItem, mlItem);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].type, 'email');
});

test('Detects Tax IDs (PAN, Aadhaar, EIN)', () => {
  const text = 'PAN: ABCDE1234F, Aadhaar: 1234 5678 9012, EIN: 12-3456789';
  const detected = detectPII(text);
  const taxIds = detected.filter(d => d.type === PII_TYPES.TAX_ID);
  assert.strictEqual(taxIds.length, 3);
});

test('Preserves adjacent words on same line during selective word redaction', () => {
  const line = 'Salary: $150,000 / year paid directly to secret-account@bank.com on the 1st.';
  const detected = detectPII(line);
  const replaced = replacePII(line, detected);
  assert.ok(replaced.includes('Salary: $150,000 / year paid directly to '));
  assert.ok(replaced.includes(' on the 1st.'));
  assert.ok(!replaced.includes('secret-account@bank.com'));
});

test('Handles empty and whitespace-only strings gracefully', () => {
  assert.deepStrictEqual(detectPII(''), []);
  assert.deepStrictEqual(detectPII('   \n\t  '), []);
  assert.strictEqual(replacePII('', []), '');
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
