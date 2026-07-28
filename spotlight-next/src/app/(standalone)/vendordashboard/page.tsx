"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/page.tsx
//
// Vendor Dashboard — MODULE 1: shell + navigation tabs + Overview
// + email verification.
//
// Faithful port of production vendordashboard.html + vendordashboard.js.
// Later modules fill in: Profile editing, Products, Services,
// Subscription/billing, Verification, Settings. Those sections are
// present here as stubs so tab switching works end to end.
// ===============================================================

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProfileTab from "./ProfileTab";
import ProductsTab from "./ProductsTab";
import PortfolioTab from "./PortfolioTab";
import SubscriptionTab from "./SubscriptionTab";
import VerificationTab from "./VerificationTab";
import SettingsTab from "./SettingsTab";

export type Vendor = {
  id: string;
  name: string | null;
  email: string | null;
  spot_id: string | null;
  slug: string | null;
  plan_tier: string | null;
  billing_cycle: string | null;
  business_type: string | null;
  logo_url: string | null;
  email_verified: boolean | null;
  category: string | null;
  subcategory: string | null;
  address: string | null;
  description: string | null;
  whatsapp: string | null;
  telephone: string | null;
  latitude: number | null;
  longitude: number | null;
  trial_started_at: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  state: string | null;
  lga: string | null;
  open_time: string | null;
  close_time: string | null;
  business_days: string | null;
  subscription_status: string | null;
  expires_at: string | null;
  verification_status: string | null;
  account_status: string | null;
  scheduled_deletion_at: string | null;
  email_notifications_enabled: boolean | null;
  lead_alerts_enabled: boolean | null;
  [key: string]: unknown;
};

type TabKey =
  | "overview"
  | "profile"
  | "products"
  | "services"
  | "portfolio"
  | "subscription"
  | "verification"
  | "settings";

const TAB_TITLES: Record<TabKey, string> = {
  overview: "Overview",
  profile: "Profile",
  products: "Products",
  services: "Services",
  portfolio: "Portfolio",
  subscription: "Subscription",
  verification: "Verification",
  settings: "Settings",
};

