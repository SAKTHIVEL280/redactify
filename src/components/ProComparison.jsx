import React from 'react';
import { Check, X, Sparkles, Zap } from 'lucide-react';

const ProComparison = ({ onUpgradeClick }) => {
  const features = [
    {
      category: 'Processing',
      items: [
        { name: 'Single document redaction', free: true, pro: true },
        { name: 'Batch processing', free: false, pro: true },
        { name: 'Custom PII rules', free: false, pro: true },
        { name: 'Advanced AI detection', free: false, pro: true },
      ]
    },
    {
      category: 'Export Options',
      items: [
        { name: 'Export as TXT', free: true, pro: true },
        { name: 'Export as PDF with redaction', free: false, pro: true },
        { name: 'Export as DOCX with redaction', free: false, pro: true },
        { name: 'Batch export', free: false, pro: true },
      ]
    },
    {
      category: 'Features',
      items: [
        { name: 'Basic PII detection', free: true, pro: true },
        { name: 'Unlimited usage', free: true, pro: true },
        { name: 'No ads', free: true, pro: true },
        { name: 'Priority support', free: false, pro: true },
        { name: 'Lifetime updates', free: false, pro: true },
      ]
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Section Header - matching Landing.jsx style */}
      <div className="mb-24 text-center relative">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Pricing</span>
        </div>
        <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
          Free vs <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">Pro</span>
        </h2>
        <p className="text-xl text-zinc-400 font-light max-w-3xl mx-auto leading-relaxed">
          Choose the plan that fits your needs. Start free and upgrade anytime.
        </p>
      </div>

      {/* Comparison Table - styled like bento boxes */}
      <div className="bg-zinc-900/30 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
        {/* Header Row */}
        <div className="grid grid-cols-3 gap-6 p-8 border-b border-white/5 bg-zinc-900/50">
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
            Feature
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-1">Free</div>
            <div className="text-xs text-zinc-500 font-mono">₹0</div>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-full mb-2">
              <Sparkles className="w-4 h-4 text-red-400" />
              <span className="text-2xl font-bold text-white">Pro</span>
            </div>
            <div className="text-xs text-zinc-400 font-mono">₹99 lifetime</div>
          </div>
        </div>

        {/* Feature Rows */}
        {features.map((category, catIdx) => (
          <div key={catIdx}>
            <div className="px-8 py-4 bg-zinc-900/50 border-b border-white/5">
              <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3 text-red-500" />
                {category.category}
              </h3>
            </div>
            {category.items.map((item, itemIdx) => (
              <div
                key={itemIdx}
                className="grid grid-cols-3 gap-6 p-6 border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <div className="text-sm text-zinc-300 flex items-center">{item.name}</div>
                <div className="flex justify-center items-center">
                  {item.free ? (
                    <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-400" aria-label="Included" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <X className="w-4 h-4 text-zinc-600" aria-label="Not included" />
                    </div>
                  )}
                </div>
                <div className="flex justify-center items-center">
                  {item.pro ? (
                    <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-400" aria-label="Included" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <X className="w-4 h-4 text-zinc-600" aria-label="Not included" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* CTA Row */}
        <div className="grid grid-cols-3 gap-6 p-8 bg-zinc-900/50">
          <div></div>
          <div className="flex justify-center items-center">
            <div className="text-sm text-zinc-500 font-mono">Current Plan</div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={onUpgradeClick}
              className="px-8 py-4 bg-white text-black hover:bg-zinc-200 font-bold rounded-full transition-all flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
              aria-label="Upgrade to Pro"
            >
              <span>Upgrade Now</span>
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Note */}
      <div className="mt-8 text-center">
        <p className="text-sm text-zinc-500 font-mono">
          All features available immediately. One-time payment, no subscriptions.
        </p>
      </div>
    </div>
  );
};

export default ProComparison;
};

export default ProComparison;
