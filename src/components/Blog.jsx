import React from 'react';

// Long-form educational content to satisfy AdSense high-value content requirements
// All text is original and focused on privacy, compliance, and resume redaction best practices
export default function Blog() {
  const articles = [
    {
      title: 'How to Protect Your Privacy When Job Hunting in 2025',
      badge: 'Job Search',
      minutes: '8 min read',
      date: 'Dec 2025',
      hero: 'A practical roadmap for keeping your personal data safe while you search for your next role.',
      sections: [
        {
          heading: 'Audit your footprint before you share',
          body: 'Every resume you email, upload, or paste into a form becomes a copy you no longer fully control. Before sending anything, list the places where your resume will travel: applicant tracking systems, email threads, messaging apps, and third-party job boards. Remove secondary email addresses, personal phone numbers, and full street addresses when they are not required. Use a job-search-only email with strong two-factor authentication and route all recruiter replies there. Keep a changelog of where each version is sent so you can revoke or replace files if needed.',
        },
        {
          heading: 'Minimize sensitive fields by default',
          body: 'Modern hiring teams rarely need your full address; city and timezone are usually enough. Replace exact street addresses with a metropolitan area, and use a virtual phone number that supports call forwarding. If you include links, ensure they do not expose personal analytics data—disable view tracking on portfolio tools and strip tracking parameters from URLs. Store a scrubbed resume template and generate role-specific versions so you never accidentally reintroduce sensitive data.',
        },
        {
          heading: 'Control copies inside messaging apps',
          body: 'When recruiters ask for a quick share over chat, paste only what is required. Messaging apps create additional copies on multiple devices; assume screenshots will circulate. If you must send a file, prefer an expiring link with read-only permissions instead of a raw attachment. Avoid sending identification documents or government IDs unless you are deep into the hiring process and the employer has provided a legitimate purpose, a data retention policy, and a secure upload path.',
        },
        {
          heading: 'Detect and redact PII before the upload',
          body: 'Personally identifiable information (PII) includes emails, phone numbers, physical addresses, personal social accounts, and unique identifiers such as national ID numbers. Run your document through a local redaction tool (like this app) to highlight every occurrence before sharing. Keep professional links that you are comfortable making public—LinkedIn, GitHub, or a portfolio—but remove personal social profiles. When possible, deliver a PDF with flattened layers to reduce the risk of hidden metadata.',
        },
        {
          heading: 'Know your rights with vendors and ATS platforms',
          body: 'Most applicant tracking systems process your data on behalf of employers. Under regulations like GDPR and CCPA, you can request deletion of your records; track which companies received your resume to make these requests meaningful. If a job board syndicates postings, opt out of third-party sharing where possible. Prefer direct company applications over aggregator uploads to limit propagation.',
        },
      ],
      conclusion: 'A privacy-first job search is about discipline: ship only the minimum necessary data, keep a ledger of where each copy lives, and verify that every tool in your workflow respects your consent choices. Small habits compound into strong protection.',
    },
    {
      title: 'Understanding PII: What Hiring Teams Can and Cannot Collect',
      badge: 'PII Basics',
      minutes: '7 min read',
      date: 'Dec 2025',
      hero: 'Clarifying which data points count as personally identifiable information and how to keep them out of your public resumes.',
      sections: [
        {
          heading: 'Primary identifiers',
          body: 'Name, personal email, personal phone number, government ID numbers, and full street addresses are primary identifiers. They can directly link a document back to you. When publishing resumes on portfolio sites, remove primary identifiers entirely. Provide a role-specific email or contact form instead of a phone number if you do not want cold calls.',
        },
        {
          heading: 'Quasi-identifiers',
          body: 'Quasi-identifiers indirectly identify you when combined: graduation years, specific employer names, niche certifications, and small geography details (like a tiny town). If you are sharing a public resume, consider blurring exact years or using broader metro areas. For case studies, replace client names with descriptors ("Fortune 500 retailer" or "Series B fintech") to preserve narrative without exposing partners.',
        },
        {
          heading: 'Online identifiers and metadata',
          body: 'Tracking parameters on URLs, document metadata, and analytics beacons also qualify as PII when they can be tied back to a user. Before exporting, clear document properties, remove author names from PDFs, and strip UTM parameters from links. Turn off link tracking in email and portfolio tools for public resumes.',
        },
        {
          heading: 'What employers are allowed to request',
          body: 'During early screening, employers generally need skills, experience, and work samples—not full identity proof. Identity verification is typically justified later for background checks or payroll setup. If an employer requests a scan of an ID before an interview, ask for a business reason, retention period, and secure upload link. Legitimate teams will provide one.',
        },
        {
          heading: 'How to structure a low-PII resume',
          body: 'Lead with your role title, top skills, and outcomes. Use a city + timezone instead of a street address. Share one professional email and remove phone numbers for public copies. List companies by industry description if confidentiality is required. Keep links to portfolios, GitHub, or case studies that are already public. Every other identifier should be optional and added only when the situation demands it.',
        },
      ],
      conclusion: 'PII hygiene is not about hiding—it is about controlling context. Share enough to prove expertise, but hold back details that are not required until trust is established.',
    },
    {
      title: 'GDPR, CCPA, and Global Privacy Compliance for Resume Sharing',
      badge: 'Compliance',
      minutes: '9 min read',
      date: 'Dec 2025',
      hero: 'A concise walkthrough of how common privacy regulations apply to resumes and recruiting workflows.',
      sections: [
        {
          heading: 'Lawful basis for processing',
          body: 'Employers and recruiters need a lawful basis to process your data. The most common bases are consent (you submitted a resume) and legitimate interest (they need to evaluate candidates). Ask which basis they rely on and how long they retain applications. Under GDPR, you can request access, correction, and deletion. Under CCPA/CPRA, you can request disclosure of categories collected and opt out of sale or sharing.',
        },
        {
          heading: 'Data minimization and purpose limitation',
          body: 'Both GDPR and CCPA expect organizations to collect only what is necessary for a stated purpose. If a job board asks for government IDs or birth dates before an offer, that is a red flag. Provide only data proportional to the hiring stage. When in doubt, ask for a purpose statement and a retention schedule.',
        },
        {
          heading: 'Retention and deletion rights',
          body: 'You can request deletion of your application data. Keep a simple log of where you applied and the dates so you can issue deletion requests later. Many employers purge data after 6-24 months; ask for their schedule. If they cannot delete due to legal obligations, they should explain which laws apply and what is retained.',
        },
        {
          heading: 'Third-party processors and ATS',
          body: 'Applicant tracking systems (ATS) often process resumes on behalf of employers. Processors must follow the controller\'s instructions and implement security. You may see the processor\'s branding in email templates; ask which vendor is used and how to exercise your rights. Under GDPR, you can request details about processors and safeguards for international transfers.',
        },
        {
          heading: 'Cross-border transfers',
          body: 'If your data moves between regions (for example, EU to US), organizations need a transfer mechanism such as SCCs, BCRs, or an adequacy decision. This matters when uploading to global job boards. Prefer regional hosting when available. For highly sensitive resumes, share only with employers that can confirm their transfer safeguards.',
        },
      ],
      conclusion: 'Compliance is a two-way street: organizations must respect rights, and applicants should share only what is necessary. Keep copies of privacy notices you accepted and note which entities received your data so you can act on your rights later.',
    },
    {
      title: 'The Complete Guide to Anonymous Job Applications',
      badge: 'Anonymous Workflow',
      minutes: '10 min read',
      date: 'Dec 2025',
      hero: 'Step-by-step guidance to apply for roles while keeping personal identity details shielded until an offer is on the table.',
      sections: [
        {
          heading: 'Start with an identity-light resume',
          body: 'Strip personal phone numbers, home addresses, and personal emails. Use a role-specific inbox (e.g., firstname.role@fastmail.com) and disable auto-loading of external images to prevent pixel tracking. Include only the links you are comfortable making public. Replace client names with anonymized descriptors where NDAs apply.',
        },
        {
          heading: 'Use cover notes that set expectations',
          body: 'In your intro, briefly explain that you share more personal details later in the process. Example: "For privacy reasons I use a role-dedicated inbox and share phone/video details after initial screening." This frames privacy as professionalism, not secrecy. Most hiring managers will respect the boundary when it is communicated upfront.',
        },
        {
          heading: 'Control the communication channel',
          body: 'Centralize all recruiter communication in one inbox. Avoid giving out a phone number until you have scheduled calls with verified company domains. For calendaring, prefer tools that mask your personal email and do not expose your primary calendar. If a recruiter insists on a phone screen, use a VoIP number that can be shut off after the search.',
        },
        {
          heading: 'Sanitize documents before every send',
          body: 'Metadata often reappears when exporting from word processors. Before sharing, open the export and check document properties, embedded comments, and revision history. Use a local redaction tool to highlight PII and verify nothing sensitive remains. For portfolios, host PDF case studies without analytics beacons and disable viewer telemetry when possible.',
        },
        {
          heading: 'Escalate trust gradually',
          body: 'Share more only as trust increases. After an interview is scheduled, you can provide a VoIP number. After an offer is likely, provide legal name and address for background checks. At every step, ask how the data is stored, who can access it, and when it will be deleted. Organizations with mature practices will have clear answers.',
        },
      ],
      conclusion: 'Anonymous applications succeed when you balance transparency about your work with restraint about personal identifiers. Make privacy part of your professional brand and you will attract teams that respect boundaries.',
    },
  ];

  return (
    <section id="blog" className="relative z-10 px-6 py-32 border-t border-white/5 overflow-hidden">
      {/* Floating background elements */}
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-br from-red-500/5 to-red-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-gradient-to-br from-white/5 to-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />

      <div className="max-w-6xl mx-auto relative">
        <div className="mb-16 text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Deep Dives</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">Privacy &amp; Resume Intelligence</h2>
          <p className="text-xl text-zinc-400 font-light max-w-3xl mx-auto leading-relaxed">
            High-value, original articles that explain how to stay compliant, protect PII, and ship resumes with confidence.
          </p>
        </div>

        <div className="space-y-16">
          {articles.map((article, idx) => (
            <article
              key={article.title}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm p-8 md:p-12 hover:border-red-500/30 transition-all duration-500 group shadow-2xl"
            >
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 bg-gradient-to-br from-red-500/5 via-white/5 to-transparent transition-opacity duration-700" />
              <div className="relative z-10 space-y-6">
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-wider text-zinc-500">
                  <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 font-bold">{article.badge}</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">{article.minutes}</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">{article.date}</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Article {idx + 1}</span>
                </div>

                <div className="space-y-3">
                  <h3 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{article.title}</h3>
                  <p className="text-lg text-zinc-400 leading-relaxed">{article.hero}</p>
                </div>

                <div className="grid gap-8">
                  {article.sections.map((section) => (
                    <div key={section.heading} className="p-6 rounded-2xl border border-white/10 bg-zinc-900/60 backdrop-blur-sm hover:border-white/20 transition-colors">
                      <h4 className="text-xl font-semibold text-white mb-3 tracking-tight">{section.heading}</h4>
                      <p className="text-base text-zinc-400 leading-relaxed whitespace-pre-line">{section.body}</p>
                    </div>
                  ))}
                </div>

                <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-100 font-medium leading-relaxed">
                  {article.conclusion}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
