#!/usr/bin/env node

/**
 * Pre-Deployment Verification Script
 * Checks all critical fixes are in place before deploying
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function checkFileContains(filePath, searchString, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(searchString)) {
      console.log(`✅ ${description}`);
      checks.passed++;
      return true;
    } else {
      console.log(`❌ ${description}`);
      checks.failed++;
      return false;
    }
  } catch (error) {
    console.log(`⚠️  ${description} - File not found`);
    checks.warnings++;
    return false;
  }
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description}`);
    checks.passed++;
    return true;
  } else {
    console.log(`❌ ${description}`);
    checks.failed++;
    return false;
  }
}

console.log('\n🔍 Resume Redactor - Pre-Deployment Verification\n');
console.log('='.repeat(60));
console.log('\n📦 Dependencies Check\n');

checkFileContains(
  'package.json',
  '@xenova/transformers',
  'Transformers.js installed'
);

checkFileContains(
  'package.json',
  'onnxruntime-web',
  'ONNX Runtime installed'
);

checkFileContains(
  'package.json',
  'dompurify',
  'DOMPurify installed'
);

console.log('\n🔒 Security Fixes Check\n');

checkFileContains(
  'index.html',
  'Content-Security-Policy',
  'CSP headers added'
);

checkFileContains(
  'src/utils/piiDetector.js',
  'DOMPurify.sanitize',
  'XSS protection (DOMPurify)'
);

checkFileContains(
  'src/utils/piiDetector.js',
  'safeRegexExec',
  'ReDoS protection'
);

checkFileContains(
  'src/utils/proLicenseDB.js',
  'encryptData',
  'License encryption'
);

checkFileContains(
  'src/components/ProModal.jsx',
  'throw new Error',
  'Razorpay key validation'
);

checkFileContains(
  'src/components/Redactor.jsx',
  'AbortController',
  'Race condition fix'
);

checkFileContains(
  'src/hooks/usePIIDetection.js',
  'pendingCallbacksRef.current.clear()',
  'Memory leak fix'
);

checkFileContains(
  'src/utils/piiDetector.js',
  'MAX_FILE_SIZE',
  'File size validation'
);

checkFileContains(
  'api/send-feedback.js',
  'checkRateLimit',
  'API rate limiting'
);

console.log('\n🤖 AI Integration Check\n');

checkFileExists(
  'src/hooks/useTransformersPII.js',
  'Transformers.js hook created'
);

checkFileExists(
  'src/workers/transformersPIIWorker.js',
  'ML Worker created'
);

checkFileExists(
  'src/utils/hybridDetection.js',
  'Hybrid detection utility created'
);

checkFileContains(
  'src/components/Redactor.jsx',
  'useTransformersPII',
  'Transformers hook integrated'
);

checkFileContains(
  'src/components/Redactor.jsx',
  'detectPIIHybrid',
  'Hybrid detection used'
);

checkFileContains(
  'src/components/Redactor.jsx',
  'Sparkles',
  'AI status indicator added'
);

console.log('\n📚 Documentation Check\n');

checkFileExists(
  'COMPLETE_ISSUES_LIST.md',
  'Issues list documented'
);

checkFileExists(
  'SECURITY_AUDIT_REPORT.md',
  'Security audit documented'
);

checkFileExists(
  'IMPLEMENTATION_GUIDE.md',
  'Implementation guide created'
);

checkFileExists(
  'CHANGELOG.md',
  'Changelog created'
);

console.log('\n' + '='.repeat(60));
console.log('\n📊 Verification Results\n');
console.log(`✅ Passed: ${checks.passed}`);
console.log(`❌ Failed: ${checks.failed}`);
console.log(`⚠️  Warnings: ${checks.warnings}`);

const total = checks.passed + checks.failed + checks.warnings;
const passRate = ((checks.passed / total) * 100).toFixed(1);

console.log(`\n📈 Pass Rate: ${passRate}%\n`);

if (checks.failed === 0) {
  console.log('🎉 All critical checks passed! Ready for deployment.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Please review before deploying.\n');
  process.exit(1);
}
