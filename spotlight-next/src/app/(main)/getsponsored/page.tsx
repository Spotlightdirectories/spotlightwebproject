"use client";

// ===============================================================
// src/app/(main)/getsponsored/page.tsx
//
// Faithful port of production getsponsored.html + getsponsored.js —
// lets a paid-plan vendor buy boosted placement for their whole
// business, or specific products/services, via Paystack (card) or
// bank transfer + receipt upload.
//
// Placed under the (main) route group (like dashboard-branches),
// since production's version uses the same site-wide navbar as
// every public content page.
//
// Backend already exists and is unchanged: the verify-paystack-
// sponsorship Edge Function and the get_product_rank / get_service_
// rank / get_vendor_rank RPCs were already deployed before this port
// started — confirmed live via list_edge_functions before writing
// this page. Nothing new to deploy here.
//
// Styling uses the site's brand tokens (dark mode) instead of
// production's hardcoded light-only palette, same treatment as every
// other ported page this migration.
// ===============================================================

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { supabase } from "@/lib/supabase";
import { uploadVendorFile } from "@/lib/uploadVendorFile";
import styles from "./getsponsored.module.css";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

type SponsorType = "business" | "product" | "service";
type Cycle = "monthly" | "yearly";
type Tier = "standard" | "silver" | "gold" | "platinum" | "diamond";

type Vendor = { id: string; name: string | null; plan_tier: string | null; email: string | null };
type VendorItem = { id: string; name: string; image: string | null };

type ActiveSponsorship = {
  id: string;
  sponsorship_type: SponsorType;
  target_id: string | null;
  tier: Tier;
  billing_cycle: Cycle;
  expires_at: string;
  starts_at: string | null;
};

type RankResult = { rank_position: number; total_count: number } | null;
type ViewComparison = { before: number; after: number; windowDays: number } | null;

// Unified shape for both tier lists — `items`/`singleMonthly` are
// undefined for business tiers (no per-item concept) rather than two
// separate incompatible types, so downstream code never needs an
// unsafe cast to read from whichever list is currently active.
type TierRow = { tier: Tier; monthly: number; items?: number; singleMonthly?: number };

// ── APPROVED PRICING (from the pricing workbook Cyril approved) ──
const PRODUCT_SERVICE_TIERS: TierRow[] = [
  { tier: "standard", items: 1, monthly: 2000, singleMonthly: 2000 },
  { tier: "silver", items: 3, monthly: 5000, singleMonthly: 2500 },
  { tier: "gold", items: 5, monthly: 8000, singleMonthly: 4000 },
  { tier: "platinum", items: 8, monthly: 12000, singleMonthly: 6000 },
  { tier: "diamond", items: 12, monthly: 16000, singleMonthly: 8000 },
];

const BUSINESS_TIERS_STANDARD_PLAN: TierRow[] = [
  { tier: "standard", monthly: 3000 },
  { tier: "silver", monthly: 6000 },
  { tier: "gold", monthly: 10000 },
  { tier: "platinum", monthly: 15000 },
  { tier: "diamond", monthly: 20000 },
];

const PLAN_MULTIPLIER: Record<string, number> = { standard: 1, enterprise: 1.5, elite: 2 };

