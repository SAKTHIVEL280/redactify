/**
 * Vercel Serverless Function: Create Razorpay Order
 * Endpoint: /api/create-order
 * Method: POST
 * Body: { amount: number, currency: string }
 */

import Razorpay from 'razorpay';

// Simple rate limiting (in-memory)
const rateLimitStore = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5; // 5 requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  
  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (now > rateLimitStore[ip].resetTime) {
    rateLimitStore[ip] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (rateLimitStore[ip].count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: rateLimitStore[ip].resetTime };
  }

  rateLimitStore[ip].count++;
  return { allowed: true, remaining: MAX_REQUESTS - rateLimitStore[ip].count };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const rateLimit = checkRateLimit(ip);
  
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

  if (!rateLimit.allowed) {
    const resetIn = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
    res.setHeader('X-RateLimit-Reset', rateLimit.resetTime);
    return res.status(429).json({ 
      error: 'Too many requests', 
      message: `Please try again in ${resetIn} seconds`,
      retryAfter: resetIn 
    });
  }

  try {
    const { amount, currency = 'INR' } = req.body;

    // Validate input
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (amount < 100) {
      return res.status(400).json({ error: 'Minimum amount is ₹1 (100 paise)' });
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
