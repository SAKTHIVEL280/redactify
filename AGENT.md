# Redactify — Agent & Developer Harness

> **Single Source of Truth**: This document defines the architecture, project guidelines, coding standards, known pitfalls, and production readiness requirements for **Redactify**. All agents and engineers working on this codebase must read and adhere to this harness.

---

## 1. Project Mission & Identity
* **Name**: Redactify
* **Category**: Privacy-First Local Document & Resume Redaction Platform (PWA)
* **Target Audience**: Dual Audience
  1. **Individuals & Job Seekers**: One-time redaction of resumes and personal documents (One-Time / Free / Day Pass).
  2. **HR Teams, Recruiters & Small Businesses**: Batch blind-recruitment candidate anonymization, legal document scrubbing, and compliance (Pro Subscription / Lifetime Business).
* **Core Value Proposition**: **100% In-Browser Client-Side Processing**. No document, text, or file content is ever transmitted to a remote server. Zero-trust by design.

---

## 2. Tech Stack & Architecture

### Client-Side (SPA & PWA)
* **Framework**: React 18, Vite 5, Tailwind CSS
* **PWA**: `vite-plugin-pwa` with Workbox offline service worker (`sw.js`)
* **ML / NER**: `@xenova/transformers` (ONNX Runtime Web running `Xenova/bert-base-NER` inside a dedicated Web Worker)
* **Document Parsers**:
  * PDF: `pdfjs-dist` (Text extraction, token coordinate extraction, canvas rendering)
  * DOCX: `mammoth` (HTML preview extraction)
  * Plain Text: Native `FileReader`
* **Format-Preserving Exporters**:
  * DOCX: `jszip` + native XML DOM parsing (modifying `<w:t>` tags in OOXML ZIP directly without destroying styling)
  * PDF: `pdfjs-dist` (canvas rendering at 2.5x scale with burnt-in black redaction boxes) + `pdf-lib` (dual-layer invisible selectable text layer)
  * TXT: Pure text replacement via `Blob`
* **Local Storage**: IndexedDB (`ResumeRedactorDB`) with Web Crypto API (`AES-GCM` 256-bit) and Safari private mode fallback to `localStorage`.

### Serverless Backend (Vercel Serverless Functions)
* **Runtime**: Node.js ESM (`/api/*`)
* **Payment Gateway**: Razorpay (`/api/create-order`, `/api/verify` with HMAC-SHA256 timing-safe signature check)
* **License & Recovery Database**: Supabase REST API via serverless functions (`/api/save-license-email`, `/api/send-recovery-code`, `/api/verify-recovery-code`, `/api/recover-by-payment`)
* **Transactional Email**: Resend API (`/api/send-recovery-code`, `/api/send-feedback`)

---

## 3. Directory Structure

