import React from 'react';
import { X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function Refunds({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10 my-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-white/10 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-white">Cancellations and Refunds Policy</h2>
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
            At Redactify, we want you to be completely satisfied with your purchase. This policy outlines our 
            cancellation and refund terms for Pro license purchases.
          </p>

          {/* 30-Day Guarantee */}
          <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl">
            <div className="flex items-start gap-4">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-white mb-2">30-Day Money-Back Guarantee</h3>
                <p className="leading-relaxed">
                  We offer a <strong>30-day money-back guarantee</strong> on all Pro license purchases. 
                  If you're not satisfied with the Pro features or experience technical issues within 30 days 
                  of purchase, we'll provide a full refund—no questions asked.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">1. Eligible Refund Scenarios</h3>
            <p className="leading-relaxed mb-3">You may request a refund if:</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Technical Issues:</strong> Pro features (DOCX/PDF export, batch processing, custom rules) 
                  are not working as advertised and we cannot resolve the issue.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Accidental Purchase:</strong> You purchased Pro by mistake and have not used any Pro features.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Feature Dissatisfaction:</strong> Pro features do not meet your expectations within 30 days 
                  of purchase.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Payment Error:</strong> You were charged multiple times for the same license.
                </div>
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">2. Non-Refundable Scenarios</h3>
            <p className="leading-relaxed mb-3">Refunds will NOT be issued in the following cases:</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">After 30 Days:</strong> Refund requests made after 30 days from the purchase date.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Extensive Usage:</strong> You have extensively used Pro features (e.g., exported 50+ documents, 
                  created 20+ custom rules) demonstrating clear value from the product.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Change of Mind:</strong> You no longer need the features after 30 days.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Violation of Terms:</strong> Your license was revoked due to violation of our Terms of Service 
                  (e.g., license sharing, abuse).
                </div>
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">3. How to Request a Refund</h3>
            <p className="leading-relaxed mb-3">To request a refund:</p>
            <ol className="list-decimal list-inside space-y-3 pl-4">
              <li>
                <strong className="text-white">Email us</strong> at{' '}
                <a href="mailto:support@redactify.daeq.in" className="text-blue-400 hover:text-blue-300">
                  support@redactify.daeq.in
                </a>{' '}
                with subject line: <span className="font-mono text-sm">"Refund Request - [Your Payment ID]"</span>
              </li>
              <li>
                <strong className="text-white">Include the following information:</strong>
                <ul className="list-disc list-inside pl-6 mt-2 space-y-1">
                  <li>Your payment ID (from Razorpay confirmation email)</li>
                  <li>License key (if available)</li>
                  <li>Reason for refund request</li>
                  <li>Email used during purchase (if provided)</li>
                </ul>
              </li>
              <li>
                <strong className="text-white">Wait for response:</strong> We will review your request within 2-3 business days.
              </li>
            </ol>
          </div>

          {/* Section 4 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">4. Refund Processing</h3>
            <p className="leading-relaxed mb-3">
              <strong>4.1 Approval:</strong> Once approved, refunds will be processed within 5-7 business days.
            </p>
            <p className="leading-relaxed mb-3">
              <strong>4.2 Method:</strong> Refunds will be issued to the original payment method (credit/debit card, UPI, net banking).
            </p>
            <p className="leading-relaxed mb-3">
              <strong>4.3 Timeline:</strong> Depending on your bank/payment provider, it may take an additional 5-10 business days 
              for the refund to appear in your account.
            </p>
            <p className="leading-relaxed">
              <strong>4.4 License Revocation:</strong> Upon refund approval, your Pro license will be immediately deactivated.
            </p>
          </div>

          {/* Section 5 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">5. Cancellations (Pre-Purchase)</h3>
            <p className="leading-relaxed">
              <strong>Payment Cancellation:</strong> If you accidentally initiated a payment but did not complete it, 
              no charges will be made. Razorpay orders expire after 15 minutes if not completed. If you were charged 
              but did not receive a license, contact us immediately at{' '}
              <a href="mailto:support@redactify.daeq.in" className="text-blue-400 hover:text-blue-300">
                support@redactify.daeq.in
              </a>
            </p>
          </div>

          {/* Section 6 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">6. Failed Payments</h3>
            <p className="leading-relaxed">
              If your payment failed but you were charged, Razorpay will automatically refund the amount within 5-7 business days. 
              If you don't receive the refund, contact Razorpay support or email us.
            </p>
          </div>

          {/* Section 7 */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">7. Chargebacks</h3>
            <p className="leading-relaxed mb-3">
              <strong>Please contact us first:</strong> Before initiating a chargeback with your bank, please reach out to us. 
              We're committed to resolving issues fairly and quickly.
            </p>
            <p className="leading-relaxed">
              <strong>Consequences:</strong> Chargebacks filed without prior contact may result in permanent account suspension 
              and blacklisting from future purchases.
            </p>
          </div>

          {/* Important Notice */}
          <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Important Notice</h3>
                <p className="text-sm leading-relaxed">
                  Since Redactify is a <strong>digital product with instant access</strong>, we carefully review all refund requests 
                  to prevent abuse. However, we're committed to customer satisfaction and will work with you to resolve any 
                  legitimate concerns.
                </p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-xl font-bold text-white mb-3">Questions?</h3>
            <p className="leading-relaxed">
              If you have any questions about our refund policy, please contact us at:
              <br />
              <a href="mailto:support@redactify.daeq.in" className="text-blue-400 hover:text-blue-300">
                support@redactify.daeq.in
              </a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
