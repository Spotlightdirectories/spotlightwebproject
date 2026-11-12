"use client";

// ===============================================================
// Referral Rewards. Vendors who have referred other vendors.
// A vendor who has 5 fully onboarded referrals (30 days active) can be
// approved for 6 months of Standard. Nothing is granted automatically.
// ===============================================================

import { useEffect, useState, useCallback } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";

type Row = {
  vendor_id: string; name: string; email: string | null; whatsapp: string | null; plan_tier: string | null;
  signed_up: number; qualified: number; already_rewarded: boolean; granted_until: string | null;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "";

export default function ReferralRewardsTab({ currentRole }: { currentRole: AdminRole }) {
  const canApprove = currentRole === "super_admin" || currentRole === "admin";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data, error } = await adminSupabase.rpc("admin_list_referral_rewards");
    if (error) { setError(error.message); setRows([]); return; }
    setRows((data as Row[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(r: Row) {
    const ok = window.confirm(`Approve 6 months of Standard for "${r.name}"?\n\nThey have ${r.qualified} fully onboarded referrals.`);
    if (!ok) return;
    setBusy(r.vendor_id); setMsg("");
    const { data, error } = await adminSupabase.rpc("admin_approve_referral_reward", { p_vendor_id: r.vendor_id });
    setBusy(null);
    if (error) { setMsg("Failed: " + error.message); return; }
    setMsg(data === "approved" ? `${r.name}: Standard granted for 6 months.` : `${r.name}: not granted (${data}).`);
    load();
  }

  return (
    <div>
      <h1 className="adm-section-heading"><i className="fa-solid fa-gift"></i> Referral Rewards</h1>
      <p className="adm-section-note">
        Vendors who referred other vendors. A referral counts after the vendor has completed every onboarding step, has a verified email and an approved listing, and has been active for 30 days. At 5 you can approve 6 months of Standard (free-plan vendors only, once each).
      </p>
      {msg && <p className="adm-section-note"><strong>{msg}</strong></p>}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Referrer</th><th>Email</th><th>WhatsApp</th><th>Signed up</th><th>Qualified</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="adm-empty-cell">Loading…</td></tr>}
            {error && <tr><td colSpan={6} className="adm-empty-cell">Failed to load: {error}</td></tr>}
            {rows && !error && rows.length === 0 && <tr><td colSpan={6} className="adm-empty-cell">No vendor referrals yet.</td></tr>}
            {rows && rows.map((r) => {
              const free = (r.plan_tier || "free") === "free";
              return (
                <tr key={r.vendor_id}>
                  <td>{r.name}</td>
                  <td>{r.email || "—"}</td>
                  <td>{r.whatsapp || "—"}</td>
                  <td>{r.signed_up}</td>
                  <td>{r.qualified} of 5</td>
                  <td>
                    {r.already_rewarded ? `Rewarded until ${fmt(r.granted_until)}`
                      : !free ? "On a paid plan"
                      : r.qualified < 5 ? "Not yet 5"
                      : canApprove ? (
                        <button disabled={busy === r.vendor_id} onClick={() => approve(r)}>
                          {busy === r.vendor_id ? "Working…" : "Approve 6 months Standard"}
                        </button>
                      ) : "Awaiting approval"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
