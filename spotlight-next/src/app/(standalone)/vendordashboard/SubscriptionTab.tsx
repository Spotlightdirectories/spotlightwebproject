"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/SubscriptionTab.tsx
//
// Vendor Dashboard — MODULE 3: Subscription & billing.
//
// Faithful port of the #subscription section in production
// vendordashboard.html + the "SUBSCRIPTION SECTION" / "SPONSORSHIP
// HISTORY" blocks in vendordashboard.js.
//
// Ported as-is (no behavior changes) except one thing done
// "better" per the brief: production toggles the Manage Branches /
// Manage Payment Method buttons visible-by-default in the HTML and
// hides them with JS after load, which can flash the wrong button
// for a frame. Here visibility is computed at render time instead,
// so there's no flash — same end state, no visual bug.
//
// Everything else — the next-payment-amount pricing table, the
// billing history labels, the sponsorship history formatting, the
// exact "Manage Payment Method" explainer copy — is carried over
// unchanged, including the comments explaining WHY it's built this
// way (kept below, they're genuinely useful context).
// ===============================================================

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Vendor } from "./page";

// Next payment amount is computed directly from the vendor's CURRENT
// plan_tier + billing_cycle against the same canonical pricing table
// payment.js and the verify Edge Functions use — NOT from the last
// historical payment, which would be wrong whenever pricing has
// changed since then or the vendor was on a different plan at the
// time (real example: a vendor's historical Standard/yearly payment
// was ₦25,976, but the current Standard/yearly price is ₦26,982).
const PLAN_PRICES_KOBO: Record<string, { monthly: number; yearly: number }> = {
  standard: { monthly: 299800, yearly: 2698200 },
  enterprise: { monthly: 1260000, yearly: 11340000 },
  elite: { monthly: 2240000, yearly: 20160000 },
};

function getNextPaymentKobo(planTier: string | null, billingCycle: string | null): number | null {
  const planPrices = PLAN_PRICES_KOBO[planTier || ""];
  if (!planPrices) return null;
  return planPrices[billingCycle as "monthly" | "yearly"] ?? planPrices.monthly ?? null;
}

function cap(s?: string | null): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
}

function nairaFromKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

type Payment = {
  amount: string | number;
  approved_at: string;
  plan: string | null;
  billing_type: string | null;
};

type Sponsorship = {
  sponsorship_type: string | null;
  target_id: string | null;
  tier: string | null;
  billing_cycle: string | null;
  payment_status: string | null;
  starts_at: string | null;
  expires_at: string | null;
};

const BRANCH_ALLOWED_PLANS = ["enterprise", "elite", "custom"];

