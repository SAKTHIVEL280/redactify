import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { recoverLicenseByPaymentId, recoverLicenseByEmail } from '../utils/supabaseLicense';
import { storeProKey } from '../utils/proLicenseDB';

const LicenseRecovery = ({ isOpen, onClose, onSuccess }) => {
  const [method, setMethod] = useState('email'); // 'email' or 'payment'
  const [input, setInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState('input'); // 'input', 'verify', 'success'
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // ESC key to close modal
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading, onClose]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Payment ID method doesn't need verification
    if (method === 'payment') {
      await handleRecover();
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await fetch('/api/send-recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep('verify');
        setStatus({ type: 'info', message: 'Verification code sent to your email' });
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to send code' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to send verification code' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRecover = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      // Verify the code first
      const verifyResponse = await fetch('/api/verify-recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.trim(), code: verificationCode.trim() }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setStatus({ type: 'error', message: verifyData.error || 'Invalid verification code' });
        setLoading(false);
        return;
      }

      // Code verified, now recover license
      await handleRecover();
    } catch (err) {
      setStatus({ type: 'error', message: 'Verification failed' });
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      let result;
      if (method === 'payment') {
        result = await recoverLicenseByPaymentId(input.trim());
      } else {
        result = await recoverLicenseByEmail(input.trim());
      }

      if (result.success) {
        const license = method === 'email' ? result.licenses[0] : result;
        
        await storeProKey({
          key: license.license_key || license.licenseKey,
          orderId: 'recovered',
          paymentId: license.payment_id || input,
          purchasedAt: license.purchased_at || license.purchasedAt,
        });

        setStatus({ type: 'success', message: 'License recovered successfully!' });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
          window.location.reload();
        }, 1500);
      } else {
        setStatus({ type: 'error', message: result.error || 'No license found.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Recovery failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto" role="dialog" aria-labelledby="recovery-title" aria-modal="true">
      <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] border border-zinc-800 overflow-hidden flex flex-col my-auto">
        <div className="p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 id="recovery-title" className="text-2xl font-bold text-white tracking-tight">Recover License</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" aria-label="Close license recovery modal">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex p-1 bg-zinc-800 rounded-xl mb-8">
            <button
              onClick={() => setMethod('email')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                method === 'email' 
                  ? 'bg-red-500 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Email
            </button>
            <button
              onClick={() => setMethod('payment')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                method === 'payment' 
                  ? 'bg-red-500 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Payment ID
            </button>
          </div>

          <form onSubmit={step === 'input' ? handleSendCode : handleVerifyAndRecover}>
            {step === 'input' && (
              <div className="mb-6">
                <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                  {method === 'email' ? 'Email Address' : 'Razorpay Payment ID'}
                </label>
                <input
                  type={method === 'email' ? 'email' : 'text'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={method === 'email' ? 'name@example.com' : 'pay_...'}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  autoFocus
                />
              </div>
            )}

            {step === 'verify' && (
              <div className="mb-6">
                <div className="mb-4 p-3 bg-zinc-800 border border-zinc-700 rounded-xl">
                  <p className="text-xs text-zinc-400 mb-1">Sending code to:</p>
                  <p className="text-sm text-white font-medium">{input}</p>
                </div>
                <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength="6"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-center text-2xl tracking-widest font-bold"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setStep('input');
                    setVerificationCode('');
                    setStatus({ type: '', message: '' });
                  }}
                  className="mt-3 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  ← Change email
                </button>
              </div>
            )}

            {status.message && (
              <div className={`mb-6 p-3 rounded-xl text-sm font-medium text-center ${
                status.type === 'success' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : status.type === 'info'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (step === 'input' && !input.trim()) || (step === 'verify' && !verificationCode.trim())}
              className="w-full py-4 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading 
                ? 'Processing...' 
                : step === 'input' 
                ? method === 'payment' ? 'Recover License' : 'Send Code' 
                : 'Verify & Recover'}
            </button>
          </form>

          {method === 'email' && step === 'input' && (
            <div className="mt-6 p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
              <p className="text-xs text-zinc-400 leading-relaxed">
                <span className="font-bold text-white">Security Notice:</span> We'll send a verification code to your email to confirm ownership before recovering your license.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LicenseRecovery;
