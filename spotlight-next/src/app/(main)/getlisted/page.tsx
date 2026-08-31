"use client";

// ===============================================================
// src/app/(main)/getlisted/page.tsx
//
// Ported faithfully from getListed.html + getlisted.js.
//
// Flow:
// 1. User picks a plan (free/standard/enterprise/elite/custom)
// 2. Billing toggle switches monthly/yearly prices
// 3. On button click:
//    - Saves plan + billing to localStorage
//    - If already logged in → redirect to /payment
//    - If not logged in → redirect to /signup
//
// PLAN AWARENESS (new — not in production):
// getlisted is also the public marketing/pricing page (anonymous
// visitors, referral links), so it deliberately does NOT fetch or
// branch on vendor state by default — that would slow down and
// complicate the page for the majority of its traffic, who aren't
// vendors deciding between plans at all.
//
// The one exception: the dashboard's own "Upgrade Plan" / "Compare
// Plans" buttons link here with ?context=upgrade. Only in that
// case do we fetch the logged-in vendor's current plan_tier and
// subscription_status, so someone who came here specifically to
// change their plan can see which card is theirs, which options are
// upgrades vs. downgrades, and — for a downgrade — an explicit
// confirmation of what they'd lose before we send them onward. This
// is a UX layer only; the actual enforcement (can't re-buy an active
// plan, mid-cycle-upgrade disclaimer, etc.) still lives downstream
// on the payment page, same as production.
// ===============================================================

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Footer from "@/components/Footer";
import styles from "./getlisted.module.css";

