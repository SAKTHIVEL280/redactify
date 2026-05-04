import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

// Supabase REST API helper
async function supabaseQuery(endpoint, method = 'GET', body = null) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/rest/v1/${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation'
    }
  };
  
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) throw new Error(data.message || 'Supabase error');
  return data;
}

export default async function handler(req, res) {
  // CORS headers
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

  // Only allow POST
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

  const { email } = req.body;

  if (!process.env.SUPABASE_SERVICE_KEY || !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) {
    return res.status(500).json({ error: 'Recovery backend not configured' });
  }

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    const emailLower = email.toLowerCase().trim();
    
    // Check if email has any Pro licenses
    const licenses = await supabaseQuery(
      `pro_licenses?email=eq.${encodeURIComponent(emailLower)}&is_active=eq.true&select=license_key`,
      'GET'
    );
    
    if (!licenses || licenses.length === 0) {
      return res.status(404).json({ 
        error: 'No Pro subscription found',
        message: 'This email has no active Pro subscription' 
      });
    }
    
    // Check rate limiting - max 3 codes per email per 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recentCodes = await supabaseQuery(
      `verification_codes?email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${fifteenMinutesAgo}&select=id`,
      'GET'
    );
    
    if (recentCodes && recentCodes.length >= 3) {
      return res.status(429).json({ 
        error: 'Too many requests',
        message: 'Please wait 15 minutes before requesting a new code' 
      });
    }

    // Generate 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code in Supabase
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    await supabaseQuery('verification_codes', 'POST', {
      email: emailLower,
      code: verificationCode,
      expires_at: expiresAt,
      verified: false,
      attempts: 0
    });

    // Send email via Resend
    await resend.emails.send({
      from: 'Redactify <onboarding@resend.dev>',
      to: [email],
      subject: 'Your Redactify License Recovery Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ef4444;">Redactify License Recovery</h2>
          <p>Your verification code is:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${verificationCode}
          </div>
          <p style="color: #666;">This code expires in 10 minutes.</p>
          <p style="color: #666;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">Redactify - Privacy-First Document Redaction</p>
        </div>
      `,
    });

    res.status(200).json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Error sending verification code:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
}
