"use client";

// ===============================================================
// src/app/(standalone)/admin/PartnerHistoryTab.tsx
//
// Partner History — admin and super_admin only. Faithful port of
// loadPartnerHistory/renderPartnerHistory in admin-payments.js.
// Shows every approved/rejected partner application, searchable by
// name or referral code and filterable by status.
// ===============================================================

import { useEffect, useMemo, useState } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";

type PartnerHistoryRow = {
  id: string;
  name: string | null;
  email: string | null;
  state: string | null;
  referral_code: string | null;
  status: string | null;
  created_at: string | null;
};

export default function PartnerHistoryTab({ currentRole }: { currentRole: AdminRole }) {
  void currentRole;

  const [partners, setPartners] = useState<PartnerHistoryRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const { data, error } = await adminSupabase
        .from("partners")
        .select("id, name, email, state, referral_code, status, created_at")
        .in("status", ["approved", "rejected"])
        .order("created_at", { ascending: false })
        .returns<PartnerHistoryRow[]>();

      if (error) {
        setLoadError("Failed to load partner history.");
        setPartners([]);
        return;
      }
      setPartners(data || []);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (partners || []).filter((p) => {
      const nameMatch = (p.name || "").toLowerCase().includes(term) || (p.referral_code || "").toLowerCase().includes(term);
      const statusMatch = statusFilter === "all" || p.status === statusFilter;
      return nameMatch && statusMatch;
    });
  }, [partners, search, statusFilter]);

  return (
    <div>
      <h1 className="adm-section-heading">Partner History</h1>

      <div className="adm-review-history-controls">
        <input
          type="text"
          placeholder="Search by name or referral code..."
          className="adm-history-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="adm-history-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>State</th><th>Referral Code</th><th>Applied</th><th>Status</th></tr>
          </thead>
          <tbody>
            {partners === null && <tr><td colSpan={6} className="adm-empty-cell">Loading…</td></tr>}
            {partners !== null && loadError && (
              <tr><td colSpan={6} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {partners !== null && !loadError && partners.length === 0 && (
              <tr><td colSpan={6} className="adm-empty-cell">No reviewed partner applications yet.</td></tr>
            )}
            {partners !== null && !loadError && partners.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={6} className="adm-empty-cell">No results found.</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.name || "—"}</td>
                <td>{p.email || "—"}</td>
                <td>{p.state || "—"}</td>
                <td>{p.referral_code ? <strong>{p.referral_code}</strong> : "—"}</td>
                <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</td>
                <td>
                  <span className={`adm-status-badge adm-status-${p.status}`}>{p.status || "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
