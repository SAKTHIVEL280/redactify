# Feedback Email API Setup Guide

## Overview
The feedback email API allows users to send feedback, bug reports, and feature requests directly from the app.

## Setup Instructions

### 1. Create a Resend Account
1. Go to https://resend.com and sign up (free tier: 100 emails/day)
2. Verify your email address
3. Go to **API Keys** section
4. Click **Create API Key**
5. Copy the API key (starts with `re_`)

### 2. Add Domain (Optional but Recommended)
For production emails from your domain:
1. Go to **Domains** in Resend dashboard
2. Add your domain (e.g., `redactify.com`)
3. Add DNS records as shown in Resend
4. Wait for verification (~5 minutes)
5. Update `from` field in `/api/send-feedback.js` to use your domain

**For now:** Use Resend's onboarding domain `onboarding@resend.dev` (already configured)

### 3. Configure Environment Variables in Vercel
1. Go to https://vercel.com/dashboard
2. Select your `redactify-vercel` project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```
RESEND_API_KEY = re_your_actual_api_key_here
```

5. Click **Save**
6. **Important:** Redeploy your project for env vars to take effect

### 4. Update Email Recipient
Edit `/api/send-feedback.js` line 42:
```javascript
to: ['your-actual-email@gmail.com'], // Replace with your email
```

### 5. Test the API

**Local testing:**
```bash
npm install resend
```

Create `.env.local`:
```
RESEND_API_KEY=re_your_key_here
```

**Production testing:**
After deployment, open your app and submit feedback through the Feedback modal.

## Email Template

Users will receive emails in this format:

```
From: Redactify Feedback <feedback@redactify.com>
Subject: [Redactify] Bug Report: Export failed

New Bug Report from Redactify

User Email: user@example.com
Subject: Export failed

Message:
When I try to export as PDF, I get an error...

---
Sent from Redactify Feedback System
Timestamp: 2025-12-20T10:30:00.000Z
```

## Troubleshooting

**Error: "Method not allowed"**
- API only accepts POST requests

**Error: "RESEND_API_KEY not found"**
- Add environment variable in Vercel
- Redeploy after adding

**Error: "Failed to send email"**
- Check API key is valid
- Verify domain in Resend (if using custom domain)
- Check Resend dashboard for error logs

**Emails not arriving:**
- Check spam folder
- Verify recipient email in code
- Check Resend dashboard → Logs for delivery status

## API Endpoint

**URL:** `https://redactify-vercel.vercel.app/api/send-feedback`

**Method:** POST

**Request Body:**
```json
{
  "type": "feedback",
  "email": "user@example.com",
  "subject": "Great app!",
  "message": "Love the privacy-first approach",
  "attachmentType": ""
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback sent successfully",
  "id": "email-id-from-resend"
}
```

## Next Steps
- [ ] Create Resend account
- [ ] Get API key
- [ ] Add to Vercel environment variables
- [ ] Update recipient email in code
- [ ] Deploy and test
- [ ] (Optional) Add custom domain to Resend
