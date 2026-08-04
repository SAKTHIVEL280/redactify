import React from 'react';
import { ArrowRight, Shield, Check, Lock, Zap, FileText, Cpu, EyeOff, Award } from 'lucide-react';

export const SEO_PAGES_DATA = {
  'offline-redactor': {
    title: 'Offline AI Document Redactor',
    subtitle: '100% Local & Private PII Removal Without Internet Connection',
    h1: 'The #1 Offline AI Redactor for PDF, DOCX & Resumes',
    metaDesc: 'Redact PII from resumes, PDFs, and Word documents 100% offline in your browser. Zero server uploads, local BERT AI engine, complete privacy.',
    badge: 'Offline PWA Engine',
    description: 'Redactify is an offline AI redactor that processes all document parsing, PII detection, and file exports directly inside your browser using Web Workers and local WASM modules. Your files never touch any cloud or server.',
    features: [
      'Works 100% offline without active internet connection',
      'Local BERT Named Entity Recognition for automatic PII detection',
      'Zero server upload latency & absolute zero remote data retention',
      'Supports PDF, Microsoft Word (.docx), and plain text (.txt)',
      'Format-preserving export with copyable non-PII text layer'
    ],
    faqs: [
      {
        q: 'How does Redactify work offline?',
        a: 'Redactify uses Progressive Web App (PWA) technology to cache all application code, local BERT NER machine learning models, and rendering engines in your browser. Once loaded, you can disconnect from the internet and redact documents offline.'
      },
      {
        q: 'Are my confidential documents uploaded to any remote server?',
        a: 'No. Document parsing, PII detection, and file rendering happen 100% inside your device memory.'
      }
    ]
  },
  'online-redactor': {
    title: 'Online AI Document Redactor',
    subtitle: 'Instant Cloudless In-Browser Document Anonymizer',
    h1: 'Instant Online AI Redactor Tool for Resumes & Contracts',
    metaDesc: 'Free online AI redactor tool. Automatically redact sensitive PII from PDFs and Word files in your browser. Instant, private, zero server uploads.',
    badge: 'In-Browser AI Engine',
    description: 'Redactify is an instant online AI redactor that brings enterprise-grade PII detection to your browser. Sanitize resumes, legal contracts, NDAs, and healthcare records in seconds without sending sensitive data to cloud servers.',
    features: [
      'Instant in-browser AI PII detection in under 50ms',
      'Automatically redacts names, emails, phones, SSNs, and addresses',
      'Format-preserving PDF and DOCX export options',
      'Custom regex rules for company codenames and project identifiers',
      'Compliant with GDPR Article 25 (Privacy by Design) and CCPA'
    ],
    faqs: [
      {
        q: 'Is this online redactor free to use?',
        a: 'Yes! Redactify offers a free tier with full PII detection and plain text export. A one-time Pro license unlocks format-preserving PDF and DOCX exports.'
      },
      {
        q: 'How does it compare to cloud-based online redactor services?',
        a: 'Unlike traditional cloud redactors that upload your sensitive documents to remote servers, Redactify runs entirely inside your browser client memory, guaranteeing 100% data confidentiality.'
      }
    ]
  },
  'ai-redactor': {
    title: 'AI Document Redactor & Anonymizer',
    subtitle: 'Powered by Local BERT Named Entity Recognition',
    h1: 'Next-Generation AI Redactor for Automatic PII Removal',
    metaDesc: 'AI-powered document redactor that runs BERT NER locally in your browser. Automatically detect and redact PII from PDF, DOCX, and TXT files.',
    badge: 'BERT NER AI',
    description: 'Redactify leverages state-of-the-art Transformer machine learning models running locally via ONNX Runtime Web. It automatically identifies complex context-based PII like personal names, organization names, and geographic locations.',
    features: [
      'Transformer-based BERT Named Entity Recognition (NER)',
      'Dual-layer detection: Rule-based regex + Deep learning NLP',
      'Highlights names, emails, phones, locations, SSNs, and credit cards',
      'Bi-directional sync between document canvas and PII sidebar',
      'Zero AI server API calls — model executes 100% in local Web Workers'
    ],
    faqs: [
      {
        q: 'Does the AI model require sending text to OpenAI or external APIs?',
        a: 'No. The AI model runs completely on your local device using ONNX Runtime Web Assembly inside isolated browser Web Workers.'
      }
    ]
  },
  'local-redactor-ai': {
    title: 'Local AI PII Eraser & Redactor',
    subtitle: 'Zero-Trust Local Execution Engine',
    h1: 'Local Redactor AI: Complete Data Containment',
    metaDesc: 'Local redactor AI for confidential documents. Process sensitive PII 100% locally on your computer. Zero server uploads, total privacy.',
    badge: 'Local-First Architecture',
    description: 'Local Redactor AI ensures zero-trust document sanitization. Designed for HR recruiters, legal teams, healthcare professionals, and privacy-conscious workers who require absolute local data containment.',
    features: [
      'Zero-trust local browser execution',
      'Full compliance with HIPAA Privacy Rule and GDPR Article 32',
      'Bulk batch document processing for enterprise teams',
      'Protects confidential client names, salaries, and financial data',
      'No account creation or cloud database storage required'
    ],
    faqs: [
      {
        q: 'Why choose a local redactor AI over cloud services?',
        a: 'Cloud services pose severe data breach and privacy compliance risks when handling sensitive PII. A local redactor AI guarantees your data never leaves your device.'
      }
    ]
  },
  'resume-anonymizer': {
    title: 'AI Resume Anonymizer & Sanitizer',
    subtitle: 'Blind Hiring & Candidate Privacy Tool',
    h1: 'AI Resume Anonymizer: Remove PII for Blind Recruitment',
    metaDesc: 'Free AI resume anonymizer tool. Automatically remove candidate names, contact details, emails, and addresses from resumes for unbiased hiring.',
    badge: 'Blind Hiring Tool',
    description: 'Redactify is the ultimate AI resume anonymizer. Remove unconscious bias from hiring pipelines by automatically redacting candidate names, contact details, graduation dates, and personal links while preserving professional skills and achievements.',
    features: [
      'Automated removal of names, phone numbers, emails, and home addresses',
      'Redacts quasi-identifiers like graduation years and niche locations',
      'Preserves original resume layout, fonts, and section formatting',
      'Batch processing for reviewing hundreds of applicant resumes',
      'Generates clean PDFs with copyable non-PII text for ATS systems'
    ],
    faqs: [
      {
        q: 'How does resume anonymization support blind recruitment?',
        a: 'By stripping personal identifiers before candidate evaluation, recruitment teams eliminate gender, ethnic, and age bias, focusing purely on candidate qualifications.'
      }
    ]
  },
  'pdf-redaction-tool': {
    title: 'Local PDF Redaction & Blackout Tool',
    subtitle: 'Permanent Visual & Layer-Level Redaction',
    h1: 'Privacy-First Local PDF Redaction Tool',
    metaDesc: 'Redact PDF files locally in your browser. Burnt-in black redaction boxes with copyable non-PII text layer. Zero uploads, 100% private.',
    badge: 'PDF Render Engine',
    description: 'Redactify provides enterprise-grade PDF redaction directly in your browser. Pages are rendered with permanent black redaction boxes burnt into the visual image layer, while non-sensitive text remains fully copyable.',
    features: [
      'Permanent burnt-in black redaction boxes (industry standard)',
      'Transparent non-PII text layer for Ctrl+C / Ctrl+V support',
      'Prevents data leaks from hidden text or metadata residual layers',
      'High-resolution 2.5x rendering quality',
      'Fast client-side PDF generation via PDF-Lib and Canvas'
    ],
    faqs: [
      {
        q: 'Is text behind the black redaction boxes recoverable in exported PDFs?',
        a: 'No. Redactify burns black redaction boxes directly into the visual image layer and removes sensitive text from the underlying text layer, making recovery impossible.'
      }
    ]
  },
  'docx-redactor': {
    title: 'Word Document (DOCX) Redactor',
    subtitle: 'Format-Preserving OOXML XML Redaction Engine',
    h1: 'Format-Preserving Word (.docx) Redactor',
    metaDesc: 'Redact Microsoft Word (.docx) files locally. Preserves original document structure, tables, fonts, and headings with PII removed.',
    badge: 'OOXML Format Engine',
    description: 'Redactify features a specialized OOXML format engine that edits Microsoft Word (.docx) documents in-place. It replaces PII strings inside underlying XML parts without losing fonts, margins, tables, or headings.',
    features: [
      'In-place XML search and replacement inside .docx ZIP archives',
      'Preserves complex tables, headings, footnotes, and headers',
      'Value-based fallback matching for offset drift resistance',
      'Processes footnotes, endnotes, and body paragraphs',
      'Instant client-side DOCX export'
    ],
    faqs: [
      {
        q: 'Does DOCX redaction lose original formatting?',
        a: 'No! Redactify performs value-based XML edits directly inside the document package, preserving all bold styles, fonts, margins, and headings.'
      }
    ]
  },
  'free-pii-removal': {
    title: 'Free PII Removal & Data Sanitizer',
    subtitle: 'GDPR, CCPA & HIPAA Compliant Data Protection',
    h1: 'Free PII Removal Engine for Privacy Compliance',
    metaDesc: 'Free PII removal tool for documents. Automatically detect and strip SSNs, credit cards, phones, emails, and names with zero server uploads.',
    badge: 'GDPR & HIPAA Compliant',
    description: 'Redactify simplifies regulatory compliance by providing free, zero-upload PII removal. Easily sanitize documents to meet GDPR Article 25 (Privacy by Design), CCPA, and HIPAA Privacy Rule requirements.',
    features: [
      'Detects US SSN, UK NINO, EU IBAN, Canadian SIN, Australian TFN, and Indian Aadhaar/PAN',
      'Strips credit cards, bank accounts, dates of birth, and passport numbers',
      'Custom regex rule manager for organization-specific identifiers',
      'Export detailed audit change summary logs',
      '100% free core tier with full PII detection capabilities'
    ],
    faqs: [
      {
        q: 'How does Redactify help with GDPR compliance?',
        a: 'By processing all data locally in the user browser and never storing or transmitting document content, Redactify fulfills Privacy by Design (Art 25) and Data Security (Art 32) mandates.'
      }
    ]
  }
};

