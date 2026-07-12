-- ===============================================================
-- Migration: persist_monthly_partner_bonus
--
-- Fixes a real gap found during partner program audit: the ₦30,000
-- monthly bonus (50 yearly-billed vendor commissions in a calendar
-- month) was only ever calculated live in the partner dashboard's
-- JavaScript on every page load — never written as an actual
-- commissions row, even though the table's own `type` column already
-- has 'bonus' as a recognized category. This meant there was no
-- durable, admin-auditable record of a bonus ever being earned.
--
-- This extends the existing handle_commission_on_payment() trigger
-- (the same one that already creates the 20%/10% vendor commission
-- and the 5% override) to also check, immediately after each new
-- yearly vendor commission, whether the partner has just crossed a
-- new 50-multiple threshold for the current calendar month — and if
-- so, writes a real, permanent bonus commission row.
-- ===============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_commission_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  partner uuid;
  commission_rate numeric;
  commission_amount numeric;
  payment_count integer;
  parent_partner uuid;
  override_amount numeric;
  monthly_yearly_count integer;
  bonus_units_before integer;
  bonus_units_after integer;
BEGIN
  IF NEW.status != 'confirmed' THEN RETURN NEW; END IF;
  IF OLD.status = 'confirmed' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM commissions WHERE payment_id = NEW.id
  ) THEN RETURN NEW; END IF;

  SELECT referred_by_partner_id INTO partner
  FROM vendors WHERE id = NEW.vendor_id;

  IF partner IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO payment_count
  FROM vendor_payments
  WHERE vendor_id = NEW.vendor_id AND status = 'confirmed';

  commission_rate := CASE WHEN payment_count = 1 THEN 0.20 ELSE 0.10 END;
  commission_amount := ROUND((NEW.amount::numeric) * commission_rate);

  -- Direct vendor commission
  INSERT INTO commissions (
    partner_id, vendor_id, payment_id, amount,
    status, unlock_date, created_at, type
  ) VALUES (
    partner, NEW.vendor_id, NEW.id, commission_amount,
    'pending', now() + interval '7 days', now(), 'vendor'
  );

  -- Override commission (Level 1) — 5% of the referred partner's OWN
  -- commission. Paid separately as Spotlight's own liability, never
  -- deducted from the referred partner's earnings.
  SELECT referred_by INTO parent_partner
  FROM partners WHERE id = partner;

  IF parent_partner IS NOT NULL THEN
    override_amount := ROUND(commission_amount * 0.05);
    INSERT INTO commissions (
      partner_id, vendor_id, payment_id, amount,
      status, unlock_date, created_at, type, source_partner_id
    ) VALUES (
      parent_partner, NEW.vendor_id, NEW.id, override_amount,
      'pending', now() + interval '7 days', now(), 'override', partner
    );
  END IF;

  -- ===============================================================
  -- MONTHLY BONUS — ₦30,000 per 50 yearly-billed vendor commissions
  -- in a calendar month. Now persisted as a real row the moment the
  -- threshold is newly crossed, instead of only ever existing as a
  -- number recalculated in a browser tab.
  -- ===============================================================

  IF NEW.billing_type = 'yearly' THEN

    SELECT COUNT(*) INTO monthly_yearly_count
    FROM commissions c
    JOIN vendor_payments vp ON vp.id = c.payment_id
    WHERE c.partner_id = partner
    AND c.type = 'vendor'
    AND vp.billing_type = 'yearly'
    AND date_trunc('month', c.created_at) = date_trunc('month', now());

    bonus_units_before := FLOOR((monthly_yearly_count - 1) / 50.0);
    bonus_units_after := FLOOR(monthly_yearly_count / 50.0);

    IF bonus_units_after > bonus_units_before THEN
      INSERT INTO commissions (
        partner_id, vendor_id, payment_id, amount,
        status, unlock_date, created_at, type
      ) VALUES (
        partner, NEW.vendor_id, NEW.id, 3000000,
        'pending', now() + interval '7 days', now(), 'bonus'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
