import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ─── Helpers ─────────────────────────────────────────────────────────────────────

/**
 * Sanitize text for PDF export — pdf-lib only supports WinAnsi (Latin-1).
 */
function sanitizeForPDF(text) {
  if (!text) return '';
  let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[^\x00-\xFF]/g, '?');
  return s;
}

/** Trigger download of a Blob. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(link);
}

/** Build redacted filename from original. */
function makeFilename(originalFilename, ext) {
  if (originalFilename) {
    const base = originalFilename.replace(/\.[^/.]+$/, '');
    return `${base}_redacted.${ext}`;
  }
  return `redacted-document.${ext}`;
}

/** Section-header pattern for resume formatting detection. */
const SECTION_RE =
  /^(EDUCATION|EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT HISTORY|SKILLS|TECHNICAL SKILLS|CORE SKILLS|KEY SKILLS|CORE COMPETENCIES|PROJECTS|KEY PROJECTS|CERTIFICATIONS|PROFESSIONAL CERTIFICATIONS|AWARDS|ACHIEVEMENTS|HONORS|SUMMARY|PROFESSIONAL SUMMARY|CAREER SUMMARY|EXECUTIVE SUMMARY|OBJECTIVE|CAREER OBJECTIVE|PROFILE|PROFESSIONAL PROFILE|REFERENCES|CONTACT|CONTACT INFORMATION|PUBLICATIONS|RESEARCH|LANGUAGES|INTERESTS|HOBBIES|TRAINING|ACTIVITIES|VOLUNTEER|LEADERSHIP|ACADEMIC BACKGROUND|EDUCATIONAL BACKGROUND)$/i;

// ─── TXT Export ──────────────────────────────────────────────────────────────────

