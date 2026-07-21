-- ============================================================
-- DEV RESET SCRIPT — Reset a vendor for retesting
-- Replace the email below with the vendor you want to reset
-- NEVER run this on a real production vendor
-- ============================================================

DO $$
DECLARE
  v_id UUID;
BEGIN

  -- Get vendor ID by email
  SELECT id INTO v_id
  FROM public.vendors
  WHERE email = 'your-test-vendor@email.com'; -- CHANGE THIS

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Vendor not found';
  END IF;

  -- Delete payment records
  DELETE FROM public.vendor_payments
  WHERE vendor_id = v_id;

  -- Delete verification submissions
  DELETE FROM public.vendor_verifications
  WHERE vendor_id = v_id;

  -- Reset vendor subscription and badge status
  UPDATE public.vendors
  SET
    subscription_status = 'free',
    plan_tier = 'free',
    billing_cycle = NULL,
    is_premium = false,
    paid_at = NULL,
    expires_at = NULL,
    verification_status = NULL,
    trial_expiry_warning_sent = false,
    subscription_expiry_warning_sent = false
  WHERE id = v_id;

  RAISE NOTICE 'Vendor reset complete for ID: %', v_id;

END $$;
