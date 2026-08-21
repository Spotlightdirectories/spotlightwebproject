@AGENTS.md

## STATUS AS OF 2026-08-21 — read this first

Everything in the original "NEXT SESSION (2026-07-28)" list below this
section is **done** — Products, Services, Payment (Subscription +
Sponsorship), Admin dashboard, and Partner dashboard are all built and
live. That old priority list is kept below purely as history; don't
treat it as pending work. Platform is live in production, taking real
vendor signups, with Search Console + sitemap indexing confirmed
working (2026-08).

**Currently open / worth knowing about:**

1. **Partner incentive-structure question — deliberately unresolved,
   Cyril's explicit choice.** He raised a real concern: the current
   20%/10%/override commission structure asks partners to work ~90
   days (the free-trial period) before any commission is even
   possible, with no guaranteed payout at the end of it — realistic
   worry that this won't motivate real recruitment, especially given
   inflation and the risk of partners gaming referrals for a quick
   payout instead of bringing real vendors. He said he needs to "sleep
   on" this and has not revisited it since. **Do not restructure
   commissions or the trial-period tie-in without him explicitly
   raising it again.**
2. **Partner program — security audit done, both real gaps closed
   (2026-08-20/21).** Full audit found two live issues: `partners`
   table was fully public-readable (name/email/phone/DOB, no auth
   needed), and there was no mechanism at all to collect a partner's
   payout bank details. Both fixed — see "Partner program hardening +
   payout collection" section below for the complete story, including
   two rounds of regressions this caused and how they were resolved.
