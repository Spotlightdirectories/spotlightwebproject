-- ===============================================================
-- Migration: sponsorship_module_foundation
--
-- Builds the real sponsorship system: a dedicated table tracking
-- who's sponsored (business, product, or service), at what tier,
-- for how long, and how they paid — replacing the old is_sponsored
-- boolean-only model everywhere ranking depends on it.
--
-- Key rule encoded here: a product/service's EFFECTIVE tier is
-- whichever is stronger — its own direct sponsorship, or its
-- vendor's business-level sponsorship (which acts as a floor that
-- applies to everything the vendor sells). Vendor cards only ever
-- look at the vendor's own business sponsorship, never inherit
-- from individual products/services.
-- ===============================================================

BEGIN;

-- ---------------------------------------------------------------
-- TABLE: vendor_sponsorships
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  sponsorship_type text NOT NULL CHECK (sponsorship_type IN ('business', 'product', 'service')),
  target_id uuid, -- null for business; vendor_products.id or vendor_services.id otherwise
  tier text NOT NULL CHECK (tier IN ('standard', 'silver', 'gold', 'platinum', 'diamond')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount_paid numeric NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('paystack', 'bank_transfer')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'active', 'expired', 'rejected')),
  receipt_url text,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT target_id_matches_type CHECK (
    (sponsorship_type = 'business' AND target_id IS NULL) OR
    (sponsorship_type IN ('product', 'service') AND target_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_vendor_sponsorships_vendor ON public.vendor_sponsorships(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sponsorships_target ON public.vendor_sponsorships(target_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sponsorships_active ON public.vendor_sponsorships(payment_status, expires_at);

ALTER TABLE public.vendor_sponsorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_sponsorships_owner_select ON public.vendor_sponsorships
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  );

CREATE POLICY vendor_sponsorships_owner_insert ON public.vendor_sponsorships
  FOR INSERT WITH CHECK (
    vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- TIER STRENGTH — a simple numeric ranking so "higher tier wins"
-- can be compared and sorted correctly.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tier_strength(p_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'diamond' THEN 5
    WHEN 'platinum' THEN 4
    WHEN 'gold' THEN 3
    WHEN 'silver' THEN 2
    WHEN 'standard' THEN 1
    ELSE 0
  END;
$$;

-- ---------------------------------------------------------------
-- EFFECTIVE TIER STRENGTH FUNCTIONS
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vendor_sponsorship_strength(p_vendor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(MAX(public.get_tier_strength(tier)), 0)
  FROM public.vendor_sponsorships
  WHERE sponsorship_type = 'business'
    AND vendor_id = p_vendor_id
    AND payment_status = 'active'
    AND expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.get_product_sponsorship_strength(p_product_id uuid, p_vendor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT GREATEST(
    COALESCE((
      SELECT MAX(public.get_tier_strength(tier))
      FROM public.vendor_sponsorships
      WHERE sponsorship_type = 'product'
        AND target_id = p_product_id
        AND payment_status = 'active'
        AND expires_at > now()
    ), 0),
    public.get_vendor_sponsorship_strength(p_vendor_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_service_sponsorship_strength(p_service_id uuid, p_vendor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT GREATEST(
    COALESCE((
      SELECT MAX(public.get_tier_strength(tier))
      FROM public.vendor_sponsorships
      WHERE sponsorship_type = 'service'
        AND target_id = p_service_id
        AND payment_status = 'active'
        AND expires_at > now()
    ), 0),
    public.get_vendor_sponsorship_strength(p_vendor_id)
  );
$$;

COMMIT;
