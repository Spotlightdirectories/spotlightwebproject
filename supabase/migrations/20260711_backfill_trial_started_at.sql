-- ===============================================================
-- Migration: backfill_trial_started_at
--
-- Fixes a real, business-critical bug: vendor signup never set
-- trial_started_at, for any vendor, ever. This meant the entire
-- 90-day free trial (enhanced limits: 3 products, 3 services,
-- 1 social link, 3 gallery images) never actually activated for a
-- single real vendor — everyone on Free has been silently stuck on
-- the bare 1-product/1-service baseline since signup.
--
-- signup.js is now fixed for all FUTURE signups. This backfills the
-- 18 existing free vendors who never got their real trial, giving
-- each a genuine, fresh 90-day trial starting today rather than
-- leaving them stuck or trying to backdate incorrectly.
-- ===============================================================

BEGIN;

UPDATE public.vendors
SET trial_started_at = now()
WHERE plan_tier = 'free'
AND trial_started_at IS NULL;

COMMIT;
