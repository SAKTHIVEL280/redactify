import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { replacePII, getPIIStats, PII_TYPES } from '../utils/piiDetector';
import { exportAsTXT, exportAsDOCX, exportAsPDF } from '../utils/exportUtils';
import { verifyProStatus } from '../utils/proLicenseDB';
import { showError } from '../utils/toast';
import { X } from 'lucide-react';

function Sidebar({ piiItems, onTogglePII, originalText, onUpgradeClick, uploadedFile, fileType, onClose }) {
  const [isPro, setIsPro] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const checkProStatus = async () => {
      const isProUser = await verifyProStatus();
      setIsPro(isProUser);
    };
    checkProStatus();
  }, []);

  const stats = getPIIStats(piiItems);

  const handleToggle = (id) => {
    onTogglePII(id);
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
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="w-full lg:w-96 bg-zinc-900 lg:bg-zinc-900/50 border-l border-white/10 flex flex-col h-full font-sans backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-white/10 bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest font-mono">
              Analysis
            </h2>
            <div className="hidden lg:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-medium text-zinc-400 font-mono">Active</span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      {/* PII List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {piiItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="text-sm font-medium text-white mb-2">No Sensitive Data Found</div>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-[200px]">
              Upload a document or paste text to begin the automatic detection process.
            </p>
          </div>
        ) : (
          piiItems.map((item) => (
            <div
              key={item.id}
              className={`group relative p-3 rounded-lg border transition-all duration-200 ${item.redact
                ? 'bg-zinc-900/80 border-white/10 shadow-sm'
                : 'bg-zinc-950/50 border-zinc-800/50 opacity-60 hover:opacity-100'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${item.redact ? getTypeColor(item.type) : 'bg-zinc-600'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                      {item.type}
                    </span>
                    {/* Status indicator */}
                    <span className={`ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.redact 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                    }`}>
                      {item.redact ? 'Redacting' : 'Ignored'}
                    </span>
                  </div>
                  <div className={`text-xs font-mono break-all leading-tight ${item.redact ? 'text-white' : 'text-zinc-500 line-through'}`}>
                    {item.value}
                  </div>
                </div>

                <button
                  onClick={() => handleToggle(item.id)}
                  className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors font-mono ${item.redact
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                    : 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/50'
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
      <div className="p-3 bg-zinc-900/50 border-t border-white/10 backdrop-blur-sm flex-shrink-0">
        <div className="space-y-2">
          <button
            onClick={handleExportTXT}
            disabled={stats.accepted === 0}
            className="w-full px-3 py-2 bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium flex items-center justify-between group"
          >
            <span>Export as Text</span>
            <span className="text-[9px] font-bold text-zinc-500 group-hover:text-zinc-400 transition-colors font-mono">.TXT</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportDOCX}
              disabled={exporting || stats.accepted === 0}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5 border ${isPro
                ? 'bg-white text-black border-transparent hover:bg-zinc-200 shadow-lg'
                : 'bg-zinc-900/80 text-zinc-600 border-white/10 hover:border-white/20'
                }`}
            >
              <span>Word</span>
              {!isPro && <span className="text-[8px] uppercase tracking-wider font-bold text-red-500 font-mono">Pro</span>}
            </button>

            <button
              onClick={handleExportPDF}
              disabled={exporting || stats.accepted === 0}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5 border ${isPro
                ? 'bg-white text-black border-transparent hover:bg-zinc-200 shadow-lg'
                : 'bg-zinc-900/80 text-zinc-600 border-white/10 hover:border-white/20'
                }`}
            >
              <span>PDF</span>
              {!isPro && <span className="text-[8px] uppercase tracking-wider font-bold text-red-500 font-mono">Pro</span>}
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
  originalText: PropTypes.string.isRequired,
  onUpgradeClick: PropTypes.func,
  uploadedFile: PropTypes.object,
  fileType: PropTypes.oneOf(['pdf', 'docx', 'txt']),
  onClose: PropTypes.func,
};

export default Sidebar;
