-- ===============================================================
-- Migration: sponsorship_tier_aware_ranking
--
-- Updates all five ranking functions to use the real tier-strength
-- functions built in the previous migration, instead of the plain
-- is_sponsored boolean. Within the "sponsored" bucket, items now
-- correctly sort by tier strength (Diamond > Platinum > Gold >
-- Silver > Standard) rather than treating all sponsorship as equal.
--
-- Also adds a sponsorship_tier text column to product/service
-- results (nullable) so the frontend can eventually show which
-- tier an item is sponsored at, without breaking the existing
-- vendor_is_sponsored boolean field other code still reads.
-- ===============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.search_products(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.search_services(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.get_similar_products(uuid, uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.get_similar_services(uuid, uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.get_similar_businesses(uuid, text, integer);

-- ---------------------------------------------------------------
-- SEARCH PRODUCTS
-- ---------------------------------------------------------------
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
  vendor_logo_url text, vendor_latitude double precision, vendor_longitude double precision,
  sponsorship_strength integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.slug, p.vendor_id, p.product_name, p.short_description,
    p.price, p.primary_image_url,
    v.name, v.category, v.subcategory, v.state, v.lga,
    v.verification_status, v.average_rating, v.reviews_count,
    (get_product_sponsorship_strength(p.id, p.vendor_id) > 0), v.slug, v.logo_url, v.latitude, v.longitude,
    get_product_sponsorship_strength(p.id, p.vendor_id)
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
    CASE WHEN get_product_sponsorship_strength(p.id, p.vendor_id) > 0 THEN 1
         WHEN v.verification_status = 'blue' THEN 2
         WHEN v.verification_status = 'gray' THEN 3
         ELSE 4 END,
    get_product_sponsorship_strength(p.id, p.vendor_id) DESC,
    v.average_rating DESC NULLS LAST;
$$;

-- ---------------------------------------------------------------
-- SEARCH SERVICES
-- ---------------------------------------------------------------
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
  vendor_logo_url text, vendor_latitude double precision, vendor_longitude double precision,
  sponsorship_strength integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    s.id, s.slug, s.vendor_id, s.service_name, s.short_description,
    s.starting_price, s.representative_image_url,
    v.name, v.category, v.subcategory, v.state, v.lga,
    v.verification_status, v.average_rating, v.reviews_count,
    (get_service_sponsorship_strength(s.id, s.vendor_id) > 0), v.slug, v.logo_url, v.latitude, v.longitude,
    get_service_sponsorship_strength(s.id, s.vendor_id)
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
    CASE WHEN get_service_sponsorship_strength(s.id, s.vendor_id) > 0 THEN 1
         WHEN v.verification_status = 'blue' THEN 2
         WHEN v.verification_status = 'gray' THEN 3
         ELSE 4 END,
    get_service_sponsorship_strength(s.id, s.vendor_id) DESC,
    v.average_rating DESC NULLS LAST;
$$;

-- ---------------------------------------------------------------
-- SIMILAR PRODUCTS
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_similar_products(
  p_exclude_vendor_id uuid,
  p_exclude_product_id uuid,
  p_target_subcategory text,
  p_target_category text,
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  slug text, product_name text, price numeric, primary_image_url text, vendor_id uuid,
  vendor_name text, vendor_verification_status text, vendor_average_rating numeric,
  vendor_reviews_count integer, vendor_is_sponsored boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p.slug, p.product_name, p.price, p.primary_image_url, p.vendor_id,
    v.name, v.verification_status, v.average_rating, v.reviews_count,
    (get_product_sponsorship_strength(p.id, p.vendor_id) > 0)
  FROM vendor_products p
  JOIN vendors v ON v.id = p.vendor_id
  WHERE p.vendor_id <> p_exclude_vendor_id
    AND p.id <> p_exclude_product_id
    AND v.account_status = 'active'
    AND (
      (p_target_subcategory IS NOT NULL AND v.subcategory = p_target_subcategory)
      OR (p_target_subcategory IS NULL AND v.category = p_target_category)
    )
  ORDER BY
    CASE WHEN get_product_sponsorship_strength(p.id, p.vendor_id) > 0 THEN 1
         WHEN v.verification_status = 'blue' THEN 2
         WHEN v.verification_status = 'gray' THEN 3
         ELSE 4 END,
    get_product_sponsorship_strength(p.id, p.vendor_id) DESC,
    v.average_rating DESC NULLS LAST
  LIMIT p_limit;
$$;

-- ---------------------------------------------------------------
-- SIMILAR SERVICES
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_similar_services(
  p_exclude_vendor_id uuid,
  p_exclude_service_id uuid,
  p_target_subcategory text,
  p_target_category text,
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  slug text, service_name text, starting_price numeric, representative_image_url text,
  vendor_id uuid, vendor_name text, vendor_verification_status text,
  vendor_average_rating numeric, vendor_reviews_count integer, vendor_is_sponsored boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    s.slug, s.service_name, s.starting_price, s.representative_image_url, s.vendor_id,
    v.name, v.verification_status, v.average_rating, v.reviews_count,
    (get_service_sponsorship_strength(s.id, s.vendor_id) > 0)
  FROM vendor_services s
  JOIN vendors v ON v.id = s.vendor_id
  WHERE s.vendor_id <> p_exclude_vendor_id
    AND s.id <> p_exclude_service_id
    AND v.account_status = 'active'
    AND (
      (p_target_subcategory IS NOT NULL AND v.subcategory = p_target_subcategory)
      OR (p_target_subcategory IS NULL AND v.category = p_target_category)
    )
  ORDER BY
    CASE WHEN get_service_sponsorship_strength(s.id, s.vendor_id) > 0 THEN 1
         WHEN v.verification_status = 'blue' THEN 2
         WHEN v.verification_status = 'gray' THEN 3
         ELSE 4 END,
    get_service_sponsorship_strength(s.id, s.vendor_id) DESC,
    v.average_rating DESC NULLS LAST
  LIMIT p_limit;
$$;

-- ---------------------------------------------------------------
-- SIMILAR BUSINESSES (vendor-level only — no inheritance from
-- individual products/services, per the agreed rule)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_similar_businesses(
  p_exclude_vendor_id uuid,
  p_target_category text,
  p_limit integer DEFAULT 6
)
RETURNS TABLE (
  id uuid, slug text, name text, logo_url text, category text,
  average_rating numeric, reviews_count integer, verification_status text,
  is_sponsored boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    v.id, v.slug, v.name, v.logo_url, v.category,
    v.average_rating, v.reviews_count, v.verification_status,
    (get_vendor_sponsorship_strength(v.id) > 0)
  FROM vendors v
  WHERE v.category = p_target_category
    AND v.account_status = 'active'
    AND v.onboarding_completed = true
    AND v.public_listing_accepted = true
    AND v.subscription_status = 'active'
    AND v.id <> p_exclude_vendor_id
  ORDER BY
    CASE WHEN get_vendor_sponsorship_strength(v.id) > 0 THEN 1
         WHEN v.verification_status = 'blue' THEN 2
         WHEN v.verification_status = 'gray' THEN 3
         ELSE 4 END,
    get_vendor_sponsorship_strength(v.id) DESC,
    v.average_rating DESC NULLS LAST,
    v.reviews_count DESC NULLS LAST
  LIMIT p_limit;
$$;

COMMIT;
