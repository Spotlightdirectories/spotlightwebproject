"use client";

// ===============================================================
// src/components/AiDescribeModal.tsx
//
// Faithful port of production ai-description.js — the "Generate
// with AI" modal shared by the Profile, Products and Services
// sections of the vendor dashboard. Collects 3 short guided hints
// (type-specific: business / product / service), calls the
// generate-description Edge Function, and hands the generated text
// back to the caller via onGenerated.
//
// Ported differences from the original vanilla version:
// - Uses supabase.functions.invoke() (already the established
//   pattern in this codebase — see page.tsx's swift-task call)
//   instead of a hand-rolled fetch() with a hardcoded project URL
//   and window.SUPABASE_ANON_KEY. invoke() attaches the session's
//   auth token automatically.
// - Rendered as a normal conditional React tree instead of being
//   appended to document.body by imperative DOM calls. Same fixed-
//   position CSS (.ai-desc-modal / .ai-desc-toast), same classNames,
//   so it looks and behaves identically.
// ===============================================================

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export type AiDescribeType = "business" | "product" | "service";

type HintConfig = {
  q1: { label: string; nudge: string; placeholder: string };
  q2: { label: string; nudge: string; placeholder: string };
  q3: { label: string; nudge: string; placeholder: string };
};

const HINT_CONFIG: Record<AiDescribeType, HintConfig> = {
  business: {
    q1: {
      label: "What makes your business different?",
      nudge:
        "Think: something a competitor in your category can't easily copy. Or something special about your business",
      placeholder: "e.g. family-owned since 2015, same-day delivery",
    },
    q2: {
      label: "What you're known for",
      nudge:
        "The one thing customers always compliment or like that make them come back to patronize your business.",
      placeholder: "e.g. reliable customer service, quality products",
    },
    q3: {
      label: "Typical customer (optional)",
      nudge: "Who are your customers? Eg Schools? Businesses? Adults? Mothers? etc.",
      placeholder: "e.g. small businesses, young professionals",
    },
  },
  product: {
    q1: {
      label: "Key features or what's included",
      nudge:
        "List what's special about your product — material, size, what's in the pack, carton.",
      placeholder: "e.g. genuine leather, adjustable straps, 1-year warranty",
    },
    q2: {
      label: "What problem it solves / why buy it",
      nudge: "Finish the sentence: 'Why do customers buy your product?'",
      placeholder: "e.g. built to last for daily use, great for gifting",
    },
    q3: {
      label: "Who it's for (optional)",
      nudge: "Who are your customers? Ladies? Men, Unisex? Car owners? Builders? etc",
      placeholder: "e.g. professionals, students",
    },
  },
  service: {
    q1: {
      label: "What's included / how you deliver it",
      nudge:
        "How do you render your services? What is the process?",
      placeholder: "e.g. free consultation, same-day turnaround, on-site visits",
    },
    q2: {
      label: "What outcome customers get",
      nudge:
        "What do customers get after you have finished rendering the service? Why are you different?",
      placeholder: "e.g. spotless home, fully repaired AC",
    },
    q3: {
      label: "Ideal client (optional)",
      nudge: "Who books this most, or who should?",
      placeholder: "e.g. busy families, small offices",
    },
  },
};

const TITLE_MAP: Record<AiDescribeType, string> = {
  business: "Generate Business Description",
  product: "Generate Product Description",
  service: "Generate Service Description",
};

// ---------------------------------------------------------------
// TOAST — a single shared toast, shown/hidden via local state in
// the component that mounts <AiDescribeModal />.
// ---------------------------------------------------------------
export function useAiDescribeToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const toastNode = (
    <div className={`ai-desc-toast${toast ? " show" : ""}`}>{toast || ""}</div>
  );

  return { showToast, toastNode };
}

type Props = {
  open: boolean;
  type: AiDescribeType;
  /** Current value of the "item name" field (product/service name), shown to the model for context. */
  itemName?: string;
  onClose: () => void;
  onGenerated: (text: string, meta: { type: AiDescribeType; planTier?: string; limit?: number }) => void;
};

export default function AiDescribeModal({ open, type, itemName, onClose, onGenerated }: Props) {
  const [differentiator, setDifferentiator] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const config = HINT_CONFIG[type] || HINT_CONFIG.business;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-description", {
        body: {
          type,
          hints: {
            differentiator: differentiator.trim(),
            specialty: specialty.trim(),
            targetCustomer: targetCustomer.trim(),
          },
          itemName: itemName ? itemName.trim() : null,
        },
      });

      if (fnError || !data || data.error) {
        setError((data && data.error) || fnError?.message || "Generation failed. Please try again.");
        setSubmitting(false);
        return;
      }

      onGenerated(data.text, { type: data.type || type, planTier: data.planTier, limit: data.limit });

      // Reset for next open
      setDifferentiator("");
      setSpecialty("");
      setTargetCustomer("");
      onClose();
    } catch (err) {
      console.error("AI description generation error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      id="aiDescModal"
      className="ai-desc-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ai-desc-modal-content">
        <button type="button" className="ai-desc-close" onClick={onClose}>
          &times;
        </button>

        <h3>{TITLE_MAP[type] || "Generate Description"}</h3>
        <p className="ai-desc-subtext">
          A few short details help Claude write something specific to you, not generic filler.
        </p>

        <label>{config.q1.label}</label>
        <p className="ai-desc-nudge">{config.q1.nudge}</p>
        <input
          type="text"
          placeholder={config.q1.placeholder}
          value={differentiator}
          onChange={(e) => setDifferentiator(e.target.value)}
        />

        <label>{config.q2.label}</label>
        <p className="ai-desc-nudge">{config.q2.nudge}</p>
        <input
          type="text"
          placeholder={config.q2.placeholder}
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
        />

        <label>{config.q3.label}</label>
        <p className="ai-desc-nudge">{config.q3.nudge}</p>
        <input
          type="text"
          placeholder={config.q3.placeholder}
          value={targetCustomer}
          onChange={(e) => setTargetCustomer(e.target.value)}
        />

        {error && <div className="ai-desc-error">{error}</div>}

        <button
          type="button"
          id="aiDescSubmit"
          className="vd-primary-btn"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Generating..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