```text
Redactify/
├── api/                       # Vercel Serverless Functions (Node.js)
│   ├── create-order.js        # Razorpay order generation (server-side price validation)
│   ├── verify.js              # HMAC-SHA256 payment signature verification & license issuance
│   ├── save-license-email.js  # Associate email with verified license
│   ├── send-recovery-code.js  # Generate & email 6-digit OTP via Resend
│   ├── verify-recovery-code.js# Validate OTP and return license key
│   ├── recover-by-payment.js  # Recover license by Razorpay payment ID
│   ├── send-feedback.js      # User feedback email delivery
│   └── lib/rateLimit.js       # In-memory IP rate limiter for serverless endpoints
├── public/                    # Static assets, PWA icons, offline page, video
├── src/
│   ├── components/            # React UI components
│   │   ├── Landing.jsx        # High-conversion hero, bento grid, privacy highlights
│   │   ├── Redactor.jsx       # Single-document redaction workspace & drag-and-drop
│   │   ├── BatchProcessor.jsx # Multi-document batch processing & ZIP export
│   │   ├── DocumentViewer.jsx # Multi-format document viewer with live PII highlights
│   │   ├── Sidebar.jsx        # PII inspection list, bulk toggle, export triggers
│   │   ├── ProModal.jsx       # Razorpay checkout modal
│   │   ├── LicenseRecovery.jsx# Email OTP & payment ID license restore modal
│   │   ├── CustomRulesManager.jsx # Custom regex rule management
│   │   └── SeoLandingPages.jsx# Programmatic landing routes for high-intent SEO/GEO
│   ├── hooks/
│   │   └── useTransformersPII.js # React hook communicating with ML Web Worker
│   ├── utils/
│   │   ├── piiDetector.js     # Regex detection engine, replacePII, highlightPII
│   │   ├── smartDetection.js  # Orchestrator merging regex + ML + custom rules
│   │   ├── contextAwareDetection.js # Document structure analyzer (header vs body)
│   │   ├── exportUtils.js     # Format-preserving single export (DOCX ZIP & PDF canvas)
│   │   ├── batchExportUtils.js# Format-preserving batch ZIP export engine
│   │   ├── proLicenseDB.js    # AES-GCM encrypted IndexedDB license storage
│   │   ├── customRulesDB.js   # IndexedDB storage for custom user regex patterns
│   │   └── browserCompat.js   # Storage & feature detection with graceful fallbacks
│   └── workers/
│       └── transformersPIIWorker.js # Web Worker running BERT Named Entity Recognition
├── AGENT.md                   # This project harness & context document
├── vercel.json                # Security headers, rewrites, and asset caching
└── vite.config.js             # Vite build configuration, chunking, and PWA setup
```

---

## 4. Critical Engineering Invariants & Pitfalls

### Rule 1: Zero Server Document Uploads (Absolute Law)
Under no circumstance may document text, filenames, or file array buffers be transmitted to any backend or third-party server. All parsing, AI inference, and rendering MUST happen inside browser memory.

### Rule 2: Precise PDF Coordinate & Bounding Box Calculation
When rendering black redaction boxes in `exportUtils.js` or `DocumentViewer.jsx`:
* PDF.js `getTextContent()` returns chunks (`item.str`) that often contain entire sentences or multi-word phrases.
* **Never black out the entire `item.width`** when only a single word or substring matches PII.
* You **must compute the proportional character sub-slice**:
  ```javascript
  const charWidth = item.width / Math.max(1, item.str.length);
  const matchX = item.pdfX + (subStart * charWidth);
  const matchW = Math.max(subEnd - subStart, 1) * charWidth;
  ```
* Redaction boxes must tightly enclose the matched substring with a standard `pad = 2px`.
* When writing redacted labels (`[REDACTED]`), clamp the font size so the label does not overflow into adjacent document content.

### Rule 3: Format Preservation in Batch Mode
* `BatchProcessor.jsx` must preserve the original `File` references.
* `batchExportUtils.js` must execute format-preserving DOCX OOXML ZIP replacements and PDF dual-layer canvas exports for each file in the batch—never downgrade to raw text-wrapped documents.

### Rule 4: Client-Side Security & Graceful Degradation
* Serverless functions in `api/` must strictly validate inputs, use timing-safe comparisons (`crypto.timingSafeEqual`), and enforce rate limiting.
* The ML Worker (`transformersPIIWorker.js`) must never block the main UI thread. If the model is loading, downloading, or fails, the application must immediately fall back to the deterministic regex engine without halting the user.

---

## 5. Production Readiness Checklist
- [x] Universal product branding as Redactify (no legacy "Resume Redactor" references).
- [x] Precise PDF redaction bounding boxes (no line overflows).
- [x] Format-preserving Batch Export for DOCX, PDF, and TXT.
- [x] Scanned document detection & alert for non-selectable PDFs.
- [x] Client bundle optimization (zero dead dependencies).
- [x] PWA offline caching & error boundary protection.
- [x] Timing-safe HMAC signature verification on payment.
- [x] Assistive tool legal disclaimer on document export.
