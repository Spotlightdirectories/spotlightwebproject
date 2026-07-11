# Phase 3 — All Deferred Tasks (Phase 1 + Phase 2)

---

## FROM PHASE 1

### Rec 1.2 — Review submission policy (Block 6 trigger)
Reviews currently accept submissions without login (Option A interim).
When visitor authentication is built (Block 6, item 24), upgrade the
vendor_reviews INSERT policy to require a visitor account login
(Block 6, item 25). DO NOT forget this — it is a security gap that is
intentionally deferred only until then.

NOTE (July 2026): "Phase 4" as a separate future phase has been
retired. Everything originally slated for it is now folded into
Blocks 5–6 of this same Phase 3 roadmap. Block 7 (Next.js migration)
is the definitive end of this roadmap — see the master checklist below.

### Rec 1.8 — OTP-based email change flow ✅ DONE (Block 4, item 19)
Built as a single-verification flow: one 6-digit code sent only to the
new email address. (Originally scoped as two-sided confirmation to both
old and new email; simplified per Cyril's explicit correction during
Block 4 — see master checklist for full detail.)

### Rec 1.8 — Fix Resend shared click tracking subdomain ✅ DONE (Block 3)
track.mail.spotlightdirectories.com verified and live.

### Rec 1.5 — Admin staff onboarding flow ✅ DONE (Block 4, item 18)
Built as a full invitation system, not just a signup page — see master
checklist for full detail (invitations, claim-on-login, revoke with
account cleanup, permanent audit log).

---

## FROM PHASE 2 — 2.2 Style & Script Consolidation

### CSS files
- style.css serves inner public pages (FAQ, GetListed, Feedback, legal)
- style2.css serves homepage only (hero, benefits, footer)
- Both loaded together on most pages even when only parts are needed