const PLANS = [
  {
    id: "free",
    name: "Basic",
    for: "For solo artisans & traders",
    monthlyPrice: "₦0",
    yearlyPrice: "₦0",
    yearlyNote: "Free to start — no card needed",
    badge: "90-Day Free Trial",
    badgeTrial: true,
    cardTrial: true,
    btnClass: "trial",
    btnText: "Start Free Trial",
    micro: "No credit card · Takes 5 minutes",
    filledDots: 1,
    locationLabel: "1 location",
    everythingLabel: "Your first 90 days include:",
    features: [
      "List up to 5 products or services (2 after your 90-day trial)",
      "Mini web page for products & services",
      "1 social media handle",
      "Photo gallery — 3 images",
      "Clickable WhatsApp number",
      "Google Map & Directions",
      "Eligible for a verification badge",
      "Up to 50-word description",
    ],
    trialNote: "After 90 days, your listing stays free with core features — upgrade anytime to keep the extras.",
  },
  {
    id: "standard",
    name: "Standard",
    for: "For professionals & small businesses",
    monthlyPrice: "₦2,998",
    yearlyPrice: "₦26,982",
    yearlyNote: "Billed yearly, save 25%",
    badge: "Most popular",
    cardHighlight: true,
    btnClass: "dark",
    btnText: "Choose Standard",
    filledDots: 1,
    locationLabel: "1 location",
    everythingLabel: "Everything in Basic, plus:",
    features: [
      "List up to 25 products or services",
      "Profile photo, cover image & logo",
      "Photo gallery — 10 images",
      "Business video — up to 30 seconds",
      "2 social media handles",
      "Up to 100-word description",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    for: "For growing chains",
    monthlyPrice: "₦12,600",
    yearlyPrice: "₦113,400",
    yearlyNote: "Billed yearly, save 25%",
    btnClass: "dark",
    btnText: "Choose Enterprise",
    filledDots: 3,
    locationLabel: "Up to 10 locations",
    everythingLabel: "Everything in Standard, plus:",
    features: [
      "List up to 50 products or services",
      "Up to 10 business branches",
      "Own address & WhatsApp number per branch",
      "Photo gallery — 20 images",
      "Business video — up to 60 seconds",
      "3 social media handles",
      "Up to 150-word description",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    for: "For nationwide brands",
    monthlyPrice: "₦22,400",
    yearlyPrice: "₦201,600",
    yearlyNote: "Billed yearly, save 25%",
    btnClass: "dark",
    btnText: "Choose Elite",
    filledDots: 4,
    locationLabel: "Up to 30 locations",
    everythingLabel: "Everything in Enterprise, plus:",
    features: [
      "List up to 100 products or services",
      "Up to 30 business branches",
      "Photo gallery — 30 images",
      "Business video — up to 90 seconds",
      "5 social media handles",
      "Priority+ support",
      "Up to 200-word description",
    ],
  },
  {
    id: "custom",
    name: "Custom",
    for: "For large enterprises",
    monthlyPrice: "Let's talk",
    yearlyPrice: "Let's talk",
    yearlyNote: "Tailored to your business",
    cardDark: true,
    btnClass: "white",
    btnText: "Go Unlimited",
    btnHref: "/contact-us",
    filledDots: 5,
    locationLabel: "Unlimited locations",
    everythingLabel: "Everything in Elite, plus:",
    features: [
      "Unlimited products or services",
      "Unlimited business branches",
      "Unlimited social media handles",
      "Up to 250-word description",
      "Special dedicated support",
    ],
  },
];

const COMPARE_ROWS = [
  { label: "Business name", values: ["1", "1", "1", "1", "1"] },
  { label: "Business address", values: ["1", "1", "Up to 10", "Up to 30", "Unlimited"] },
  { label: "Click-to-call & WhatsApp", values: ["1 number", "1 number", "Up to 10", "Up to 30", "Unlimited"] },
  { label: "Products & services you can list", values: ["5(2)", "25", "50", "100", "Unlimited"] },
  { label: "Business category", values: ["✓", "✓", "Same for all branches", "Same for all branches", "Same for all branches"] },
  { label: "Mini web page for goods & services", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Business description", values: ["50 words", "100 words", "150 words", "200 words", "250 words"] },
  { label: "Update profile anytime", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Logo & cover image", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Business video", values: ["✗", "✓", "✓", "✓", "✓"] },
  { label: "Video duration", values: ["—", "30 sec", "60 sec", "90 sec", "120 sec"] },
  { label: "Social media handles", values: ["✗", "2", "3", "5", "Unlimited"] },
  { label: "Business Insight Dashboard", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Google Map & Directions", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Photo gallery", values: ["3 images", "10 images", "20 images", "30 images", "Custom"] },
  { label: "Support level", values: ["Standard", "Standard", "Priority", "Priority+", "Dedicated"] },
  { label: "Eligible for verification badge", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Registered & unregistered businesses welcome", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Close your account anytime", values: ["✓", "✓", "✓", "✓", "✓"] },
];

// Lowest to highest — used only to work out whether a given plan is
// an upgrade or a downgrade relative to the vendor's current one.
const PLAN_ORDER = ["free", "standard", "enterprise", "elite", "custom"];
const PAID_PLANS = ["standard", "enterprise", "elite", "custom"];

type PlanRelation = "current" | "upgrade" | "downgrade" | null;

export default function GetListedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [yearly, setYearly] = useState(true);

  // ---------------------------------------------------------------
  // PLAN AWARENESS — only populated when a logged-in vendor arrives
  // via ?context=upgrade (see the module comment above). Everyone
  // else sees the page exactly as before: currentPlanId stays null,
  // so getPlanRelation() returns null for every card and nothing
  // about the page changes.
  // ---------------------------------------------------------------
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [currentPlanActivePaid, setCurrentPlanActivePaid] = useState(false);

  // Default-Free-tier-only view, 2026-08 per Cyril: a first-time,
  // anonymous visitor sees ONLY the free plan by default. The full
  // grid is reachable only via the existing ?context=upgrade link.
  const isUpgradeContext = searchParams.get("context") === "upgrade";
  const showFullGrid = isUpgradeContext;
  const visiblePlans = showFullGrid ? PLANS : PLANS.filter((p) => p.id === "free");

  useEffect(() => {
    if (searchParams.get("context") !== "upgrade") return;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // An existing vendor's session lapsed (e.g. an old "upgrade
        // your plan" email link clicked after logging out). Sending
        // them to /login instead of silently rendering the plain
        // first-time pricing page avoids the confusing follow-up
        // where clicking a paid plan would otherwise route them to
        // /signup (creating a second account) instead of /payment.
        router.replace("/login");
        return;
      }

      const { data: vendor } = await supabase
        .from("vendors")
        .select("plan_tier, subscription_status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!vendor) return;

      const planTier = vendor.plan_tier || "free";
      setCurrentPlanId(planTier);
      setCurrentPlanActivePaid(
        PAID_PLANS.includes(planTier) && vendor.subscription_status === "active"
      );
    })();
  }, [searchParams]);

  function getPlanRelation(planId: string): PlanRelation {
    if (!currentPlanId) return null;
    if (planId === currentPlanId) return "current";
    return PLAN_ORDER.indexOf(planId) > PLAN_ORDER.indexOf(currentPlanId) ? "upgrade" : "downgrade";
  }

  // Capture referral code on load
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    async function checkRef() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: vendor } = await supabase
          .from("vendors").select("id").eq("auth_user_id", user.id).maybeSingle();
        if (vendor) return; // already listed
      }
      // Non-null: the early `if (!ref) return;` above guarantees this,
      // but TS doesn't narrow across the nested function boundary.
      localStorage.setItem("referral_code", ref!);
    }
    checkRef();
  }, [searchParams]);

  async function handlePlanClick(planId: string) {
    if (planId === "custom") {
      router.push("/contact-us");
      return;
    }

    // Plan awareness: a vendor actively downgrading gets an explicit
    // heads-up about what they'd lose before we send them onward —
    // this is the one place we interrupt the flow, since it's the
    // one outcome that isn't obvious from the pricing cards alone.
    if (getPlanRelation(planId) === "downgrade") {
      const currentName = PLANS.find((p) => p.id === currentPlanId)?.name || "current";
      const targetName = PLANS.find((p) => p.id === planId)?.name || planId;

      const confirmed = window.confirm(
        `You're currently on the ${currentName} plan. Switching to ${targetName} is a downgrade — you may lose access to things only available on your current plan, such as extra branches, gallery images, social links, or a longer business description. Any existing content beyond ${targetName}'s limits may be hidden or restricted until you upgrade again.\n\nContinue with the downgrade?`
      );

      if (!confirmed) return;
    }

    localStorage.setItem("selectedPlan", planId);
    localStorage.setItem("billingType", yearly ? "yearly" : "monthly");

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      router.push("/payment");
    } else {
      router.push("/signup");
    }
  }

  function getPrice(plan: typeof PLANS[0]) {
    if (plan.id === "custom") return "Let's talk";
    return yearly ? plan.yearlyPrice : plan.monthlyPrice;
  }

  return (
    <>
      <main>
        {/* HERO */}
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Pricing built around how your business actually grows</p>
          <h1>One listing. As many locations as you need.</h1>
          <p className={styles.heroSub}>From a small shop to a nationwide chain — pick the plan that matches how many places your business shows up.</p>

          <div className={styles.trialBanner}>
            <i className="fa-solid fa-bolt"></i>
            Every business starts with a <strong>90-day free trial</strong> — no card required, live in minutes.
          </div>

          <div className={styles.toggleContainer}>
            <span>Monthly</span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={yearly}
                onChange={() => setYearly(v => !v)}
              />
              <span className={`${styles.slider} ${styles.round}`}></span>
            </label>
            <span>Yearly <span className={styles.saveTag}>save 25%</span></span>
          </div>
        </section>

        {/* PRICING CARDS */}
        <section className={`${styles.pricingGrid} ${visiblePlans.length === 1 ? styles.pricingGridSingle : ""}`}>
          {visiblePlans.map(plan => {
            const relation = getPlanRelation(plan.id);
            return (
            <article
              key={plan.id}
              className={[
                styles.card,
                plan.cardHighlight ? styles.cardHighlight : "",
                plan.cardDark ? styles.cardDark : "",
                plan.cardTrial ? styles.cardTrial : "",
                relation === "current" ? styles.currentPlanCard : "",
              ].filter(Boolean).join(" ")}
            >
              {relation === "current" ? (
                <div className={`${styles.badge} ${styles.currentPlanBadge}`}>Your Current Plan</div>
              ) : (
                plan.badge && (
                  <div className={`${styles.badge} ${plan.badgeTrial ? styles.badgeTrial : ""}`}>
                    {plan.badge}
                  </div>
                )
              )}

              <div className={styles.cardTop}>
                <h2>{plan.name}</h2>
                <p className={styles.for}>{plan.for}</p>
                {relation && relation !== "current" && (
                  <p className={styles.currentPlanNote} style={{ color: relation === "downgrade" ? "var(--color-warning)" : "var(--color-success)" }}>
                    {relation === "upgrade" ? "Upgrade from your current plan" : "Downgrade from your current plan"}
                  </p>
                )}
              </div>

              <p className={`${styles.price} ${plan.id === "custom" ? styles.letsTalk : ""}`}>
                {getPrice(plan)}
              </p>
              <p className={`${styles.yearlyNote} ${!yearly && plan.id !== "custom" ? styles.hidden : ""}`}>
                {plan.yearlyNote}
              </p>

              {/* SCALE METER */}
              <div className={styles.scaleMeter}>
                <div className={styles.scaleDots}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} className={`${styles.dot} ${i <= plan.filledDots ? styles.filled : ""}`} />
                  ))}
                </div>
                <p className={styles.scaleLabel}>
                  <i className={plan.id === "custom" ? "fa-solid fa-infinity" : "fa-solid fa-location-dot"}></i>
                  {" "}{plan.locationLabel}
                </p>
              </div>

              <p className={styles.everything}>{plan.everythingLabel}</p>

              <ul className={styles.featureList}>
                {plan.features.map((f, i) => <li key={i}>{f}</li>)}
              </ul>

              {plan.trialNote && <p className={styles.trialNote}>{plan.trialNote}</p>}

              {relation === "current" ? (
                <button type="button" className={`${styles.btn} ${styles.btnCurrent}`} disabled>
                  Your Current Plan
                </button>
              ) : plan.btnHref ? (
                <a href={plan.btnHref} className={`${styles.btn} ${styles[`btn${plan.btnClass.charAt(0).toUpperCase() + plan.btnClass.slice(1)}`]}`}>
                  {plan.btnText}
                </a>
              ) : (
                <button
                  type="button"
                  className={`${styles.btn} ${styles[`btn${plan.btnClass.charAt(0).toUpperCase() + plan.btnClass.slice(1)}`]}`}
                  onClick={() => handlePlanClick(plan.id)}
                >
                  {relation === "upgrade"
                    ? `Upgrade to ${plan.name}`
                    : relation === "downgrade"
                    ? `Downgrade to ${plan.name}`
                    : plan.btnText}
                </button>
              )}

              {relation === "upgrade" && currentPlanActivePaid && plan.id !== "free" && (
                <p className={styles.upgradeNote}>Switching plans starts a new billing cycle.</p>
              )}

              {relation === "downgrade" && (
                <p className={styles.downgradeNote}>You may lose features only available on your current plan.</p>
              )}

              {plan.micro && <p className={styles.microTrust}>{plan.micro}</p>}
            </article>
          );})}
        </section>

        <p className={styles.trustNote}>
          <i className="fa-solid fa-shield-halved"></i> Cancel or change your plan anytime from your dashboard.
        </p>

        {/* COMPARE TABLE -- only meaningful with more than one plan
            visible, so it's hidden in the default Free-only view. */}
        {showFullGrid && (
        <section className={styles.compare}>
          <h2>Compare every feature, plan by plan</h2>
          <div className={styles.compareScroll}>
            <div className={styles.compareTable}>

              {/* HEADER */}
              <div className={styles.compareHeader}>
                <div className={styles.featureCol}></div>
                {PLANS.map((plan, i) => {
                  const relation = getPlanRelation(plan.id);
                  return (
                  <div key={plan.id} className={`${styles.planCol} ${plan.cardHighlight ? styles.planColHighlight : ""}`}>
                    {relation === "current" ? (
                      <span className={`${styles.colBadge} ${styles.currentPlanBadge}`}>Your Plan</span>
                    ) : (
                      plan.cardHighlight && <span className={styles.colBadge}>Most popular</span>
                    )}
                    <h3>{plan.name}</h3>
                    {relation === "current" ? (
                      <button type="button" className={`${styles.planBtn} ${styles.planBtnCurrent}`} disabled>
                        Current Plan
                      </button>
                    ) : plan.btnHref ? (
                      <a href={plan.btnHref} className={styles.planBtn}>Go Unlimited</a>
                    ) : (
                      <button type="button" className={styles.planBtn} onClick={() => handlePlanClick(plan.id)}>
                        {relation === "upgrade" ? "Upgrade" : relation === "downgrade" ? "Downgrade" : plan.id === "free" ? "Get Started" : "Choose Plan"}
                      </button>
                    )}
                  </div>
                  );})}
              </div>

              {/* ROWS */}
              <div className={styles.compareBody}>
                {COMPARE_ROWS.map((row, i) => (
                  <div key={i} className={styles.row}>
                    <div className={styles.featureName}>{row.label}</div>
                    {row.values.map((val, j) => (
                      <div key={j} className={`${PLANS[j]?.cardHighlight ? styles.colHighlight : ""}`}>
                        {val === "✓" ? <i className="fa-solid fa-check" style={{ color: "var(--color-success)" }}></i>
                          : val === "✗" ? <i className="fa-solid fa-xmark" style={{ color: "var(--color-text-faint)" }}></i>
                          : val}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        )}
      </main>
      <Footer />
    </>
  );
}
