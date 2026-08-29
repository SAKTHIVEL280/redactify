import JSZip from 'jszip';
import fileSaver from 'file-saver';
const saveAs = fileSaver.saveAs || fileSaver;
import { generateDOCXBlob, generatePDFBlob, generateTXTBlob } from './exportUtils.js';
import { getFileTypeFromMime } from './fileHelpers.js';
import { verifyProStatus } from './proLicenseDB.js';

/**
 * Export batch of files as ZIP with format preservation.
 *
 * @param {Array} files - Array of { name, file, originalText, piiItems, redactedText }
 * @param {string} format - 'original' | 'pdf' | 'docx' | 'txt'
 */
export const exportBatchAsZip = async (files, format = 'original') => {
  const isPro = await verifyProStatus();
  if (!isPro) {
    throw new Error('Pro license required for Batch Export. Cryptographic signature verification failed.');
  }

  if (!files || files.length === 0) {
    throw new Error('No files to export');
  }

  const zip = new JSZip();
  const timestamp = Date.now();

  for (const item of files) {
    const fileObj = item.file;
    const detectedType = item.fileType || (fileObj ? getFileTypeFromMime(fileObj.type) : 'txt');
    const baseName = item.name.replace(/\.[^/.]+$/, '');
    const piiItems = item.piiItems || [];
    const text = item.redactedText || item.originalText;

    try {
      if (format === 'original') {
        if (detectedType === 'docx' && fileObj) {
          const res = await generateDOCXBlob(text, `${baseName}.docx`, fileObj, piiItems);
          zip.file(res.filename, res.blob);
        } else if (detectedType === 'pdf' && fileObj) {
          const res = await generatePDFBlob(text, fileObj, piiItems, true, `${baseName}.pdf`);
          zip.file(res.filename, res.blob);
        } else {
          const res = generateTXTBlob(text, `${baseName}.txt`);
          zip.file(res.filename, res.blob);
        }
      } else if (format === 'pdf') {
        const res = await generatePDFBlob(text, fileObj, piiItems, true, `${baseName}.pdf`);
        zip.file(res.filename, res.blob);
      } else if (format === 'docx') {
        const res = await generateDOCXBlob(text, `${baseName}.docx`, fileObj, piiItems);
        zip.file(res.filename, res.blob);
      } else {
        // 'txt'
        const res = generateTXTBlob(text, `${baseName}.txt`);
        zip.file(res.filename, res.blob);
      }
    } catch (fileErr) {
      console.error(`Error exporting file ${baseName} in batch:`, fileErr);
      // Fallback to txt for this specific file so the batch download doesn't fail completely
      const fallback = generateTXTBlob(text, `${baseName}.txt`);
      zip.file(fallback.filename, fallback.blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `redactify-batch-${timestamp}.zip`);
  return { success: true, count: files.length };
};
