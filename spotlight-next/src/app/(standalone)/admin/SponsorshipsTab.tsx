"use client";

// ===============================================================
// src/app/(standalone)/admin/SponsorshipsTab.tsx
//
// Pending Sponsorships (bank transfer) — finance roles (super_admin,
// admin, finance_admin). Faithful port of the sponsorship section of
// admin-payments.js.
//
// Approve/Reject act on the WHOLE batch (every row sharing the same
// batch_id — i.e. everything from one checkout), not just the row
// clicked, so a bundle purchase is never left partly approved and
// partly pending. Delete only removes the single clicked row — it's
// for cleaning up stray/test data, not for undoing a real purchase.
// ===============================================================

import { useCallback, useEffect, useState } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";
import { EmailTemplates } from "@/lib/emailTemplates";
import { viewSignedUrl } from "@/lib/adminSignedUrl";

type SponsorshipRow = {
  id: string;
  vendor_id: string;
  batch_id: string | null;
  sponsorship_type: string | null;
  tier: string | null;
  billing_cycle: string | null;
  amount_paid: number | string | null;
  receipt_url: string | null;
  payment_status: string | null;
  vendors: { id: string; name: string | null; email: string | null } | null;
};

const TYPE_LABELS: Record<string, string> = {
  business: "your business",
  product: "your product(s)",
  service: "your service(s)",
};

