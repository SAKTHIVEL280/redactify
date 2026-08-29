-- ====================================================================
-- Redactify Supabase Schema Definition
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ====================================================================

-- 1. PRO LICENSES TABLE
-- Stores verified purchases, cryptographic license keys, and revocation state
CREATE TABLE IF NOT EXISTS public.pro_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT NOT NULL UNIQUE,
    payment_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    email TEXT,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_pro_licenses_payment_id ON public.pro_licenses (payment_id);
CREATE INDEX IF NOT EXISTS idx_pro_licenses_email ON public.pro_licenses (email);
CREATE INDEX IF NOT EXISTS idx_pro_licenses_license_key ON public.pro_licenses (license_key);

-- 2. VERIFICATION CODES TABLE
-- Stores temporary 6-digit email OTPs for license recovery
CREATE TABLE IF NOT EXISTS public.verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verification Code Lookup Index
CREATE INDEX IF NOT EXISTS idx_verification_codes_email_created ON public.verification_codes (email, created_at DESC);

-- 3. CONCURRENT REDACTION LOCKS TABLE
-- Coordinates simultaneous document redactions across multiple devices on the same account
CREATE TABLE IF NOT EXISTS public.redaction_locks (
    license_key TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Critical Security Guard: Prevents public anonymous users from reading/leaking licenses or OTPs
ALTER TABLE public.pro_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redaction_locks ENABLE ROW LEVEL SECURITY;

-- Note: All Redactify Vercel Serverless Functions connect using SUPABASE_SERVICE_KEY (service_role),
-- which automatically bypasses RLS while keeping the tables 100% blocked from unauthorized public anon access.
