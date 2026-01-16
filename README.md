# Resume Redactor - Privacy-First Document Anonymizer

![Resume Redactor](https://img.shields.io/badge/PWA-Ready-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Vite](https://img.shields.io/badge/Vite-5-646cff)
![License](https://img.shields.io/badge/License-MIT-green)

A browser-based, privacy-first tool that detects and removes personally identifiable information (PII) from resumes and documents **entirely on the client side**, with zero uploads to servers.

**🆕 Now with Pro Tier:** DOCX/PDF export, ad-free experience, and advanced features via Razorpay payment integration!

## 🚀 Quick Start

### Development Mode
```bash
npm install
npm run dev
```
Open http://localhost:5174 (or the port shown in terminal)

### Production Build
```bash
npm run build
npm run preview
```

## 🌟 Features

### V1.1 - Monetization & PWA Update
- ✅ **Razorpay Pro Integration** - ₹1,599 one-time payment (~$19 USD)
- ✅ **DOCX/PDF Export** - Pro tier feature using `docx` and `pdf-lib`
- ✅ **IndexedDB License Storage** - Pro keys stored locally
- ✅ **GDPR Cookie Banner** - Granular consent for cookies
- ✅ **Enhanced PWA** - Offline support, install prompt, service worker
- ✅ **Payment APIs** - Vercel Edge Functions for order creation/verification

### V1 Core Features
- ✅ **100% Browser-Only Processing** - Your data never leaves your device
- ✅ **Smart PII Detection** - Automatically identifies:
  - Email addresses
  - Phone numbers
  - URLs (LinkedIn, GitHub, etc.)
  - Names (common patterns)
  - Physical addresses
- ✅ **Interactive Review** - Preview and toggle which items to redact
- ✅ **Real-time Highlighting** - See detected PII highlighted in your document
- ✅ **Free TXT Export** - Download anonymized documents (always free)
- ✅ **Dark/Light Mode** - Easy on the eyes, day or night
- ✅ **Progressive Web App (PWA)** - Install and use offline
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile

## 💰 Pricing

| Feature | Free | Pro (₹1,599) |
|---------|------|--------------|
| PII Detection | ✅ Unlimited | ✅ Unlimited |
| TXT Export | ✅ Yes | ✅ Yes |
| DOCX Export | ❌ No | ✅ Yes |
| PDF Export | ❌ No | ✅ Yes |
| Ads | 3 slots | ✅ Ad-free |

**Pro is a one-time payment with lifetime access!**

### Prerequisites
- Node.js 16+ and npm/yarn/pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/resume-redactor.git
cd resume-redactor

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📦 Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

The build output will be in the `dist/` folder, ready for deployment.

## 🧪 Testing

### Run Test Suite
Open browser console and run:
```javascript
// Auto-available in dev mode
window.runPIITests()
```

Or import the test file:
```javascript
import runTests from './tests/piiDetector.test.js';
await runTests();
```

### Manual Testing
1. Click "Load Sample" to test with pre-filled resume
2. Paste custom text with PII
3. Toggle detections in sidebar
4. Export and verify anonymization

## 🔧 Phase 1 PII Detection Engine

### Core Functions

```javascript
import { 
  extractTextFromInput,  // File/text → plain string
  detectPII,             // Text → PII detections array
  replacePII,            // Text + selections → anonymized text
  highlightPII           // Text + matches → HTML preview
} from './utils/piiDetector';
```

### Example Usage

```javascript
// 1. Extract text from file
const file = document.querySelector('input[type=file]').files[0];
const text = await extractTextFromInput(file);

// 2. Detect PII
const detections = detectPII(text);
// Returns: [{ 
//   id: 'pii-0',
//   type: 'email', 
//   match: 'john@email.com',
//   start: 10,
//   end: 24,
//   suggested: '[email redacted]',
//   confidence: 1.0,
//   accepted: true 
// }, ...]

// 3. Generate preview with highlights
const previewHTML = highlightPII(text, detections);
document.getElementById('preview').innerHTML = previewHTML;

// 4. Apply anonymization
const anonymized = replacePII(text, detections);

// 5. Download
exportAsText(anonymized, 'redacted.txt');
```

### Detection Patterns

| Type | Pattern | Examples |
|------|---------|----------|
| **Email** | `/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi` | john@email.com, sarah.jones@company.co.uk |
| **Phone** | `/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g` | 555-123-4567, 555.123.4567, 5551234567 |
| **URL** | Complex pattern | linkedin.com/in/john, https://github.com/user |
| **Name** | 3 algorithms (common names, headers, singles) | John Smith, Jane Doe |
| **Address** | `/\b\d+\s+[A-Z][a-z]+...(Street\|Ave)\b/gi` | 123 Main Street, 456 Oak Avenue |

### Web Worker Performance

For documents **>5000 characters**, detection automatically offloads to a Web Worker:
- ✅ Prevents UI blocking
- ✅ Automatic fallback to main thread
- ✅ 10-second timeout protection

Enable in development:
```bash
VITE_USE_WORKER=true npm run dev
```

### Documentation

- **[PII_DETECTION_ENGINE.md](docs/PII_DETECTION_ENGINE.md)** - Complete technical documentation
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Implementation checklist

## 📦 Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

The build output will be in the `dist/` folder, ready for deployment.

## 🌐 Deploy to Vercel

### Option 1: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy
vercel

# Or deploy to production directly
vercel --prod
```

### Option 2: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your repository
5. Vercel auto-detects Vite - just click "Deploy"

### Environment Variables
No environment variables needed! Everything runs client-side.

## 📁 Project Structure

```
resume-redactor/
├── public/
│   ├── pwa-192x192.png      # PWA icon (192px)
│   ├── pwa-512x512.png      # PWA icon (512px)
│   ├── vite.svg             # Favicon
│   └── offline.html         # Offline fallback page
├── src/
│   ├── components/
│   │   ├── Landing.jsx      # Landing page with hero & use cases
│   │   ├── Redactor.jsx     # Main redactor interface
│   │   ├── Sidebar.jsx      # PII list & export controls
│   │   └── Privacy.jsx      # Privacy policy modal
│   ├── utils/
│   │   └── piiDetector.js   # Core PII detection engine
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # React entry point
│   └── index.css            # Global styles
├── index.html               # HTML entry point
├── vite.config.js           # Vite configuration
├── package.json             # Dependencies
└── README.md                # This file
```

## 🛠️ Technology Stack

- **Frontend Framework:** React 18
- **Build Tool:** Vite 5
- **Styling:** Tailwind CSS (CDN)
- **Icons:** Lucide React
- **PWA:** vite-plugin-pwa
- **Deployment:** Vercel-ready

## 🔒 Privacy & Security

### How It Works
1. **No Server Uploads** - All processing happens in your browser using JavaScript
2. **No Database** - We don't have servers to store your data
3. **No Tracking** - Your document content is never logged or analyzed
4. **Offline Capable** - Install as PWA and use without internet

### Technical Implementation
- **PII Detection:** Regex-based pattern matching (client-side)
- **Storage:** Browser memory only (cleared on refresh)
- **Export:** Generated using Blob API (pure client-side)
- **Network:** Zero requests containing document data

### Verification
Open your browser's DevTools (F12) → Network tab and watch—no document uploads occur.

## 🎯 Use Cases

### For Recruiters & HR Teams
- Run blind hiring pipelines
- Anonymize candidate pools
- GDPR/compliance-ready workflows
- Reduce unconscious bias

### For Job Seekers
- Share resumes publicly in portfolios
- Post in online communities safely
- Get feedback without privacy concerns

### For Freelancers & Consultants
- Redact client names from case studies
- Protect NDA-covered information
- Share work samples publicly

## 📊 Supported PII Types

| Type | Examples | Replacement |
|------|----------|-------------|
| Email | john@example.com | [email redacted] |
| Phone | (555) 123-4567 | [phone redacted] |
| URL | linkedin.com/in/john | [URL redacted] |
| Name | John Smith | Candidate A |
| Address | 123 Main St | [address redacted] |
| Location | California, CA | [location] |

## 🐛 Known Limitations (v1)

- Text input only (PDF/DOCX support in v1.1)
- Single document at a time (batch in Pro)
- Basic name detection (common names only)
- No custom redaction rules (Pro feature)

## 🗺️ Roadmap

### v1.1 (Q1 2025)
- [ ] PDF file upload support
- [ ] DOCX file upload support
- [ ] Improved name detection (ML-based)
- [ ] Company name detection

### v2.0 (Q2 2025)
- [ ] Pro tier launch
- [ ] Batch processing
- [ ] Custom redaction rules
- [ ] DOCX/PDF export
- [ ] Template replacements (e.g., "Company X" → "Tech Firm")

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/resume-redactor/issues)
- **Email:** support@resumeredactor.com
- **Privacy Questions:** privacy@resumeredactor.com

## 🙏 Acknowledgments

- Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/)
- Icons by [Lucide](https://lucide.dev/)
- Inspired by privacy-first tools and the blind hiring movement

---

**Built with ❤️ for privacy-conscious professionals**

[🌐 Live Demo](https://resume-redactor.vercel.app) | [📖 Documentation](https://docs.resumeredactor.com) | [🐦 Twitter](https://twitter.com/resumeredactor)
