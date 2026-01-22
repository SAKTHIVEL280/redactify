import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';

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
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-full border border-red-500/30 mb-4">
          <Sparkles className="w-4 h-4 text-red-400" />
          <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Compare Plans</span>
        </div>
        <h2 className="text-4xl font-black text-white tracking-tight mb-4">
          Free vs Pro
        </h2>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
          Choose the plan that fits your needs. Start free and upgrade anytime.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-3 gap-4 p-6 border-b border-zinc-800 bg-zinc-950">
          <div className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
            Feature
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">Free</div>
            <div className="text-xs text-zinc-500 mt-1">₹0</div>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-full">
              <Sparkles className="w-3 h-3" />
              <span className="text-lg font-bold text-white">Pro</span>
            </div>
            <div className="text-xs text-zinc-400 mt-2">₹99 lifetime</div>
          </div>
        </div>

        {/* Feature Rows */}
        {features.map((category, catIdx) => (
          <div key={catIdx}>
            <div className="px-6 py-3 bg-zinc-900/50 border-b border-zinc-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {category.category}
              </h3>
            </div>
            {category.items.map((item, itemIdx) => (
              <div
                key={itemIdx}
                className="grid grid-cols-3 gap-4 p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="text-sm text-zinc-300">{item.name}</div>
                <div className="flex justify-center">
                  {item.free ? (
                    <Check className="w-5 h-5 text-green-400" aria-label="Included" />
                  ) : (
                    <X className="w-5 h-5 text-zinc-600" aria-label="Not included" />
                  )}
                </div>
                <div className="flex justify-center">
                  {item.pro ? (
                    <Check className="w-5 h-5 text-green-400" aria-label="Included" />
                  ) : (
                    <X className="w-5 h-5 text-zinc-600" aria-label="Not included" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* CTA Row */}
        <div className="grid grid-cols-3 gap-4 p-6 bg-zinc-950">
          <div></div>
          <div className="flex justify-center">
            <div className="text-center">
              <div className="text-sm text-zinc-400">You're using Free</div>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={onUpgradeClick}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-full hover:opacity-90 transition-opacity"
              aria-label="Upgrade to Pro"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-zinc-500">
          All features are available immediately after purchase. One-time payment, no subscriptions.
        </p>
      </div>
    </div>
  );
};

export default ProComparison;