3. **Backup system — built and working (2026-08-21).** Cyril
   discontinued Supabase's paid daily-backup add-on (not enough real
   data yet to justify the cost) in favor of a manual routine every 48
   hours: `C:\Users\Dell\Documents\spotlightwebproject_staging\backups\`
   has `BACKUP-CHECKLIST.md` plus three scripts (`pg_dump` for the DB,
   `download-public-files.ps1` for public storage, `download-private-
   files.ps1` via rclone for private storage — payment receipts,
   verification docs, sponsorship receipts, partner NIN documents). A
   scheduled task (`spotlight-backup-reminder`, every 48h) nudges Cyril
   and auto-refreshes `public_files_list.txt` from live `storage.
   objects` before each reminder, so that list never goes stale again
   (it had silently missed 3 weeks of new vendor uploads before this
   was caught and fixed). Full detail in the "Backup system" section
   below.
4. **Search/discovery logic audit — 3 real bugs found and fixed
   (2026-08).** Duplicate overloaded `search_vendors`-family RPCs,
   `search_vendors` cross-category false positives, and a stale sub-
   subcategory filter surviving a category change in the discover
   drawer. See "Search audit" section below.
5. **Sitemap/indexing — one real bug found and fixed (2026-08).** A
   stale Netlify env var was causing `www.` URLs in the generated
   sitemap, mismatched against the canonical non-www domain. Fixed;
   Search Console setup itself was already correctly done (confirmed
   after initially, incorrectly, telling Cyril otherwise — corrected
   same session).

## NEXT SESSION — Cyril's explicit priority order (set 2026-07-28, historical)

**All items below are DONE — kept for history only, see STATUS section above.**

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
- **Shipped and live-tested (2026-07-28):** Cyril ran the
  `vendor_portfolio_items` table + RLS migration (mirrors
  `vendor_products`'s SELECT/INSERT/UPDATE/DELETE pattern, with
  `count_vendor_portfolio_items() < 6` instead of a plan-tier limit)
  and redeployed `validate-upload` with the new `portfolio` rule +
  WEBP fix bundled in. `npx tsc --noEmit` came back clean. Tested live
  on `remedux-prime-ltd` (hybrid): add/edit/save worked, and the
  public profile correctly showed 2 items with a working "See More."

- **Round 2 fixes, from Cyril's live-test feedback (2026-07-28):**
  1. **Typography bug:** the public card's description line reused
     `.productPrice` (bold, green — meant for prices), so a portfolio
     description rendered like a price tag. Added dedicated
     `.portfolioCard`/`.portfolioTitle`/`.portfolioDescription`/
     `.portfolioMeta` classes in `vendor-profile.module.css`
     (deliberately separate from the `.product*` classes, which stay
     untouched for actual Products) — title bold, description plain
     muted text, client/date as a small meta line. Same fix mirrored
     in the dashboard's own pending/saved-item previews via an inline
     style rather than a new global class (`vd-product-price` is
     shared with the real Products/Services tabs and shouldn't
     change).
  2. **Image made optional, not required.** Cyril's reasoning, which
     I agreed with: most services (financial statements, legal
     filings, training, consulting) have no meaningful "product shot"
     — requiring one was forcing vendors to attach unrelated stock/ad
     graphics just to satisfy the form (visible in his first test:
     two of three cards had generic marketing banners, not real work
     photos). Cards with no image now fall back to the Spotlight
     mark, same as before. **Requires one manual step:** the table
     Cyril already created has `image_url text not null` — he still
     needs to run
     `alter table vendor_portfolio_items alter column image_url drop not null;`
     before saving an item with no image will work. Given to him as a
     one-line SQL snippet, not yet confirmed run.
  3. **"Completed" is now a real date picker,** not free text — the
     dashboard form uses `<input type="date">` instead of a text
     field, and the public/dashboard displays always render a fixed
     `Completed: ` label followed by a formatted date (e.g. "28 July
     2026"), rather than whatever phrasing a vendor typed. Old test
     entries saved as free text (e.g. "Completed 28th July, 2026")
     don't match the `YYYY-MM-DD` shape the picker needs, so editing
     one of those leaves the date field blank rather than showing
     garbage — re-enter the date once to convert it.
  4. **Considered and declined (for now):** Cyril also floated
     replacing the image with a client reference block (name/contact/
     company/job done) instead. Flagged a privacy concern instead of
     building it as asked: publishing a real client's personal
     contact details on a public profile without their explicit
     consent is a real liability, not just a design choice — a
     featured client didn't necessarily agree to be contactable by
     strangers. Recommended keeping `client_name` (company reference)
     as the credibility signal, and, if more social proof is wanted
     later, adding an actual client-quote/testimonial field instead of
     raw contact info. Not built — revisit if Cyril wants to pursue
     the testimonial idea.
  5. Not yet re-verified after this round — sandbox was down again
     for this pass, reviewed by hand. Cyril should re-run
     `npx tsc --noEmit` and click through once more (add an item with
     no image, add one with a date) next session.

- **Round 3 fixes, from Cyril's second look (2026-07-28):** the
  optional-image compromise from Round 2 wasn't the actual ask — Cyril
  pushed further: drop the image entirely (a generic placeholder
  "does not look professional"), make Portfolio a flat row list like
  Reviews (no bordered card), and fix Title/Description reading as
  duplicates of each other ("job done can be repeated").
  1. **Image upload removed entirely** from `PortfolioTab.tsx` — no
     upload field, no `image_url` writes, no `uploadVendorFile`
     import. Visual identity is now an auto-generated initials avatar
     (from client name, falling back to title), matching the Reviews
     section's avatar exactly in color/size. The Round 2 "drop NOT
     NULL on image_url" SQL is now moot — the column is simply unused
     going forward; no need to run it (or drop the column — either is
     fine, no rush).
  2. **Public layout rebuilt as a row list**, not a product-style
     grid: new `.portfolioList`/`.portfolioRow`/`.portfolioAvatar`/
     `.portfolioRowHeader`/`.portfolioRowTop`/`.portfolioDate` classes
     in `vendor-profile.module.css`, deliberately mirroring the
     `.review*` classes' exact values (same avatar colors/size, same
     flat-row-no-border treatment) so Portfolio and Reviews read as
     one consistent design language, while staying separate classes
     so future changes to one don't silently affect the other.
  3. **Title vs. Description redundancy fixed** with real persistent
     labels (not just placeholders, which vanish once typing starts):
     "Project title" vs. "What did you do?", with the description
     placeholder explicitly saying "don't just repeat the title
     above."
  4. Sandbox was down for this pass too — reviewed both files by hand
     (confirmed no leftover references to removed image state/handlers
     via grep). Cyril should run `npx tsc --noEmit` once more next
     session.

## Recommendation flow (Upwork-style) — built, migration pending (2026-07-28)

Cyril's ask: rather than a vendor typing a client's name into Portfolio
themselves (self-reported, unverifiable), replicate Upwork's pattern —
the vendor requests a recommendation from an actual past client, and
the client submits it themselves. Confirmed scope with Cyril via a
direct question: **tied to a specific portfolio item**, and a verified
recommendation takes priority over the vendor's own typed "Client /
company" text for that item once one exists. This also elegantly
resolves a privacy concern raised earlier in the same conversation
(publishing a real client's info without consent) — since the client
is the one voluntarily submitting after receiving a request, consent
is baked into the flow itself, unlike a vendor publishing someone
else's info unprompted.

- **Delivery mechanism:** `send-email` (Resend-backed, confirmed
  `ACTIVE`, `verify_jwt: false` via `list_edge_functions`) — no new
  email infrastructure needed, reused as-is with the same
  fetch-with-no-auth-header pattern already used in `verify-badge` and
  `signup`.
- **Security model:** the new table (`vendor_recommendation_requests`)
  holds the client's email, so it is NEVER exposed to public
  SELECT — only the vendor-owner can read their own rows (for
  dashboard status). All public-facing reads/writes go through three
  `SECURITY DEFINER` Postgres functions (matching this codebase's
  existing convention — see `count_vendor_products` /
  `get_vendor_plan_limits`), each returning/accepting only what's safe
  for a stranger holding a token link:
  - `get_recommendation_request_by_token(p_token)` — returns vendor
    name, portfolio item title, and status only (recommend page).
  - `submit_recommendation(p_token, p_name, p_company, p_message)` —
    the ONLY write path for a client's submission; internally enforces
    one-time use (`status = 'pending'`) and a 30-day expiry.
  - `get_portfolio_recommendation(p_portfolio_item_id)` — returns
    name/company/message for a submitted recommendation (public
    profile page), never the email.
- **Dashboard (`PortfolioTab.tsx`):** each saved item now has a
  "Request recommendation from client" action — opens an inline email
  field, on send: inserts a request row (token auto-generated), emails
  the client via `send-email` with a `/recommend/{token}` link, then
  shows a pending/verified status inline per item. Fails quietly (logs
  only) if the table doesn't exist yet, so Portfolio itself isn't
  blocked by this feature being mid-rollout.
- **New public page:** `(standalone)/recommend/[token]/page.tsx` — no
  login required. Loads via `get_recommendation_request_by_token`,
  shows a short form (name, company, recommendation text), submits via
  `submit_recommendation`. Handles invalid/expired/already-used links
  and a distinct "already submitted, thank you" state.
- **Public profile (`vendor/[slug]/page.tsx`):** each Portfolio row now
  fetches its verified recommendation (if any) via
  `get_portfolio_recommendation` and, when present, shows the client's
  real name + company with a "Verified" badge (reusing `.verifiedBadge`
  from Reviews) in place of the vendor's typed client name, plus the
  client's own quote in italics below the vendor's own description.
  Falls back to the vendor's typed client name when no recommendation
  exists yet, so a portfolio entry never looks empty while a
  recommendation is pending.
- **Still pending:** the DB migration (table + RLS + 3 functions) has
  been drafted and handed to Cyril to run manually — same
  never-apply-directly constraint as every other migration this
  session. Not yet live-tested (needs the migration run first). Sandbox
  was down for this whole build — reviewed by hand; run
  `npx tsc --noEmit` and a full click-through (request → check email →
  submit → confirm it shows verified on the public profile) next
  session.

## Admin dashboard — build in progress (started 2026-07-31)

Tabbed shell (`(standalone)/admin/page.tsx`) + isolated auth
(`admin-login`, `admin-signup`, `src/lib/adminSupabase.ts` /
`adminSignupSupabase.ts`) built first, then all 11 sections one at a
time per Cyril's explicit request. Faithful port of production's
single-page `admin-payments.html`/`admin-payments.js`, restructured
into tabs. Role model: `user_roles` (`super_admin | admin |
finance_admin | verification_admin`) via `get_my_admin_role()`.

All 11 sections built: StaffTab, SecurityLogTab, PaymentsTab,
SponsorshipsTab, VerificationsTab, PartnerApprovalsTab,
PartnerHistoryTab, CommissionsTab, PaymentHistoryTab,
SponsorshipHistoryTab, VerificationHistoryTab.

Two real backend bugs found and fixed along the way (would have hit
production too, not just this port): `audit_trigger_func` referenced
a nonexistent `.id` column on `user_roles` (should be `user_id`), and
that same trigger's own `audit_log` INSERT was being blocked by
`audit_log`'s RLS (no INSERT policy existed for anyone) — fixed via
`SECURITY DEFINER` on the trigger function. Also closed a real
admin-signup impersonation gap: the `?email=` prefill was cosmetic
only, so `admin_invitations.id` (already a UUID) was repurposed as a
secret invite token via a new `get_invitation_by_token` RPC.

All app-wide emails (not just admin) migrated to a shared branded
template system, `src/lib/emailTemplates.ts` — a faithful port of
production's unused `email-templates.js`, extended with 6 new
templates for flows that had none.

**Commissions tab** (2026-07-31): confirmed via direct DB inspection
(not guesswork) that the commission math already runs live — a
`SECURITY DEFINER` trigger, `handle_commission_on_payment()`, fires on
`vendor_payments` confirming: 20% of a vendor's first payment to
their referring partner, 10% on renewals; a further 5% "override" to
that partner's own upline (`partners.referred_by`), paid separately,
never deducted; a flat ₦30,000 bonus every time a partner's yearly-
plan commissions hit a new multiple of 50 in a month. An hourly
`pg_cron` job (`unlock-commissions-job`) flips `pending` →
`available` after each row's 7-day `unlock_date`. `CommissionsTab.tsx`
is a faithful port of production's summary-by-partner + full ledger +
`payPartner`, with one improvement: a Type column (Direct/Override/
Bonus) showing `commissions.type`, which production's query never
selected even though the trigger has written it all along.

**Deferred to the Partner Dashboard build stage** (flagged to Cyril,
not fixed yet — explicitly not blocking Admin): production's *current
live* partner-signup form, `partner-program.js`, does not correctly
resolve `?ref=CODE` into a partner id. It stores the raw code string
under `referred_by_code` (a column that doesn't match the schema's
actual `referred_by` uuid column), while an older, correct version of
this exact logic already exists in an archived file
(`partner-program-legacy.js`, lines ~159-186) that does the proper
`partners.referral_code` lookup and writes the resolved id to
`referred_by`. Net effect: right now, when a partner refers another
partner via their partner-referral link, that relationship likely
isn't being saved, so no override commission would ever be generated
for that referral. Needs the lookup-and-resolve logic restored (or
ported fresh, following the legacy file) when Partner Dashboard is
built — check `referred_by_code` for any orphaned data that needs a
one-time backfill into `referred_by` at that time.

## Admin dashboard — full audit + fixes (2026-07-31)

With all 11 sections built, ran an independent audit (subagent, fresh
context, given direct read access to every tab file plus live
Supabase RLS/schema/advisor data — not just re-reading my own summary
of what I'd built) before moving on to the getlisted payment page.
Nothing wrong in the new admin *code* itself — every real issue found
was in the underlying database, mostly pre-existing and only now
exposed because the dashboard surfaces this data. Cyril asked to fix
everything found, including the lower-priority cleanup items. Fixed:

**Code fixes (done directly, live now):**
- `StaffTab.tsx` — `loadStaff`/`loadInvitations`/`loadAuditLog`
  previously collapsed any query error into a plain empty array
  (`error || !data ? [] : data`), so a failed lookup looked identical
  to "genuinely nothing here yet" — on the one tab controlling who
  has admin access, that's the wrong place for a silent failure. Now
  has its own `loadError`/`invitationsError`/`auditError` state,
  surfaced in the table, matching every other tab's pattern.
- `StaffTab.tsx` and `SecurityLogTab.tsx`'s audit tables also
  conflated "table is genuinely empty" with "your search matched
  nothing" into one message — now distinguished, matching the History
  tabs' existing convention.
- `viewSignedUrl` was copy-pasted identically into six files
  (Payments/Sponsorships/Verifications tabs + their three History
  counterparts). Diffed all six — byte-identical, no drift — and
  consolidated into `src/lib/adminSignedUrl.ts`, all six files now
  import it.
- Removed `.adm-coming-soon` from `admin.css` — dead now that all 11
  sections are real (no file references it anymore).

**Database fixes — SQL drafted, Cyril to run**
(`admin_audit_fixes_2026-07-31.sql`, handed over separately; same
never-apply-directly convention as every other migration this
session):

1. **Verification "Revoke" was only blocked by the React component,
   not the database.** The button only shows for Super Admin, but the
   live RLS policy on `vendor_verifications` let any Admin or
   Verification Admin run the identical `UPDATE` — meaning going
   around the screen (e.g. calling the Supabase client directly from
   the browser console) would let a non-Super-Admin revoke a badge
   anyway. Fixed with a `BEFORE UPDATE` trigger that blocks any
   transition to `status = 'revoked'` unless the caller is Super
   Admin — regardless of what the UI shows.
2. **Payment and sponsorship receipts were readable by any logged-in
   account**, not just the vendor who uploaded them or finance staff
   — the policy meant to restrict this checked `auth.uid() IS NOT
   NULL` instead of actually matching the file's owner. Rewritten to
   properly scope by the vendor's own folder (matching the pattern
   already used correctly for `vendor-gallery`/`vendor-branding`).
   While fixing this, found the *exact same* mistake, inverted, on
   `vendor-verifications`' "read own documents" policy — it compared
   `auth.uid()` (login id) directly to the storage folder name, but
   the folder is actually named after `vendors.id` (a different
   internal id) — so that policy never matched anyone, meaning a
   vendor could never view their own uploaded verification documents
   (harmless for admin access, since staff have a separate correct
   path in, but a real gap for vendors). Fixed the same way.
3. **Anyone could submit a fake badge-verification application under
   a vendor that isn't theirs** — a leftover always-allow INSERT
   policy sat alongside the correct ownership-checked one. Removed
   the always-allow one.
4. **Two financial tables were readable by literally anyone, logged
   in or not** — found while cleaning up what the audit initially
   flagged as a minor "duplicate policies" performance note: both
   `vendor_payments` and `commissions` had a leftover `qual: true`
   policy making the *entire* table public, alongside the correctly-
   scoped "own record or finance staff" policies already doing the
   real job. This turned a cosmetic cleanup task into closing an
   actual data leak — vendor payment amounts and partner commission
   earnings were technically fetchable by an unauthenticated request
   using only the public API key. Dropped the wide-open policies and
   their redundant near-duplicates on `vendor_payments`, `commissions`,
   and `vendor_sponsorships`. Left `partners`' public-read/public-
   insert policies alone (only removed the literal duplicates) since
   that table being world-readable looks intentional — referral code
   lookups during vendor signup, and the partner application form,
   both need it.
5. Added missing indexes on 8 foreign key columns across
   `admin_audit_log`, `admin_invitations`, `commissions`, `partners`,
   `user_roles`, `vendor_payments`, `vendor_verifications` (fine at
   current row counts, will matter as they grow), and dropped one
   exact duplicate index on `user_roles`.

**Still not run as of this writing** — the SQL file needs Cyril to
execute it in Studio, then a follow-up verification pass (re-check
every policy/index via the Supabase connection) before this item is
fully closed out.

## Getlisted/payment (vendor subscription) audit + fixes (2026-08) — done

Same audit treatment applied to the vendor-listing payment flow
(`getlisted`, `payment`, `payment-status`, `payment-failed`,
`paystack-webhook`, `verify-paystack-payment`). Found something more
serious than the admin audit: a vendor's own logged-in session could
directly set `subscription_status`/`plan_tier`/`is_premium`/`paid_at`/
`expires_at`/`spot_id`/`paystack_reference` on their own `vendors` row
— meaning a vendor could grant themselves an active paid plan without
ever paying, the same way they'd edit their business description.
Fixed with a new trigger, `prevent_unauthorized_billing_changes()`
(BEFORE INSERT OR UPDATE on `vendors`), that exempts admins
(`get_my_admin_role() IS NOT NULL`) and the two Paystack edge
functions (`auth.uid() IS NULL`, since both use the service role key)
completely, and only blocks a vendor's own session from escalating
INTO active/paid/premium — every existing legitimate vendor-side
write (signup inserting their chosen plan before paying, the
"pending payment expired, downgrade to free" self-service cleanup)
was traced first and confirmed to still work.

Also fixed: both Paystack functions silently skipped their own price-
verification check for any plan not in the fixed 3-tier price table
(returned "expected cost = 0", and the old guard treated that as "no
check needed" instead of "reject") — now rejects unrecognized plans
outright. Added a reference-reuse check (an old, already-confirmed
Paystack transaction reference could otherwise be replayed on a new
`vendor_payments` row to reactivate an expired subscription for
free) plus a matching unique index on `vendor_payments.gateway_ref`
(partial — `WHERE gateway_ref IS NOT NULL`, so bank-transfer rows
with no reference never conflict). Both functions now also overwrite
`vendor_payments.amount` with Paystack's own verified figure at
confirmation time, since the commission trigger reads that same
column — previously it was left as whatever the browser originally
sent at insert time. Deployed live (versions 46 / 36 respectively),
confirmed via direct read-back of the deployed source.

One code-only fix applied directly, no migration needed:
`payment/page.tsx`'s bank-transfer receipt submission now checks the
two Supabase write's actual errors instead of always redirecting to
the "success" screen regardless. And `getlisted/page.tsx` now sends
a logged-out `?context=upgrade` visitor to `/login` instead of
silently treating them as a first-time signup.

**Consciously deferred, not fixed:** the plan-price table is
duplicated across four places (`payment/page.tsx`,
`SubscriptionTab.tsx`, both Paystack functions) with nothing keeping
them in sync if a price ever changes — real technical debt, but a
larger refactor than seemed safe to bundle into this pass. The dead
24-hour card-payment cleanup branch in `payment/page.tsx` (effectively
unreachable given how `subscription_status` transitions actually
happen) is harmless and left alone.

## Partner Dashboard — build in progress (started 2026-08)

Fourth major stage, same "auth/entry-points first, then the rest one
piece at a time" approach as Admin. Scope confirmed via a dedicated
research pass reading every partner-facing production file
(`partner-program.js`, the archived `partner-program-legacy.js`,
`partner-create-account.js`, `partner-legal.html`,
`admin/partner-dashboard.js`) plus direct schema/RLS checks — this
was essential, since several things production's code *tries* to do
turned out to already be broken/non-functional today, not just
things to port faithfully.

Cyril's decisions (2026-08, via AskUserQuestion): build order same as
Admin; give partners their own isolated Supabase session
(`src/lib/partnerSupabase.ts`, storageKey `spotlight-partner-session`
— production has partners sharing the exact same session as
vendors/customers, a real same-person conflict risk); fix the broken
partner self-service writes via dedicated `SECURITY DEFINER`
functions rather than broadening RLS; drop the "Free Vendor
Earnings" dashboard stat entirely rather than keep it as a dead
always-zero placeholder (no code anywhere, in production or the DB
trigger, actually generates a `free_vendor`-type commission).

**Built so far:**
- `src/lib/partnerSupabase.ts` — isolated client + `PartnerSession`
  helpers, mirrors `adminSupabase.ts` exactly.
- `get_partner_id_by_referral_code(p_code)`, `link_partner_account()`,
  `close_partner_account()`, `restore_partner_account()` —
  `SECURITY DEFINER` functions, applied and confirmed live.
- `/partner-program` (`page.tsx`) — combined application + login
  page, tab-switched (`#login` hash deep-links to the login tab,
  matching production). **Ported the CORRECT referral-resolution
  logic from the archived `partner-program-legacy.js`, not the
  current live file** — confirmed via direct schema check that the
  current live `partner-program.js` inserts into columns
  (`lga`, `referred_by_code`) that don't exist on the real table at
  all (real columns are `local_government`, `referred_by`), so it
  cannot successfully create a partner row today, referral or not.
  Also fixed: duplicate-check now covers both `email` AND `phone`
  (both have real unique constraints; the live version only checked
  email), and referral codes are matched case-insensitively via the
  new RPC (codes are always generated uppercase).
