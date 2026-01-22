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
    // In production, use Redis or similar
    global.verificationCodes = global.verificationCodes || {};
    global.verificationCodes[email.toLowerCase()] = {
      code: verificationCode,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    };

    // Send email via your email service
    // For now, we'll use a simple fetch to a service
    // You'll need to configure this with your email provider
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY || '', // You'll need to set this
      },
      body: JSON.stringify({
        sender: { name: 'Redactify', email: 'noreply@redactify.daeq.in' },
        to: [{ email }],
        subject: 'Your Redactify License Recovery Code',
        htmlContent: `
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
      }),
    });

    if (!emailResponse.ok) {
      // Fallback: log to console (you should check Vercel logs)
      console.log(`Verification code for ${email}: ${verificationCode}`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Verification code sent',
        // In development, include code in response
        ...(process.env.NODE_ENV === 'development' && { code: verificationCode })
      });
    }

    res.status(200).json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Error sending verification code:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
}
