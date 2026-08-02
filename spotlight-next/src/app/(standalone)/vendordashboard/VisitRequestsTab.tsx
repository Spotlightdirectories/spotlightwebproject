"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/VisitRequestsTab.tsx
//
// Vendor Dashboard — Visit Requests (2026-08 safety feature).
//
// Shows every "Request a Visit" a customer has sent from the public
// vendor profile / product / service pages. The whole point of this
// tab is the "Confirm & Acknowledge" flow: before heading to a
// customer's location, the vendor is expected to review the
// confirmed name + phone here and click to acknowledge it — that
// click is the safety check Cyril asked for, sitting alongside (not
// replacing) the existing instant WhatsApp/Call buttons.
//
// 2026-08 addition, per Cyril: clicking "Confirm & Acknowledge" no
// longer updates the request immediately. It first opens a caution
// modal — a deliberate nudge to actually read the safety guidance,
// especially for a visit far from the vendor's usual area — and only
// the "I've Reviewed — Confirm Visit" button inside that modal
// actually marks it acknowledged.
// ===============================================================

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Vendor } from "./page";

type VisitRequest = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  location_note: string;
  message: string | null;
  status: "pending" | "acknowledged" | "declined" | "cancelled";
  created_at: string;
  acknowledged_at: string | null;
};

type Props = { vendor: Vendor; active: boolean; onViewed: () => void };

export default function VisitRequestsTab({ vendor, active, onViewed }: Props) {
  const [requests, setRequests] = useState<VisitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<VisitRequest | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("visit_requests")
      .select("id, customer_name, customer_phone, customer_email, location_note, message, status, created_at, acknowledged_at")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });
    setRequests((data as VisitRequest[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor.id]);

  // ---------------------------------------------------------------
  // Mark unread requests as viewed once this tab is actually opened
  // (mirrors an inbox: the badge count clears the moment the vendor
  // looks at the list, not just because the component is mounted).
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!active || !vendor?.id) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase
        .from("visit_requests")
        .update({ vendor_viewed_at: new Date().toISOString() })
        .eq("vendor_id", vendor.id)
        .is("vendor_viewed_at", null);
      if (!cancelled && !error) onViewed();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, vendor?.id]);

  async function updateStatus(id: string, status: "acknowledged" | "declined") {
    setBusyId(id);
    const patch: Record<string, unknown> = { status };
    if (status === "acknowledged") patch.acknowledged_at = new Date().toISOString();
    const { error } = await supabase.from("visit_requests").update(patch).eq("id", id);
    if (!error) {
      setRequests(rs => rs.map(r => (r.id === id ? { ...r, status, acknowledged_at: (patch.acknowledged_at as string) || r.acknowledged_at } : r)));
    }
    setBusyId(null);
  }

  async function confirmFromModal() {
    if (!confirmTarget) return;
    await updateStatus(confirmTarget.id, "acknowledged");
    setConfirmTarget(null);
  }

  if (loading) {
    return <p className="vd-card-label">Loading visit requests...</p>;
  }

  return (
    <div>
      <div className="vd-card-header">
        <h3>Visit Requests</h3>
        <p className="vd-visit-safety-banner">
          <i className="fa-solid fa-shield-heart"></i>
          <span>
            Before you travel to a customer&apos;s location, confirm their name and phone number here — that&apos;s
            your safety check. Read Spotlight&apos;s full{" "}
            <a href="/safety" target="_blank" rel="noopener">Safety Center</a>{" "}
            before accepting your first visit, especially for a location far from your usual area or one you
            don&apos;t know well.
          </span>
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="vd-card-label">No visit requests yet. When a customer uses &quot;Request a Visit&quot; on your profile, it&apos;ll show up here.</p>
      ) : (
        <div className="vd-visit-list">
          {requests.map(r => (
            <div key={r.id} className="vd-visit-card">
              <div className="vd-visit-card-top">
                <div>
                  <strong>{r.customer_name || "Unnamed customer"}</strong>
                  {r.status === "pending" && <span className="vd-pending-review-badge">Awaiting your confirmation</span>}
                  {r.status === "declined" && <span className="vd-rejected-badge">Declined</span>}
                  {r.status === "acknowledged" && <span className="vd-visit-ack-badge">Confirmed</span>}
                </div>
                <span className="vd-card-label">{new Date(r.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>

              <div className="vd-visit-detail"><i className="fa-solid fa-phone"></i> {r.customer_phone}</div>
              {r.customer_email && <div className="vd-visit-detail"><i className="fa-solid fa-envelope"></i> {r.customer_email}</div>}
              <div className="vd-visit-detail"><i className="fa-solid fa-location-dot"></i> {r.location_note}</div>
              {r.message && <div className="vd-visit-detail"><i className="fa-solid fa-comment"></i> {r.message}</div>}

              {r.status === "pending" && (
                <div className="vd-visit-actions">
                  <button
                    type="button"
                    className="vd-visit-confirm-btn"
                    disabled={busyId === r.id}
                    onClick={() => setConfirmTarget(r)}
                  >
                    <i className="fa-solid fa-circle-check"></i>{" "}
                    {busyId === r.id ? "Confirming..." : "Confirm & Acknowledge"}
                  </button>
                  <button
                    type="button"
                    className="vd-visit-decline-btn"
                    disabled={busyId === r.id}
                    onClick={() => updateStatus(r.id, "declined")}
                  >
                    Decline
                  </button>
                </div>
              )}

              {r.status === "acknowledged" && r.acknowledged_at && (
                <p className="vd-card-label" style={{ marginTop: 8 }}>
                  Confirmed {new Date(r.acknowledged_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })} — call or WhatsApp {r.customer_phone} to arrange the visit.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CAUTION NUDGE MODAL — the actual safety check happens here,
          not on the list button. Forces the vendor past the caution
          text before the request can be marked acknowledged. */}
      {confirmTarget && (
        <div className="vd-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmTarget(null); }}>
          <div className="vd-modal">
            <h3 className="vd-modal-title"><i className="fa-solid fa-triangle-exclamation"></i> Before You Confirm</h3>
            <p className="vd-modal-text">
              You&apos;re about to confirm a visit to <strong>{confirmTarget.customer_name || "this customer"}</strong> at:
            </p>
            <p className="vd-modal-location"><i className="fa-solid fa-location-dot"></i> {confirmTarget.location_note}</p>
            <ul className="vd-modal-caution-list">
              <li>Double-check the name and phone number match who you&apos;re actually expecting.</li>
              <li>If this location is far from your usual area, or somewhere you don&apos;t know well, let a family member or friend know where you&apos;re going and roughly when you&apos;ll be back — and consider not going alone. Bring someone with you if you can.</li>
              <li>Never share your bank PIN, OTP, or full card details with anyone on site.</li>
              <li>If anything about this request feels off, decline it instead and report it to Spotlight support.</li>
            </ul>
            <p className="vd-modal-text">
              Read the full <a href="/safety" target="_blank" rel="noopener">Safety Center</a> for more guidance built for Nigerian vendors.
            </p>
            <div className="vd-visit-actions">
              <button
                type="button"
                className="vd-visit-confirm-btn"
                disabled={busyId === confirmTarget.id}
                onClick={confirmFromModal}
              >
                <i className="fa-solid fa-circle-check"></i>{" "}
                {busyId === confirmTarget.id ? "Confirming..." : "I've Reviewed — Confirm Visit"}
              </button>
              <button type="button" className="vd-visit-decline-btn" onClick={() => setConfirmTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
