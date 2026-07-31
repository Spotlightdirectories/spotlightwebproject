"use client";

// ===============================================================
// src/app/(standalone)/admin/VerificationsTab.tsx
//
// Pending Badge Verifications — verification roles (super_admin,
// admin, verification_admin). Faithful port of the verification
// section of admin-payments.js.
//
// Approve sets the vendor's verification_status to the badge type
// and emails them the branded approval template. Reject prompts for
// a reason. Delete is admin cleanup (stray/test submissions). Revoke
// undoes an already-approved badge — restricted to super_admin only,
// even though this whole tab is visible to admin/verification_admin
// too (matches production: revokeVerification checks currentRole
// itself, independent of the section's own visibility gate).
// ===============================================================

import { useCallback, useEffect, useState } from "react";
import { adminSupabase, getAdminSession, type AdminRole } from "@/lib/adminSupabase";
import { EmailTemplates } from "@/lib/emailTemplates";
import { viewSignedUrl } from "@/lib/adminSignedUrl";

type VerificationRow = {
  id: string;
  vendor_id: string;
  badge_type: string | null;
  status: string | null;
  created_at: string | null;
  id_url: string | null;
  passport_photo_url: string | null;
  cac_url: string | null;
  utility_url: string | null;
  memart_url: string | null;
  status_report_url: string | null;
  vendor: { name: string | null } | null;
};

