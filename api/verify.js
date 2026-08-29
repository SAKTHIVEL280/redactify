/**
 * Vercel Serverless Function: Verify Razorpay Payment
 * Endpoint: /api/verify
 * Method: POST
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */

import crypto from 'crypto';
import { createRateLimiter, getClientIp, applyRateLimit } from '../lib/rateLimit.js';
import { signLicense } from '../lib/licenseSigner.js';

const checkRateLimit = createRateLimiter(60 * 1000, 5); // 5 req/min/IP

// Generate license key using cryptographically secure random bytes
function generateLicenseKey() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random1 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const random2 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const random3 = crypto.randomBytes(4).toString('hex').toUpperCase();
  
  return `RDCT-${timestamp}-${random1}-${random2}-${random3}`;
}

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.daeq.in,http://localhost:5173,http://localhost:3000,http://localhost:4173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  const isVercelPreview = origin && /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin);
  const isAllowed = origin && (allowedOrigins.includes(origin) || isVercelPreview || process.env.NODE_ENV !== 'production');
  if (origin && !isAllowed) {
    return res.status(403).json({ error: 'Origin not allowed', success: false });
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
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
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

    // Verify signature using timing-safe comparison to prevent timing side-channel attacks
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const sigBuffer = Buffer.from(razorpay_signature, 'utf8');
    const genBuffer = Buffer.from(generatedSignature, 'utf8');

    if (sigBuffer.length !== genBuffer.length || !crypto.timingSafeEqual(sigBuffer, genBuffer)) {
      return res.status(400).json({ 
        error: 'Invalid signature',
        success: false 
      });
    }

    const supabaseUrlEnv = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    // Idempotency check: if license already exists for this payment_id, return existing license
    if (supabaseUrlEnv && supabaseKey) {
      try {
        const checkResponse = await fetch(
          `${supabaseUrlEnv}/rest/v1/pro_licenses?payment_id=eq.${encodeURIComponent(razorpay_payment_id)}&is_active=eq.true&select=license_key,payment_id,order_id,purchased_at`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        );
        if (checkResponse.ok) {
          const existing = await checkResponse.json();
          if (Array.isArray(existing) && existing.length > 0) {
            const reissuedData = {
              key: existing[0].license_key,
              paymentId: existing[0].payment_id,
              orderId: existing[0].order_id,
              purchasedAt: existing[0].purchased_at || new Date().toISOString(),
              type: 'pro_lifetime'
            };
            const signature = signLicense(reissuedData);
            return res.status(200).json({
              success: true,
              licenseKey: reissuedData.key,
              paymentId: reissuedData.paymentId,
              orderId: reissuedData.orderId,
              purchasedAt: reissuedData.purchasedAt,
              type: reissuedData.type,
              signature,
              reissued: true
            });
          }
        }
      } catch (checkError) {
        console.error('Idempotency check error:', checkError.message || checkError);
      }
    }
    
    // Payment verified successfully
    // Generate new license key
    const licenseKey = generateLicenseKey();
    const purchasedAt = new Date().toISOString();
    const licensePayload = {
      key: licenseKey,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      purchasedAt: purchasedAt,
      type: 'pro_lifetime'
    };
    const signature = signLicense(licensePayload);

    // Store in Supabase for server-side verification and recovery
    if (supabaseUrlEnv && supabaseKey) {
      try {
        const response = await fetch(`${supabaseUrlEnv}/rest/v1/pro_licenses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            license_key: licenseKey,
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id,
            purchased_at: purchasedAt,
            is_active: true,
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Supabase insert error:', response.status, errorText);

          // If duplicate key conflict (409), re-fetch existing saved key so client gets valid key
          if (response.status === 409) {
            try {
              const retryRes = await fetch(
                `${supabaseUrlEnv}/rest/v1/pro_licenses?payment_id=eq.${encodeURIComponent(razorpay_payment_id)}&select=license_key,payment_id,order_id,purchased_at`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                  }
                }
              );
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                if (Array.isArray(retryData) && retryData.length > 0) {
                  const retryPayload = {
                    key: retryData[0].license_key,
                    paymentId: retryData[0].payment_id,
                    orderId: retryData[0].order_id,
                    purchasedAt: retryData[0].purchased_at || purchasedAt,
                    type: 'pro_lifetime'
                  };
                  const retrySig = signLicense(retryPayload);
                  return res.status(200).json({
                    success: true,
                    licenseKey: retryPayload.key,
                    paymentId: retryPayload.paymentId,
                    orderId: retryPayload.orderId,
                    purchasedAt: retryPayload.purchasedAt,
                    type: retryPayload.type,
                    signature: retrySig,
                    reissued: true
                  });
                }
              }
            } catch (retryErr) {
              console.error('Retry fetch error:', retryErr);
            }
          }
        }
      } catch (dbError) {
        // Log but don't fail - client will still get signed license key
        console.error('Supabase storage error (non-critical):', dbError.message || dbError);
      }
    }

    return res.status(200).json({
      success: true,
      licenseKey: licensePayload.key,
      paymentId: licensePayload.paymentId,
      orderId: licensePayload.orderId,
      purchasedAt: licensePayload.purchasedAt,
      type: licensePayload.type,
      signature: signature
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ 
      error: 'Verification failed',
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Verification failed' : error.message
    });
  }
}

