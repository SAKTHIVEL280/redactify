import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';
import { highlightPII } from '../utils/piiDetector';

function DocumentViewer({ file, fileType, text, detectedPII, onTogglePII }) {
  const [docxHtml, setDocxHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (fileType === 'docx' && file) {
      renderDOCX();
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

  const handlePIIClick = useCallback((e) => {
    const target = e.target;
    if (target.tagName === 'MARK' && target.hasAttribute('data-id')) {
      const piiId = parseInt(target.getAttribute('data-id'));
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
        {fileType === 'docx' && docxHtml ? (
          <div 
            className="docx-content bg-white rounded-lg shadow-lg p-8"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(docxHtml) }}
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
