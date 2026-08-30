"use client";

// ===============================================================
// src/components/UpgradePlanModal.tsx
//
// Step 3 of the locked pricing/upgrade plan, 2026-08 per Cyril.
// Replaces the plain alert() popups in ProductsTab and ServicesTab
// (and, in a later step, the Branches page) with a real modal that
// actually links to the upgrade flow, instead of just a dismissible
// browser alert with no path forward.
//
// Reuses .vd-modal-overlay / .vd-modal (already existing CSS, built
// for the visit-request caution modal) rather than introducing a new
// visual style -- stays consistent with the rest of the dashboard.
//
// Message wording is passed in by the caller (see the two exported
// message builders below) so ProductsTab/ServicesTab/Branches can
// each supply their own locked copy without duplicating this
// component three times.
// ===============================================================

import Link from "next/link";

type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
};

export default function UpgradePlanModal({ open, message, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="vd-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="vd-modal">
        <h3 className="vd-modal-title">
          <i className="fa-solid fa-circle-up"></i>
          Upgrade needed
        </h3>
        <p className="vd-modal-text">{message}</p>
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <Link
            href="/getlisted?context=upgrade"
            className="vd-primary-btn"
            style={{ textDecoration: "none", textAlign: "center", flex: 1 }}
          >
            Upgrade Plan
          </Link>
          <button
            type="button"
            className="vd-secondary-outline-btn"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

// Locked wording, 2026-08 per Cyril -- see /areas/roadmap file for
// the full agreed spec. Free-tier/trial only: 5 during the 90-day
// trial, 2 after. A generic fallback is added for the (much rarer)
// case of a PAID vendor hitting their own higher plan limit, since
// that scenario wasn't explicitly part of the locked wording but the
// code path can still reach it (e.g. Standard hitting 25) -- flagged
// here rather than left silently undefined.
export function getListingUpgradeMessage(trialActive: boolean, limit: number, planTier: string): string {
  if (!planTier || planTier === "free") {
    return trialActive
      ? `You've reached your ${limit}-listing trial limit. Upgrade to keep adding more.`
      : `You've reached your ${limit}-listing free plan limit. Upgrade to keep adding more.`;
  }
  return `You've reached your plan's limit of ${limit} listings. Upgrade to add more.`;
}

// Locked wording, 2026-08 per Cyril -- Branches step (Step 4), kept
// here alongside the listing message so both live in one place.
export const BRANCH_UPGRADE_MESSAGE = "Adding another location needs a paid plan. Upgrade to add branches.";
