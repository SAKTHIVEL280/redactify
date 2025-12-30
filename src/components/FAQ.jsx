import React from 'react';

export default function FAQ() {
  const faqs = [
    {
      q: 'How does the redactor keep my data local?',
      a: 'All parsing, detection, and redaction happen in your browser using Web Workers. No files or text are uploaded to any server. Network requests are limited to optional license verification and do not include document content.',
    },
    {
      q: 'What counts as PII in resumes?',
      a: 'Emails, phone numbers, full addresses, personal social profiles, government IDs, and trackable links are PII. We also highlight quasi-identifiers such as exact graduation years and niche locations so you can decide whether to keep or redact them.',
    },
    {
      q: 'Can I use the tool offline?',
      a: 'Yes. The PWA works offline once installed. PII detection models and rules are shipped with the app, so redaction continues to function without connectivity.',
    },
    {
      q: 'Is the Pro version still privacy-first?',
      a: 'Yes. Pro unlocks DOCX/PDF export and batch features but keeps all processing local. License checks use lightweight API calls without sending document data.',
    },
    {
      q: 'How accurate is the PII detection?',
      a: 'We combine pattern-based detection for emails, phones, URLs, and addresses with heuristics for names. You can toggle any finding on or off before export to keep full control.',
    },
    {
      q: 'What file types are supported?',
      a: 'TXT is fully supported in all tiers. DOCX and PDF exports are available in Pro. Drag-and-drop and paste flows are optimized for common job-search documents.',
    },
    {
      q: 'Do you store analytics or cookies?',
      a: 'Only minimal, consent-based analytics are stored in localStorage if you accept analytics cookies. We do not collect or transmit browsing behavior. Ads are shown only after meaningful content is present and consent is granted.',
    },
    {
      q: 'How do I remove hidden metadata?',
      a: 'Before exporting, we strip common metadata fields where supported. For PDFs, we recommend printing to PDF from the exported DOCX or using a PDF metadata cleaner for extra assurance.',
    },
    {
      q: 'Can I share case studies safely?',
      a: 'Yes. Replace client names with descriptors, remove contact details, and redact URLs that include tracking. Use our custom rules to flag project-specific identifiers unique to your portfolio.',
    },
    {
      q: 'What if my ATS requires a phone number?',
      a: 'Use a role-specific VoIP number that can be retired after the search. Keep the main resume phone-free for public sharing and only add the number on a per-application basis.',
    },
    {
      q: 'Do you support right-to-be-forgotten requests?',
      a: 'We do not store your documents, so there is nothing to delete. If you use Pro, you can request deletion of license email identifiers from our payment processor records.',
    },
    {
      q: 'How is accessibility handled?',
      a: 'We use semantic HTML where possible, provide keyboard-focusable controls, and maintain color contrast with the dark theme. Additional ARIA labels are planned for future releases.',
    },
    {
      q: 'Can recruiters verify integrity of redacted files?',
      a: 'Exports preserve structure and include optional change summaries. For compliance-heavy roles, you can provide a short disclosure that PII was intentionally removed for privacy and is available upon request.',
    },
    {
      q: 'How do custom rules work?',
      a: 'Create patterns for company names, project codenames, or unique strings. The worker highlights them alongside standard PII types so you can redact sensitive context beyond personal identifiers.',
    },
    {
      q: 'Is there a limit on document size?',
      a: 'The app is optimized for typical resumes and multi-page case studies. Very large PDFs may take longer to parse in-browser; splitting large documents improves performance.',
    },
    {
      q: 'Do you monetize with ads on all screens?',
      a: 'No. Ads show only after substantial content is visible (like long-form articles) or after users process documents, never on empty states or under-construction screens.',
    },
    {
      q: 'Where can I learn more about privacy best practices?',
      a: 'Visit the Blog section on this page. We publish deep dives on PII hygiene, anonymous job applications, and compliance playbooks tailored for candidates and hiring teams.',
    },
  ];

  return (
    <section id="faq" className="relative z-10 px-6 py-32 border-t border-white/5 overflow-hidden">
      {/* Floating background elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-white/5 to-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />

      <div className="max-w-6xl mx-auto relative">
        <div className="mb-16 text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">FAQ</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">Frequently Asked Questions</h2>
          <p className="text-xl text-zinc-400 font-light max-w-3xl mx-auto leading-relaxed">
            Detailed answers about how we handle privacy, PII detection, exports, and compliance so you can share documents confidently.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((item) => (
            <div key={item.q} className="p-6 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm hover:border-red-500/30 transition-all duration-300 group">
              <h3 className="text-lg font-semibold text-white mb-3 tracking-tight group-hover:text-red-400 transition-colors">{item.q}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
