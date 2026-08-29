/**
 * Vercel Serverless Function: Check License Revocation Status
 * Endpoint: /api/check-revocation
 * Method: GET or POST
 * Query / Body: { key, paymentId }
 */

import { isRevoked } from '../lib/revocationRegistry.js';
import { createRateLimiter, applyRateLimit } from '../lib/rateLimit.js';

const checkRateLimit = createRateLimiter(60 * 1000, 30); // 30 req/min/IP

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.daeq.in,http://localhost:5173,http://localhost:3000,http://localhost:4173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const origin = req.headers.origin;
  const isVercelPreview = origin && /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin);
  const isAllowed = !origin || allowedOrigins.includes(origin) || isVercelPreview || process.env.NODE_ENV !== 'production';

  if (origin && isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (applyRateLimit(req, res, checkRateLimit, 30)) return;

  const key = req.method === 'GET' ? req.query?.key : (req.body?.key || req.query?.key);
  const paymentId = req.method === 'GET' ? req.query?.paymentId : (req.body?.paymentId || req.query?.paymentId);

  if (!key && !paymentId) {
    return res.status(400).json({ error: 'License key or paymentId required' });
  }

  try {
    const status = await isRevoked(key, paymentId);
    return res.status(200).json({
      success: true,
      revoked: status.revoked,
      reason: status.reason || null,
      revokedAt: status.revokedAt || null
    });
  } catch (error) {
    console.error('Revocation check error:', error);
    return res.status(500).json({ error: 'Failed to check revocation status' });
  }
}
