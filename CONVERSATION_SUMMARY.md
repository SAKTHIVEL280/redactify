# Redactify — Comprehensive Session Summary & Technical Context

> **Target Document:** Complete architectural record, security audit findings, implementation details, and live verification evidence for **Redactify** (`https://redactify.daeq.in`). Designed for ingestion by another AI assistant or technical auditor.

---

## 1. Project Overview & Core Constraints

* **Product:** Redactify — A 100% client-side privacy-first document and resume redaction tool supporting `.pdf`, `.docx`, and `.txt` files.
* **Core Philosophy:** Zero-trust, local-first processing. Documents never leave the user's browser for redaction. Serverless functions are strictly reserved for payments, asymmetric license issuance, recovery OTPs, and concurrency locks.
* **Production Domain:** `https://redactify.daeq.in` (Strictly `redactify.daeq.in`; all legacy references to `redactify.app` or `Resume Redactor` were purged).
* **Payment Gateway:** Razorpay (India & International).
* **Free-Tier Infrastructure Constraint:** 100% free-tier compliant (Vercel Hobby plan, Supabase Free Tier, Resend Free Tier, Razorpay Free). No paid infrastructure or credit-card dependencies.

---

## 2. Chronological Conversation & Milestone Summary

### Phase 1: Full Rebranding & Redaction Engine Overhaul
1. **Complete Rebranding:**
   - Eradicated all instances of `"Resume Redactor"` from UI, components, metadata, SEO tags, and database names. Replaced with `"Redactify"`.
   - Updated logos, typography, favicons, PWA manifest, and OpenGraph headers.
2. **Visual PDF & Document Redaction Fixes:**
   - Fixed bounding box overflows where redaction rectangles covered entire lines instead of individual targeted words.
   - Restored two-pass bounding calculation in `pdf-lib` and word-level coordinate matching in `pdfjs-dist`.
   - Added visual diff verification scripts proving exact glyph-level alignment on 2-column documents, tables, and scanned text.

### Phase 2: Independent Security Audit & The License Exploit
1. **The Vulnerability Found:**
   - In prior versions, Pro license verification was symmetric: client encrypted a payload with Web Crypto AES-GCM using a key derived from a static, hardcoded salt string (`"redactify-pro-vault-seed-v1"`).
   - Because both the encryption and decryption logic lived on the client without a server-side cryptographic signature, an attacker could trivially forge a valid Pro license in `localStorage` and `IndexedDB` with zero payment:
     ```javascript
     // Exploit: Encrypt fake license with hardcoded client key -> Unlocks Pro
     localStorage.setItem('redactify_pro_license_encrypted', JSON.stringify({ id: 'pro_license', encrypted: b64, timestamp: Date.now() }));
     ```
   - Direct exploit proof captured in `verification_evidence/license_forged_bypass_state.png`.
2. **Secondary Vulnerabilities Uncovered:**
   - `/api/save-license-email` accepted arbitrary `{ licenseKey, email }` without validating that the requester owned the license (allowing email hijacking).
   - Export utilities (`exportAsDOCX`, `exportAsPDF`, `exportBatchAsZip`) had UI gates, but their underlying exported functions could be called directly by scripts without license checks.

### Phase 3: Asymmetric Cryptographic Fix & Architectural Hardening
1. **ECDSA P-256 Digital Signatures:**
   - Replaced symmetric client-only AES check with **Asymmetric Elliptic Curve Digital Signatures (ECDSA P-256 with SHA-256)**.
   - **Server Private Key** (`LICENSE_PRIVATE_KEY` / fallback): Stored exclusively on Vercel serverless functions in `lib/licenseSigner.js`. The client never has access to the private key.
   - **Client Public Key** (`SPKI Base64`): Hardcoded into `src/utils/licenseCrypto.js`:
     `MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9NtZyen3oWG75MWBglOEi9LehGxyopQSC0L/kjQAITRQchd04fV+CaiQbkAzJOTnuLjXnL0zKweJpy4AVOl4mA==`
   - Canonical message format:
     `V1:${key}:${orderId}:${paymentId}:${purchasedAt}:${type}`
   - The browser uses native `window.crypto.subtle.verify` to validate the signature. Tampering with any field (e.g. changing 1 character of `paymentId` or replaying another signature) mathematically invalidates the signature.
   - Automatic cleanup: When `getProKey()` encounters an unsigned or invalidly signed license, it purges it immediately from both `IndexedDB` and `localStorage`.
