import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { replacePII, getPIIStats, PII_TYPES } from '../utils/piiDetector';
import { exportAsTXT, exportAsDOCX, exportAsPDF } from '../utils/exportUtils';
import { verifyProStatus } from '../utils/proLicenseDB';
import { showError, showSuccess } from '../utils/toast';
import { X, Undo2 } from 'lucide-react';

function Sidebar({ piiItems, onTogglePII, onBulkSetPII, originalText, onUpgradeClick, uploadedFile, fileType, onClose, selectedPIIId, onSelectPII }) {
  const [isPro, setIsPro] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [undoState, setUndoState] = useState(null); // { previousStates: [...], timeoutId }
  const selectedItemRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const checkProStatus = async () => {
      const isProUser = await verifyProStatus();
      setIsPro(isProUser);
    };
    checkProStatus();
  }, []);

  // Auto-scroll to selected item from document click
  useEffect(() => {
    if (selectedPIIId && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedPIIId]);

  // Clean up undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoState?.timeoutId) clearTimeout(undoState.timeoutId);
    };
  }, [undoState]);

  const stats = getPIIStats(piiItems);
  const redactCount = piiItems.filter(p => p.redact).length;

  const handleToggle = (id) => {
    onTogglePII(id);
  };

  const handleBulkAction = (redactValue) => {
    // Save current state for undo
    const previousStates = piiItems.map(p => ({ id: p.id, redact: p.redact }));
    
    // Clear any existing undo timeout
    if (undoState?.timeoutId) clearTimeout(undoState.timeoutId);

    onBulkSetPII(redactValue);

    // Set undo state with auto-dismiss
    const timeoutId = setTimeout(() => setUndoState(null), 5000);
    setUndoState({ previousStates, timeoutId });
  };

  const handleUndo = () => {
    if (undoState?.previousStates) {
      undoState.previousStates.forEach(prev => {
        const current = piiItems.find(p => p.id === prev.id);
        if (current && current.redact !== prev.redact) {
          onTogglePII(prev.id);
        }
      });
      if (undoState.timeoutId) clearTimeout(undoState.timeoutId);
      setUndoState(null);
      showSuccess('Bulk action undone');
    }
  };

  const handleExportTXT = () => {
    const redacted = replacePII(originalText, piiItems);
    const filename = uploadedFile ? uploadedFile.name : null;
    exportAsTXT(redacted, filename);
  };

  const handleExportDOCX = async () => {
    if (!isPro) {
      if (onUpgradeClick) onUpgradeClick();
      return;
    }

    setExporting(true);
    try {
      const redacted = replacePII(originalText, piiItems);
      const filename = uploadedFile ? uploadedFile.name : null;
      const result = await exportAsDOCX(redacted, filename, uploadedFile, piiItems);
      if (!result.success) {
        showError(`Failed to export DOCX: ${result.error}`);
      } else if (result.preservedFormat) {
        showSuccess('Exported with original formatting preserved');
      }
    } catch (error) {
      showError(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!isPro) {
      if (onUpgradeClick) onUpgradeClick();
      return;
    }

    setExporting(true);
    try {
      const redacted = replacePII(originalText, piiItems);
      const filename = uploadedFile ? uploadedFile.name : null;
      const result = await exportAsPDF(redacted, uploadedFile, piiItems, isPro, filename);
      if (!result.success) {
        showError(`Failed to export PDF: ${result.error}`);
      }
    } catch (error) {
      showError(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case PII_TYPES.EMAIL: return 'bg-blue-500';
      case PII_TYPES.PHONE: return 'bg-green-500';
      case PII_TYPES.URL: return 'bg-purple-500';
      case PII_TYPES.NAME: return 'bg-red-500';
      case PII_TYPES.ADDRESS: return 'bg-orange-500';
      case PII_TYPES.SSN: return 'bg-yellow-500';
      case PII_TYPES.CREDIT_CARD: return 'bg-pink-500';
      case PII_TYPES.DATE_OF_BIRTH: return 'bg-indigo-500';
      case PII_TYPES.PASSPORT: return 'bg-cyan-500';
      case PII_TYPES.IP_ADDRESS: return 'bg-teal-500';
      case PII_TYPES.BANK_ACCOUNT: return 'bg-rose-500';
      case PII_TYPES.TAX_ID: return 'bg-amber-500';
      case PII_TYPES.AGE: return 'bg-lime-500';
      case 'custom': return 'bg-fuchsia-500';
      default: return 'bg-zinc-500';
    }
  };

  return (
    <div className="w-full lg:w-96 bg-zinc-900 lg:bg-zinc-900/50 border-l border-white/10 flex flex-col h-full font-sans backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 lg:px-5 py-3 border-b border-white/10 bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-widest font-mono">
              Analysis
            </h2>
            {piiItems.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[10px] font-medium text-zinc-500 font-mono">{piiItems.length} found</span>
              </div>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      {/* PII Summary Bar */}
      {piiItems.length > 0 && (
        <div className="px-4 lg:px-5 py-2.5 border-b border-white/5 bg-zinc-950/30">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
              <span className="text-zinc-400">
                <span className="text-red-400 font-semibold">{redactCount}</span> redacting
              </span>
            </div>
            <span className="text-zinc-600">
              {piiItems.length - redactCount} ignored
            </span>
          </div>
        </div>
      )}

      {/* Bulk Actions + Undo */}
      {piiItems.length > 0 && onBulkSetPII && (
        <div className="px-4 lg:px-5 py-2 border-b border-white/5">
          {undoState ? (
            <button
              onClick={handleUndo}
              className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider font-mono bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 rounded transition-colors"
            >
              <Undo2 className="w-3 h-3" />
              Undo Bulk Action
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction(true)}
                className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider font-mono bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded transition-colors"
              >
                Redact All
              </button>
              <button
                onClick={() => handleBulkAction(false)}
                className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider font-mono bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 border border-zinc-700/50 rounded transition-colors"
              >
                Ignore All
              </button>
            </div>
          )}
        </div>
      )}

      {/* PII List */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {piiItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
              <div className="w-5 h-5 rounded-full border-2 border-zinc-600 border-dashed"></div>
            </div>
            <div className="text-sm font-medium text-zinc-300 mb-1.5">No Sensitive Data Found</div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-[220px]">
              Upload a document or paste text to begin automatic detection.
            </p>
          </div>
        ) : (
          piiItems.map((item) => (
            <div
              key={item.id}
              ref={item.id === selectedPIIId ? selectedItemRef : null}
              onClick={() => onSelectPII && onSelectPII(item.id)}
              className={`group relative p-2.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                item.id === selectedPIIId
                  ? 'bg-zinc-800/80 border-white/20 ring-1 ring-white/5'
                  : item.redact
                    ? 'bg-zinc-900/60 border-white/5 hover:border-white/10'
                    : 'bg-zinc-950/30 border-zinc-800/30 opacity-50 hover:opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.redact ? getTypeColor(item.type) : 'bg-zinc-600'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                      {item.type}
                    </span>
                    <span className={`ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.redact 
                      ? 'bg-red-500/10 text-red-400/80' 
                      : 'bg-zinc-800/50 text-zinc-600'
                    }`}>
                      {item.redact ? 'Redact' : 'Skip'}
                    </span>
                  </div>
                  <div className={`text-xs font-mono break-all leading-snug ${item.redact ? 'text-zinc-200' : 'text-zinc-600 line-through'}`}>
                    {item.value}
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleToggle(item.id); }}
                  className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors font-mono ${item.redact
                    ? 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 border border-zinc-700/50'
                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                  }`}
                >
                  {item.redact ? 'Ignore' : 'Redact'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Export Section */}
      <div className="p-3 bg-zinc-900/50 border-t border-white/5 backdrop-blur-sm flex-shrink-0">
        <div className="space-y-1.5">
          <button
            onClick={handleExportTXT}
            disabled={stats.accepted === 0}
            className="w-full px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-white rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium flex items-center justify-between"
          >
            <span>Export as Text</span>
            <span className="text-[9px] font-bold text-zinc-500 font-mono">.TXT</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleExportDOCX}
              disabled={exporting || stats.accepted === 0}
              title={isPro ? "Export as Word document" : "Upgrade to Pro to export as Word"}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5 border ${isPro
                ? 'bg-white text-black border-transparent hover:bg-zinc-200 shadow-lg'
                : 'bg-zinc-800/50 text-zinc-500 border-white/5 hover:border-white/10'
              } ${exporting ? 'opacity-70 cursor-wait' : ''}`}
            >
              {exporting ? <span className="text-[10px]">Exporting...</span> : <span>Word</span>}
              {!isPro && !exporting && <span className="text-[8px] uppercase tracking-wider font-bold text-red-500 font-mono">Pro</span>}
            </button>

            <button
              onClick={handleExportPDF}
              disabled={exporting || stats.accepted === 0}
              title={isPro ? "Export as PDF" : "Upgrade to Pro to export as PDF"}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5 border ${isPro
                ? 'bg-white text-black border-transparent hover:bg-zinc-200 shadow-lg'
                : 'bg-zinc-800/50 text-zinc-500 border-white/5 hover:border-white/10'
              } ${exporting ? 'opacity-70 cursor-wait' : ''}`}
            >
              {exporting ? <span className="text-[10px]">Exporting...</span> : <span>PDF</span>}
              {!isPro && !exporting && <span className="text-[8px] uppercase tracking-wider font-bold text-red-500 font-mono">Pro</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Sidebar.propTypes = {
  piiItems: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    redact: PropTypes.bool.isRequired,
    start: PropTypes.number.isRequired,
    end: PropTypes.number.isRequired,
  })).isRequired,
  onTogglePII: PropTypes.func.isRequired,
  onBulkSetPII: PropTypes.func,
  originalText: PropTypes.string.isRequired,
  onUpgradeClick: PropTypes.func,
  uploadedFile: PropTypes.object,
  fileType: PropTypes.oneOf(['pdf', 'docx', 'txt']),
  onClose: PropTypes.func,
  selectedPIIId: PropTypes.string,
  onSelectPII: PropTypes.func,
};

export default Sidebar;
