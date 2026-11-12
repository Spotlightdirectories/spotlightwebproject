"use client";

// ===============================================================
// Removal Review. Free vendors with no product or service who have
// passed their onboarding deadline. Nothing is removed until an admin
// presses Approve on a row. Approving closes the account and the daily
// erase routine then removes it (about 02:45 UTC next run).
// ===============================================================

import { useEffect, useState, useCallback } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";

type Row = {
  vendor_id: string; name: string; email: string | null; slug: string | null;
  created_at: string; onboarding_deadline: string;
  notice1_sent_at: string | null; final_notice_sent_at: string | null; deadline_passed: boolean;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "Not sent";

export default function RemovalReviewTab({ currentRole }: { currentRole: AdminRole }) {
  const canApprove = currentRole === "super_admin" || currentRole === "admin";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data, error } = await adminSupabase.rpc("admin_list_onboarding_review");
    if (error) { setError(error.message); setRows([]); return; }
    setRows((data as Row[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(r: Row) {
    const ok = window.confirm(
      `Approve removal of "${r.name}"?\n\nTheir account will be closed and then permanently erased by the daily routine. This cannot be undone.`
    );
    if (!ok) return;
    setBusy(r.vendor_id); setMsg("");
    const { data, error } = await adminSupabase.rpc("admin_approve_vendor_removal", { p_vendor_id: r.vendor_id });
    setBusy(null);
    if (error) { setMsg("Failed: " + error.message); return; }
    setMsg(data === "approved" ? `${r.name}: approved. It will be erased at the next daily run.` : `${r.name}: not removed (${data}).`);
    load();
  }

  return (
    <div>
      <h1 className="adm-section-heading"><i className="fa-solid fa-user-slash"></i> Removal Review</h1>
      <p className="adm-section-note">
        Free vendors with no product or service. They are hidden from the public. Only vendors past their deadline can be approved for removal. Paid vendors never appear here.
      </p>
      {msg && <p className="adm-section-note"><strong>{msg}</strong></p>}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Business</th><th>Email</th><th>Deadline</th><th>First notice</th><th>Final warning</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="adm-empty-cell">Loading…</td></tr>}
            {error && <tr><td colSpan={6} className="adm-empty-cell">Failed to load: {error}</td></tr>}
            {rows && !error && rows.length === 0 && <tr><td colSpan={6} className="adm-empty-cell">No vendors in this list.</td></tr>}
            {rows && rows.map((r) => (
              <tr key={r.vendor_id}>
                <td>{r.name}</td>
                <td>{r.email || "—"}</td>
                <td>{fmt(r.onboarding_deadline)}{r.deadline_passed ? " (passed)" : ""}</td>
                <td>{fmt(r.notice1_sent_at)}</td>
                <td>{fmt(r.final_notice_sent_at)}</td>
                <td>
                  {canApprove && r.deadline_passed ? (
                    <button disabled={busy === r.vendor_id} onClick={() => approve(r)}>
                      {busy === r.vendor_id ? "Working…" : "Approve removal"}
                    </button>
                  ) : "Waiting for deadline"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
