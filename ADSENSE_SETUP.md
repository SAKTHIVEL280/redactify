# Google AdSense Setup Guide

## Overview
AdSense is already integrated into Redactify with 3 ad placements. You just need to complete the AdSense account setup and update the credentials.

## Ad Placements (Already Integrated)
1. **Landing Page - Mid Section** - After "How it Works" section
2. **Landing Page - Bottom** - Before footer
3. **Sidebar** - In the results sidebar (Pro users won't see this)

## Setup Steps

### 1. Apply for Google AdSense
1. Go to https://www.google.com/adsense/
2. Click **Sign Up** and log in with your Google account
3. Enter your website URL: `https://redactify-vercel.vercel.app` (or your custom domain)
4. Submit your application
5. **Wait for approval** (can take 1-3 days, sometimes up to 2 weeks)

### 2. Get Your AdSense Client ID
Once approved:
1. Go to https://adsense.google.com
2. Navigate to **Account** → **Settings** → **Account Information**
3. Find your **Publisher ID** (format: `ca-pub-1234567890123456`)
4. Copy this ID

### 3. Create Ad Units
After approval, create 3 ad units:
1. Go to **Ads** → **By ad unit** → **Display ads**
2. Create 3 ad units:

**Ad Unit 1: Landing Hero**
- Name: `Redactify Landing Hero`
- Type: Display ads
- Size: Responsive
- Copy the Ad Slot ID (e.g., `1234567890`)

**Ad Unit 2: Results Footer**
- Name: `Redactify Results Footer`
- Type: Display ads  
- Size: Responsive
- Copy the Ad Slot ID (e.g., `0987654321`)

**Ad Unit 3: Sidebar**
- Name: `Redactify Sidebar`
- Type: Display ads
- Size: Responsive (or 300x250)
- Copy the Ad Slot ID (e.g., `1122334455`)

### 4. Update Your .env File
Replace the placeholder values in your `.env`:

```env
# Google AdSense Configuration
VITE_ADSENSE_CLIENT_ID=ca-pub-1234567890123456  # Your actual Publisher ID

# AdSense Slot IDs
LANDING_HERO_SLOT_ID=1234567890     # Landing page mid-section ad
RESULTS_FOOTER_SLOT_ID=0987654321   # Landing page bottom ad
SIDEBAR_SLOT_ID=1122334455          # Sidebar ad (non-Pro users)
```

### 5. Update index.html
Replace the placeholder in `index.html` line 31-32:

**Current:**
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
```

**Replace with:**
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR_ACTUAL_ID"
```

### 6. Update Vercel Environment Variables
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Update or add:
   ```
   VITE_ADSENSE_CLIENT_ID = ca-pub-your-actual-id
   ```
3. Click Save
4. Redeploy your project

### 7. Add AdSense Verification Code (If Required)
During application, Google might ask you to add a verification meta tag:

1. If asked, copy the meta tag Google provides
2. Add it to `index.html` in the `<head>` section:
```html
<meta name="google-adsense-account" content="ca-pub-1234567890123456">
```

## Testing

### Before Approval
- Ads will NOT show until Google approves your application
- You can deploy with placeholder IDs - they'll activate after approval

### After Approval
1. Deploy your site with real AdSense IDs
2. Visit your live site: https://redactify-vercel.vercel.app
3. Open browser DevTools → Console
4. Look for AdSense loading messages
5. Ads may take **24-48 hours** to start showing after approval

### Common Issues

**"AdSense account pending review"**
- Wait for Google's approval (1-3 days to 2 weeks)
- Make sure your site has original content and follows AdSense policies

**Ads not showing after approval**
- Wait 24-48 hours after adding code
- Check browser console for errors
- Ensure ad blockers are disabled
- Verify Client ID matches in code and Vercel env vars

**"AdSense error" in console**
- Check Client ID is correct
- Verify ad slot IDs match your AdSense dashboard
- Make sure user accepted advertising cookies (cookie banner)

## AdSense Policies to Follow

✅ **Do:**
- Provide valuable, original content
- Have clear privacy policy (already have)
- Respect user cookie preferences (already implemented)
- Place ads in non-intrusive locations

❌ **Don't:**
- Click your own ads (will get banned)
- Ask users to click ads
- Place ads on pages with prohibited content
- Use deceptive practices

## Revenue Expectations

**Free Tier:**
- Payment threshold: $100
- Typical CPM: $1-$10 depending on traffic and niche
- Payment: Monthly via bank transfer/check/wire

**Estimated Earnings (Example):**
- 1,000 page views/day
- 3 ad units per page
- $2 CPM average
- = ~$6/day = ~$180/month

Actual earnings vary based on:
- Traffic volume
- User location
- Niche/topic
- Ad placement
- Click-through rate

## Current Integration Status

✅ Already Integrated:
- AdSenseSlot component created
- 3 ad placements configured (Landing x2, Sidebar x1)
- Cookie consent integration (respects user privacy choices)
- Pro users bypass ads (cleaner experience)
- Responsive ad sizing

⏳ Need to Complete:
- [ ] Apply for AdSense account
- [ ] Get approved (wait 1-3 days)
- [ ] Get Publisher ID (ca-pub-...)
- [ ] Create 3 ad units
- [ ] Update .env with real IDs
- [ ] Update index.html with real client ID
- [ ] Deploy to Vercel
- [ ] Wait 24-48 hours for ads to show

## Next Steps After Setup
1. Monitor performance in AdSense dashboard
2. Experiment with ad placements
3. A/B test ad formats
4. Track revenue vs user experience
5. Consider removing ads for Pro users entirely (already done)

## Support
- AdSense Help: https://support.google.com/adsense
- Policy Center: https://support.google.com/adsense/answer/48182
