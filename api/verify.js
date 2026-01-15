/**
 * Vercel Serverless Function: Verify Razorpay Payment
 * Endpoint: /api/verify
 * Method: POST
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ 
        error: 'Invalid signature',
        success: false 
      });
    }

    // Payment verified successfully
    // Generate license key
    const licenseKey = generateLicenseKey();

    // Optional: Store in Supabase for server-side verification
    try {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY // Use service key on server
      );

      await supabase.from('pro_licenses').insert([{
        license_key: licenseKey,
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        purchased_at: new Date().toISOString(),
        is_active: true,
      }]);
    } catch (dbError) {
      // Log but don't fail - client will still get license key
      console.error('Supabase storage error:', dbError);
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
