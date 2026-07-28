"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/VerificationTab.tsx
//
// Vendor Dashboard — MODULE 4: Verification.
//
// Faithful port of the #verification section in production
// vendordashboard.html + the "VERIFICATION SECTION" block in
// vendordashboard.js.
//
// Scope note: this tab only shows the vendor's current badge status
// and routes the "Apply" buttons onward — same as production. The
// actual application form (uploading government ID, CAC certificate,
// utility bill, MEMART, CAC status report, recent photograph, etc.)
// lives on its own page: /verify-badge, a faithful port of
// production's verify-badge.html + verify-badge.js.
//
// Gray Badge requires 3 documents: Government ID (NIN), Utility
// Bill (business or residential address), and a Passport Photograph
// (Recent - within last 6 months).
// Blue Badge requires 5: Government ID (NIN), CAC Certificate,
// Utility Bill (business address as per registration), MEMART,
// and CAC Status Report.
// ===============================================================

import type { Vendor } from "./page";

const STATUS_STYLES: Record<string, { text: string; badge: string; bg: string; color: string }> = {
  blue: { text: "Blue Verified", badge: "BLUE", bg: "#dbeafe", color: "#2563eb" },
  gray: { text: "Gray Verified", badge: "GRAY", bg: "#e2e8f0", color: "#475569" },
  none: { text: "Unverified", badge: "NONE", bg: "#e5e7eb", color: "#64748b" },
};

export default function VerificationTab({ vendor }: { vendor: Vendor }) {
  const status = vendor.verification_status || "none";
  const style = STATUS_STYLES[status] || STATUS_STYLES.none;

  const showGrayBtn = status !== "blue" && status !== "gray";
  const showBlueBtn = status !== "blue";
  const blueBtnLabel = status === "gray" ? "Upgrade to Blue Badge" : "Apply for Blue Badge";

  function applyFor(badgeType: "gray" | "blue") {
    localStorage.setItem("pendingBadgeType", badgeType);
    window.location.href = "/verify-badge";
  }

  return (
    <div className="vd-verification-layout">
      {/* LEFT */}
      <div className="vd-card vd-verification-main">
        <div className="vd-verification-header">
          <div>
            <p className="vd-verification-label">VERIFICATION STATUS</p>

            <div className="vd-verification-status-row">
              <h2>{style.text}</h2>
              <span className="vd-verification-badge" style={{ background: style.bg, color: style.color }}>
                {style.badge}
              </span>
            </div>
          </div>
        </div>

        <div className="vd-verification-divider"></div>

        <div className="vd-verification-benefits">
          <h3>Why Verify?</h3>
          <p className="vd-verification-intro">
            Verified vendors gain stronger trust, improved visibility, and better customer confidence on
            Spotlight.
          </p>

          <div className="vd-verification-grid">
            {/* GRAY */}
            <div className="vd-tier-card">
              <div className="vd-tier-top">
                <h4>Gray Badge</h4>
                <span className="vd-gray-dot"></span>
              </div>
              <p>Best for sole owners and identity verification.</p>
              <ul>
                <li>Government ID (NIN)</li>
                <li>Utility Bill (business or residential address)</li>
                <li>Passport Photograph (Recent - within last 6 months)</li>
              </ul>
            </div>

            {/* BLUE */}
            <div className="vd-tier-card">
              <div className="vd-tier-top">
                <h4>Blue Badge</h4>
                <span className="vd-blue-dot"></span>
              </div>
              <p>Best for registered companies and stronger corporate trust.</p>
              <ul>
                <li>Government ID (NIN)</li>
                <li>CAC Certificate</li>
                <li>Utility Bill (Business Address as per registration)</li>
                <li>MEMART</li>
                <li>CAC Status Report</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="vd-card vd-verification-actions-card">
        <h3 className="vd-verification-action-title">Apply for Verification</h3>
        <p className="vd-verification-side-text">Choose your preferred verification level.</p>

        <div className="vd-verification-action-buttons">
          {showGrayBtn && (
            <button type="button" className="vd-gray-verify-btn" onClick={() => applyFor("gray")}>
              Apply for Gray Badge
            </button>
          )}

          {showBlueBtn && (
            <button type="button" className="vd-blue-verify-btn" onClick={() => applyFor("blue")}>
              {blueBtnLabel}
            </button>
          )}
        </div>

        <div className="vd-verification-consent">
          By applying, you consent to Spotlight receiving and reviewing submitted verification documents for
          trust and compliance purposes.
        </div>
      </div>
    </div>
  );
}
