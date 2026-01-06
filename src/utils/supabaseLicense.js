import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase configuration missing');
}

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Input validation helpers
function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase().slice(0, 254); // Max email length
}

/**
 * Store Pro license in Supabase for recovery
 * @param {Object} licenseData - License information
 * @param {string} licenseData.licenseKey - The generated license key
 * @param {string} licenseData.paymentId - Razorpay payment ID
 * @param {string} licenseData.orderId - Razorpay order ID
 * @param {string} licenseData.email - Optional user email for recovery
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const storeLicenseInSupabase = async (licenseData) => {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Validate and sanitize email
    let sanitizedEmail = null;
    if (licenseData.email) {
      sanitizedEmail = sanitizeEmail(licenseData.email);
      if (!isValidEmail(sanitizedEmail)) {
        return { success: false, error: 'Invalid email format' };
      }
    }

    const { data, error } = await supabase
      .from('pro_licenses')
      .insert([
        {
          license_key: licenseData.licenseKey,
          payment_id: licenseData.paymentId,
          order_id: licenseData.orderId,
          email: sanitizedEmail,
          purchased_at: new Date().toISOString(),
          is_active: true
        }
      ])
      .select();

    if (error) {
      console.error('Supabase storage error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Failed to store license:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Recover Pro license using payment ID
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<{success: boolean, licenseKey?: string, error?: string}>}
 */
export const recoverLicenseByPaymentId = async (paymentId) => {
  try {
    const { data, error } = await supabase
      .from('pro_licenses')
      .select('license_key, email, purchased_at, is_active')
      .eq('payment_id', paymentId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'No license found for this payment ID' };
      }
      console.error('Supabase recovery error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      licenseKey: data.license_key,
      email: data.email,
      purchasedAt: data.purchased_at
    };
  } catch (error) {
    console.error('Failed to recover license:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Recover Pro license using email
 * @param {string} email - User email
 * @returns {Promise<{success: boolean, licenses?: Array, error?: string}>}
 */
export const recoverLicenseByEmail = async (email) => {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Validate and sanitize email
    const sanitizedEmail = sanitizeEmail(email);
    if (!isValidEmail(sanitizedEmail)) {
      return { success: false, error: 'Invalid email format' };
    }

    const { data, error } = await supabase
      .from('pro_licenses')
      .select('license_key, payment_id, purchased_at, is_active')
      .eq('email', sanitizedEmail)
      .eq('is_active', true)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Supabase recovery error:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'No licenses found for this email' };
    }

    return { success: true, licenses: data };
  } catch (error) {
    console.error('Failed to recover license:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verify if a license key is valid
 * @param {string} licenseKey - The license key to verify
 * @returns {Promise<{isValid: boolean, error?: string}>}
 */
export const verifyLicenseKey = async (licenseKey) => {
  try {
    const { data, error } = await supabase
      .from('pro_licenses')
      .select('is_active, purchased_at')
      .eq('license_key', licenseKey)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { isValid: false };
      }
      return { isValid: false, error: error.message };
    }

    return { isValid: true, purchasedAt: data.purchased_at };
  } catch (error) {
    console.error('Failed to verify license:', error);
    return { isValid: false, error: error.message };
  }
};
