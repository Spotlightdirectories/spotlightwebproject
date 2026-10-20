// ===============================================================
// src/lib/analytics.ts
//
// One place that writes analytics_events rows. Every row now also
// carries an ANONYMOUS visitor_id (a random code kept in this
// browser, not tied to a name or email) and the visitor's STATE
// (looked up from their connection by the visitor-geo function; the
// IP address itself is never stored). This is what powers "Unique
// Visitors" and "Audience" in Business Insights.
// ===============================================================

import { supabase } from "@/lib/supabase";

const ID_KEY = "spotlight_vid";
const STATE_KEY = "spotlight_vstate";
const STATE_TTL = 24 * 60 * 60 * 1000;

function getVisitorId(): string | null {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

let statePromise: Promise<string | null> | null = null;

function getVisitorState(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const { state, at } = JSON.parse(raw);
      if (state && Date.now() - at < STATE_TTL) return Promise.resolve(state);
    }
  } catch { /* ignore */ }

  if (!statePromise) {
    statePromise = (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/visitor-geo`, { signal: ctrl.signal });
        clearTimeout(t);
        const { state } = await res.json();
        if (state) {
          try { localStorage.setItem(STATE_KEY, JSON.stringify({ state, at: Date.now() })); } catch { /* ignore */ }
        }
        return (state as string | null) || null;
      } catch {
        return null;
      } finally {
        statePromise = null;
      }
    })();
  }
  return statePromise;
}

// Drop-in replacement for supabase.from("analytics_events").insert(rows)
export async function insertAnalytics(rows: Record<string, unknown> | Record<string, unknown>[]) {
  let meta: Record<string, unknown> = {};
  try {
    const [state] = await Promise.all([getVisitorState()]);
    meta = { visitor_id: getVisitorId(), visitor_state: state };
  } catch { /* analytics must never break a page */ }
  const withMeta = Array.isArray(rows) ? rows.map((r) => ({ ...meta, ...r })) : { ...meta, ...rows };
  return supabase.from("analytics_events").insert(withMeta);
}
