-- ===============================================================
-- Migration: email_change_otp
-- Block 4, item 19 — OTP-based email change flow (single verification)
--
-- One 6-digit code, sent only to the requested new email address.
-- Entering it correctly is sufficient to complete the change — no
-- second code, no old-email confirmation step.
--
-- RLS is enabled with ZERO client-facing policies. Every read and
-- write to this table happens exclusively through the
-- request-email-change / confirm-email-change Edge Functions, using
-- the service role key.
-- ===============================================================

BEGIN;

CREATE TABLE public.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  old_email text NOT NULL,
  new_email text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

COMMIT;
