import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Sanitize text for PDF export by replacing unsupported Unicode characters
 * WinAnsi encoding only supports basic Latin characters
 */
function sanitizeForPDF(text) {
  if (!text) return '';
  
  // First normalize line endings (remove \r)
  let sanitized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Then replace other unsupported characters
  sanitized = sanitized
    .replace(/→/g, '->')  // Arrow
    .replace(/←/g, '<-')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    .replace(/—/g, '-')   // Em dash
    .replace(/–/g, '-')   // En dash
    .replace(/'/g, "'")   // Smart quotes
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/…/g, '...')  // Ellipsis
    .replace(/•/g, '*')   // Bullet
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control characters except \n and \t
    .replace(/[^\x00-\xFF]/g, '?'); // Replace any other non-Latin1 characters
  
  return sanitized;
}

/**
 * Export batch of files as ZIP
 * @param {Array} files - Array of {name, redactedText} objects
 * @param {string} format - 'txt' or 'pdf'
 */
export const exportBatchAsZip = async (files, format = 'txt') => {
  if (files.length === 0) {
    throw new Error('No files to export');
  }

  const zip = new JSZip();
  const timestamp = Date.now();

  if (format === 'txt') {
    // Add each text file to ZIP
    files.forEach((file, index) => {
      const filename = `${file.name}-redacted.txt`;
      zip.file(filename, file.redactedText);
    });

    // Generate and download ZIP
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `redacted-batch-${timestamp}.zip`);
  } else if (format === 'pdf') {
    // Generate PDFs and add to ZIP
    for (const file of files) {
      const pdfBytes = await generatePDFBytes(file.redactedText);
      const filename = `${file.name}-redacted.pdf`;
      zip.file(filename, pdfBytes);
    }

    // Generate and download ZIP
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `redacted-batch-${timestamp}.zip`);
  }
};

// Helper to generate PDF bytes
async function generatePDFBytes(text) {
  // Sanitize text to remove unsupported Unicode characters
  const sanitizedText = sanitizeForPDF(text);
  
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const bodySize = 10;
  const headingSize = 12;
  const nameSize = 14;
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const maxWidth = pageWidth - 2 * margin;
  const bodyLH = bodySize * 1.5;
  const headingLH = headingSize * 1.8;
  const nameLH = nameSize * 1.6;

  const SECTION_RE =
    /^(EDUCATION|EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT HISTORY|SKILLS|TECHNICAL SKILLS|CORE SKILLS|KEY SKILLS|CORE COMPETENCIES|PROJECTS|KEY PROJECTS|CERTIFICATIONS|AWARDS|ACHIEVEMENTS|SUMMARY|PROFESSIONAL SUMMARY|CAREER SUMMARY|OBJECTIVE|CAREER OBJECTIVE|PROFILE|PROFESSIONAL PROFILE|REFERENCES|CONTACT|PUBLICATIONS|LANGUAGES|INTERESTS|HOBBIES|TRAINING|ACTIVITIES)$/i;
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  
  const lines = sanitizedText.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      y -= bodyLH * 0.5;
      if (y < margin + bodyLH) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
      continue;
    }

    const isSection =
      SECTION_RE.test(trimmed) ||
      (trimmed === trimmed.toUpperCase() && trimmed.length > 2 && trimmed.length < 50 &&
        /[A-Z]/.test(trimmed) && !trimmed.includes('['));

    const isFirstLine =
      i === lines.slice(0, i + 1).findIndex((l) => l.trim()) &&
      !trimmed.includes('@') && !trimmed.includes('://');

    let font, size, lh;
    if (isFirstLine) { font = fontBold; size = nameSize; lh = nameLH; }
    else if (isSection) {
      font = fontBold; size = headingSize; lh = headingLH;
      y -= 8;
      if (y < margin + lh) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
    } else { font = fontRegular; size = bodySize; lh = bodyLH; }

    const words = trimmed.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, size) > maxWidth && currentLine) {
        if (y < margin + lh) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
        page.drawText(currentLine, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
        y -= lh;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      if (y < margin + lh) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
      page.drawText(currentLine, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
      y -= lh;
    }

    if (isSection) {
      page.drawLine({
        start: { x: margin, y: y + lh * 0.3 },
        end: { x: pageWidth - margin, y: y + lh * 0.3 },
        thickness: 0.5,
        color: rgb(0.6, 0.6, 0.6),
      });
      y -= 4;
    }
  }
  
  return await pdfDoc.save();
}
