"use client";

// ===============================================================
// src/components/FounderBadge.tsx
//
// Founders 1000 badge: round gold laurel medal with "1KF". Goes BEFORE the verified
// badge, for the first 1,000 vendors (Spot-ID number 1-1000, stored
// in vendors.is_founder). No number is shown on purpose.
//
// Pass `show` when the page already knows, or pass the vendor's
// `slug` / `id` and the badge looks it up itself (cached, so a
// vendor appearing on many cards is asked about only once).
// ===============================================================

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BadgeTip from "@/components/BadgeTip";

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
    <span style={{ display: "inline-flex", alignItems: "center", marginRight: 4, flexShrink: 0 }}>
      <BadgeTip kind="founder">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/foundersbadge.png"
          alt="Founders 1000"
          width={size}
          height={size}
          style={{ width: size, height: size, minWidth: size, flexShrink: 0, display: "block" }}
        />
      </BadgeTip>
    </span>
  );
}
