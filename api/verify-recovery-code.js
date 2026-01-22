export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code required' });
  }

  try {
    const stored = global.verificationCodes?.[email.toLowerCase()];

    if (!stored) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }

    if (Date.now() > stored.expires) {
      delete global.verificationCodes[email.toLowerCase()];
      return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }

    if (stored.code !== code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Code is valid, clean up
    delete global.verificationCodes[email.toLowerCase()];

    res.status(200).json({ success: true, verified: true });
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}