export default function SponsorshipsTab({ currentRole }: { currentRole: AdminRole }) {
  void currentRole;

  const [sponsorships, setSponsorships] = useState<SponsorshipRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadSponsorships = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("vendor_sponsorships")
      .select(
        "id, vendor_id, batch_id, sponsorship_type, tier, billing_cycle, amount_paid, receipt_url, payment_status, vendors ( id, name, email )"
      )
      .eq("payment_method", "bank_transfer")
      .eq("payment_status", "pending")
      .returns<SponsorshipRow[]>();

    if (error) {
      setLoadError(error.message);
      setSponsorships([]);
      return;
    }
    setSponsorships(data || []);
  }, []);

  useEffect(() => {
    loadSponsorships();
  }, [loadSponsorships]);

  async function approveSponsorship(sponsorshipId: string) {
    if (
      !confirm(
        "Approve this sponsorship? If it was part of a bundle purchase, every item in that same purchase will be approved together."
      )
    )
      return;
    setProcessingId(sponsorshipId);

    const { data: sponsorship, error } = await adminSupabase
      .from("vendor_sponsorships")
      .select("id, vendor_id, batch_id, sponsorship_type, tier, billing_cycle, payment_status, vendors ( id, name, email )")
      .eq("id", sponsorshipId)
      .single()
      .returns<SponsorshipRow>();

    if (error || !sponsorship) {
      alert("Sponsorship not found.");
      setProcessingId(null);
      return;
    }

    if (sponsorship.payment_status !== "pending") {
      alert("This sponsorship is already processed.");
      setProcessingId(null);
      return;
    }

    const now = new Date();
    const expiry =
      sponsorship.billing_cycle === "monthly"
        ? new Date(new Date(now).setDate(now.getDate() + 30))
        : new Date(new Date(now).setDate(now.getDate() + 365));

    // Every sibling row from the same purchase (same batch_id) moves
    // together. Legacy rows with no batch_id just act on themselves.
    let updateError;
    if (sponsorship.batch_id) {
      ({ error: updateError } = await adminSupabase
        .from("vendor_sponsorships")
        .update({ payment_status: "active", starts_at: now.toISOString(), expires_at: expiry.toISOString() })
        .eq("payment_status", "pending")
        .eq("batch_id", sponsorship.batch_id));
    } else {
      ({ error: updateError } = await adminSupabase
        .from("vendor_sponsorships")
        .update({ payment_status: "active", starts_at: now.toISOString(), expires_at: expiry.toISOString() })
        .eq("payment_status", "pending")
        .eq("id", sponsorshipId));
    }

    if (updateError) {
      console.error("Sponsorship update failed:", updateError);
      alert("Failed to update sponsorship record.");
      setProcessingId(null);
      return;
    }

    const typeLabel = TYPE_LABELS[sponsorship.sponsorship_type || ""] || "your listing";

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sponsorship.vendors?.email,
          subject: "Sponsorship Approved 🎉",
          html: EmailTemplates.sponsorshipApproved({
            vendorName: sponsorship.vendors?.name || "",
            tier: sponsorship.tier || "",
            typeLabel,
            expiresAt: expiry.toISOString(),
          }),
        }),
      });
    } catch (err) {
      console.error("Sponsorship approval email failed:", err);
    }

    alert("Sponsorship approved");
    setProcessingId(null);
    loadSponsorships();
  }

  async function rejectSponsorship(sponsorshipId: string) {
    const reason = prompt(
      "Reason for rejection? If this was part of a bundle purchase, every item in that same purchase will be rejected together."
    );
    if (!reason) return;
    setProcessingId(sponsorshipId);

    const { data: sponsorship, error } = await adminSupabase
      .from("vendor_sponsorships")
      .select("id, vendor_id, batch_id, sponsorship_type, tier, payment_status, vendors ( id, name, email )")
      .eq("id", sponsorshipId)
      .single()
      .returns<SponsorshipRow>();

    if (error || !sponsorship) {
      alert("Sponsorship not found.");
      setProcessingId(null);
      return;
    }

    if (sponsorship.payment_status !== "pending") {
      alert("This sponsorship is already processed.");
      setProcessingId(null);
      return;
    }

    let updateError;
    if (sponsorship.batch_id) {
      ({ error: updateError } = await adminSupabase
        .from("vendor_sponsorships")
        .update({ payment_status: "rejected" })
        .eq("payment_status", "pending")
        .eq("batch_id", sponsorship.batch_id));
    } else {
      ({ error: updateError } = await adminSupabase
        .from("vendor_sponsorships")
        .update({ payment_status: "rejected" })
        .eq("payment_status", "pending")
        .eq("id", sponsorshipId));
    }

    if (updateError) {
      console.error("Sponsorship rejection failed:", updateError);
      alert("Failed to update sponsorship record.");
      setProcessingId(null);
      return;
    }

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sponsorship.vendors?.email,
          subject: "Sponsorship Payment Could Not Be Verified",
          html: EmailTemplates.sponsorshipRejected({ vendorName: sponsorship.vendors?.name || "", reason }),
        }),
      });
    } catch (err) {
      console.error("Sponsorship rejection email failed:", err);
    }

    alert("Sponsorship rejected");
    setProcessingId(null);
    loadSponsorships();
  }

  async function deleteSponsorship(sponsorshipId: string) {
    if (
      !confirm(
        "Delete this sponsorship record? This cannot be undone. Only this one row will be removed, not any related items from the same purchase."
      )
    )
      return;
    setProcessingId(sponsorshipId);

    const { error } = await adminSupabase.from("vendor_sponsorships").delete().eq("id", sponsorshipId);

    if (error) {
      alert("Failed to delete: " + error.message);
      setProcessingId(null);
      return;
    }

    alert("Sponsorship record deleted");
    setProcessingId(null);
    loadSponsorships();
  }

  return (
    <div>
      <h1 className="adm-section-heading">Pending Sponsorships</h1>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Vendor</th><th>Type</th><th>Tier</th><th>Billing</th><th>Amount</th><th>Receipt</th><th>Action</th></tr>
          </thead>
          <tbody>
            {sponsorships === null && <tr><td colSpan={7} className="adm-empty-cell">Loading…</td></tr>}
            {sponsorships !== null && loadError && (
              <tr><td colSpan={7} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {sponsorships !== null && !loadError && sponsorships.length === 0 && (
              <tr><td colSpan={7} className="adm-empty-cell">✓ All caught up — no pending sponsorships.</td></tr>
            )}
            {sponsorships?.map((s) => (
              <tr key={s.id}>
                <td>{s.vendors?.name || "—"}</td>
                <td>{s.sponsorship_type || "—"}</td>
                <td>{s.tier || "—"}</td>
                <td>{s.billing_cycle || "—"}</td>
                <td>{s.amount_paid ? `₦${Number(s.amount_paid).toLocaleString()}` : "—"}</td>
                <td>
                  {s.receipt_url ? (
                    <button
                      type="button"
                      className="adm-btn"
                      style={{ background: "transparent", color: "#2563eb", textDecoration: "underline", padding: 0 }}
                      onClick={() => viewSignedUrl("sponsorship-receipts", s.receipt_url)}
                    >
                      View
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <button className="adm-btn adm-approve-btn" disabled={processingId === s.id} onClick={() => approveSponsorship(s.id)}>
                    {processingId === s.id ? "Processing..." : "Approve"}
                  </button>{" "}
                  <button className="adm-btn adm-reject-btn" disabled={processingId === s.id} onClick={() => rejectSponsorship(s.id)}>
                    Reject
                  </button>{" "}
                  <button
                    className="adm-btn adm-reject-btn"
                    style={{ background: "#64748b" }}
                    disabled={processingId === s.id}
                    onClick={() => deleteSponsorship(s.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
