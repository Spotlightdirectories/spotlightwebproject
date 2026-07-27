@AGENTS.md

## Vendor Dashboard migration — known gaps (not yet connected)

Tracked here so they aren't forgotten across sessions. Update this
list as each item gets built.

- **"Manage Branches" button** (Subscription tab) — navigates to
  `/dashboard-branches`, but that route doesn't exist yet in this
  Next.js app. Production equivalent: `dashboard-branches.html`.
- **"Sponsor Your Business" button** (Subscription tab) — navigates
  to `/getsponsored`, but that route doesn't exist yet either.
  Production equivalent: `getsponsored.html`.
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
