"use client";

// ===============================================================
// src/app/(standalone)/recommend/[token]/page.tsx
//
// New page, no production equivalent. This is the public,
// no-login-required page a CLIENT lands on after a vendor requests a
// recommendation from PortfolioTab.tsx. Cyril's brief: replicate
// Upwork's pattern — the recommendation is written and submitted by
// the client themselves via a link the vendor sends them, not typed
// in by the vendor.
//
// The token in the URL is the only "credential" here — it's a random
// uuid generated when the vendor's request row was created
// (`vendor_recommendation_requests.token`), emailed to the client,
// and never guessable. All reads/writes on this page go through
// SECURITY DEFINER Postgres functions (get_recommendation_request_by_token,
// submit_recommendation) rather than direct table access, so the
// underlying table (which holds the client's email) is never exposed
// to the public — only what's safe to show a stranger who clicked an
// email link.
// ===============================================================

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RequestInfo = {
  vendor_name: string;
  portfolio_title: string;
  status: "pending" | "submitted" | "expired";
};

export default function RecommendPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .rpc("get_recommendation_request_by_token", { p_token: token })
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setError("This link is invalid or has expired.");
      } else {
        setInfo(data as RequestInfo);
      }
      setLoading(false);
    }

    if (token) load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit() {
    if (!name.trim() || !message.trim()) {
      alert("Please add your name and a short recommendation.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("submit_recommendation", {
        p_token: token,
        p_name: name.trim(),
        p_company: company.trim() || null,
        p_message: message.trim(),
      });

      if (error || !data) {
        setError("This link may have already been used or has expired.");
        return;
      }

      setDone(true);
    } catch (err) {
      console.error("Submit recommendation error:", err);
      setError("Something went wrong submitting your recommendation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/spotlightlogo-512.png" alt="Spotlight" style={{ width: 40, height: 40, marginBottom: 16 }} />

        {loading && <p style={{ color: "#64748b" }}>Loading...</p>}

        {!loading && error && !done && (
          <p style={{ color: "#b91c1c" }}>{error}</p>
        )}

        {!loading && !error && info && info.status === "submitted" && !done && (
          <p style={{ color: "#166534" }}>
            You&apos;ve already submitted a recommendation for {info.vendor_name} — thank you!
          </p>
        )}

        {!loading && !error && info && info.status === "pending" && !done && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: "#111827" }}>
              Recommend {info.vendor_name}
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
              {info.vendor_name} asked you to share a quick recommendation about their work on{" "}
              <strong>&ldquo;{info.portfolio_title}&rdquo;</strong>. It only takes a minute, and it will appear on
              their public profile as a verified recommendation from you.
            </p>

            <label style={{ display: "block", fontSize: 13, color: "#374151", marginBottom: 4 }}>Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 14 }}
              placeholder="e.g. Jane Okafor"
            />

            <label style={{ display: "block", fontSize: 13, color: "#374151", marginBottom: 4 }}>
              Your company (optional)
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 14 }}
              placeholder="e.g. Acme Ltd"
            />

            <label style={{ display: "block", fontSize: 13, color: "#374151", marginBottom: 4 }}>
              Your recommendation
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 18, fontFamily: "inherit" }}
              placeholder="What was it like working with them? What did they deliver?"
            />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: "#111827", color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              {submitting ? "Submitting..." : "Submit recommendation"}
            </button>
          </>
        )}

        {done && (
          <p style={{ color: "#166534" }}>
            Thank you — your recommendation has been submitted and will appear on {info?.vendor_name}&apos;s profile.
          </p>
        )}
      </div>
    </div>
  );
}
