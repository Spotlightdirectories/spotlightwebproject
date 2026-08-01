"use client";

// ===============================================================
// AccountTab.tsx — Partner Since, computed Account Status, and the
// Close Account action. Restore (when already closing) is shown as a
// banner at the top of the whole dashboard, not inside this tab —
// same as admin's global notices — so it's visible no matter which
// tab a partner has open.
// ===============================================================

import type { PartnerRow } from "./types";

type Props = {
  partner: PartnerRow;
  accountStatus: string;
  onClose: () => void;
};

export default function AccountTab({ partner, accountStatus, onClose }: Props) {
  return (
    <div className="pd-section">
      <h2 className="pd-section-heading">Account</h2>
      <div className="pd-account-row"><span>Partner Since</span><span>{new Date(partner.created_at).toLocaleDateString()}</span></div>
      <div className="pd-account-row">
        <span>Account Status</span>
        <span className={`pd-status-badge pd-status-${accountStatus.toLowerCase()}`}>{accountStatus}</span>
      </div>
      {!partner.scheduled_deletion_at && (
        <div className="pd-account-actions">
          <button className="pd-danger-btn" onClick={onClose}>Close Account</button>
        </div>
      )}
    </div>
  );
}
