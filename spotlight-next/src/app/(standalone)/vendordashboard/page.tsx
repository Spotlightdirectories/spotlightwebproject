"use client";

// Vendordashboard placeholder — full build comes in Stage 3.
// This page just confirms the vendor is logged in and shows
// their name so the login → dashboard flow can be confirmed.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function VendorDashboardPage() {
  const router = useRouter();
  const [vendorName, setVendorName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const { data: vendor } = await supabase
        .from("vendors")
        .select("name, business_type")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!vendor) { router.replace("/getlisted"); return; }
      if (!vendor.business_type) { router.replace("/business-type"); return; }

      setVendorName(vendor.name);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--color-text-muted)" }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24 }}>
      <h1 style={{ color: "var(--color-text-primary)" }}>Welcome, {vendorName}!</h1>
      <p style={{ color: "var(--color-text-muted)" }}>Your dashboard is being built. Check back soon.</p>
      <a href="/" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 600 }}>← Back to Home</a>
    </div>
  );
}
