import React, { useState } from 'react';
import useRazorpay from 'react-razorpay';
import { X, Check, Shield, Lock } from 'lucide-react';
import axios from 'axios';
import { storeProKey } from '../utils/proLicenseDB';
import { storeLicenseInSupabase } from '../utils/supabaseLicense';

const ProModal = ({ isOpen, onClose, onSuccess }) => {
  const [Razorpay] = useRazorpay();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [email, setEmail] = useState('');
  const [savedLicenseData, setSavedLicenseData] = useState(null);

  // Razorpay configuration
  // TODO: Replace with production key from https://dashboard.razorpay.com/
  // Development: rzp_test_XXXXX | Production: rzp_live_XXXXX
  const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY || 'rzp_test_XXXXX';
  const PRICE = 159900; // ₹1,599 in paise

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: orderData } = await axios.post('/api/create-order', {
        amount: 159900,
        currency: 'INR'
      });

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        throw new Error('Payment configuration error. Please contact support.');
      }

      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Redactify Pro',
        description: 'Lifetime License - Privacy-First Document Redaction',
        image: 'https://redactify.daeq.in/pwa-192x192.png',
        order_id: orderData.id,
        handler: async (response) => {
          try {
            const { data: verifyData } = await axios.post('/api/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyData.success) {
              const licenseData = {
                key: verifyData.licenseKey,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                purchasedAt: new Date().toISOString()
              };

              await storeProKey(licenseData);
              setSavedLicenseData(licenseData);
              setShowEmailPrompt(true);
            } else {
              setError('Payment verification failed.');
            }
          } catch (err) {
            setError('Payment verification failed.');
          }
        },
        theme: { color: '#000000' },
        modal: { ondismiss: () => setLoading(false) }
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.open();
    } catch (err) {
      setError('Failed to initiate payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSave = async () => {
    if (!savedLicenseData) return;
    setLoading(true);
    try {
      const supabaseData = {
        license_key: savedLicenseData.key,
        payment_id: savedLicenseData.paymentId,
        order_id: savedLicenseData.orderId,
        email: email.trim() || null,
        purchased_at: savedLicenseData.purchasedAt
      };
      await storeLicenseInSupabase(supabaseData);
      if (onSuccess) onSuccess(savedLicenseData);
      onClose();
    } catch (err) {
      if (onSuccess) onSuccess(savedLicenseData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (showEmailPrompt) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto">
        <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] border border-zinc-800 overflow-hidden my-auto">
          <div className="p-8 text-center overflow-y-auto">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
            <p className="text-zinc-400 mb-8">Your Pro license has been activated.</p>
            
            <div className="text-left mb-6">
              <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                Backup Email (Optional)
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              />
              <p className="text-xs text-zinc-400 mt-2">Used to recover your license if you switch devices.</p>
            </div>

            <button
              onClick={handleEmailSave}
              className="w-full py-4 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 transition-colors mb-3"
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
            <button
              onClick={() => { if (onSuccess) onSuccess(savedLicenseData); onClose(); }}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto flex flex-col md:flex-row border border-zinc-800 my-auto">
        
        {/* Left: Value Prop */}
        <div className="md:w-1/2 bg-zinc-900/50 p-6 md:p-10 border-r border-zinc-800 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-red-500 text-white text-xs font-bold uppercase tracking-wider mb-8">
              Pro Access
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight leading-[0.95]">
              Professional <br/> Power.
            </h2>
            <p className="text-lg text-zinc-400 leading-relaxed mb-12">
              Unlock the full potential of local-first redaction. Designed for recruiters, HR professionals, and privacy-conscious individuals.
            </p>
          </div>

          <div className="space-y-6">
            {[
              'Export to Word (.docx)',
              'Export to PDF',
              'Batch Processing',
              'Custom Regex Rules',
              'Priority Support'
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="font-medium text-white">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Checkout */}
        <div className="md:w-1/2 p-6 md:p-10 relative flex flex-col overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-10">
              <div className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-2">One-time payment</div>
              <div className="text-6xl font-bold text-white tracking-tighter mb-2">₹1,599</div>
              <div className="text-zinc-400">Lifetime access. No subscriptions.</div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 text-red-400 border border-red-500/30 text-sm rounded-xl text-center">
                {error}
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full py-5 bg-red-500 text-white font-bold text-lg rounded-full hover:bg-red-600 transition-colors shadow-xl hover:shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed mb-6"
            >
              {loading ? 'Processing...' : 'Get Lifetime Access'}
            </button>

            <div className="flex items-center justify-center gap-6 text-xs text-zinc-400 font-medium uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Lock className="w-3 h-3" />
                Secure Payment
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-3 h-3" />
                30-Day Guarantee
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProModal;
