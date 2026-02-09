import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';
import { highlightPII } from '../utils/piiDetector';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker — use same CDN as piiDetector.js for consistency
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function DocumentViewer({ file, fileType, text, detectedPII, onTogglePII, selectedPIIId, onSelectPII }) {
  const [docxHtml, setDocxHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfPages, setPdfPages] = useState([]); // Array of { canvas, textItems, viewport }
  const contentRef = useRef(null);
  const pdfContainerRef = useRef(null);

  // Scroll to selected PII element when selectedPIIId changes (from sidebar click)
  useEffect(() => {
    if (selectedPIIId && contentRef.current) {
      const el = contentRef.current.querySelector(`[data-pii-id="${selectedPIIId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash highlight effect
        el.style.outline = '2px solid rgba(239, 68, 68, 0.8)';
        el.style.outlineOffset = '2px';
        el.style.transition = 'outline 0.3s ease';
        const timer = setTimeout(() => {
          el.style.outline = '';
          el.style.outlineOffset = '';
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedPIIId]);

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
          // Calculate precise overlay position within text items
          const firstMatch = matchingItems[0];
          const lastMatch = matchingItems[matchingItems.length - 1];
          const firstItem = textItems[firstMatch.idx];
          const lastItem = textItems[lastMatch.idx];

          // Calculate proportional X start within first item
          const firstItemChars = firstItem.str.length || 1;
          const charOffsetInFirst = Math.max(0, idx - firstMatch.start);
          const firstCharWidth = firstItem.width / firstItemChars;
          const overlayX = firstItem.x + (charOffsetInFirst * firstCharWidth);

          // Calculate proportional X end within last item
          const lastItemChars = lastItem.str.length || 1;
          const charOffsetInLast = Math.min(lastItemChars, piiEnd - lastMatch.start);
          const lastCharWidth = lastItem.width / lastItemChars;
          const overlayEndX = lastItem.x + (charOffsetInLast * lastCharWidth);

          overlays.push({
            pii,
            x: overlayX,
            y: firstItem.y,
            width: Math.max(overlayEndX - overlayX, firstCharWidth),
            height: Math.max(...matchingItems.map(m => textItems[m.idx].height)),
          });
        }

        searchFrom = idx + 1;
      }
    });

    return overlays;
  }, [detectedPII]);

  const formatText = useCallback((content) => {
    // Replace newlines with <br/> tags instead of splitting into <p> tags
    // This avoids breaking <mark> tags that span across line boundaries
    return content
      .replace(/\n\n+/g, '</p><p style="margin: 0.2em 0; line-height: 1.5;">')
      .replace(/\n/g, '<br/>')
      .replace(/^/, '<p style="margin: 0.2em 0; line-height: 1.5;">')
      .replace(/$/, '</p>');
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
        
        // Find ALL occurrences in this text node, not just the first
        const fragments = [];
        let lastIdx = 0;
        let searchIdx = 0;
        
        while (searchIdx < nodeText.length) {
          const index = nodeText.indexOf(pii.value, searchIdx);
          if (index === -1) break;
          
          // Text before this match
          if (index > lastIdx) {
            fragments.push({ type: 'text', content: nodeText.substring(lastIdx, index) });
          }
          
          // The match itself
          fragments.push({ type: 'mark', content: pii.value });
          
          lastIdx = index + pii.value.length;
          searchIdx = lastIdx;
        }
        
        // Remaining text after all matches
        if (lastIdx < nodeText.length) {
          fragments.push({ type: 'text', content: nodeText.substring(lastIdx) });
        }
        
        if (fragments.length === 0 || !fragments.some(f => f.type === 'mark')) return;

        // Create mark element with styling
        const colorClass = pii.redact 
          ? `px-1 rounded cursor-pointer transition-colors ${getPIIColorClass(pii.type)}`
          : 'px-1 rounded cursor-pointer transition-colors bg-gray-200 line-through opacity-50';
        
        const title = `${pii.type}: ${pii.redact ? 'Will be redacted' : 'Ignored'} → ${pii.suggested}`;

        // Replace text node with fragments
        const parent = node.parentNode;
        if (parent) {
          fragments.forEach(fragment => {
            if (fragment.type === 'text') {
              parent.insertBefore(document.createTextNode(fragment.content), node);
            } else {
              const mark = document.createElement('mark');
              mark.className = colorClass;
              mark.setAttribute('title', title);
              mark.setAttribute('data-pii-id', pii.id);
              mark.textContent = fragment.content;
              parent.insertBefore(mark, node);
            }
          });
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
      'ip_address': 'bg-teal-200',
      'bank_account': 'bg-rose-200',
      'tax_id': 'bg-amber-200',
      'age': 'bg-lime-200',
      'custom': 'bg-fuchsia-200'
    };
    return colorMap[type] || 'bg-gray-200';
  };

  const handlePIIClick = useCallback((e) => {
    const target = e.target.closest('[data-pii-id]') || e.target;
    if (target && target.hasAttribute('data-pii-id')) {
      const piiId = target.getAttribute('data-pii-id');
      // Only select/highlight — do NOT toggle redaction state on click.
      // Users toggle redaction from the sidebar, not by clicking in the document.
      if (onSelectPII) {
        onSelectPII(piiId);
      }
    }
  }, [onSelectPII]);

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
          outline: 1px solid rgba(0,0,0,0.1);
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

        .docx-content p,
        .txt-content p {
          margin: 0.3em 0;
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
  onTogglePII: PropTypes.func,
  selectedPIIId: PropTypes.string,
  onSelectPII: PropTypes.func,
};

export default DocumentViewer;
