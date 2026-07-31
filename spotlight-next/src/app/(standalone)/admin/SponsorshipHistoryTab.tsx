"use client";

// ===============================================================
// src/app/(standalone)/admin/SponsorshipHistoryTab.tsx
//
// Sponsorship History — finance roles (super_admin, admin,
// finance_admin). Faithful port of loadSponsorshipHistory/
// renderSponsorshipHistory in admin-payments.js (lines ~2159-2261).
// Read-only: every bank-transfer sponsorship that's active, rejected,
// or expired, searchable by vendor name and filterable by status.
// ===============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";
import { viewSignedUrl } from "@/lib/adminSignedUrl";

type SponsorshipHistoryRow = {
  id: string;
  sponsorship_type: string | null;
  tier: string | null;
  billing_cycle: string | null;
  amount_paid: number | string | null;
  expires_at: string | null;
  payment_status: string | null;
  receipt_url: string | null;
  vendors: { name: string | null } | null;
};

export default function SponsorshipHistoryTab({ currentRole }: { currentRole: AdminRole }) {
  void currentRole;

  const [sponsorships, setSponsorships] = useState<SponsorshipHistoryRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadSponsorships = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("vendor_sponsorships")
      .select(
        "id, sponsorship_type, tier, billing_cycle, amount_paid, expires_at, payment_status, receipt_url, vendors ( name )"
      )
      .eq("payment_method", "bank_transfer")
      .in("payment_status", ["active", "rejected", "expired"])
      .order("expires_at", { ascending: false })
      .returns<SponsorshipHistoryRow[]>();

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

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (sponsorships || []).filter((s) => {
      const nameMatch = (s.vendors?.name || "").toLowerCase().includes(term);
      const statusMatch = statusFilter === "all" || s.payment_status === statusFilter;
      return nameMatch && statusMatch;
    });
  }, [sponsorships, search, statusFilter]);

  return (
    <div>
      <h1 className="adm-section-heading">Sponsorship History</h1>

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
          <option value="active">Active</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Vendor</th><th>Type</th><th>Tier</th><th>Billing</th><th>Amount</th><th>Expires</th><th>Status</th><th>Receipt</th></tr>
          </thead>
          <tbody>
            {sponsorships === null && <tr><td colSpan={8} className="adm-empty-cell">Loading…</td></tr>}
            {sponsorships !== null && loadError && (
              <tr><td colSpan={8} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {sponsorships !== null && !loadError && sponsorships.length === 0 && (
              <tr><td colSpan={8} className="adm-empty-cell">No reviewed sponsorships yet.</td></tr>
            )}
            {sponsorships !== null && !loadError && sponsorships.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={8} className="adm-empty-cell">No results found.</td></tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.vendors?.name || "—"}</td>
                <td>{s.sponsorship_type || "—"}</td>
                <td>{s.tier || "—"}</td>
                <td>{s.billing_cycle || "—"}</td>
                <td>{s.amount_paid ? `₦${Number(s.amount_paid).toLocaleString()}` : "—"}</td>
                <td>{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}</td>
                <td>
                  <span className={`adm-status-badge adm-status-${s.payment_status}`}>{s.payment_status || "—"}</span>
                </td>
                <td>
                  {s.receipt_url ? (
                    <button
                      type="button"
                      className="adm-btn"
                      style={{ background: "transparent", color: "#2563eb", textDecoration: "underline", padding: 0 }}
                      onClick={() => viewSignedUrl("sponsorship-receipts", s.receipt_url)}
                    >
                      View Receipt
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
    </div>
  );
}
