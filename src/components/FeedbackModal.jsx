import React, { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Feedback Modal Component
 * Allows users to submit feedback, bug reports, and improvement suggestions
 * Integrates with Resend API for email delivery
 */
export default function FeedbackModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    type: 'feedback', // feedback, bug, missing_pii, improvement
    email: '',
    subject: '',
    message: '',
    attachmentType: '' // If PII was missed, what type?
  });
  
  const [status, setStatus] = useState({ type: '', message: '' }); // success, error, loading
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feedbackTypes = [
    { value: 'feedback', label: 'General Feedback' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'missing_pii', label: 'Missed PII Detection' },
    { value: 'improvement', label: 'Feature Request' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    // Validation
    if (!formData.message.trim()) {
      setStatus({ type: 'error', message: 'Please provide a message' });
      setIsSubmitting(false);
      return;
    }

    try {
      // Send feedback via API
      const response = await fetch('/api/send-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: formData.type,
          email: formData.email || 'anonymous@redactify.com',
          subject: formData.subject || `[${feedbackTypes.find(t => t.value === formData.type)?.label}] New submission`,
          message: formData.message,
          attachmentType: formData.attachmentType,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        })
      });

      if (response.ok) {
        setStatus({ 
          type: 'success', 
          message: 'Thank you! Your feedback has been received. We\'ll review it shortly.' 
        });
        
        // Reset form
        setTimeout(() => {
          setFormData({
            type: 'feedback',
            email: '',
            subject: '',
            message: '',
            attachmentType: ''
          });
          setStatus({ type: '', message: '' });
          onClose();
        }, 3000);
      } else {
        // Try to parse error response, but handle cases where it's not JSON
        let errorMessage = 'Failed to send feedback';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // Response wasn't JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: `Failed to send feedback: ${error.message}. Please try again or email us directly at support@redactify.com` 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] border border-zinc-800 overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-zinc-800">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Send Feedback</h2>
            <p className="text-sm text-zinc-400 mt-1">Help us improve Redactify</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
          {/* Feedback Type */}
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
              What's this about?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {feedbackTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: type.value })}
                  className={`p-3 rounded-xl border transition-all text-left ${
                    formData.type === type.value
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    formData.type === type.value ? 'text-white' : 'text-zinc-400'
                  }`}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Email (optional) */}
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
              Your Email <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your.email@example.com"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief summary"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
            />
          </div>

          {/* If PII Detection issue, ask what was missed */}
          {/* PII Type (conditional) */}
          {formData.type === 'missing_pii' && (
            <div>
              <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                What type of PII was missed?
              </label>
              <select
                value={formData.attachmentType}
                onChange={(e) => setFormData({ ...formData, attachmentType: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              >
                <option value="">Select type...</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="phone">Phone Number</option>
                <option value="address">Address</option>
                <option value="ssn">SSN/Tax ID</option>
                <option value="dob">Date of Birth</option>
                <option value="credit_card">Credit Card</option>
                <option value="passport">Passport</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
              Details
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder={
                formData.type === 'bug' 
                  ? 'Describe what happened...'
                  : formData.type === 'missing_pii'
                  ? 'Describe the PII that was not detected...'
                  : 'Share your thoughts...'
              }
              rows={4}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none"
            />
          </div>

          {/* Status Message */}
          {status.message && (
            <div className={`p-4 rounded-xl ${
              status.type === 'success' 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <p className={`text-sm ${
                status.type === 'success' ? 'text-green-300' : 'text-red-300'
              }`}>
                {status.message}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Sending...' : 'Send Feedback'}
          </button>

          {/* Privacy Note */}
          <p className="text-xs text-zinc-500 text-center">
            We respect your privacy and will only use your email for follow-up if provided.
          </p>
        </form>
      </div>
    </div>
  );
}
