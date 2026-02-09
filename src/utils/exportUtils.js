import { Document, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Sanitize text for PDF export by replacing unsupported Unicode characters
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

// Export as TXT (Free tier)
export const exportAsTXT = (text, originalFilename = null) => {
  let link = null;
  try {
    // Generate filename from original or use default
    let filename = 'redacted-resume.txt';
    if (originalFilename) {
      const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
      filename = `${nameWithoutExt}_redacted.txt`;
    }
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    if (link && link.parentNode) {
      document.body.removeChild(link);
    }
  }
};

// Export as DOCX (Pro tier only)
export const exportAsDOCX = async (text, originalFilename = null, originalFile = null, piiItems = []) => {
  let link = null;
  try {
    // Generate filename from original or use default
    let filename = 'redacted-resume.docx';
    if (originalFilename) {
      const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
      filename = `${nameWithoutExt}_redacted.docx`;
    }
    
    // If original file is a DOCX, preserve ALL formatting by replacing text in-place
    if (originalFile && originalFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const JSZip = (await import('jszip')).default;
        const arrayBuffer = await originalFile.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Process document.xml and any headers/footers
        const xmlFiles = ['word/document.xml'];
        // Also check for headers and footers
        const zipFiles = Object.keys(zip.files);
        zipFiles.forEach(f => {
          if (/^word\/(header|footer)\d+\.xml$/.test(f)) {
            xmlFiles.push(f);
          }
        });

        for (const xmlPath of xmlFiles) {
          const xmlFile = zip.file(xmlPath);
          if (!xmlFile) continue;
          
          const xmlContent = await xmlFile.async('string');
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
          const wNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
          
          // Build position-to-node mapping
          const textNodes = [];
          let currentPosition = 0;
          const tElements = xmlDoc.getElementsByTagNameNS(wNamespace, 't');
          
          for (let i = 0; i < tElements.length; i++) {
            const node = tElements[i];
            const nodeText = node.textContent;
            textNodes.push({
              node,
              start: currentPosition,
              end: currentPosition + nodeText.length,
              originalText: nodeText
            });
            currentPosition += nodeText.length;
          }
          
          // Apply PII replacements from end to start (preserves earlier positions)
          if (piiItems && piiItems.length > 0) {
            const piiToRedact = [...piiItems]
              .filter(p => p.redact)
              .sort((a, b) => b.start - a.start);
            
            for (const pii of piiToRedact) {
              const replacement = pii.suggested || `[${pii.type.toUpperCase()} REDACTED]`;
              
              // Find which text nodes this PII spans
              const affectedNodes = textNodes.filter(n => 
                n.start < pii.end && n.end > pii.start
              );
              
              if (affectedNodes.length === 0) continue;
              
              if (affectedNodes.length === 1) {
                // PII is within a single node - simple in-place replacement
                const node = affectedNodes[0];
                const startInNode = pii.start - node.start;
                const endInNode = pii.end - node.start;
                const currentText = node.node.textContent;
                node.node.textContent = 
                  currentText.substring(0, startInNode) + 
                  replacement + 
                  currentText.substring(endInNode);
                
                // Preserve xml:space for spaces
                node.node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
              } else {
                // PII spans multiple nodes
                const firstNode = affectedNodes[0];
                const lastNode = affectedNodes[affectedNodes.length - 1];
                
                // First node: keep text before PII + add replacement
                const startInFirst = pii.start - firstNode.start;
                firstNode.node.textContent = 
                  firstNode.node.textContent.substring(0, startInFirst) + replacement;
                firstNode.node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
                
                // Middle nodes: clear content
                for (let i = 1; i < affectedNodes.length - 1; i++) {
                  affectedNodes[i].node.textContent = '';
                }
                
                // Last node: keep text after PII
                const endInLast = pii.end - lastNode.start;
                lastNode.node.textContent = lastNode.node.textContent.substring(endInLast);
                if (lastNode.node.textContent) {
                  lastNode.node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
                }
              }
            }
          }
          
          // Serialize back
          const serializer = new XMLSerializer();
          let modifiedXML = serializer.serializeToString(xmlDoc);
          
          // Fix namespace declarations if needed
          if (!modifiedXML.includes('xmlns:w=') && xmlPath === 'word/document.xml') {
            modifiedXML = modifiedXML.replace(
              '<w:document',
              '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
            );
          }
          
          zip.file(xmlPath, modifiedXML);
        }
        
        // Generate DOCX
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(url);
        
        return { success: true, preservedFormat: true };
      } catch (formatError) {
        console.error('Failed to preserve DOCX format:', formatError);
        // Fall through to plain text export
      }
    }
    
    // Fallback: Create new DOCX from plain text
    const paragraphs = text.split('\n').map(line => 
      new Paragraph({
        children: [new TextRun(line || ' ')],
        spacing: { after: 200 }
      })
    );

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    
    return { success: true, preservedFormat: false };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    if (link && link.parentNode) {
      document.body.removeChild(link);
    }
  }
};