const TIER_LABELS: Record<Tier, string> = {
  standard: "Standard",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

function yearlyOf(monthly: number) {
  return monthly * 9;
}

function naira(n: number) {
  return `₦${n.toLocaleString()}`;
}

export default function GetSponsoredPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [freePlan, setFreePlan] = useState(false);

  const [products, setProducts] = useState<VendorItem[]>([]);
  const [services, setServices] = useState<VendorItem[]>([]);

  const [activeSponsorships, setActiveSponsorships] = useState<ActiveSponsorship[]>([]);
  const [rankById, setRankById] = useState<Record<string, RankResult>>({});
  const [viewsById, setViewsById] = useState<Record<string, ViewComparison>>({});

  const [selectedType, setSelectedType] = useState<SponsorType>("business");
  const [selectedCycle, setSelectedCycle] = useState<Cycle>("monthly");
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const [bankSectionOpen, setBankSectionOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFileName, setReceiptFileName] = useState("No file chosen");
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);
  const [successScreen, setSuccessScreen] = useState(false);

  // ---------------------------------------------------------------
  // AUTH + VENDOR + CATALOG
  // ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (cancelled) return;
      setUserId(user.id);
      setUserEmail(user.email || null);

      const { data: v } = await supabase
        .from("vendors")
        .select("id, name, plan_tier, subscription_status, email")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!v) {
        router.replace("/vendordashboard");
        return;
      }

      setVendor(v as Vendor);

      // Sponsorship isn't available on Free plan — matches how other
      // premium features (video upload, etc.) are already gated.
      if (!v.plan_tier || v.plan_tier === "free") {
        setFreePlan(true);
        setLoading(false);
        return;
      }

      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("vendor_products").select("id, slug, product_name, primary_image_url").eq("vendor_id", v.id).eq("moderation_status", "approved"),
        supabase.from("vendor_services").select("id, slug, service_name, representative_image_url").eq("vendor_id", v.id).eq("moderation_status", "approved"),
      ]);

      if (cancelled) return;

      setProducts((p || []).map((row) => ({ id: row.id, name: row.product_name, image: row.primary_image_url })));
      setServices((s || []).map((row) => ({ id: row.id, name: row.service_name, image: row.representative_image_url })));

      const { data: active } = await supabase
        .from("vendor_sponsorships")
        .select("id, sponsorship_type, target_id, tier, billing_cycle, expires_at, starts_at")
        .eq("vendor_id", v.id)
        .eq("payment_status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false });

      if (cancelled) return;
      setActiveSponsorships((active as ActiveSponsorship[]) || []);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ---------------------------------------------------------------
  // CURRENT SPONSORSHIPS — real rank + before/after view comparison
  // Same real RPCs/analytics_events queries as production, not an
  // approximation.
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!vendor || activeSponsorships.length === 0) return;
    let cancelled = false;

    async function getRealRank(s: ActiveSponsorship): Promise<RankResult> {
      try {
        if (s.sponsorship_type === "product") {
          const { data } = await supabase.rpc("get_product_rank", { p_product_id: s.target_id });
          return data?.[0] || null;
        }
        if (s.sponsorship_type === "service") {
          const { data } = await supabase.rpc("get_service_rank", { p_service_id: s.target_id });
          return data?.[0] || null;
        }
        const { data } = await supabase.rpc("get_vendor_rank", { p_vendor_id: vendor!.id });
        return data?.[0] || null;
      } catch (err) {
        console.error("Rank lookup failed:", err);
        return null;
      }
    }

    async function getViewComparison(s: ActiveSponsorship): Promise<ViewComparison> {
      if (!s.starts_at) return null;

      const startDate = new Date(s.starts_at);
      const now = new Date();
      const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysElapsed < 1) return null;

      const windowDays = Math.min(14, daysElapsed);
      const windowMs = windowDays * 24 * 60 * 60 * 1000;
      const beforeStart = new Date(startDate.getTime() - windowMs);
      const afterEnd = new Date(Math.min(startDate.getTime() + windowMs, now.getTime()));

      const eventType = s.sponsorship_type === "business" ? "profile_view" : s.sponsorship_type === "product" ? "product_view" : "service_view";
      const idColumn = s.sponsorship_type === "product" ? "product_id" : s.sponsorship_type === "service" ? "service_id" : null;

      function buildQuery(from: Date, to: Date) {
        let q = supabase
          .from("analytics_events")
          .select("*", { count: "exact", head: true })
          .eq("vendor_id", vendor!.id)
          .eq("event_type", eventType)
          .gte("created_at", from.toISOString())
          .lt("created_at", to.toISOString());
        if (idColumn) q = q.eq(idColumn, s.target_id as string);
        return q;
      }

      try {
        const [{ count: beforeCount }, { count: afterCount }] = await Promise.all([
          buildQuery(beforeStart, startDate),
          buildQuery(startDate, afterEnd),
        ]);
        return { before: beforeCount || 0, after: afterCount || 0, windowDays };
      } catch (err) {
        console.error("View comparison failed:", err);
        return null;
      }
    }

    async function run() {
      const rankEntries: Record<string, RankResult> = {};
      const viewEntries: Record<string, ViewComparison> = {};

      await Promise.all(
        activeSponsorships.map(async (s) => {
          const [rank, views] = await Promise.all([getRealRank(s), getViewComparison(s)]);
          rankEntries[s.id] = rank;
          viewEntries[s.id] = views;
        })
      );

      if (!cancelled) {
        setRankById(rankEntries);
        setViewsById(viewEntries);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [vendor, activeSponsorships]);

  // ---------------------------------------------------------------
  // AVAILABLE TYPE TABS — only for what this vendor actually sells
  // ---------------------------------------------------------------
  const availableTypes = useMemo(() => {
    const types: { type: SponsorType; label: string }[] = [{ type: "business", label: "Business" }];
    if (products.length > 0) types.push({ type: "product", label: "Products" });
    if (services.length > 0) types.push({ type: "service", label: "Services" });
    return types;
  }, [products.length, services.length]);

  function switchType(type: SponsorType) {
    setSelectedType(type);
    setSelectedTier(null);
    setSelectedItemIds([]);
  }

  // ---------------------------------------------------------------
  // PRICING HELPERS — identical formulas to production
  // ---------------------------------------------------------------
  function getTierPrice(tierConfig: TierRow) {
    let monthly = tierConfig.monthly;
    if (selectedType === "business") {
      const multiplier = PLAN_MULTIPLIER[vendor?.plan_tier || ""] || 1;
      monthly = monthly * multiplier;
    }
    return selectedCycle === "monthly" ? monthly : yearlyOf(monthly);
  }

  // Only ever called for product/service tiers (singleMonthly always
  // set there) — the ?? fallback just guards the type, since business
  // tiers never reach this function at runtime.
  function getEffectivePrice(tierConfig: TierRow, itemCount: number) {
    const monthly = itemCount === 1 ? tierConfig.singleMonthly ?? tierConfig.monthly : tierConfig.monthly;
    return selectedCycle === "monthly" ? monthly : yearlyOf(monthly);
  }

  const currentTiers = selectedType === "business" ? BUSINESS_TIERS_STANDARD_PLAN : PRODUCT_SERVICE_TIERS;
  const actualCatalogSize = selectedType === "product" ? products.length : selectedType === "service" ? services.length : Infinity;

  function selectTier(tier: Tier) {
    setSelectedTier(tier);
    setSelectedItemIds([]);
  }

  function toggleItem(id: string, maxItems: number) {
    setSelectedItemIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxItems) {
        alert(`This tier covers a maximum of ${maxItems} item${maxItems > 1 ? "s" : ""}.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  const showItemPicker = selectedType !== "business" && !!selectedTier;
  const showSummary = selectedType === "business" ? !!selectedTier : selectedItemIds.length > 0;

  const items = selectedType === "product" ? products : selectedType === "service" ? services : [];
  const tierConfig = currentTiers.find((t) => t.tier === selectedTier) || null;

  const summaryUnitPrice = tierConfig
    ? selectedType === "business"
      ? getTierPrice(tierConfig)
      : getEffectivePrice(tierConfig, selectedItemIds.length)
    : 0;

  const summaryTargetLabel =
    selectedType === "business"
      ? `Your business (${vendor?.name || ""})`
      : selectedItemIds.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean).join(", ");

  // ---------------------------------------------------------------
  // CREATE PENDING SPONSORSHIP ROW(S)
  // ---------------------------------------------------------------
  async function createPendingSponsorships(paymentMethod: "paystack" | "bank_transfer"): Promise<string[]> {
    if (!vendor || !tierConfig) throw new Error("Select a tier first.");

    const targetIds = selectedType === "business" ? [null] : selectedItemIds;
    const unitPrice =
      selectedType === "business"
        ? getTierPrice(tierConfig)
        : getEffectivePrice(tierConfig, targetIds.length);

    // Shared batch_id so a single payment covering multiple items can
    // be approved/rejected as one atomic decision later.
    const batchId = crypto.randomUUID();

    const rows = targetIds.map((targetId) => ({
      vendor_id: vendor.id,
      sponsorship_type: selectedType,
      target_id: targetId,
      tier: selectedTier,
      billing_cycle: selectedCycle,
      amount_paid: unitPrice,
      payment_method: paymentMethod,
      payment_status: "pending",
      batch_id: batchId,
    }));

    const { data, error } = await supabase.from("vendor_sponsorships").insert(rows).select("id");
    if (error || !data) throw new Error(error?.message || "Could not create sponsorship record.");
    return data.map((r) => r.id);
  }

  // ---------------------------------------------------------------
  // PAY ONLINE (Paystack)
  // ---------------------------------------------------------------
  async function handlePayOnline() {
    if (!vendor || !userId) return;
    setPayingOnline(true);

    let sponsorshipIds: string[];
    try {
      sponsorshipIds = await createPendingSponsorships("paystack");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create sponsorship record.");
      setPayingOnline(false);
      return;
    }

    if (!window.PaystackPop) {
      alert("Payment could not start. Please refresh and try again.");
      setPayingOnline(false);
      return;
    }

    const reference = `SPONSOR_${Date.now()}`;

    const handler = window.PaystackPop.setup({
      // Reads NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY (a test key locally/on
      // Staging, per .env.local) so testing never runs against the
      // live key — falls back to the live key if that variable isn't
      // set somewhere (e.g. a future production deploy of this app).
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_live_3bb98d5dc8a2fa57534c307db789248d24c629de",
      email: vendor.email || userEmail,
      amount: summaryUnitPrice * 100,
      currency: "NGN",
      ref: reference,
      metadata: { auth_user_id: userId },
      callback: (response: { reference: string }) => {
        verifySponsorshipPayment(response.reference, sponsorshipIds);
      },
      onClose: () => {
        alert("Payment window closed. If payment was completed, your sponsorship will activate automatically after verification.");
        setPayingOnline(false);
      },
    });

    handler.openIframe();
  }

  async function verifySponsorshipPayment(reference: string, sponsorshipIds: string[]) {
    try {
      const { error } = await supabase.functions.invoke("verify-paystack-sponsorship", {
        body: { reference, sponsorship_ids: sponsorshipIds, auth_user_id: userId },
      });

      if (error) {
        alert("We couldn't confirm your payment right away. If money was deducted, your sponsorship will activate automatically within a few minutes.");
        router.replace("/vendordashboard");
        return;
      }

      setSuccessScreen(true);
      setTimeout(() => router.replace("/vendordashboard"), 2500);
    } catch (err) {
      console.error("Sponsorship verification error:", err);
      alert("Verification failed. Please contact support if you were charged.");
    } finally {
      setPayingOnline(false);
    }
  }

  // ---------------------------------------------------------------
  // PAY BY BANK TRANSFER
  // ---------------------------------------------------------------
  function handleReceiptFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setReceiptFile(file);
    setReceiptFileName(file ? file.name : "No file chosen");
  }

  async function handleSubmitReceipt() {
    if (!vendor) return;
    if (!receiptFile) {
      alert("Please select a receipt file.");
      return;
    }

    setSubmittingReceipt(true);

    let sponsorshipIds: string[];
    try {
      sponsorshipIds = await createPendingSponsorships("bank_transfer");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create sponsorship record.");
      setSubmittingReceipt(false);
      return;
    }

    let uploadResult;
    try {
      uploadResult = await uploadVendorFile(receiptFile, "sponsorship_receipt");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Receipt upload failed.");
      setSubmittingReceipt(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("vendor_sponsorships")
      .update({ receipt_url: uploadResult.path })
      .in("id", sponsorshipIds);

    if (updateError) console.error("Receipt link update failed:", updateError);

    alert("Receipt submitted. Your sponsorship will go live once an admin confirms your payment.");
    router.replace("/vendordashboard");
  }

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------
  if (successScreen) {
    return (
      <div className={styles.successOverlay}>
        <div className={styles.successCard}>
          <h2>&#10004; Sponsorship Activated</h2>
          <p>Redirecting you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />

      <section className={styles.hero}>
        <h1>Sponsor Your Business</h1>
        <p>Get seen first. Sponsored listings appear ahead of everyone else in search — the higher the tier, the stronger the placement.</p>
      </section>

      <section className={styles.how}>
        <h2>How It Works</h2>
        <div className={styles.howSteps}>
          {[
            { n: 1, title: "Choose what to sponsor", text: "Your whole Business, a specific Product, or a Service." },
            { n: 2, title: "Pick a tier", text: "Higher tiers get stronger placement and cover more items." },
            { n: 3, title: "Pay", text: "Instantly via card, or by bank transfer with receipt upload." },
            { n: 4, title: "Go live", text: "Appear boosted in search the moment payment is confirmed." },
          ].map((step) => (
            <div className={styles.howStep} key={step.n}>
              <div className={styles.howNum}>{step.n}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {loading && <div className={styles.loadingState}>Loading your account details...</div>}

      {!loading && freePlan && (
        <div className={styles.emptyState}>
          <i className="fa-solid fa-circle-exclamation"></i>
          <p>Sponsorship isn&apos;t available on the Free plan. Upgrade your subscription to unlock sponsorship.</p>
          <a href="/getlisted" className={styles.upgradeLink}>View Plans</a>
        </div>
      )}

      {!loading && !freePlan && vendor && (
        <>
          {activeSponsorships.length > 0 && (
            <div className={styles.currentSponsorships}>
              <h2>Your Current Sponsorships</h2>
              <div className={styles.currentList}>
                {activeSponsorships.map((s) => {
                  let targetLabel = "Your whole business";
                  if (s.sponsorship_type !== "business") {
                    const pool = s.sponsorship_type === "product" ? products : services;
                    const item = pool.find((i) => i.id === s.target_id);
                    targetLabel = item ? item.name : "(item no longer available)";
                  }
                  const rank = rankById[s.id];
                  const views = viewsById[s.id];

                  return (
                    <div className={styles.currentItem} key={s.id}>
                      <div>
                        <strong>{TIER_LABELS[s.tier]} {s.sponsorship_type}</strong>
                        <span> — {targetLabel}</span>
                        {rank && rank.total_count > 0 && (
                          <div className={styles.currentRank}>
                            Currently ranked <strong>#{rank.rank_position}</strong> of {rank.total_count} in its category
                          </div>
                        )}
                        {views && (
                          <div className={styles.currentViews}>
                            {views.before === 0 && views.after === 0
                              ? `No views recorded in the ${views.windowDays}-day window before or after sponsorship started.`
                              : (() => {
                                  const change = views.before === 0 ? null : Math.round(((views.after - views.before) / views.before) * 100);
                                  const changeLabel =
                                    change === null
                                      ? views.after > 0 ? "new views since sponsoring" : "no change yet"
                                      : `${change >= 0 ? "+" : ""}${change}% vs. the ${views.windowDays} days before`;
                                  return `${views.after} view${views.after === 1 ? "" : "s"} in the ${views.windowDays} days since sponsoring (${changeLabel})`;
                                })()}
                          </div>
                        )}
                      </div>
                      <div>
                        <span>Until {new Date(s.expires_at).toLocaleDateString()}</span>
                        <span className={styles.currentBadge}>Active</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <section className={styles.typeTabs}>
            {availableTypes.map((t) => (
              <button
                key={t.type}
                type="button"
                className={`${styles.typeTab} ${selectedType === t.type ? styles.active : ""}`}
                onClick={() => switchType(t.type)}
              >
                {t.label}
              </button>
            ))}
          </section>

          {selectedType === "business" ? (
            <section className={styles.businessNote}>
              <i className="fa-solid fa-circle-info"></i>
              <span>
                Business sponsorship pricing is scaled to your {vendor.plan_tier} subscription plan, and automatically
                covers your vendor card and every product/service you sell.
              </span>
            </section>
          ) : (
            <section className={styles.businessNote}>
              <i className="fa-solid fa-circle-info"></i>
              <span>
                Only have one product or service to boost? Every tier below shows two prices — the full bundle rate,
                and a lower single-item rate (half price) if you only need to sponsor one. Both give the exact same
                visibility boost strength; only the price and item count differ.
              </span>
            </section>
          )}

          <section className={styles.billingToggle}>
            <button
              type="button"
              className={`${styles.billingBtn} ${selectedCycle === "monthly" ? styles.active : ""}`}
              onClick={() => setSelectedCycle("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`${styles.billingBtn} ${selectedCycle === "yearly" ? styles.active : ""}`}
              onClick={() => setSelectedCycle("yearly")}
            >
              Yearly <span className={styles.saveBadge}>Save ~25%</span>
            </button>
          </section>

          <section className={styles.tierGrid}>
            {currentTiers.map((t) => {
              const price = getTierPrice(t);
              const exceedsCatalog = selectedType !== "business" && (t.items ?? 0) > actualCatalogSize;
              const isSelected = selectedTier === t.tier;

              return (
                <div
                  key={t.tier}
                  className={`${styles.tierCard} ${isSelected ? styles.selected : ""}`}
                  onClick={() => selectTier(t.tier)}
                >
                  <div className={styles.tierName}>{TIER_LABELS[t.tier]}</div>
                  <div className={styles.tierItems}>
                    {t.items ? `${t.items} item${t.items > 1 ? "s" : ""} max` : "Whole business"}
                  </div>

                  {selectedType === "business" || t.items === 1 ? (
                    <div className={styles.tierPrice}>
                      {naira(price)}<br /><small>/{selectedCycle === "monthly" ? "mo" : "yr"}</small>
                    </div>
                  ) : (
                    <>
                      <div className={styles.tierPriceOption}>
                        <span className={styles.tierPriceLabel}>Up to {t.items} items</span>
                        <span className={styles.tierPriceAmount}>
                          {naira(price)}<small>/{selectedCycle === "monthly" ? "mo" : "yr"}</small>
                        </span>
                      </div>
                      <div className={`${styles.tierPriceOption} ${styles.tierPriceSingle}`}>
                        <span className={styles.tierPriceLabel}>Just 1 item</span>
                        <span className={styles.tierPriceAmount}>
                          {naira(getEffectivePrice(t, 1))}
                          <small>/{selectedCycle === "monthly" ? "mo" : "yr"}</small>
                        </span>
                      </div>
                    </>
                  )}

                  {exceedsCatalog && (
                    <div className={styles.tierNote}>You have {actualCatalogSize} — sponsor 1 for the same boost</div>
                  )}
                </div>
              );
            })}
          </section>

          {showItemPicker && tierConfig && (
            <section className={styles.itemPicker}>
              {(() => {
                const maxItems = tierConfig.items ?? 1;
                const singlePrice = getEffectivePrice(tierConfig, 1);
                const bundlePrice = getEffectivePrice(tierConfig, 2);
                return (
                  <>
                    <h3>Select up to {maxItems} {selectedType}{maxItems > 1 ? "s" : ""} to sponsor</h3>
                    <p className={styles.itemPickerNote}>
                      {maxItems > 1
                        ? `Pick just 1 item and you'll pay ${naira(singlePrice)}/${selectedCycle === "monthly" ? "mo" : "yr"} for the full ${TIER_LABELS[tierConfig.tier]} boost. Pick 2 or more (up to ${maxItems}) and the price becomes the bundle rate, ${naira(bundlePrice)}/${selectedCycle === "monthly" ? "mo" : "yr"}, covering all of them. The boost strength is identical either way — only the price and item count differ.`
                        : `You picked the ${TIER_LABELS[tierConfig.tier]} tier, which covers 1 item at ${naira(singlePrice)}/${selectedCycle === "monthly" ? "mo" : "yr"}.`}
                    </p>
                    <div className={styles.itemList}>
                      {items.map((item) => (
                        <label className={styles.itemRow} key={item.id}>
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={() => toggleItem(item.id, maxItems)}
                          />
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image} alt={item.name} />
                          ) : (
                            <div className={styles.itemImagePlaceholder} aria-hidden="true">🖼️</div>
                          )}
                          <span>{item.name}</span>
                        </label>
                      ))}
                    </div>
                  </>
                );
              })()}
            </section>
          )}

          {showSummary && tierConfig && (
            <section className={styles.checkoutSummary}>
              <div className={styles.summaryRow}>
                <span>Sponsoring</span>
                <strong>{summaryTargetLabel}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Tier</span>
                <strong>
                  {TIER_LABELS[tierConfig.tier]}
                  {selectedType !== "business" ? (selectedItemIds.length === 1 ? " — single item price" : " — bundle price") : ""}
                  {" "}({selectedCycle === "monthly" ? "Monthly" : "Yearly"})
                </strong>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Total</span>
                <strong>{naira(summaryUnitPrice)}</strong>
              </div>

              <div className={styles.paymentMethods}>
                <button type="button" className={styles.payOnlineBtn} onClick={handlePayOnline} disabled={payingOnline}>
                  <i className="fa-solid fa-credit-card"></i> {payingOnline ? "Processing..." : "Pay Online (Card)"}
                </button>
                <button type="button" className={styles.payBankBtn} onClick={() => setBankSectionOpen(true)}>
                  <i className="fa-solid fa-building-columns"></i> Pay by Bank Transfer
                </button>
              </div>

              {bankSectionOpen && (
                <div className={styles.bankSection}>
                  <p>
                    Transfer the total amount to our account, then upload your receipt below. Your sponsorship goes
                    live once an admin confirms it (usually within a few hours).
                  </p>
                  <div className={styles.chooseRow}>
                    <label htmlFor="gsReceiptFile" className={styles.chooseBtn}>Choose File</label>
                    <span className={styles.chooseFileName}>{receiptFileName}</span>
                    <input id="gsReceiptFile" type="file" accept="image/*,.pdf" hidden onChange={handleReceiptFileChange} />
                  </div>
                  <button type="button" className={styles.submitReceiptBtn} onClick={handleSubmitReceipt} disabled={submittingReceipt}>
                    {submittingReceipt ? "Uploading..." : "Submit Receipt"}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
