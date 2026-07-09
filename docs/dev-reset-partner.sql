-- ============================================================
-- DEV RESET SCRIPT — Reset a partner for retesting
-- Replace the email below with the partner you want to reset
-- NEVER run this on a real production partner
--
-- OPTION A: Full delete (use when you want to re-test signup)
-- OPTION B: Status reset only (use when you want to re-test approval flow)
-- Comment/uncomment the section you need
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

  -- ============================================================
  -- OPTION A: Full delete — removes the partner record entirely
  -- Use this when you want to re-test the signup form from scratch
  -- ============================================================
  DELETE FROM public.partners
  WHERE id = p_id;

  RAISE NOTICE 'Partner fully deleted for re-testing signup';

  -- ============================================================
  -- OPTION B: Status reset only — keeps the partner record
  -- Use this when you want to re-test the approval/rejection flow
  -- Comment out OPTION A above and uncomment this block instead
  -- ============================================================
  -- UPDATE public.partners
  -- SET
  --   status = 'pending',
  --   referral_code = NULL,
  --   user_id = NULL,
  --   notification_sent = false
  -- WHERE id = p_id;
  --
  -- RAISE NOTICE 'Partner reset to pending for ID: %', p_id;

END $$;
