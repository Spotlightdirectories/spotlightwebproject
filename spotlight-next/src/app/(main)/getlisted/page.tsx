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
      "List up to 3 products or services",
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
      "Mini web page for products & services",
      "Profile photo, cover image & logo",
      "Photo gallery — 6 images",
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
      "Up to 10 business branches",
      "Own address & WhatsApp number per branch",
      "Photo gallery — 12 images",
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
      "Up to 30 business branches",
      "Photo gallery — 24 images",
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
  { label: "Products & services you can list", values: ["Up to 3 (trial), then 1", "6", "12", "24", "Unlimited"] },
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
  { label: "Photo gallery", values: ["1 image", "6 images", "12 images", "24 images", "Custom"] },
  { label: "Support level", values: ["Standard", "Standard", "Priority", "Priority+", "Dedicated"] },
  { label: "Eligible for verification badge", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Registered & unregistered businesses welcome", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Close your account anytime", values: ["✓", "✓", "✓", "✓", "✓"] },
];

export default function GetListedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [yearly, setYearly] = useState(true);

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
      localStorage.setItem("referral_code", ref);
    }
    checkRef();
  }, [searchParams]);

  async function handlePlanClick(planId: string) {
    if (planId === "custom") {
      router.push("/contact-us");
      return;
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
        <section className={styles.pricingGrid}>
          {PLANS.map(plan => (
            <article
              key={plan.id}
              className={[
                styles.card,
                plan.cardHighlight ? styles.cardHighlight : "",
                plan.cardDark ? styles.cardDark : "",
                plan.cardTrial ? styles.cardTrial : "",
              ].filter(Boolean).join(" ")}
            >
              {plan.badge && (
                <div className={`${styles.badge} ${plan.badgeTrial ? styles.badgeTrial : ""}`}>
                  {plan.badge}
                </div>
              )}

              <div className={styles.cardTop}>
                <h2>{plan.name}</h2>
                <p className={styles.for}>{plan.for}</p>
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

              {plan.btnHref ? (
                <a href={plan.btnHref} className={`${styles.btn} ${styles[`btn${plan.btnClass.charAt(0).toUpperCase() + plan.btnClass.slice(1)}`]}`}>
                  {plan.btnText}
                </a>
              ) : (
                <button
                  type="button"
                  className={`${styles.btn} ${styles[`btn${plan.btnClass.charAt(0).toUpperCase() + plan.btnClass.slice(1)}`]}`}
                  onClick={() => handlePlanClick(plan.id)}
                >
                  {plan.btnText}
                </button>
              )}

              {plan.micro && <p className={styles.microTrust}>{plan.micro}</p>}
            </article>
          ))}
        </section>

        <p className={styles.trustNote}>
          <i className="fa-solid fa-shield-halved"></i> Cancel or change your plan anytime from your dashboard.
        </p>

        {/* COMPARE TABLE */}
        <section className={styles.compare}>
          <h2>Compare every feature, plan by plan</h2>
          <div className={styles.compareScroll}>
            <div className={styles.compareTable}>

              {/* HEADER */}
              <div className={styles.compareHeader}>
                <div className={styles.featureCol}></div>
                {PLANS.map((plan, i) => (
                  <div key={plan.id} className={`${styles.planCol} ${plan.cardHighlight ? styles.planColHighlight : ""}`}>
                    {plan.cardHighlight && <span className={styles.colBadge}>Most popular</span>}
                    <h3>{plan.name}</h3>
                    {plan.btnHref ? (
                      <a href={plan.btnHref} className={styles.planBtn}>Go Unlimited</a>
                    ) : (
                      <button type="button" className={styles.planBtn} onClick={() => handlePlanClick(plan.id)}>
                        {plan.id === "free" ? "Get Started" : "Choose Plan"}
                      </button>
                    )}
                  </div>
                ))}
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
      </main>
      <Footer />
    </>
  );
}