export default function VerificationsTab({ currentRole }: { currentRole: AdminRole }) {
  const [verifications, setVerifications] = useState<VerificationRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadVerifications = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("vendor_verifications")
      .select(
        "id, vendor_id, badge_type, status, created_at, id_url, passport_photo_url, cac_url, utility_url, memart_url, status_report_url, vendor:vendors ( name )"
      )
      .eq("status", "pending")
      .returns<VerificationRow[]>();

    if (error) {
      setLoadError(error.message);
      setVerifications([]);
      return;
    }
    setVerifications(data || []);
  }, []);

  useEffect(() => {
    loadVerifications();
  }, [loadVerifications]);

  async function approveVerification(verificationId: string) {
    if (!confirm("Approve this badge verification?")) return;
    setProcessingId(verificationId);

    const { data: verification } = await adminSupabase
      .from("vendor_verifications")
      .select("vendor_id, badge_type, status")
      .eq("id", verificationId)
      .single()
      .returns<{ vendor_id: string; badge_type: string | null; status: string | null }>();

    if (!verification) {
      alert("Verification not found.");
      setProcessingId(null);
      return;
    }
    if (verification.status === "rejected" || verification.status === "approved") {
      alert(`This verification is already ${verification.status}.`);
      setProcessingId(null);
      loadVerifications();
      return;
    }

    const { data: vendor } = await adminSupabase
      .from("vendors")
      .select("email, name")
      .eq("id", verification.vendor_id)
      .single()
      .returns<{ email: string | null; name: string | null }>();

    const session = getAdminSession();
    const now = new Date().toISOString();

    const { error: verUpdateError } = await adminSupabase
      .from("vendor_verifications")
      .update({ status: "approved", reviewed_at: now, reviewed_by: session?.user_id || null })
      .eq("id", verificationId);

    if (verUpdateError) {
      console.error("Verification update failed:", verUpdateError);
      alert("Failed to update verification: " + verUpdateError.message);
      setProcessingId(null);
      return;
    }

    await adminSupabase.from("vendors").update({ verification_status: verification.badge_type }).eq("id", verification.vendor_id);

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: vendor?.email,
          subject: "Verification Approved — Your Badge is Live",
          html: EmailTemplates.badgeApproved({ vendorName: vendor?.name || "", badgeType: verification.badge_type || "" }),
        }),
      });
    } catch (err) {
      console.error("Verification email failed:", err);
    }

    alert("Verification approved");
    setProcessingId(null);
    loadVerifications();
  }

  async function rejectVerification(verificationId: string) {
    const reason = prompt("Reason for rejection?");
    if (!reason) return;
    setProcessingId(verificationId);

    const { data: verification } = await adminSupabase
      .from("vendor_verifications")
      .select("vendor_id, badge_type, status")
      .eq("id", verificationId)
      .single()
      .returns<{ vendor_id: string; badge_type: string | null; status: string | null }>();

    if (!verification) {
      alert("Verification not found.");
      setProcessingId(null);
      return;
    }
    if (verification.status === "rejected" || verification.status === "approved") {
      alert(`This verification is already ${verification.status}.`);
      setProcessingId(null);
      loadVerifications();
      return;
    }

    const { data: vendor } = await adminSupabase
      .from("vendors")
      .select("email, name")
      .eq("id", verification.vendor_id)
      .single()
      .returns<{ email: string | null; name: string | null }>();

    const session = getAdminSession();
    const now = new Date().toISOString();

    await adminSupabase
      .from("vendor_verifications")
      .update({ status: "rejected", reviewed_at: now, reviewed_by: session?.user_id || null })
      .eq("id", verificationId);

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: vendor?.email,
          subject: "Verification Not Approved",
          html: EmailTemplates.badgeRejected({ vendorName: vendor?.name || "", badgeType: verification.badge_type || "", reason }),
        }),
      });
    } catch (err) {
      console.error("Verification rejection email failed:", err);
    }

    alert("Verification rejected");
    setProcessingId(null);
    loadVerifications();
  }

  async function deleteVerification(verificationId: string) {
    if (!confirm("Delete this verification submission? This cannot be undone.")) return;
    setProcessingId(verificationId);

    const { error } = await adminSupabase.from("vendor_verifications").delete().eq("id", verificationId);

    if (error) {
      alert("Failed to delete: " + error.message);
      setProcessingId(null);
      return;
    }

    alert("Verification deleted");
    setProcessingId(null);
    loadVerifications();
  }

  async function revokeVerification(verificationId: string) {
    if (currentRole !== "super_admin") {
      alert("Only Super Admin can revoke badges.");
      return;
    }

    const reason = prompt("Reason for revoking this badge? This will be sent to the vendor.");
    if (!reason) return;
    setProcessingId(verificationId);

    const { data: verification, error: fetchError } = await adminSupabase
      .from("vendor_verifications")
      .select("vendor_id, badge_type")
      .eq("id", verificationId)
      .single()
      .returns<{ vendor_id: string; badge_type: string | null }>();

    if (fetchError || !verification) {
      alert("Verification not found.");
      setProcessingId(null);
      return;
    }

    const { data: vendor } = await adminSupabase
      .from("vendors")
      .select("email, name")
      .eq("id", verification.vendor_id)
      .single()
      .returns<{ email: string | null; name: string | null }>();

    const session = getAdminSession();
    const now = new Date().toISOString();

    const { error: verError } = await adminSupabase
      .from("vendor_verifications")
      .update({ status: "revoked", reviewed_at: now, reviewed_by: session?.user_id || null, rejection_reason: reason })
      .eq("id", verificationId);

    if (verError) {
      alert("Failed to revoke verification: " + verError.message);
      setProcessingId(null);
      return;
    }

    const { error: vendorError } = await adminSupabase
      .from("vendors")
      .update({ verification_status: null })
      .eq("id", verification.vendor_id);

    if (vendorError) {
      alert("Badge removed from verification but vendor profile update failed: " + vendorError.message);
      setProcessingId(null);
      return;
    }

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: vendor?.email,
          subject: "Your Spotlight Verification Badge Has Been Revoked",
          html: EmailTemplates.badgeRevoked({ vendorName: vendor?.name || "", badgeType: verification.badge_type || "", reason }),
        }),
      });
    } catch (err) {
      console.error("Revocation email failed:", err);
    }

    alert("Badge revoked and vendor notified");
    setProcessingId(null);
    loadVerifications();
  }

  return (
    <div>
      <h1 className="adm-section-heading">Pending Badge Verifications</h1>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Vendor</th><th>Badge Type</th><th>Submitted</th><th>Documents</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {verifications === null && <tr><td colSpan={6} className="adm-empty-cell">Loading…</td></tr>}
            {verifications !== null && loadError && (
              <tr><td colSpan={6} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {verifications !== null && !loadError && verifications.length === 0 && (
              <tr><td colSpan={6} className="adm-empty-cell">✓ All caught up — no pending verifications.</td></tr>
            )}
            {verifications?.map((v) => (
              <tr key={v.id}>
                <td>{v.vendor?.name || "—"}</td>
                <td>{v.badge_type || "—"}</td>
                <td>{v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}</td>
                <td>
                  <DocLink label="ID" bucket="vendor-verifications" path={v.id_url} />
                  <DocLink label="Passport" bucket="vendor-verifications" path={v.passport_photo_url} />
                  <DocLink label="CAC" bucket="vendor-verifications" path={v.cac_url} />
                  <DocLink label="Utility" bucket="vendor-verifications" path={v.utility_url} />
                  <DocLink label="MEMART" bucket="vendor-verifications" path={v.memart_url} />
                  <DocLink label="Status Report" bucket="vendor-verifications" path={v.status_report_url} last />
                </td>
                <td>{v.status || "—"}</td>
                <td>
                  <button className="adm-btn adm-approve-btn" disabled={processingId === v.id} onClick={() => approveVerification(v.id)}>
                    {processingId === v.id ? "Processing..." : "Approve"}
                  </button>{" "}
                  <button className="adm-btn adm-reject-btn" disabled={processingId === v.id} onClick={() => rejectVerification(v.id)}>
                    Reject
                  </button>{" "}
                  <button
                    className="adm-btn adm-reject-btn"
                    style={{ background: "#64748b" }}
                    disabled={processingId === v.id}
                    onClick={() => deleteVerification(v.id)}
                  >
                    Delete
                  </button>
                  {currentRole === "super_admin" && (
                    <>
                      {" "}
                      <button
                        className="adm-btn adm-reject-btn"
                        disabled={processingId === v.id}
                        onClick={() => revokeVerification(v.id)}
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocLink({ label, bucket, path, last = false }: { label: string; bucket: string; path: string | null; last?: boolean }) {
  if (!path) return null;
  return (
    <>
      <button
        type="button"
        className="adm-btn"
        style={{ background: "transparent", color: "#2563eb", textDecoration: "underline", padding: 0, fontSize: 11 }}
        onClick={() => viewSignedUrl(bucket, path)}
      >
        {label}
      </button>
      {!last && " | "}
    </>
  );
}
