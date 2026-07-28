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
   Products is done (see "Products module" entry below) — Services
   still to build, same pattern.
4. ~~**Build "Business Insights"**~~ — **built** (see entry below).
5. **Payment** — for both Subscription and Sponsorship flows.
6. **Admin dashboard.**
7. **Partner dashboard.**

Also built today (2026-07-28), pending Cyril's manual SQL/Edge
Function paste-deploy: the vendor-profile cover/logo upload fix, the
WEBP-decode fix, and the new Portfolio module (dashboard tab + public
section). See the dedicated sections below for full detail and what
still needs pasting into Supabase.

Also queued: a Services-module category/subcategory restructuring
discussed with Cyril but not yet implemented — split the overloaded
"Professional Services" category (17 subcategories covering
accountants, lawyers, HR consultants, insurance agents, and agency-
type businesses all at once) into 5 narrower categories: Accounting
& Finance, Insurance Services, Agency Services, Legal Services,
Business Consulting. Only 2 live vendors affected. Cyril asked for
this as an Excel file to mark up his decisions on — not yet
delivered (sandbox was down when requested; retry next session).

## Vendor Dashboard migration — known gaps (not yet connected)

Tracked here so they aren't forgotten across sessions. Update this
list as each item gets built.

- **"Manage Branches" button** (Subscription tab) — navigates to
  `/dashboard-branches`, but that route doesn't exist yet in this
  Next.js app. Production equivalent: `dashboard-branches.html`.
- **"Sponsor Your Business" button** (Subscription tab) — navigates
  to `/getsponsored`, but that route doesn't exist yet either.
  Production equivalent: `getsponsored.html`.
- **Products module** — built (`ProductsTab.tsx`), wired into
  `page.tsx` replacing the stub. Faithful port of production's
  `#products` section + the PRODUCTS blocks in vendordashboard.js
  (plan-based limits: trial 3, free 1, standard 6, enterprise 12,
  elite 24, custom unlimited; 90-day free-trial override to 3;
  pending → batch-save flow; edit-in-place; delete with storage
  cleanup for all 3 images). Images go through
  `uploadVendorFile(file, "product")` → `validate-upload`'s
  `product` rule: JPG/PNG/WEBP, 2MB cap, 800x800 minimum (server-
  enforced), auto-resized to 1600px longest side. Three deliberate
  fixes over production, found while reading vendordashboard.js
  line by line: (1) production's `.vd-remove-product-btn` on
  pending items has a `data-index` attribute but NO click listener
  anywhere — completely dead, now wired; (2) production's 3 image-
  URL variables are module-level and never reset after "Add" pushes
  a pending product, so adding a second product without choosing
  new images silently reuses the first product's image URLs — now
  reset every time; (3) production only shows the picked filename
  as text — this port shows an actual live thumbnail preview (local
  blob immediately, swapped for the real hosted URL once upload
  finishes). "Generate with AI" reuses the existing
  `AiDescribeModal` component (`type="product"` was already
  supported, just unused until now).
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

