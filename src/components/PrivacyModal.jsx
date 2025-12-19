import React from 'react';
import { X } from 'lucide-react';

export default function PrivacyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-zinc-800">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">100% Browser-Based</h2>
            <p className="text-sm text-zinc-400 mt-1">Complete Privacy</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <p className="text-zinc-400 leading-relaxed mb-6">
            Your documents are processed entirely in your browser. Zero uploads, zero tracking, zero exceptions.
          </p>
          
          <div className="space-y-4 mb-6">
            <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="font-bold text-white mb-1">Web Workers</div>
              <p className="text-sm text-zinc-400">All processing happens locally using Web Workers</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="font-bold text-white mb-1">No Uploads</div>
              <p className="text-sm text-zinc-400">Files never leave your device - technically impossible</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="font-bold text-white mb-1">Local Storage</div>
              <p className="text-sm text-zinc-400">Settings stored in browser only (IndexedDB)</p>
            </div>
          </div>

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
