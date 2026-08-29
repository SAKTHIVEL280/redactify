/**
 * Consolidated Vercel Serverless Function: License Recovery
 * Endpoint: /api/recovery (handles by-payment, send-code, verify-code)
 * 
 * Supports both rewritten paths (/api/recover-by-payment, /api/send-recovery-code, /api/verify-recovery-code)
 * and direct calls with action or payload inference.
 */

import { Resend } from 'resend';
import { createRateLimiter, applyRateLimit } from '../lib/rateLimit.js';
import { signLicense } from '../lib/licenseSigner.js';

const checkRateLimit = createRateLimiter(60 * 1000, 10); // 10 req/min/IP

async function supabaseQuery(endpoint, method = 'GET', body = null) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase server configuration missing');
  }

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation'
    }
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Supabase query failed');
  }

  return data;
}

export default async function handler(req, res) {
  // CORS configuration
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (applyRateLimit(req, res, checkRateLimit, 10)) return;

  const url = req.url || '';
  const body = req.body || {};
  const queryAction = req.query?.action;
  const bodyAction = body.action;

  // Determine recovery action
  let action = queryAction || bodyAction;
  if (!action) {
    if (url.includes('recover-by-payment') || body.paymentId) {
      action = 'by-payment';
    } else if (url.includes('verify-recovery-code') || (body.code && body.email)) {
      action = 'verify-code';
    } else if (url.includes('send-recovery-code') || (body.email && !body.code)) {
      action = 'send-code';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ACTION 1: RECOVER BY PAYMENT ID
  // ─────────────────────────────────────────────────────────────
  if (action === 'by-payment') {
    const { paymentId } = body;
    if (!paymentId || typeof paymentId !== 'string') {
      return res.status(400).json({ error: 'Valid paymentId is required' });
    }

    try {
      const normalizedPaymentId = paymentId.trim();
      const data = await supabaseQuery(
        `pro_licenses?payment_id=eq.${encodeURIComponent(normalizedPaymentId)}&is_active=eq.true&select=license_key,payment_id,order_id,purchased_at&order=created_at.desc&limit=1`
      );

      if (!Array.isArray(data) || data.length === 0) {
        return res.status(404).json({ error: 'No active license found for this payment ID' });
      }

      const license = data[0];
      const payload = {
        key: license.license_key,
        paymentId: license.payment_id,
        orderId: license.order_id,
        purchasedAt: license.purchased_at || new Date().toISOString(),
        type: 'pro_lifetime'
      };
      const signature = signLicense(payload);

      return res.status(200).json({
        success: true,
        licenseKey: payload.key,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        purchasedAt: payload.purchasedAt,
        type: payload.type,
        signature
      });
    } catch (error) {
      console.error('Recover by payment error:', error);
      return res.status(500).json({ error: 'License recovery failed' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ACTION 2: SEND RECOVERY OTP CODE
  // ─────────────────────────────────────────────────────────────
  if (action === 'send-code') {
    const { email } = body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'Email service not configured' });
    }

    try {
      const emailLower = email.toLowerCase().trim();
      const licenses = await supabaseQuery(
        `pro_licenses?email=eq.${encodeURIComponent(emailLower)}&is_active=eq.true&select=license_key`,
        'GET'
      );

      if (!licenses || licenses.length === 0) {
        return res.status(404).json({ 
          error: 'No active Pro license found for this email address',
          message: 'If you purchased with a different email, please use that email or recover using your Payment ID.'
        });
      }

      // Check recent verification codes for rate limiting
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const recentCodes = await supabaseQuery(
        `verification_codes?email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${fifteenMinutesAgo}`,
        'GET'
      );

      if (recentCodes && recentCodes.length >= 3) {
        return res.status(429).json({ 
          error: 'Too many recovery attempts',
          message: 'Please wait 15 minutes before requesting another code.'
        });
      }

      // Generate secure 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await supabaseQuery('verification_codes', 'POST', {
        email: emailLower,
        code,
        expires_at: expiresAt,
        verified: false,
        attempts: 0
      });

      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromAddress = 'onboarding@resend.dev';

      await resend.emails.send({
        from: `Redactify <${fromAddress}>`,
        to: [emailLower],
        subject: 'Your Redactify License Recovery Code',
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #e11d48; margin-bottom: 20px;">Redactify Pro Recovery</h2>
              <p>Hello,</p>
              <p>You requested to recover your Redactify Pro license. Use the code below to complete the recovery process:</p>
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #111827; font-family: monospace;">${code}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px;">This code will expire in 15 minutes.</p>
            </body>
          </html>
        `
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Verification code sent to your email' 
      });
    } catch (error) {
      console.error('Send recovery code error:', error);
      return res.status(500).json({ error: 'Failed to send recovery code', details: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ACTION 3: VERIFY RECOVERY CODE
  // ─────────────────────────────────────────────────────────────
  if (action === 'verify-code') {
    const { email, code } = body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    try {
      const emailLower = email.toLowerCase().trim();
      const codeTrimmed = code.trim();

      const codes = await supabaseQuery(
        `verification_codes?email=eq.${encodeURIComponent(emailLower)}&verified=eq.false&order=created_at.desc&limit=1`,
        'GET'
      );

      if (!codes || codes.length === 0) {
        return res.status(400).json({ 
          error: 'No verification code found',
          message: 'Please request a new recovery code.'
        });
      }

      const verificationRecord = codes[0];

      if (new Date(verificationRecord.expires_at) < new Date()) {
        return res.status(400).json({ 
          error: 'Verification code expired',
          message: 'This code has expired. Please request a new one.'
        });
      }

      if (verificationRecord.attempts >= 3) {
        return res.status(400).json({ 
          error: 'Too many failed attempts',
          message: 'This code has been invalidated. Please request a new one.'
        });
      }

      if (verificationRecord.code !== codeTrimmed) {
        await supabaseQuery(
          `verification_codes?id=eq.${verificationRecord.id}`,
          'PATCH',
          { attempts: verificationRecord.attempts + 1 }
        );
        return res.status(400).json({ 
          error: 'Invalid verification code',
          message: `Incorrect code. ${2 - verificationRecord.attempts} attempts remaining.`
        });
      }

      await supabaseQuery(
        `verification_codes?id=eq.${verificationRecord.id}`,
        'PATCH',
        { verified: true }
      );

      const licenses = await supabaseQuery(
        `pro_licenses?email=eq.${encodeURIComponent(emailLower)}&is_active=eq.true&select=license_key,order_id,payment_id,purchased_at`,
        'GET'
      );

      if (!licenses || licenses.length === 0) {
        return res.status(404).json({ error: 'No active licenses found for this email' });
      }

      const verifiedLicenses = licenses.map(lic => {
        const payload = {
          key: lic.license_key,
          orderId: lic.order_id,
          paymentId: lic.payment_id,
          purchasedAt: lic.purchased_at || new Date().toISOString(),
          type: 'pro_lifetime'
        };
        const signature = signLicense(payload);
        return {
          licenseKey: lic.license_key,
          orderId: lic.order_id,
          paymentId: lic.payment_id,
          purchasedAt: payload.purchasedAt,
          type: payload.type,
          signature
        };
      });

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        licenses: verifiedLicenses
      });
    } catch (error) {
      console.error('Verify recovery code error:', error);
      return res.status(500).json({ error: 'Failed to verify code', details: error.message });
    }
  }

  return res.status(400).json({ error: 'Unknown or missing recovery action' });
}
