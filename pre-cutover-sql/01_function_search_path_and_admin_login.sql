-- ===============================================================
-- Pre-cutover security fix, batch 1: function search_path + admin_login
-- ===============================================================
-- What this does: every ALTER FUNCTION below just pins a function's
-- search_path -- it does NOT touch the function's actual logic in any
-- way. I read the full source of every one of these functions first,
-- and confirmed none of them rely on unqualified extension-schema calls
-- (they either use no extensions, or -- for admin_login -- I've added
-- the one extra schema it actually needs). This closes the "unset
-- search_path" issue Supabase's security scan flagged, with zero
-- behavior change.
--
-- admin_login specifically: I searched the ENTIRE codebase (this Next.js
-- app, the old production HTML/JS site, and all Supabase Edge Functions)
-- and found zero references to admin_login() or its admin_users table
-- anywhere. The real admin login flow uses Supabase Auth + the
-- user_roles table instead. Since nothing calls it, it's safe to also
-- revoke public/authenticated execute on it -- this closes the
-- "callable by any signed-in user" flag with no risk of breaking
-- anything. The function itself is left completely intact (not
-- dropped), in case it's ever needed again.

BEGIN;

ALTER FUNCTION public.set_vendor_slug() SET search_path = public;
ALTER FUNCTION public.set_visit_requests_updated_at() SET search_path = public;
ALTER FUNCTION public.update_vendor_review_stats(uuid) SET search_path = public;
ALTER FUNCTION public.generate_spot_id() SET search_path = public;
ALTER FUNCTION public.generate_spot_id(text) SET search_path = public;
ALTER FUNCTION public.check_gallery_limit() SET search_path = public;
ALTER FUNCTION public.check_social_limit() SET search_path = public;
ALTER FUNCTION public.recover_expired_pending_vendors() SET search_path = public;
ALTER FUNCTION public.sync_branches_account_status() SET search_path = public;
ALTER FUNCTION public.generate_product_slug(text, text) SET search_path = public;
ALTER FUNCTION public.create_product_slug() SET search_path = public;
ALTER FUNCTION public.prevent_invalid_branch_state() SET search_path = public;
ALTER FUNCTION public.prevent_referral_update() SET search_path = public;
ALTER FUNCTION public.get_tier_strength(text) SET search_path = public;
ALTER FUNCTION public.get_vendor_sponsorship_strength(uuid) SET search_path = public;
ALTER FUNCTION public.get_product_sponsorship_strength(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.get_service_sponsorship_strength(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.send_trial_expiry_warnings() SET search_path = public;
ALTER FUNCTION public.send_subscription_expiry_warnings() SET search_path = public;
ALTER FUNCTION public.create_vendor_with_payment(text, text, text, text, text, text, text, text, numeric, text, text, text) SET search_path = public;

-- admin_login needs the `extensions` schema too, since its password
-- check calls pgcrypto's crypt(), which lives there (confirmed via
-- pg_extension lookup), not in `public`.
ALTER FUNCTION public.admin_login(text, text) SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.admin_login(text, text) FROM authenticated, anon, public;

COMMIT;

-- NOTE: I also reviewed the 9 other admin/partner/billing functions the
-- security scan flagged as callable by anon/authenticated
-- (get_admin_staff_list, get_my_admin_role, close_partner_account,
-- restore_partner_account, link_partner_account,
-- prevent_unauthorized_billing_changes, handle_commission_on_payment,
-- audit_auth_users_func, audit_trigger_func). Unlike admin_login, all
-- nine are either genuinely called directly from the app (confirmed via
-- grep: close_partner_account, restore_partner_account, link_partner_account,
-- and get_admin_staff_list are all called via supabase.rpc(...) from the
-- partner dashboard, partner signup, and admin staff pages) or are
-- trigger-only functions that Postgres won't let anyone call directly
-- outside their trigger context anyway (audit_auth_users_func,
-- audit_trigger_func, handle_commission_on_payment,
-- prevent_unauthorized_billing_changes). All of them already check
-- auth.uid()/role internally before doing anything sensitive. No changes
-- needed here -- revoking execute on any of these would break real,
-- working features (partner account close/restore, partner account
-- linking, the admin staff list).