- **`/partner-program` rebuilt (2026-08) to faithfully match production's actual marketing page** — Cyril caught that an earlier pass had replaced production's real page (hero w/ inline apply form, 3-card Rewards section, 4-card Resources section, and a separate Login section further down — NOT a tab-switched single card) with a much thinner custom design. Fully re-ported: `PartnerNavbar.tsx` (production's page has its own distinct navbar — Why Spotlight?/Get Listed/Partner Rewards/Contact Us/Log in — different from the shared site Navbar's link set; reuses `Navbar.module.css` for identical visuals, but checks the isolated `partnerSupabase` session for login state instead of the shared vendor session production's version incorrectly read), full `partner-program.module.css` (ported 1:1 from production's `partner-program.css`), and the branded 3-column footer (brand / quick links / partner support) matching production exactly. All the CORRECT data logic from the original build (RPC referral lookup, email+phone duplicate check, `link_partner_account` RPC on login) carried over unchanged — only the visual structure was wrong, not the logic. `/partner-create-account` (a different, non-marketing page reached only via a direct email link) got its own small `partner-create-account.module.css` split out, since it depended on the old simple auth-card classes that no longer exist in the rebuilt file.
  - **Needs a manual step from Cyril**: copy `images/partner-hero-image.jpg` and `images/partner-login-image.png` from the production folder into Staging's `public/images/` — the page references these two background images by the same paths production uses, but the sandbox's file tools can't copy binary image files directly. (Done — Cyril copied both.)
  - **Follow-up fixes after Cyril reviewed the live page (2026-08)**: footer logo was rendering at full image size — production applies its shared `.homeimg` class (50px tall) to the footer logo too, not just the navbar's; added the equivalent `.hfooterLogo` class. Hero `<h1>` was wrapping to two lines — added `white-space: nowrap` plus a `clamp()` font-size so "Become a Spotlight Partner" always stays on one row at every width.
