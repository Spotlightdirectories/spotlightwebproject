"use client";

// ===============================================================
// 2026-11: a free vendor with no product or service yet is not shown
// to the public. Visitors see a short "setting up" notice. The owner
// (signed in) still sees their full profile so they can finish setup.
// ===============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import VendorProfileClient from "./VendorProfileClient";

export default function UnlistedGate({ ownerAuthId }: { ownerAuthId: string | null }) {
  const [state, setState] = useState<"checking" | "owner" | "visitor">("checking");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const isOwner = !!(session?.user && ownerAuthId && session.user.id === ownerAuthId);
        if (alive) setState(isOwner ? "owner" : "visitor");
      } catch {
        if (alive) setState("visitor");
      }
    })();
    return () => { alive = false; };
  }, [ownerAuthId]);

  if (state === "owner") return <VendorProfileClient initial={null} />;
  if (state === "checking") {
    return <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>Loading...</div>;
  }
  return (
    <div style={{ padding: "64px 16px", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>This business is setting up</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        This business has not added its products or services yet. Please check back soon,
        or explore other businesses in the meantime.
      </p>
      <Link href="/discover" style={{ fontWeight: 600 }}>Explore Discover</Link>
    </div>
  );
}
