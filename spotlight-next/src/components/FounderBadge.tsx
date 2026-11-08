"use client";

// ===============================================================
// src/components/FounderBadge.tsx
//
// Founders 1000 badge: gold "1KF" on black. Goes BEFORE the verified
// badge, for the first 1,000 vendors (Spot-ID number 1-1000, stored
// in vendors.is_founder). No number is shown on purpose.
//
// Pass `show` when the page already knows, or pass the vendor's
// `slug` / `id` and the badge looks it up itself (cached, so a
// vendor appearing on many cards is asked about only once).
// ===============================================================

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const FOUNDER_TOOLTIP =
  "Founders 1000 — one of the first 1,000 vendors to join Spotlight Directories";

const cache = new Map<string, Promise<boolean>>();

function lookup(by: "slug" | "id", value: string): Promise<boolean> {
  const key = by + ":" + value;
  let p = cache.get(key);
  if (!p) {
    p = Promise.resolve(
      supabase.from("vendors").select("is_founder").eq(by, value).maybeSingle()
    ).then(({ data }) => !!data?.is_founder, () => false);
    cache.set(key, p);
  }
  return p;
}

export default function FounderBadge({
  show, slug, id, size = 18,
}: { show?: boolean | null; slug?: string | null; id?: string | null; size?: number }) {
  const [found, setFound] = useState(false);
  useEffect(() => {
    if (show !== undefined && show !== null) return;
    let alive = true;
    if (id) lookup("id", id).then(v => { if (alive) setFound(v); });
    else if (slug) lookup("slug", slug).then(v => { if (alive) setFound(v); });
    return () => { alive = false; };
  }, [show, slug, id]);

  const on = show !== undefined && show !== null ? show : found;
  if (!on) return null;
  return (
    <>
      <style>{`@keyframes founderGlow{0%,100%{box-shadow:0 0 3px 0 rgba(255,200,40,.5),0 0 7px 1px rgba(255,190,0,.25)}50%{box-shadow:0 0 4px 1px rgba(255,210,60,.65),0 0 9px 2px rgba(255,190,0,.32)}}`}</style>
      <span
        title={FOUNDER_TOOLTIP}
        aria-label="Founders 1000"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: size, padding: `0 ${Math.round(size * 0.36)}px`, borderRadius: size,
          background: "#000", color: "#FFD84D", border: "1px solid #F2C94C",
          fontSize: Math.round(size * 0.62), fontWeight: 800, letterSpacing: 0.5, lineHeight: 1,
          textShadow: "0 0 3px rgba(255,216,77,.7)",
          animation: "founderGlow 2.2s ease-in-out infinite",
          marginRight: 6, verticalAlign: "middle", flexShrink: 0, cursor: "help", whiteSpace: "nowrap",
        }}
      >
        1KF
      </span>
    </>
  );
}
