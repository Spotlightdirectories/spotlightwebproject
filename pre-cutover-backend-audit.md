# Spotlight Directories — Pre-Cutover Backend Audit

*Run August 5, 2026, via Supabase's live `get_advisors` security and performance scans, plus a full TypeScript check of the Staging codebase. This is everything a database/code-level audit can catch that clicking through the UI cannot.*

## Headline

Zero ERROR-level or critical findings anywhere — security or performance. Nothing here is an emergency, and nothing here is stopping you from continuing to click through Staging today. But there are real items worth fixing before real customer traffic hits, listed below in the order I'd tackle them.

Code health: a full TypeScript check across the entire Staging codebase (`npx tsc --noEmit`) passed with zero errors. A full production build (`next build`) couldn't run in my sandbox because it has no internet access to download the Next.js compiler — that's a sandbox limitation, not a project problem. Worth running `npm run build` once in your own terminal before cutover, since it has real network access and gives the strongest possible confidence signal.

---

## Security findings (106 total: 0 ERROR, 103 WARN, 3 INFO)

### 1. `admin_login` — fix before go-live
This function is `SECURITY DEFINER` (runs with elevated privileges regardless of who calls it), has no fixed `search_path` set, and is currently callable by any signed-in user via `/rest/v1/rpc/admin_login`. The combination of "elevated privileges" + "unset search_path" + "publicly callable" is the classic Postgres privilege-escalation pattern — a caller can potentially manipulate which objects the function resolves at runtime. This should be reviewed and hardened (set an explicit `search_path`, and confirm the function itself checks credentials properly before returning anything) before real traffic.

### 2. Nine admin/partner/billing functions exposed to anon or authenticated callers — worth confirming, not necessarily broken
These are all `SECURITY DEFINER` and technically callable without the caller needing special permission at the database-grant level: `get_admin_staff_list`, `get_my_admin_role`, `close_partner_account`, `restore_partner_account`, `link_partner_account`, `prevent_unauthorized_billing_changes`, `handle_commission_on_payment`, `audit_auth_users_func`, `audit_trigger_func`. This doesn't necessarily mean they're unsafe — many of these likely already check `auth.uid()` or role membership internally before doing anything sensitive, which is a completely valid pattern. But it's worth a quick pass through each one to confirm that internal check actually exists, since the advisor can only see the grant, not the function body.

### 3. 20 functions with no fixed `search_path` — low-effort, worth batching
`set_vendor_slug`, `set_visit_requests_updated_at`, `update_vendor_review_stats`, `generate_spot_id` (two overloads), `check_gallery_limit`, `check_social_limit`, `recover_expired_pending_vendors`, `sync_branches_account_status`, `generate_product_slug`, `create_product_slug`, `admin_login`, `prevent_invalid_branch_state`, `prevent_referral_update`, `get_tier_strength`, `get_vendor_sponsorship_strength`, `get_product_sponsorship_strength`, `get_service_sponsorship_strength`, `send_trial_expiry_warnings`, `send_subscription_expiry_warnings`, `create_vendor_with_payment`. Each needs a one-line `SET search_path = public, pg_temp` added. Four of these (`admin_login`, `send_trial_expiry_warnings`, `send_subscription_expiry_warnings`, `create_vendor_with_payment`) also appear in the exposure lists above, so fixing search_path on those four closes the escalation vector directly.

### 4. Everything else — most likely fine as-is
The remaining ~76 flagged functions (`count_vendor_products`, `get_vendor_rank`, `search_vendors`, `get_similar_products`, `get_trending_searches`, etc.) are read-oriented helper functions that a public business directory is expected to expose publicly — browsing, ranking, and search need to work without login. These aren't flagged as broken, just flagged because they're `SECURITY DEFINER` and public, which is the linter's default caution. No action needed unless you want extra hardening later.

### 5. Three tables with RLS enabled but no policies (INFO level, not a live risk)
`email_change_requests`, `email_verification_tokens`, `restricted_terms` — RLS is on with zero policies, which means Postgres blocks everyone (including normal logged-in users) from reading or writing directly. If the app reaches these through a service-role key or a `SECURITY DEFINER` function (which is the likely design), this is fine as-is. Worth a five-minute check that nothing was supposed to have a real policy and just never got one.