export default function SeoLandingPage({ pageKey, onGetStarted, onNavigate }) {
  const data = SEO_PAGES_DATA[pageKey] || SEO_PAGES_DATA['offline-redactor'];

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans antialiased selection:bg-red-500 selection:text-white pt-24 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono mb-6">
          <Zap className="w-3.5 h-3.5" />
          <span>{data.badge}</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-6 leading-[1.1]">
          {data.h1}
        </h1>
        <p className="text-xl text-zinc-400 font-light mb-10 leading-relaxed max-w-3xl">
          {data.description}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-4 mb-16">
          <button
            onClick={onGetStarted}
            className="px-8 py-4 bg-white text-black hover:bg-zinc-200 font-bold rounded-full transition-all flex items-center gap-3 group shadow-[0_0_30px_rgba(255,255,255,0.15)]"
          >
            <span>Start Redacting Now</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => onNavigate && onNavigate('privacy')}
            className="px-8 py-4 bg-zinc-900 border border-white/10 text-white hover:bg-zinc-800 font-medium rounded-full transition-all font-mono text-sm"
          >
            100% Local Privacy
          </button>
        </div>

        {/* Key Features Grid */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">Key Capabilities & Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.features.map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-red-400" />
                </div>
                <span className="text-zinc-300 font-medium text-sm leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Targeted FAQs */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {data.faqs.map((faq, i) => (
              <div key={i} className="p-6 rounded-2xl border border-white/10 bg-zinc-900/40">
                <h3 className="text-lg font-bold text-white mb-2">{faq.q}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Related Keyword Navigation Footer */}
        <div className="border-t border-white/10 pt-10">
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">Explore More Redaction Solutions</h3>
          <div className="flex flex-wrap gap-3">
            {Object.keys(SEO_PAGES_DATA).map((key) => (
              <button
                key={key}
                onClick={() => window.location.pathname = `/${key}`}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all ${
                  pageKey === key
                    ? 'bg-red-500 text-white font-bold'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-white'
                }`}
              >
                /{key}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
