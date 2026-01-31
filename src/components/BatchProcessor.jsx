import React, { useState, useCallback } from 'react';
import { X, Upload, FileText, Download, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { detectPII, extractTextFromInput, replacePII, highlightPII, PII_COLORS } from '../utils/piiDetector';
import { getEnabledCustomRules } from '../utils/customRulesDB';
import { exportBatchAsZip } from '../utils/batchExportUtils';

export default function BatchProcessor({ isOpen, onClose }) {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [reviewingFile, setReviewingFile] = useState(null); // File being reviewed
  const [showClearConfirm, setShowClearConfirm] = useState(false); // Confirmation modal

  const handleFileSelect = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    const newFiles = selectedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      status: 'pending', // pending, processing, complete, error
      piiDetected: 0,
      originalText: null,
      piiItems: [],
      error: null
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const newFiles = droppedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      status: 'pending',
      piiDetected: 0,
      originalText: null,
      piiItems: [],
      error: null
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const processAllFiles = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setProgress({ current: 0, total: files.length });

    // Load custom rules once
    const customRules = await getEnabledCustomRules();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      setProgress({ current: i + 1, total: files.length });
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'processing' } : f
      ));

      try {
        // Extract text from file
        const text = await extractTextFromInput(file.file);
        
        // Detect PII with custom rules
        const detected = detectPII(text, customRules);
        
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { 
                ...f, 
                status: 'complete',
                originalText: text,
                piiItems: detected,
                piiDetected: detected.filter(p => p.redact).length
              } 
            : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'error', error: error.message } 
            : f
        ));
      }

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setProcessing(false);
  };

  const handleExport = async (format) => {
    setExporting(true);
    
    try {
      const processedFiles = files
        .filter(f => f.status === 'complete')
        .map(f => ({
          name: f.name.replace(/\.[^/.]+$/, ''), // Remove extension
          originalText: f.originalText,
          piiItems: f.piiItems,
          redactedText: replacePII(f.originalText, f.piiItems)
        }));

      if (processedFiles.length === 0) {
        alert('No files to export. Process files first.');
        return;
      }

      await exportBatchAsZip(processedFiles, format);
    } catch (error) {
      alert('Export failed: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    setFiles([]);
    setProgress({ current: 0, total: 0 });
    setShowClearConfirm(false);
  };

  const handleTogglePII = (fileId, piiId) => {
    setFiles(prev => prev.map(file => {
      if (file.id === fileId) {
        const updatedPII = file.piiItems.map(item =>
          item.id === piiId ? { ...item, redact: !item.redact } : item
        );
        const updatedFile = {
          ...file,
          piiItems: updatedPII,
          piiDetected: updatedPII.filter(p => p.redact).length
        };
        
        // Also update reviewingFile if it's the same file
        if (reviewingFile && reviewingFile.id === fileId) {
          setReviewingFile(updatedFile);
        }
        
        return updatedFile;
      }
      return file;
    }));
  };

  const openFileReview = (file) => {
    if (file.status === 'complete') {
      setReviewingFile(file);
    }
  };

  const closeFileReview = () => {
    setReviewingFile(null);
  };

  // ESC key handler for review modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && reviewingFile) {
        closeFileReview();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [reviewingFile]);

  const getHighlightedText = (file) => {
    if (!file || !file.originalText) return '';
    
    // Use the proper highlightPII function from piiDetector
    // Filter only items marked for redaction
    const itemsToHighlight = file.piiItems.filter(pii => pii.redact);
    return highlightPII(file.originalText, itemsToHighlight);
  };

  const completedCount = files.filter(f => f.status === 'complete').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const totalPII = files.reduce((sum, f) => sum + f.piiDetected, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10 my-auto">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Batch Processing</h2>
            <p className="text-sm text-zinc-400">Process multiple documents at once</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Upload Zone */}
          {files.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-white/20 rounded-2xl p-16 text-center hover:border-red-500/50 hover:bg-white/5 transition-all cursor-pointer"
            >
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-white/10">
                  <Upload className="w-10 h-10 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Upload Multiple Files</h3>
              <p className="text-zinc-400 mb-6 max-w-md mx-auto">
                Drag and drop files here or click to browse. Supports .txt, .pdf, and .docx files.
              </p>
              <label className="inline-block cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept=".txt,.pdf,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="px-8 py-4 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-all">
                  Browse Files
                </div>
              </label>
            </div>
          ) : (
            <>
              {/* Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-zinc-800/50 border border-white/10 rounded-xl">
                  <div className="text-2xl font-bold text-white">{files.length}</div>
                  <div className="text-xs text-zinc-400 uppercase tracking-wider">Total Files</div>
                </div>
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <div className="text-2xl font-bold text-green-400">{completedCount}</div>
                  <div className="text-xs text-zinc-400 uppercase tracking-wider">Processed</div>
                </div>
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="text-2xl font-bold text-red-400">{totalPII}</div>
                  <div className="text-xs text-zinc-400 uppercase tracking-wider">PII Detected</div>
                </div>
                <div className="p-4 bg-zinc-800/50 border border-white/10 rounded-xl">
                  <div className="text-2xl font-bold text-white">{errorCount}</div>
                  <div className="text-xs text-zinc-400 uppercase tracking-wider">Errors</div>
                </div>
              </div>

              {/* Progress Bar */}
              {processing && (
                <div className="mb-6 p-4 bg-zinc-800/50 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-300 font-medium">
                      Processing {progress.current} of {progress.total}
                    </span>
                    <span className="text-sm text-zinc-400 font-mono">
                      {Math.round((progress.current / progress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Files List */}
              <div className="space-y-3 mb-6">
                {files.map(file => (
                  <div
                    key={file.id}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      file.status === 'complete' ? 'bg-green-500/5 border-green-500/20' :
                      file.status === 'error' ? 'bg-red-500/5 border-red-500/20' :
                      file.status === 'processing' ? 'bg-blue-500/5 border-blue-500/20' :
                      'bg-zinc-800/50 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {file.status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                        {file.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                        {file.status === 'processing' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
                        {file.status === 'pending' && <FileText className="w-5 h-5 text-zinc-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{file.name}</div>
                        {file.status === 'complete' && (
                          <div className="text-xs text-zinc-400">
                            {file.piiDetected} PII items will be redacted
                          </div>
                        )}
                        {file.status === 'error' && (
                          <div className="text-xs text-red-400">{file.error}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'complete' && (
                        <button
                          onClick={() => openFileReview(file)}
                          className="px-3 py-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-1.5 border border-white/10"
                          title="Review PII detections"
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </button>
                      )}
                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add More Files Button */}
              <label className="block mb-6 cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept=".txt,.pdf,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="px-6 py-3 bg-zinc-800 border border-white/10 text-white rounded-xl hover:bg-zinc-700 transition-all text-center font-medium">
                  + Add More Files
                </div>
              </label>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {files.length > 0 && (
          <div className="p-6 border-t border-white/10 bg-zinc-900/50">
            <div className="flex flex-col sm:flex-row gap-3">
              {!processing && completedCount < files.length && (
                <button
                  onClick={processAllFiles}
                  className="flex-1 px-6 py-4 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                >
                  <Loader2 className="w-5 h-5" />
                  Process All Files
                </button>
              )}
              
              {completedCount > 0 && !processing && (
                <>
                  <button
                    onClick={() => handleExport('txt')}
                    disabled={exporting}
                    className="flex-1 px-6 py-4 bg-zinc-800 border border-white/10 text-white rounded-xl font-bold hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Export as TXT (ZIP)
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exporting}
                    className="flex-1 px-6 py-4 bg-zinc-800 border border-white/10 text-white rounded-xl font-bold hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Export as PDF (ZIP)
                  </button>
                </>
              )}

              <button
                onClick={clearAll}
                disabled={processing}
                className="px-6 py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* File Review Modal */}
      {reviewingFile && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10 my-auto">
            
            {/* Review Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Review: {reviewingFile.name}</h3>
                <p className="text-sm text-zinc-400">
                  {reviewingFile.piiItems.filter(p => p.redact).length} of {reviewingFile.piiItems.length} items will be redacted
                </p>
              </div>
              <button
                onClick={closeFileReview}
                className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Review Content */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
              
              {/* Left: PII List */}
              <div className="p-6 border-r border-white/10 overflow-y-auto">
                <h4 className="text-lg font-bold text-white mb-4">Detected PII</h4>
                <div className="space-y-2">
                  {reviewingFile.piiItems.map(pii => (
                    <div
                      key={pii.id}
                      className={`p-3 rounded-lg border transition-all ${
                        pii.redact 
                          ? 'bg-red-500/10 border-red-500/30' 
                          : 'bg-zinc-800/50 border-white/10 opacity-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-white/10">
                              {pii.type}
                            </span>
                            {pii.redact ? (
                              <span className="text-xs text-red-400 font-medium">Will Redact</span>
                            ) : (
                              <span className="text-xs text-zinc-500 font-medium">Ignored</span>
                            )}
                          </div>
                          <div className="text-white font-medium break-all">{pii.value}</div>
                          <div className="text-xs text-zinc-400 mt-1">
                            Replace with: <span className="font-mono text-zinc-300">{pii.suggested}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleTogglePII(reviewingFile.id, pii.id)}
                          className={`flex-shrink-0 p-2 rounded-lg transition-all ${
                            pii.redact
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                          }`}
                          title={pii.redact ? 'Click to ignore' : 'Click to redact'}
                        >
                          {pii.redact ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Preview */}
              <div className="p-6 overflow-y-auto">
                <h4 className="text-lg font-bold text-white mb-4">Preview (Highlighted)</h4>
                <div 
                  className="bg-zinc-800/50 border border-white/10 rounded-xl p-4 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-mono"
                  dangerouslySetInnerHTML={{ __html: getHighlightedText(reviewingFile) }}
                />
              </div>
            </div>

            {/* Review Footer */}
            <div className="p-6 border-t border-white/10 bg-zinc-900/50 flex justify-between items-center">
              <div className="text-sm text-zinc-400">
                Click <Eye className="w-4 h-4 inline" /> to redact, <EyeOff className="w-4 h-4 inline" /> to ignore
              </div>
              <button
                onClick={closeFileReview}
                className="px-6 py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                Done Reviewing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full border border-white/10 overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Remove All Files?</h3>
              <p className="text-zinc-400 mb-8">
                This will remove all {files.length} file{files.length !== 1 ? 's' : ''} from the batch processor. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-6 py-3 bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearAll}
                  className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all"
                >
                  Remove All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
