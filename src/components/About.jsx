import React from 'react';

export default function About() {
  const pillars = [
    {
      title: 'Privacy by Architecture',
      detail: 'Zero uploads, Web Worker isolation, and offline-ready PWA design. We keep processing on-device and design every feature to avoid creating new data exhaust.',
    },
    {
      title: 'Human-Centered Transparency',
      detail: 'Clear consent choices, in-context explanations, and redaction toggles that keep you in control. We explain what is detected and why.',
    },
    {
      title: 'Pragmatic Compliance',
      detail: 'We map features to GDPR/CCPA principles: data minimization, purpose limitation, and user rights. Our UX encourages least-data sharing by default.',
    },
  ];

  const milestones = [
    { year: '2023', title: 'Prototype', text: 'Built the first local-only PII detector for resumes; validated accuracy on synthetic datasets.' },
    { year: '2024', title: 'PWA + Pro', text: 'Shipped offline support, DOCX/PDF exports, and consent-aware monetization with AdSense and Pro tiers.' },
    { year: '2025', title: 'Content & Compliance', text: 'Expanded education hub, added compliance guides, and tuned ad placements to respect high-value content rules.' },
  ];

  return (
    <section id="about" className="relative z-10 px-6 py-32 border-t border-white/5 overflow-hidden">
      {/* Floating background elements */}
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gradient-to-br from-red-500/5 to-red-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-br from-white/5 to-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />

      <div className="max-w-6xl mx-auto relative">
        <div className="mb-16 text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">About</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">Why We Built Redactify</h2>
          <p className="text-xl text-zinc-400 font-light max-w-4xl mx-auto leading-relaxed">
            Hiring should be about skills, not surveillance. Redactify was created to give candidates and teams a trustworthy, local-first tool that strips unnecessary identifiers without slowing the hiring process.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="p-6 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm hover:border-red-500/30 transition-all duration-300 group">
              <h3 className="text-2xl font-semibold text-white mb-3 tracking-tight group-hover:text-red-400 transition-colors">{pillar.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{pillar.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-2 p-8 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm hover:border-white/20 transition-all duration-500 shadow-2xl space-y-6">
            <h3 className="text-3xl font-bold text-white tracking-tight">Our Mission</h3>
            <p className="text-base text-zinc-400 leading-relaxed">
              We believe privacy is a competitive advantage. Candidates should not have to trade personal safety for visibility, and teams should be able to evaluate talent without collecting more data than necessary. Redactify\'s mission is to make privacy-preserving hiring practical: fast enough for recruiters, transparent enough for candidates, and compliant by default.
            </p>
            <p className="text-base text-zinc-400 leading-relaxed">
              Our product decisions map directly to trust principles. We minimize storage, avoid servers for document processing, and default to opt-in for any telemetry. For monetization, we keep ads off empty states and tie their appearance to meaningful content and consent. Pro features focus on power-user workflows—batch processing, custom rules, and premium exports—without compromising local-only guarantees.
            </p>
            <p className="text-base text-zinc-400 leading-relaxed">
              Education is part of the product. The content hub you see on this page shares playbooks for candidates, recruiters, and legal teams so everyone understands how to handle PII responsibly. This balances our utility (a tool) with high-value guidance (publisher content) that AdSense requires.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-red-500/30 bg-red-500/5 text-red-50 space-y-4">
            <h4 className="text-xl font-semibold tracking-tight">Principles We Operate By</h4>
            <ul className="space-y-3 text-sm leading-relaxed">
              <li>Minimum Necessary Data: only collect what a feature truly needs.</li>
              <li>On-Device First: prefer local processing, caching, and storage.</li>
              <li>Explicit Consent: ads and analytics appear only after opt-in.</li>
              <li>Transparent Defaults: every automated detection is explainable and reversible.</li>
              <li>Security-in-Design: no hidden network calls for document content.</li>
            </ul>
            <p className="text-sm leading-relaxed">
              These principles keep us aligned with GDPR/CCPA expectations and with candidate trust. When in doubt, we choose the path that leaves the least data behind.
            </p>
          </div>
        </div>

        <div className="mt-16">
          <h3 className="text-3xl font-bold text-white mb-6 tracking-tight">Timeline</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {milestones.map((m) => (
              <div key={m.year} className="p-6 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm hover:border-red-500/30 transition-all duration-300 group">
                <div className="text-sm font-mono text-red-400 uppercase tracking-wider mb-2 group-hover:text-red-300 transition-colors">{m.year}</div>
                <h4 className="text-xl font-semibold text-white mb-2 tracking-tight">{m.title}</h4>
                <p className="text-sm text-zinc-400 leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