Block 7 action (confirmed with Cyril — do this AS PART OF the Next.js
migration itself, not as a preceding step; Next.js has its own styling
conventions, e.g. a global stylesheet plus component-scoped styles —
merging into a literal single main.css first would likely get redone
once the migration's real structure is known):
Organise styles properly using Next.js's own conventions during item 27.
Delete both originals once the migration is confirmed working.

### Script files
- script.js: contact form, feedback form, billing toggle, FAQ accordion,
  older auth nav pattern (loginLink / logoutLink element IDs)
- script2.js: hamburger menu, media slideshow, hero slideshow, newer
  auth nav pattern (authBtn element ID), utility functions

Known overlap: both files contain auth nav logic using different element
IDs. Pages loading both run two auth listeners simultaneously. Harmless
but redundant.

Block 7 action (same reasoning as CSS above):
Fold this logic into React components/hooks as part of item 27, rather
than merging into a single main.js beforehand.

---

## FROM PHASE 2 — 2.3 Table Naming Consistency

### vendorpayments → vendor_payments ✅ DONE (Block 1)

### File renames ✅ DONE (Block 1)
- discover-results2.html/js/css → discover-results.html/js/css
- insight-dynamic.js → insight.js

### File renames still pending (Block 7, see above)
- style.css + style2.css → (organised per Next.js conventions)
- script.js + script2.js → (organised per Next.js conventions)

---

## FROM PHASE 2 — 2.6 Image Upload Routine

### Consolidate duplicate image upload handlers ✅ DONE (Block 4, item 16)
Built as a shared `uploadVendorFile(file, category)` helper in the new
`upload-utils.js`, calling the `validate-upload` Edge Function for
server-side validation/resize — not a client-side-only function as
originally sketched here. Wired into all five former duplicate
handlers in vendordashboard.js, plus vendor-profile.js (gallery/cover/
logo), verify-badge.js, and payment.js. See master checklist for detail.

---

## FROM PHASE 2 — 2.4 Business Rules

### Image file type and size validation (storage level) ✅ DONE (Block 4, items 15/15b)
Built as the `validate-upload` Edge Function (server-side magic-byte
type detection, size/resolution checks, resize + re-encode) AND locked
the storage buckets themselves to service-role-only writes, so the
Edge Function can no longer be bypassed by calling storage directly.
See master checklist for full detail, including bugs found and fixed
during real testing.

### Browser-side plan limit display constants — PARTIALLY DONE
Real enforcement now lives server-side via RLS policies and
`get_vendor_plan_limits()` (Block 4, item 17) — this is the part that
actually matters for security, and it's done. The client-side DISPLAY
constants (PRODUCT_LIMITS, SERVICE_LIMITS, etc., used only for "your
plan allows X" text) are still hardcoded rather than fetched live.
Low priority, cosmetic only — candidate for Block 5 cleanup if time
allows, not blocking anything.

---

## FROM PHASE 2 — 2.4 Email Infrastructure

### Email notifications — full inventory ✅ DONE (Block 3)
17 branded templates now live via Resend. See Block 3 detail in master
checklist below. Emails 12–13 (trial/subscription expiry warnings)
built and deployed but not yet tested end-to-end — scheduled to test
after Block 6, per master checklist.

---

## GENERAL PHASE 3

### Framework migration — Block 7 (last)
Migrate from vanilla HTML/JS/CSS to Next.js.

### Design system ✅ DONE (Block 2)
Design tokens (colours, spacing, typography, shadows, z-index, and
light/dark mode token pairs) built in theme.css. Dark mode TOGGLE
mechanism (the actual switch + JS wiring) still pending — scheduled
for Block 5.

### Page rebuilds — Block 5 (see master checklist for full, current list)

### Claude API integration — Block 6

### Visitor authentication — Block 6 (item 24)
See Rec 1.2 above for the follow-on reviews policy change (item 25).

---

## MASTER PHASE 3 CHECKLIST — IN IMPLEMENTATION ORDER

### Block 1 — Foundation renames ✅ COMPLETE
- [x] 1.  Rename vendorpayments → vendor_payments (DB + all JS files + RLS policies)
- [x] 2.  Rename discover-results2.html/js/css → discover-results.html/js/css
- [x] 3.  Rename insight-dynamic.js → insight.js
- [x] 4.  Pick single auth nav pattern (authBtn) and update all HTML pages

### Block 2 — Design system ✅ COMPLETE
- [x] 5.  Build unified design tokens (colours, spacing, typography, light/dark mode tokens)
- [ ] 6.  Merge style.css + style2.css → organised Next.js structure *(Block 7, as part of the migration itself)*
- [ ] 7.  Merge script.js + script2.js → organised Next.js structure *(Block 7, as part of the migration itself)*

### Block 3 — Email infrastructure ✅ COMPLETE
- [x] 8.  Rebuild all 6 existing Resend emails with branded yellow/black HTML templates
- [x] 9.  Improve payment approved email to include SPOT ID, plan name, billing type and expiry date
- [x] 10. Build welcome email — triggered immediately on vendor signup
- [x] 11. Build badge submission acknowledgement — triggered on document upload
- [x] 12. Build trial expiry warning — pg_cron job, fires 7 days before trial ends
- [x] 13. Build subscription expiry warning — pg_cron job, fires before plan expires
- [x] 14. Fix Resend custom click tracking subdomain — track.mail.spotlightdirectories.com verified

Additional emails built during Block 3 (not in original plan):
- [x] Partner application received acknowledgement
- [x] Partner application approved (with referral code and create account link)
- [x] Partner account created confirmation
- [x] Badge revocation notification (super_admin only)

Total emails now live: 17 branded templates via Resend

NOTE: Emails 12 and 13 (trial expiry warning and subscription expiry
warning) were built and deployed but NOT yet tested end-to-end.
Test after Block 6 is complete using dev-reset-vendor.sql to set
trial_started_at to 83 days ago, then manually call:
https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-expiry-warnings
Confirm email arrives before Next.js migration.

### Block 3 — Additional hardening completed during email testing
- [x] Fix bank transfer receipt upload — storage RLS policies corrected
- [x] Fix admin session conflict — dedicated admin-supabase-client.js with separate storage key
- [x] Fix badge approval RLS — vendor_verifications UPDATE policy corrected
- [x] Fix badge form flicker — gray/blue fields hidden by default in HTML
- [x] Add badge revocation feature — super_admin can revoke with reason, email, profile update
- [x] Add Delete button on pending verifications for orphan cleanup
- [x] Prevent duplicate verification submissions when one is pending
- [x] Add Processing... feedback to all admin action buttons
- [x] Add Revoked status to verification history filter and table
- [x] Dev reset scripts: dev-reset-vendor.sql and dev-reset-partner.sql

### Block 4 — Backend hardening ✅ COMPLETE (July 2026)

- [x] 15. Build image validation Edge Function (`validate-upload`) — JWT-verified vendor
      ownership lookup, magic-byte real file type detection, size/resolution checks,
      resize + JPEG re-encode, PDF passthrough. Graceful fallback added for images this
      lightweight decoder can't parse (common with some Canva exports) — accepted as-is
      for categories with no minimum resolution requirement, still rejected where
      resolution must be verified (product/service images).
- [x] 15b. Storage bucket RLS lockdown — removed every permissive client-facing
      INSERT/UPDATE policy on vendor-gallery, vendor-branding, vendor-verifications,
      and payment-receipts (some had effectively no protection at all, e.g. `WITH CHECK
      (bucket_id = 'x' AND true)`). Now only the service role (used internally by
      validate-upload) can write. vendor-videos deliberately left untouched — video was
      never routed through validate-upload. Migration:
      20260711_lock_storage_buckets_service_role_only.sql
- [x] 16. Consolidated all 7 duplicate upload handlers (5 in vendordashboard.js, plus
      vendor-profile.js cover/logo, verify-badge.js, payment.js) into one shared
      `uploadVendorFile(file, category)` helper in upload-utils.js, calling validate-upload.
- [x] 17. Server-side plan limits — extended `get_vendor_plan_limits()` to cover
      products/services/social links/branches/gallery/video; fixed two pre-existing bugs
      (Custom tier was capped at 1; trial check used the wrong date field). Fixed the
      vendor_media ownership gap (previously anyone could insert media under any
      vendor_id). Fixed an infinite recursion bug found via live testing (Postgres
      42P17) affecting all five limit-checking policies — each now uses a small
      counting function instead of a self-referential subquery. Fixed two bugs in
      dashboard-branches.js (wrong branch limit numbers; a plan-limit check that
      incorrectly blocked editing existing branches). Fixed a missing `vendor_name`
      field that made saving a NEW product always fail — pre-existing bug, never
      previously exercised end-to-end.
- [x] 18. Admin staff onboarding — built as a full invitation system: a super_admin
      invites by email + role, the invited person signs up at a dedicated
      admin-signup.html (creates no vendor row), and their role is claimed
      automatically on first login. Revoking an invitation or an active admin's role
      now also cleans up any orphaned auth account tied to it, when safe to do so
      (never touches an account that has a real vendor profile or is already an
      active admin). Added a permanent, append-only audit log
      (admin_audit_log — invited/assigned/claimed/revoked, never editable or
      deletable through the app) and fixed a pre-existing gap where a super_admin
      could never see anyone else's role (only their own).
- [x] 19. OTP-based email change — single verification, one code sent only to the
      new email address (redesigned from an initial two-sided draft per Cyril's
      correction). Applies the change directly via the Admin API to both the login
      email and the vendor profile at once, bypassing Supabase's own unreliable
      built-in email confirmation system entirely.

Additional real bugs found and fixed via live testing during Block 4
(none of these were part of the original plan — all surfaced only once
actual end-to-end testing began):
- [x] Cover image upload failing on legitimate Canva exports — added graceful decode fallback
- [x] Uploaded images with transparency turning solid black instead of white after resize/JPEG conversion
- [x] Session-hijack bug: creating a new admin account in the same browser silently
      logged the browser into that new account, invalidating whoever was already
      logged in as a different admin — fixed with fully isolated signup-page session storage
- [x] payment.js crashing silently (breaking ALL payment buttons) when a vendor row
      doesn't exist yet — null check was present but placed after the crash, not before it
- [x] Paystack "payment verification failed" false alarm — the webhook (the real,
      authoritative activation path) was succeeding, but a secondary, less important
      client-side confirmation call was failing for an unrelated network reason and
      showing a scary, inaccurate error. Fixed to check the vendor's real status
      before ever showing a failure message.
- [x] "Manage Branches" showing for Standard plans (which don't allow branches at all)
- [x] Confirmed products/services/social-links/branches/cover/logo/video all working
      end-to-end via real, live testing (not just code review)

Migrations from Block 4:
- 20260710_extend_plan_limits_and_fix_bugs.sql
- 20260710_admin_staff_invitations.sql
- 20260710_staff_visibility_and_audit_log.sql
- 20260710_fix_audit_log_actor_fk.sql
- 20260710_email_change_otp.sql
- 20260711_lock_storage_buckets_service_role_only.sql
- 20260711_fix_plan_limit_infinite_recursion.sql

### Block 5 — Page rebuilds
- [ ] 20. Rebuild landing page to world-class SaaS standard
- [ ] 21. Rebuild GetListed page and plan comparison page — fold in displaying
          product/service limits and the 90-day trial publicly (currently missing)
- [ ] 22. Harmonise partner program page with brand — including world-class
          marketing assets for partners (referral toolkit, brand guide,
          earning calculator, onboarding guide, promotional materials)
- [ ] 23. Consolidate insight dashboards into one rebuilt dashboard — fold in
          building the sponsorship feature for real (currently hardcoded, no logic)
- [ ] Build the light/dark mode toggle (tokens already exist in theme.css from
      Block 2 — this is the actual switch + JS wiring, applied across all rebuilt pages)
- [ ] Subscription module fixes: Manage Payment Method button not functional;
      Manage Branches button not functional (separate from the plan-visibility fix
      already done in Block 4 — this is about the button's own action); billing
      history showing old confirmed payments even when vendor is on free plan;
      next payment amount/billing date display logic needs review

### Block 5 — Location-aware search & branch architecture (added July 2026)
Confirmed as a real, previously-unintentional gap: branches were built only to be
listed on a vendor's own profile page, never as independently discoverable/searchable
entities — despite genuinely having their own location and contact details. Also
found while investigating this: the "search near me" distance toggle exists in the
discover.html UI and captures GPS coordinates, but is never actually applied in any
search query, for any result type (vendor, product, or service) — a real gap
affecting the whole platform, not just branches, and a stated major selling point
for the platform.
- [ ] Add `state` and `lga` columns to the `branches` table + the branch form in
      dashboard-branches.js (not all branches share the parent's state/lga)
- [ ] Build real distance-based ("near me") search — currently non-functional for
      all search types
- [ ] Build `searchBranches()` in discover-results.js, following the same pattern
      as the existing searchProducts()/searchServices() — each branch becomes its
      own searchable result, inheriting name/category/subcategory/verification/
      rating/logo/cover/about/social links/hours from its parent vendor, using its
      own address/phone/WhatsApp/coordinates/state/lga
- [ ] Build a swappable branch view in vendor-profile.html (not a separate page) —
      when a branch's "View Profile" is clicked from search, the same profile page
      renders with that branch's own contact details, WhatsApp/Call/Directions
      buttons, and location swapped in, while everything else (identity, verification,
      about, hours, socials) stays inherited from the parent vendor

### Block 6 — Advanced features
- [ ] 24. Build visitor authentication system
- [ ] 25. Upgrade vendor_reviews INSERT policy after visitor auth is live
- [ ] 26. Build Claude API integration — first features (vendor description assistant,
          visitor search assistant, admin anomaly flagging)
- [ ] Test emails 12–13 (trial/subscription expiry warnings) end-to-end using
      dev-reset-vendor.sql, before Block 7 begins

### Block 7 — Framework migration (absolutely last)
- [ ] 27. Migrate entire platform to Next.js framework (all features confirmed
          working in vanilla before this step). CSS/JS consolidation (items 6/7)
          happens AS PART OF this migration, organised using Next.js's own
          conventions — not as a separate preceding step.
