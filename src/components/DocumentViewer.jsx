import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';
import { highlightPII } from '../utils/piiDetector';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

function DocumentViewer({ file, fileType, text, detectedPII, onTogglePII }) {
  const [docxHtml, setDocxHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfPages, setPdfPages] = useState([]); // Array of { canvas, textItems, viewport }
  const contentRef = useRef(null);
  const pdfContainerRef = useRef(null);

  useEffect(() => {
    if (fileType === 'docx' && file) {
      renderDOCX();
    } else if (fileType === 'pdf' && file) {
      renderPDF();
    }
  }, [file, fileType]);

  const renderDOCX = useCallback(async () => {
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ 
        arrayBuffer,
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh"
        ]
      });
      setDocxHtml(result.value);
    } catch (error) {
      setDocxHtml(`<p style="color: red;">Error: ${error.message}</p>`);
    } finally {
      setLoading(false);
    }
  }, [file]);

  const renderPDF = useCallback(async () => {
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];
      const scale = 1.5; // Render at 1.5x for crisp text

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        // Render page to canvas
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Get text content with positions
        const textContent = await page.getTextContent();

        pages.push({
          dataUrl: canvas.toDataURL(),
          width: viewport.width,
          height: viewport.height,
          textItems: textContent.items.map(item => ({
            str: item.str,
            // Transform position from PDF space to canvas space
            x: item.transform[4] * scale,
            y: viewport.height - (item.transform[5] * scale) - (item.height * scale || 12 * scale),
            width: item.width * scale,
            height: (item.height || 12) * scale,
          }))
        });
      }

      setPdfPages(pages);
    } catch (error) {
      console.error('PDF render error:', error);
      setPdfPages([]);
    } finally {
      setLoading(false);
    }
  }, [file]);

  // Find which text items in a PDF page match a PII detection
  const getPdfPIIOverlays = useCallback((textItems) => {
    if (!detectedPII || detectedPII.length === 0 || !textItems) return [];

    const overlays = [];
    // Build a running text from items to find PII positions
    let runningText = '';
    const itemPositions = []; // maps char position to text item index

    textItems.forEach((item, idx) => {
      const start = runningText.length;
      runningText += item.str;
      itemPositions.push({ start, end: runningText.length, idx });
      // Add space between items unless item ends with space
      if (!item.str.endsWith(' ')) {
        runningText += ' ';
      }
    });

    detectedPII.forEach(pii => {
      if (!pii.value) return;
      // Search for the PII value in the running text
      let searchFrom = 0;
      while (searchFrom < runningText.length) {
        const idx = runningText.indexOf(pii.value, searchFrom);
        if (idx === -1) break;

        const piiEnd = idx + pii.value.length;

        // Find all text items that overlap with this PII match
        const matchingItems = itemPositions.filter(
          ip => ip.start < piiEnd && ip.end > idx
        );

        if (matchingItems.length > 0) {
          // Use bounding box of all matching items
          const firstItem = textItems[matchingItems[0].idx];
          const lastItem = textItems[matchingItems[matchingItems.length - 1].idx];

          overlays.push({
            pii,
            x: firstItem.x,
            y: firstItem.y,
            width: (lastItem.x + lastItem.width) - firstItem.x,
            height: Math.max(...matchingItems.map(m => textItems[m.idx].height)),
          });
        }

        searchFrom = idx + 1;
      }
    });

    return overlays;
  }, [detectedPII]);

  const formatText = useCallback((content) => {
    const lines = content.split('\n');
    let formatted = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!trimmed) {
        formatted += '<br/>';
        continue;
      }
      
      formatted += `<p style="margin: 0.2em 0; line-height: 1.5;">${line}</p>`;
    }
    
    return formatted;
  }, []);

  const getHighlightedContent = useCallback(() => {
    if (!text) return '';
    if (!detectedPII || detectedPII.length === 0) {
      return formatText(text);
    }
    const highlighted = highlightPII(text, detectedPII);
    return formatText(highlighted);
  }, [text, detectedPII, formatText]);

  const getHighlightedDOCXContent = useCallback(() => {
    if (!docxHtml || !detectedPII || detectedPII.length === 0) {
      return docxHtml;
    }

    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = docxHtml;

    // Process each PII detection
    detectedPII.forEach((pii) => {
      if (!pii.value) return;

      // Walk through all text nodes and replace matches
      const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      const nodesToProcess = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.includes(pii.value)) {
          nodesToProcess.push(node);
        }
      }

      // Process nodes (do this after walking to avoid modification during traversal)
      nodesToProcess.forEach((node) => {
        const nodeText = node.nodeValue;
        const index = nodeText.indexOf(pii.value);
        
        if (index === -1) return;

        const before = nodeText.substring(0, index);
        const match = pii.value;
        const after = nodeText.substring(index + match.length);

        // Create mark element with styling
        const colorClass = pii.redact 
          ? `px-1 rounded cursor-pointer transition-colors ${getPIIColorClass(pii.type)}`
          : 'px-1 rounded cursor-pointer transition-colors bg-gray-200 line-through opacity-50';
        
        const title = `${pii.type}: ${pii.redact ? 'Will be redacted' : 'Ignored'} → ${pii.suggested}`;
        
        const mark = document.createElement('mark');
        mark.className = colorClass;
        mark.setAttribute('title', title);
        mark.setAttribute('data-pii-id', pii.id);
        mark.textContent = match;

        // Replace text node with fragments
        const parent = node.parentNode;
        if (parent) {
          if (before) parent.insertBefore(document.createTextNode(before), node);
          parent.insertBefore(mark, node);
          if (after) parent.insertBefore(document.createTextNode(after), node);
          parent.removeChild(node);
        }
      });
    });

    return tempDiv.innerHTML;
  }, [docxHtml, detectedPII]);

  const getPIIColorClass = (type) => {
    const colorMap = {
      'email': 'bg-blue-200',
      'phone': 'bg-green-200',
      'name': 'bg-red-200',
      'url': 'bg-purple-200',
      'address': 'bg-orange-200',
      'ssn': 'bg-yellow-200',
      'credit_card': 'bg-pink-200',
      'dob': 'bg-indigo-200',
      'passport': 'bg-cyan-200',
      'ip': 'bg-teal-200',
      'bank_account': 'bg-rose-200',
      'tax_id': 'bg-amber-200',
      'age': 'bg-lime-200'
    };
    return colorMap[type] || 'bg-gray-200';
  };

  const handlePIIClick = useCallback((e) => {
    const target = e.target;
    if (target.tagName === 'MARK' && target.hasAttribute('data-pii-id')) {
      const piiId = target.getAttribute('data-pii-id');
      if (onTogglePII) {
        onTogglePII(piiId);
      }
    }
  }, [onTogglePII]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white text-sm font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white h-full" onClick={handlePIIClick}>
      <div className="max-w-4xl mx-auto p-8 pb-20" ref={contentRef}>
        {fileType === 'pdf' && pdfPages.length > 0 ? (
          <div ref={pdfContainerRef} className="pdf-canvas-content">
            {pdfPages.map((page, pageIdx) => (
              <div 
                key={pageIdx} 
                className="relative mb-4 bg-white shadow-lg mx-auto"
                style={{ width: page.width, maxWidth: '100%' }}
              >
                <img 
                  src={page.dataUrl} 
                  alt={`Page ${pageIdx + 1}`} 
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  draggable={false}
                />
                {/* PII overlay layer */}
                <div 
                  className="absolute inset-0" 
                  style={{ pointerEvents: 'none' }}
                >
                  {getPdfPIIOverlays(page.textItems).map((overlay, oidx) => {
                    const scaleX = 100 / page.width; // percent
                    return (
                      <div
                        key={oidx}
                        data-pii-id={overlay.pii.id}
                        title={`${overlay.pii.type}: ${overlay.pii.redact ? 'Will be redacted' : 'Ignored'} → ${overlay.pii.suggested}`}
                        className={`absolute cursor-pointer transition-colors ${
                          overlay.pii.redact 
                            ? getPIIColorClass(overlay.pii.type)
                            : 'bg-gray-200 line-through opacity-50'
                        }`}
                        style={{
                          left: `${overlay.x * scaleX}%`,
                          top: `${(overlay.y / page.height) * 100}%`,
                          width: `${overlay.width * scaleX}%`,
                          height: `${(overlay.height / page.height) * 100}%`,
                          opacity: 0.4,
                          pointerEvents: 'auto',
                          borderRadius: '2px',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : fileType === 'docx' && docxHtml ? (
          <div 
            className="docx-content bg-white rounded-lg shadow-lg p-8"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getHighlightedDOCXContent(), {
              ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 'br', 'mark', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'tbody', 'thead', 'span', 'div'],
              ALLOWED_ATTR: ['class', 'title', 'data-pii-id', 'style'],
              KEEP_CONTENT: true
            }) }}
          />
        ) : (
          <div 
            className="txt-content bg-white rounded-lg shadow-lg p-8"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getHighlightedContent()) }}
          />
        )}
      </div>

      <style>{`
        mark {
          padding: 2px 4px;
          border-radius: 3px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        mark:hover {
          opacity: 0.8;
        }

        mark[data-type="email"] {
          background-color: rgba(59, 130, 246, 0.3);
          color: rgb(30, 64, 175);
        }

        mark[data-type="phone"] {
          background-color: rgba(34, 197, 94, 0.3);
          color: rgb(21, 128, 61);
        }

        mark[data-type="name"] {
          background-color: rgba(239, 68, 68, 0.3);
          color: rgb(153, 27, 27);
        }

        mark[data-type="url"] {
          background-color: rgba(168, 85, 247, 0.3);
          color: rgb(107, 33, 168);
        }

        .docx-content,
        .txt-content {
          font-family: Arial, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #1a1a1a;
        }
      `}</style>
    </div>
  );
}

DocumentViewer.propTypes = {
  file: PropTypes.object,
  fileType: PropTypes.oneOf(['pdf', 'docx', 'txt']),
  text: PropTypes.string.isRequired,
  detectedPII: PropTypes.array.isRequired,
  onTogglePII: PropTypes.func
};

export default DocumentViewer;
