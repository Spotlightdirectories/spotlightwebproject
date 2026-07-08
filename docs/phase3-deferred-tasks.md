# Phase 3 — All Deferred Tasks (Phase 1 + Phase 2)

---

## FROM PHASE 1

### Rec 1.2 — Review submission policy (Phase 4 trigger)
Reviews currently accept submissions without login (Option A interim).
When visitor authentication is built in Phase 4, upgrade the
vendor_reviews INSERT policy to require a visitor account login.
DO NOT forget this — it is a security gap that is intentionally
deferred only until Phase 4.

### Rec 1.8 — OTP-based email change flow
Current double-link confirmation flow works but is clunky. Vendors
must confirm from two separate email inboxes. Replace with a cleaner
OTP (one-time code) sent to the new email address. Vendor enters code
in the dashboard. One step, one inbox.
Requires: custom OTP generation, Resend integration, vendor table sync.

### Rec 1.8 — Fix Resend shared click tracking subdomain
Resend currently uses a shared tracking domain for click tracking.
Set up a custom subdomain (e.g. track.spotlightdirectories.com) to
improve email deliverability and brand consistency.

### Rec 1.5 — Admin staff onboarding flow
Admin staff currently must sign up as a vendor first, then be assigned
a role via the Admin Staff Management section. Build a dedicated admin
signup path that creates an auth user without inserting a vendor row.
Route directly to admin login after account creation.

---

## FROM PHASE 2 — 2.2 Style & Script Consolidation

### CSS files
- style.css serves inner public pages (FAQ, GetListed, Feedback, legal)
- style2.css serves homepage only (hero, benefits, footer)
- Both loaded together on most pages even when only parts are needed

Phase 3 action:
Merge into a single main.css using CSS custom properties for tokens.
Update every HTML page to load main.css only.
Delete both originals after migration is confirmed working.

### Script files
- script.js: contact form, feedback form, billing toggle, FAQ accordion,
  older auth nav pattern (loginLink / logoutLink element IDs)
- script2.js: hamburger menu, media slideshow, hero slideshow, newer
  auth nav pattern (authBtn element ID), utility functions

Known overlap: both files contain auth nav logic using different element
IDs. Pages loading both run two auth listeners simultaneously. Harmless
but redundant.

Phase 3 action:
1. Pick one auth nav pattern — authBtn is the newer preferred one
2. Update all HTML pages to use that single pattern
3. Merge all logic into a single main.js organised by feature module
4. Update all HTML pages to load main.js only
5. Delete both originals after migration is confirmed working

---

## FROM PHASE 2 — 2.3 Table Naming Consistency

### vendorpayments → vendor_payments
Every other table uses the vendor_ prefix but vendorpayments breaks it.

Files that reference vendorpayments:
- admin/admin-payments.js (multiple queries)
- payment.js
- vendordashboard.js
- Supabase Edge Functions

Phase 3 SQL:
  ALTER TABLE public.vendorpayments RENAME TO vendor_payments;

Then global find-and-replace vendorpayments → vendor_payments across
the entire project. Test all payment flows before deploying.

### File renames (do at rebuild time)
- discover-results2.html/js/css → discover-results.html/js/css
- insight-dynamic.js → insight.js
- style.css + style2.css → main.css
- script.js + script2.js → main.js

---

## FROM PHASE 2 — 2.6 Image Upload Routine

### Consolidate duplicate image upload handlers in vendordashboard.js
The same 40-line upload routine (size check, type check, resolution
check, Supabase upload, get public URL) is copied five times inside
vendordashboard.js — once each for: primary product image, secondary
product image, tertiary product image, primary service image, and
secondary service image.

If the max file size, allowed types, or minimum resolution ever needs
changing, it must be updated in five separate places — high risk of
missing one.

Phase 3 action:
Extract into a single reusable function during the dashboard rebuild:

  async function uploadVendorImage(file, folder) {
    // validate size, type, resolution
    // upload to vendor-gallery/{vendor.id}/{folder}/
    // return public URL
  }

Then call uploadVendorImage(file, 'products') and
uploadVendorImage(file, 'services') from each handler.
Delete all five duplicate blocks after migration is confirmed.

---

## FROM PHASE 2 — 2.4 Business Rules

### Image file type and size validation (storage level)
Browser currently validates file types (JPG/PNG/WEBP), max size (2MB),
and min resolution (800x800px). These checks exist only in the browser.
A vendor using technical tools could bypass them.

Phase 3 action:
Build a Supabase Edge Function to validate file type and size
server-side before writing to storage. Wire into the upload flow in
vendordashboard.js, vendor-product.js, and vendor-service.js.

### Browser-side plan limit display constants
vendordashboard.js contains hardcoded PRODUCT_LIMITS and SERVICE_LIMITS
for UI display only. Actual enforcement is already on the server via RLS.

Phase 3 action:
Replace hardcoded constants with a server fetch from
get_vendor_plan_limits() so UI always reflects server truth.

---

## FROM PHASE 2 — 2.4 Email Infrastructure

### Email notifications — full inventory and Phase 3 plan

**Currently live via Resend (6 emails):**
1. Payment approved — sent when admin approves a bank transfer
   Gap: does not include SPOT ID, plan name, or expiry date. Improve in Phase 3.