export default function SubscriptionTab({ vendor }: { vendor: Vendor }) {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [sponsorships, setSponsorships] = useState<Sponsorship[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("vendor_payments")
        .select("amount, approved_at, plan, billing_type")
        .eq("vendor_id", vendor.id)
        .in("status", ["confirmed"])
        .order("approved_at", { ascending: false })
        .limit(5);

      if (!cancelled) setPayments(data || []);
    })();

    (async () => {
      const { data, error } = await supabase
        .from("vendor_sponsorships")
        .select("sponsorship_type, target_id, tier, billing_cycle, payment_status, starts_at, expires_at")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!cancelled) setSponsorships(error ? [] : data || []);
    })();

    return () => {
      cancelled = true;
    };
  }, [vendor.id]);

  // ---------------------------------------------------------------
  // DERIVED DISPLAY VALUES
  // ---------------------------------------------------------------
  const planName = vendor.plan_tier || "free";
  const statusLabel = (vendor.subscription_status || "active").toUpperCase();

  const billingIntervalText =
    vendor.plan_tier === "free" ? "Free Forever" : vendor.billing_cycle || "—";

  const amountText =
    vendor.plan_tier === "free"
      ? "No active billing"
      : vendor.plan_tier === "custom"
      ? "Contact support for pricing"
      : (() => {
          const kobo = getNextPaymentKobo(vendor.plan_tier, vendor.billing_cycle);
          return kobo != null ? nairaFromKobo(kobo) : "—";
        })();

  const billingDateText = vendor.expires_at ? new Date(vendor.expires_at).toLocaleDateString() : "—";

  const showManageBranches = BRANCH_ALLOWED_PLANS.includes(vendor.plan_tier || "");
  const showManagePaymentMethod = vendor.plan_tier !== "free";

  function goUpgrade() {
    window.location.href = "/getlisted";
  }

  function goManageBranches() {
    window.location.href = "/dashboard-branches";
  }

  function goSponsorNow() {
    window.location.href = "/getsponsored";
  }

  function handleManagePaymentMethod() {
    // Honest, accurate explanation of how billing actually works here —
    // per-transaction Paystack checkout each cycle, not a stored card.
    alert(
      "Spotlight doesn't store a card on file — your subscription is billed via a secure one-time payment each cycle. You'll be prompted to pay again shortly before your next billing date, and can pay by card or bank transfer at that time."
    );
  }

  return (
    <div className="vd-subscription-layout">
      {/* LEFT */}
      <div className="vd-card vd-subscription-main">
        <div className="vd-subscription-header">
          <h3>Plan Details</h3>
        </div>

        <div className="vd-subscription-top">
          <div>
            <p className="vd-sub-label">ACTIVE PLAN</p>
            <div className="vd-plan-inline">
              <h2>{planName}</h2>
              <span className="vd-status-badge">{statusLabel}</span>
            </div>
          </div>

          <div className="vd-subscription-side">
            <p className="vd-sub-label">BILLING INTERVAL</p>
            <p className="vd-subscription-value">{billingIntervalText}</p>
          </div>
        </div>

        <div className="vd-sub-divider"></div>

        <div className="vd-subscription-bottom">
          <div>
            <p className="vd-sub-label">NEXT PAYMENT AMOUNT</p>
            <h2 className="vd-payment-amount">{amountText}</h2>
          </div>

          <div>
            <p className="vd-sub-label">BILLING DATE</p>
            <p className="vd-subscription-value">{billingDateText}</p>
          </div>
        </div>

        <div className="vd-subscription-actions">
          <button className="vd-primary-btn" type="button" onClick={goUpgrade}>
            Upgrade Plan
          </button>

          {showManageBranches && (
            <button className="vd-secondary-outline-btn" type="button" onClick={goManageBranches}>
              Manage Branches
            </button>
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div className="vd-card vd-billing-history-card">
        <h3 className="vd-billing-title">Billing History</h3>

        <div className="vd-billing-history-list">
          {payments === null ? (
            <div className="vd-history-row">
              <span>Loading...</span>
              <strong>—</strong>
            </div>
          ) : payments.length === 0 ? (
            <div className="vd-history-row">
              <span>No billing history</span>
              <strong>—</strong>
            </div>
          ) : (
            payments.map((payment, i) => (
              <div className="vd-history-row" key={i}>
                <span>
                  {new Date(payment.approved_at).toLocaleDateString()} — {cap(payment.plan)} (
                  {cap(payment.billing_type)})
                </span>
                <strong>{nairaFromKobo(Number(payment.amount))}</strong>
              </div>
            ))
          )}
        </div>

        {showManagePaymentMethod && (
          <button
            className="vd-secondary-outline-btn vd-payment-method-btn"
            type="button"
            onClick={handleManagePaymentMethod}
          >
            Manage Payment Method
          </button>
        )}
      </div>

      {/* SPONSORSHIP HISTORY — own section, since sponsorship and
          subscription expiry dates are independent of each other */}
      <div className="vd-card vd-sponsorship-history-card">
        <div className="vd-subscription-header">
          <h3>Sponsorship History</h3>
        </div>

        <div className="vd-billing-history-list">
          {sponsorships === null ? (
            <div className="vd-history-row">
              <span>Loading...</span>
              <strong>—</strong>
            </div>
          ) : sponsorships.length === 0 ? (
            <div className="vd-history-row">
              <span>No sponsorships yet</span>
              <strong>—</strong>
            </div>
          ) : (
            sponsorships.map((s, i) => {
              const start = s.starts_at ? new Date(s.starts_at).toLocaleDateString() : "—";
              const end = s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—";
              return (
                <div className="vd-history-row" key={i}>
                  <span>
                    {cap(s.tier)} {cap(s.sponsorship_type)} — {s.billing_cycle || "—"} · {start} to {end}
                  </span>
                  <strong>{(s.payment_status || "—").toUpperCase()}</strong>
                </div>
              );
            })
          )}
        </div>

        <button className="vd-secondary-outline-btn" type="button" onClick={goSponsorNow}>
          Sponsor Your Business
        </button>
      </div>
    </div>
  );
}
