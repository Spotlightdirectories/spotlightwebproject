-- ===============================================================
-- Migration: search_vendors_rpc_and_sponsorship_warning_column
--
-- 1. Builds the search_vendors function that was missing this whole
--    time — vendor-type search was still running a plain query
--    reading the old, disconnected vendors.is_sponsored column
--    directly, instead of the real vendor_sponsorships system every
--    other search type already uses. Matches the exact same pattern
--    as search_products/search_services.
--
-- 2. Adds a tracking column to vendor_sponsorships so the expiry
--    warning email (subscription expiring while sponsorship still
--    active) only sends once, not every day until it's addressed.
-- ===============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.search_vendors(
  p_keyword text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_subcategory text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_lga text DEFAULT NULL,
  p_verified_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid, slug text, name text, logo_url text, cover_url text,
  category text, subcategory text, state text, lga text, address text,
  verification_status text, average_rating numeric, reviews_count integer,
  is_sponsored boolean, business_type text,
  latitude double precision, longitude double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    v.id, v.slug, v.name, v.logo_url, v.cover_url,
    v.category, v.subcategory, v.state, v.lga, v.address,
    v.verification_status, v.average_rating, v.reviews_count,
    (get_vendor_sponsorship_strength(v.id) > 0), v.business_type,
    v.latitude, v.longitude
  FROM vendors v
  WHERE v.account_status = 'active'
    AND (p_keyword IS NULL OR p_keyword = '' OR (
      v.name ILIKE '%' || p_keyword || '%' OR
      v.category ILIKE '%' || p_keyword || '%' OR
      v.subcategory ILIKE '%' || p_keyword || '%' OR
      v.description ILIKE '%' || p_keyword || '%'
    ))
    AND (p_category IS NULL OR p_category = '' OR v.category = p_category)
    AND (p_subcategory IS NULL OR p_subcategory = '' OR v.subcategory = p_subcategory)
    AND (p_state IS NULL OR p_state = '' OR v.state = p_state)
    AND (p_lga IS NULL OR p_lga = '' OR v.lga = p_lga)
    AND (p_verified_only = false OR v.verification_status <> 'none')
  ORDER BY
    CASE WHEN get_vendor_sponsorship_strength(v.id) > 0 THEN 1
         WHEN v.verification_status = 'blue' THEN 2
         WHEN v.verification_status = 'gray' THEN 3
         ELSE 4 END,
    get_vendor_sponsorship_strength(v.id) DESC,
    v.average_rating DESC NULLS LAST;
$$;

ALTER TABLE public.vendor_sponsorships
  ADD COLUMN IF NOT EXISTS subscription_risk_warning_sent boolean NOT NULL DEFAULT false;

COMMIT;
