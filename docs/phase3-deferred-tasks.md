# Spotlight Directories — Phase 3 Master Roadmap

60 numbered items total. Each item lives in exactly one place — no
"deferred to X" labels. Blocks 1–4 are ACHIEVED. Blocks 5–7 are PENDING.

---

## ACHIEVED — Block 1, Foundation renames

1. Renamed vendorpayments → vendor_payments
2. Renamed discover-results2 → discover-results
3. Renamed insight-dynamic.js → insight.js
4. Picked single auth nav pattern (authBtn)

## ACHIEVED — Block 2, Design system

5. Built unified design tokens (colours, spacing, typography, shadows, z-index) in theme.css
6. Built light/dark mode token values (both palettes fully defined in theme.css)
7. Built comprehensive category and subcategory table (32 categories, 539 subcategories, live in vendor dropdowns)

## ACHIEVED — Block 3, Email infrastructure

8. Rebuilt all 6 existing Resend emails with branded templates
9. Improved payment approved email (SPOT ID, plan, expiry)
10. Built welcome email
11. Built badge submission acknowledgement email
12. Built trial expiry warning email (pg_cron, daily 8am Lagos — **not yet tested end-to-end**)
13. Built subscription expiry warning email (pg_cron, daily 8am Lagos — **not yet tested end-to-end**)
14. Fixed Resend custom click tracking subdomain (track.mail.spotlightdirectories.com)
15. Built partner application received email
16. Built partner account created email
17. Built badge revocation notification email
18. Fixed bank transfer receipt upload RLS
19. Fixed admin session conflict (dedicated storage key `spotlight-admin-session`)
20. Fixed badge approval RLS policy
21. Fixed badge form flicker bug
22. Built badge revocation feature (super_admin action)
23. Added duplicate-submission prevention for verification
24. Added loading feedback to admin action buttons
25. Built dev-reset-vendor.sql and dev-reset-partner.sql

## ACHIEVED — Block 4, Backend hardening

26. Built validate-upload Edge Function — JWT auth, magic-byte type detection, size/resolution checks, resize + JPEG re-encode (flattened onto white background), PDF passthrough, graceful decode-failure fallback for categories with no minimum resolution
27. Locked storage buckets (vendor-gallery/vendor-branding/vendor-verifications/payment-receipts) to service-role-only writes; vendor-videos deliberately untouched (not routed through validate-upload)
28. Consolidated all 7 duplicate upload handlers into shared `uploadVendorFile()` in upload-utils.js
29. Built server-side plan limits via extended `get_vendor_plan_limits()` (products/services/social links/branches/gallery/video)
30. Built admin staff onboarding — full invitation system, no vendor profile created, self-claim on first login, revoke-with-account-cleanup, permanent append-only audit log (admin_audit_log)
31. Built OTP-based email change — single code sent to new email only, applies via Admin API directly, bypassing Supabase's own unreliable built-in confirmation
32. Fixed infinite recursion bug (Postgres 42P17) in all 5 plan-limit RLS policies
33. Fixed missing vendor_name field that silently broke every new product save
34. Fixed Canva-exported images failing to decode (graceful fallback added)
35. Fixed transparent images turning solid black after JPEG conversion
36. Fixed admin session-hijack bug (creating a new admin account silently logged out whoever else was logged in)
37. Fixed payment.js crashing silently for any vendor with no profile row yet, which broke all payment buttons
38. Fixed Paystack false "payment failed" alarm (webhook had already succeeded; a secondary client-side check failed for an unrelated reason)
39. Fixed "Manage Branches" incorrectly showing for Standard plan (not entitled to any branches)
40. Removed dead/unreachable gallery-upload code from vendor-profile.js

**Migrations from Block 4:**
20260710_extend_plan_limits_and_fix_bugs.sql, 20260710_admin_staff_invitations.sql, 20260710_staff_visibility_and_audit_log.sql, 20260710_fix_audit_log_actor_fk.sql, 20260710_email_change_otp.sql, 20260711_lock_storage_buckets_service_role_only.sql, 20260711_fix_plan_limit_infinite_recursion.sql

**Upload specs (item 26):** product/service images JPG/PNG/WEBP ≤2MB, 800×800px min, resized to 1600px; gallery ≤750KB to 1200px; cover/logo ≤1MB to 1200px; verification docs/bank receipts JPG/PNG/PDF only (no WEBP), 300KB per file; videos MP4 only, 720p max, one per vendor regardless of plan, tiered size/duration limits by plan.

**Lesson from items 32–39:** always test end-to-end after DB/RLS changes, not just verify the policy exists — several of these bugs were dormant because a feature was never actually exercised live before.

---

## ACHIEVED — Block 5, item 42