export const exportAsTXT = (text, originalFilename = null) => {
  try {
    const filename = makeFilename(originalFilename, 'txt');
    downloadBlob(new Blob([text], { type: 'text/plain' }), filename);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ─── DOCX Export ─────────────────────────────────────────────────────────────────

/**
 * Apply redactions to OOXML using VALUE-BASED SEARCH.
 *
 * Why value-based instead of position-based:
 *   mammoth.extractRawText() inserts \n\n between paragraphs, producing text
 *   positions that diverge from the raw <w:t> concatenation. After a few
 *   paragraphs the offset drift is large enough that position-based replacement
 *   either replaces the wrong text or throws, causing the export to fall back to
 *   a plain-text DOCX — losing ALL formatting.
 *
 *   Value-based search finds each PII value as a substring of the XML text and
 *   replaces it in-place, regardless of paragraph offset differences.
 *
 * Edge-case handling:
 *   • Longer values are processed first to prevent partial-match conflicts.
 *   • Multi-run spans (value split across <w:t> elements) are handled.
 *   • If only some occurrences of a value should be redacted, we cap replacements.
 *   • Overlapping ranges are skipped to avoid double-replacement.
 */
function applyRedactionsToXML(xmlDoc, piiItems) {
  const wNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const allTNodes = Array.from(xmlDoc.getElementsByTagNameNS(wNS, 't'));
  if (allTNodes.length === 0) return;

  // 1) Build concatenated text from every <w:t> element, with a position map.
  let xmlText = '';
  const nodeMap = allTNodes.map((node) => {
    const text = node.textContent;
    const entry = { node, start: xmlText.length, end: xmlText.length + text.length };
    xmlText += text;
    return entry;
  });

  // 2) Group PII items by value.
  const valueGroups = new Map(); // value → { replacement, redactCount, totalCount }
  piiItems.forEach((p) => {
    if (!p.value || p.value.length === 0) return;
    if (!valueGroups.has(p.value)) {
      valueGroups.set(p.value, { replacement: p.suggested || '[REDACTED]', redactCount: 0, totalCount: 0 });
    }
    const g = valueGroups.get(p.value);
    g.totalCount++;
    if (p.redact) g.redactCount++;
  });

  // 3) Collect replacement ranges — process longer values first.
  const sortedValues = [...valueGroups.entries()]
    .filter(([, g]) => g.redactCount > 0)
    .sort((a, b) => b[0].length - a[0].length);

  const replacements = []; // { xmlStart, xmlEnd, replacement }
  const usedRanges = [];

  for (const [value, { replacement, redactCount, totalCount }] of sortedValues) {
    const occurrences = [];
    let searchFrom = 0;
    while (searchFrom <= xmlText.length - value.length) {
      const idx = xmlText.indexOf(value, searchFrom);
      if (idx === -1) break;
      occurrences.push(idx);
      searchFrom = idx + value.length;
    }
    if (occurrences.length === 0) continue;

    const redactAll = redactCount >= totalCount || occurrences.length <= redactCount;
    const limit = redactAll ? occurrences.length : redactCount;

    let replaced = 0;
    for (const idx of occurrences) {
      if (replaced >= limit) break;
      const end = idx + value.length;
      if (usedRanges.some((r) => r.start < end && r.end > idx)) continue;
      replacements.push({ xmlStart: idx, xmlEnd: end, replacement });
      usedRanges.push({ start: idx, end });
      replaced++;
    }
  }

  if (replacements.length === 0) return;

  // 4) Group replacements by the <w:t> nodes they touch.
  const nodeActions = new Map();

  for (const r of replacements) {
    const affected = nodeMap.filter((n) => n.start < r.xmlEnd && n.end > r.xmlStart);
    if (affected.length === 0) continue;

    affected.forEach((n, idx) => {
      if (!nodeActions.has(n.node)) nodeActions.set(n.node, []);
      nodeActions.get(n.node).push({
        startInNode: Math.max(0, r.xmlStart - n.start),
        endInNode: Math.min(n.end - n.start, r.xmlEnd - n.start),
        replacement: idx === 0 ? r.replacement : '',
      });
    });
  }

  // 5) Apply edits right-to-left within each node.
  for (const [node, actions] of nodeActions) {
    actions.sort((a, b) => b.startInNode - a.startInNode);
    let text = node.textContent;
    for (const a of actions) {
      text = text.substring(0, a.startInNode) + a.replacement + text.substring(a.endInNode);
    }
    node.textContent = text;
    node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  }
}

/**
 * Export as DOCX — preserves ALL original formatting when the source is DOCX.
 */
export const exportAsDOCX = async (text, originalFilename = null, originalFile = null, piiItems = []) => {
  try {
    const filename = makeFilename(originalFilename, 'docx');

    // ── Strategy 1: Format-preserving in-place edit ────────────────────────
    if (
      originalFile &&
      originalFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const JSZip = (await import('jszip')).default;
        const arrayBuffer = await originalFile.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const xmlFiles = ['word/document.xml'];
        Object.keys(zip.files).forEach((f) => {
          if (/^word\/(header|footer)\d+\.xml$/.test(f)) xmlFiles.push(f);
        });

        for (const xmlPath of xmlFiles) {
          const xmlFile = zip.file(xmlPath);
          if (!xmlFile) continue;

          const xmlContent = await xmlFile.async('string');
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

          if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            console.warn(`XML parse error in ${xmlPath}, skipping`);
            continue;
          }

          applyRedactionsToXML(xmlDoc, piiItems);

          const serializer = new XMLSerializer();
          zip.file(xmlPath, serializer.serializeToString(xmlDoc));
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, filename);
        return { success: true, preservedFormat: true };
      } catch (formatError) {
        console.error('DOCX format-preserving export failed:', formatError);
        // Fall through to structured fallback
      }
    }

    // ── Strategy 2: Structured fallback from plain text ────────────────────
    const paragraphs = buildFormattedParagraphs(text);
    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: paragraphs,
      }],
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, filename);
    return { success: true, preservedFormat: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Build formatted Paragraph objects from plain text with section-header
 * detection, bullet points, and heading hierarchy.
 */
function buildFormattedParagraphs(text) {
  const lines = text.split('\n');
  const paragraphs = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 120 } }));
      continue;
    }

    const isSection =
      SECTION_RE.test(trimmed) ||
      (trimmed === trimmed.toUpperCase() && trimmed.length > 2 && trimmed.length < 50 &&
        /[A-Z]/.test(trimmed) && !trimmed.includes('['));

    const isFirstLine =
      i === lines.slice(0, i + 1).findIndex((l) => l.trim()) &&
      !trimmed.includes('@') && !trimmed.includes('://');

    const isBullet = /^[•\-*]\s/.test(trimmed);

    if (isFirstLine) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 28, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 60 },
      }));
    } else if (isSection) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 24, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        border: { bottom: { color: '999999', space: 1, style: BorderStyle.SINGLE, size: 4 } },
      }));
    } else if (isBullet) {
      const bulletText = trimmed.replace(/^[•\-*]\s*/, '');
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: `\u2022  ${bulletText}`, size: 22, font: 'Calibri' })],
        spacing: { after: 40 },
        indent: { left: 360 },
      }));
    } else {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22, font: 'Calibri' })],
        spacing: { after: 60 },
      }));
    }
  }
  return paragraphs;
}

