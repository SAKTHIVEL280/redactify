import React from 'react';
import { X, Mail, MessageSquare, AlertCircle } from 'lucide-react';

export default function Contact({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/10 my-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-white/10 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-white">Contact Us</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          
          {/* Introduction */}
          <div>
            <p className="text-zinc-300 leading-relaxed">
              We're here to help! Whether you have questions about Redactify, need technical support, 
              or want to provide feedback, we'd love to hear from you.
            </p>
          </div>

          {/* Contact Methods */}
          <div className="grid gap-6">
            
            {/* Support Email */}
            <div className="p-6 bg-zinc-800/50 border border-white/10 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Email Support</h3>
                  <p className="text-zinc-400 mb-3 text-sm">
                    For technical support, Pro license issues, or general inquiries
                  </p>
                  <a 
                    href="mailto:sakthivel.b3p@gmail.com"
                    className="text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm"
                  >
                    sakthivel.b3p@gmail.com
                  </a>
                </div>
              </div>
            </div>

            {/* Feedback */}
            <div className="p-6 bg-zinc-800/50 border border-white/10 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Feedback & Feature Requests</h3>
                  <p className="text-zinc-400 mb-3 text-sm">
                    Have an idea to improve Redactify? We're always listening
                  </p>
                  <a 
                    href="mailto:feedback@redactify.daeq.in"
                    className="text-purple-400 hover:text-purple-300 transition-colors font-mono text-sm"
                  >
                    feedback@redactify.daeq.in
                  </a>
                </div>
              </div>
            </div>

            {/* Business Inquiries */}
            <div className="p-6 bg-zinc-800/50 border border-white/10 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Business & Partnerships</h3>
                  <p className="text-zinc-400 mb-3 text-sm">
                    Enterprise licensing, partnerships, or media inquiries
                  </p>
                  <a 
                    href="mailto:business@redactify.daeq.in"
                    className="text-green-400 hover:text-green-300 transition-colors font-mono text-sm"
                  >
                    business@redactify.daeq.in
                  </a>
                </div>
              </div>
            </div>

          </div>

          {/* Response Time */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm text-blue-300">
              <strong>Response Time:</strong> We typically respond within 24-48 hours during business days (Monday-Friday, IST).
            </p>
          </div>

          {/* Address */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-lg font-bold text-white mb-4">Business Information</h3>
            <div className="space-y-2 text-sm text-zinc-400">
              <p><strong className="text-white">Product:</strong> Redactify - Privacy-First Document Anonymizer</p>
              <p><strong className="text-white">Website:</strong> <a href="https://redactify.daeq.in" className="text-blue-400 hover:text-blue-300">https://redactify.daeq.in</a></p>
              <p><strong className="text-white">Based in:</strong> India</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
