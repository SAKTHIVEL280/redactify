# Email Service Setup for License Recovery

The license recovery feature requires email verification to prevent unauthorized access. You'll need to set up an email service to send verification codes.

## Quick Setup (Recommended: Brevo)

### 1. Create a Brevo Account
1. Go to [https://www.brevo.com](https://www.brevo.com) (formerly Sendinblue)
2. Sign up for a free account (300 emails/day free tier)
3. Verify your email address

### 2. Generate API Key
1. Log in to Brevo dashboard
2. Go to **Settings** → **API Keys**
3. Click **Generate a new API key**
4. Copy the API key

### 3. Configure Vercel Environment Variables
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable:
   - **Name**: `BREVO_API_KEY`
   - **Value**: `your_brevo_api_key_here`
   - **Environment**: Production, Preview, Development
4. Click **Save**

### 4. Redeploy
After adding the environment variable, redeploy your application:
```bash
vercel --prod
```

Or push a new commit to trigger auto-deployment.

## Alternative: Use Custom SMTP

If you prefer to use your own email service (Gmail, Outlook, etc.), update `api/send-recovery-code.js`:

```javascript
// Replace the Brevo API section with your SMTP service
// Example with Nodemailer:
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

await transporter.sendMail({
  from: process.env.SMTP_EMAIL,
  to: email,
  subject: 'Your Redactify License Recovery Code',
  html: `Your verification code is: <strong>${verificationCode}</strong>`
});
```

## Testing

### Development Mode
During development, verification codes are logged to the console (check Vercel function logs).

### Production Testing
1. Go to your app's recovery page
2. Enter your email address
3. Check your inbox for the verification code
4. Enter the code to complete recovery

## Troubleshooting

### Emails not arriving?
1. Check your spam/junk folder
2. Verify the API key is correctly set in Vercel
3. Check Vercel function logs for errors: `vercel logs`
4. Ensure your Brevo account is verified

### Rate limiting?
The API has built-in rate limiting (5 requests per minute per IP). If you need more, adjust the limits in `api/send-recovery-code.js`.

## Security Notes

- Verification codes expire after 10 minutes
- Codes are 6 digits (100000-999999)
- One-time use only
- Rate limited to prevent abuse
- Stored in memory (consider Redis for production scale)

## Cost

**Brevo Free Tier**: 300 emails/day (sufficient for most applications)

If you exceed the free tier, consider:
- Upgrading to Brevo paid plan (~$25/month for 20k emails)
- Using AWS SES (~$0.10 per 1000 emails)
- Self-hosting with SMTP

## Support

For issues with email delivery, contact:
- Brevo Support: https://help.brevo.com
- Developer: sakthivel.b3p@gmail.com
