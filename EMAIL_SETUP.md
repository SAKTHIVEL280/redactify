# Email Service Setup for License Recovery

The license recovery feature requires email verification to prevent unauthorized access. Your app already uses **Resend** for feedback emails, so we'll use the same service for verification codes.

## Setup Status

✅ **You already have Resend configured!** The same `RESEND_API_KEY` used for feedback will handle license recovery verification.

### What's Already Working
- Feedback form emails → `sakthivel.hsr06@gmail.com`
- Resend API key configured in Vercel
- Email sending infrastructure ready

### What's New
- License recovery now sends 6-digit verification codes
- Uses the same Resend account and API key
- No additional setup needed!

## Verification Flow

1. User enters email for license recovery
2. System sends 6-digit code to their email
3. User enters code to verify ownership
4. License is recovered and restored

## Testing

### Check if it's working:
1. Go to your app's license recovery page
2. Enter any email address
3. Check that email's inbox for the verification code
4. Enter the code to complete recovery

### If emails aren't arriving:
1. Check spam/junk folder
2. Verify `RESEND_API_KEY` is set in Vercel
3. Check Vercel function logs: `vercel logs`
4. Ensure Resend domain is verified (onboarding@resend.dev works immediately)

## Security Features

- ✅ Verification codes expire after 10 minutes
- ✅ Codes are 6 digits (100000-999999)
- ✅ One-time use only
- ✅ Stored in memory (sufficient for current scale)
- ✅ Same rate limiting as feedback form

## No Additional Cost

Your existing Resend plan covers this:
- **Free Tier**: 100 emails/day (more than enough)
- **Paid Plans**: If you're already paying for feedback emails, recovery emails are included

## Environment Variables

Already configured in Vercel:
```bash
RESEND_API_KEY=re_xxxxxxxxx  # ✅ Already set
```

No changes needed!

## Support

For issues with email delivery:
- Check Resend dashboard: https://resend.com/emails
- Resend docs: https://resend.com/docs
- Developer: sakthivel.b3p@gmail.com

## Technical Details

The verification system uses:
- **API endpoint**: `/api/send-recovery-code`
- **Verification endpoint**: `/api/verify-recovery-code`
- **Email template**: Branded HTML with 6-digit code
- **From address**: `Redactify <onboarding@resend.dev>`
- **Storage**: In-memory (Vercel serverless functions)
- **Expiration**: 10 minutes per code