- **`/partner-legal` rebuilt (2026-08) to faithfully match production's actual page** — an earlier pass had invented its own content/wording instead of reading production's real `partner-legal.html`/`.js`/`.css` directly. Re-read all three and rebuilt exactly: same 6 tabs (Terms — 8 numbered blocks, Privacy — 10 numbered blocks, **Marketing Assets** — referral link / 3 WhatsApp templates / sales script / onboarding guide, Brand Guide — **including the actual logo image in a dark preview box**, which the earlier pass omitted entirely, Earning Calculator, FAQ — 7 items), same exact wording throughout, same click-to-calculate calculator behavior (single vendor-count input + plan dropdown + a "Calculate" button that reveals results — not the earlier pass's live-updating multi-field version), and the same hash deep-linking + FAQ accordion behavior as production's `partner-legal.js`. One deliberate deviation, per Cyril's explicit request after seeing it live: the calculator's "Estimated total" result is now shown larger, bolder, and in the solid brand gold (`var(--color-primary)`) instead of production's softer `--color-primary-hover` shade, to make it visually prominent.
  - **Moved from the `(main)` route group to `(standalone)`.** Production's `partner-legal.html` has its own distinct navbar (Partner Program / Contact Us / Log in only — no Why Spotlight?/Get Listed/FAQ/Feedback) and a much simpler bottom-bar-only footer, different from both the shared site Navbar `(main)`'s layout injects automatically AND from `partner-program`'s richer 3-column footer. Since `(main)/layout.tsx` force-injects the shared Navbar on every page in that group, this page had to move to `(standalone)` (same URL, route groups don't affect paths) so it could bring its own header/footer, matching `partner-program`'s existing precedent.
  - **New shared `src/components/PartnerNavbar.tsx`**, generalized with a `links` prop, since `partner-program` and `partner-legal` each need the same partner-session-aware navbar shell but a different link set. The old page-local `partner-program/PartnerNavbar.tsx` now just re-exports the shared one.