2. **Razorpay Webhook & Refund Revocation:**
   - Implemented `api/razorpay-webhook.js` validating `x-razorpay-signature` via HMAC-SHA256.
   - Handles `refund.processed` and `payment.dispute.created` by adding the license key and payment ID to the revocation registry.
   - Client performs opportunistic revocation checks on boot via `api/check-revocation.js`.
3. **Dual-Layer Concurrency Locking:**
   - Prevents one lifetime license from being used simultaneously across multiple machines for batch workloads.
   - Endpoint: `api/concurrency-lock.js` with actions `acquire`, `heartbeat`, and `release`.
   - Primary storage: Supabase `redaction_locks` table (TTL: 45s, heartbeat: 15s).
   - Graceful fallback: In-memory Map with automatic garbage collection if Supabase credentials are not supplied.
4. **Ownership Verification for License Email Linking:**
   - Updated `api/save-license-email.js` to require either `paymentId` or an authentic ECDSA `signature`. Unauthenticated attempts return `403 Forbidden`.
5. **Programmatic Export Gating:**
   - Added runtime license assertion inside `exportAsDOCX`, `exportAsPDF`, and `exportBatchAsZip` to reject unauthorized programmatic invocations.

### Phase 4: Database Schema & Env Configuration
1. **Supabase Schema (`supabase/schema.sql`):**
   - Tables created: `pro_licenses`, `verification_codes`, `redaction_locks`.
   - Row Level Security (RLS) enabled across all tables; public access revoked, server service role access permitted.
