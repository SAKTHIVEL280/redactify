// Vercel Serverless Function: Link email to an existing verified license

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

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 'unknown';
}

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
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.app,https://redactify.daeq.in')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (origin && allowedOrigins.includes(origin)) {
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

  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

  if (!rateLimit.allowed) {
    const resetIn = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
    res.setHeader('X-RateLimit-Reset', rateLimit.resetTime);
    res.setHeader('Retry-After', resetIn);
    return res.status(429).json({
      error: 'Too many requests',
      message: `Please try again in ${resetIn} seconds`,
      retryAfter: resetIn
    });
  }

  const { licenseKey, email } = req.body || {};

  if (!licenseKey || typeof licenseKey !== 'string') {
    return res.status(400).json({ error: 'Valid licenseKey is required' });
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const updated = await supabasePatch(
      `pro_licenses?license_key=eq.${encodeURIComponent(licenseKey)}&is_active=eq.true`,
      { email: normalizedEmail }
    );

    if (!Array.isArray(updated) || updated.length === 0) {
      return res.status(404).json({ error: 'License not found' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Save license email error:', error);
    return res.status(500).json({ error: 'Failed to save license email' });
  }
}
