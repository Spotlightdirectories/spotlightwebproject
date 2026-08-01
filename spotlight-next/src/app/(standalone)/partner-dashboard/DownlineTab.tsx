"use client";

// ===============================================================
// DownlineTab.tsx — Referred Partners table. Shows vendor counts and
// the CURRENT partner's own 5% override earnings from each downline
// partner (not the downline partner's own total earnings, which
// isn't readable under RLS and shouldn't be — see page.tsx's notes).
// ===============================================================

import type { DownlinePartner } from "./types";

type Props = {
  downline: DownlinePartner[];
  downlineVendorCounts: Record<string, number>;
  overrideByDownline: Record<string, number>;
};

export default function DownlineTab({ downline, downlineVendorCounts, overrideByDownline }: Props) {
  return (
    <div className="pd-section">
      <h2 className="pd-section-heading">Referred Partners (Downline)</h2>
      <p className="pd-section-note">
        Vendor counts and your 5% override earnings from each partner you&apos;ve referred. A downline partner&apos;s own
        total earnings aren&apos;t shown here — that&apos;s private to their account.
      </p>
      <div className="pd-table-wrap">
        <table className="pd-table">
          <thead>
            <tr><th>Partner Name</th><th>Vendors Referred</th><th>Your Override Earnings</th></tr>
          </thead>
          <tbody>
            {downline.length === 0 ? (
              <tr><td colSpan={3} className="pd-empty-cell">No referred partners.</td></tr>
            ) : (
              downline.map((d) => (
                <tr key={d.id}>
                  <td>{d.name || "—"}</td>
                  <td>{downlineVendorCounts[d.id] || 0}</td>
                  <td>₦{(overrideByDownline[d.id] || 0).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
