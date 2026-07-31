"use client";

// ===============================================================
// src/app/(standalone)/admin/SecurityLogTab.tsx
//
// Security Log — super_admin only. Faithful port of the "SECURITY
// LOG" section in admin-payments.js: a read-only, tamper-proof view
// of the audit_log table, populated automatically by database
// triggers (not dependent on any button click in the app) whenever
// user_roles, admin_invitations, vendor_payments, vendor_sponsorships,
// commissions, vendors, or auth.users change.
// ===============================================================

import { useEffect, useMemo, useState } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";

const PAGE_SIZE = 5;

const TABLE_LABELS: Record<string, string> = {
  user_roles: "User Roles",
  admin_invitations: "Admin Invitations",
  vendor_payments: "Vendor Payments",
  vendor_sponsorships: "Vendor Sponsorships",
  commissions: "Commissions",
  vendors: "Vendors",
  "auth.users": "Accounts",
};

type LogRow = {
  id: string;
  table_name: string;
  action: string;
  row_id: string | null;
  actor_email: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string | null;
};

export default function SecurityLogTab({ currentRole }: { currentRole: AdminRole }) {
  void currentRole; // this tab is only ever rendered for super_admin (enforced by the shell's role gate)

  const [entries, setEntries] = useState<LogRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await adminSupabase
        .from("audit_log")
        .select("id, table_name, action, row_id, actor_email, old_data, new_data, created_at")
        .order("created_at", { ascending: false })
        .limit(200)
        .returns<LogRow[]>();

      if (error) {
        setLoadError(error.message);
        setEntries([]);
        return;
      }
      setEntries(data || []);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (entries || []).filter((e) => {
      const emailMatch = (e.actor_email || "").toLowerCase().includes(term);
      const tableMatch = tableFilter === "all" || e.table_name === tableFilter;
      const actionMatch = actionFilter === "all" || e.action === actionFilter;
      return emailMatch && tableMatch && actionMatch;
    });
  }, [entries, search, tableFilter, actionFilter]);

  const visible = expanded ? filtered : filtered.slice(0, PAGE_SIZE);
  const remaining = filtered.length - PAGE_SIZE;

  function viewDetails(entry: LogRow) {
    const lines = [
      `Table: ${entry.table_name}`,
      `Action: ${entry.action}`,
      `When: ${entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"}`,
      `Actor: ${entry.actor_email || "System (no admin session)"}`,
      `Row ID: ${entry.row_id || "—"}`,
    ];
    if (entry.old_data) lines.push("", "Before:", JSON.stringify(entry.old_data, null, 2));
    if (entry.new_data) lines.push("", "After:", JSON.stringify(entry.new_data, null, 2));
    alert(lines.join("\n"));
  }

  return (
    <div>
      <h1 className="adm-section-heading adm-super-admin-heading">
        <i className="fa-solid fa-shield-halved"></i> Security Log
      </h1>
      <p className="adm-section-note">
        A permanent, tamper-proof record of every change to sensitive data — captured automatically at the database
        level, so it can&apos;t be bypassed by going around the admin dashboard. &quot;System&quot; means the change
        happened without a logged-in admin session (e.g. a direct database action).
      </p>

      <div className="adm-review-history-controls">
        <input
          type="text"
          placeholder="Search by actor email..."
          className="adm-history-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="adm-history-filter" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
          <option value="all">All Tables</option>
          {Object.entries(TABLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select className="adm-history-filter" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="INSERT">Insert</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </select>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>When</th><th>Table</th><th>Action</th><th>Actor</th><th>Details</th></tr>
          </thead>
          <tbody>
            {entries === null && <tr><td colSpan={5} className="adm-empty-cell">Loading…</td></tr>}
            {entries !== null && loadError && (
              <tr><td colSpan={5} className="adm-empty-cell">Failed to load security log: {loadError}</td></tr>
            )}
            {entries !== null && !loadError && entries.length === 0 && (
              <tr><td colSpan={5} className="adm-empty-cell">No activity recorded yet.</td></tr>
            )}
            {entries !== null && !loadError && entries.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={5} className="adm-empty-cell">No results found.</td></tr>
            )}
            {visible.map((e) => (
              <tr key={e.id}>
                <td>{e.created_at ? new Date(e.created_at).toLocaleString() : "—"}</td>
                <td>{TABLE_LABELS[e.table_name] || e.table_name}</td>
                <td>{e.action}</td>
                <td>{e.actor_email || "System (no admin session)"}</td>
                <td>
                  <button
                    className="adm-btn adm-reject-btn"
                    style={{ background: "#64748b" }}
                    onClick={() => viewDetails(e)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <button
          className="adm-section-note"
          style={{ background: "none", border: "none", color: "#2563eb", textDecoration: "underline", cursor: "pointer", marginTop: 8, padding: 0 }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "See less" : `See more (${remaining} older)`}
        </button>
      )}
    </div>
  );
}
