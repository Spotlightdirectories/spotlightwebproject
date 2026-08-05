-- ===============================================================
-- Pre-cutover performance fix, batch 2: RLS auth.uid() wrapping
-- ===============================================================
-- What this does: every policy below calls auth.uid() (or a chain that
-- reads it) directly. Postgres/Supabase's own guidance is that this gets
-- RE-EVALUATED FOR EVERY ROW a query scans, instead of once per query.
-- Wrapping it as (select auth.uid()) makes Postgres cache the one result
-- and reuse it -- same access rules, same results, just computed once.
--
-- Safety: I read every one of these policies' exact definition from the
-- live database first (pg_policies) and only changed the auth.uid() call
-- itself -- every table name, role, condition, and AND/OR structure is
-- byte-for-byte the same as what's live today. Nothing was merged,
-- dropped, or restructured. This is the officially documented safe
-- rewrite from Supabase's own linter remediation page:
-- https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
--
-- Scope: only the 6 tables every customer/vendor hits constantly
-- (vendors, vendor_products, vendor_services, visit_requests, branches,
-- analytics_events). Lower-traffic tables (admin/partner tables etc.)
-- were intentionally left for a later, separate pass.
--
-- Run this whole file at once in the Supabase SQL Editor. It's wrapped
-- so each DROP+CREATE pair happens together -- if anything unexpected
-- occurs, nothing partially applies.

BEGIN;

-- ── analytics_events ──────────────────────────────────────────
DROP POLICY IF EXISTS "Customer can view own analytics events" ON public.analytics_events;
CREATE POLICY "Customer can view own analytics events" ON public.analytics_events
  FOR SELECT
  TO public
  USING (
    customer_id IN (
      SELECT customers.id FROM customers
      WHERE customers.auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "analytics_events_select" ON public.analytics_events;
CREATE POLICY "analytics_events_select" ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.id = analytics_events.vendor_id
      AND v.auth_user_id = (select auth.uid())
    )
  );

-- ── branches ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Vendor can delete rows" ON public.branches;
CREATE POLICY "Vendor can delete rows" ON public.branches
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = branches.vendor_id)
  );

DROP POLICY IF EXISTS "branches_insert_with_limit" ON public.branches;
CREATE POLICY "branches_insert_with_limit" ON public.branches
  FOR INSERT
  TO public
  WITH CHECK (
    ((select auth.uid()) = (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = branches.vendor_id))
    AND (count_vendor_branches(vendor_id) < (
      SELECT get_vendor_plan_limits.max_branches
      FROM get_vendor_plan_limits(branches.vendor_id)
        AS get_vendor_plan_limits(max_products, max_services, max_social_links, max_branches, max_gallery_images, video_allowed)
    ))
  );

DROP POLICY IF EXISTS "Vendor can update branches" ON public.branches;
CREATE POLICY "Vendor can update branches" ON public.branches
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = branches.vendor_id)
  )
  WITH CHECK (
    (select auth.uid()) = (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = branches.vendor_id)
  );

-- ── vendor_products ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated vendors can delete their own products" ON public.vendor_products;
CREATE POLICY "Authenticated vendors can delete their own products" ON public.vendor_products
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = vendor_products.vendor_id)
  );

DROP POLICY IF EXISTS "vendor_products_insert_with_limit" ON public.vendor_products;
CREATE POLICY "vendor_products_insert_with_limit" ON public.vendor_products
  FOR INSERT
  TO public
  WITH CHECK (
    (vendor_id IN (SELECT vendors.id FROM vendors WHERE vendors.auth_user_id = (select auth.uid())))
    AND ((SELECT vendors.business_type FROM vendors WHERE vendors.id = vendor_products.vendor_id) = ANY (ARRAY['product'::text, 'hybrid'::text]))
    AND (count_vendor_products(vendor_id) < (
      SELECT get_vendor_plan_limits.max_products
      FROM get_vendor_plan_limits(vendor_products.vendor_id)
        AS get_vendor_plan_limits(max_products, max_services, max_social_links, max_branches, max_gallery_images, video_allowed)
    ))
  );

DROP POLICY IF EXISTS "Authenticated vendors can view their own products" ON public.vendor_products;
CREATE POLICY "Authenticated vendors can view their own products" ON public.vendor_products
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = vendor_products.vendor_id)
  );

DROP POLICY IF EXISTS "Authenticated vendors can update their own products" ON public.vendor_products;
CREATE POLICY "Authenticated vendors can update their own products" ON public.vendor_products
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = vendor_products.vendor_id)
  )
  WITH CHECK (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = vendor_products.vendor_id)
  );

