"use client";

// ===============================================================
// EarningsTab.tsx — Earnings Breakdown by type, plus the full
// Reward & Bonus History ledger (search/filter/paginate/CSV export).
// ===============================================================

import type { CommissionRow } from "./types";

const COMMISSION_PAGE_SIZE = 10;

type Props = {
  vendorTotal: number;
  overrideTotal: number;
  bonusTotal: number;
  commissions: CommissionRow[];
  search: string;
  setSearch: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  expanded: boolean;
  setExpanded: (fn: (v: boolean) => boolean) => void;
  onDownloadCSV: () => void;
};

export default function EarningsTab({
  vendorTotal,
  overrideTotal,
  bonusTotal,
  commissions,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  expanded,
  setExpanded,
  onDownloadCSV,
}: Props) {
  const filteredCommissions = commissions.filter((c) => {
    const nameMatch = (c.vendors?.name || "").toLowerCase().includes(search.toLowerCase().trim());
    const typeMatch = typeFilter === "all" || c.type === typeFilter;
    const statusMatch = statusFilter === "all" || c.status === statusFilter;
    return nameMatch && typeMatch && statusMatch;
  });
  const visibleCommissions = expanded ? filteredCommissions : filteredCommissions.slice(0, COMMISSION_PAGE_SIZE);
  const remainingCount = filteredCommissions.length - COMMISSION_PAGE_SIZE;

  return (
    <>
      {/* EARNINGS BREAKDOWN */}
      <div className="pd-section">
        <h2 className="pd-section-heading">Earnings Breakdown</h2>
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead><tr><th>Type</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>Vendor Commissions</td><td>₦{vendorTotal.toLocaleString()}</td></tr>
              <tr><td>Override Earnings (5%)</td><td>₦{overrideTotal.toLocaleString()}</td></tr>
              <tr><td>Monthly Bonuses</td><td>₦{bonusTotal.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* REWARD & BONUS HISTORY */}
      <div className="pd-section">
        <h2 className="pd-section-heading">Reward &amp; Bonus History</h2>
        <button className="pd-btn" style={{ marginBottom: 14 }} onClick={onDownloadCSV}>Download Statement (CSV)</button>

        <div className="pd-controls-row">
          <input
            type="text"
            className="pd-search"
            placeholder="Search by vendor name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setExpanded(() => false); }}
          />
          <select className="pd-filter" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setExpanded(() => false); }}>
            <option value="all">All Types</option>
            <option value="vendor">Paid Vendor</option>
            <option value="override">Override</option>
            <option value="bonus">Bonus</option>
          </select>
          <select className="pd-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setExpanded(() => false); }}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="available">Available</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr><th>Vendor</th><th>Plan</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {visibleCommissions.length === 0 ? (
                <tr><td colSpan={6} className="pd-empty-cell">{commissions.length === 0 ? "No rewards yet." : "No results found."}</td></tr>
              ) : (
                visibleCommissions.map((c) => {
                  const amount = Number(c.amount) / 100;
                  const typeLabel = c.type === "vendor" ? "Paid Vendor" : c.type === "override" ? "Override" : c.type === "bonus" ? "Bonus" : "—";
                  return (
                    <tr key={c.id}>
                      <td>{c.vendors?.name || "—"}</td>
                      <td>{c.vendors?.plan_tier || "—"}</td>
                      <td>{typeLabel}</td>
                      <td>₦{amount.toLocaleString()}</td>
                      <td><span className={`pd-status-badge pd-status-${c.status}`}>{c.status}</span></td>
                      <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {remainingCount > 0 && (
          <button className="pd-see-more-btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "See less" : `See more (${remainingCount} older)`}
          </button>
        )}
      </div>
    </>
  );
}
