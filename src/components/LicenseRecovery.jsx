import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { recoverLicenseByPaymentId, recoverLicenseByEmail } from '../utils/supabaseLicense';
import { storeProKey } from '../utils/proLicenseDB';

const LicenseRecovery = ({ isOpen, onClose, onSuccess }) => {
  const [method, setMethod] = useState('email'); // 'email' or 'payment'
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] border border-zinc-800 overflow-hidden flex flex-col my-auto">
        <div className="p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Recover License</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
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

          <form onSubmit={handleSubmit}>
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

            {status.message && (
              <div className={`mb-6 p-3 rounded-xl text-sm font-medium text-center ${
                status.type === 'success' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-full py-4 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Recover License'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LicenseRecovery;
