"use client";

// ===============================================================
// src/app/(standalone)/admin/PartnerApprovalsTab.tsx
//
// Pending Partner Approvals — admin and super_admin only. Faithful
// port of the approvePartner/rejectPartner sections of
// admin-payments.js.
//
// Approve generates a referral code and emails the partner via
// EmailTemplates.partnerApproved (referral links + a "create your
// account" link). Reject prompts for a reason and emails
// partnerRejected.
//
// NOTE (2026-07-31): the partner-facing pages this approval email
// links to (/partner-program, /partner-create-account) don't exist
// in Staging yet — that's the separate "Partner dashboard" stage on
// Cyril's roadmap, after Admin. Approving a partner here works fully
// (status + referral code + email), but those links will 404 until
// that stage is built.
// ===============================================================

import { useCallback, useEffect, useState } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";
import { EmailTemplates } from "@/lib/emailTemplates";

type PartnerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  local_government: string | null;
  status: string | null;
};

export default function PartnerApprovalsTab({ currentRole }: { currentRole: AdminRole }) {
  void currentRole;

  const [partners, setPartners] = useState<PartnerRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPartners = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("partners")
      .select("id, name, phone, email, state, local_government, status")
      .eq("status", "pending")
      .returns<PartnerRow[]>();

    if (error) {
      setLoadError(error.message);
      setPartners([]);
      return;
    }
    setPartners(data || []);
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  async function approvePartner(partnerId: string) {
    if (!confirm("Approve this partner?")) return;
    setProcessingId(partnerId);

    const { data: partner, error } = await adminSupabase
      .from("partners")
      .select("id, name, email, status")
      .eq("id", partnerId)
      .single()
      .returns<{ id: string; name: string | null; email: string | null; status: string | null }>();

    if (error || !partner) {
      alert("Partner not found.");
      setProcessingId(null);
      return;
    }
    if (partner.status === "approved") {
      alert("This partner is already approved.");
      setProcessingId(null);
      loadPartners();
      return;
    }

    const referralCode = "SPOT" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error: updateError } = await adminSupabase
      .from("partners")
      .update({ status: "approved", referral_code: referralCode })
      .eq("id", partnerId);

    if (updateError) {
      alert("Failed to approve partner: " + updateError.message);
      setProcessingId(null);
      return;
    }

    if (!partner.email) {
      alert("Partner has no email. Cannot send approval email.");
      setProcessingId(null);
      loadPartners();
      return;
    }

    const origin = window.location.origin;
    const vendorReferralLink = `${origin}/getlisted?ref=${referralCode}`;
    const partnerReferralLink = `${origin}/partner-program?ref=${referralCode}`;

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: partner.email,
          subject: "You're Approved — Welcome to the Spotlight Partner Programme",
          html: EmailTemplates.partnerApproved({
            partnerName: partner.name || "",
            referralCode,
            vendorReferralLink,
            partnerReferralLink,
            inductionLink: `${origin}/partner-legal#assets`,
            createAccountLink: `${origin}/partner-create-account?partner_id=${partner.id}`,
          }),
        }),
      });
    } catch (err) {
      console.error("Partner approval email failed:", err);
    }

    await adminSupabase.from("partners").update({ notification_sent: true }).eq("id", partnerId);

    alert("Partner approved and email sent");
    setProcessingId(null);
    loadPartners();
  }

  async function rejectPartner(partnerId: string) {
    const reason = prompt("Reason for rejection?");
    if (!reason) return;
    setProcessingId(partnerId);

    const { data: partner, error } = await adminSupabase
      .from("partners")
      .select("id, name, email, status")
      .eq("id", partnerId)
      .single()
      .returns<{ id: string; name: string | null; email: string | null; status: string | null }>();

    if (error || !partner) {
      alert("Partner not found.");
      setProcessingId(null);
      return;
    }
    if (partner.status === "rejected") {
      alert("This partner is already rejected.");
      setProcessingId(null);
      loadPartners();
      return;
    }

    const { error: updateError } = await adminSupabase.from("partners").update({ status: "rejected" }).eq("id", partnerId);

    if (updateError) {
      alert("Failed to reject partner.");
      setProcessingId(null);
      return;
    }

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: partner.email,
          subject: "Update on Your Partner Application",
          html: EmailTemplates.partnerRejected({
            partnerName: partner.name || "",
            reason,
            programUrl: `${window.location.origin}/partner-program`,
          }),
        }),
      });
    } catch (err) {
      console.error("Partner rejection email failed:", err);
    }

    await adminSupabase.from("partners").update({ notification_sent: true }).eq("id", partnerId);

    alert("Partner rejected and email sent");
    setProcessingId(null);
    loadPartners();
  }

  return (
    <div>
      <h1 className="adm-section-heading">Pending Partner Approvals</h1>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Name</th><th>Phone</th><th>State</th><th>LGA</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {partners === null && <tr><td colSpan={6} className="adm-empty-cell">Loading…</td></tr>}
            {partners !== null && loadError && (
              <tr><td colSpan={6} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {partners !== null && !loadError && partners.length === 0 && (
              <tr><td colSpan={6} className="adm-empty-cell">✓ All caught up — no pending partner applications.</td></tr>
            )}
            {partners?.map((p) => (
              <tr key={p.id}>
                <td>{p.name || "—"}</td>
                <td>{p.phone || "—"}</td>
                <td>{p.state || "—"}</td>
                <td>{p.local_government || "—"}</td>
                <td>{p.status || "—"}</td>
                <td>
                  <button className="adm-btn adm-approve-btn" disabled={processingId === p.id} onClick={() => approvePartner(p.id)}>
                    {processingId === p.id ? "Processing..." : "Approve"}
                  </button>{" "}
                  <button className="adm-btn adm-reject-btn" disabled={processingId === p.id} onClick={() => rejectPartner(p.id)}>
                    Reject
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