-- ── vendor_services ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated vendors can delete their own services" ON public.vendor_services;
CREATE POLICY "Authenticated vendors can delete their own services" ON public.vendor_services
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = vendor_services.vendor_id)
  );

DROP POLICY IF EXISTS "vendor_services_insert_with_limit" ON public.vendor_services;
CREATE POLICY "vendor_services_insert_with_limit" ON public.vendor_services
  FOR INSERT
  TO public
  WITH CHECK (
    (vendor_id IN (SELECT vendors.id FROM vendors WHERE vendors.auth_user_id = (select auth.uid())))
    AND ((SELECT vendors.business_type FROM vendors WHERE vendors.id = vendor_services.vendor_id) = ANY (ARRAY['service'::text, 'hybrid'::text]))
    AND (count_vendor_services(vendor_id) < (
      SELECT get_vendor_plan_limits.max_services
      FROM get_vendor_plan_limits(vendor_services.vendor_id)
        AS get_vendor_plan_limits(max_products, max_services, max_social_links, max_branches, max_gallery_images, video_allowed)
    ))
  );

DROP POLICY IF EXISTS "Authenticated vendors can update their own services" ON public.vendor_services;
CREATE POLICY "Authenticated vendors can update their own services" ON public.vendor_services
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = vendor_services.vendor_id)
  )
  WITH CHECK (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = vendor_services.vendor_id)
  );

-- ── visit_requests ────────────────────────────────────────────
DROP POLICY IF EXISTS "Customers can create their own visit requests" ON public.visit_requests;
CREATE POLICY "Customers can create their own visit requests" ON public.visit_requests
  FOR INSERT
  TO public
  WITH CHECK (
    customer_id IN (SELECT customers.id FROM customers WHERE customers.auth_user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Customers can view their own visit requests" ON public.visit_requests;
CREATE POLICY "Customers can view their own visit requests" ON public.visit_requests
  FOR SELECT
  TO public
  USING (
    customer_id IN (SELECT customers.id FROM customers WHERE customers.auth_user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Vendors can view their own visit requests" ON public.visit_requests;
CREATE POLICY "Vendors can view their own visit requests" ON public.visit_requests
  FOR SELECT
  TO public
  USING (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = visit_requests.vendor_id)
  );

DROP POLICY IF EXISTS "Customers can cancel their own pending visit requests" ON public.visit_requests;
CREATE POLICY "Customers can cancel their own pending visit requests" ON public.visit_requests
  FOR UPDATE
  TO public
  USING (
    (customer_id IN (SELECT customers.id FROM customers WHERE customers.auth_user_id = (select auth.uid())))
    AND (status = 'pending'::text)
  )
  WITH CHECK (
    (customer_id IN (SELECT customers.id FROM customers WHERE customers.auth_user_id = (select auth.uid())))
    AND (status = 'cancelled'::text)
  );

DROP POLICY IF EXISTS "Vendors can update their own visit requests" ON public.visit_requests;
CREATE POLICY "Vendors can update their own visit requests" ON public.visit_requests
  FOR UPDATE
  TO public
  USING (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = visit_requests.vendor_id)
  )
  WITH CHECK (
    (select auth.uid()) IN (SELECT vendors.auth_user_id FROM vendors WHERE vendors.id = visit_requests.vendor_id)
  );

-- ── vendors ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Vendor manage own record" ON public.vendors;
CREATE POLICY "Vendor manage own record" ON public.vendors
  FOR ALL
  TO public
  USING ((select auth.uid()) = auth_user_id)
  WITH CHECK ((select auth.uid()) = auth_user_id);

DROP POLICY IF EXISTS "Allow vendor owner update" ON public.vendors;
CREATE POLICY "Allow vendor owner update" ON public.vendors
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = auth_user_id)
  WITH CHECK ((select auth.uid()) = auth_user_id);

DROP POLICY IF EXISTS "admins can upgrade vendors" ON public.vendors;
CREATE POLICY "admins can upgrade vendors" ON public.vendors
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::text, 'super_admin'::text])
    )
  );

DROP POLICY IF EXISTS "admins update vendors" ON public.vendors;
CREATE POLICY "admins update vendors" ON public.vendors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'finance_admin'::text, 'verification_admin'::text])
    )
  );

COMMIT;

-- NOTE: this file intentionally does NOT merge or delete any of the
-- overlapping duplicate policies (e.g. vendors has 3 separate UPDATE
-- policies, visit_requests has 2 separate SELECT policies). Those are
-- flagged as a *smaller* performance issue than the auth.uid() rewrap
-- above, and combining them carries more risk of a subtle access-rule
-- mistake since some of them intentionally cover different admin role
-- sets. Left as a deliberate, separate, lower-priority follow-up.
