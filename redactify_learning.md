# Redactify — Ultimate Technical Interview & Learning Guide

> **Target Goal**: Master every detail, file purpose, function signature, design trade-off ("Why this over alternatives?"), and deep architectural concept in the Redactify codebase to ace your technical interview.

---

## 1. Executive Summary & High-Level Architecture

**Redactify** (also known as *Resume Redactor*) is a **local-first, privacy-focused Progressive Web Application (PWA)** that automatically detects and redacts Personally Identifiable Information (PII) — such as names, emails, phone numbers, addresses, Social Security Numbers (SSNs), credit cards, IP addresses, and custom regular expressions — from resumes and documents (**PDF, DOCX, TXT**).

### Core Architectural Promise
1. **100% Client-Side Data Privacy**: No user document, text, or file content is EVER uploaded to a remote server. All parsing, Named Entity Recognition (NER), regex pattern matching, and file exports happen inside browser memory.
2. **Hybrid Detection Engine**: Combines deterministic Regex matching for structured PII with local Machine Learning (BERT NER via Transformers.js & ONNX in a Web Worker) for unstructured contextual PII (Names, Organizations, Locations).
3. **Format-Preserving Exports**:
   - **DOCX**: Modifies OOXML files directly inside a ZIP archive using `JSZip` and DOM parsing so that font styles, tables, header images, and layouts are untouched.
   - **PDF**: Renders pages to a canvas with black redaction boxes burnt directly into the image layer, layered under an invisible copyable text layer where redacted text is replaced with labels like `[EMAIL REDACTED]`.
4. **Local Storage Security**: Pro keys and custom regex rules are saved in `IndexedDB` with `Web Crypto API (AES-GCM)` encryption and fallback mechanisms for private browsing modes.
5. **Serverless Payment Backend**: Vercel Serverless Functions process Razorpay orders and verify HMAC-SHA256 signatures with timing-safe comparisons (`crypto.timingSafeEqual`).

---

