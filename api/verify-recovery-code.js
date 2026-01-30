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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code required' });
  }

  try {
    const emailLower = email.toLowerCase().trim();
    const codeTrimmed = code.trim();
    
    // Find the most recent unverified code for this email
    const codes = await supabaseQuery(
      `verification_codes?email=eq.${encodeURIComponent(emailLower)}&verified=eq.false&order=created_at.desc&limit=1`,
      'GET'
    );

    if (!codes || codes.length === 0) {
      return res.status(400).json({ 
        error: 'No verification code found',
        message: 'Please request a new code' 
      });
    }

    const storedCode = codes[0];

    // Check if expired
    if (new Date(storedCode.expires_at) < new Date()) {
      return res.status(400).json({ 
        error: 'Verification code expired',
        message: 'Please request a new code' 
      });
    }

    // Check attempts (max 5)
    if (storedCode.attempts >= 5) {
      return res.status(400).json({ 
        error: 'Too many failed attempts',
        message: 'Please request a new code' 
      });
    }

    // Verify code
    if (storedCode.code !== codeTrimmed) {
      // Increment attempts
      await supabaseQuery(
        `verification_codes?id=eq.${storedCode.id}`,
        'PATCH',
        { attempts: storedCode.attempts + 1 }
      );
      
      return res.status(400).json({ 
        error: 'Invalid verification code',
        attemptsRemaining: 5 - (storedCode.attempts + 1)
      });
    }

    // Code is valid - mark as verified
    await supabaseQuery(
      `verification_codes?id=eq.${storedCode.id}`,
      'PATCH',
      { verified: true }
    );

    res.status(200).json({ success: true, verified: true });
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}