- **`/insight` (Business Insights)** — built (`src/app/(standalone)/insight/page.tsx`
  + `insight.module.css`). Faithful port of production's
  `insight.html`/`insight.js`, which was already fully wired to live
  `analytics_events`/`vendors`/`vendor_products`/`vendor_services`/
  `vendor_sponsorships` data — no hardcoded demo numbers to replace,
  just a structural port from DOM manipulation to React state/JSX.
  Covers: Business Health Score gauge (profile completeness +
  verification + reviews + catalog + sponsorship, 20pts each),
  Marketplace Performance line chart with period switching (Today/
  Week/Month/Quarter/Year), Lead Generation (WhatsApp/Call/Direction/
  Catalog/External clicks with period-over-period growth), Catalog
  Performance (top 5 products/services by views), Marketplace Ranking
  (peer rank via `vendors.category`/`.subcategory` text columns, same
  as production, plus the "Change Category" and "Ranking Factors"
  modals), Audience (visitor state breakdown), Search Keywords
  (case-normalized, top 5 with "view all" toggle), and Growth Coach
  (checklist derived from the same health-score data, so the two can
  never disagree). Both dashboard entry points (`vd-nav-item` and the
  profile-dropdown "Performance" link) already pointed at `/insight`
  from an earlier session — that was a documented 404 until now, no
  further wiring needed.
  Three small, deliberate fixes over production found while porting
  (documented in the file's header comment): (1) `.lead-icon-catalog`
  had no CSS rule at all — the Catalog Visits icon rendered with no
  background/color while the other four lead icons did; added,
  matching the same palette. (2) the Growth Coach's two-button layout
  (`coach-action-group`) referenced a class with no matching CSS
  rule — added a small flex rule. (3) `.sponsor-status-text` was
  `color:#666` (dark gray) against the Sponsorship card's near-black
  background — a real legibility bug; changed to a light gray
  matching the card's other text.
  **Not fixed, flagged for later:** the "View All Products/Services"
  links land on `/vendordashboard`'s Overview tab, not the Products/
  Services tab directly (no `?tab=` deep-link support yet). The
  ranking category modal's hardcoded 5-category list will need
  updating once the Services category/subcategory restructuring
  (queued above) actually lands.
  **Verification status:** the sandbox (`mcp__workspace__bash`) was
  down for this entire build, so `npx tsc --noEmit` could not be run.
  Reviewed the full file manually line-by-line instead (twice) and
  disclosed this to Cyril rather than claiming a verified clean
  build. Run `tsc` and a manual click-through on this page first
  thing next session.

  **Performance bug found + fixed same day:** Cyril noticed period
  switching took ~3s here vs. instant in production. Root cause: the
  initial port had one combined `loadPeriodData()` that awaited all
  6 sections (stats, chart, leads, audience, keywords, catalog) one
  after another, plus every current/previous pair inside each
  section was also awaited sequentially — production's `syncPeriod()`
  runs its 7 `render*` functions concurrently via `Promise.all`, so
  the port had accidentally serialized what production parallelizes.
  Fixed by splitting into 6 independent `load*` functions, fired
  together (not awaited as a group) from the period effect so each
  section's state updates the instant its own query resolves, and by
  running every current/previous pair (and ranking's two peer
  queries) via `Promise.all` instead of one after another. Not yet
  re-verified against a running dev server (sandbox still down) —
  confirm the fix actually feels instant next session.

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

## Vendor-profile cover/logo upload bug — fixed (2026-07-28)

- **Bug:** Cyril reported cover/logo images couldn't be uploaded on
  the public vendor profile (`/vendor/[slug]`, owner view).
- **Root cause:** the handlers called
  `supabase.storage.from("vendor-branding").upload(...)` directly
  from the browser with no `error` checking at all. The
  `vendor-branding` bucket has SELECT and DELETE RLS policies but
  **zero INSERT policy** — every upload was silently rejected by RLS
  while the code still went on to save a broken public URL, as if it
  had worked.
- **Also found (not the primary bug, optional cleanup):** the
  existing SELECT/DELETE policies compare
  `auth.uid()::text = (storage.foldername(name))[1]`, but the upload
  path's first segment is `vendor.id`, not `auth_user_id` — confirmed
  via `select id, auth_user_id, (id = auth_user_id) as ids_match from
  vendors` that these never match. So even DELETE was silently
  failing (orphaned files on delete). SQL fix for this was given to
  Cyril as optional; not confirmed run.
- **Fix:** rewrote `handleCoverUpload`/`handleLogoUpload` in
  `vendor/[slug]/page.tsx` to use `uploadVendorFile(file, "cover"
  /"logo")` — the same Edge-Function-backed helper Products/Services
  already use, which runs with the service role key and bypasses
  storage RLS entirely. No migration needed for the primary fix.
  Also added real error checking (with alerts) to
  `handleDeleteCover/Logo` and `handleVideoUpload/handleDeleteVideo`,
  which previously failed silently too.

## WEBP decode failure on cover/logo — fixed (2026-07-28)

- **Bug:** Cyril hit "Could not read image file. It may be corrupted."
  uploading images under 800×800px.
- **Root cause is NOT size.** Cover/logo have no `minWidth`/
  `minHeight` rule at all in `validate-upload` — the failure happens
  at `Image.decode(bytes)`, before any dimension is even known. The
  real cause: `imagescript` (the Deno WASM library `validate-upload`
  uses to decode/resize/recompress every image) has unreliable WEBP
  decode — a file can pass the real-bytes magic-number check as a
  legitimate WEBP yet still throw inside `Image.decode()`. Since every
  image is re-encoded to JPEG on the way out regardless of input type,
  accepting WEBP as an *input* format only ever mattered for decode
  compatibility.
- **Fix:** dropped `"image/webp"` from `allowedTypes` for
  `product`/`service`/`gallery`/`cover`/`logo` in
  `validate-upload/index.ts` (kept for
  `verification`/`receipt`/`sponsorship_receipt` — unaffected, never
  had it). Clearer error messages added (explicit WEBP-rejection
  message; friendlier decode-failure message). Removed all WEBP
  mentions from hint text sitewide (`ProductsTab.tsx`,
  `vendor/[slug]/page.tsx`, and production's
  `vendordashboard.html`/`vendor-profile.html`).
  **Not independently verified live** — reasoned from the library's
  known WEBP limitation and the fact that JPEG/PNG decode is solid;
  presented to Cyril as best-reasoning, not proven fact, but a safe,
  backward-compatible change regardless.
  **Still pending:** the corresponding local file
  `spotlightwebproject_new/supabase/functions/validate-upload/index.ts`
  has this fix already written, but it has **not yet been deployed**
  — `mcp__supabase__deploy_edge_function` was rejected by a Cowork
  safety gate requiring explicit user confirmation, and Cyril chose
  to paste-deploy manually himself rather than approve automatic
  deployment. **Established constraint going forward: never attempt
  automatic Edge Function deployment or DB migration application —
  always hand Cyril the exact content to paste manually.**

## Portfolio module — built (2026-07-28)

New module, no production equivalent. Cyril's brief: below "About
the Business" on the public vendor profile, Service/Hybrid vendors
only, a CV-style history of past work for prospects. Design Cyril
confirmed directly: flat cap of **6 items for everyone, no plan-tier
limits**, public display shows **2 items with a "See More" reveal**
for the rest (mirrors the Keywords "View All" pattern already used
in `/insight`).

- **Dashboard tab:** `vendordashboard/PortfolioTab.tsx` — modeled on
  `ProductsTab.tsx`'s pending → batch-save flow, but single image per
  item (not 3) and CV fields (title, description, client name,
  completed date) instead of price/key-details. No plan-tier lookup
  — hardcoded `PORTFOLIO_LIMIT = 6`. Images go through
  `uploadVendorFile(file, "portfolio")` → `validate-upload`'s new
  `portfolio` rule (JPG/PNG, 2MB cap, 800×800 minimum, resized to
  1600px, stored in the `vendor-gallery` bucket under `portfolio/`).
  Wired into `vendordashboard/page.tsx`: nav item + section, gated on
  `showPortfolio = businessType === "service" || businessType ===
  "hybrid"` (same audience as Services today, kept as its own
  variable since the two concepts — what you sell vs. your work
  history — happen to match today but aren't the same thing).
- **Public section:** `vendor/[slug]/page.tsx`, inserted between the
  About and Media sections. Renders only if the vendor is
  service/hybrid AND has at least one saved item. Shows 2 items by
  default (`portfolioItems.slice(0, 2)`), with a "See More
  (N more)" / "Show less" toggle button (`showAllPortfolio` state,
  reusing the `.viewAllBtn` class already used by the Reviews "View
  all reviews" button) revealing the remaining up to 4.
- **`uploadVendorFile.ts`:** added `"portfolio"` to the
  `UploadCategory` union.
- **Still pending / not yet done:**
  1. The `vendor_portfolio_items` table + RLS migration has been
     drafted (mirrors `vendor_products`'s SELECT/INSERT/UPDATE/DELETE
     policy pattern, with a `count_vendor_portfolio_items() < 6` check
     instead of a plan-tier lookup, plus the same
     `business_type IN ('service','hybrid')` check) but has **not yet
     been applied** — `apply_migration` is read-only from this tool,
     so it must be pasted into the Supabase SQL editor by Cyril.
  2. The `portfolio` rule in `validate-upload/index.ts` ships bundled
     with the WEBP fix above — same pending manual paste-deploy.
  3. Build not yet re-verified with `tsc`/`next build` — the sandbox
     (`mcp__workspace__bash`) was down for this entire build. Reviewed
     all new/edited files by hand instead. Run `npx tsc --noEmit` and
     a manual click-through (dashboard add/edit/delete, public 2-then-
     see-more reveal) first thing next session.
