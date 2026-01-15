import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';
import { checkBrowserCompatibility, showCompatibilityWarnings } from '../utils/browserCompat';

export default function BrowserCompatWarning() {
  const [warnings, setWarnings] = useState([]);
  const [errors, setErrors] = useState([]);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const checkCompat = async () => {
      const compat = await checkBrowserCompatibility();
      
      if (compat.warnings.length > 0 || compat.issues.length > 0) {
        setWarnings(compat.warnings);
        setErrors(compat.issues);
        setShowBanner(true);
        
        // Log to console for debugging
        console.log('Browser Compatibility Check:', compat);
      }
    };

    checkCompat();
  }, []);

  if (!showBanner || (warnings.length === 0 && errors.length === 0)) {
    return null;
  }

  const hasErrors = errors.length > 0;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-full mx-4 animate-in slide-in-from-top duration-300 ${
      hasErrors ? 'bg-red-900/90' : 'bg-yellow-900/90'
    } backdrop-blur-md rounded-xl border ${
      hasErrors ? 'border-red-500/50' : 'border-yellow-500/50'
    } shadow-2xl`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${hasErrors ? 'bg-red-500/20' : 'bg-yellow-500/20'} flex-shrink-0`}>
            {hasErrors ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <Info className="w-5 h-5 text-yellow-400" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white mb-1">
              {hasErrors ? 'Browser Compatibility Issues' : 'Browser Compatibility Warnings'}
            </h3>
            
            {errors.length > 0 && (
              <div className="mb-2">
                {errors.map((error, idx) => (
                  <p key={idx} className="text-xs text-red-200 mb-1">
                    <strong>{error.feature}:</strong> {error.message}
                  </p>
                ))}
              </div>
            )}
            
            {warnings.length > 0 && (
              <div>
                {warnings.map((warning, idx) => (
                  <p key={idx} className="text-xs text-yellow-200 mb-1">
                    <strong>{warning.feature}:</strong> {warning.message}
                  </p>
                ))}
              </div>
            )}
            
            {hasErrors && (
              <p className="text-xs text-red-300 mt-2 font-medium">
                Please update your browser or use Chrome/Firefox/Edge for the best experience.
              </p>
            )}
          </div>
          
          <button
            onClick={() => setShowBanner(false)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </div>
    </div>
  );
}
