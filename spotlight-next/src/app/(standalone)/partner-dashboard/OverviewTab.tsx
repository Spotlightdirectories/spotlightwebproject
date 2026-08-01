"use client";

// ===============================================================
// OverviewTab.tsx — Referral Link, Earnings Summary, Performance,
// and Monthly Bonus. Grouped together as the dashboard's default
// landing tab, same idea as CommissionsTab combining summary +
// ledger in one admin tab rather than splitting every stat card
// into its own tab.
//
// Referral links: there are genuinely TWO different links built from
// the same referral code — /getlisted?ref= for a vendor sign-up and
// /partner-program?ref= for a sub-partner sign-up (confirmed against
// partner-legal's Assets tab and the actual referral-resolution logic
// in partner-program/page.tsx and getlisted/page.tsx). An earlier pass
// showed only the vendor link but captioned it as working for "any
// vendor or partner" — misleading, since a prospective partner signing
// up through the vendor link would never get credited. Now both are
// shown explicitly, each captioned for what it actually does.
// ===============================================================

import { useState } from "react";

type Props = {
  referralCode: string | null;
  pending: number;
  available: number;
  paid: number;
  total: number;
  paidVendorCount: number;
  referredPartnersCount: number;
  monthlyQualified: number;
  bonusProgress: number;
  monthlyBonusEarned: number;
};

export default function OverviewTab({
  referralCode,
  pending,
  available,
  paid,
  total,
  paidVendorCount,
  referredPartnersCount,
  monthlyQualified,
  bonusProgress,
  monthlyBonusEarned,
}: Props) {
  const [copiedKey, setCopiedKey] = useState<"vendor" | "partner" | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const vendorLink = `${origin}/getlisted?ref=${referralCode}`;
  const partnerLink = `${origin}/partner-program?ref=${referralCode}`;

  function copyLink(key: "vendor" | "partner", link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  return (
    <>
      {/* REFERRAL LINKS */}
      <div className="pd-section">
        <h2 className="pd-section-heading">Your Referral Links</h2>
        <p className="pd-section-note">
          You have two separate links, both built from your same referral code — use the right one depending on who
          you&apos;re inviting.
        </p>

        <p style={{ fontWeight: 600, marginBottom: 6 }}>For a business (vendor sign-up)</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <code style={{ background: "var(--color-surface-alt)", padding: "8px 12px", borderRadius: 6 }}>{vendorLink}</code>
          <button className="pd-btn" onClick={() => copyLink("vendor", vendorLink)}>{copiedKey === "vendor" ? "Copied!" : "Copy Link"}</button>
        </div>

        <p style={{ fontWeight: 600, marginBottom: 6 }}>For a new partner (sub-partner sign-up)</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ background: "var(--color-surface-alt)", padding: "8px 12px", borderRadius: 6 }}>{partnerLink}</code>
          <button className="pd-btn" onClick={() => copyLink("partner", partnerLink)}>{copiedKey === "partner" ? "Copied!" : "Copy Link"}</button>
        </div>
      </div>

      {/* EARNINGS SUMMARY */}
      <div className="pd-section">
        <h2 className="pd-section-heading">Earnings Summary</h2>
        <div className="pd-summary-grid">
          <div className="pd-summary-card">
            <div className="pd-summary-label">Pending</div>
            <div className="pd-summary-value">₦{pending.toLocaleString()}</div>
          </div>
          <div className="pd-summary-card">
            <div className="pd-summary-label">Available</div>
            <div className="pd-summary-value">₦{available.toLocaleString()}</div>
          </div>
          <div className="pd-summary-card">
            <div className="pd-summary-label">Paid</div>
            <div className="pd-summary-value">₦{paid.toLocaleString()}</div>
          </div>
          <div className="pd-summary-card">
            <div className="pd-summary-label">Total Earnings</div>
            <div className="pd-summary-value">₦{total.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* PERFORMANCE */}
      <div className="pd-section">
        <h2 className="pd-section-heading">Performance</h2>
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                <th>Paid Vendors</th>
                <th>Referred Partners</th>
                <th>This Month (Yearly)</th>
                <th>Bonus Progress</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{paidVendorCount}</td>
                <td>{referredPartnersCount}</td>
                <td>{monthlyQualified}</td>
                <td>{bonusProgress} / 50</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MONTHLY BONUS */}
      <div className="pd-section">
        <h2 className="pd-section-heading">Monthly Bonus</h2>
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr><th>Target</th><th>Current</th><th>Reward</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>50 Yearly Vendors</td>
                <td>{monthlyQualified}</td>
                <td>₦30,000</td>
                <td>{monthlyBonusEarned > 0 ? `₦${monthlyBonusEarned.toLocaleString()} Earned` : "Not Achieved"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="pd-progress-track">
          <div className="pd-progress-fill" style={{ width: `${Math.min(100, (bonusProgress / 50) * 100)}%` }} />
        </div>
      </div>
    </>
  );
}
