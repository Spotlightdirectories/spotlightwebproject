"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/PortfolioTab.tsx
//
// Vendor Dashboard — MODULE: Portfolio.
//
// New module (no production equivalent). Cyril's brief: a CV-style
// history of past work for Service / Hybrid vendors, shown on the
// public profile below "About the Business". Design confirmed by
// Cyril directly:
//
//   "I think everyone should have 6 portfolio max not following any
//   plan limits. But, shows only 2 and a click to 'See More' reveals
//   the rest."
//
// So unlike Products/Services, there is NO plan-tier lookup here —
// every vendor (service/hybrid) gets a flat cap of 6 items. The
// "show 2 then See More" behavior lives on the PUBLIC profile page,
// not here — this tab just manages the underlying up-to-6 list.
//
// ROUND 2 (2026-07-28) — Cyril's live-test feedback led to two more
// changes on top of the original build:
// 1. The image upload was dropped ENTIRELY. First pass made it
//    optional; Cyril's follow-up made clear that wasn't enough — a
//    generic Spotlight-logo placeholder "does not look professional,"
//    and most services genuinely have nothing to photograph. Identity
//    now comes from an auto-generated initials avatar (same visual
//    pattern as the Reviews section's reviewer avatar), never a photo.
// 2. Title and Description were reading as duplicates of each other
//    ("job done can be repeated," in Cyril's words) — both prompts
//    effectively asked "what did you do?" with no persistent label to
//    tell a vendor the two fields serve different purposes once the
//    placeholder text disappears. Added real labels above each field
//    ("Project title" vs. "What did you do?") and reworded the
//    description placeholder to explicitly say don't repeat the title.
//
// ROUND 3 (2026-07-28) — Cyril wants recommendations to come directly
// from the client, Upwork-style, instead of a vendor typing a client's
// name themselves. Added a "Request recommendation" action per saved
// item: sends the client a one-time link (via the existing send-email
// function) to a public page where THEY write the recommendation.
// Once submitted, it's verified (came from the client, not the
// vendor) and shown on the public profile in place of the typed
// "Client / company" text for that item.
// ===============================================================

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import type { Vendor } from "./page";

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  completed_on: string | null;
};

type RecommendationRequest = {
  id: string;
  portfolio_item_id: string;
  status: "pending" | "submitted" | "expired";
  recommender_email: string;
  recommender_name: string | null;
  recommender_company: string | null;
  message: string | null;
};

type PendingPortfolioItem = {
  title: string;
  description: string;
  client_name: string;
  completed_on: string;
};

const PORTFOLIO_LIMIT = 6;

// Small, local meta-text style — deliberately NOT vd-product-price
// (that class is green/bold, meant for prices; reusing it here for
// client name + date read like a price tag, which Cyril flagged as
// confusing on the public page). Kept inline rather than adding a new
// global class, since vd-product-price/vd-service-description are
// shared with the real Products/Services tabs and shouldn't change.
const metaTextStyle: CSSProperties = { fontSize: 12, color: "#64748b", marginTop: 2 };

const avatarStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontSize: 13,
  fontWeight: 700,
  background: "#dbeafe",
  color: "#1e3a8a",
  marginRight: 12,
};

function getInitials(source: string): string {
  return (source || "")
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase() || "?";
}

