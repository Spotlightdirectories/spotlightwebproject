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

// Task U: Request a Quote (separate from Request a Visit)
type QuoteRequest = {
  id: string;
  service_name: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  state: string;
  lga: string;
  location_note: string | null;
  description: string;
  timeline: string;
  budget_range: string | null;
  photo_urls: string[];
  extra_answers: { question: string; answer: string }[] | null;
  status: "received" | "viewed" | "quoted" | "closed";
  created_at: string;
  quoted_at: string | null;
};

const TIMELINE_LABELS: Record<string, string> = {
  asap: "As soon as possible",
  within_1_week: "Within 1 week",
  within_1_month: "Within 1 month",
  just_planning: "Just planning",
};
const QUOTE_STATUS_LABELS: Record<string, string> = {
  received: "Received",
  viewed: "Viewed",
  quoted: "Quoted",
  closed: "Closed",
};

type Props = { vendor: Vendor; active: boolean; onViewed: () => void };

export default function VisitRequestsTab({ vendor, active, onViewed }: Props) {
  const [requests, setRequests] = useState<VisitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<VisitRequest | null>(null);
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [quotePhotoUrls, setQuotePhotoUrls] = useState<Record<string, string[]>>({});

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("visit_requests")
      .select("id, customer_name, customer_phone, customer_email, location_note, message, status, created_at, acknowledged_at")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });
    setRequests((data as VisitRequest[]) || []);

    const { data: quoteData } = await supabase
      .from("quote_requests")
      .select("id, service_name, customer_name, customer_phone, customer_email, state, lga, location_note, description, timeline, budget_range, photo_urls, extra_answers, status, created_at, quoted_at")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });
    const quoteList = (quoteData as QuoteRequest[]) || [];
    setQuotes(quoteList);

    // Photos live in a private folder, so each needs a short-lived signed link.
    const urlMap: Record<string, string[]> = {};
    for (const q of quoteList) {
      if (!q.photo_urls || q.photo_urls.length === 0) continue;
      const { data: signed } = await supabase.storage.from("quote-photos").createSignedUrls(q.photo_urls, 3600);
      urlMap[q.id] = (signed || []).map(x => x.signedUrl).filter(Boolean) as string[];
    }
    setQuotePhotoUrls(urlMap);
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
      // Quote requests: opening the tab moves "Received" to "Viewed".
      const nowIso = new Date().toISOString();
      await supabase
        .from("quote_requests")
        .update({ status: "viewed", vendor_viewed_at: nowIso })
        .eq("vendor_id", vendor.id)
        .eq("status", "received");
      await supabase
        .from("quote_requests")
        .update({ vendor_viewed_at: nowIso })
        .eq("vendor_id", vendor.id)
        .is("vendor_viewed_at", null);
      if (!cancelled && !error) {
        setQuotes(qs => qs.map(q => (q.status === "received" ? { ...q, status: "viewed" } : q)));
        onViewed();
      }
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

  async function setQuoteStatus(id: string, status: "quoted" | "closed") {
    setBusyId(id);
    const { error } = await supabase.from("quote_requests").update({ status }).eq("id", id);
    if (!error) {
      setQuotes(qs => qs.map(q => (q.id === id ? { ...q, status, quoted_at: status === "quoted" ? new Date().toISOString() : q.quoted_at } : q)));
    } else {
      alert("Unable to update this quote request. Please try again.");
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
        <h3>Visit &amp; Quote Requests</h3>
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

      {/* QUOTE REQUESTS (Task U) */}
      <div className="vd-card-header" style={{ marginTop: 4 }}>
        <h3>Quote Requests</h3>
      </div>
      {quotes.length === 0 ? (
        <p className="vd-card-label" style={{ marginBottom: 24 }}>No quote requests yet. When a customer uses &quot;Request a Quote&quot; on one of your services, it&apos;ll show up here.</p>
      ) : (
        <div className="vd-visit-list" style={{ marginBottom: 28 }}>
          {quotes.map(q => (
            <div key={q.id} className="vd-visit-card">
              <div className="vd-visit-card-top">
                <div>
                  <strong>{q.customer_name || "Unnamed customer"}</strong>
                  <span className="vd-pending-review-badge" style={{ marginLeft: 8 }}>Quote</span>
                  {q.status === "received" && <span className="vd-pending-review-badge">Received</span>}
                  {q.status === "viewed" && <span className="vd-pending-review-badge">Viewed</span>}
                  {q.status === "quoted" && <span className="vd-visit-ack-badge">Quoted</span>}
                  {q.status === "closed" && <span className="vd-rejected-badge">Closed</span>}
                </div>
                <span className="vd-card-label">{new Date(q.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>

              <div className="vd-visit-detail"><i className="fa-solid fa-briefcase"></i> {q.service_name}</div>
              <div className="vd-visit-detail"><i className="fa-solid fa-phone"></i> <a href={`tel:${q.customer_phone}`}>{q.customer_phone}</a></div>
              <div className="vd-visit-detail"><i className="fa-solid fa-envelope"></i> <a href={`mailto:${q.customer_email}`}>{q.customer_email}</a></div>
              <div className="vd-visit-detail"><i className="fa-solid fa-location-dot"></i> {[q.location_note, q.lga, q.state].filter(Boolean).join(", ")}</div>
              <div className="vd-visit-detail"><i className="fa-solid fa-clock"></i> {TIMELINE_LABELS[q.timeline] || q.timeline}</div>
              {q.budget_range && <div className="vd-visit-detail"><i className="fa-solid fa-naira-sign"></i> Budget: {q.budget_range}</div>}
              <div className="vd-visit-detail"><i className="fa-solid fa-comment"></i> {q.description}</div>
              {(q.extra_answers || []).map((a, i) => (
                <div key={i} className="vd-visit-detail"><i className="fa-solid fa-circle-question"></i> <span><strong>{a.question}</strong> {a.answer}</span></div>
              ))}

              {(quotePhotoUrls[q.id] || []).length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {(quotePhotoUrls[q.id] || []).map((u, i) => (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`Job photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--color-border)" }} />
                    </a>
                  ))}
                </div>
              )}

              {(q.status === "received" || q.status === "viewed") && (
                <div className="vd-visit-actions">
                  <button type="button" className="vd-visit-confirm-btn" disabled={busyId === q.id} onClick={() => setQuoteStatus(q.id, "quoted")}>
                    <i className="fa-solid fa-file-invoice-dollar"></i> {busyId === q.id ? "Saving..." : "Mark as quoted"}
                  </button>
                  <button type="button" className="vd-visit-decline-btn" disabled={busyId === q.id} onClick={() => setQuoteStatus(q.id, "closed")}>
                    Close
                  </button>
                </div>
              )}
              {q.status === "quoted" && (
                <div className="vd-visit-actions">
                  <button type="button" className="vd-visit-decline-btn" disabled={busyId === q.id} onClick={() => setQuoteStatus(q.id, "closed")}>
                    Close
                  </button>
                </div>
              )}
              {q.status !== "closed" && (
                <p className="vd-card-label" style={{ marginTop: 8 }}>
                  Contact {q.customer_name || "the customer"} by phone or WhatsApp with your quote, then tap &quot;Mark as quoted&quot;.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="vd-card-header">
        <h3>Visit Requests</h3>
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