2. Payment rejected — sent with rejection reason
3. Badge verification approved — sent with badge type confirmed
4. Badge verification rejected — sent with instruction to resubmit
5. Partner application approved — sent with referral code, vendor link,
   partner link, and induction link
6. Partner application rejected — sent with rejection reason

**Currently live via Supabase (3 emails, automatic):**
7. Email confirmation on signup
8. Password reset
9. Email change confirmation (sent to both old and new email)

**To be added in Phase 3 (4 new emails via Resend):**
10. Welcome email on signup — sent immediately after vendor account is
    created. Include: SPOT ID, plan name, login link, getting started guide.
11. Trial expiry warning — sent 7 days before the 90-day free trial ends.
    Include: days remaining, upgrade CTA with link to getlisted page.
12. Subscription expiry warning — sent before a paid plan expires.
    Include: expiry date, renewal CTA with link to getlisted page.
13. Badge verification submitted acknowledgement — sent when a vendor
    submits documents. Confirm receipt and that review is in progress.

**Total after Phase 3: 13 emails**

**All Phase 3 emails via the send-email Edge Function from
onboarding@mail.spotlightdirectories.com using Resend.**

All 13 emails to be rebuilt with branded yellow/black HTML templates
including the Spotlight logo. Plain text fallback for each.

Emails 11 and 12 (trial and subscription warnings) require a scheduled
job or cron function to check expiry dates daily and send at the right
time. Build this as a Supabase Edge Function triggered by pg_cron.

---

## GENERAL PHASE 3

### Framework migration
Migrate from vanilla HTML/JS/CSS to Next.js.
Reason: component reuse, server-side rendering, proper routing, easier
maintenance, and better foundation for Claude API integration.

### Design system
Build unified design tokens, component library, and typography system.
Brand colours: deep yellow #e6c200 and chalk coal black #000000.

### Page rebuilds
- Landing page (index.html) — world-class SaaS standard
- GetListed page — including plan comparison table
- Partner program page — harmonise with brand
- Insight dashboard — consolidate insight-dynamic.js into one
  world-class rebuilt dashboard with real data throughout

### Claude API integration
Roadmap for Claude API as internal platform engine:
- AI assistant for visitors (help find vendors)
- AI assistant for vendors (write product/service descriptions,
  image guidance matched to business type)
- AI assistant for admin (flag suspicious activity)

### Visitor authentication (Phase 4 prerequisite)
Build visitor account system before Phase 4 begins.
After this is live, upgrade the vendor_reviews INSERT policy to
require visitor login before submitting a review.

---

## MASTER PHASE 3 CHECKLIST — IN IMPLEMENTATION ORDER

### Block 1 — Foundation renames (do first, everything else depends on this)
- [ ] 1.  Rename vendorpayments → vendor_payments (DB + all JS files + RLS policies)
- [ ] 2.  Rename discover-results2.html/js/css → discover-results.html/js/css
- [ ] 3.  Rename insight-dynamic.js → insight.js
- [ ] 4.  Pick single auth nav pattern (authBtn) and update all HTML pages

### Block 2 — Design system
- [x] 5.  Build unified design tokens (colours, spacing, typography)
- [ ] 6.  Merge style.css + style2.css → main.css *(deferred to Block 7 — Next.js migration)*
- [ ] 7.  Merge script.js + script2.js → main.js *(deferred to Block 7 — Next.js migration)*

### Block 3 — Email infrastructure
- [x] 8.  Rebuild all 6 existing Resend emails with branded yellow/black HTML templates
- [x] 9.  Improve payment approved email to include SPOT ID, plan name, and expiry date
- [x] 10. Build welcome email — triggered immediately on vendor signup
- [x] 11. Build badge submission acknowledgement — triggered on document upload
- [x] 12. Build trial expiry warning — pg_cron job, fires 7 days before trial ends
- [x] 13. Build subscription expiry warning — pg_cron job, fires before plan expires
- [ ] 14. Fix Resend custom click tracking subdomain — CNAME added to Cloudflare, pending DNS propagation

### Block 4 — Backend hardening
- [ ] 15. Build image validation Edge Function for storage uploads
- [ ] 16. Replace browser plan limit constants with server fetch
- [ ] 17. Consolidate 5 duplicate image upload handlers into single uploadVendorImage() function
- [ ] 18. Build admin staff onboarding flow (no vendor profile created)
- [ ] 19. Build OTP-based email change flow

### Block 5 — Page rebuilds
- [ ] 20. Rebuild landing page to world-class SaaS standard
- [ ] 21. Rebuild GetListed page and plan comparison page
- [ ] 22. Harmonise partner program page with brand
- [ ] 23. Consolidate insight dashboards into one rebuilt dashboard

### Block 6 — Advanced features
- [ ] 24. Build visitor authentication system
- [ ] 25. Upgrade vendor_reviews INSERT policy after visitor auth is live
- [ ] 26. Build Claude API integration — first features (vendor description assistant,
          visitor search assistant, admin anomaly flagging)

### Block 7 — Framework migration (absolutely last)
- [ ] 27. Migrate entire platform to Next.js framework
          (all features confirmed working in vanilla before this step)