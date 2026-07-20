-- ===============================================================
-- Migration: extend_plan_limits_and_fix_bugs
-- Block 4, item 17 — server-side plan limit enforcement
--
-- Fix existing bugs + extend get_vendor_plan_limits to cover
-- products, services, social links, branches, gallery images,
-- and a video-allowed gate. Matches the limits already used in
-- the front-end JS (PRODUCT_LIMITS, SERVICE_LIMITS, SOCIAL_LIMITS,
-- BRANCH_LIMITS, VIDEO_LIMITS) and the getlisted.html pricing page.
--
-- Fixes:
--   1) 'custom' plan tier previously fell through to the "1" default
--      (custom vendors were being capped at 1 product/service).
--   2) Trial check used vendors.created_at instead of trial_started_at,
--      which could disagree with the front-end trial countdown.
--
-- NOTE: the function's return shape changes (2 columns -> 6), so the
-- two existing dependent policies must be dropped BEFORE the function
-- is dropped and recreated, then rebuilt against the new shape.
-- ===============================================================

-- Wrapped in an explicit transaction: either everything below applies
-- together, or nothing does. This also means no other query can see
-- a half-finished state (e.g. a table briefly missing its insert policy).
BEGIN;

DROP POLICY IF EXISTS "vendor_products_insert_with_limit" ON public.vendor_products;
DROP POLICY IF EXISTS "vendor_services_insert_with_limit" ON public.vendor_services;

DROP FUNCTION IF EXISTS public.get_vendor_plan_limits(uuid);

CREATE FUNCTION public.get_vendor_plan_limits(vendor_uuid uuid)
RETURNS TABLE(
  max_products integer,
  max_services integer,
  max_social_links integer,
  max_branches integer,
  max_gallery_images integer,
  video_allowed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_tier text;
  v_subscription_status text;
  v_trial_started_at timestamp;
  v_is_trial boolean;
BEGIN
  SELECT plan_tier, subscription_status, trial_started_at
  INTO v_plan_tier, v_subscription_status, v_trial_started_at
  FROM public.vendors
  WHERE id = vendor_uuid;

  -- Within 90-day trial window on the free plan, using the SAME
  -- field the front-end trial countdown uses (trial_started_at),
  -- not the account signup date.
  v_is_trial := (
    v_plan_tier = 'free'
    AND v_trial_started_at IS NOT NULL
    AND v_trial_started_at > now() - interval '90 days'
  );

  IF v_plan_tier = 'custom' THEN
    -- Custom plans are bespoke/unlimited by definition.
    RETURN QUERY SELECT
      999999::int, 999999::int, 999999::int, 999999::int, 999999::int, true::boolean;
  ELSIF v_subscription_status = 'active' THEN
    RETURN QUERY SELECT
      (CASE v_plan_tier WHEN 'standard' THEN 6 WHEN 'enterprise' THEN 12 WHEN 'elite' THEN 24 ELSE 1 END)::int,
      (CASE v_plan_tier WHEN 'standard' THEN 6 WHEN 'enterprise' THEN 12 WHEN 'elite' THEN 24 ELSE 1 END)::int,
      (CASE v_plan_tier WHEN 'standard' THEN 2 WHEN 'enterprise' THEN 3 WHEN 'elite' THEN 5 ELSE 0 END)::int,
      (CASE v_plan_tier WHEN 'enterprise' THEN 10 WHEN 'elite' THEN 30 ELSE 0 END)::int,
      (CASE v_plan_tier WHEN 'standard' THEN 6 WHEN 'enterprise' THEN 12 WHEN 'elite' THEN 24 ELSE 1 END)::int,
      true::boolean;
  ELSIF v_is_trial THEN
    RETURN QUERY SELECT 3::int, 3::int, 1::int, 0::int, 3::int, false::boolean;
  ELSE
    RETURN QUERY SELECT 1::int, 1::int, 0::int, 0::int, 1::int, false::boolean;
  END IF;
END;
$function$;

-- ===============================================================
-- Recreate the two original policies against the new function shape
-- ===============================================================

CREATE POLICY "vendor_products_insert_with_limit" ON public.vendor_products
FOR INSERT
WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  AND (SELECT business_type FROM public.vendors WHERE id = vendor_products.vendor_id) = ANY (ARRAY['product','hybrid'])
  AND (SELECT count(*) FROM public.vendor_products vp WHERE vp.vendor_id = vendor_products.vendor_id)
      < (SELECT max_products FROM public.get_vendor_plan_limits(vendor_products.vendor_id))
);

CREATE POLICY "vendor_services_insert_with_limit" ON public.vendor_services
FOR INSERT
WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  AND (SELECT business_type FROM public.vendors WHERE id = vendor_services.vendor_id) = ANY (ARRAY['service','hybrid'])
  AND (SELECT count(*) FROM public.vendor_services vs WHERE vs.vendor_id = vendor_services.vendor_id)
      < (SELECT max_services FROM public.get_vendor_plan_limits(vendor_services.vendor_id))
);

-- ===============================================================
-- NEW: social links now check plan limit (previously only checked
-- "are you logged in", nothing about ownership or plan).
-- ===============================================================

DROP POLICY IF EXISTS "Authenticated users can insert social links" ON public.vendor_social_links;
CREATE POLICY "vendor_social_links_insert_with_limit" ON public.vendor_social_links
FOR INSERT
WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  AND (SELECT count(*) FROM public.vendor_social_links vsl WHERE vsl.vendor_id = vendor_social_links.vendor_id)
      < (SELECT max_social_links FROM public.get_vendor_plan_limits(vendor_social_links.vendor_id))
);

-- ===============================================================
-- NEW: branches now check plan limit (previously only checked
-- ownership, no plan limit at all).
-- ===============================================================

DROP POLICY IF EXISTS "Vendor can insert branches" ON public.branches;
CREATE POLICY "branches_insert_with_limit" ON public.branches
FOR INSERT
WITH CHECK (
  auth.uid() = (SELECT auth_user_id FROM public.vendors WHERE id = branches.vendor_id)
  AND (SELECT count(*) FROM public.branches b WHERE b.vendor_id = branches.vendor_id)
      < (SELECT max_branches FROM public.get_vendor_plan_limits(branches.vendor_id))
);

-- ===============================================================
-- NEW: vendor_media now checks BOTH ownership (previously missing
-- entirely — any logged-in user could insert media under any
-- vendor_id) AND the relevant plan limit: gallery count limit for
-- images, "is video allowed on this plan" gate for videos.
-- ===============================================================

DROP POLICY IF EXISTS "Authenticated users can insert media" ON public.vendor_media;
CREATE POLICY "vendor_media_insert_with_limit" ON public.vendor_media
FOR INSERT
WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  AND (
    (
      media_type = 'image'
      AND (SELECT count(*) FROM public.vendor_media vm WHERE vm.vendor_id = vendor_media.vendor_id AND vm.media_type = 'image')
          < (SELECT max_gallery_images FROM public.get_vendor_plan_limits(vendor_media.vendor_id))
    )
    OR
    (
      media_type = 'video'
      AND (SELECT video_allowed FROM public.get_vendor_plan_limits(vendor_media.vendor_id))
    )
  )
);

COMMIT;