export default function VendorDashboardPage() {
  const router = useRouter();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Overview-derived state
  const [mediaCount, setMediaCount] = useState(0);
  const [socialCount, setSocialCount] = useState(0);

  // Email verification button state
  const [verifyState, setVerifyState] = useState<"idle" | "sending" | "sent" | "retry">("idle");

  // Trial countdown
  const [trialText, setTrialText] = useState<{ days: string; time: string; ended: boolean } | null>(null);

  // ---------------------------------------------------------------
  // AUTH GUARD + FETCH VENDOR
  // ---------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: v, error: vendorError } = await supabase
        .from("vendors")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (vendorError || !v) {
        router.replace("/login");
        return;
      }

      if (!v.business_type) {
        router.replace("/business-type");
        return;
      }

      setVendor(v as Vendor);

      // Media + social counts for the profile checklist
      const [{ count: mCount }, { count: sCount }] = await Promise.all([
        supabase.from("vendor_media").select("*", { count: "exact", head: true }).eq("vendor_id", v.id),
        supabase.from("vendor_social_links").select("*", { count: "exact", head: true }).eq("vendor_id", v.id),
      ]);

      setMediaCount(mCount || 0);
      setSocialCount(sCount || 0);
      setLoading(false);
    }
    load();
  }, [router]);

  // ---------------------------------------------------------------
  // TRIAL COUNTDOWN (free plan only, 90 days from trial_started_at)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!vendor) return;
    if (vendor.plan_tier !== "free" || !vendor.trial_started_at) return;

    const start = new Date(vendor.trial_started_at);
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + 90);

    function tick() {
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setTrialText({
          days: "Your trial has ended",
          time: "Upgrade to keep your extra products, services, gallery photos and social link.",
          ended: true,
        });
        return false;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);

      setTrialText({
        days: `${days} Days Left`,
        time: `${hours}h ${mins}m ${secs}s remaining`,
        ended: false,
      });
      return true;
    }

    tick();
    const interval = setInterval(() => {
      const stillRunning = tick();
      if (!stillRunning) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [vendor]);

  // ---------------------------------------------------------------
  // CLOSE DROPDOWN ON OUTSIDE CLICK
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!dropdownOpen) return;
    const close = () => setDropdownOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [dropdownOpen]);

  // ---------------------------------------------------------------
  // EMAIL VERIFICATION
  // ---------------------------------------------------------------
  const handleVerifyEmail = useCallback(async () => {
    if (!vendor) return;
    setVerifyState("sending");
    try {
      const { error } = await supabase.functions.invoke("swift-task", {
        body: { vendorId: vendor.id, email: vendor.email },
      });
      if (error) {
        setVerifyState("retry");
        return;
      }
      setVerifyState("sent");
    } catch {
      setVerifyState("retry");
    }
  }, [vendor]);

  // ---------------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------------
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ---------------------------------------------------------------
  // TAB SWITCH
  // ---------------------------------------------------------------
  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    if (typeof window !== "undefined" && window.innerWidth <= 900) setMobileSidebarOpen(false);
  }

  if (loading || !vendor) {
    return (
      <div className="vd-dashboard-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#64748b" }}>Loading dashboard...</p>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // DERIVED OVERVIEW VALUES
  // ---------------------------------------------------------------
  const businessType = vendor.business_type;
  const showProducts = businessType === "product" || businessType === "hybrid";
  const showServices = businessType === "service" || businessType === "hybrid";
  // Same audience as Services (Cyril: "only for Service businesses or
  // hybrid") — kept as its own variable rather than reusing
  // showServices directly, since the two happen to match today but
  // represent different concepts (what you sell vs. your work history).
  const showPortfolio = businessType === "service" || businessType === "hybrid";

  const emailVerified = vendor.email_verified === true;

  const hasBasic = !!(vendor.name && vendor.email);
  const hasDetails = !!(vendor.address && vendor.description);
  const hasCategory = !!(vendor.category && vendor.subcategory);
  const hasContact = !!(vendor.whatsapp && vendor.telephone);
  const hasLocation = !!(vendor.latitude && vendor.longitude);
  const hasMedia = mediaCount > 0;
  const hasSocial = socialCount > 0;

  let score = 0;
  const total = 8;
  if (hasBasic) score++;
  if (hasDetails) score++;
  if (hasCategory) score++;
  if (hasContact) score++;
  if (hasLocation) score++;
  if (emailVerified) score++;
  if (hasMedia) score++;
  if (hasSocial) score++;

  const percent = Math.round((score / total) * 100);
  const complete = percent === 100;

  const checklistItems = [
    { label: "Business name & email", ok: hasBasic },
    { label: "Address & description", ok: hasDetails },
    { label: "Category & subcategory", ok: hasCategory },
    { label: "WhatsApp & telephone", ok: hasContact },
    { label: "Business location (map)", ok: hasLocation },
    { label: "Email verified", ok: emailVerified },
    { label: "Add at least 1 media", ok: hasMedia },
    { label: "Add at least 1 social link", ok: hasSocial },
  ];

  const fallbackLetter = vendor.name ? vendor.name.charAt(0) : "S";

  const verifyLabel =
    verifyState === "sending" ? "Sending..." :
    verifyState === "sent" ? "Email Sent" :
    verifyState === "retry" ? "Try Again" :
    "Verify Email";

  // ?context=upgrade tells the getlisted page to fetch this vendor's
  // current plan and show upgrade/downgrade awareness on each card
  // instead of the plain anonymous pricing page — see getlisted's
  // page.tsx module comment for the full reasoning.
  const upgrade = () => { window.location.href = "/getlisted?context=upgrade"; };

  const sec = (tab: TabKey) => `vd-section${activeTab === tab ? " active" : ""}`;

  return (
    <div className="vd-dashboard-root">

      {/* SIDEBAR */}
      <aside className={`vd-sidebar${mobileSidebarOpen ? " active" : ""}`}>
        <div className="vd-sidebar-inner">
          <a href="/" className="vd-logo-link">
            <div className="vd-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/spotlightlogo-512.png" alt="Spotlight" className="vd-logo-icon" />
              <span className="vd-logo-text">Spotlight</span>
            </div>
          </a>

          <div className="vd-nav-wrapper">
            <nav className="vd-nav">
              <button className={`vd-nav-item${activeTab === "overview" ? " active" : ""}`} onClick={() => switchTab("overview")}>
                <i className="fa-regular fa-square"></i><span>Overview</span>
              </button>
              <button className={`vd-nav-item${activeTab === "profile" ? " active" : ""}`} onClick={() => switchTab("profile")}>
                <i className="fa-regular fa-user"></i><span>Profile</span>
              </button>
              {showProducts && (
                <button className={`vd-nav-item${activeTab === "products" ? " active" : ""}`} onClick={() => switchTab("products")}>
                  <i className="fa-solid fa-box"></i><span>Products</span>
                </button>
              )}
              {showServices && (
                <button className={`vd-nav-item${activeTab === "services" ? " active" : ""}`} onClick={() => switchTab("services")}>
                  <i className="fa-solid fa-briefcase"></i><span>Services</span>
                </button>
              )}
              {showPortfolio && (
                <button className={`vd-nav-item${activeTab === "portfolio" ? " active" : ""}`} onClick={() => switchTab("portfolio")}>
                  <i className="fa-solid fa-layer-group"></i><span>Portfolio</span>
                </button>
              )}
              <button
                id="mediaSidebarLink"
                className="vd-nav-item"
                onClick={() => { if (vendor.slug) window.location.href = `/vendor/${vendor.slug}`; }}
              >
                <i className="fa-regular fa-image"></i><span>Media</span>
              </button>
              <button className={`vd-nav-item${activeTab === "subscription" ? " active" : ""}`} onClick={() => switchTab("subscription")}>
                <i className="fa-regular fa-credit-card"></i><span>Subscription</span>
              </button>
              <button className={`vd-nav-item${activeTab === "verification" ? " active" : ""}`} onClick={() => switchTab("verification")}>
                <i className="fa-regular fa-circle-check"></i><span>Verification</span>
              </button>
              <button className="vd-nav-item" onClick={() => { window.location.href = "/insight"; }}>
                <i className="fa-solid fa-chart-line"></i><span>Business Insights</span>
              </button>
              <button className={`vd-nav-item${activeTab === "settings" ? " active" : ""}`} onClick={() => switchTab("settings")}>
                <i className="fa-solid fa-gear"></i><span>Settings</span>
              </button>
            </nav>
          </div>

          <div className="vd-plan-card">
            <p className="vd-plan-label">Current Plan</p>
            <p id="vdSidebarPlan">{vendor.plan_tier || "—"}</p>
            <button className="vd-upgrade-btn" onClick={upgrade}>Upgrade</button>
          </div>
        </div>
      </aside>

      {/* MOBILE TOPBAR */}
      <header className="vd-mobile-topbar">
        <div className="vd-mobile-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/spotlightlogo-512.png" alt="Spotlight" className="vd-mobile-logo" />
          <span className="vd-mobile-brand-text">Spotlight</span>
        </div>
        <button className="vd-mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)} aria-label="Open Menu">
          <i className="fa-solid fa-bars"></i>
        </button>
      </header>

      {mobileSidebarOpen && (
        <div className="vd-mobile-overlay" onClick={() => setMobileSidebarOpen(false)}></div>
      )}

      {/* MAIN */}
      <main className="vd-main">

        {/* HEADER */}
        <header className="vd-header">
          <h1 id="vdPageTitle">{TAB_TITLES[activeTab]}</h1>

          <div className="vd-header-right">
            <div className="vd-user-info">
              <span>{vendor.name || "—"}</span>
              <small>{vendor.spot_id || "—"}</small>
            </div>

            <div className="vd-profile-menu">
              <button
                className="vd-profile-btn"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(v => !v); }}
              >
                {vendor.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="vd-profile-avatar" src={vendor.logo_url} alt="Profile Logo" />
                ) : (
                  <span className="vd-profile-fallback">{fallbackLetter}</span>
                )}
              </button>

              <div className={`vd-dropdown${dropdownOpen ? "" : " hidden"}`} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="vd-dropdown-item"
                  onClick={() => { setDropdownOpen(false); window.location.href = "/insight"; }}
                >
                  Performance
                </button>
                <button
                  type="button"
                  className="vd-dropdown-item"
                  onClick={() => { setDropdownOpen(false); switchTab("settings"); }}
                >
                  Preferences
                </button>
                <button type="button" className="vd-dropdown-item danger" onClick={handleLogout}>Logout</button>
              </div>
            </div>
          </div>
        </header>

        {/* ============ OVERVIEW ============ */}
        <section className={sec("overview")}>
          <div className="vd-overview-layout">

            {/* LEFT: STATUS */}
            <div className="vd-status-card vd-card">
              <div className="vd-status-top">
                <div
                  className="vd-status-icon"
                  style={complete
                    ? { background: "#dcfce7", color: "#166534" }
                    : { background: "#fef3c7", color: "#92400e" }}
                >✔</div>
                <div className="vd-status-main">
                  <p className="vd-card-label">Profile Status</p>
                  <h3>{complete ? "Fully Onboarded & Optimized" : "Partially Onboarded & Less Optimized"}</h3>
                  <p className="vd-status-subtext">Your business listing is {percent}% complete.</p>
                </div>
              </div>

              <ul className="vd-checklist">
                {checklistItems.map((item, i) => (
                  <li key={i} className={item.ok ? "vd-check-ok" : "vd-check-missing"}>
                    <span>{item.ok ? "✔" : "✖"}</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>

              <div className="vd-progress-bar">
                <div
                  className="vd-progress-fill"
                  style={{ width: `${percent}%`, background: complete ? "#22c55e" : "#facc15" }}
                ></div>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="vd-overview-right">
              <div className="vd-top-cards">

                {/* PLAN */}
                <div className="vd-card vd-plan-box">
                  <div className="vd-plan-top">
                    <div className="vd-plan-icon"><i className="fa-solid fa-bolt"></i></div>
                    <div className="vd-plan-heading">
                      <p className="vd-card-label vd-plan-label-top">Current Plan</p>
                      <h3>{vendor.plan_tier || "—"}</h3>
                    </div>
                  </div>

                  {vendor.plan_tier === "free" && vendor.trial_started_at && trialText && (
                    <div className={`vd-trial-box${trialText.ended ? " vd-trial-ended" : ""}`}>
                      <p className="vd-trial-label">Free Trial</p>
                      <p className="vd-trial-days">{trialText.days}</p>
                      <p className="vd-trial-time">{trialText.time}</p>
                      <button className="vd-trial-upgrade-btn" onClick={upgrade}>Upgrade Now</button>
                    </div>
                  )}
                </div>

                {/* UPGRADE CTA */}
                <div className="vd-card vd-cta-dark">
                  <h2 className="vd-cta-title">Upgrade</h2>
                  <p className="vd-cta-text">Unlock access to more media, video and social links.</p>
                  <button className="vd-upgrade-btn vd-cta-btn" onClick={upgrade}>Compare Plans</button>
                </div>
              </div>

              {/* BUSINESS QUICK INFO */}
              <div className="vd-card">
                <div className="vd-card-header"><h3>Business Quick Info</h3></div>
                <div className="vd-card-grid">
                  <div>
                    <p className="vd-label">BUSINESS NAME</p>
                    <p>{vendor.name || ""}</p>
                    <p className="vd-label">SPOT ID</p>
                    <p>{vendor.spot_id || ""}</p>
                  </div>
                  <div>
                    <p className="vd-label">REGISTERED EMAIL</p>
                    <div className="vd-email-row">
                      <p>{vendor.email || ""}</p>
                      {emailVerified ? (
                        <span className="vd-email-verified">Verified</span>
                      ) : (
                        <button
                          className="vd-verify-email-btn"
                          onClick={handleVerifyEmail}
                          disabled={verifyState === "sending" || verifyState === "sent"}
                        >
                          {verifyLabel}
                        </button>
                      )}
                    </div>
                    <div className="vd-cat-grid">
                      <div>
                        <p className="vd-label">CATEGORY</p>
                        <p>{vendor.category || ""}</p>
                      </div>
                      <div>
                        <p className="vd-label">SUBCATEGORY</p>
                        <p>{vendor.subcategory || ""}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ PROFILE (module 2) ============ */}
        <section className={sec("profile")}>
          <ProfileTab
            vendor={vendor}
            onVendorUpdate={(patch) => setVendor((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        </section>

        {/* ============ PRODUCTS ============ */}

        {showProducts && (
          <section className={sec("products")}>
            <ProductsTab vendor={vendor} />
          </section>
        )}

        {/* ============ STUB SECTIONS (built in later modules) ============ */}

        {showServices && (
          <section className={sec("services")}>
            <div className="vd-card"><p style={{ color: "#64748b" }}>Services management — coming in a later module.</p></div>
          </section>
        )}

        {/* ============ PORTFOLIO ============ */}

        {showPortfolio && (
          <section className={sec("portfolio")}>
            <PortfolioTab vendor={vendor} />
          </section>
        )}

        {/* ============ SUBSCRIPTION (module 3) ============ */}
        <section className={sec("subscription")}>
          <SubscriptionTab vendor={vendor} />
        </section>

        {/* ============ VERIFICATION (module 4) ============ */}
        <section className={sec("verification")}>
          <VerificationTab vendor={vendor} />
        </section>

        <section className={sec("settings")}>
          <SettingsTab
            vendor={vendor}
            onVendorUpdate={(patch) => setVendor((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        </section>

      </main>
    </div>
  );
}
