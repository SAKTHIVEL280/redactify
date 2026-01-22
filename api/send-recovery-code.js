import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    // Generate 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code in memory (expires in 10 minutes)
    global.verificationCodes = global.verificationCodes || {};
    global.verificationCodes[email.toLowerCase()] = {
      code: verificationCode,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    };

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