// Formats a "YYYY-MM-DD" value (what the date picker below produces)
// into "28 July 2026". Falls back to showing whatever was stored
// as-is for older entries typed before this was a real date field.
function formatCompletedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function PortfolioTab({ vendor }: { vendor: Vendor }) {
  const [savedItems, setSavedItems] = useState<PortfolioItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingPortfolioItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Recommendation requests, keyed by portfolio_item_id — at most one
  // meaningful request per item for this first version (if it's
  // pending or submitted, the "Request recommendation" button is
  // replaced by a status line instead of letting a second request
  // stack up).
  const [recommendations, setRecommendations] = useState<Record<string, RecommendationRequest>>({});
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const clientRef = useRef<HTMLInputElement>(null);
  const completedRef = useRef<HTMLInputElement>(null);

  const totalCount = savedItems.length + pendingItems.length;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("vendor_portfolio_items")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("display_order", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Fetch portfolio items error:", error);
      } else {
        setSavedItems((data as PortfolioItem[]) || []);
      }
      setLoadingItems(false);
    }

    async function loadRecommendations() {
      const { data, error } = await supabase
        .from("vendor_recommendation_requests")
        .select("id, portfolio_item_id, status, recommender_email, recommender_name, recommender_company, message")
        .eq("vendor_id", vendor.id);

      if (cancelled) return;

      if (error) {
        // Table may not exist yet if Cyril hasn't run the migration —
        // fail quietly rather than blocking the rest of the tab.
        console.error("Fetch recommendation requests error:", error);
        return;
      }

      const byItem: Record<string, RecommendationRequest> = {};
      for (const row of (data as RecommendationRequest[]) || []) {
        byItem[row.portfolio_item_id] = row;
      }
      setRecommendations(byItem);
    }

    load();
    loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [vendor.id]);

  function openRequestForm(itemId: string) {
    setRequestingId(itemId);
    setRequestEmail("");
  }

  async function handleSendRequest(item: PortfolioItem) {
    const email = requestEmail.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Enter a valid email address for the client.");
      return;
    }

    setSendingRequest(true);

    try {
      const { data, error } = await supabase
        .from("vendor_recommendation_requests")
        .insert({
          vendor_id: vendor.id,
          portfolio_item_id: item.id,
          recommender_email: email,
        })
        .select()
        .single();

      if (error) throw error;

      const token = data.token as string;
      const link = `${window.location.origin}/recommend/${token}`;

      const emailResponse = await fetch(
        "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: `${vendor.name} would like your recommendation`,
            html: `<p>Hi,</p><p><strong>${vendor.name}</strong> has asked you to leave a short recommendation for work done: <strong>${item.title}</strong>.</p><p>It only takes a minute, and it helps future clients trust their work.</p><p><a href="${link}">Click here to leave your recommendation</a></p><p>If you weren't expecting this, you can safely ignore this email.</p>`,
          }),
        }
      );

      if (!emailResponse.ok) {
        console.error("send-email failed:", await emailResponse.text());
        alert(
          "The request was saved, but the email may not have sent. You can try again, or share this link with your client directly: " +
            link
        );
      } else {
        alert("Request sent — you'll see it here once your client responds.");
      }

      setRecommendations((prev) => ({ ...prev, [item.id]: data as RecommendationRequest }));
      setRequestingId(null);
      setRequestEmail("");
    } catch (err) {
      console.error("Request recommendation error:", err);
      alert(
        err instanceof Error && err.message.includes("vendor_recommendation_requests")
          ? "Recommendations aren't set up on the database yet — ask your developer to run the pending migration."
          : "Unable to send the request. Please try again."
      );
    } finally {
      setSendingRequest(false);
    }
  }

  function resetForm() {
    if (titleRef.current) titleRef.current.value = "";
    if (descriptionRef.current) descriptionRef.current.value = "";
    if (clientRef.current) clientRef.current.value = "";
    if (completedRef.current) completedRef.current.value = "";
    setEditingId(null);
  }

  function handleAddToPending() {
    const title = titleRef.current?.value.trim() || "";
    const description = descriptionRef.current?.value.trim() || "";
    const client = clientRef.current?.value.trim() || "";
    const completed = completedRef.current?.value.trim() || "";

    if (!title) {
      alert("A project title is required.");
      return;
    }

    if (totalCount >= PORTFOLIO_LIMIT) {
      alert(`You can add up to ${PORTFOLIO_LIMIT} portfolio items.`);
      return;
    }

    setPendingItems((prev) => [
      ...prev,
      {
        title,
        description,
        client_name: client,
        completed_on: completed,
      },
    ]);

    resetForm();
  }

  function handleRemovePending(index: number) {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditSaved(item: PortfolioItem) {
    setEditingId(item.id);
    setFormOpen(true);

    if (titleRef.current) titleRef.current.value = item.title || "";
    if (descriptionRef.current) descriptionRef.current.value = item.description || "";
    if (clientRef.current) clientRef.current.value = item.client_name || "";
    // Date inputs only accept a "YYYY-MM-DD" value. Older items saved
    // before this was a real date picker may hold free text (e.g.
    // "Completed 28th July, 2026") that won't fit that shape — leave
    // the picker blank in that case rather than showing garbage.
    if (completedRef.current) {
      completedRef.current.value = /^\d{4}-\d{2}-\d{2}$/.test(item.completed_on || "") ? item.completed_on! : "";
    }
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm("Delete this portfolio item?")) return;

    const { error } = await supabase.from("vendor_portfolio_items").delete().eq("id", id);

    if (error) {
      alert("Unable to delete portfolio item.");
      console.error(error);
      return;
    }

    setSavedItems((prev) => prev.filter((p) => p.id !== id));

    if (editingId === id) {
      resetForm();
    }
  }

  async function handleSave() {
    if (!editingId && !pendingItems.length) {
      alert("No portfolio items to save.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const title = titleRef.current?.value.trim() || "";
        const description = descriptionRef.current?.value.trim() || "";
        const client = clientRef.current?.value.trim() || "";
        const completed = completedRef.current?.value.trim() || "";

        const { error } = await supabase
          .from("vendor_portfolio_items")
          .update({
            title,
            description,
            client_name: client || null,
            completed_on: completed || null,
          })
          .eq("id", editingId);

        if (error) throw error;

        setSavedItems((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? {
                  ...p,
                  title,
                  description,
                  client_name: client || null,
                  completed_on: completed || null,
                }
              : p
          )
        );

        resetForm();
        alert("Portfolio item updated successfully.");
        return;
      }

      const payload = pendingItems.map((p, index) => ({
        vendor_id: vendor.id,
        title: p.title,
        description: p.description || null,
        client_name: p.client_name || null,
        completed_on: p.completed_on || null,
        display_order: savedItems.length + index,
      }));

      const { data, error } = await supabase.from("vendor_portfolio_items").insert(payload).select();

      if (error) throw error;

      setSavedItems((prev) => [...prev, ...((data as PortfolioItem[]) || [])]);
      setPendingItems([]);
      alert("Portfolio saved successfully.");
    } catch (err) {
      console.error("Save portfolio error:", err);
      alert("Unable to save portfolio items.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="vd-card vd-profile-card">
      <div className="vd-profile-header">
        <div>
          <h3>Portfolio</h3>
          <p className="vd-profile-subtext">
            Showcase past work for prospects — a CV for your business. Up to {PORTFOLIO_LIMIT} items, shown 2 at a
            time on your public profile with a &quot;See More&quot; to reveal the rest.
          </p>
        </div>

        <button type="button" className="vd-service-btn" onClick={() => setFormOpen((v) => !v)}>
          <i className="fa-solid fa-plus"></i> Add Portfolio Item
        </button>
      </div>

      <div className={`vd-inline-editor${formOpen ? " active" : ""}`}>
        <div className="vd-service-add-row">
          <label style={{ display: "block", fontSize: 13, color: "#64748b", marginBottom: 4 }}>
            Project title
          </label>
          <input
            type="text"
            ref={titleRef}
            className="vd-input"
            placeholder="A short name for the job, e.g. Office rebrand for Acme Ltd"
          />
        </div>

        <div className="vd-service-description-row">
          <label style={{ display: "block", fontSize: 13, color: "#64748b", marginBottom: 4 }}>
            What did you do?
          </label>
          <textarea
            ref={descriptionRef}
            className="vd-textarea"
            rows={3}
            placeholder="Explain the work, your approach, or the result — don't just repeat the title above"
          />
        </div>

        <div className="vd-service-add-row">
          <label style={{ display: "block", fontSize: 13, color: "#64748b", marginBottom: 4 }}>
            Client / company (optional)
          </label>
          <input type="text" ref={clientRef} className="vd-input" placeholder="e.g. Acme Ltd" />
        </div>

        <div className="vd-service-add-row">
          <label style={{ display: "block", fontSize: 13, color: "#64748b", marginBottom: 4 }}>
            Completed on (optional)
          </label>
          <input type="date" ref={completedRef} className="vd-input" max={new Date().toISOString().slice(0, 10)} />
        </div>

        <div className="vd-service-add-actions">
          <button type="button" className="vd-service-btn" disabled={!!editingId} onClick={handleAddToPending}>
            {editingId ? "Editing..." : "Add"}
          </button>
        </div>

        <p className="vd-service-limit-text">{`You can add up to ${PORTFOLIO_LIMIT} portfolio items.`}</p>

        {/* PENDING ITEMS */}
        <div className="vd-pending-services">
          {pendingItems.map((item, index) => (
            <div className="vd-service-pill" key={index} style={{ display: "flex", alignItems: "center" }}>
              <div style={avatarStyle}>{getInitials(item.client_name || item.title)}</div>

              <div className="vd-service-content">
                <div className="vd-service-name">{item.title}</div>
                {item.description && <div className="vd-service-description">{item.description}</div>}
                {(item.client_name || item.completed_on) && (
                  <div style={metaTextStyle}>
                    {[item.client_name, item.completed_on && `Completed: ${formatCompletedDate(item.completed_on)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>

              <button type="button" className="vd-remove-product-btn" onClick={() => handleRemovePending(index)}>
                ×
              </button>
            </div>
          ))}
        </div>

        {/* SAVED ITEMS */}
        <div className="vd-saved-services">
          {loadingItems ? (
            <div className="vd-empty-services">Loading portfolio...</div>
          ) : savedItems.length === 0 ? (
            <div className="vd-empty-services">No saved portfolio items yet.</div>
          ) : (
            savedItems.map((item) => {
              const rec = recommendations[item.id];
              return (
                <div className="vd-service-pill saved" key={item.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={avatarStyle}>{getInitials(item.client_name || item.title)}</div>

                    <div className="vd-service-content">
                      <div className="vd-service-name">{item.title}</div>
                      <div className="vd-service-description">
                        {(item.description || "").length > 200
                          ? `${(item.description || "").slice(0, 200)}...`
                          : item.description || ""}
                      </div>
                      {(item.client_name || item.completed_on) && (
                        <div style={metaTextStyle}>
                          {[item.client_name, item.completed_on && `Completed: ${formatCompletedDate(item.completed_on)}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                    </div>

                    <button type="button" className="vd-edit-product-btn" onClick={() => handleEditSaved(item)}>
                      Edit
                    </button>

                    <button type="button" className="vd-delete-product-btn" onClick={() => handleDeleteSaved(item.id)}>
                      ×
                    </button>
                  </div>

                  {/* RECOMMENDATION — request it, show its status, or show what came back */}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                    {!rec && requestingId !== item.id && (
                      <button
                        type="button"
                        className="vd-edit-product-btn"
                        onClick={() => openRequestForm(item.id)}
                      >
                        <i className="fa-solid fa-envelope"></i> Request recommendation from client
                      </button>
                    )}

                    {!rec && requestingId === item.id && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          type="email"
                          className="vd-input"
                          style={{ maxWidth: 260 }}
                          placeholder="Client's email address"
                          value={requestEmail}
                          onChange={(e) => setRequestEmail(e.target.value)}
                        />
                        <button
                          type="button"
                          className="vd-service-btn"
                          disabled={sendingRequest}
                          onClick={() => handleSendRequest(item)}
                        >
                          {sendingRequest ? "Sending..." : "Send"}
                        </button>
                        <button type="button" className="vd-edit-product-btn" onClick={() => setRequestingId(null)}>
                          Cancel
                        </button>
                      </div>
                    )}

                    {rec && rec.status === "pending" && (
                      <div style={metaTextStyle}>
                        <i className="fa-regular fa-clock"></i> Recommendation requested from {rec.recommender_email} — awaiting their response.
                      </div>
                    )}

                    {rec && rec.status === "submitted" && (
                      <div style={{ fontSize: 13, color: "#166534" }}>
                        <i className="fa-solid fa-circle-check"></i>{" "}
                        <strong>Verified recommendation from {rec.recommender_name}{rec.recommender_company ? ` (${rec.recommender_company})` : ""}:</strong>{" "}
                        <span style={{ color: "#374151" }}>&ldquo;{rec.message}&rdquo;</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="vd-profile-actions">
          <button type="button" className="vd-service-btn" disabled={saving} onClick={handleSave}>
            {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update Item" : "Save Portfolio"}
          </button>
        </div>
      </div>
    </div>
  );
}
