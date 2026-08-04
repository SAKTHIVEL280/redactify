/**
 * Vercel Serverless Function: Create Razorpay Order
 * Endpoint: /api/create-order
 * Method: POST
 * Body: { amount: number, currency: string }
 */

import Razorpay from 'razorpay';
import { createRateLimiter, getClientIp, applyRateLimit } from './lib/rateLimit.js';

const checkRateLimit = createRateLimiter(60 * 1000, 5); // 5 req/min/IP

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.app,https://redactify.daeq.in,http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  const isVercelPreview = origin && /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin);
  const isAllowed = origin && (allowedOrigins.includes(origin) || isVercelPreview || process.env.NODE_ENV !== 'production');
  if (origin && !isAllowed) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (origin && isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  if (applyRateLimit(req, res, checkRateLimit, 5)) return;

  try {
    const { amount, currency = 'INR' } = req.body;

    // Validate input
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Server-side price validation — only accept the correct Pro license price
    const VALID_AMOUNTS = [159900]; // ₹1,599.00 in paise — add more if you introduce tiers
    if (!VALID_AMOUNTS.includes(amount)) {
      return res.status(400).json({ error: 'Invalid amount for this product' });
    }

    // Initialize Razorpay with server-side keys
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Create order
    const options = {
      amount: amount, // amount in paise
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        product: 'Resume Redactor Pro License',
        type: 'lifetime',
      },
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    return res.status(500).json({ 
      error: 'Failed to create order',
      message: error.message 
    });
  }
}
