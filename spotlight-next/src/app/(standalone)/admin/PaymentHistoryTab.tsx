"use client";

// ===============================================================
// src/app/(standalone)/admin/PaymentHistoryTab.tsx
//
// Payment History — finance roles (super_admin, admin, finance_admin).
// Faithful port of loadPaymentHistory/renderPaymentHistory in
// admin-payments.js (lines ~2057-2155). Read-only: every bank-
// transfer payment already confirmed or rejected, searchable by
// vendor name and filterable by status, with a signed-URL link back
// to the original receipt for audit purposes.
// ===============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";
import { viewSignedUrl } from "@/lib/adminSignedUrl";

type PaymentHistoryRow = {
  id: string;
  plan: string | null;
  billing_type: string | null;
  amount: number | string | null;
  status: string | null;
  transfer_proof_url: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  vendors: { name: string | null } | null;
};

export default function PaymentHistoryTab({ currentRole }: { currentRole: AdminRole }) {
  void currentRole;

  const [payments, setPayments] = useState<PaymentHistoryRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadPayments = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("vendor_payments")
      .select(
        "id, plan, billing_type, amount, status, transfer_proof_url, reviewed_at, rejection_reason, vendors ( name )"
      )
      .eq("payment_method", "bank")
      .in("status", ["confirmed", "rejected"])
      .order("reviewed_at", { ascending: false })
      .returns<PaymentHistoryRow[]>();

    if (error) {
      setLoadError(error.message);
      setPayments([]);
      return;
    }
    setPayments(data || []);
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (payments || []).filter((p) => {
      const nameMatch = (p.vendors?.name || "").toLowerCase().includes(term);
      const statusMatch = statusFilter === "all" || p.status === statusFilter;
      return nameMatch && statusMatch;
    });
  }, [payments, search, statusFilter]);

  return (
    <div>
      <h1 className="adm-section-heading">Payment History</h1>

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
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Vendor</th><th>Plan</th><th>Billing</th><th>Amount</th><th>Reviewed</th><th>Status</th><th>Receipt</th></tr>
          </thead>
          <tbody>
            {payments === null && <tr><td colSpan={7} className="adm-empty-cell">Loading…</td></tr>}
            {payments !== null && loadError && (
              <tr><td colSpan={7} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {payments !== null && !loadError && payments.length === 0 && (
              <tr><td colSpan={7} className="adm-empty-cell">No reviewed payments yet.</td></tr>
            )}
            {payments !== null && !loadError && payments.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={7} className="adm-empty-cell">No results found.</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.vendors?.name || "—"}</td>
                <td>{p.plan || "—"}</td>
                <td>{p.billing_type || "—"}</td>
                <td>{p.amount ? `₦${Number(p.amount).toLocaleString()}` : "—"}</td>
                <td>{p.reviewed_at ? new Date(p.reviewed_at).toLocaleDateString() : "—"}</td>
                <td>
                  <span className={`adm-status-badge adm-status-${p.status}`}>{p.status || "—"}</span>
                </td>
                <td>
                  {p.transfer_proof_url ? (
                    <button
                      type="button"
                      className="adm-btn"
                      style={{ background: "transparent", color: "#2563eb", textDecoration: "underline", padding: 0 }}
                      onClick={() => viewSignedUrl("payment-receipts", p.transfer_proof_url)}
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
