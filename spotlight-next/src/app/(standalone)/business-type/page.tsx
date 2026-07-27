"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./business-type.module.css";

export default function BusinessTypePage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string>("");
  const [planTier, setPlanTier] = useState<string>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("");
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const { data: vendor, error } = await supabase
        .from("vendors")
        .select("id, business_type, plan_tier, subscription_status")
        .eq("auth_user_id", session.user.id)
        .single();

      if (error || !vendor) {
        alert("Unable to load vendor profile.");
        router.replace("/login");
        return;
      }

      // Already selected — route correctly based on plan
      if (vendor.business_type) {
        routeAfterBusinessType(vendor.plan_tier, vendor.subscription_status);
        return;
      }

      setVendorId(vendor.id);
      setPlanTier(vendor.plan_tier);
      setSubscriptionStatus(vendor.subscription_status);
      setLoading(false);
    }
    load();
  }, [router]);

  function routeAfterBusinessType(plan: string, status: string) {
    if (plan === "free") {
      router.replace("/vendordashboard");
      return;
    }
    if (status === "active") {
      router.replace("/vendordashboard");
      return;
    }
    // Paid plan not yet paid → go to payment
    router.replace("/payment");
  }

  async function handleContinue() {
    if (!selected) { alert("Select a business type."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("vendors")
      .update({ business_type: selected })
      .eq("id", vendorId);
    if (error) {
      alert("Unable to save business type.");
      setSaving(false);
      return;
    }
    routeAfterBusinessType(planTier, subscriptionStatus);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>
      </div>
    );
  }

  const options = [
    { value: "product", label: "Product Business", desc: "Sell physical products." },
    { value: "service", label: "Service Business", desc: "Provide professional or business services." },
    { value: "hybrid", label: "Hybrid Business", desc: "Sell products and provide services." },
  ];

  return (
    <main className={styles.btPage}>
      <div className={styles.btCard}>
        <h1>Select Your Business Type</h1>
        <p>This choice determines how your dashboard is configured.</p>

        {options.map(opt => (
          <label
            key={opt.value}
            className={`${styles.btOption} ${selected === opt.value ? styles.btOptionSelected : ""}`}
          >
            <input
              type="radio"
              name="businessType"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
            />
            <div>
              <strong>{opt.label}</strong>
              <span>{opt.desc}</span>
            </div>
          </label>
        ))}

        <button
          type="button"
          className={styles.btBtn}
          onClick={handleContinue}
          disabled={saving}
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </main>
  );
}