- [x] 42. Rebuild GetListed page — DONE. Redesigned around "how many locations does your business have" (solo shop → nationwide chain). Each card has a standalone feature summary instead of just "everything in X"; a 5-dot "scale meter" signature element shows location-count progression across all 5 cards; compare table restyled with brand colors and a highlighted recommended column; footer replicated exactly from the old page. Built as separate files first, tested live through several rounds of feedback, then promoted to the real filenames (getlisted.html/css/js). Old version archived as getlisted-legacy.html/js, not deleted.

**Note:** item 42's original scope also included folding in the missing plan-limit/90-day-trial public display — this was overlooked during the rebuild and should be added as a follow-up polish item.

## ACHIEVED — Block 5, item 41

- [x] 41. Rebuild landing page — DONE. Hero consolidated the two previously-redundant slideshows into one purposeful carousel (archetype captions per photo, Ken Burns slow-zoom effect, glowing/shimmering treatment on the word "Spotlight"); benefits trimmed and rebalanced to 6 cards in a clean 3-and-3 grid; second slideshow replaced entirely with an honest "How It Works" 3-step section; fake "smart scheduling" claim removed and replaced with the real, universal Business Insight Dashboard; mobile app section kept but honestly reframed as "Coming Soon" with no fake clickable store badges. Fixed several real bugs along the way: broken footer "Search Vendors" link, inconsistent link capitalization, dead signup.js script tag, missing auth Log in/Log out button, wrong hamburger-menu class name, undefined --gold CSS variable breaking the login button's hover. Built as separate files first, tested live through several rounds of feedback, then promoted to the real filenames (index.html/css/js). Old version archived as index-legacy.html, not deleted.

## PENDING — Block 5, remaining page rebuilds

- [ ] 43. Harmonize partner program page + build marketing assets (referral toolkit, brand guide, earning calculator, onboarding guide)
- [ ] 44. Consolidate insight dashboard — fold in building the sponsorship feature for real (currently hardcoded, no logic)
- [ ] 45. Build light/dark mode toggle switch + JS wiring (tokens already exist from item 6)
- [ ] 46. Fix Manage Payment Method button (non-functional)
- [ ] 47. Fix Manage Branches button action (non-functional — separate from the plan-visibility fix already done in item 39)
- [ ] 48. Fix billing history inconsistency (old confirmed payments showing even when vendor is on free plan)
- [ ] 49. Fix next-payment amount/date display logic
- [ ] 50. Add state/lga columns to branches table + branch form (not all branches share the parent vendor's state/lga)
- [ ] 51. Build real distance-based ("near me") search, platform-wide — the GPS toggle exists in discover.html UI but is never actually applied in any search query today, for any result type
- [ ] 52. Build `searchBranches()` in discover-results.js, following the same pattern as existing searchProducts()/searchServices() — each branch becomes its own result, inheriting name/category/subcategory/verification/rating/logo/cover/about/social links/hours from its parent vendor, using its own address/phone/WhatsApp/coordinates/state/lga
- [ ] 53. Build a swappable branch view in vendor-profile.html (same page, branch's own contact/location swapped in via URL param) — a branch result needs its own Call/WhatsApp/Directions buttons since the whole point is that specific location's contact info, not the HQ's

## PENDING — Block 6, Advanced features

- [ ] 54. Build visitor authentication system
- [ ] 55. Upgrade vendor_reviews INSERT policy to require visitor login (depends on item 54)
- [ ] 56. Build Claude API integration — first features (vendor description assistant, visitor search assistant, admin anomaly flagging)
- [x] 57. Test trial/subscription expiry emails (items 12–13) end-to-end using dev-reset scripts — DONE (July 2026). Both halves tested and confirmed working: trial expiry email uncovered and fixed two real bugs (trial_started_at never set at signup; send-expiry-warnings querying a subscription_status value that never existed); subscription expiry email worked correctly on first test, no code bugs found.

## PENDING — Block 7, Framework migration (final block)

- [ ] 58. Migrate entire platform to Next.js
- [ ] 59. Organize CSS (style.css + style2.css) using Next.js's own conventions, as part of item 58 — not merged beforehand, since Next.js's real structure (global stylesheet + component-scoped styles) would make a pre-merge get redone anyway
- [ ] 60. Organize JS (script.js + script2.js) into React components/hooks, as part of item 58, same reasoning

---

## Reference — sponsorship design (relevant to item 44)
Entry point via Business Insight dashboard sponsorship card with orange
upgrade CTA. Three types: Business, Product, Service sponsor. Bundle
incentive for multi-product sponsorship. Final naira pricing is Cyril's
call.

## Reference — deprecated, exclude from all audits and coding
`vendor_products_new` table, original `insight.js` (hardcoded data,
replaced by the renamed insight.js), `onboarding.html`/`onboarding.js`,
`send-email-resend` Edge Function.
