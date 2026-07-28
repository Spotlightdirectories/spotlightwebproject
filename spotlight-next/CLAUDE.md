@AGENTS.md

## NEXT SESSION — Cyril's explicit priority order (set 2026-07-28)

1. **Resolve the `main` branch's `MIGRATIONS_FAILED` status first.**
   See the "Supabase — project mismatch found and fixed" section
   below for full context.
2. **Stop/decommission the Supabase "Staging" branch** (project ref
   `oqymludksbjyfcneajug`). Cyril wants to concentrate on production
   only going forward — no more separate Staging database. Check for
   any orphaned test data there first (see note below), then stop it
   to end the recurring branching-compute charge.
3. **Build Products/Services** modules (next dashboard area).
4. **Build "Business Insights"** (`/insight` — the "Performance" link
   currently 404s in this Next.js app). Cyril flagged this as heavy
   lifting, expect it to be a substantial build (charts/analytics).
5. **Payment** — for both Subscription and Sponsorship flows.
6. **Admin dashboard.**
7. **Partner dashboard.**

## Vendor Dashboard migration — known gaps (not yet connected)

Tracked here so they aren't forgotten across sessions. Update this
list as each item gets built.

- **"Manage Branches" button** (Subscription tab) — navigates to
  `/dashboard-branches`, but that route doesn't exist yet in this
  Next.js app. Production equivalent: `dashboard-branches.html`.
- **"Sponsor Your Business" button** (Subscription tab) — navigates
  to `/getsponsored`, but that route doesn't exist yet either.
  Production equivalent: `getsponsored.html`.
- ~~`/verify-badge` page~~ — **built.** Faithful port of production's
  `verify-badge.html` + `verify-badge.js`. Gray Badge requirement was
  corrected sitewide this session: Government ID (NIN) + Utility
  Bill (business or residential address) — passport photo dropped.
  Uses a new shared upload helper, `src/lib/uploadVendorFile.ts`
  (port of `upload-utils.js`, via `validate-upload` Edge Function).
  The confirmation email uses the same simplified inline-HTML
  `fetch()` pattern already established in `signup/page.tsx`, not
  the full `email-templates.js` template system.
- **`/payment` page** — doesn't exist yet in this app. This matters
  because production's plan-upgrade logic (does the vendor's
  existing plan_tier/subscription_status persist and get respected
  when they upgrade?) lives entirely in `payment.js`, not
  `getlisted.js`/`getListed.html`. `/getlisted` itself has zero
  awareness of the vendor's current plan — it only writes
  `selectedPlan`/`billingType` to localStorage and redirects logged-
  in vendors to `/payment`. Until `/payment` is built, that
  persistence logic (effectivePlan calculation, mid-cycle-upgrade
  disclaimer gate, blocking a vendor from re-buying their current
  active plan, the pending-payment downgrade timeout) isn't ported
  yet — it needs its own module when we get to it.

- **Settings tab** — built (`SettingsTab.tsx`). Account Settings
  (email change OTP flow) and Danger Zone (close/restore account)
  are faithful ports of already-working production logic. The
  Notification Preferences card was previously 100% dead UI in
  production (hardcoded `checked`, no id, no JS anywhere) — this
  session made it real: two new `vendors` columns
  (`email_notifications_enabled`, `lead_alerts_enabled`, both
  default `true`), a new public `notify-lead` Edge Function (fires
  an instant email when a customer clicks Call, gated by the toggle
  + a 5-minute cooldown to prevent inbox spam), and a new
  `send-weekly-performance-reports` Edge Function + weekly pg_cron
  job (Monday 8am Lagos, matching the existing daily-warning-job
  time) that summarizes each vendor's last 7 days of
  `analytics_events` (views + phone/WhatsApp/direction clicks).
  Production's `vendordashboard.html`/`.js` and `vendor-profile.js`
  were updated to match (toggle wiring + the phone_click → notify-lead
  trigger).
  **STATUS: DONE end to end (2026-07-28).** The Supabase MCP
  connection was read-only, so the SQL migration and both Edge
  Functions were deployed manually by Cyril via the Supabase
  Dashboard (copy-paste, guided one file at a time). All 4 backend
  pieces verified live via MCP read tools: `vendors` has the 3 new
  columns; `notify-lead` and `send-weekly-performance-reports` are
  both `ACTIVE` with `verify_jwt: false` and content matching
  exactly; `cron.job` shows `weekly-performance-reports` (jobid 6,
  `0 7 * * 1`, active).

  **Toggle bug found + fixed same day:** the toggles kept failing
  with `PGRST204` (column not in schema cache) no matter what was
  tried against `main` (NOTIFY, `pg_notification_queue_usage()`,
  even a full project restart). Root cause was NOT a stale cache —
  see the corrected note below: `.env.local` had this whole app
  pointed at a different Supabase database than the one the
  migration was run against. Fixed by repointing `.env.local` at
  `main`. Settings tab is the last dashboard module — the vendor
  dashboard migration is functionally complete.

## Supabase — project mismatch found and fixed (2026-07-28)

- **Correction to an earlier note in this file:** it previously said
  "neither codebase actually points to [the Staging branch] — it's
  unused." That was wrong. `src/lib/supabase.ts` (the shared client
  used by every `.from()` call in this entire app) reads its URL/key
  from `.env.local`, and `.env.local` was set to the Supabase
  **Staging** branch project (`oqymludksbjyfcneajug`), NOT `main`
  (`gyvzmktavyrevfxnwsay`). Only a few individual files (e.g. the old
  `uploadVendorFile.ts` fetch, the cron job's target URL) had
  `gyvzmktavyrevfxnwsay` hardcoded directly. So this app has
  actually been split across two separate databases the whole time:
  most CRUD went to the Staging branch; a handful of hardcoded calls
  went to `main`.
- **Fixed:** `.env.local` now points at `main` (same project the
  live production site uses), matching where all the real vendor
  data and this session's new Edge Functions/migration live.
- **Still open / worth checking:** since the Staging branch
  (`oqymludksbjyfcneajug`) was the actual target for most writes
  until today, any vendor data created while testing this Next.js
  app (test signups, profile edits, uploads, etc. done during
  earlier sessions) likely lives there, not on `main`, and is now
  orphaned from what the app points to. Not urgent, but worth a look
  before considering the app's data fully consolidated.
- **`main` branch shows status `MIGRATIONS_FAILED`.** Found while
  fixing the verify-badge file-upload bug (2026-07-28), separately
  from the above. Not urgent, but worth understanding what migration
  failed and whether anything is silently missing a column/table/
  policy because of it. Revisit when there's time.
