"use client";

// ===============================================================
// src/app/(standalone)/admin/CommissionsTab.tsx
//
// Commissions — finance roles (super_admin, admin, finance_admin).
//
// Faithful port of admin-payments.js's commission summary + ledger
// (lines ~690-787, 1990-2046, 1719-1754 for payPartner), with one
// deliberate improvement: production's ledger query never selected
// the `type` column, so the table never showed whether a row was a
// direct "vendor" commission, an upline "override" (5%), or a
// monthly "bonus" (₦30,000/50 yearly commissions) — all three types
// are real and already being written by the `handle_commission_on_payment`
// DB trigger (confirmed live 2026-07-31), just invisible in the old
// admin UI. Added here as a Type column + filter option.
//
// The actual commission MATH is not done here or anywhere in this
// app — it's computed automatically by that Postgres trigger the
// moment a vendor_payments row flips to 'confirmed', and unlocked
// from "pending" to "available" by an hourly pg_cron job
// (unlock-commissions-job). This tab is purely a read + one write
// (marking a partner's available commissions as paid) — same as
// production.
// ===============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";

type CommissionRow = {
  amount: number | string | null;
  status: string | null;
  type: string | null;
  created_at: string | null;
  partners: { id: string; name: string | null; referral_code: string | null; status: string | null } | null;
  vendors: { name: string | null } | null;
  vendor_payments: { plan: string | null } | null;
};

type PartnerSummary = {
  id: string;
  name: string;
  code: string;
  pending: number;
  available: number;
  paid: number;
};

const TYPE_LABELS: Record<string, string> = {
  vendor: "Direct",
  override: "Override",
  bonus: "Bonus",
};

export default function CommissionsTab({ currentRole }: { currentRole: AdminRole }) {
  void currentRole;

  const [commissions, setCommissions] = useState<CommissionRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadCommissions = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("commissions")
      .select(
        `
        amount,
        status,
        type,
        created_at,
        partners ( id, name, referral_code, status ),
        vendors ( name ),
        vendor_payments ( plan )
      `
      )
      .order("created_at", { ascending: false })
      .returns<CommissionRow[]>();

    if (error) {
      setLoadError(error.message);
      setCommissions([]);
      return;
    }
    setCommissions(data || []);
  }, []);

  useEffect(() => {
    loadCommissions();
  }, [loadCommissions]);

  // ---------------------------------------------------------------
  // SUMMARY BY PARTNER — totals across every commission type
  // combined (direct + override + bonus), bucketed by status.
  // ---------------------------------------------------------------
  const summary = useMemo<PartnerSummary[]>(() => {
    const map: Record<string, PartnerSummary> = {};
    (commissions || []).forEach((c) => {
      const partnerId = c.partners?.id || "unknown";
      if (!map[partnerId]) {
        map[partnerId] = {
          id: c.partners?.id || "",
          name: c.partners?.name || "—",
          code: c.partners?.referral_code || "—",
          pending: 0,
          available: 0,
          paid: 0,
        };
      }
      const amount = Number(c.amount || 0) / 100;
      if (c.status === "pending") map[partnerId].pending += amount;
      if (c.status === "available") map[partnerId].available += amount;
      if (c.status === "paid") map[partnerId].paid += amount;
    });
    return Object.values(map);
  }, [commissions]);

  const filteredLedger = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (commissions || []).filter((c) => {
      const nameMatch =
        (c.partners?.name || "").toLowerCase().includes(term) || (c.vendors?.name || "").toLowerCase().includes(term);
      const statusMatch = statusFilter === "all" || c.status === statusFilter;
      return nameMatch && statusMatch;
    });
  }, [commissions, search, statusFilter]);

  async function payPartner(partnerId: string, partnerName: string) {
    if (!confirm(`Mark all available commissions as paid for ${partnerName}?`)) return;
    setPayingId(partnerId);

    const { error } = await adminSupabase
      .from("commissions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("partner_id", partnerId)
      .eq("status", "available");

    if (error) {
      alert("Failed to mark commissions as paid: " + error.message);
      setPayingId(null);
      return;
    }

    alert("Partner commissions marked as paid");
    setPayingId(null);
    loadCommissions();
  }

  return (
    <div>
      <h1 className="adm-section-heading">Commission Summary (By Partner)</h1>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Referral Code</th>
              <th>Pending</th>
              <th>Available</th>
              <th>Paid</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {commissions === null && <tr><td colSpan={6} className="adm-empty-cell">Loading…</td></tr>}
            {commissions !== null && loadError && (
              <tr><td colSpan={6} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {commissions !== null && !loadError && summary.length === 0 && (
              <tr>
                <td colSpan={6} className="adm-empty-cell">
                  ✓ No commissions recorded yet. They will appear automatically when referred vendors make payments.
                </td>
              </tr>
            )}
            {summary.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.code !== "—" ? <strong>{p.code}</strong> : "—"}</td>
                <td>₦{Math.round(p.pending).toLocaleString()}</td>
                <td>₦{Math.round(p.available).toLocaleString()}</td>
                <td>₦{Math.round(p.paid).toLocaleString()}</td>
                <td>
                  {p.available > 0 ? (
                    <button className="adm-btn adm-approve-btn" disabled={payingId === p.id} onClick={() => payPartner(p.id, p.name)}>
                      {payingId === p.id ? "Processing..." : "Pay"}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h1 className="adm-section-heading" style={{ marginTop: 32 }}>All Commissions</h1>

      <div className="adm-review-history-controls">
        <input
          type="text"
          placeholder="Search by partner or vendor name..."
          className="adm-history-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="adm-history-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="available">Available</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Referral Code</th>
              <th>Vendor</th>
              <th>Plan</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Partner Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {commissions === null && <tr><td colSpan={9} className="adm-empty-cell">Loading…</td></tr>}
            {commissions !== null && loadError && (
              <tr><td colSpan={9} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {commissions !== null && !loadError && commissions.length === 0 && (
              <tr><td colSpan={9} className="adm-empty-cell">✓ No commissions recorded yet.</td></tr>
            )}
            {commissions !== null && !loadError && commissions.length > 0 && filteredLedger.length === 0 && (
              <tr><td colSpan={9} className="adm-empty-cell">No results found.</td></tr>
            )}
            {filteredLedger.map((c, i) => (
              <tr key={i}>
                <td>{c.partners?.name || "—"}</td>
                <td>{c.partners?.referral_code || "—"}</td>
                <td>{c.vendors?.name || "—"}</td>
                <td>{c.vendor_payments?.plan || "—"}</td>
                <td>{c.type ? TYPE_LABELS[c.type] || c.type : "—"}</td>
                <td>₦{(Number(c.amount || 0) / 100).toLocaleString()}</td>
                <td>
                  <span className={`adm-status-badge adm-status-${c.status}`}>{c.status || "—"}</span>
                </td>
                <td>{c.partners?.status || "—"}</td>
                <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