2. **Environment Variable Minimization:**
   - `RESEND_FROM_EMAIL` defaults in code to `'onboarding@resend.dev'`.
   - Total required server environment variables on Vercel:
     - `RAZORPAY_KEY_ID`
     - `RAZORPAY_KEY_SECRET`
     - `RAZORPAY_WEBHOOK_SECRET`
     - `LICENSE_PRIVATE_KEY` (ECDSA P-256 PKCS#8 PEM)
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_KEY`
     - `RESEND_API_KEY`

### Phase 5: Vercel Hobby Plan 12-Function Limit Debugging
* **Problem:** When pushing to Vercel, the build failed with:
  > *"No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan."*
* **Root Cause:** Vercel counts every `.js` file under `api/` as a serverless function. With 10 endpoints and 3 helper modules in `api/lib/`, the count reached 13 (exceeding the limit of 12).
* **Solution:**
  1. Moved helper files (`licenseSigner.js`, `rateLimit.js`, `revocationRegistry.js`) out of `api/` to root `lib/`.
  2. Consolidated `recover-by-payment.js`, `send-recovery-code.js`, and `verify-recovery-code.js` into a unified `api/recovery.js` endpoint.
  3. Added URL rewrites in `vercel.json` so existing frontend paths route transparently to `/api/recovery`.
  4. Final function count: **8 serverless functions** (33% below the limit). Deployed cleanly.

### Phase 6: Live Production Verification (`https://redactify.daeq.in`)
* Ran automated Playwright test suite (`tests/test_online_production_complete.py`) in real Chromium against the live deployment.
* **Results: 100% Passed.**
  - All 5 serverless endpoints tested via HTTPS (expected 400/403/200 validation behaviors confirmed).
  - Brand integrity confirmed (0 instances of "Resume Redactor").
  - Client-side PII engine ran live on production with 5 sensitive items detected locally.
  - Prior exploit injected live: **REJECTED & PURGED**. Upgrade button remained visible; Pro badge withheld.
  - Legitimate signed license injected live: **UNLOCKED PRO**. Pro badge, Batch, Rules, and Logout rendered.
  - Logout clicked: **PRO BADGE PURGED**, confirmation dialog accepted, UI returned to Free tier immediately.

---

## 3. Architecture & Key File Reference

```
Redactify/
├── api/                           # Vercel Serverless Functions (8 total, <= 12 Hobby limit)
│   ├── check-revocation.js        # Opportunistic license revocation checking
│   ├── concurrency-lock.js        # Multi-device concurrent usage locking (Supabase + Memory)
│   ├── create-order.js            # Razorpay order generation
│   ├── razorpay-webhook.js        # HMAC-verified refund & chargeback processing
│   ├── recovery.js                # Consolidated recovery: OTP send/verify + Payment ID lookup
│   ├── save-license-email.js      # Gated license-to-email association (requires proof of ownership)
│   ├── send-feedback.js           # User feedback forwarding via Resend
│   └── verify.js                  # Razorpay payment verification + ECDSA license issuance
├── lib/                           # Server Utilities (Excluded from Vercel function count)
│   ├── licenseSigner.js           # ECDSA P-256 signer & canonical string builder
│   ├── rateLimit.js               # In-memory IP rate limiter
│   └── revocationRegistry.js      # Revocation database / in-memory tracker
├── src/
│   ├── components/
│   │   ├── BatchProcessor.jsx     # Pro batch processing with concurrency lock integration
│   │   ├── CustomRulesManager.jsx # Pro regex and keyword custom rules
│   │   ├── LicenseRecovery.jsx    # Recovery modal (via email OTP or Razorpay payment ID)
│   │   ├── ProModal.jsx           # Upgrade paywall modal with Razorpay checkout
│   │   ├── Redactor.jsx           # Main document editor & redaction canvas
│   │   └── Sidebar.jsx            # PII analysis panel & action controls
│   └── utils/
│       ├── batchExportUtils.js    # Gated batch zip exporter
│       ├── concurrencyLock.js     # Client lock client (heartbeat loop every 15s)
│       ├── exportUtils.js         # Gated PDF and DOCX generators
│       ├── licenseCrypto.js       # Client Web Crypto ECDSA P-256 signature verifier
│       ├── piiDetector.js         # Client-side regex & heuristics PII engine
│       └── proLicenseDB.js        # Storage vault with automatic forgery purging
├── supabase/
│   └── schema.sql                 # PostgreSQL DDL with RLS policies
├── tests/
│   ├── test_all_local_edge_cases.js         # 21 exhaustive local edge-case tests
│   ├── test_online_production_complete.py   # Live Playwright test suite against redactify.daeq.in
│   └── test_prior_exploit_against_new_code.py # Exploit reproduction script
├── vercel.json                    # Routing, rewrites, and security headers
└── AGENT.md                       # Comprehensive rules and context harness for AI agents
```

---

## 4. Cryptographic Proof Matrix

| Attack / Use Case | Test Vector | Expected Outcome | Live Production Verification |
| :--- | :--- | :--- | :--- |
| **Old Exploit (Forged AES Key)** | Injected encrypted JSON without ECDSA signature | Signature check fails; forged record deleted; stays Free | **PASSED** (`online_exploit_failed.png`) |
| **Altered Payload (Tampering)** | Changed 1 character of `paymentId` with valid signature | ECDSA verification fails mathematically; rejected | **PASSED** (`EDGE-03`) |
| **Signature Replay** | Paired valid signature of License A with License B | Signature mismatch detected; rejected | **PASSED** (`EDGE-04`) |
| **Legitimate License** | Valid license signed by server private key | ECDSA passes; Pro unlocked; Batch & Rules enabled | **PASSED** (`online_legitimate_pro_active.png`) |
| **Email Hijack Attack** | Call `/api/save-license-email` without paymentId/signature | Returns `403 Forbidden`; database write blocked | **PASSED** (`API Fix 1`) |
| **Concurrency Collisions** | Second device attempts to redact concurrently | Blocked with "Document processing in progress on another device" | **PASSED** (`EDGE-08`) |
| **Device Logout** | User clicks "Logout" in header | Storage wiped; UI immediately drops to Free tier | **PASSED** (`online_after_logout.png`) |

---

## 5. Instructions for Next AI Assistant

1. **Do not modify cryptographic algorithms:** Client verification in `src/utils/licenseCrypto.js` and server signing in `lib/licenseSigner.js` use standard ECDSA P-256. Any change to the canonical string format (`V1:${key}:${orderId}:${paymentId}:${purchasedAt}:${type}`) will break existing licenses.
2. **Keep function count $\le 12$ on Vercel:** Do not place new `.js` helper files directly inside `api/`. Always place shared modules inside `lib/` or subdirectories prefixed with `_`.
3. **Respect client-side privacy:** Under no circumstances should document text, PDFs, or images be forwarded to external servers or AI endpoints. All AI inference is performed in-browser using `@xenova/transformers` and local Web Workers.
4. **Refer to `AGENT.md`:** Comprehensive instructions, guidelines, and context harness are preserved in `AGENT.md`.
