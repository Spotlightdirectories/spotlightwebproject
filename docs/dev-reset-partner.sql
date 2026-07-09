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
  auth_id UUID;
BEGIN

  -- Get partner ID by email
  SELECT id INTO p_id
  FROM public.partners
  WHERE email = 'your-test-partner@email.com'; -- CHANGE THIS

  -- Get auth user ID by email
  SELECT id INTO auth_id
  FROM auth.users
  WHERE email = 'your-test-partner@email.com'; -- CHANGE THIS (same email)

  -- Delete commissions linked to this partner
  IF p_id IS NOT NULL THEN
    DELETE FROM public.commissions
    WHERE partner_id = p_id;
  END IF;

  -- ============================================================
  -- OPTION A: Full delete — removes partner record AND auth user
  -- Use this when you want to re-test the full signup flow
  -- ============================================================
  IF p_id IS NOT NULL THEN
    DELETE FROM public.partners WHERE id = p_id;
    RAISE NOTICE 'Partner record deleted';
  ELSE
    RAISE NOTICE 'No partner record found — skipping';
  END IF;

  IF auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = auth_id;
    RAISE NOTICE 'Auth user deleted';
  ELSE
    RAISE NOTICE 'No auth user found — skipping';
  END IF;

  -- ============================================================
  -- OPTION B: Status reset only — keeps partner record and auth user
  -- Use this when you want to re-test the approval/rejection flow
  -- Comment out OPTION A above and uncomment this block instead
  -- ============================================================
  -- IF p_id IS NOT NULL THEN
  --   UPDATE public.partners
  --   SET
  --     status = 'pending',
  --     referral_code = NULL,
  --     user_id = NULL,
  --     notification_sent = false
  --   WHERE id = p_id;
  --   RAISE NOTICE 'Partner reset to pending for ID: %', p_id;
  -- END IF;

END $$;
