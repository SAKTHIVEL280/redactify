import { signLicense } from '../api/lib/licenseSigner.js';

const legit = {
  key: 'RDCT-2026-VERIFIED-PURCHASER',
  orderId: 'order_GENUINE_123',
  paymentId: 'pay_GENUINE_123',
  purchasedAt: new Date().toISOString(),
  type: 'pro_lifetime',
  isActive: true
};

const sig = signLicense(legit);
legit.signature = sig;

console.log(JSON.stringify(legit));
