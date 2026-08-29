import React from 'react';
import { X } from 'lucide-react';

export default function Privacy({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 rounded-3xl max-w-2xl w-full shadow-2xl max-h-[85vh] overflow-hidden flex flex-col border border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-zinc-800">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Privacy Architecture</h2>
            <p className="text-sm text-zinc-400 mt-1">Local-First by Design</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="space-y-12">
            {/* Core Principle */}
            <section>
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-6">
                <p className="text-lg font-medium text-red-100 leading-relaxed">
                  Your documents never leave your device. We physically cannot see them because we don't have a server to upload them to.
                </p>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Redactify operates on a "Local-First" architecture. This means the application code runs entirely within your web browser's memory. 
                Unlike traditional web services, there is no backend server processing your sensitive data.
              </p>
            </section>

            {/* Technical Breakdown */}
            <section>
              <h3 className="text-lg font-bold text-white mb-6">
                How it works
              </h3>
              <div className="grid gap-8">
                <div className="flex gap-6">
                  <div className="text-4xl font-bold text-zinc-800">01</div>
                  <div>
                    <h4 className="font-bold text-white mb-2">In-Memory Processing</h4>
                    <p className="text-zinc-400 leading-relaxed">
                      Files are loaded into your browser's RAM using the HTML5 File API. They are never uploaded to any cloud storage or temporary server.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-4xl font-bold text-zinc-800">02</div>
                  <div>
                    <h4 className="font-bold text-white mb-2">Client-Side Regex</h4>
                    <p className="text-zinc-400 leading-relaxed">
                      PII detection runs locally using JavaScript Regular Expressions and WebAssembly, ensuring high performance without external API calls.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-4xl font-bold text-zinc-800">03</div>
                  <div>
                    <h4 className="font-bold text-white mb-2">Local Generation</h4>
                    <p className="text-zinc-400 leading-relaxed">
                      The redacted file is constructed in your browser and served as a Blob URL for download. The data stream stays within your local context.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Data Collection */}
            <section className="border-t border-zinc-800 pt-8">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                Transparency Report
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                  <div className="font-bold text-white mb-1">Analytics</div>
                  <p className="text-sm text-zinc-400">Anonymous usage stats (e.g., "page visited"). No personal data.</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                  <div className="font-bold text-white mb-1">Pro License</div>
                  <p className="text-sm text-zinc-400">We store a hash of your license key to verify your purchase.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={onClose}
            className="w-full py-4 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
