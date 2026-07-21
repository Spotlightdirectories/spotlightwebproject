-- ===============================================================
-- Migration: fix_plan_limit_infinite_recursion
-- Fixes a real bug found via live testing: "infinite recursion
-- detected in policy for relation vendor_products" (Postgres 42P17).
--
-- Root cause: all five item-17 limit-checking policies count
-- existing rows via a subquery on the SAME table the policy is
-- attached to (e.g. counting vendor_products from within a policy
-- ON vendor_products). Postgres cannot safely evaluate that.
--
-- Fix: each count moves into its own small function, exactly the
-- same pattern already used for get_vendor_plan_limits(). This
-- affects saving products, services, social links, branches, and
-- gallery/video uploads — all five are corrected here.
-- ===============================================================

BEGIN;

-- ---------------------------------------------------------------
-- Counting functions (one per table, avoids the self-reference)
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.count_vendor_products(p_vendor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer FROM public.vendor_products WHERE vendor_id = p_vendor_id;
$$;

CREATE OR REPLACE FUNCTION public.count_vendor_services(p_vendor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer FROM public.vendor_services WHERE vendor_id = p_vendor_id;
$$;

CREATE OR REPLACE FUNCTION public.count_vendor_social_links(p_vendor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer FROM public.vendor_social_links WHERE vendor_id = p_vendor_id;
$$;

CREATE OR REPLACE FUNCTION public.count_vendor_branches(p_vendor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer FROM public.branches WHERE vendor_id = p_vendor_id;
$$;

CREATE OR REPLACE FUNCTION public.count_vendor_gallery_images(p_vendor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer FROM public.vendor_media WHERE vendor_id = p_vendor_id AND media_type = 'image';
$$;

-- ---------------------------------------------------------------
-- Rebuild all five policies to use the functions instead of the
-- self-referential subquery
-- ---------------------------------------------------------------

DROP POLICY IF EXISTS "vendor_products_insert_with_limit" ON public.vendor_products;
CREATE POLICY "vendor_products_insert_with_limit" ON public.vendor_products
FOR INSERT
WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  AND (SELECT business_type FROM public.vendors WHERE id = vendor_products.vendor_id) = ANY (ARRAY['product','hybrid'])
  AND public.count_vendor_products(vendor_products.vendor_id)
      < (SELECT max_products FROM public.get_vendor_plan_limits(vendor_products.vendor_id))
);

DROP POLICY IF EXISTS "vendor_services_insert_with_limit" ON public.vendor_services;
CREATE POLICY "vendor_services_insert_with_limit" ON public.vendor_services
FOR INSERT
WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  AND (SELECT business_type FROM public.vendors WHERE id = vendor_services.vendor_id) = ANY (ARRAY['service','hybrid'])
  AND public.count_vendor_services(vendor_services.vendor_id)
      < (SELECT max_services FROM public.get_vendor_plan_limits(vendor_services.vendor_id))
);

DROP POLICY IF EXISTS "vendor_social_links_insert_with_limit" ON public.vendor_social_links;
CREATE POLICY "vendor_social_links_insert_with_limit" ON public.vendor_social_links
FOR INSERT
WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  AND public.count_vendor_social_links(vendor_social_links.vendor_id)
      < (SELECT max_social_links FROM public.get_vendor_plan_limits(vendor_social_links.vendor_id))
);

DROP POLICY IF EXISTS "branches_insert_with_limit" ON public.branches;
CREATE POLICY "branches_insert_with_limit" ON public.branches
FOR INSERT
WITH CHECK (
  auth.uid() = (SELECT auth_user_id FROM public.vendors WHERE id = branches.vendor_id)
  AND public.count_vendor_branches(branches.vendor_id)
      < (SELECT max_branches FROM public.get_vendor_plan_limits(branches.vendor_id))
);

DROP POLICY IF EXISTS "vendor_media_insert_with_limit" ON public.vendor_media;
CREATE POLICY "vendor_media_insert_with_limit" ON public.vendor_media
FOR INSERT
WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  AND (
    (
      media_type = 'image'
      AND public.count_vendor_gallery_images(vendor_media.vendor_id)
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