### No findings of: leaked/exposed secrets, missing RLS on tables that should have it, publicly exposed views.

---

## Performance findings (171 total: 0 ERROR, 136 WARN, 35 INFO)

### 1. RLS policies re-checking `auth.uid()` per row instead of once per query — fix on high-traffic tables first
66 findings total, all the same root cause: a policy calls `auth.uid()` directly instead of `(select auth.uid())`, which is a well-documented Postgres/Supabase performance trap — the wrapped form is computed once per query, the unwrapped form gets re-computed for every single row scanned. The tables customers and vendors will actually hit on every page load deserve priority:

| Table | Findings | Why it matters |
|---|---|---|
| `visit_requests` | 5 | Every visit request create/view/update on both customer and vendor side |
| `vendors` | 4 | Every vendor profile view, every search result |
| `vendor_products` | 4 | Every product page, every browse/search |
| `vendor_services` | 3 | Every service page, every browse/search |
| `branches` | 3 | Every branch listing |
| `analytics_events` | 2 | Fires on every WhatsApp click, call click, page view |

The remaining 45 findings sit on lower-traffic tables (`user_roles`, `vendor_verifications`, admin/partner tables) and can wait.

### 2. Duplicate/overlapping RLS policies on the same table+action — 70 findings, two tables carry most of the weight
When two permissive policies both apply to the same role and action, Postgres evaluates and combines both for every row instead of one. `vendors` has 13 of these findings, `visit_requests` has 12 — together over a third of all 70. The rest are spread thin across `admin_invitations` (12), `partners` (7), `admin_audit_log` (6), `vendor_portfolio_items` (6), `vendor_social_links` (6), and a handful of singles elsewhere.

### 3. Missing indexes on foreign keys — 19 findings, the ones that matter for launch are the category/subcategory links
`vendors`, `vendor_products`, and `vendor_services` are all missing indexes on their `category_id` and `subcategory_id` foreign keys — these back every single browse-by-category and filtered-search query on the site, which is a core, constant-use path. `analytics_events` is missing indexes on `customer_id`, `product_id`, and `service_id` — this table gets written to on every click/view event, so missing indexes here matter for both write volume and any future reporting query against it. The remaining unindexed FKs (`branch_social_links`, `customer_favorites`, `email_change_requests`, `vendor_portfolio_items`, `vendor_recommendation_requests`, `vendor_reviews`, `vendor_social_links`) are lower-traffic and can wait.

### 4. 15 "unused index" findings — not actionable yet
These are indexes Supabase's usage stats say haven't been touched (`idx_partners_state`, `idx_partners_lga`, `email_verification_tokens_expires_idx`, several others). This signal is based on real usage history, and Staging/pre-launch traffic is too thin for it to mean anything yet. Re-check this a few weeks after real customers are using the site — don't drop anything based on this now.

### 5. One infrastructure note
Auth server is currently capped at 10 connections (fixed number, not percentage-based). Supabase's own guidance recommends switching to a percentage-based allocation before scaling up instance size. Not urgent unless you're planning to bump your Supabase plan/instance size around the same time as cutover.

---

## Suggested order of operations

1. Harden `admin_login` (search_path + confirm its internal auth check) — highest-impact, lowest-effort fix.
2. Quick manual review of the nine admin/partner/billing functions in section 2 — likely a 20-minute read-through, not a rewrite.
3. Batch-fix all 20 `search_path` issues in one migration — mechanical, low-risk.
4. Fix the `auth.uid()` wrapping on the six high-traffic tables, and consolidate the duplicate policies on `vendors` and `visit_requests`.
5. Add the missing category/subcategory and analytics_events indexes.
6. Everything else (admin/partner tables, unused-index cleanup, auth connection strategy) can follow after cutover, once there's real traffic to make those calls with actual data.

**Separately, still unconfirmed:** whether the Supabase access token pasted in plain text into chat earlier this project was rotated. Worth doing via Supabase dashboard → Settings → Access Tokens if it hasn't been.