// ─── PDF Export ───────────────────────────────────────────────────────────────────

/**
 * Export as PDF.
 *
 * When the source is a PDF, pages are flattened to images with professional
 * redaction overlays burnt in. The text layer is completely removed, preventing
 * copy-paste extraction of redacted information.
 *
 * When the source is not a PDF (or flattening fails), a new PDF is created from
 * the redacted text with section-header detection and basic formatting.
 */
export const exportAsPDF = async (text, uploadedFile = null, piiItems = [], isPro = false, originalFilename = null) => {
  try {
    const filename = makeFilename(originalFilename, 'pdf');

    // ── Strategy 1: Flatten original PDF to images with burnt-in redactions ─
    if (uploadedFile && uploadedFile.type === 'application/pdf' && piiItems.length > 0) {
      try {
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdfSrc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        const newPdf = await PDFDocument.create();

        // ── Build global text-position map (matches extractTextFromPDF) ─────
        let globalOffset = 0;
        const allPageItems = [];

        for (let pageNum = 1; pageNum <= pdfSrc.numPages; pageNum++) {
          const page = await pdfSrc.getPage(pageNum);
          const tc = await page.getTextContent();

          tc.items.sort((a, b) => {
            const aY = a.transform[5], bY = b.transform[5];
            const aX = a.transform[4], bX = b.transform[4];
            if (Math.abs(bY - aY) <= 5) return aX - bX;
            return bY - aY;
          });

          const pageItems = [];
          let lastY = null;

          tc.items.forEach((item, index) => {
            const curY = item.transform[5];
            if (lastY !== null && Math.abs(curY - lastY) > 5) globalOffset += 1;

            const fontSize = Math.abs(item.transform[0]) || 12;
            pageItems.push({
              str: item.str,
              start: globalOffset,
              end: globalOffset + item.str.length,
              pdfX: item.transform[4],
              pdfY: item.transform[5],
              width: item.width || item.str.length * fontSize * 0.6,
              height: item.height || fontSize * 1.2,
              fontSize,
            });

            globalOffset += item.str.length;

            if (index < tc.items.length - 1) {
              const nextY = tc.items[index + 1].transform[5];
              if (Math.abs(curY - nextY) <= 5) globalOffset += 1;
            }
            lastY = curY;
          });

          globalOffset += 2;
          allPageItems.push(pageItems);
        }

        // ── Render each page & burn in redactions ───────────────────────────
        const renderScale = 2.5;
        const piiToRedact = piiItems.filter((p) => p.redact);

        for (let pageNum = 1; pageNum <= pdfSrc.numPages; pageNum++) {
          const page = await pdfSrc.getPage(pageNum);
          const viewport = page.getViewport({ scale: renderScale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          await page.render({ canvasContext: ctx, viewport }).promise;

          const pageItems = allPageItems[pageNum - 1];

          for (const pii of piiToRedact) {
            // Primary: position-based matching
            let overlapping = pageItems.filter(
              (item) => item.start < pii.end && item.end > pii.start,
            );

            // Fallback: value-based matching (handles any remaining offset drift)
            if (overlapping.length === 0 && pii.value) {
              let runText = '';
              const itemPos = [];
              pageItems.forEach((item) => {
                itemPos.push({ item, start: runText.length });
                runText += item.str + ' ';
              });
              const vIdx = runText.indexOf(pii.value);
              if (vIdx !== -1) {
                const vEnd = vIdx + pii.value.length;
                overlapping = itemPos
                  .filter((ip) => ip.start < vEnd && ip.start + ip.item.str.length > vIdx)
                  .map((ip) => ip.item);
              }
            }

            if (overlapping.length === 0) continue;

            // ── Professional black redaction boxes (industry standard) ──────
            for (const item of overlapping) {
              const pad = 2;
              const x = item.pdfX * renderScale - pad;
              const y = viewport.height - item.pdfY * renderScale - item.height * renderScale - pad;
              const w = item.width * renderScale + pad * 2;
              const h = item.height * renderScale + pad * 2;

              ctx.fillStyle = '#111111';
              ctx.fillRect(x, y, w, h);
            }

            // ── Replacement label (white on dark) ───────────────────────────
            const first = overlapping[0];
            const label = pii.suggested || '[REDACTED]';
            const labelPx = Math.min(first.fontSize * 0.7, 8) * renderScale;

            ctx.font = `600 ${labelPx}px "Segoe UI", Helvetica, Arial, sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.textBaseline = 'bottom';
            const labelX = first.pdfX * renderScale + 2;
            const labelY = viewport.height - first.pdfY * renderScale - 1;
            ctx.fillText(label, labelX, labelY);
          }

          // Convert canvas → JPEG → embed in new PDF
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          const resp = await fetch(dataUrl);
          const imgBytes = new Uint8Array(await resp.arrayBuffer());

          const jpg = await newPdf.embedJpg(imgBytes);
          const origVP = page.getViewport({ scale: 1.0 });
          const newPage = newPdf.addPage([origVP.width, origVP.height]);
          newPage.drawImage(jpg, { x: 0, y: 0, width: origVP.width, height: origVP.height });
        }

        const pdfBytes = await newPdf.save();
        downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), filename);
        return { success: true, preservedFormat: true };
      } catch (pdfError) {
        console.error('Secure PDF export failed, falling back:', pdfError);
      }
    }

    // ── Strategy 2: New PDF from redacted text with formatting ──────────────
    const sanitized = sanitizeForPDF(text);
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const bodySize = 10;
    const headingSize = 12;
    const nameSize = 14;
    const margin = 50;
    const pageW = 595;
    const pageH = 842;
    const maxW = pageW - 2 * margin;
    const bodyLH = bodySize * 1.5;
    const headingLH = headingSize * 1.8;
    const nameLH = nameSize * 1.6;

    let page = pdfDoc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const lines = sanitized.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (!trimmed) {
        y -= bodyLH * 0.5;
        if (y < margin + bodyLH) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - margin; }
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

      if (isFirstLine) {
        font = fontBold; size = nameSize; lh = nameLH;
      } else if (isSection) {
        font = fontBold; size = headingSize; lh = headingLH;
        y -= 8;
        if (y < margin + lh) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - margin; }
      } else {
        font = fontRegular; size = bodySize; lh = bodyLH;
      }

      // Word-wrap and draw
      const words = trimmed.split(' ');
      let currentLine = '';

      for (const word of words) {
        const test = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > maxW && currentLine) {
          if (y < margin + lh) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - margin; }
          page.drawText(currentLine, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
          y -= lh;
          currentLine = word;
        } else {
          currentLine = test;
        }
      }

      if (currentLine) {
        if (y < margin + lh) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - margin; }
        page.drawText(currentLine, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
        y -= lh;
      }

      // Underline after section headers
      if (isSection) {
        page.drawLine({
          start: { x: margin, y: y + lh * 0.3 },
          end: { x: pageW - margin, y: y + lh * 0.3 },
          thickness: 0.5,
          color: rgb(0.6, 0.6, 0.6),
        });
        y -= 4;
      }
    }

    const pdfBytes = await pdfDoc.save();
    downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), filename);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

