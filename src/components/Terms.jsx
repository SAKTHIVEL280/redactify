import React from 'react';
import { X } from 'lucide-react';

export default function Terms({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10 my-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-white/10 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-white">Terms and Conditions</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6 text-zinc-300">
          
          <p className="text-sm text-zinc-500">
            <strong>Last Updated:</strong> January 17, 2026
          </p>

          <p className="leading-relaxed">
            Welcome to Redactify. By accessing or using our service, you agree to be bound by these Terms and Conditions. 
            Please read them carefully.
          </p>

          {/* Section 1 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">1. Service Description</h3>
            <p className="leading-relaxed mb-3">
              Redactify is a privacy-first document anonymization tool that processes documents entirely in your browser. 
              We offer:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Free tier: Unlimited PII detection and TXT export</li>
              <li>Pro tier: DOCX/PDF export, batch processing, and custom rules (₹1,599 one-time payment)</li>
            </ul>
          </div>

          {/* Section 2 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">2. User Accounts and Pro Licenses</h3>
            <p className="leading-relaxed mb-3">
              <strong>2.1 No Account Required:</strong> Our free tier requires no registration or account creation.
            </p>
            <p className="leading-relaxed mb-3">
              <strong>2.2 Pro License:</strong> Pro features are unlocked via a one-time payment of ₹1,599. 
              Your license key is stored locally in your browser and backed up to our database for recovery purposes.
            </p>
            <p className="leading-relaxed mb-3">
              <strong>2.3 License Validity:</strong> Pro licenses are lifetime and non-transferable. One license per user.
            </p>
          </div>

          {/* Section 3 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">3. Privacy and Data Processing</h3>
            <p className="leading-relaxed mb-3">
              <strong>3.1 Local Processing:</strong> All document processing happens entirely in your browser. 
              We never upload, store, or transmit your document content to our servers.
            </p>
            <p className="leading-relaxed mb-3">
              <strong>3.2 License Data:</strong> We only store your license key, payment ID, and optional email 
              (if provided) for license recovery purposes.
            </p>
            <p className="leading-relaxed">
              <strong>3.3 Cookies:</strong> We use minimal cookies for essential functionality and analytics 
              (with your consent). See our Privacy Policy for details.
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">4. Payment Terms</h3>
            <p className="leading-relaxed mb-3">
              <strong>4.1 Payment Processing:</strong> Payments are processed securely via Razorpay. 
              We do not store your credit card information.
            </p>
            <p className="leading-relaxed mb-3">
              <strong>4.2 Currency:</strong> All prices are in Indian Rupees (INR).
            </p>
            <p className="leading-relaxed">
              <strong>4.3 Taxes:</strong> Prices include applicable taxes (GST) as per Indian tax laws.
            </p>
          </div>

          {/* Section 5 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">5. Refunds and Cancellations</h3>
            <p className="leading-relaxed mb-3">
              See our <strong>Cancellations and Refunds Policy</strong> for complete details. In summary:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>30-day money-back guarantee for technical issues</li>
              <li>No refunds after 30 days or if features have been extensively used</li>
              <li>Refund requests must be sent to support@redactify.daeq.in</li>
            </ul>
          </div>

          {/* Section 6 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">6. Acceptable Use</h3>
            <p className="leading-relaxed mb-3">You agree NOT to:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Use Redactify for illegal purposes</li>
              <li>Attempt to reverse-engineer, decompile, or hack the service</li>
              <li>Share or resell your Pro license</li>
              <li>Use automated bots or scripts to abuse the service</li>
              <li>Upload malware, viruses, or malicious content</li>
            </ul>
          </div>

          {/* Section 7 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">7. Intellectual Property</h3>
            <p className="leading-relaxed mb-3">
              <strong>7.1 Ownership:</strong> Redactify, including all code, design, and branding, is owned by us. 
              All rights reserved.
            </p>
            <p className="leading-relaxed">
              <strong>7.2 Your Content:</strong> You retain all rights to your documents. We never claim ownership 
              of your content.
            </p>
          </div>

          {/* Section 8 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">8. Service Availability</h3>
            <p className="leading-relaxed mb-3">
              <strong>8.1 Uptime:</strong> We strive for 99.9% uptime but do not guarantee uninterrupted service.
            </p>
            <p className="leading-relaxed mb-3">
              <strong>8.2 Maintenance:</strong> We may perform scheduled maintenance with advance notice when possible.
            </p>
            <p className="leading-relaxed">
              <strong>8.3 Changes:</strong> We reserve the right to modify, suspend, or discontinue features 
              with reasonable notice.
            </p>
          </div>

          {/* Section 9 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">9. Disclaimer of Warranties</h3>
            <p className="leading-relaxed mb-3">
              Redactify is provided "AS IS" without warranties of any kind. While we strive for accuracy in PII detection:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>We do not guarantee 100% detection accuracy</li>
              <li>You are responsible for reviewing all detections before exporting</li>
              <li>We are not liable for any missed PII or false positives</li>
            </ul>
          </div>

          {/* Section 10 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">10. Limitation of Liability</h3>
            <p className="leading-relaxed">
              To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, 
              consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use 
              of Redactify. Our total liability shall not exceed the amount you paid for Pro license (₹1,599).
            </p>
          </div>

          {/* Section 11 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">11. Governing Law</h3>
            <p className="leading-relaxed">
              These Terms are governed by the laws of India. Any disputes shall be resolved in the courts of 
              [Your City/State], India.
            </p>
          </div>

          {/* Section 12 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">12. Changes to Terms</h3>
            <p className="leading-relaxed">
              We may update these Terms from time to time. Continued use of Redactify after changes constitutes 
              acceptance of the new Terms. We will notify users of significant changes via email (if provided) 
              or website banner.
            </p>
          </div>

          {/* Section 13 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">13. Contact</h3>
            <p className="leading-relaxed">
              For questions about these Terms, contact us at:
              <br />
              <a href="mailto:legal@redactify.daeq.in" className="text-blue-400 hover:text-blue-300">
                legal@redactify.daeq.in
              </a>
            </p>
          </div>

          <div className="pt-6 border-t border-white/10">
            <p className="text-sm text-zinc-500">
              By using Redactify, you acknowledge that you have read, understood, and agree to these Terms and Conditions.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
