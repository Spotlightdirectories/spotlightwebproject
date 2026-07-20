-- ===============================================================
-- Migration: staff_visibility_and_audit_log
-- Block 4, item 18 follow-up
--
-- PART 1 — fixes a real, pre-existing gap: user_roles has only ever
-- had a self-only SELECT policy. There was never a way for a
-- super_admin to see anyone else's role, so "Admin Staff Management"
-- was always going to show empty the first time a second real admin
-- ever existed. Purely additive — the existing self-only policy is
-- untouched.
--
-- PART 2 — a small helper function so the admin panel can show real
-- staff emails (not just truncated IDs) and so the audit log can
-- record who revoked/assigned whom. auth.users has no client-facing
-- policy at all (by design), so this SECURITY DEFINER function is
-- the only safe bridge — it checks the caller is a super_admin
-- itself, rather than relying on a table-level policy.
--
-- PART 3 — a permanent, append-only audit log. No UPDATE or DELETE
-- policy exists for it at all, by design: this is a paper trail of
-- what happened, completely separate from the working records
-- (invitations, roles) which continue to be fully cleaned up on
-- revoke exactly as already built. The log never blocks or
-- interferes with any future action — it only remembers.
-- ===============================================================

BEGIN;

-- ---------------------------------------------------------------
-- PART 1
-- ---------------------------------------------------------------

CREATE POLICY "super_admin_select_all_roles" ON public.user_roles
FOR SELECT
USING (public.get_my_admin_role() = 'super_admin');

-- ---------------------------------------------------------------
-- PART 2
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_staff_list()
RETURNS TABLE(user_id uuid, email text, role text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_my_admin_role() != 'super_admin' THEN
    RAISE EXCEPTION 'Only a super admin can view the staff list.';
  END IF;

  RETURN QUERY
  SELECT ur.user_id, au.email, ur.role, ur.created_at
  FROM public.user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  WHERE ur.role IN ('admin','finance_admin','verification_admin')
  ORDER BY ur.created_at DESC;
END;
$function$;

-- ---------------------------------------------------------------
-- PART 3
-- ---------------------------------------------------------------

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  actor_email text,
  action text NOT NULL CHECK (action IN (
    'invited',
    'revoked_invitation',
    'assigned_role',
    'revoked_role',
    'claimed_invitation'
  )),
  target_email text,
  role text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admin can ever read the log
CREATE POLICY "super_admin_select_audit_log" ON public.admin_audit_log
FOR SELECT
USING (public.get_my_admin_role() = 'super_admin');

-- A super_admin can log actions they personally performed
CREATE POLICY "super_admin_insert_audit_log" ON public.admin_audit_log
FOR INSERT
WITH CHECK (
  actor_id = auth.uid()
  AND public.get_my_admin_role() = 'super_admin'
);

-- A newly-invited person can log their OWN claim event on first
-- login (before they have any role at all, so the check above
-- wouldn't apply to them) — restricted to only this one action type.
CREATE POLICY "self_claim_insert_audit_log" ON public.admin_audit_log
FOR INSERT
WITH CHECK (
  actor_id = auth.uid()
  AND action = 'claimed_invitation'
);

-- Deliberately no UPDATE or DELETE policy: once written, an audit
-- entry can never be changed or removed through the app.

COMMIT;
