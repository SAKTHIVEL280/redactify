import React from 'react';

export default function UseCaseDeepDives() {
  const cases = [
    {
      title: 'HR Teams: Blind Screening at Scale',
      badge: 'HR',
      outcome: 'Reduce bias and keep candidates safe while meeting compliance expectations.',
      paragraphs: [
        'Start every requisition with a redaction policy: what identifiers are removed, what stays, and when details are reintroduced. Run incoming resumes through local redaction before the first review to ensure hiring managers see skills first. Create a custom rule list for your organization—internal project names, office locations, and referral codes—to prevent accidental leakage.',
        'For ATS workflows, attach a redacted PDF to each candidate profile alongside the original. This keeps compliance and audit teams satisfied while giving hiring panels a bias-reduced view. Train recruiters to request additional details only after candidates advance to a later stage, and document retention periods so data is purged on schedule.',
        'Communicate the process to candidates. A short note like “We blind-screen resumes to reduce bias; identifying details are requested later” builds trust and positions your team as privacy-forward. Pair the note with a deletion contact so candidates can exercise their rights under GDPR/CCPA.',
      ],
    },
    {
      title: 'Job Seekers: Portfolio-Ready, Privacy-Safe Resumes',
      badge: 'Candidates',
      outcome: 'Publish your work without exposing personal identifiers or private client data.',
      paragraphs: [
        'Maintain two resume versions: a public profile without phone/address and a private version for late-stage processes. Use the public version on portfolio sites, GitHub READMEs, and community forums. Keep a log of where the public resume is posted so you can update or remove it quickly.',
        'For each application, generate a tailored PDF with only the contact fields the employer requires. Remove tracking parameters from portfolio links, and host case studies without analytics pixels. If you need to share video demos, use unlisted links and disable viewer tracking when possible.',
        'When communicating with recruiters, set expectations about privacy up front. Provide a role-specific email, and defer phone or ID sharing until after an interview is scheduled. This keeps your identity in your control while still giving employers what they need to progress the conversation.',
      ],
    },
    {
      title: 'Freelancers: NDA-Friendly Case Studies',
      badge: 'Freelance',
      outcome: 'Show results without revealing client identities or sensitive metrics.',
      paragraphs: [
        'Replace client names with industry descriptors and remove brand assets unless you have explicit permission. Convert exact revenue or user counts into ranges or percentages. Use our custom rules to flag codenames, internal tool names, and unique data points that could deanonymize the client.',
        'Ship two versions of each case study: an anonymized public PDF and a private appendix shared after NDAs are signed. The public version should highlight your role, constraints, and outcomes without exposing confidential numbers. Keep all files local-first and avoid uploading to third-party converters that may store copies.',
        'Include a short disclosure at the top of each public case study: “Client identifiers removed for confidentiality; detailed metrics available under NDA.” This keeps expectations clear and demonstrates respect for partner data.',
      ],
    },
    {
      title: 'Legal & Compliance Teams: Audit-Ready Redaction',
      badge: 'Compliance',
      outcome: 'Document defensible processes for privacy reviews, audits, and regulatory responses.',
      paragraphs: [
        'Map each redaction rule to a policy citation (e.g., GDPR data minimization, CCPA purpose limitation). Store the rule set in version control and track changes. When responding to data subject requests, use the local redactor to produce minimally necessary copies instead of handling raw originals.',
        'For cross-border hiring, maintain region-specific rule profiles. Example: EU profiles remove phone numbers and addresses by default; US profiles may retain city/state but drop street-level detail. This ensures consistent treatment across offices and simplifies internal audits.',
        'Log when ads and analytics are shown to prove that monetization does not precede content. Pair logs with consent receipts for cookie choices. This record helps demonstrate that the site avoids “Google-served ads on screens without publisher content,” aligning with AdSense guidance.',
      ],
    },
  ];

  return (
    <section id="usecases-deep" className="relative z-10 px-6 py-32 border-t border-white/5 overflow-hidden">
      {/* Floating background elements */}
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-gradient-to-br from-white/5 to-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '9s' }} />
      <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-gradient-to-br from-red-500/5 to-red-500/10 rounded-full blur-3xl" />

      <div className="max-w-6xl mx-auto relative">
        <div className="mb-16 text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Case Studies</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">Deep-Dive Use Cases</h2>
          <p className="text-xl text-zinc-400 font-light max-w-3xl mx-auto leading-relaxed">
            Practical, high-detail scenarios that explain how to deploy redaction workflows across different audiences without sacrificing experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cases.map((item) => (
            <div key={item.title} className="p-8 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm hover:border-red-500/30 transition-all duration-500 group flex flex-col gap-4 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 bg-gradient-to-br from-red-500/5 to-transparent transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-wider text-zinc-500">
                  <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 font-bold">{item.badge}</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Outcome</span>
                </div>
                <h3 className="text-2xl font-semibold text-white tracking-tight group-hover:text-red-400 transition-colors">{item.title}</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{item.outcome}</p>
                <div className="space-y-4">
                  {item.paragraphs.map((p, idx) => (
                    <p key={idx} className="text-sm text-zinc-400 leading-relaxed">{p}</p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
