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

### Branded HTML email templates (4 templates via Resend)
All transactional emails currently send plain HTML. Build branded
yellow/black templates with the Spotlight logo for:
1. Welcome email on signup (include SPOT ID and getting started guide)
2. Trial expiry warning (7 days remaining)
3. Subscription expiry warning (before plan expires)
4. Badge verification submission acknowledgement

All via the send-email Edge Function using Resend from
onboarding@mail.spotlightdirectories.com.

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

## MASTER PHASE 3 CHECKLIST

- [ ] Migrate to Next.js framework
- [ ] Build unified design system (tokens, components, typography)
- [ ] Merge style.css + style2.css → main.css
- [ ] Merge script.js + script2.js → main.js
- [ ] Pick single auth nav pattern (authBtn) and update all HTML pages
- [ ] Rename vendorpayments → vendor_payments (DB + all code)
- [ ] Rename discover-results2 files → discover-results
- [ ] Rename insight-dynamic.js → insight.js
- [ ] Consolidate 5 duplicate image upload handlers into single uploadVendorImage() function
- [ ] Build image validation Edge Function for storage uploads
- [ ] Replace browser plan limit constants with server fetch
- [ ] Build admin staff onboarding flow (no vendor profile)
- [ ] Build OTP-based email change flow
- [ ] Build 4 branded HTML email templates via Resend
- [ ] Fix Resend custom click tracking subdomain
- [ ] Rebuild landing page to world-class SaaS standard
- [ ] Rebuild GetListed page and plan comparison page
- [ ] Harmonise partner program page with brand
- [ ] Consolidate insight dashboards into one rebuilt dashboard
- [ ] Build Claude API integration roadmap and first features
- [ ] Build visitor authentication system
- [ ] Upgrade vendor_reviews INSERT policy after visitor auth is live