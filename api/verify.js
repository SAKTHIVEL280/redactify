/**
 * Vercel Serverless Function: Verify Razorpay Payment
 * Endpoint: /api/verify
 * Method: POST
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */

import crypto from 'crypto';

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
    console.log('Verify API called with body:', req.body);
    
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

    console.log('Generated signature:', generatedSignature);
    console.log('Received signature:', razorpay_signature);

    if (generatedSignature !== razorpay_signature) {
      console.log('Signature mismatch');
      return res.status(400).json({ 
        error: 'Invalid signature',
        success: false 
      });
    }

    console.log('Signature verified successfully');

    console.log('Signature verified successfully');
    
    // Payment verified successfully
    // Generate license key
    const licenseKey = generateLicenseKey();
    console.log('Generated license key:', licenseKey);

    // Optional: Store in Supabase for server-side verification
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      try {
        console.log('Attempting to store in Supabase...');
        
        // Dynamic import for Supabase to avoid ES module issues
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );

        const { data, error } = await supabase.from('pro_licenses').insert([{
          license_key: licenseKey,
          payment_id: razorpay_payment_id,
          order_id: razorpay_order_id,
          purchased_at: new Date().toISOString(),
          is_active: true,
        }]);

        if (error) {
          console.error('Supabase insert error:', error);
        } else {
          console.log('Supabase insert successful:', data);
        }
      } catch (dbError) {
        // Log but don't fail - client will still get license key
        console.error('Supabase storage error:', dbError);
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
