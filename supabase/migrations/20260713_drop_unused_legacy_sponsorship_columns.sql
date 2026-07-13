-- ===============================================================
-- Migration: drop_unused_legacy_sponsorship_columns
--
-- Removes three columns on vendors confirmed unused anywhere in the
-- codebase: sponsorship_status, sponsored_at, sponsored_until.
-- Leftovers from before the real vendor_sponsorships system existed.
--
-- is_sponsored is deliberately NOT dropped here — it had real usage
-- history (loadSimilarBusinesses() in vendor-profile.js referenced
-- it before being switched to the get_similar_businesses RPC), so
-- Cyril chose to leave it in place for now as a precaution.
-- ===============================================================

BEGIN;

ALTER TABLE public.vendors
  DROP COLUMN IF EXISTS sponsorship_status,
  DROP COLUMN IF EXISTS sponsored_at,
  DROP COLUMN IF EXISTS sponsored_until;

COMMIT;
