-- ============================================================
-- DEV RESET SCRIPT — Reset a partner for retesting
-- Replace the email below with the partner you want to reset
-- NEVER run this on a real production partner
-- ============================================================

DO $$
DECLARE
  p_id UUID;
BEGIN

  -- Get partner ID by email
  SELECT id INTO p_id
  FROM public.partners
  WHERE email = 'your-test-partner@email.com'; -- CHANGE THIS

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Partner not found';
  END IF;

  -- Delete commissions linked to this partner
  DELETE FROM public.commissions
  WHERE partner_id = p_id;

  -- Reset partner status, referral code, and account link
  UPDATE public.partners
  SET
    status = 'pending',
    referral_code = NULL,
    user_id = NULL,
    notification_sent = false
  WHERE id = p_id;

  RAISE NOTICE 'Partner reset complete for ID: %', p_id;

END $$;
