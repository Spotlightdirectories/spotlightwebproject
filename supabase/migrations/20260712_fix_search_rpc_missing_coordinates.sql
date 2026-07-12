-- ===============================================================
-- Migration: fix_search_rpc_missing_coordinates
--
-- Fixes a real bug found via live testing: search_products and
-- search_services never returned the vendor's latitude/longitude,
-- even though discover-results.js's distance filter expects
-- vendor_latitude/vendor_longitude on every row. Distance filtering
-- for products and services could never work as a result — every
-- row silently got null distance and was filtered out.
--
-- Requires DROP before CREATE since the return column list is
-- changing, which Postgres doesn't allow via CREATE OR REPLACE alone.
-- ===============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.search_products(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.search_services(text, text, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.search_products(
  p_keyword text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_subcategory text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_lga text DEFAULT NULL,
  p_verified_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid, slug text, vendor_id uuid, product_name text, short_description text,
  price numeric, primary_image_url text, vendor_name text, vendor_category text,
  vendor_subcategory text, vendor_state text, vendor_lga text,
  vendor_verification_status text, vendor_average_rating numeric,
  vendor_reviews_count integer, vendor_is_sponsored boolean, vendor_slug text,
  vendor_logo_url text, vendor_latitude double precision, vendor_longitude double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.slug, p.vendor_id, p.product_name, p.short_description,
    p.price, p.primary_image_url,
    v.name, v.category, v.subcategory, v.state, v.lga,
    v.verification_status, v.average_rating, v.reviews_count,
    v.is_sponsored, v.slug, v.logo_url, v.latitude, v.longitude
  FROM vendor_products p
  JOIN vendors v ON v.id = p.vendor_id
  WHERE v.account_status = 'active'
    AND (p_keyword IS NULL OR p_keyword = '' OR (
      p.product_name ILIKE '%' || p_keyword || '%' OR
      p.short_description ILIKE '%' || p_keyword || '%' OR
      p.key_details ILIKE '%' || p_keyword || '%' OR
      v.name ILIKE '%' || p_keyword || '%' OR
      v.category ILIKE '%' || p_keyword || '%' OR
      v.subcategory ILIKE '%' || p_keyword || '%'
    ))
    AND (p_category IS NULL OR p_category = '' OR v.category = p_category)
    AND (p_subcategory IS NULL OR p_subcategory = '' OR v.subcategory = p_subcategory)
    AND (p_state IS NULL OR p_state = '' OR v.state = p_state)
    AND (p_lga IS NULL OR p_lga = '' OR v.lga = p_lga)
    AND (p_verified_only = false OR v.verification_status <> 'none')
  ORDER BY
    CASE WHEN v.is_sponsored THEN 1
         WHEN v.verification_status = 'blue' THEN 2
         WHEN v.verification_status = 'gray' THEN 3
         ELSE 4 END,
    v.average_rating DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.search_services(
  p_keyword text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_subcategory text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_lga text DEFAULT NULL,
  p_verified_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid, slug text, vendor_id uuid, service_name text, short_description text,
  starting_price numeric, representative_image_url text, vendor_name text,
  vendor_category text, vendor_subcategory text, vendor_state text, vendor_lga text,
  vendor_verification_status text, vendor_average_rating numeric,
  vendor_reviews_count integer, vendor_is_sponsored boolean, vendor_slug text,
  vendor_logo_url text, vendor_latitude double precision, vendor_longitude double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    s.id, s.slug, s.vendor_id, s.service_name, s.short_description,
    s.starting_price, s.representative_image_url,
    v.name, v.category, v.subcategory, v.state, v.lga,
    v.verification_status, v.average_rating, v.reviews_count,
    v.is_sponsored, v.slug, v.logo_url, v.latitude, v.longitude
  FROM vendor_services s
  JOIN vendors v ON v.id = s.vendor_id
  WHERE v.account_status = 'active'
    AND (p_keyword IS NULL OR p_keyword = '' OR (
      s.service_name ILIKE '%' || p_keyword || '%' OR
      s.short_description ILIKE '%' || p_keyword || '%' OR
      v.name ILIKE '%' || p_keyword || '%' OR
      v.category ILIKE '%' || p_keyword || '%' OR
      v.subcategory ILIKE '%' || p_keyword || '%'
    ))
    AND (p_category IS NULL OR p_category = '' OR v.category = p_category)
    AND (p_subcategory IS NULL OR p_subcategory = '' OR v.subcategory = p_subcategory)
    AND (p_state IS NULL OR p_state = '' OR v.state = p_state)
    AND (p_lga IS NULL OR p_lga = '' OR v.lga = p_lga)
    AND (p_verified_only = false OR v.verification_status <> 'none')
  ORDER BY
    CASE WHEN v.is_sponsored THEN 1
         WHEN v.verification_status = 'blue' THEN 2
         WHEN v.verification_status = 'gray' THEN 3
         ELSE 4 END,
    v.average_rating DESC NULLS LAST;
$$;

COMMIT;
