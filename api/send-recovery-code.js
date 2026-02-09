import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Supabase REST API helper
async function supabaseQuery(endpoint, method = 'GET', body = null) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/${endpoint}`;
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
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://redactify.app').split(',');
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

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