- `/partner-create-account` — reads `?partner_id=`, readonly email,
  `signUp()`, links via `link_partner_account()` RPC instead of an
  unprotected direct update (the exact step confirmed broken in
  production — no RLS policy has ever permitted it), sends
  `EmailTemplates.partnerAccountCreated`, and — since signUp already
  creates a live session — goes straight to `/partner-dashboard`
  instead of back to a login screen.
- `/partner-legal` (`page.tsx` + `.module.css`) — public, no-auth
  6-tab page (Terms, Privacy, Assets, Brand, Calculator, FAQ) with
  hash deep-linking (`#terms` etc., matching the consent-checkbox
  links already added on `/partner-program`). Commission numbers,
  refund window, hold period, and payout schedule are the real,
  currently-enforced rules (re-confirmed against
  `handle_commission_on_payment()`/`unlock_commissions()` rather than
  copied from production's old copy). Deliberately does **not**
  promise collection of bank details or a NIN for identity/payout
  purposes — production's old copy mentioned both, but neither field
  exists anywhere in the schema and nothing collects them today, so
  promising it here would be a real commitment with nothing behind
  it. The Calculator tab reuses the exact same plan prices as
  `payment/page.tsx` and the two edge functions (₦26,982 / ₦113,400 /
  ₦201,600 yearly) — a 4th hardcoded copy, same already-flagged
  technical debt as before, not newly introduced here.
- `/partner-dashboard` (`page.tsx` + `partner-dashboard.css`) — full
  build, faithful port of `admin/partner-dashboard.js`'s one long
  stacked page (production never had tabs here). Every section built:
  referral link (with copy button — the Assets tab above promises
  this is "shown on your dashboard", so it had to actually be here),
  earnings summary, performance, monthly bonus tracker + progress bar,
  earnings breakdown (Vendor/Override/Bonus — no Free Vendor row),
  reward & bonus history (search/type/status filters, 10-row page +
  "See more", CSV statement download), downline table, account section
  (partner-since, computed Active/Inactive/Closing/Closed status,
  close/restore). Deliberate fixes beyond a faithful port:
  - **No client-side `unlock_commissions()` call on load** — confirmed
    redundant, the hourly `pg_cron` job already does this globally.
  - **Downline table rebuilt, not just de-N+1'd.** Checked the actual
    `commissions` RLS policy live today: the admin-audit pass earlier
    this project replaced the old wide-open policy with `"Partners can
    view their commissions"`, scoped to `partner_id IN (own partner
    ids)` — meaning a plain partner can no longer read ANOTHER
    partner's commissions rows at all (correct behavior, not a bug).
    So production's per-downline-partner "Their Earnings" column is
    gone; it's replaced with "Your Override Earnings" per downline
    partner, computed from the current partner's own already-fetched
    commissions (`type='override'`, grouped by `source_partner_id`) —
    correct under RLS and one query total instead of N.
  - Close/Restore call the `close_partner_account()` /
    `restore_partner_account()` RPCs (built earlier this session)
    instead of raw `.update()` calls, since `partners` has no UPDATE
    policy for a plain authenticated user at all.
  - The close-account confirm dialog is worded honestly around gap #2
    below (does **not** claim vendors/partners get detached, unlike
    production's copy).
  - Added a 3rd read-only case, same root cause as gap #2: if
    `scheduled_deletion_at` has already passed, there's no RPC to
    finalize the closure server-side, so the page detects this and
    shows a plain "Account Closed" screen + signs the partner out,
    instead of attempting a write that would fail anyway (production's
    equivalent client-side force-close code most likely already fails
    silently in production today, for the same reason).
  - **Not yet build-verified** — the sandbox's isolated Linux
    environment was down for the whole build ("VM service not
    running"), so `tsc --noEmit` could not be run this pass. Reviewed
    the full file manually against the codebase's established
    patterns (matches `vendordashboard/page.tsx` and `admin/page.tsx`
    conventions closely) but this still needs an actual build check
    next session before considering it done.
  - **Restructured (2026-08) into a sidebar + tab-per-section shell,
    matching admin exactly** — Cyril caught that the first pass was a
    single long scrolling page (a faithful port of production's actual
    `partner-dashboard.html`, which has never had tabs) and pointed out
    he'd specifically asked for the admin-style structure via the
    earlier AskUserQuestion. That question got recorded as "build
    order same as Admin" at the time — a real ambiguity, not something
    confirmed back with him — so this was a miscommunication to own,
    not a case of production simply being followed correctly. Split
    the single file into `page.tsx` (shell: auth guard, data loading,
    all derived-total computation, `TABS` array, sidebar nav — mirrors
    `admin/page.tsx`'s structure 1:1) plus four tab components:
    `OverviewTab.tsx` (referral link + earnings summary + performance +
    monthly bonus), `EarningsTab.tsx` (breakdown + reward/bonus history
    with search/filter/CSV), `DownlineTab.tsx`, `AccountTab.tsx`. Types
    shared across the shell and tabs live in `types.ts`. All underlying
    data/RPC logic unchanged — this was purely a UI restructuring.

**Flagged, not fixed in this pass (Cyril asked these be revisited at
the end of the Partner Dashboard build):**
1. The entire `partners` table (name, email, phone, DOB — full rows,
   not just an id) is readable by anyone, logged in or not, via a
   `qual: true` RLS policy. This predates this build and also
   currently backs the already-working vendor-signup referral
   lookup in `signup/page.tsx`, so tightening it isn't a same-file
   fix — it needs its own pass that updates that existing lookup too
   (e.g. to use the new `get_partner_id_by_referral_code` RPC
   instead of a raw table read).
2. `close_partner_account()` deliberately does NOT detach a closing
   partner's already-referred vendors or downline partners the way
   production's version tried to (and silently failed at, for the
   same "no RLS policy" reason as the account-linking bug). The
   existing `prevent_referral_update` trigger blocks changing
   `referred_by`/`referred_by_partner_id` once set, specifically to
   protect commission history from tampering — worth a deliberate
   decision (a controlled exception in that trigger, or accepting
   that closing an account just stops new commissions rather than
   un-linking history) rather than silently building around it.
3. No server-side mechanism finalizes a closure once
   `scheduled_deletion_at` passes (production attempted this
   client-side, on whichever partner happened to load the dashboard
   next — itself an odd design — and likely fails silently under RLS
   today for the same reason as gap #2). Needs a proper answer: either
   a scheduled server-side job (mirroring the `unlock-commissions-job`
   `pg_cron` pattern) or a dedicated RPC, resolved together with gap #2
   since both hinge on the same detach-on-close decision.

## Search audit — 3 real bugs found and fixed (2026-08)

Cyril asked for a gap check on the search/discover-results logic.
Audited `search_vendors`/`search_products`/`search_services` RPCs,
`HomeCategorySearch.tsx`, and `DiscoverResults.tsx` end to end. Three
real bugs found, all fixed:

1. **Duplicate, overloaded RPC definitions.** More than one version of
   the same-named search RPC existed in the database (different
   parameter signatures from earlier iterations never cleaned up),
   which risked Postgres/PostgREST picking an unintended overload
   depending on which parameters a given call happened to supply.
   Dropped the stale versions, leaving one canonical definition per
   RPC.
2. **`search_vendors` cross-category false positives.** The query
   matched a search term against vendor name/description/category
   text broadly enough that a search for one category's keyword could
   surface vendors from an unrelated category if their description
   happened to contain the word incidentally. Tightened the matching
   logic so category-scoped searches actually stay scoped.
3. **Stale sub-subcategory filter in the discover drawer.** Changing
   the top-level category in `DiscoverResults.tsx`'s filter panel
   didn't clear a previously-selected sub-subcategory from a different
   category tree, so the results silently applied an impossible/
   leftover filter combination. Fixed by resetting the sub-subcategory
   selection whenever its parent category changes.

Frontend call sites updated to match any RPC signature changes;
verified via `npx tsc --noEmit` (clean) and DB-level checks that no
orphaned RPC overloads remained.

## Sitemap/indexing fix + Search Console correction (2026-08)

Cyril asked (1) to confirm indexing/sitemap correctness and (2) for
platform-growth recommendations. Sitemap check found one real bug: a
stale Netlify environment variable had the sitemap generator emitting
`www.spotlightdirectories.com` URLs, while the canonical/production
domain is the non-www version — a mismatch that actively works against
indexing (search engines see two different-looking domains). Fixed the
env var and confirmed the sitemap now emits the correct canonical
domain throughout.

Separately, incorrectly told Cyril at first that Google Search Console
wasn't set up — he corrected this (it was set up together, 2026-08-18)
and the record was corrected same session. Search Console itself was
never the problem; only the sitemap's domain mismatch was.

## Partner program hardening + payout collection (2026-08-20/21)

Cyril asked for a full audit of the partner program "before acquiring
partners as opposed to ads," and separately raised a sharp economic
question about whether the commission structure actually motivates
partners given the 90-day free-trial delay before any payout is even
possible (see STATUS section item #1 above — deliberately left
unresolved, his choice).

**Audit found two real, separate gaps**, which Cyril approved fixing
outright ("let's fix them for as long as they strengthen this platform
and do not break or alter any existing logic"):

1. **`partners` table was fully public-readable** — name, email,
   phone, DOB, all of it, no auth needed, via a leftover `qual: true`-
   style open SELECT policy. Closed by dropping the open policy and
   replacing every legitimate read path (duplicate-checks, self-lookup
   during signup, downline queries, admin views) with narrow
   `SECURITY DEFINER` RPCs that return only what each caller actually
   needs: `partner_email_or_phone_exists`, `get_partner_signup_prefill`
   (now also returns `payout_details_submitted_at`), `get_partner_
   downline`, plus reuse of the already-existing `get_partner_id_by_
   referral_code` / `link_partner_account`.
2. **No mechanism existed to collect a partner's payout bank details
   at all.** Cyril's explicit procedure: partner applies → admin
   approves → the approval email's "create account" link is where bank
   details AND a NIN get collected, with the account name required to
   match the NIN name (stated on the form, not machine-verified — same
   trust model as vendor identity docs elsewhere on the platform).
   Built via `submit_partner_payout_details()`, a narrow `SECURITY
   DEFINER` RPC that only ever updates the caller's own row, called
   from `partner-create-account/page.tsx` right after account
   setup/linking.

**Two rounds of regressions surfaced from fix #1** (removing the open
read policy broke other things that had silently depended on it — all
found and fixed the same day, either by Cyril reporting via screenshot
or caught proactively before he saw them): the Apply form's duplicate-
check and insert-with-`.select()` pattern (Postgres requires a SELECT
policy for `INSERT...RETURNING` to succeed even when the INSERT's own
WITH CHECK passes), the create-account page's anonymous pre-fill
lookup, and the dashboard's downline query. All fixed via the RPCs
listed above.

**Then a real architectural question surfaced from live testing**:
Cyril's test email had already been used to create a customer account,
and the partner-create-account flow dead-ended with "account already
exists" — no way forward. Root cause: this platform runs ONE shared
Supabase Auth identity per email across vendor/customer/partner/admin
by design (confirmed via the existing "Dual customer/vendor account
model" pattern already used in `customer-login/page.tsx`) — a partner
role is just another table pointing at the same login, not a separate
identity to create. Fixed by rewriting `partner-create-account/
page.tsx` into a proper state machine:
- **`new`** — signUp() with a chosen password (first-time, brand new
  email).
- **`link`** — triggered automatically when signUp() returns "already
  registered": switches to asking for the visitor's EXISTING password
  and calls `signInWithPassword()` + `link_partner_account()` instead,
  attaching partner access to the identity that already exists. Has a
  "Forgot your password?" link (was initially missing — added after
  reasoning through what happens if someone genuinely doesn't remember
  an old vendor/customer password).
- **`authenticated`** — detects an already-live `partnerSupabase`
  session matching the prefilled email on page load (e.g. arriving via
  the payout-details redirect below) and skips the password step
  entirely, going straight to the payout form.
- Idempotency: if `payout_details_submitted_at` is already set for a
  given `partner_id`, shows an "Already Set Up" screen instead of
  re-showing the form.

**Separately closed a second entry point that bypassed payout
collection entirely**: the general Partner Login tab on `/partner-
program` (used for ordinary returning-partner logins, e.g. after a
password reset) signed a partner in and sent them straight to `/
partner-dashboard` with no check at all for whether payout details had
ever been submitted — meaning a partner could reach a fully working
dashboard having never given bank/NIN info. Fixed: `handleLogin()` now
checks `payout_details_submitted_at` after sign-in and redirects to
`/partner-create-account?partner_id=...` if missing, which (per the
`authenticated` mode above) skips straight to the payout form without
asking for the password again.

**NIN converted from a typed number to an uploaded document**, per
Cyril's correction ("The NIN is the ID to be submitted inside of which
the NIN eleven digit is usually provided... that place must be changed
to an uploader"). New `partner_nin` category on the shared `validate-
upload` Edge Function (generalized via a new `ownerTable?: "vendors" |
"partners"` field on the `Rule` type, since every category before this
one always resolved the owner via `vendors`), new private
`partner-verifications` storage bucket, new `src/lib/uploadPartnerFile.
ts` (partner-session sibling of `uploadVendorFile.ts`). DB: `partners.
nin_number` dropped, `nin_document_path text` added; `submit_partner_
payout_details` rewritten to accept `p_nin_document_path` instead of a
digit string. Admin `CommissionsTab.tsx` got a "View NIN Document" link
next to each partner's bank details, using the existing `viewSignedUrl`
helper.

**Migration hiccup worth knowing about**: an early migration attempt
to rename `submit_partner_payout_details`'s 4th parameter failed
outright (Postgres 42P13 — `CREATE OR REPLACE FUNCTION` cannot rename
an existing parameter, needs `DROP FUNCTION` first) and the whole
transaction rolled back, including an unrelated column change and
storage bucket insert bundled into the same migration. This was only
caught later when a partner's payout submission failed in production
with "Could not find the function... in the schema cache" — the
function had silently reverted to its pre-migration signature while
everything built on top of the *intended* new signature had already
shipped. Lesson applied: after any migration failure, re-verify every
object the migration touched individually rather than assuming a
retry of just the failing statement fully repairs the situation.

**By design, deliberately NOT fixed / left for Cyril to decide later**:
the commission-structure/trial-timing motivation question (STATUS
section item #1).

## Backup system (2026-08-21)

Cyril discontinued Supabase's paid daily-backup add-on (not enough
real production data yet to justify the recurring compute cost) in
favor of a manual routine, walked through end-to-end this session.
Lives at `C:\Users\Dell\Documents\spotlightwebproject_staging\backups\`:

- **`BACKUP-CHECKLIST.md`** — the human-facing instructions, kept in
  sync with reality (updated this session once private-file backup
  actually started working).
- **Database**: `pg_dump` direct to a dated `.sql` file, run manually
  by Cyril (needs his DB password, which Claude never has/enters).
- **Public files** (`download-public-files.ps1`): reads a manifest,
  `public_files_list.txt` (`bucket|path` per line), and downloads each
  file from Supabase's public storage URLs into a `public_backup`
  folder, overwriting fresh each run. **Real gap found and fixed**:
  this manifest is a static snapshot, not live-generated — it had gone
  3 weeks stale (dated 2026-08-07) and was silently missing every file
  any vendor uploaded since then (335 → 372 files once regenerated).
  Permanent fix: the scheduled reminder task now regenerates this file
  from a live `select bucket_id, name from storage.objects where
  bucket_id in ('vendor-branding','vendor-gallery','vendor-videos')`
  query before every reminder fires, so it can never go stale again
  without Cyril needing to do anything differently.
- **Private files** (`download-private-files.ps1`, via `rclone`):
  copies `payment-receipts`, `vendor-verifications`, `sponsorship-
  receipts`, and `partner-verifications` (added this session, didn't
  exist when the script was first written) into a `private_backup`
  folder. Uses a named rclone remote (`rclone config create`) rather
  than an inline S3 connection string — the inline-string approach
  kept mis-parsing the `https://` endpoint value as a field delimiter
  no matter how it was quoted (tried three times before switching
  approaches); the named-remote form is the reliable, rclone-
  recommended way to do this.
- **Scheduled task** `spotlight-backup-reminder` (`0 9 */2 * *`, every
  2 days at 9am) — sends Cyril the copy-paste routine and silently
  refreshes `public_files_list.txt` first, per above.
- Archiving convention given to Cyril: since `public_backup`/
  `private_backup` share the same folder name every run, give each
  backup session its own dated subfolder in Google Drive (e.g.
  `Spotlight Backups/2026-08-21/`) rather than renaming anything —
  Drive doesn't require folder names to be unique across different
  parents, only within the same one.

**Not yet done**: nothing outstanding here — all three legs (DB,
public, private) confirmed working end to end this session, first
real run completed successfully (28MB payment-receipts, 55MB vendor-
verifications, ~1MB sponsorship-receipts + partner-verifications,
zero errors).
