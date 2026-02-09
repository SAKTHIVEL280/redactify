/**
 * Vercel Serverless Function: Verify Razorpay Payment
 * Endpoint: /api/verify
 * Method: POST
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */

import crypto from 'crypto';

// Simple rate limiting (in-memory)
const rateLimitStore = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // 10 verification attempts per minute per IP

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

// Generate license key
function generateLicenseKey() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random1 = Math.random().toString(36).substring(2, 8).toUpperCase();
  const random2 = Math.random().toString(36).substring(2, 8).toUpperCase();
  const random3 = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  return `RDCT-${timestamp}-${random1}-${random2}-${random3}`;
}

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.app').split(',');
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
  }
  res.setHeader('Access-Control-Allow-Credentials', true);
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
      error: 'Too many verification attempts', 
      message: `Please try again in ${resetIn} seconds`,
      success: false 
    });
  }

  try {
    console.log('Verify API called');
    
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.log('Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        success: false 
      });
    }

    // Check if secret exists
    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error('RAZORPAY_KEY_SECRET not configured');
      return res.status(500).json({ 
        error: 'Payment gateway not configured',
        success: false 
      });
    }

    // Verify signature
    console.log('Verifying signature...');
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.log('Signature mismatch');
      return res.status(400).json({ 
        error: 'Invalid signature',
        success: false 
      });
    }

    console.log('Signature verified successfully');
    
    // Payment verified successfully
    // Generate license key
    const licenseKey = generateLicenseKey();
    console.log('License key generated successfully');

    // Optional: Store in Supabase for server-side verification
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      try {
        console.log('Attempting to store in Supabase...');
        
        // Use Supabase REST API directly to avoid ES module issues
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        
        const response = await fetch(`${supabaseUrl}/rest/v1/pro_licenses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            license_key: licenseKey,
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id,
            purchased_at: new Date().toISOString(),
            is_active: true,
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Supabase insert error:', response.status, errorText);
        } else {
          console.log('Supabase insert successful');
        }
      } catch (dbError) {
        // Log but don't fail - client will still get license key
        console.error('Supabase storage error (non-critical):', dbError.message || dbError);
      }
    } else {
      console.log('Supabase not configured, skipping storage');
    }

    return res.status(200).json({
      success: true,
      licenseKey: licenseKey,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ 
      error: 'Verification failed',
      success: false,
      message: error.message 
    });
  }
}
