# Supabase Schema for Email Verification

## Create verification_codes table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create verification_codes table for email verification
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  code VARCHAR(6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access" ON verification_codes
  FOR ALL USING (true);

-- Function to clean up expired codes (runs automatically)
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM verification_codes
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup every hour (optional, using pg_cron extension if available)
-- SELECT cron.schedule('cleanup-expired-codes', '0 * * * *', 'SELECT cleanup_expired_codes()');
```

## Environment Variables Required

Already configured in your `.env`:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key (for server-side operations)
- `RESEND_API_KEY` - For sending emails

## Migration Steps

1. Run the SQL above in Supabase SQL Editor
2. Deploy the updated API files (I'll update them now)
3. Test email verification flow
4. Cleanup old in-memory code (automatic)

## Benefits

- ✅ Persistent storage (survives serverless restarts)
- ✅ Automatic cleanup of expired codes
- ✅ Rate limiting per email
- ✅ Attempt tracking (prevent brute force)
- ✅ Verification audit trail
