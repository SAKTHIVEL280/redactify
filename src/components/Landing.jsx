import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import PrivacyModal from './PrivacyModal';

export default function Landing({ onGetStarted, isPro, onNavigate }) {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    // Entry animations
    const elements = document.querySelectorAll('.animate-on-load');
    elements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 100 + (index * 100));
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans antialiased overflow-x-hidden selection:bg-red-500 selection:text-white">
      {/* Hero Video Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        >
          <source src="/hero-video.webm" type="video/webm" />
        </video>
        {/* Video Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
      </div>

      {/* Noise Overlay */}
      <div className="fixed inset-0 z-[9999] pointer-events-none opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
      }} />

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden z-10 px-6 py-20">
        <div className="max-w-4xl mx-auto relative w-full text-center flex flex-col items-center justify-center min-h-[80vh]">

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium text-white tracking-tighter leading-[1.1] mb-8 drop-shadow-2xl animate-on-load transition-all duration-700">
            Protect Your Privacy<br />
            <span className="text-zinc-500">Before You</span>{' '}
            <span className="relative inline-block text-white">
              Share
              {/* Underline decoration */}
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-red-500" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto font-light mb-12 leading-relaxed animate-on-load transition-all duration-700">
            Redact confidential business documents instantly in your browser.
            No uploads, no tracking, no accounts.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-on-load transition-all duration-700 mb-16">
            <button
              onClick={onGetStarted}
              className="px-8 py-4 bg-white text-black hover:bg-zinc-200 font-semibold rounded-full transition-all flex items-center justify-center gap-2 group min-w-[180px] shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
            >
              <span>Start Redacting</span>
              <ArrowRight className="w-4 h-4 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
            </button>
            <button 
              onClick={() => setShowPrivacyModal(true)}
              className="px-8 py-4 bg-zinc-900/80 border border-white/10 text-white hover:bg-zinc-800 hover:border-white/20 font-medium rounded-full transition-all font-mono text-sm min-w-[180px] backdrop-blur-sm"
            >
              100% Browser-Based
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-3xl mx-auto animate-on-load transition-all duration-700">
            {[
              { label: 'Privacy', value: '100% Local' },
              { label: 'Speed', value: '< 50ms' },
              { label: 'Cost', value: 'Free' },
              { label: 'Security', value: 'Zero-Trust' },
            ].map((stat, i) => (
              <div key={i} className="border-t border-white/10 pt-6">
                <div className="text-3xl font-bold text-white mb-1 tracking-tight font-mono">{stat.value}</div>
                <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 py-32 border-t border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Floating background elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-white/5 to-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />

          <div className="mb-24 text-center relative">
            <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Privacy by Design</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
              Privacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">Guaranteed</span>
            </h2>
            <p className="text-xl text-zinc-400 font-light max-w-3xl mx-auto leading-relaxed">
              Everything runs in your browser. We can't access your documents even if we wanted to.
            </p>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Large Feature - Privacy */}
            <div className="md:col-span-8 bg-gradient-to-br from-zinc-900/50 to-zinc-900/30 border border-white/10 rounded-3xl p-12 hover:border-red-500/30 transition-all duration-500 group relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-500/10 to-red-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-red-500/30 bg-red-500/10 mb-8 shadow-lg shadow-red-500/5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50"></div>
                  <span className="text-sm font-mono text-red-400 uppercase tracking-wider font-bold">100% Browser-Only</span>
                </div>

                <h3 className="text-4xl font-bold text-white mb-6 tracking-tight leading-tight">
                  Zero Server Uploads
                </h3>

                <p className="text-zinc-400 text-lg leading-relaxed max-w-lg mb-8">
                  Every file is processed instantly in your browser. No cloud servers, no data collection, no exceptions. Your documents never leave your device.
                </p>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>No tracking cookies</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>No analytics</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>No account needed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Speed Card */}
            <div className="md:col-span-4 bg-zinc-900/30 border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-500 group relative overflow-hidden backdrop-blur-sm flex flex-col justify-between">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative z-10">
                <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">Performance</div>
                <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Instant Results</h3>
                <p className="text-zinc-400 leading-relaxed text-sm">
                  Optimized algorithms process documents in milliseconds.
                </p>
              </div>

              <div className="relative z-10 mt-8">
                <div className="text-6xl font-mono text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 font-bold tracking-tighter">
                  &lt;50ms
                </div>
                <div className="text-xs font-mono text-zinc-600 mt-2">average processing time</div>
              </div>
            </div>

            {/* Smart Detection */}
            <div className="md:col-span-5 bg-zinc-900/30 border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-500 group backdrop-blur-sm">
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">AI-Powered</div>
              <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Smart Detection Engine</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Advanced AI model running 100% locally identifies sensitive information with high accuracy.
              </p>

              <div className="space-y-2">
                {['Names (AI)', 'Emails', 'Phone Numbers', 'URLs', 'Addresses'].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm opacity-0 animate-[slideIn_0.5s_ease-out_forwards]"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    <span className="text-zinc-500 font-mono">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Upgrade */}
            <div className="md:col-span-7 bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-3xl p-10 group relative overflow-hidden cursor-pointer hover:border-white/30 transition-all duration-500 backdrop-blur-sm" onClick={isPro ? onGetStarted : () => onNavigate('upgrade')}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-mono text-white uppercase tracking-wider mb-4">{isPro ? 'Pro Active' : 'Premium'}</div>
                  <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">{isPro ? 'Start Redacting' : 'Unlock Pro Features'}</h3>
                  <p className="text-zinc-400 text-lg max-w-md">
                    {isPro ? 'You have access to DOCX & PDF exports, batch processing, and custom regex rules.' : 'DOCX & PDF exports, batch processing, and advanced redaction patterns for power users.'}
                  </p>
                </div>
                <div className="px-8 py-4 bg-white text-black rounded-full font-bold backdrop-blur-sm group-hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all flex items-center gap-3">
                  <span>{isPro ? 'Redact Now' : 'Upgrade Now'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section - Diagonal Split Cards */}
      <section id="use-cases" className="relative z-10 px-6 py-40 border-t border-white/5 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-red-500/5 to-red-500/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto">
          <div className="mb-24 text-center relative">
            <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Real-World Applications</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
              Who Uses Redactify?
            </h2>
            <p className="text-xl text-zinc-400 font-light max-w-3xl mx-auto leading-relaxed">
              Trusted by businesses to protect confidential information.
            </p>
          </div>

          {/* Clean 4-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                ),
                title: 'Enterprises',
                subtitle: 'Bulk Redaction',
                description: 'Process confidential contracts, NDAs, and internal documents in batches. Maintain compliance while sharing sensitive materials.',
                badge: 'Batch Processing',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: 'Legal Teams',
                subtitle: 'Compliance',
                description: 'Meet GDPR, CCPA, and HIPAA requirements by automatically redacting PII while preserving document structure for audits.',
                badge: 'Regulated',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                title: 'HR Teams',
                subtitle: 'Blind Screening',
                description: 'Remove names and contact info from candidate resumes for unbiased hiring. Focus on skills and qualifications only.',
                badge: 'Bias Reduction',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                title: 'Consultants',
                subtitle: 'NDA Compliance',
                description: 'Redact client names and proprietary information from case studies before public sharing while maintaining impact.',
                badge: 'Confidential',
              },
            ].map((card, i) => (
              <div
                key={i}
                className="group bg-zinc-900/40 border border-white/10 rounded-2xl p-6 hover:border-red-500/30 transition-all duration-300 backdrop-blur-sm relative overflow-hidden"
              >
                {/* Subtle glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative z-10">
                  {/* Badge at top */}
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                    <div className="w-1 h-1 rounded-full bg-red-500"></div>
                    <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider font-semibold">{card.badge}</span>
                  </div>

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-red-400 group-hover:bg-red-500/10 group-hover:border-red-500/20 transition-all duration-300">
                    {card.icon}
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{card.title}</h3>
                  <div className="text-xs font-mono text-red-400 mb-3">{card.subtitle}</div>

                  {/* Description */}
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Interactive Timeline */}
      <section id="how-it-works" className="relative z-10 px-6 py-40 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="mb-24 text-center">
            <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Simple Workflow</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
              Three Steps to Privacy
            </h2>
            <p className="text-xl text-zinc-400 font-light max-w-2xl mx-auto">
              No learning curve. Just drop, review, and download.
            </p>
          </div>

          {/* Vertical Timeline */}
          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-500/30 via-red-500/20 to-red-500/30"></div>

            <div className="space-y-16">
              {[
                {
                  step: '01',
                  title: 'Upload Your Document',
                  description: 'Drop any confidential document or paste text. Processing starts instantly in your browser.',
                  detail: 'Supports TXT, PDF, DOCX formats',
                },
                {
                  step: '02',
                  title: 'AI Detection & Review',
                  description: 'Our local AI engine highlights sensitive info in real-time. Toggle individual items to keep or redact.',
                  detail: 'AI-powered detection + custom rules',
                },
                {
                  step: '03',
                  title: 'Export & Share',
                  description: 'Download your redacted document. Pro users get DOCX and PDF exports with formatting preservation.',
                  detail: 'Zero data uploads • Forever private',
                },
              ].map((item, i) => (
                <div key={i} className="relative flex gap-8 group">
                  {/* Step Number */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-black border-2 border-red-500/50 flex items-center justify-center font-mono text-lg font-bold text-red-400 shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform duration-300 relative z-10">
                    {item.step}
                  </div>

                  {/* Content Card */}
                  <div className="flex-1 bg-zinc-900/30 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-500 backdrop-blur-sm group-hover:translate-x-2">
                    <h4 className="text-2xl font-bold text-white mb-3">{item.title}</h4>
                    <p className="text-zinc-400 leading-relaxed mb-4 text-lg">
                      {item.description}
                    </p>
                    <div className="inline-flex items-center gap-2 text-sm font-mono text-red-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span>{item.detail}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA - Full Width Immersive */}
      <section className="relative z-10 px-6 py-40 border-t border-white/5 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/5"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[150px] rounded-full"></div>

        <div className="max-w-5xl mx-auto text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-xl mb-10">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-sm font-mono text-white uppercase tracking-wider">Ready to Try</span>
          </div>

          {/* Main CTA */}
          <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 tracking-tight leading-tight">
            Your Privacy.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-500">Your Control.</span>
          </h2>

          <p className="text-xl md:text-2xl text-zinc-400 font-light mb-16 max-w-3xl mx-auto leading-relaxed">
            No signup. No credit card. No tracking. Just drop your document and start protecting your privacy in seconds.
          </p>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <button
              onClick={onGetStarted}
              className="group relative px-12 py-6 bg-white text-black hover:bg-zinc-100 font-bold rounded-full transition-all flex items-center justify-center gap-4 shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] text-lg overflow-hidden"
            >
              <span className="relative z-10">Launch Editor</span>
              <ArrowRight className="w-6 h-6 -rotate-45 group-hover:rotate-0 transition-transform duration-300 relative z-10" />

              {/* Animated gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            </button>

            <div className="flex flex-col items-center gap-2 text-sm text-zinc-500 font-mono">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Free forever</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>No installation needed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="text-xl font-bold text-white mb-3">Redactify</div>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Privacy-first business document redactor. Remove sensitive information instantly in your browser.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="text-sm text-zinc-500 hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-sm text-zinc-500 hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#use-cases" className="text-sm text-zinc-500 hover:text-white transition-colors">Use Cases</a></li>
                <li><button onClick={onGetStarted} className="text-sm text-zinc-500 hover:text-white transition-colors text-left">Get Started</button></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="mailto:support@redactify.com" className="text-sm text-zinc-500 hover:text-white transition-colors">Support</a></li>
                <li><button onClick={() => setShowPrivacyModal(true)} className="text-sm text-zinc-500 hover:text-white transition-colors text-left">Privacy Policy</button></li>
                <li><button onClick={() => onNavigate('contact')} className="text-sm text-zinc-500 hover:text-white transition-colors text-left">Contact Us</button></li>
                <li><button onClick={() => onNavigate('terms')} className="text-sm text-zinc-500 hover:text-white transition-colors text-left">Terms & Conditions</button></li>
                <li><button onClick={() => onNavigate('refunds')} className="text-sm text-zinc-500 hover:text-white transition-colors text-left">Refunds Policy</button></li>

              </ul>
            </div>

            {/* Connect */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Connect</h3>
              <ul className="space-y-2">
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-white transition-colors">GitHub</a></li>
                <li><a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-white transition-colors">Twitter</a></li>
                <li><a href="mailto:hello@redactify.com" className="text-sm text-zinc-500 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/5">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-zinc-600">
                © {new Date().getFullYear()} Redactify. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <span className="text-xs text-zinc-600 font-mono">100% Browser-Based</span>
                <span className="text-xs text-zinc-600 font-mono">Zero Data Collection</span>
                <span className="text-xs text-zinc-600 font-mono">Open Source</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Privacy Modal */}
      <PrivacyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
    </div>
  );
}