## 2. High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph Client Browser [Client-Side Browser (100% Local)]
        UI[React 18 SPA / App.jsx]
        
        subgraph Detection [Hybrid PII Detection Engine]
            RP[piiDetector.js - Regex Patterns]
            WW[transformersPIIWorker.js - Web Worker BERT NER]
            CR[customRulesDB.js - Custom Regex Rules]
        end

        subgraph Parsing [Document Parsers]
            PDFP[pdfjs-dist - PDF Text & Coordinates]
            DOCXP[mammoth - DOCX Text Extraction]
            TXTP[FileReader - TXT Engine]
        end

        subgraph Exporters [Format-Preserving Export Engine]
            TXTE[exportAsTXT - Plain Text]
            DOCXE[exportAsDOCX - JSZip OOXML Manipulator]
            PDFE[exportAsPDF - Canvas + Invisible Text Layer]
        end

        subgraph Storage [Secure Local Vault]
            IDB[(IndexedDB: ResumeRedactorDB)]
            AES[Web Crypto API: AES-GCM Encryption]
            LS[(LocalStorage Fallback)]
        end
    end

    subgraph Backend [Vercel Serverless & Cloud Infrastructure]
        VAPI[Vercel Serverless APIs /api/*]
        RZP[Razorpay Payment Gateway]
        SUPA[(Supabase Database - License Keys & Recovery)]
    end

    %% Flow connections
    UI --> Parsing
    Parsing --> Detection
    Detection --> UI
    UI --> Exporters
    
    %% License & Payment flow
    UI -- "1. Purchase Pro" --> RZP
    RZP -- "2. Payment Details" --> VAPI
    VAPI -- "3. Verify Signature (HMAC-SHA256)" --> VAPI
    VAPI -- "4. Store Key" --> SUPA
    VAPI -- "5. Return License Key" --> UI
    UI -- "6. Encrypt & Store" --> AES --> IDB
```

---

## 3. Key Interview Questions & "Why This Over That" Design Rationale

When interviewers ask **"Why did you choose X instead of Y?"**, use these precise engineering explanations:

### Q1: Why run AI PII Detection locally in the browser (Transformers.js / ONNX) instead of calling a Cloud API (OpenAI / Claude)?
* **Privacy & Security**: Users anonymize highly sensitive documents (resumes, contracts, medical records). A cloud API requires sending raw unredacted text to a 3rd-party server, violating GDPR/HIPAA compliance. Client-side execution guarantees zero server data exposure.
* **Cost & Scalability**: Zero per-query API costs for backend infrastructure.
* **Offline Capability**: PWA architecture allows users to redact documents in air-gapped or offline environments.
* **Trade-off & Solution**: Web ML models are large (~30MB to download). We solved this by using quantized `Xenova/bert-base-NER`, caching models in `Cache API / OPFS`, and using Web Workers to prevent main thread rendering freezes.

### Q2: Why use Web Workers instead of running regex and ML on the main UI thread?
* **Main Thread Responsiveness**: JavaScript runs on a single-threaded event loop. Tokenizing large documents (>5,000 chars) and running BERT matrix multiplications take hundreds of milliseconds to seconds. Running on the main thread would freeze the UI (causing "Page Unresponsive" popups and broken CSS animations).
* **Isolation**: Web Workers run on background operating system threads. Messages are passed via non-blocking asynchronous `postMessage` protocol.

### Q3: Why a Hybrid Detection Engine (Regex + BERT NER)?
* **Regex Strengths**: Deterministic, instant, 100% precision for structured patterns (Emails, US Phone numbers, SSNs, Credit Cards, IPv4/IPv6 addresses).
* **BERT NER Strengths**: Context-aware understanding for unstructured text where regex fails (e.g., distinguishing "John Smith" as a person's name versus "Apple" as an organization versus "Apple" as a fruit).
* **Combined Engine**: Regex runs instantly while the background Web Worker streams ML NER results, combining high speed with high contextual accuracy.

### Q4: How does DOCX export preserve 100% of formatting without re-creating the document?
* **The Problem**: Libraries like `mammoth` strip formatting when converting DOCX to text. Re-creating a DOCX from text loses tables, margins, fonts, logos, and headers.
* **The Solution (OOXML Zip Manipulation)**: A DOCX file is a compressed `.zip` archive containing XML files (`word/document.xml`, `word/header1.xml`, etc.). Redactify opens the raw `.docx` array buffer using `JSZip`, parses the XML DOM tree, finds `<w:t>` text nodes containing PII using value-based string replacement, replaces PII inside XML text tags, and serializes the modified DOM back into the ZIP container. Visual styling remains 100% identical.

### Q5: How does PDF export preserve visual fidelity while enabling text selection?
* **Dual-Layer Canvas Architecture**:
  1. **Image Layer**: PDF pages are rendered to high-resolution HTML5 canvas elements (2.5x scale). Black redaction boxes and white label text (e.g. `[EMAIL REDACTED]`) are drawn directly onto the canvas pixels, making it visually impossible to uncover redacted content.
  2. **Invisible Text Layer**: On top of the embedded canvas image in `pdf-lib`, non-redacted text is drawn as transparent text (`opacity: 0.01`). At redacted coordinates, the original text is replaced with the redacted label.
* **Security Result**: Original PII text strings are completely wiped from the file binary, while remaining text can still be selected and copied in PDF viewers.

### Q6: How does the payment & license system prevent client-side forgery?
* **Timing-Safe HMAC Signature Verification**: Clients submit `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to `/api/verify`. The server calculates an HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET` and checks it with `crypto.timingSafeEqual` to prevent timing side-channel attacks.
* **Client Encryption**: Validated license keys returned to the browser are encrypted via AES-GCM (Web Crypto API) with a browser-vault seed before being saved into IndexedDB.

---

## 4. Comprehensive File-by-File & Function-by-Function Reference

Below is the complete reference of **every file and function** in the project.

---

### A. Configuration & Infrastructure Files

#### 1. [`package.json`](file:///D:/Projects/Redactify/package.json)
* **Purpose**: Defines dependencies, build scripts, and project metadata.
* **Key Dependencies**:
  * `@xenova/transformers`: In-browser ML pipeline runner (Hugging Face Transformers.js).
  * `pdf-lib`: Pure JavaScript PDF creation and modification library.
  * `pdfjs-dist`: Mozilla's PDF parser for extracting text and rendering pages.
  * `docx`: Programmatic DOCX document generator.
  * `mammoth`: Fast DOCX to raw text extractor.
  * `jszip`: Zip file reader/writer for OOXML manipulation.
  * `dompurify`: XSS sanitizer for HTML mark highlights.
  * `@supabase/supabase-js`: Supabase database client.
  * `react-razorpay`: Razorpay SDK wrapper for payment checkout.

#### 2. [`vite.config.js`](file:///D:/Projects/Redactify/vite.config.js)
* **Purpose**: Vite build tool configuration and Progressive Web App (PWA) setup.
* **Key Sections**:
  * `VitePWA()`: Configures `vite-plugin-pwa` with `workbox` runtime caching. Caches Google Fonts and app shell assets for offline use. Sets `navigateFallbackDenylist` to prevent service worker interception of `/api/` endpoints.
  * `build.rollupOptions.output.manualChunks`: Code splitting setup separating vendor bundles (`react`, `react-dom`), `pdfjs`, and `docx` to optimize initial page load performance.

#### 3. [`vercel.json`](file:///D:/Projects/Redactify/vercel.json)
* **Purpose**: Vercel deployment routing and security header configuration.
* **Key Rules**:
  * `rewrites`: Routes all non-API routes (`/((?!api/).*)`) to `/index.html` for single-page app (SPA) client-side routing.
  * `headers`: Configures security headers including `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, and `Permissions-Policy`.

#### 4. [`index.html`](file:///D:/Projects/Redactify/index.html)
* **Purpose**: HTML entry point containing meta tags, Content Security Policy (CSP), Google Fonts, and JSON-LD Structured Data.
* **Key Features**:
  * **Content-Security-Policy (CSP)**: Strict headers authorizing WASM execution (`wasm-unsafe-eval`), Hugging Face models (`huggingface.co`), Razorpay checkout frames, and Supabase database calls.
  * **Structured Data (JSON-LD)**: Schema.org markup for `SoftwareApplication`, `WebSite`, `HowTo`, and `FAQPage` to enhance SEO and AI search discovery.

---

### B. Core Application & State Files

#### 5. [`src/main.jsx`](file:///D:/Projects/Redactify/src/main.jsx)
* **Purpose**: Application root mounting script.
* **Functions/Logic**:
  * Wraps `<App />` in `<React.StrictMode>` and `<ErrorBoundary>`.
  * Mounts `<Toaster />` from `react-hot-toast` with custom dark-mode styling (`#18181b` background, green/red success/error icons).

#### 6. [`src/App.jsx`](file:///D:/Projects/Redactify/src/App.jsx)
* **Purpose**: Top-level application component managing state, view navigation, dark mode, PII state, modals, and responsive layout.
* **State Variables**:
  * `currentView`: Active view string (`'landing'`, `'redactor'`, or SEO path key).
  * `darkMode`: Boolean controlling dark theme.
  * Modal states: `showPrivacy`, `showProModal`, `showRecovery`, `showBatchProcessor`, `showCustomRules`, `showFeedback`, `showMobileMenu`, `showContact`, `showTerms`, `showRefunds`.
  * PII states: `detectedPII` (array of detected entities), `originalText` (raw string), `uploadedFile` (File reference), `fileType` (mime string), `selectedPIIId` (ID of currently focused entity for bi-directional sync).
  * `isPro`: Boolean indicating verified Pro tier status.
* **Key Functions**:
  * `toggleDarkMode()`: Toggles state, updates `localStorage`, and toggles `.dark` class on `document.documentElement`.
  * `handleGetStarted()`: Switches `currentView` to `'redactor'`.
  * `handleGoToLanding()`: Switches view to `'landing'` and resets text and detection states.
  * `handlePIIDetected(piiItems, text, file, type)`: Callback invoked by `Redactor` when detection completes to populate root state.
  * `handleTogglePII(id)`: Toggles the `redact` boolean flag of a specific entity in `detectedPII`.
  * `handleBulkSetPII(redactValue)`: Sets `redact = redactValue` for all entities in `detectedPII`.
  * `handleSelectPII(id)`: Sets `selectedPIIId` for bi-directional sync between document viewer and sidebar.

---

### C. PII Detection Engine & Worker Utilities

#### 7. [`src/utils/piiDetector.js`](file:///D:/Projects/Redactify/src/utils/piiDetector.js)
* **Purpose**: Core client-side regex detection engine and text extraction handler.
* **Exported Constants**:
  * `PII_TYPES`: Object mapping entity types (`EMAIL`, `PHONE`, `URL`, `NAME`, `ADDRESS`, `SSN`, `CREDIT_CARD`, `DATE_OF_BIRTH`, `PASSPORT`, `IP_ADDRESS`, `BANK_ACCOUNT`, `TAX_ID`, `AGE`, `ORGANIZATION`, `LOCATION`).
  * `PII_REPLACEMENTS`: Object mapping types to default replacement labels (e.g. `[EMAIL REDACTED]`).
  * `PII_COLORS`: Tailwind CSS color classes for UI highlighting per entity type.
* **Exported & Helper Functions**:
  * `extractTextFromInput(input)`: Accepts a `File` or string. Checks file size against limits, dispatches to `readTextFile`, `extractTextFromPDF` (via `pdfjs-dist`), or `extractTextFromDOCX` (via `mammoth`).
  * `extractTextFromPDF(file)`: Loads PDF ArrayBuffer via `pdfjsLib.getDocument`. Iterates through pages, sorts text items by Y and X coordinates to preserve logical reading order, concatenates strings, and cleans up page memory.
  * `extractTextFromDOCX(file)`: Invokes `mammoth.extractRawText` to extract clean text from Word documents.
  * `safeRegexExec(regex, text, timeoutMs = 1500)`: **ReDoS Protection**. Executes regular expressions inside a loop while checking `Date.now()`. Breaks execution if processing exceeds `timeoutMs` to prevent catastrophic backtracking.
  * `detectPII(text)`: Runs all defined regex patterns against `text` using `safeRegexExec`. Applies lightweight `detectHeaderNames()` fallback. Sorts detections by start position and deduplicates overlapping character ranges.
  * `detectHeaderNames(text)`: Lightweight fallback inspecting the first 5 lines for Title Case or ALL CAPS name patterns while ignoring section headers (e.g., "WORK EXPERIENCE").
  * `replacePII(text, selections)`: Takes raw text and user-confirmed PII selections. Filters `redact === true`, sorts ranges **right-to-left** (descending start index), and replaces text to avoid index offset drift.
  * `highlightPII(text, matches)`: Generates sanitized HTML string with `<mark>` tags around detected PII entities. Sanitizes output via `DOMPurify.sanitize`.
  * `getPIIStats(piiItems)`: Returns total count, accepted count, and breakdown counts by type.

#### 8. [`src/workers/transformersPIIWorker.js`](file:///D:/Projects/Redactify/src/workers/transformersPIIWorker.js)
* **Purpose**: Web Worker running Hugging Face Transformers.js `Xenova/bert-base-NER` pipeline for deep learning entity recognition.
* **Logic & Algorithm Breakdown**:
  * `chunkText(text, maxLen = 384)`: Splits text into chunks of at most 384 characters along paragraph (`\n\n`), line (`\n`), or sentence boundaries. Every chunk is an exact substring, preserving absolute text character offsets (`chunk.offset`).
  * `initializeModel()`: Dynamically loads `pipeline('token-classification', 'Xenova/bert-base-NER', { quantized: true })`. Posts `MODEL_LOADING` progress percentages to the main thread.
  * `detectEntities(text)`:
    1. Runs `nerPipeline` over each text chunk.
    2. Maps raw NER tags (`B-PER`, `I-PER`, `B-ORG`, `B-LOC`) to internal categories (`name`, `organization`, `location`).
    3. Merges sub-word tokens (BERT `##` wordpiece tokens) using BIO tag rules.
    4. Extracts exact entity strings directly from original document text using character offset bounds.
    5. `mergeNearbyEntities()`: Merges adjacent same-type entities separated only by whitespace (e.g. "John" + "Smith" -> "John Smith").
    6. `filterFalsePositives()`: Filters out tech stack terms (e.g. "React", "Python", "AWS", "SQL") using an `ORG_BLACKLIST` set and confidence thresholds.
  * `self.addEventListener('message')`: Handles incoming `INIT_MODEL` and `DETECT_PII` messages and replies with `DETECTION_COMPLETE` payloads.

#### 9. [`src/workers/piiDetectionWorker.js`](file:///D:/Projects/Redactify/src/workers/piiDetectionWorker.js)
* **Purpose**: Web Worker wrapper for heavy regex execution on large documents (>5,000 characters) to keep the UI at 60 FPS.

#### 10. [`src/hooks/useTransformersPII.js`](file:///D:/Projects/Redactify/src/hooks/useTransformersPII.js)
* **Purpose**: Custom React hook wrapping the ML Web Worker.
* **Exposed Interface**:
  * `detectPII(text)`: Asynchronous function sending text to the worker via a `Promise` mapped by request ID in `pendingCallbacksRef`. Includes a 30-second timeout guard.
  * `isModelLoaded`, `isModelLoading`, `modelProgress`, `modelError`: Reactive state variables.
  * `isModelCached()`: Inspects `window.caches` and `localStorage` to check if BERT model weights are already saved locally.
  * `initModel()`: Triggers model download and initialization.
  * `clearModelCache()`: Deletes stored model caches from Cache API and resets state.

#### 11. [`src/utils/contextAwareDetection.js`](file:///D:/Projects/Redactify/src/utils/contextAwareDetection.js)
* **Purpose**: Context-aware heuristic analysis that adjusts confidence scores based on surrounding keywords (e.g., proximity to words like "Email:", "Phone:", "Name:", "Address:").

#### 12. [`src/utils/smartDetection.js`](file:///D:/Projects/Redactify/src/utils/smartDetection.js)
* **Purpose**: Combines results from Regex detectors, ML workers, custom rules, and context analyzers, deduplicating overlaps and resolving entity conflicts.

---

### D. Export Engine Utilities

#### 13. [`src/utils/exportUtils.js`](file:///D:/Projects/Redactify/src/utils/exportUtils.js)
* **Purpose**: Core document exporter producing `.txt`, `.docx`, and `.pdf` files.
* **Exported Functions**:
  * `exportAsTXT(text, originalFilename)`: Creates a plain text `Blob` and triggers browser download via `downloadBlob()`.
  * `exportAsDOCX(text, originalFilename, originalFile, piiItems)`:
    * **Strategy 1 (Format-Preserving)**: If `originalFile` is a DOCX, unzips it using `jszip`. Locates text-bearing XML files (`word/document.xml`, headers, footers). Runs `applyRedactionsToXML()`, performing value-based string replacement across `<w:t>` text nodes while preserving all original OOXML styling, fonts, tables, and images. Re-packs ZIP and downloads.
    * **Strategy 2 (Text Fallback)**: Uses `buildFormattedParagraphs()` to construct a new Word document using `docx` package primitives with section headings (`SECTION_RE`), bullet points, and margins.
  * `exportAsPDF(text, uploadedFile, piiItems, isPro, originalFilename)`:
    * **Strategy 1 (Format-Preserving Image + Copyable Text Layer)**: If `uploadedFile` is a PDF, renders each page to an offscreen `<canvas>` at 2.5x resolution using `pdfjs-dist`. Draws solid `#111111` black redaction boxes and white label text over PII pixels. Embeds canvas JPEG into a new PDF via `pdf-lib`. Overlays invisible transparent text (`opacity: 0.01`) so non-PII text remains selectable while PII text is permanently overwritten.
    * **Strategy 2 (Text Fallback)**: Builds a new PDF page layout from scratch using `pdf-lib` standard fonts (`Helvetica`, `HelveticaBold`), measuring word widths (`widthOfTextAtSize`) for dynamic line-wrapping and page breaks.

#### 14. [`src/utils/batchExportUtils.js`](file:///D:/Projects/Redactify/src/utils/batchExportUtils.js)
* **Purpose**: Pro-tier batch processing utility that processes multiple files concurrently and packages them into a single downloaded `.zip` archive using `JSZip`.

#### 15. [`src/utils/fileHelpers.js`](file:///D:/Projects/Redactify/src/utils/fileHelpers.js)
* **Purpose**: Helper functions for reading file array buffers, formatting file sizes, and verifying extension types.

---

### E. Storage, Compatibility & Monetization Utilities

#### 16. [`src/utils/customRulesDB.js`](file:///D:/Projects/Redactify/src/utils/customRulesDB.js)
* **Purpose**: IndexedDB storage engine for custom user regex rules, with `localStorage` fallback.
* **Exported Functions**:
  * `addCustomRule(rule)`: Saves rule object (`name`, `pattern`, `replacement`, `description`, `enabled`).
  * `getAllCustomRules()` / `getEnabledCustomRules()`: Retrieves rule records from IndexedDB object store `customRules`.
  * `updateCustomRule(id, updates)` / `deleteCustomRule(id)` / `toggleCustomRule(id)`: Modifies or deletes rules.
  * `applyCustomRules(text, rules)`: Executes enabled custom regex rules against input text with ReDoS timeout protection.

#### 17. [`src/utils/proLicenseDB.js`](file:///D:/Projects/Redactify/src/utils/proLicenseDB.js)
* **Purpose**: Secure IndexedDB storage engine for Pro tier license keys with Web Crypto API encryption.
* **Encryption Algorithm**:
  * `getEncryptionKey()`: Derives a 256-bit AES-GCM key from a stable salt (`redactify_vault_salt`) using `crypto.subtle.digest('SHA-256')`.
  * `encryptData(data)`: Encrypts JSON string with AES-GCM and a random 12-byte IV using `crypto.subtle.encrypt()`. Returns base64 string.
  * `decryptData(encryptedBase64)`: Decrypts payload using `crypto.subtle.decrypt()`.
* **Exported Functions**:
  * `storeProKey(licenseData)`: Encrypts license record and saves to IndexedDB object store `proLicense` (or `localStorage` in private browser modes).
  * `getProKey()`: Decrypts and returns license payload.
  * `verifyProStatus()`: Asynchronous check returning boolean `isPro` status.
  * `deleteProKey()`: Removes license key (used during testing or key revocation).

#### 18. [`src/utils/supabaseLicense.js`](file:///D:/Projects/Redactify/src/utils/supabaseLicense.js)
* **Purpose**: Supabase client wrapper for validating and retrieving licenses from the remote Supabase database.

#### 19. [`src/utils/browserCompat.js`](file:///D:/Projects/Redactify/src/utils/browserCompat.js)
* **Purpose**: Feature detection utility checking browser support for IndexedDB, Web Workers, Web Assembly, and Web Crypto API. Provides `localStorageFallback` methods when IndexedDB is blocked.

#### 20. [`src/utils/toast.js`](file:///D:/Projects/Redactify/src/utils/toast.js)
* **Purpose**: Utility wrapper around `react-hot-toast` for consistent toast notifications (`showSuccess`, `showError`, `showInfo`).

---

### F. Vercel Serverless Backend API Endpoints

#### 21. [`api/lib/rateLimit.js`](file:///D:/Projects/Redactify/api/lib/rateLimit.js)
* **Purpose**: In-memory token-bucket rate limiter for serverless endpoints to prevent brute-force attacks and abuse.
* **Functions**:
  * `createRateLimiter(windowMs, max)`: Creates a rate limiter instance tracking client IPs.
  * `getClientIp(req)`: Extracts IP address from `x-forwarded-for` or `x-real-ip` headers.
  * `applyRateLimit(req, res, limiter, max)`: Checks request count and returns HTTP `429 Too Many Requests` when limits are exceeded.

#### 22. [`api/create-order.js`](file:///D:/Projects/Redactify/api/create-order.js)
* **Endpoint**: `POST /api/create-order`
* **Purpose**: Creates a Razorpay order for the Pro tier license (₹1,599 / ~$19 USD).
* **Logic**: Initializes `Razorpay` SDK with `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Creates an order with currency `INR` and receipt ID. Returns `orderId`, `amount`, and `currency`.

#### 23. [`api/verify.js`](file:///D:/Projects/Redactify/api/verify.js)
* **Endpoint**: `POST /api/verify`
* **Purpose**: Cryptographically verifies Razorpay payment completion and issues license key.
* **Logic**:
  1. Validates CORS origin.
  2. Applies rate limiting (5 req/min/IP).
  3. Computes HMAC-SHA256 signature over `${razorpay_order_id}|${razorpay_payment_id}` using `RAZORPAY_KEY_SECRET`.
  4. Compares generated signature with `razorpay_signature` using `crypto.timingSafeEqual` to prevent timing side-channel attacks.
  5. Checks Supabase for existing payment record (idempotency check).
  6. Generates new license key string (`RDCT-TIMESTAMP-RANDOM`).
  7. Inserts license record into Supabase `pro_licenses` table. Returns license payload to client.

#### 24. [`api/save-license-email.js`](file:///D:/Projects/Redactify/api/save-license-email.js)
* **Endpoint**: `POST /api/save-license-email`
* **Purpose**: Associates a customer's email address with their purchased license key in Supabase for license recovery.

#### 25. [`api/send-recovery-code.js`](file:///D:/Projects/Redactify/api/send-recovery-code.js)
* **Endpoint**: `POST /api/send-recovery-code`
* **Purpose**: Sends a 6-digit OTP code to the user's email via Resend API to initiate license key recovery.

#### 26. [`api/verify-recovery-code.js`](file:///D:/Projects/Redactify/api/verify-recovery-code.js)
* **Endpoint**: `POST /api/verify-recovery-code`
* **Purpose**: Verifies submitted OTP code and returns associated Pro license key.

#### 27. [`api/recover-by-payment.js`](file:///D:/Projects/Redactify/api/recover-by-payment.js)
* **Endpoint**: `POST /api/recover-by-payment`
* **Purpose**: Alternative license recovery mechanism using Razorpay Payment ID or Order ID.

#### 28. [`api/send-feedback.js`](file:///D:/Projects/Redactify/api/send-feedback.js)
* **Endpoint**: `POST /api/send-feedback`
* **Purpose**: Sends user feedback submissions via Resend email service to project maintainers.

---

### G. UI Components

#### 29. [`src/components/Redactor.jsx`](file:///D:/Projects/Redactify/src/components/Redactor.jsx)
* **Purpose**: Core document editor workspace component.
* **Features**: Drag-and-drop file upload zone, plain text editor textarea, document type selector, detection trigger buttons, BERT ML model load status banner (`isModelLoading`, `modelProgress`), and `<DocumentViewer />` toggle.

#### 30. [`src/components/Sidebar.jsx`](file:///D:/Projects/Redactify/src/components/Sidebar.jsx)
* **Purpose**: Interactive control panel displaying detected PII entities.
* **Features**: Filter tabs (All, Email, Phone, Name, etc.), bulk select/deselect controls, entity cards with toggle switches, search filter input, and download export action buttons (TXT, DOCX, PDF).

#### 31. [`src/components/DocumentViewer.jsx`](file:///D:/Projects/Redactify/src/components/DocumentViewer.jsx)
* **Purpose**: Highlighting preview viewer displaying text with `<mark>` tags around detected PII.
* **Features**: Clickable highlight marks that trigger bi-directional state selection (`onSelectPII`), scroll alignment to selected entity, and dark-mode styling.

#### 32. [`src/components/BatchProcessor.jsx`](file:///D:/Projects/Redactify/src/components/BatchProcessor.jsx)
* **Purpose**: Pro-tier modal for batch processing multiple documents simultaneously.
* **Features**: Multi-file drop zone, progress bar per file, batch anonymization worker execution, and bulk `.zip` download.

#### 33. [`src/components/CustomRulesManager.jsx`](file:///D:/Projects/Redactify/src/components/CustomRulesManager.jsx)
* **Purpose**: Pro-tier modal for creating, testing, editing, toggling, and deleting custom regex rules.

#### 34. [`src/components/ProModal.jsx`](file:///D:/Projects/Redactify/src/components/ProModal.jsx)
* **Purpose**: Razorpay checkout modal displaying feature comparisons, pricing (₹1,599), and triggering Razorpay SDK payment sheet.

#### 35. [`src/components/LicenseRecovery.jsx`](file:///D:/Projects/Redactify/src/components/LicenseRecovery.jsx)
* **Purpose**: Modal allowing users to recover lost Pro licenses via Email OTP or Razorpay Payment ID.

#### 36. [`src/components/Landing.jsx`](file:///D:/Projects/Redactify/src/components/Landing.jsx)
* **Purpose**: Main marketing landing page with hero banner, live interactive redaction demo preview, feature grid, pricing table, FAQs, and footer.

#### 37. [`src/components/SeoLandingPages.jsx`](file:///D:/Projects/Redactify/src/components/SeoLandingPages.jsx)
* **Purpose**: Programmatic SEO page generator producing dynamic landing pages tailored for specific search queries (e.g. "PDF Redactor", "Resume Anonymizer", "HIPAA Redactor").

#### 38. Additional UI Components:
* `About.jsx`: Mission statement and technical privacy architecture overview.
* `Blog.jsx`: Educational blog articles on privacy compliance, blind hiring, and GDPR.
* `FAQ.jsx`: Accordion component for common user questions.
* `Contact.jsx`: Contact form modal.
* `Terms.jsx` / `Refunds.jsx` / `Privacy.jsx` / `PrivacyModal.jsx`: Legal policy views and privacy commitment modals.
* `BrowserCompatWarning.jsx`: Top banner warning users if browser lacks Web Worker or WASM support.
* `CookieBanner.jsx`: GDPR cookie consent banner storing preferences in `localStorage`.
* `FeedbackModal.jsx`: Modal for submitting feedback.
* `MobileMenu.jsx`: Slide-out menu for mobile viewports.
* `NotFound.jsx`: 404 error page.
* `ProComparison.jsx`: Visual feature comparison table between Free and Pro tiers.
* `UseCaseDeepDives.jsx`: Detailed workflow guides for HR recruiters, candidates, and legal teams.
* `ErrorBoundary.jsx`: React error boundary catching render crashes and offering a clean reload button.

---

## 5. Technical Deep Dives for High-Level Technical Rounds

### 1. ReDoS (Regular Expression Denial of Service) Mitigation
Regular expressions with overlapping quantifiers (e.g., `(a+)+`) can cause exponential backtracking on non-matching inputs, freezing the thread. Redactify mitigates this in `piiDetector.js` and `customRulesDB.js` using `safeRegexExec()`, which checks execution time against a threshold (`Date.now() - startTime > 1500ms`) and breaks the loop gracefully.

### 2. Double-Replacement Offset Shift Avoidance
When modifying strings based on character index ranges (`start` and `end`), replacing an early occurrence shifts all subsequent indices. Redactify resolves this in `replacePII()` by sorting ranges **in descending order (right-to-left)**:
```javascript
const accepted = selections
  .filter(item => item.redact)
  .sort((a, b) => b.start - a.start); // Right to left
```

### 3. XML DOM Manipulation for DOCX Export
Instead of regex-replacing raw XML strings (which risks breaking XML tag syntax like `<w:t class="...">`), Redactify uses `DOMParser` to parse `word/document.xml` into a real XML DOM tree. It queries all `<w:t>` elements via `getElementsByTagNameNS`, performs substring matching on `node.textContent`, and serializes back using `XMLSerializer`.

---

## 6. Interview Emergency Cheat Sheet (Quick Refresh)

* **Project Name**: Redactify (Resume Redactor)
* **Core Value**: 100% Client-side document anonymization (Zero uploads).
* **Tech Stack**: React 18, Vite 5, Tailwind CSS, Lucide React, Web Workers.
* **ML Stack**: Transformers.js (`@xenova/transformers`), ONNX Runtime Web, `Xenova/bert-base-NER` model.
* **Parsing Libraries**: `pdfjs-dist` (PDF text & coordinates), `mammoth` (DOCX text), `FileReader` (TXT).
* **Export Libraries**: `pdf-lib` (PDF manipulation), `docx` (Word generation), `jszip` (OOXML modification).
* **Security & Storage**: Web Crypto API (`AES-GCM` 256-bit + `SHA-256`), IndexedDB, timing-safe HMAC-SHA256 verification (`crypto.timingSafeEqual`).
* **Backend**: Vercel Serverless Functions (`/api/verify`, `/api/create-order`), Supabase DB, Razorpay API.

---
*Good luck with your interview! You have complete technical mastery over this codebase.*
