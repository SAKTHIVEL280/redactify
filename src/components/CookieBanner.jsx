import React, { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';

const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (cookieConsent !== 'accepted') {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-4 max-w-sm flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
          <Cookie className="w-5 h-5 text-gray-900 dark:text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            We use local cookies to improve your experience. No personal data is uploaded.
          </p>
        </div>
        <button
          onClick={handleAccept}
          className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-bold rounded-lg hover:opacity-80 transition-opacity whitespace-nowrap"
        >
          Accept
        </button>
      </div>
    </div>
  );
};

export default CookieBanner;
