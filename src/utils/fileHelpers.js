/**
 * File helper utilities
 */

import { getFileSizeLimits } from './browserCompat';

/**
 * Validate file size against dynamic browser limits
 * @param {File} file - The file to validate
 * @throws {Error} If file exceeds size limit
 * @returns {boolean} - True if file size is valid
 */
export const validateFileSize = (file) => {
  const limits = getFileSizeLimits();
  if (file.size > limits.maxFileSize) {
    throw new Error(`File size exceeds ${(limits.maxFileSize / 1024 / 1024).toFixed(0)}MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }
  return true;
};

/**
 * Get file type from MIME type
 * @param {string} mimeType - The MIME type from file.type
 * @returns {'pdf' | 'docx' | 'txt'} - Normalized file type
 */
export const getFileTypeFromMime = (mimeType) => {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  return 'txt';
};

/**
 * Validate file type
 * @param {File} file - The file to validate
 * @returns {boolean} - True if file type is supported
 */
export const isValidFileType = (file) => {
  const validTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  // Some OS/browser combos set empty MIME for .txt files — check extension as fallback
  if (!file.type || file.type === '') {
    const ext = file.name?.split('.').pop()?.toLowerCase();
    return ext === 'txt' || ext === 'text';
  }
  
  return validTypes.includes(file.type);
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
