import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Menu, X } from 'lucide-react';
import Landing from './components/Landing';
import Redactor from './components/Redactor';
import Sidebar from './components/Sidebar';
import Privacy from './components/Privacy';
import ProModal from './components/ProModal';
import LicenseRecovery from './components/LicenseRecovery';
import CookieBanner from './components/CookieBanner';
import Contact from './components/Contact';
import Terms from './components/Terms';
import Refunds from './components/Refunds';
import BatchProcessor from './components/BatchProcessor';
import CustomRulesManager from './components/CustomRulesManager';
import FeedbackModal from './components/FeedbackModal';
import MobileMenu from './components/MobileMenu';
import ErrorBoundary from './components/ErrorBoundary';
import BrowserCompatWarning from './components/BrowserCompatWarning';
import { verifyProStatus } from './utils/proLicenseDB';

function App() {
  const scrollContainerRef = useRef(null);
  const [currentView, setCurrentView] = useState('landing'); // 'landing' or 'redactor'
  const [darkMode, setDarkMode] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showBatchProcessor, setShowBatchProcessor] = useState(false);
  const [showCustomRules, setShowCustomRules] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showRefunds, setShowRefunds] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024); // Start closed on mobile
  const [isPro, setIsPro] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // PII state
  const [detectedPII, setDetectedPII] = useState([]);
  const [originalText, setOriginalText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileType, setFileType] = useState(null);

  // Scroll detection for navbar
  useEffect(() => {
    if (currentView !== 'landing') {
      setScrolled(false);
      return;
    }

    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setScrolled(scrollTop > 100);
      }
    };

    // Also try listening to window scroll as fallback
    const handleWindowScroll = () => {
      setScrolled(window.scrollY > 100);
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    // Add window listener as well to test
    window.addEventListener('scroll', handleWindowScroll);

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [currentView]);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Check Pro status on mount
  useEffect(() => {
    const checkPro = async () => {
      const isProUser = await verifyProStatus();
      setIsPro(isProUser);
    };
    checkPro();
  }, []);

  // Track analytics (localStorage only, no PII)
  useEffect(() => {
    const trackPageView = () => {
      const cookiePrefs = localStorage.getItem('cookie_preferences');
      if (cookiePrefs) {
        const prefs = JSON.parse(cookiePrefs);
        if (prefs.analytics) {
          const visits = parseInt(localStorage.getItem('page_visits') || '0');
          localStorage.setItem('page_visits', (visits + 1).toString());
          localStorage.setItem('last_visit', new Date().toISOString());
        }
      }
    };
    trackPageView();
  }, [currentView]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());

    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Handle navigation to redactor
  const handleGetStarted = () => {
    setCurrentView('redactor');
  };

  // Handle navigation to landing
  const handleGoToLanding = () => {
    setCurrentView('landing');
    setDetectedPII([]);
    setOriginalText('');    setUploadedFile(null);
    setFileType(null);  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goToSection = (id) => {
    if (currentView !== 'landing') {
      setCurrentView('landing');
      setTimeout(() => scrollToSection(id), 200);
    } else {
      scrollToSection(id);
    }
  };

  // Handle PII detection
  const handlePIIDetected = (piiItems, text, file = null, type = null) => {
    setDetectedPII(piiItems);
    setOriginalText(text);
    setUploadedFile(file);
    setFileType(type);
  };

  // Toggle PII acceptance
  const handleTogglePII = (id) => {
    setDetectedPII(prevPII =>
      prevPII.map(item =>
        item.id === id ? { ...item, redact: !item.redact } : item
      )
    );
  };

  // Handle Pro upgrade success
  const handleProSuccess = (licenseData) => {
    setIsPro(true);
    setShowProModal(false);
    alert('Pro upgrade successful! All features unlocked.');
  };

  return (
    <div className="h-full flex flex-col bg-black transition-colors selection:bg-red-500 selection:text-white">
      {/* Browser Compatibility Warning */}
      <BrowserCompatWarning />
      
      {/* Floating Navigation Bar */}
      <nav 
        style={{ 
          transition: 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
        className={`backdrop-blur-xl shadow-2xl shadow-black/50 z-50 fixed left-0 right-0 ${
        currentView === 'landing' 
          ? scrolled 
            ? 'top-4 h-12 mx-auto w-[96%] max-w-6xl rounded-2xl border border-white/10 bg-zinc-900/50' 
            : 'top-6 h-16 mx-auto w-[94%] max-w-5xl rounded-full border border-white/10 bg-zinc-900/50'
          : 'top-0 h-12 w-full rounded-none border-b border-white/10 bg-zinc-900/80'
      }`}>
        <div className="px-6 md:px-8 h-full flex items-center justify-between">
          {/* Logo Area */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={handleGoToLanding}
          >
            <span className={`font-medium text-white tracking-wide group-hover:text-red-500 transition-all duration-300 ${
              currentView === 'landing' && !scrolled ? 'text-base' : 'text-sm'
            }`}>
              Redactify
            </span>
          </div>

          {/* Desktop Actions */}
          <div className="flex items-center gap-6 md:gap-8">
            {currentView === 'redactor' && (
              <button
                onClick={handleGoToLanding}
                className="hidden sm:block text-xs font-mono text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
              >
                Home
              </button>
            )}

            {currentView === 'landing' && (
              <button
                onClick={handleGetStarted}
                className="hidden sm:block text-xs font-mono text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
              >
                Redact
              </button>
            )}

            <button
              onClick={() => setShowPrivacy(true)}
              className="hidden sm:block text-xs font-mono text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
            >
              Privacy
            </button>

            <button
              onClick={() => setShowFeedback(true)}
              className="hidden sm:block text-xs font-mono text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
            >
              Feedback
            </button>

            {!isPro && (
              <button
                onClick={() => setShowRecovery(true)}
                className="hidden sm:block text-xs font-mono text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
              >
                Recover
              </button>
            )}

            <div className="h-4 w-px bg-white/10 hidden sm:block"></div>

            {!isPro ? (
              <button
                onClick={() => setShowProModal(true)}
                className="text-sm font-semibold bg-white text-black px-4 py-1.5 rounded-full hover:bg-zinc-200 transition-all"
              >
                Upgrade
              </button>
            ) : (
              <span className="text-xs font-bold px-2 py-1 bg-zinc-800 rounded text-white uppercase tracking-wider">
                PRO
              </span>
            )}

            {/* Mobile: Single Menu Button for both Sidebar and Navigation */}
            {currentView === 'redactor' ? (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-white hover:bg-zinc-800 rounded-lg transition-colors"
                title="Open Analysis"
              >
                <Menu className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setShowMobileMenu(true)}
                className="sm:hidden p-2 text-white hover:bg-zinc-800 rounded-lg transition-colors"
                title="Open Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 relative flex flex-col ${
          currentView === 'redactor' ? 'overflow-hidden pt-12 md:pt-12' : 'overflow-y-auto pt-16 md:pt-0'
        }`} 
        data-scroll-container
      >
        {currentView === 'landing' ? (
          <Landing 
            onGetStarted={handleGetStarted} 
            isPro={isPro} 
            onNavigate={(action) => {
              switch (action) {
                case 'contact':
                  setShowContact(true);
                  break;
                case 'terms':
                  setShowTerms(true);
                  break;
                case 'refunds':
                  setShowRefunds(true);
                  break;

                default:
                  break;
              }
            }}
          />
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Redactor Area */}
            <Redactor
              onPIIDetected={handlePIIDetected}
              detectedPII={detectedPII}
              isPro={isPro}
              onTogglePII={handleTogglePII}
            />

            {/* Sidebar - responsive */}
            {sidebarOpen && (
              <>
                {/* Mobile backdrop */}
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
                <div className="fixed lg:relative inset-0 lg:inset-auto lg:right-0 lg:top-0 lg:bottom-0 z-40 lg:z-0 h-full shadow-2xl lg:shadow-none flex flex-col">
                  <Sidebar
                    piiItems={detectedPII}
                    onTogglePII={handleTogglePII}
                    originalText={originalText}
                    onUpgradeClick={() => setShowProModal(true)}
                    uploadedFile={uploadedFile}
                    fileType={fileType}
                    onClose={() => setSidebarOpen(false)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Privacy Modal */}
      {showPrivacy && <Privacy onClose={() => setShowPrivacy(false)} />}

      {/* Feedback Modal */}
      <FeedbackModal 
        isOpen={showFeedback} 
        onClose={() => setShowFeedback(false)} 
      />

      {/* Pro Upgrade Modal */}
      <ProModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        onSuccess={handleProSuccess}
      />

      {/* License Recovery Modal */}
      <LicenseRecovery
        isOpen={showRecovery}
        onClose={() => setShowRecovery(false)}
        onSuccess={(licenseData) => {
          setIsPro(true);
          setShowRecovery(false);
          window.location.reload(); // Reload to refresh Pro status
        }}
      />

      {/* Batch Processor Modal (Pro Only) */}
      {isPro && (
        <BatchProcessor
          isOpen={showBatchProcessor}
          onClose={() => setShowBatchProcessor(false)}
        />
      )}

      {/* Custom Rules Manager (Pro Only) */}
      {isPro && (
        <CustomRulesManager
          isOpen={showCustomRules}
          onClose={() => setShowCustomRules(false)}
        />
      )}

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        currentView={currentView}
        isPro={isPro}
        onNavigate={(action) => {
          switch (action) {
            case 'home':
              handleGoToLanding();
              break;
            case 'batch':
              setShowBatchProcessor(true);
              break;
            case 'rules':
              setShowCustomRules(true);
              break;
            case 'privacy':
              setShowPrivacy(true);
              break;
            case 'feedback':
              setShowFeedback(true);
              break;
            case 'recover':
              setShowRecovery(true);
              break;
            case 'upgrade':
              setShowProModal(true);
              break;
            case 'blog':
              goToSection('blog');
              break;
            case 'faq':
              goToSection('faq');
              break;
            case 'about':
              goToSection('about');
              break;
            case 'contact':
              setShowContact(true);
              break;
            case 'terms':
              setShowTerms(true);
              break;
            case 'refunds':
              setShowRefunds(true);
              break;

            case 'usecases':
              goToSection('usecases-deep');
              break;
            default:
              break;
          }
        }}
      />

      {/* Policy Modals */}
      {showContact && <Contact onClose={() => setShowContact(false)} />}
      {showTerms && <Terms onClose={() => setShowTerms(false)} />}
      {showRefunds && <Refunds onClose={() => setShowRefunds(false)} />}


      {/* Cookie Banner */}
      <CookieBanner />
    </div>
  );
}

export default App;
