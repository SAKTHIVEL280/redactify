// Vercel Serverless Function: Link email to an existing verified license

import { createRateLimiter, getClientIp, applyRateLimit } from '../lib/rateLimit.js';

const checkRateLimit = createRateLimiter(60 * 1000, 5); // 5 req/min/IP
async function supabasePatch(endpoint, body) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase server configuration missing');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Supabase update failed');
  }

  return data;
}

function isValidEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

export default async function handler(req, res) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.daeq.in,http://localhost:5173,http://localhost:3000,http://localhost:4173')
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

  const { licenseKey, paymentId, signature, email } = req.body || {};

  if (!licenseKey || typeof licenseKey !== 'string') {
    return res.status(400).json({ error: 'Valid licenseKey is required' });
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  // Early authentication check: caller must present either paymentId or digital signature
  if (!paymentId && !signature) {
    return res.status(403).json({ 
      error: 'Ownership verification failed: valid paymentId or signature required',
      success: false 
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Database backend not configured' });
  }

  try {
    // 1. Fetch license to verify ownership and check existing email
    const fetchRes = await fetch(
      `${supabaseUrl}/rest/v1/pro_licenses?license_key=eq.${encodeURIComponent(licenseKey)}&is_active=eq.true&select=license_key,payment_id,email`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      }
    );

    if (!fetchRes.ok) {
      return res.status(500).json({ error: 'Database query failed' });
    }

    const records = await fetchRes.json();
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(404).json({ error: 'License not found' });
    }

    const license = records[0];

    // 2. Ownership verification: require matching paymentId or signature
    const hasValidPaymentId = paymentId && license.payment_id && paymentId.trim() === license.payment_id.trim();
    if (!hasValidPaymentId && !signature) {
      return res.status(403).json({ error: 'Ownership verification failed: valid paymentId or signature required' });
    }

    // 3. Hijack prevention: do not overwrite if email is already set to another address
    if (license.email && license.email.toLowerCase() !== normalizedEmail) {
      return res.status(409).json({ 
        error: 'An email is already linked to this license',
        message: 'For security reasons, recovery email cannot be overwritten without re-verification.'
      });
    }

    // 4. Update email
    const updated = await supabasePatch(
      `pro_licenses?license_key=eq.${encodeURIComponent(licenseKey)}&is_active=eq.true`,
      { email: normalizedEmail }
    );

    if (!Array.isArray(updated) || updated.length === 0) {
      return res.status(404).json({ error: 'Failed to update license' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Save license email error:', error);
    return res.status(500).json({ error: 'Failed to save license email' });
  }
}
