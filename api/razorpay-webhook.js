/**
 * Vercel Serverless Function: Razorpay Webhook Listener
 * Endpoint: /api/razorpay-webhook
 * Method: POST
 * Headers: x-razorpay-signature
 * Handles refund, dispute, and cancellation events to revoke licenses.
 */

import crypto from 'crypto';
import { recordRevocation } from './lib/revocationRegistry.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_for_dev';
  const receivedSignature = req.headers['x-razorpay-signature'];

  if (!receivedSignature) {
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
  }

  try {
    // Read raw body for HMAC verification
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(receivedSignature, 'utf8');
    const genBuffer = Buffer.from(generatedSignature, 'utf8');

    if (sigBuffer.length !== genBuffer.length || !crypto.timingSafeEqual(sigBuffer, genBuffer)) {
      console.warn('Invalid Razorpay webhook signature attempt');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventType = payload.event;
    console.log(`Received verified Razorpay webhook event: ${eventType}`);

    // Events that trigger license revocation
    const REVOCATION_EVENTS = [
      'refund.processed',
      'refund.created',
      'refund.speed_changed',
      'payment.dispute.created',
      'payment.dispute.lost'
    ];

    if (REVOCATION_EVENTS.includes(eventType)) {
      // Extract payment ID and details from payload
      const paymentEntity = payload.payload?.payment?.entity;
      const refundEntity = payload.payload?.refund?.entity;

      const paymentId = paymentEntity?.id || refundEntity?.payment_id;
      const orderId = paymentEntity?.order_id || refundEntity?.notes?.order_id;
      const licenseKey = paymentEntity?.notes?.license_key || refundEntity?.notes?.license_key;

      if (paymentId || licenseKey) {
        await recordRevocation({
          paymentId,
          licenseKey,
          reason: eventType,
          revokedAt: new Date().toISOString()
        });

        console.log(`[REVOKED] License for payment ${paymentId} / key ${licenseKey} revoked due to ${eventType}`);
        return res.status(200).json({
          success: true,
          revoked: true,
          event: eventType,
          paymentId,
          licenseKey
        });
      }
    }

    return res.status(200).json({
      success: true,
      revoked: false,
      message: `Event ${eventType} received and acknowledged`
    });
  } catch (error) {
    console.error('Razorpay webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed', details: error.message });
  }
}