// Export as PDF (Pro tier only) — preserves original PDF layout when possible
export const exportAsPDF = async (text, uploadedFile = null, piiItems = [], isPro = false, originalFilename = null) => {
  try {
    // Generate filename from original or use default
    let filename = 'redacted-resume.pdf';
    if (originalFilename) {
      const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
      filename = `${nameWithoutExt}_redacted.pdf`;
    }

    // If original file is a PDF, preserve formatting by overlaying redaction boxes
    if (uploadedFile && uploadedFile.type === 'application/pdf' && piiItems.length > 0) {
      try {
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        
        // Load with pdfjs to get text positions
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        const pdfDoc = await loadingTask.promise;
        
        // Load with pdf-lib to modify
        const pdfLibDoc = await PDFDocument.load(arrayBuffer);
        const timesFont = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
        
        // Build a global text position map page by page
        let globalOffset = 0;
        
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const viewport = page.getViewport({ scale: 1.0 });
          
          // Sort items the same way as extractTextFromPDF
          textContent.items.sort((a, b) => {
            const aY = a.transform[5];
            const bY = b.transform[5];
            const aX = a.transform[4];
            const bX = b.transform[4];
            if (Math.abs(bY - aY) <= 5) return aX - bX;
            return bY - aY;
          });
          
          // Build position map for this page
          const pageItems = [];
          let lastY = null;
          
          textContent.items.forEach((item, index) => {
            const currentY = item.transform[5];
            
            // Account for newlines
            if (lastY !== null && Math.abs(currentY - lastY) > 5) {
              globalOffset += 1; // newline character
            }
            
            const itemStart = globalOffset;
            const itemEnd = globalOffset + item.str.length;
            
            pageItems.push({
              str: item.str,
              start: itemStart,
              end: itemEnd,
              x: item.transform[4],
              y: item.transform[5],
              // Estimate width from font size and character count if pdfjs doesn't provide it
              width: item.width || (item.str.length * (item.transform[0] || 12) * 0.5),
              height: item.height || (item.transform[0] || 12),
              fontSize: item.transform[0] || 12
            });
            
            globalOffset += item.str.length;
            
            // Account for space between items on same line
            if (index < textContent.items.length - 1) {
              const nextItem = textContent.items[index + 1];
              const nextY = nextItem.transform[5];
              if (Math.abs(currentY - nextY) <= 5) {
                globalOffset += 1; // space
              }
            }
            
            lastY = currentY;
          });
          
          globalOffset += 2; // paragraph break between pages
          
          // Find PIIs that fall on this page
          const pdfPage = pdfLibDoc.getPage(pageNum - 1);
          const pageHeight = pdfPage.getHeight();
          
          const piiToRedact = piiItems.filter(p => p.redact);
          
          for (const pii of piiToRedact) {
            // Find page items that overlap with this PII
            const overlapping = pageItems.filter(item => 
              item.start < pii.end && item.end > pii.start
            );
            
            if (overlapping.length === 0) continue;
            
            // Draw white rectangle over each overlapping text item
            for (const item of overlapping) {
              const padding = 2;
              const rectWidth = item.width + padding * 2;
              pdfPage.drawRectangle({
                x: item.x - padding,
                y: item.y - padding,
                width: rectWidth,
                height: item.height + padding * 2,
                color: rgb(1, 1, 1), // white
                opacity: 1,
              });
            }
            
            // Draw replacement text at the first overlapping item's position
            const firstItem = overlapping[0];
            const replacement = pii.suggested || `[REDACTED]`;
            const replaceFontSize = Math.min(firstItem.fontSize * 0.9, 10);
            
            pdfPage.drawText(replacement, {
              x: firstItem.x,
              y: firstItem.y,
              size: replaceFontSize,
              font: timesFont,
              color: rgb(0.6, 0, 0) // dark red for redacted text
            });
          }
        }
        
        const pdfBytes = await pdfLibDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        let link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(link);
        
        return { success: true, preservedFormat: true };
      } catch (pdfError) {
        console.error('Failed to preserve PDF format, falling back:', pdfError);
        // Fall through to plain text PDF generation
      }
    }
    
    // Fallback: create new PDF from plain text
    const sanitizedText = sanitizeForPDF(text);
    
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    
    const fontSize = 11;
    const margin = 50;
    const pageWidth = 595; // A4 width in points
    const pageHeight = 842; // A4 height in points
    const maxWidth = pageWidth - 2 * margin;
    const lineHeight = fontSize * 1.2;
    
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;
    
    // Split text into lines
    const lines = sanitizedText.split('\n');
    
    for (const line of lines) {
      // Wrap long lines
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = timesRomanFont.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth > maxWidth && currentLine) {
          // Draw current line
          if (yPosition < margin + lineHeight) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
          }
          
          page.drawText(currentLine, {
            x: margin,
            y: yPosition,
            size: fontSize,
            font: timesRomanFont,
            color: rgb(0, 0, 0)
          });
          
          yPosition -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      // Draw remaining text
      if (currentLine) {
        if (yPosition < margin + lineHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          yPosition = pageHeight - margin;
        }
        
        page.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: timesRomanFont,
          color: rgb(0, 0, 0)
        });
        
        yPosition -= lineHeight;
      }
      
      // Empty line spacing
      if (!line.trim()) {
        yPosition -= lineHeight / 2;
      }
    }
    
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    let link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

