"use client";

// ===============================================================
// src/app/(standalone)/admin/ListingsModerationTab.tsx
//
// Pending Listings — services/products that were auto-flagged by the
// check_restricted_listing() DB trigger (2026-08-01) because their
// name/description matched a "review" severity term in
// restricted_terms (regulated-but-legal categories like financial
// services, pharmaceuticals, security, fuel, alcohol, betting, etc).
//
// Approve makes the listing publicly visible again (moderation_status
// = 'approved'). Reject keeps it hidden from the public but leaves it
// in the vendor's own dashboard, tagged "Not Approved" with the
// reason, so they can fix and resubmit it. Neither action deletes the
// listing — that stays a manual admin action if ever needed.
// ===============================================================

import { useCallback, useEffect, useState } from "react";
import { adminSupabase, getAdminSession, type AdminRole } from "@/lib/adminSupabase";

type ListingRow = {
  id: string;
  kind: "service" | "product";
  name: string;
  description: string | null;
  vendor_id: string;
  vendor_name: string | null;
  moderation_flag_reason: string | null;
  created_at: string | null;
};

export default function ListingsModerationTab(_props: { currentRole: AdminRole }) {
  const [listings, setListings] = useState<ListingRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    const [{ data: services, error: sErr }, { data: products, error: pErr }] = await Promise.all([
      adminSupabase
        .from("vendor_services")
        .select("id, service_name, short_description, vendor_id, moderation_flag_reason, created_at, vendors(name)")
        .eq("moderation_status", "pending_review"),
      adminSupabase
        .from("vendor_products")
        .select("id, product_name, short_description, vendor_id, moderation_flag_reason, created_at, vendors(name)")
        .eq("moderation_status", "pending_review"),
    ]);

    if (sErr || pErr) {
      setLoadError((sErr || pErr)?.message || "Failed to load pending listings.");
      setListings([]);
      return;
    }

    type RawRow = {
      id: string;
      service_name?: string;
      product_name?: string;
      short_description: string | null;
      vendor_id: string;
      moderation_flag_reason: string | null;
      created_at: string | null;
      vendors: { name: string | null } | { name: string | null }[] | null;
    };

    function vendorName(v: RawRow["vendors"]): string | null {
      if (!v) return null;
      return Array.isArray(v) ? v[0]?.name ?? null : v.name;
    }

    const serviceRows: ListingRow[] = ((services as RawRow[]) || []).map((s) => ({
      id: s.id,
      kind: "service",
      name: s.service_name || "",
      description: s.short_description,
      vendor_id: s.vendor_id,
      vendor_name: vendorName(s.vendors),
      moderation_flag_reason: s.moderation_flag_reason,
      created_at: s.created_at,
    }));

    const productRows: ListingRow[] = ((products as RawRow[]) || []).map((p) => ({
      id: p.id,
      kind: "product",
      name: p.product_name || "",
      description: p.short_description,
      vendor_id: p.vendor_id,
      vendor_name: vendorName(p.vendors),
      moderation_flag_reason: p.moderation_flag_reason,
      created_at: p.created_at,
    }));

    setListings(
      [...serviceRows, ...productRows].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
    );
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  async function approveListing(row: ListingRow) {
    if (!confirm(`Approve this ${row.kind}? It will become publicly visible.`)) return;
    setProcessingId(row.id);

    const session = getAdminSession();
    const table = row.kind === "service" ? "vendor_services" : "vendor_products";

    const { error } = await adminSupabase
      .from(table)
      .update({
        moderation_status: "approved",
        moderation_reviewed_at: new Date().toISOString(),
        moderation_reviewed_by: session?.user_id || null,
      })
      .eq("id", row.id);

    if (error) {
      alert("Failed to approve: " + error.message);
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    loadListings();
  }

  async function rejectListing(row: ListingRow) {
    const reason = prompt("Reason for rejecting this listing? The vendor will see this on their dashboard.");
    if (!reason) return;
    setProcessingId(row.id);

    const session = getAdminSession();
    const table = row.kind === "service" ? "vendor_services" : "vendor_products";

    const { error } = await adminSupabase
      .from(table)
      .update({
        moderation_status: "rejected",
        moderation_flag_reason: reason,
        moderation_reviewed_at: new Date().toISOString(),
        moderation_reviewed_by: session?.user_id || null,
      })
      .eq("id", row.id);

    if (error) {
      alert("Failed to reject: " + error.message);
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    loadListings();
  }

  return (
    <div>
      <h1 className="adm-section-heading">Pending Listings</h1>
      <p style={{ color: "#64748b", fontSize: 13, marginTop: -8, marginBottom: 16 }}>
        Services/products auto-flagged because they fall under a regulated category (financial services,
        pharmaceuticals, security, fuel, alcohol, betting, etc). Approve if the vendor is legitimately entitled
        to offer it; reject if not.
      </p>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Vendor</th><th>Type</th><th>Listing</th><th>Description</th><th>Flagged For</th><th>Submitted</th><th>Action</th></tr>
          </thead>
          <tbody>
            {listings === null && <tr><td colSpan={7} className="adm-empty-cell">Loading…</td></tr>}
            {listings !== null && loadError && (
              <tr><td colSpan={7} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {listings !== null && !loadError && listings.length === 0 && (
              <tr><td colSpan={7} className="adm-empty-cell">✓ All caught up — no pending listings.</td></tr>
            )}
            {listings?.map((row) => (
              <tr key={`${row.kind}-${row.id}`}>
                <td>{row.vendor_name || "—"}</td>
                <td style={{ textTransform: "capitalize" }}>{row.kind}</td>
                <td>{row.name}</td>
                <td style={{ maxWidth: 260 }}>
                  {(row.description || "").length > 120 ? `${row.description!.slice(0, 120)}...` : row.description || ""}
                </td>
                <td>{row.moderation_flag_reason || "—"}</td>
                <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</td>
                <td>
                  <button className="adm-btn adm-approve-btn" disabled={processingId === row.id} onClick={() => approveListing(row)}>
                    {processingId === row.id ? "Processing..." : "Approve"}
                  </button>{" "}
                  <button className="adm-btn adm-reject-btn" disabled={processingId === row.id} onClick={() => rejectListing(row)}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
