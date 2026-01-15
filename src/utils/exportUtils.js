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
    
    // If original file is a DOCX, preserve ALL formatting by carefully replacing text
    if (originalFile && originalFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const JSZip = (await import('jszip')).default;
        const arrayBuffer = await originalFile.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Read document.xml
        const documentXML = await zip.file('word/document.xml').async('string');
        
        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(documentXML, 'text/xml');
        
        // Get namespace for Word elements
        const wNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        
        // Strategy: Build character-to-node mapping, then replace text while keeping structure
        const textNodes = [];
        let currentPosition = 0;
        
        // Find all w:t text nodes and map their positions
        const getAllTextNodes = (element) => {
          const tElements = element.getElementsByTagNameNS(wNamespace, 't');
          for (let i = 0; i < tElements.length; i++) {
            const node = tElements[i];
            const nodeText = node.textContent;
            textNodes.push({
              node: node,
              startPos: currentPosition,
              endPos: currentPosition + nodeText.length,
              originalText: nodeText
            });
            currentPosition += nodeText.length;
          }
        };
        
        getAllTextNodes(xmlDoc);
        
        // Build original text from nodes
        const originalText = textNodes.map(n => n.originalText).join('');
        
        // The 'text' parameter is already redacted, we need to map it back
        // Problem: redacted text may have different length than original
        
        // Better approach: Use character-by-character mapping
        // Create a mapping of which characters to keep/replace
        const charMap = new Array(originalText.length).fill(null).map((_, i) => originalText[i]);
        
        // If we have PII items, replace them in the character map
        if (piiItems && piiItems.length > 0) {
          const sortedPII = [...piiItems].filter(p => p.redact).sort((a, b) => b.start - a.start);
          
          for (const pii of sortedPII) {
            const replacement = pii.suggested || `[${pii.type.toUpperCase()} REDACTED]`;
            // Replace in charMap
            const before = charMap.slice(0, pii.start);
            const after = charMap.slice(pii.end);
            charMap.splice(0, charMap.length, ...before, ...replacement.split(''), ...after);
          }
        }
        
        // Now map the character array back to text nodes
        const newText = charMap.join('');
        let textIndex = 0;
        
        for (const nodeInfo of textNodes) {
          const nodeLength = nodeInfo.endPos - nodeInfo.startPos;
          const newNodeText = newText.substring(textIndex, textIndex + nodeLength);
          nodeInfo.node.textContent = newNodeText;
          
          // Preserve xml:space attribute for leading/trailing spaces
          if (newNodeText.startsWith(' ') || newNodeText.endsWith(' ') || /\s{2,}/.test(newNodeText)) {
            nodeInfo.node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
          }
          
          textIndex += nodeLength;
        }
        
        // Serialize back
        const serializer = new XMLSerializer();
        let modifiedXML = serializer.serializeToString(xmlDoc);
        
        // Fix namespace declarations if needed
        if (!modifiedXML.includes('xmlns:w=')) {
          modifiedXML = modifiedXML.replace(
            '<w:document',
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
          );
        }
        
        // Update ZIP
        zip.file('word/document.xml', modifiedXML);
        
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
        console.log('Error details:', formatError.message);
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

// Export as PDF (Pro tier only)
export const exportAsPDF = async (text, uploadedFile = null, piiItems = [], isPro = false, originalFilename = null) => {
  try {
    // Generate filename from original or use default
    let filename = 'redacted-resume.pdf';
    if (originalFilename) {
      const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
      filename = `${nameWithoutExt}_redacted.pdf`;
    }
    
    // Sanitize text to remove unsupported Unicode characters
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

