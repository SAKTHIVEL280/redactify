/**
 * DEPRECATED: Supabase client-side direct access is disabled for security.
 *
 * All license generation, verification, and recovery operations are routed
 * securely through Vercel Serverless Functions (/api/*) using server-side
 * service keys and rate-limited endpoints.
 */

export const supabase = null;

export const storeLicenseInSupabase = async () => ({
  success: false,
  error: 'Direct client-side Supabase writes are disabled. Use serverless API endpoints.'
});

export const recoverLicenseByPaymentId = async () => ({
  success: false,
  error: 'Direct client-side Supabase reads are disabled. Use /api/recover-by-payment.'
});

export const recoverLicenseByEmail = async () => ({
  success: false,
  error: 'Direct client-side Supabase reads are disabled. Use /api/send-recovery-code.'
});

export const verifyLicenseKey = async () => ({
  isValid: false,
  error: 'Direct client-side Supabase verification is disabled.'
});
