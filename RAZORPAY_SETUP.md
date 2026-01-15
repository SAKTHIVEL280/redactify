# Razorpay Integration Setup Guide

## Required Dependencies

### Server-Side (for Vercel Functions)
```bash
npm install razorpay
```

This package is required for `/api/create-order.js` and `/api/verify.js` to work.

---

## Environment Variables

### Local Development (.env file)
```env
# Frontend (Vite) - Already configured
VITE_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
VITE_SUPABASE_URL=https://jsekqafvygccdpuzfeoj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend (Vercel Functions) - ADD THESE
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=YOUR_SECRET_KEY_HERE
SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_KEY_HERE
```

### Vercel Dashboard (for Production)
Add these in: **Project Settings → Environment Variables**

1. `RAZORPAY_KEY_ID` - Your Razorpay Key ID (Test or Live)
2. `RAZORPAY_KEY_SECRET` - Your Razorpay Secret Key ⚠️ NEVER EXPOSE
3. `SUPABASE_SERVICE_KEY` - Supabase service role key (for server-side ops)
4. `VITE_RAZORPAY_KEY_ID` - Same as #1 (for frontend)
5. `VITE_SUPABASE_URL` - Already configured
6. `VITE_SUPABASE_ANON_KEY` - Already configured

---

## Razorpay Setup Steps

### 1. Create Razorpay Account
1. Go to https://dashboard.razorpay.com/signup
2. Sign up with your business email
3. Complete KYC verification (required for live mode)

### 2. Get Test API Keys
1. Login to https://dashboard.razorpay.com/
2. Switch to **Test Mode** (toggle in top-right)
3. Go to **Settings → API Keys**
4. Click **Generate Test Key**
5. Copy both:
   - Key ID: `rzp_test_XXXXXXXXXXXXXXXX`
   - Key Secret: `XXXXXXXXXXXXXXXXXXXXXXXX`

### 3. Configure Webhooks (Optional)
For payment confirmations:
1. Go to **Settings → Webhooks**
2. Add webhook URL: `https://yourdomain.com/api/webhook`
3. Select events: `payment.captured`, `payment.failed`
4. Save webhook secret

---

## Supabase Setup Steps

### 1. Create Table for License Storage
Run this SQL in Supabase SQL Editor:

```sql
-- Create pro_licenses table
CREATE TABLE IF NOT EXISTS pro_licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_key TEXT UNIQUE NOT NULL,
  payment_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  email TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_pro_licenses_payment_id ON pro_licenses(payment_id);
CREATE INDEX IF NOT EXISTS idx_pro_licenses_email ON pro_licenses(email);
CREATE INDEX IF NOT EXISTS idx_pro_licenses_license_key ON pro_licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_pro_licenses_is_active ON pro_licenses(is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pro_licenses_updated_at BEFORE UPDATE
  ON pro_licenses FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
```

### 2. Configure Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE pro_licenses ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert (for new purchases)
CREATE POLICY "Allow anonymous insert" ON pro_licenses
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to read their own licenses
CREATE POLICY "Allow anonymous select" ON pro_licenses
  FOR SELECT
  TO anon
  USING (true);

-- Allow service role full access (for server-side operations)
CREATE POLICY "Service role has full access" ON pro_licenses
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 3. Get Service Role Key
1. Go to **Project Settings → API**
2. Copy `service_role` key (NOT the anon key)
3. Add to Vercel environment variables as `SUPABASE_SERVICE_KEY`
4. ⚠️ **NEVER expose this key in frontend code**

---

## Testing the Integration

### Test Payment Flow (Development)

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open app** and click "Go Pro"

3. **Click "Purchase"** - Razorpay modal should open

4. **Use Test Card Details:**
   ```
   Card Number: 4111 1111 1111 1111
   Expiry: Any future date (e.g., 12/25)
   CVV: Any 3 digits (e.g., 123)
   Name: Test User
   ```

5. **Verify Success:**
   - Success modal shows
   - License stored in IndexedDB (check DevTools → Application → IndexedDB)
   - License stored in Supabase (check Supabase dashboard → Table Editor)
   - Pro badge appears
   - Export buttons enabled (DOCX, PDF)

6. **Test License Recovery:**
   - Open "License Recovery" modal
   - Enter test email or payment ID
   - Verify license retrieved successfully

### Check Logs

**Vercel Logs:**
```bash
vercel logs
```

**Browser Console:**
- Check for any errors
- Verify Pro status: `await verifyProStatus()`

**Supabase Logs:**
- Go to **Database → Logs** to see INSERT operations

---

## Troubleshooting

### Error: "Payment configuration error"
- Razorpay key not set in `.env`
- Check: `console.log(import.meta.env.VITE_RAZORPAY_KEY_ID)`

### Error: "Failed to create order"
- `/api/create-order.js` function failed
- Check Vercel function logs
- Verify `RAZORPAY_KEY_SECRET` is set in Vercel

### Error: "Invalid signature"
- Payment tampered or test mode mismatch
- Verify using same key pair (test with test, live with live)

### Error: "Supabase storage error"
- Table doesn't exist or RLS blocking
- Run SQL schema again
- Check RLS policies

### Payment Success but Pro Not Unlocking
- Check browser console for errors
- Verify `verifyProStatus()` returns true
- Check IndexedDB has license entry
- Try refreshing page

---

## Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] Never commit API secrets to Git
- [ ] Use Test Mode keys for development
- [ ] Switch to Live Mode keys only after testing
- [ ] Service role key only used on server-side
- [ ] Anon key only used in frontend
- [ ] RLS policies configured correctly
- [ ] Payment verification on server-side (not client)
- [ ] License keys encrypted in browser storage

---

## Production Deployment

### Before Going Live:

1. **Complete Razorpay KYC** (required for live payments)
2. **Switch to Live Mode:**
   - Get Live API keys from Razorpay dashboard
   - Update `RAZORPAY_KEY_ID` to `rzp_live_XXXXX`
   - Update `RAZORPAY_KEY_SECRET` to live secret
3. **Update Vercel Environment Variables** with live keys
4. **Test with Real ₹1 Payment** first
5. **Monitor Payment Success Rate** in Razorpay dashboard
6. **Set up Payment Reconciliation** process

### Post-Launch Monitoring:

- Check Razorpay dashboard daily for failed payments
- Monitor Supabase for license creation errors
- Set up alerts for API failures
- Review logs for suspicious activity

---

## Cost Estimation

### Razorpay Fees (India)
- **2%** + ₹0 per successful transaction
- For ₹1,599 license: **₹31.98 fee** per sale
- Your net: ₹1,567.02 per sale

### Supabase (Free Tier)
- 500MB database storage (plenty for licenses)
- 2GB bandwidth/month
- 50,000 monthly active users
- Should be free unless you get HUGE traffic

### Vercel (Free Tier)
- 100GB bandwidth/month
- Serverless function executions: 100,000/month
- Should be free for initial launch

---

## Support

**Razorpay Support:**
- Docs: https://razorpay.com/docs/
- Email: support@razorpay.com

**Supabase Support:**
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

**Issues with this integration:**
- Check Vercel function logs
- Test with Razorpay test cards
- Verify environment variables
