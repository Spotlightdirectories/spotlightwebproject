-- ===============================================================
-- Migration: admin_staff_invitations
-- Block 4, item 18 — admin staff onboarding without a vendor profile
--
-- Problem being solved: today, assigning an admin role requires the
-- person to already exist in the `vendors` table (the only place the
-- browser can look up an email -> auth_user_id, since it cannot query
-- auth.users directly). That means every new admin hire needs a
-- throwaway vendor profile first, or a super_admin has to hand-write
-- a SQL INSERT into user_roles (which is how Cyril's own super_admin
-- account was created).
--
-- Fix: an invitation system.
--   1) A super_admin enters an email + role -> saved as an invitation.
--   2) The invited person signs up at admin-signup.html (creates ONLY
--      an auth account, no vendor row).
--   3) On their first successful login, admin-login.js checks for a
--      matching unused invitation and claims it automatically.
--
-- Everything here is ADDITIVE:
--   - New table, new policies.
--   - The new user_roles policy is a SEPARATE policy alongside the
--     four that already exist — none of those are touched, so nothing
--     about existing admin assignment/login/revoke behaviour changes.
-- ===============================================================

BEGIN;

CREATE TABLE public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('admin','finance_admin','verification_admin','super_admin')),
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz
);

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

-- Super admins can see every invitation (for the pending-invitations list)
CREATE POLICY "super_admin_select_invitations" ON public.admin_invitations
FOR SELECT
USING (public.get_my_admin_role() = 'super_admin');

-- A person can see whether THEIR OWN email has a pending invitation.
-- This is what lets admin-login.js check for a match right after
-- someone logs in for the first time, before they have any role yet.
CREATE POLICY "own_invitation_select" ON public.admin_invitations
FOR SELECT
USING (auth.email() = email);

-- Only super_admin can create invitations
CREATE POLICY "super_admin_insert_invitations" ON public.admin_invitations
FOR INSERT
WITH CHECK (public.get_my_admin_role() = 'super_admin');

-- A person can mark their OWN unused invitation as claimed
CREATE POLICY "own_invitation_claim" ON public.admin_invitations
FOR UPDATE
USING (auth.email() = email AND used = false)
WITH CHECK (auth.email() = email);

-- Only super_admin can revoke a pending invitation
CREATE POLICY "super_admin_delete_invitations" ON public.admin_invitations
FOR DELETE
USING (public.get_my_admin_role() = 'super_admin');

-- ===============================================================
-- NEW, ADDITIVE policy on user_roles: lets a person insert a role
-- for THEMSELVES, but only if a matching, unused invitation exists
-- for their own email and that exact role. This is what lets the
-- invited person self-claim their role on first login, with no
-- super_admin action needed beyond the original invite.
--
-- The four existing policies on user_roles are untouched:
--   super_admin_insert_roles / super_admin_update_roles /
--   super_admin_delete_roles / users_read_own_role
-- Postgres evaluates multiple permissive policies for the same
-- command with OR, so this simply adds one more allowed path —
-- it cannot loosen or replace what's already there.
-- ===============================================================

CREATE POLICY "claim_invited_admin_role" ON public.user_roles
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.admin_invitations
    WHERE email = auth.email()
    AND role = user_roles.role
    AND used = false
  )
);

COMMIT;
