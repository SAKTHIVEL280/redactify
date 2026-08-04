// Vercel Serverless Function: Recover license using payment ID

import { createRateLimiter, getClientIp, applyRateLimit } from './lib/rateLimit.js';

const checkRateLimit = createRateLimiter(60 * 1000, 5); // 5 req/min/IP

async function supabaseQuery(endpoint) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase server configuration missing');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Supabase query failed');
  }

  return data;
}

export default async function handler(req, res) {
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

  if (applyRateLimit(req, res, checkRateLimit, 5)) return;

  const { paymentId } = req.body || {};

  if (!paymentId || typeof paymentId !== 'string') {
    return res.status(400).json({ error: 'Valid paymentId is required' });
  }

  const normalizedPaymentId = paymentId.trim();

  try {
    const data = await supabaseQuery(
      `pro_licenses?payment_id=eq.${encodeURIComponent(normalizedPaymentId)}&is_active=eq.true&select=license_key,payment_id,order_id,purchased_at&order=created_at.desc&limit=1`
    );

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: 'No active license found for this payment ID' });
    }

    const license = data[0];
    return res.status(200).json({
      success: true,
      licenseKey: license.license_key,
      paymentId: license.payment_id,
      orderId: license.order_id,
      purchasedAt: license.purchased_at
    });
  } catch (error) {
    console.error('Recover by payment error:', error);
    return res.status(500).json({ error: 'License recovery failed' });
  }
}
