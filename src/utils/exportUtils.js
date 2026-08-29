import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { verifyProStatus } from './proLicenseDB.js';

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
  document.body.removeChild(link);
  // Defer revocation — some browsers (Firefox, Safari) start the download
  // asynchronously and need the URL to remain valid briefly.
  setTimeout(() => URL.revokeObjectURL(url), 5000);
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

export const generateTXTBlob = (text, originalFilename = null) => {
  const filename = makeFilename(originalFilename, 'txt');
  const blob = new Blob([text], { type: 'text/plain' });
  return { blob, filename };
};

export const exportAsTXT = (text, originalFilename = null) => {
  try {
    const { blob, filename } = generateTXTBlob(text, originalFilename);
    downloadBlob(blob, filename);
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
    const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(value);

    while (searchFrom <= xmlText.length - value.length) {
      const idx = xmlText.indexOf(value, searchFrom);
      if (idx === -1) break;

      if (isAlphanumeric) {
        const charBefore = idx > 0 ? xmlText[idx - 1] : ' ';
        const charAfter = idx + value.length < xmlText.length ? xmlText[idx + value.length] : ' ';
        if (/[a-zA-Z0-9]/.test(charBefore) || /[a-zA-Z0-9]/.test(charAfter)) {
          searchFrom = idx + value.length;
          continue;
        }
      }

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
 * Generate DOCX Blob — preserves ALL original formatting when the source is DOCX.
 */
export const generateDOCXBlob = async (text, originalFilename = null, originalFile = null, piiItems = []) => {
  const filename = makeFilename(originalFilename, 'docx');

  // ── Strategy 1: Format-preserving in-place edit ────────────────────────
  if (
    originalFile &&
    originalFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
    piiItems.some((p) => p.redact)
  ) {
    try {
      const JSZip = (await import('jszip')).default;
      const arrayBuffer = await originalFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Collect every XML part that can contain visible text
      const xmlFiles = ['word/document.xml'];
      Object.keys(zip.files).forEach((f) => {
        if (/^word\/(header|footer|footnotes|endnotes)\d*\.xml$/.test(f)) xmlFiles.push(f);
      });

      let partsEdited = 0;
      for (const xmlPath of xmlFiles) {
        const xmlFile = zip.file(xmlPath);
        if (!xmlFile) continue;

        const xmlContent = await xmlFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
          console.warn(`[DOCX export] XML parse error in ${xmlPath}, skipping`);
          continue;
        }

        applyRedactionsToXML(xmlDoc, piiItems);

        const serializer = new XMLSerializer();
        zip.file(xmlPath, serializer.serializeToString(xmlDoc));
        partsEdited++;
      }

      if (partsEdited > 0) {
        const blob = await zip.generateAsync({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        return { blob, filename, preservedFormat: true };
      }
      console.warn('[DOCX export] No XML parts edited, falling back to text DOCX');
    } catch (formatError) {
      console.error('[DOCX export] Format-preserving export failed:', formatError);
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
  return { blob, filename, preservedFormat: false };
};

/**
 * Export as DOCX — triggers browser download.
 */
export const exportAsDOCX = async (text, originalFilename = null, originalFile = null, piiItems = []) => {
  try {
    const isPro = await verifyProStatus();
    if (!isPro) {
      return { success: false, error: 'Pro license required for DOCX export. Cryptographic signature verification failed.' };
    }
    const result = await generateDOCXBlob(text, originalFilename, originalFile, piiItems);
    downloadBlob(result.blob, result.filename);
    return { success: true, preservedFormat: result.preservedFormat };
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
 * Accurately find character slice [subStart, subEnd] of PII inside a PDF text item.
 */
function getPIISubSliceInItem(item, pii) {
  if (!item || !item.str) return null;
  const strLen = item.str.length;

  // Method 1: Global offset overlap
  if (typeof item.start === 'number' && typeof item.end === 'number') {
    if (pii.start < item.end && pii.end > item.start) {
      const subStart = Math.max(0, pii.start - item.start);
      const subEnd = Math.min(strLen, pii.end - item.start);
      if (subEnd > subStart) {
        return { subStart, subEnd };
      }
    }
  }

  // Method 2: Direct value search
  if (pii.value && pii.value.length > 0) {
    const idx = item.str.indexOf(pii.value);
    if (idx !== -1) {
      return { subStart: idx, subEnd: idx + pii.value.length };
    }

    // Method 3: Case-insensitive search
    const lowerIdx = item.str.toLowerCase().indexOf(pii.value.toLowerCase());
    if (lowerIdx !== -1) {
      return { subStart: lowerIdx, subEnd: lowerIdx + pii.value.length };
    }

    // Method 4: Partial overlap (PII spans multiple items)
    for (let l = Math.min(strLen, pii.value.length); l >= 2; l--) {
      const suffix = item.str.substring(strLen - l);
      if (pii.value.startsWith(suffix)) {
        return { subStart: strLen - l, subEnd: strLen };
      }
    }
    for (let l = Math.min(strLen, pii.value.length); l >= 2; l--) {
      const prefix = item.str.substring(0, l);
      if (pii.value.endsWith(prefix)) {
        return { subStart: 0, subEnd: l };
      }
    }
  }

  return { subStart: 0, subEnd: strLen };
}

/**
 * Generate PDF Blob with precise character-level redactions.
 */
export const generatePDFBlob = async (text, uploadedFile = null, piiItems = [], _isPro = false, originalFilename = null) => {
  const filename = makeFilename(originalFilename, 'pdf');

  // ── Strategy 1: Image layer + invisible copyable text layer ────────────
  if (uploadedFile && uploadedFile.type === 'application/pdf' && piiItems.some((p) => p.redact)) {
    let pdfSrc = null;
    try {
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

      pdfSrc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      const newPdf = await PDFDocument.create();
      const textFont = await newPdf.embedFont(StandardFonts.Helvetica);

      // ── Build global text-position map (mirrors extractTextFromPDF) ─────
      let globalOffset = 0;
      const allPageItems = [];

      for (let pageNum = 1; pageNum <= pdfSrc.numPages; pageNum++) {
        const page = await pdfSrc.getPage(pageNum);
        try {
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
        } finally {
          if (page && page.cleanup) page.cleanup();
        }
      }

      // ── Render each page ────────────────────────────────────────────────
      const renderScale = 2.5;
      const piiToRedact = piiItems.filter((p) => p.redact);

      for (let pageNum = 1; pageNum <= pdfSrc.numPages; pageNum++) {
        const page = await pdfSrc.getPage(pageNum);
        try {
          const viewport = page.getViewport({ scale: renderScale });
          const origVP = page.getViewport({ scale: 1.0 });

          // ── a) Canvas render ──────────────────────────────────────────────
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          const pageItems = allPageItems[pageNum - 1];
          const itemRedactions = new Map();

          // ── b) Find PII & draw precise black boxes on canvas ──────────────
          for (const pii of piiToRedact) {
            let overlapping = pageItems.filter(
              (item) => item.start < pii.end && item.end > pii.start,
            );

            // Fallback: value-based matching
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

            for (const item of overlapping) {
              const slice = getPIISubSliceInItem(item, pii);
              if (!slice || slice.subEnd <= slice.subStart) continue;

              const { subStart, subEnd } = slice;
              const itemIdx = pageItems.indexOf(item);
              const strLen = Math.max(1, item.str.length);
              const itemCanvasWidth = item.width * renderScale;
              const itemCanvasX = item.pdfX * renderScale;
              const itemCanvasY = viewport.height - (item.pdfY * renderScale) - (item.height * renderScale);
              const itemCanvasH = item.height * renderScale;

              // Measure sub-string coordinates
              ctx.font = `${item.fontSize * renderScale}px sans-serif`;
              const fullMeasured = ctx.measureText(item.str).width;
              let matchX, matchW;

              if (fullMeasured > 0) {
                const preText = item.str.substring(0, subStart);
                const matchText = item.str.substring(subStart, subEnd);
                const preWidth = ctx.measureText(preText).width;
                const matchWidth = ctx.measureText(matchText).width;
                const scale = itemCanvasWidth / fullMeasured;
                matchX = itemCanvasX + (preWidth * scale);
                matchW = Math.max(matchWidth * scale, 4);
              } else {
                matchX = itemCanvasX + ((subStart / strLen) * itemCanvasWidth);
                matchW = Math.max(((subEnd - subStart) / strLen) * itemCanvasWidth, 4);
              }

              // Clamped bounding box with 2px padding
              const pad = 2;
              const boxX = Math.max(0, matchX - pad);
              const boxY = Math.max(0, itemCanvasY - pad);
              const boxW = Math.min(viewport.width - boxX, matchW + (pad * 2));
              const boxH = Math.min(viewport.height - boxY, itemCanvasH + (pad * 2));

              // Fill solid black rectangle
              ctx.fillStyle = '#111111';
              ctx.fillRect(boxX, boxY, boxW, boxH);

              // Replacement label: clipped cleanly within the box (guarantees zero overflow)
              const label = pii.suggested || '[REDACTED]';
              const maxFont = Math.min(item.fontSize * 0.65, 8) * renderScale;

              ctx.save();
              ctx.beginPath();
              ctx.rect(boxX, boxY, boxW, boxH);
              ctx.clip();

              ctx.fillStyle = '#ffffff';
              ctx.textBaseline = 'middle';
              ctx.textAlign = 'center';

              ctx.font = `600 ${maxFont}px "Segoe UI", Helvetica, Arial, sans-serif`;
              const labelW = ctx.measureText(label).width;

              if (labelW <= boxW - 4 && boxW >= 24) {
                ctx.fillText(label, boxX + (boxW / 2), boxY + (boxH / 2));
              } else if (boxW >= 36) {
                const shortLabel = '[REDACTED]';
                const fitFont = Math.max(Math.min((boxW - 6) / shortLabel.length * 1.5, maxFont), 5 * renderScale);
                ctx.font = `600 ${fitFont}px "Segoe UI", Helvetica, Arial, sans-serif`;
                ctx.fillText(shortLabel, boxX + (boxW / 2), boxY + (boxH / 2));
              }
              ctx.restore();

              // Track redactions for the invisible text layer
              if (!itemRedactions.has(itemIdx)) {
                itemRedactions.set(itemIdx, []);
              }
              itemRedactions.get(itemIdx).push({
                subStart,
                subEnd,
                label
              });
            }
          }

          // ── c) Embed rendered canvas as page-sized image ──────────────────
          const imgBytes = await new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
              if (!blob) return reject(new Error('Canvas toBlob failed'));
              resolve(new Uint8Array(await blob.arrayBuffer()));
            }, 'image/jpeg', 0.95);
          });
          canvas.width = 0;
          canvas.height = 0;
          const jpg = await newPdf.embedJpg(imgBytes);

          const newPage = newPdf.addPage([origVP.width, origVP.height]);
          newPage.drawImage(jpg, { x: 0, y: 0, width: origVP.width, height: origVP.height });

          // ── d) Invisible text layer for copy-paste ────────────────────────
          for (let i = 0; i < pageItems.length; i++) {
            const item = pageItems[i];

            if (itemRedactions.has(i)) {
              // Construct safe text by replacing redacted substrings
              const slices = itemRedactions.get(i).sort((a, b) => b.subStart - a.subStart);
              let safeText = item.str;
              for (const sl of slices) {
                const safeLabel = sanitizeForPDF(sl.label);
                safeText = safeText.substring(0, sl.subStart) + (safeLabel ? ` ${safeLabel} ` : ' ') + safeText.substring(sl.subEnd);
              }
              const sanitized = sanitizeForPDF(safeText);
              if (sanitized && sanitized.trim()) {
                try {
                  newPage.drawText(sanitized, {
                    x: item.pdfX,
                    y: item.pdfY,
                    size: item.fontSize,
                    font: textFont,
                    color: rgb(0, 0, 0),
                    opacity: 0.01,
                  });
                } catch (_) { /* skip unencodable text */ }
              }
              continue;
            }

            const safeStr = sanitizeForPDF(item.str);
            if (safeStr && safeStr.trim()) {
              try {
                newPage.drawText(safeStr, {
                  x: item.pdfX,
                  y: item.pdfY,
                  size: item.fontSize,
                  font: textFont,
                  color: rgb(0, 0, 0),
                  opacity: 0.01,
                });
              } catch (_) { /* skip unencodable text */ }
            }
          }
        } finally {
          if (page && page.cleanup) page.cleanup();
        }
      }

      const pdfBytes = await newPdf.save();
      return { blob: new Blob([pdfBytes], { type: 'application/pdf' }), filename, preservedFormat: true };
    } catch (pdfError) {
      console.error('PDF export failed, falling back to text PDF:', pdfError);
    } finally {
      if (pdfSrc && pdfSrc.destroy) {
        pdfSrc.destroy();
      }
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
  return { blob: new Blob([pdfBytes], { type: 'application/pdf' }), filename, preservedFormat: false };
};

/**
 * Export as PDF — triggers browser download.
 */
export const exportAsPDF = async (text, uploadedFile = null, piiItems = [], _isPro = false, originalFilename = null) => {
  try {
    const isPro = await verifyProStatus();
    if (!isPro) {
      return { success: false, error: 'Pro license required for PDF export. Cryptographic signature verification failed.' };
    }
    const result = await generatePDFBlob(text, uploadedFile, piiItems, isPro, originalFilename);
    downloadBlob(result.blob, result.filename);
    return { success: true, preservedFormat: result.preservedFormat };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

