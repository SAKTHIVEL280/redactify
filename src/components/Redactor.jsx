import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { X, RefreshCw, Sparkles, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import PropTypes from 'prop-types';
import { extractTextFromInput, highlightPII } from '../utils/piiDetector';
import { useTransformersPII } from '../hooks/useTransformersPII';
import { getEnabledCustomRules, applyCustomRules } from '../utils/customRulesDB';
import { detectSmartPII } from '../utils/smartDetection';
import { getFileTypeFromMime } from '../utils/fileHelpers';
import { showError, showSuccess, showWarning } from '../utils/toast';
import { getFileSizeLimits } from '../utils/browserCompat';
import DocumentViewer from './DocumentViewer';

function Redactor({ onPIIDetected, detectedPII, isPro, onTogglePII, sidebarOpen, onToggleSidebar, selectedPIIId, onSelectPII }) {
  const [text, setText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [customRules, setCustomRules] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [showModelNotice, setShowModelNotice] = useState(false);
  const [modelCached, setModelCached] = useState(false);
  const abortControllerRef = React.useRef(null);
  const debounceTimerRef = React.useRef(null);
  
  // Use Transformers.js ML model for PII detection (context-aware)
  const { 
    detectPII: detectWithML, 
    isModelLoading, 
    modelProgress, 
    modelError,
    isModelLoaded,
    isModelCached: checkModelCached,
    initModel
  } = useTransformersPII();

  // Check if model is cached on mount
  useEffect(() => {
    const checkCache = async () => {
      const cached = await checkModelCached();
      setModelCached(cached);
      
      if (!cached) {
        // Auto-start download when entering redactor page
        console.log('[REDACTOR] Model not cached, starting download...');
        initModel();
      }
    };
    checkCache();
  }, [checkModelCached, initModel]);

  // Load custom rules on mount and when isPro changes
  useEffect(() => {
    const loadCustomRules = async () => {
      if (isPro) {
        try {
          const rules = await getEnabledCustomRules();
          setCustomRules(rules);
        } catch (err) {
          showError('Failed to load custom rules');
          setCustomRules([]);
        }
      } else {
        setCustomRules([]);
      }
    };
    loadCustomRules();
  }, [isPro]);

  // Separate effect for listening to custom rules updates
  useEffect(() => {
    const handleRulesUpdate = async () => {
      if (isPro) {
        try {
          const rules = await getEnabledCustomRules();
          setCustomRules(rules);
          
          // Re-analyze current text with updated rules if there's text
          if (text && text.trim().length > 10) {
            setIsProcessing(true);
            try {
              // Use unified smart detection pipeline
              const mlFn = detectWithML && !modelError ? detectWithML : null;
              const smartDetections = await detectSmartPII(text, mlFn);
              const customDetections = applyCustomRules(text, rules);
              const detected = [...smartDetections, ...customDetections];
              onPIIDetected(detected, text, uploadedFile, fileType);
            } catch (err) {
              showError('Error re-analyzing with updated rules');
              setError(err.message);
            } finally {
              setIsProcessing(false);
            }
          }
        } catch (err) {
          showError('Failed to reload custom rules');
        }
      }
    };
    
    window.addEventListener('customRulesUpdated', handleRulesUpdate);
    
    return () => {
      window.removeEventListener('customRulesUpdated', handleRulesUpdate);
    };
  // Intentionally excluding text, detect, onPIIDetected to prevent infinite loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  // Memoize highlighted HTML to avoid unnecessary re-renders
  const highlightedHTML = useMemo(() => {
    if (!text || !detectedPII || detectedPII.length === 0) {
      return null;
    }
    return highlightPII(text, detectedPII);
  }, [text, detectedPII]);

  // Handle text input change with debounced PII detection
  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    setError(null);

    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (newText.trim().length > 10) {
      setIsProcessing(true);
      // Debounce detection for performance
      debounceTimerRef.current = setTimeout(async () => {
        try {
          // Use unified smart detection pipeline
          const mlFn = detectWithML && !modelError ? detectWithML : null;
          const smartDetections = await detectSmartPII(newText, mlFn);
          const customDetections = customRules.length > 0 ? applyCustomRules(newText, customRules) : [];
          const detected = [...smartDetections, ...customDetections];
          onPIIDetected(detected, newText);
        } catch (err) {
          setError('Error detecting PII: ' + err.message);
          onPIIDetected([], newText);
        } finally {
          setIsProcessing(false);
        }
      }, 800);
    } else {
      onPIIDetected([], newText);
      setIsProcessing(false);
    }
  };

  // Handle drag and drop with file extraction
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Validate file size
    const limits = getFileSizeLimits();
    if (file.size > limits.maxFileSize) {
      showError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed is ${(limits.maxFileSize / 1024 / 1024).toFixed(0)}MB.`);
      return;
    }
    if (file.size > limits.warningSize) {
      showWarning(`Large file detected (${(file.size / 1024 / 1024).toFixed(1)}MB). Processing may take a moment...`);
    }

    // Cancel any pending operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setIsProcessing(true);
      setUploadedFile(file);
      const detectedType = getFileTypeFromMime(file.type);
      setFileType(detectedType);
      
      const content = await extractTextFromInput(file);
      
      // Check if aborted
      if (signal.aborted) return;
      
      setText(content);

      // Use unified smart detection: ML (names, orgs, locations) + Regex (email, phone, SSN)
      const mlFn = detectWithML && !modelError ? detectWithML : null;
      const smartDetections = await detectSmartPII(content, mlFn);
      const customDetections = customRules.length > 0 ? applyCustomRules(content, customRules) : [];
      const detected = [...smartDetections, ...customDetections];
      
      // Check if aborted
      if (signal.aborted) return;
      
      onPIIDetected(detected, content, file, detectedType);
    } catch (err) {
      if (err.name === 'AbortError') return;
      showError(err.message || 'Failed to read file');
      setError(err.message);
      setText('');
      onPIIDetected([], '', null, null);
    } finally {
      if (!signal.aborted) {
        setIsProcessing(false);
      }
    }
  }, [onPIIDetected, customRules, detectWithML]);

  // Handle file input with file extraction
  const handleFileInput = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    const limits = getFileSizeLimits();
    if (file.size > limits.maxFileSize) {
      showError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed is ${(limits.maxFileSize / 1024 / 1024).toFixed(0)}MB.`);
      e.target.value = ''; // Reset input
      return;
    }
    if (file.size > limits.warningSize) {
      showWarning(`Large file detected (${(file.size / 1024 / 1024).toFixed(1)}MB). Processing may take a moment...`);
    }

    // Cancel any pending operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setIsProcessing(true);
      setError(null);

      setUploadedFile(file);
      const detectedType = getFileTypeFromMime(file.type);
      setFileType(detectedType);

      const content = await extractTextFromInput(file);
      
      // Check if aborted
      if (signal.aborted) return;
      
      setText(content);

      // Use smart detection: ML (names, orgs, locations) + Regex (email, phone, SSN)
      console.log('[DEBUG] Calling smart detection...');
      const smartDetections = await detectSmartPII(content, detectWithML && !modelError ? detectWithML : null);
      const customDetections = customRules.length > 0 ? applyCustomRules(content, customRules) : [];
      const detected = [...smartDetections, ...customDetections];
      console.log('[DEBUG] Smart detections:', smartDetections.length, 'Custom:', customDetections.length, 'Total:', detected.length);
      
      // Check if aborted
      if (signal.aborted) return;
      
      onPIIDetected(detected, content, file, detectedType);
    } catch (err) {
      if (err.name === 'AbortError') return;
      showError(err.message || 'Failed to read file');
      setError(err.message);
      setText('');
      onPIIDetected([], '', null, null);
    } finally {
      if (!signal.aborted) {
        setIsProcessing(false);
      }
    }
  }, [customRules, onPIIDetected, detectWithML]);

  // Sample resume text
  const loadSampleResume = useCallback(async () => {
    const sample = `John Smith
Email: john.smith@email.com
Phone: (555) 123-4567
LinkedIn: linkedin.com/in/johnsmith
Location: San Francisco, California

PROFESSIONAL SUMMARY
Experienced software engineer with 5+ years in full-stack development. Proven track record at Google and Microsoft.

EXPERIENCE

Senior Software Engineer - Google Inc.
San Francisco, CA | 2020 - Present
• Led development of cloud infrastructure projects
• Managed team of 5 engineers
• Contact: tech-team@google.com

Software Developer - Microsoft Corporation
Seattle, WA | 2018 - 2020
• Developed enterprise applications
• Collaborated with product teams

EDUCATION

B.S. Computer Science - Stanford University
Palo Alto, California | 2014 - 2018

SKILLS
JavaScript, React, Node.js, Python, AWS, Docker`;

    setText(sample);
    setUploadedFile(null);
    setFileType('txt');
    
    try {
      setIsProcessing(true);
      // Use unified smart detection pipeline
      const mlFn = detectWithML && !modelError ? detectWithML : null;
      const smartDetections = await detectSmartPII(sample, mlFn);
      const customDetections = customRules.length > 0 ? applyCustomRules(sample, customRules) : [];
      const detected = [...smartDetections, ...customDetections];
      onPIIDetected(detected, sample, null, 'txt');
    } catch (err) {
      showError('Error detecting PII in sample resume');
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [customRules, onPIIDetected, detectWithML]);

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-black">
      {/* AI Model Loading Overlay - Clean Dark Theme */}
      {isModelLoading && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
                <Download className="w-8 h-8 text-white/80" />
              </div>
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-bold text-white text-center mb-2">Downloading AI Model</h3>
            <p className="text-sm text-zinc-400 text-center mb-6">
              One-time download • ~8MB • Cached for future use
            </p>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-white/80 transition-all duration-300 ease-out"
                  style={{ width: `${modelProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-zinc-500 font-mono">{Math.round(modelProgress)}%</p>
                <p className="text-xs text-zinc-500">Initializing...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Model Download Notice */}
      {showModelNotice && !modelCached && !isModelLoading && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full p-8 shadow-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Download className="w-6 h-6 text-white/80" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">AI Model Required</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  To enable advanced name detection with AI, we need to download an 8MB model file. This is a <strong>one-time download</strong> and will be cached for future use.
                </p>
              </div>
            </div>

            <div className="bg-zinc-950 border border-white/5 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-zinc-300">100% offline after download</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-zinc-300">Cached in your browser permanently</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-zinc-300">Higher accuracy for name detection</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span className="text-zinc-300">Requires internet connection for first-time download</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModelNotice(false);
                  localStorage.setItem('modelNoticeDismissed', 'true');
                  showSuccess('AI detection enabled. Upload a document to begin.');
                }}
                className="w-full px-4 py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-all"
              >
                Continue
              </button>
            </div>

            <p className="text-xs text-zinc-600 text-center mt-4 font-mono">
              Model: Xenova/bert-base-NER • Size: ~8MB
            </p>
          </div>
        </div>
      )}

      {!text ? (
        // Empty State - Premium Upload Zone
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex-1 flex items-center justify-center p-4 md:p-8"
        >
          <div className={`relative w-full max-w-4xl transition-all duration-300 ${isDragging ? 'scale-[0.98]' : ''}`}>
            {/* Animated gradient border */}
            <div className={`absolute -inset-[1px] rounded-3xl transition-all duration-300 ${isDragging
              ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500 opacity-100'
              : 'bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 opacity-50'
              }`}></div>

            <div className={`relative bg-zinc-950 rounded-3xl p-8 md:p-16 transition-all duration-300 ${isDragging ? 'bg-red-500/5' : ''
              }`}>
              <div className="text-center space-y-6 md:space-y-8">
                {/* Icon */}
                <div className="flex justify-center">
                  <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-white/10 transition-all duration-300 ${isDragging ? 'scale-110 border-red-500/50' : ''
                    }`}>
                    <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                </div>

                {/* Heading */}
                <div>
                  <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 md:mb-4 tracking-tight">
                    Upload Document
                  </h1>
                  <p className="text-sm md:text-lg text-zinc-400 max-w-md mx-auto leading-relaxed px-4">
                    Drag and drop your file or click to browse. All processing happens locally. Your data never leaves your device.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 pt-2 md:pt-4">
                  <label className="group cursor-pointer w-full sm:w-auto">
                    <input
                      type="file"
                      accept=".txt,.pdf,.docx"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    <div className="px-6 md:px-8 py-3 md:py-4 bg-white text-black font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 text-center">
                      Browse Files
                    </div>
                  </label>

                  <button
                    onClick={loadSampleResume}
                    className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-zinc-900 text-white font-semibold rounded-2xl border border-white/10 hover:border-white/20 hover:bg-zinc-800 transition-all duration-200"
                  >
                    Try Sample Resume
                  </button>
                </div>

                {/* Features */}
                <div className="grid grid-cols-3 gap-6 pt-8 max-w-2xl mx-auto">
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <p className="text-xs text-zinc-500 font-mono font-medium">Local Processing</p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-xs text-zinc-500 font-mono font-medium">Zero Uploads</p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-xs text-zinc-500 font-mono font-medium">Instant Analysis</p>
                  </div>
                </div>

                {/* Supported formats */}
                <p className="text-xs text-zinc-600 font-mono uppercase tracking-wider pt-4">
                  Supports .TXT • .PDF • .DOCX
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Editor View - Full Screen Premium Editor
        <div className="flex-1 flex flex-col h-full">
          {/* Compact Header Bar */}
          <div className="flex-shrink-0 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
            <div className="max-w-full mx-auto px-4 lg:px-6 py-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {/* File Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-white truncate max-w-[200px]">
                    {uploadedFile ? uploadedFile.name : 'Untitled Document'}
                  </span>
                  {fileType && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded font-mono flex-shrink-0">
                      {fileType}
                    </span>
                  )}
                </div>

                {/* Stats */}
                {detectedPII.length > 0 && (
                  <>
                    <div className="hidden sm:block h-4 w-px bg-white/10"></div>
                    <div className="hidden sm:flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                      <span className="text-xs text-zinc-400 font-mono">
                        <span className="text-white font-semibold">{detectedPII.filter(p => p.redact).length}</span>
                        <span className="text-zinc-600 mx-0.5">/</span>
                        {detectedPII.length} PII
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                {isProcessing && (
                  <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium font-mono bg-zinc-800/80 px-3 py-1.5 rounded-lg">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span className="hidden sm:inline">Analyzing...</span>
                  </div>
                )}

                {uploadedFile && (
                  <button
                    onClick={() => {
                      setUploadedFile(null);
                      setFileType(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 rounded-lg transition-all"
                  >
                    Clear File
                  </button>
                )}

                <button
                  onClick={loadSampleResume}
                  className="hidden sm:block px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 rounded-lg transition-all"
                >
                  Load Sample
                </button>

                <div className="h-4 w-px bg-white/10"></div>

                <button
                  onClick={() => {
                    setText('');
                    setUploadedFile(null);
                    setFileType(null);
                    onPIIDetected([], '', null, null);
                  }}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Clear & Start Over"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Editor Canvas */}
          <div className="flex-1 min-h-0 bg-black">
            <div className="h-full max-w-full mx-auto">
              <div className="relative h-full bg-zinc-950 overflow-hidden">
                {text && detectedPII.length > 0 ? (
                  // Document Viewer - Shows document with PII highlights (for both uploaded files and manual text)
                  <DocumentViewer
                    file={uploadedFile}
                    fileType={fileType || 'txt'}
                    text={text}
                    detectedPII={detectedPII}
                    onTogglePII={onTogglePII}
                    selectedPIIId={selectedPIIId}
                    onSelectPII={onSelectPII}
                  />
                ) : uploadedFile ? (
                  // Document Viewer - Shows original document without highlights (no PII detected yet)
                  <DocumentViewer
                    file={uploadedFile}
                    fileType={fileType}
                    text={text}
                    detectedPII={[]}
                    onTogglePII={onTogglePII}
                    selectedPIIId={selectedPIIId}
                    onSelectPII={onSelectPII}
                  />
                ) : (
                  // Text Editor - For manual text input
                  <div className="relative h-full">
                    <textarea
                      value={text}
                      onChange={handleTextChange}
                      className="absolute inset-0 w-full h-full p-6 font-mono text-[14px] leading-relaxed resize-none focus:outline-none bg-zinc-950 text-zinc-200 caret-red-500 selection:bg-red-500/20 placeholder:text-zinc-700"
                      placeholder="Start typing or paste your document here..."
                      spellCheck="false"
                      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Redactor.propTypes = {
  onPIIDetected: PropTypes.func.isRequired,
  detectedPII: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    start: PropTypes.number.isRequired,
    end: PropTypes.number.isRequired,
  })).isRequired,
  isPro: PropTypes.bool.isRequired,
  onTogglePII: PropTypes.func.isRequired,
  sidebarOpen: PropTypes.bool,
  onToggleSidebar: PropTypes.func,
  selectedPIIId: PropTypes.string,
  onSelectPII: PropTypes.func,
};

export default Redactor;
