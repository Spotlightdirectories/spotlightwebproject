"use client";

// ===============================================================
// src/app/(standalone)/admin/VerificationHistoryTab.tsx
//
// Verification History — verification roles (super_admin, admin,
// verification_admin). Faithful port of loadVerificationHistory/
// renderVerificationHistory in admin-payments.js (lines ~2274-2383).
// Read-only list of every approved/rejected/revoked badge
// verification, searchable by vendor name and filterable by status,
// with signed-URL document links.
//
// Production also puts a "Revoke" button here (not just in Pending
// Verifications) for any row still "approved" — since once approved,
// a verification leaves the Pending tab and only lives here. Ported
// faithfully: super_admin only, same revoke logic as
// VerificationsTab.tsx (status -> revoked, vendor's verification_status
// cleared, vendor notified via EmailTemplates.badgeRevoked).
// ===============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminSupabase, getAdminSession, type AdminRole } from "@/lib/adminSupabase";
import { EmailTemplates } from "@/lib/emailTemplates";
import { viewSignedUrl } from "@/lib/adminSignedUrl";

type VerificationHistoryRow = {
  id: string;
  vendor_id: string;
  badge_type: string | null;
  status: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  id_url: string | null;
  passport_photo_url: string | null;
  cac_url: string | null;
  utility_url: string | null;
  memart_url: string | null;
  status_report_url: string | null;
  vendor: { name: string | null } | null;
};

export default function VerificationHistoryTab({ currentRole }: { currentRole: AdminRole }) {
  const [verifications, setVerifications] = useState<VerificationHistoryRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadVerifications = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("vendor_verifications")
      .select(
        "id, vendor_id, badge_type, status, created_at, reviewed_at, id_url, passport_photo_url, cac_url, utility_url, memart_url, status_report_url, vendor:vendors ( name )"
      )
      .in("status", ["approved", "rejected", "revoked"])
      .order("reviewed_at", { ascending: false })
      .returns<VerificationHistoryRow[]>();

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

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (verifications || []).filter((v) => {
      const nameMatch = (v.vendor?.name || "").toLowerCase().includes(term);
      const statusMatch = statusFilter === "all" || v.status === statusFilter;
      return nameMatch && statusMatch;
    });
  }, [verifications, search, statusFilter]);

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
      <h1 className="adm-section-heading">Verification History</h1>

      <div className="adm-review-history-controls">
        <input
          type="text"
          placeholder="Search by vendor name..."
          className="adm-history-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="adm-history-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Vendor</th><th>Badge Type</th><th>Submitted</th><th>Reviewed</th><th>Status</th><th>Documents</th><th>Action</th></tr>
          </thead>
          <tbody>
            {verifications === null && <tr><td colSpan={7} className="adm-empty-cell">Loading…</td></tr>}
            {verifications !== null && loadError && (
              <tr><td colSpan={7} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {verifications !== null && !loadError && verifications.length === 0 && (
              <tr><td colSpan={7} className="adm-empty-cell">No reviewed verifications yet.</td></tr>
            )}
            {verifications !== null && !loadError && verifications.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={7} className="adm-empty-cell">No results found.</td></tr>
            )}
            {filtered.map((v) => (
              <tr key={v.id}>
                <td>{v.vendor?.name || "—"}</td>
                <td>{v.badge_type || "—"}</td>
                <td>{v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}</td>
                <td>{v.reviewed_at ? new Date(v.reviewed_at).toLocaleDateString() : "Not recorded"}</td>
                <td>
                  <span className={`adm-status-badge adm-status-${v.status}`}>{v.status || "—"}</span>
                </td>
                <td>
                  <DocLink label="ID" bucket="vendor-verifications" path={v.id_url} />
                  <DocLink label="Passport" bucket="vendor-verifications" path={v.passport_photo_url} />
                  <DocLink label="CAC" bucket="vendor-verifications" path={v.cac_url} />
                  <DocLink label="Utility" bucket="vendor-verifications" path={v.utility_url} />
                  <DocLink label="MEMART" bucket="vendor-verifications" path={v.memart_url} />
                  <DocLink label="Status Report" bucket="vendor-verifications" path={v.status_report_url} last />
                </td>
                <td>
                  {currentRole === "super_admin" && v.status === "approved" && (
                    <button
                      className="adm-btn adm-reject-btn"
                      disabled={processingId === v.id}
                      onClick={() => revokeVerification(v.id)}
                    >
                      {processingId === v.id ? "Processing..." : "Revoke"}
                    </button>
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
