"use client";

// ===============================================================
// src/app/(main)/payment/page.tsx
//
// Faithful port of production payment.html + payment.js — the
// subscription checkout page reached from getlisted after a vendor
// picks a paid plan. Reads the plan choice getlisted already saves
// to localStorage ("selectedPlan"), then lets the vendor pay via
// Paystack (card) or bank transfer + receipt upload.
//
// Placed under the (main) route group since production's version
// uses the same site-wide navbar as every public content page.
//
// Backend already exists and is unchanged: verify-paystack-payment
// (Edge Function) and paystack-webhook were already deployed before
// this port started — confirmed live via list_edge_functions.
// paystack-webhook is the PRIMARY activation path in production; the
// client-side verify call here is a UX nicety for showing the success
// screen sooner, matching production's own comment on this exact
// point.
//
// Styling uses the site's brand tokens (dark mode) instead of
// production's hardcoded light-only inline styles, same treatment as
// every other ported page this migration.
// ===============================================================

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { supabase } from "@/lib/supabase";
import { uploadVendorFile } from "@/lib/uploadVendorFile";
import styles from "./payment.module.css";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

type Vendor = {
  id: string;
  plan_tier: string | null;
  subscription_status: string | null;
  billing_cycle: string | null;
};

const PAID_PLANS = ["standard", "enterprise", "elite", "custom"];

// Matches production's getAmountInKobo exactly.
// TEMPORARY LIVE-KEY TEST PRICE — standard/monthly dropped to ₦200
// (20000 kobo) so Cyril can confirm the real Paystack + webhook chain
// works without paying full price. MUST be reverted to 299800 right
// after the test. See paystack-webhook and verify-paystack-payment —
// their copies of this table must match or the payment gets flagged
// for manual review instead of activating.
const PRICES_KOBO: Record<string, { monthly: number; yearly: number }> = {
  standard: { monthly: 20000, yearly: 2698200 },
  enterprise: { monthly: 1260000, yearly: 11340000 },
  elite: { monthly: 2240000, yearly: 20160000 },
};

function getAmountInKobo(plan: string | null | undefined, billingType: string) {
  const normalizedPlan = (plan || "").toLowerCase();
  const entry = PRICES_KOBO[normalizedPlan];
  if (!entry) return 0;
  return entry[billingType as "monthly" | "yearly"] ?? entry.monthly;
}

export default function PaymentPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [effectivePlan, setEffectivePlan] = useState<string>("");
  const [billingType, setBillingType] = useState<string>("monthly");

  const [isMidCycleUpgrade, setIsMidCycleUpgrade] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  const [bankSectionOpen, setBankSectionOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFileName, setReceiptFileName] = useState("No file chosen");
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);
  const [successScreen, setSuccessScreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (cancelled) return;
      setUserId(user.id);
      setUserEmail(user.email || null);

      const { data: v } = await supabase
        .from("vendors")
        .select("id, plan_tier, subscription_status, billing_cycle, created_at")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      // A vendor row can genuinely not exist yet (signup completed but
      // business profile setup never finished) — same guard production
      // has, checked before anything below reads vendor.plan_tier.
      if (!v) {
        router.replace("/vendordashboard");
        return;
      }

      const selectedPlan = typeof window !== "undefined" ? localStorage.getItem("selectedPlan") : null;
      const plan = selectedPlan && selectedPlan !== v.plan_tier ? selectedPlan : v.plan_tier || "";
      setEffectivePlan(plan);

      // getlisted's yearly/monthly toggle writes "billingType" to
      // localStorage right alongside "selectedPlan" (see getlisted's
      // handlePlanClick) — but this page previously never read it back,
      // always falling through to the vendor's existing DB billing_cycle
      // (null/"monthly" for a brand-new vendor). That's why the toggle
      // could visually default to "yearly" on getlisted yet the actual
      // Paystack popup still charged monthly: the selection was written
      // but never consulted. Same "is this a fresh plan pick, not a
      // stale existing record" condition as the plan override above.
      const selectedBillingType = typeof window !== "undefined" ? localStorage.getItem("billingType") : null;
      const cycle = selectedPlan && selectedBillingType ? selectedBillingType : v.billing_cycle || "monthly";
      setBillingType(cycle);

      const upgradingFromFree = v.plan_tier === "free" && !!selectedPlan && selectedPlan !== "free";

      if (v.plan_tier === "free" && !upgradingFromFree) {
        router.replace("/vendordashboard");
        return;
      }

      const upgradingPlan = !!selectedPlan && selectedPlan !== v.plan_tier;

      // A genuine mid-cycle upgrade: vendor already has an ACTIVE paid
      // plan and is switching to a different one before it's ended —
      // exactly the scenario the Disclaimer's "Mid-Cycle Plan Upgrades"
      // section covers, shown here at the actual decision point.
      const midCycle = PAID_PLANS.includes((v.plan_tier || "").toLowerCase()) && v.subscription_status === "active" && upgradingPlan;
      setIsMidCycleUpgrade(midCycle);

      if (PAID_PLANS.includes((v.plan_tier || "").toLowerCase()) && v.subscription_status === "active" && !upgradingPlan) {
        router.replace("/vendordashboard");
        return;
      }

      if (v.subscription_status === "pending") {
        const { data: latestPendingPayment } = await supabase
          .from("vendor_payments")
          .select("created_at, payment_method")
          .eq("vendor_id", v.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestPendingPayment?.created_at) {
          const createdAt = new Date(latestPendingPayment.created_at);
          const hoursPassed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
          // Bank transfers: 48h (admin needs time to review receipts).
          // Card payments: 24h (webhook should fire within seconds).
          const downgradeCutoffHours = latestPendingPayment.payment_method === "bank" ? 48 : 24;

          if (hoursPassed >= downgradeCutoffHours) {
            await supabase
              .from("vendors")
              .update({ plan_tier: "free", billing_cycle: null, subscription_status: "free", is_premium: false })
              .eq("id", v.id);
            await supabase
              .from("vendor_payments")
              .update({ status: "expired" })
              .eq("vendor_id", v.id)
              .eq("status", "pending");
            router.replace("/vendordashboard");
            return;
          }
        }
      }

      setVendor(v as Vendor);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Payment buttons stay disabled until the disclaimer is explicitly
  // acknowledged — this is the actual gate, not just a visual note.
  const paymentDisabled = isMidCycleUpgrade && !disclaimerChecked;

  async function handlePayOnline() {
    if (!vendor || !userId) return;
    setPayingOnline(true);

    // Read this once, up front, and refuse to proceed if it's missing
    // rather than silently falling back to a hardcoded live key. A
    // missing env var should fail loudly, not quietly start charging
    // real cards on what everyone believes is a test setup.
    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackKey) {
      alert("Payment is temporarily unavailable (configuration error). Please contact support — do not retry.");
      setPayingOnline(false);
      return;
    }

    // Expire older pending card payments.
    await supabase
      .from("vendor_payments")
      .update({ status: "expired" })
      .eq("vendor_id", vendor.id)
      .eq("payment_method", "card")
      .eq("status", "pending");

    const paystackReference = `SPOT_${Date.now()}`;

    const { data, error } = await supabase
      .from("vendor_payments")
      .insert({
        vendor_id: vendor.id,
        auth_user_id: userId,
        plan: effectivePlan,
        billing_type: billingType,
        amount: getAmountInKobo(effectivePlan, billingType),
        payment_method: "card",
        status: "pending",
        gateway_ref: paystackReference,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      alert("Could not create payment record.");
      setPayingOnline(false);
      return;
    }

    if (!window.PaystackPop) {
      alert("Payment could not start. Please refresh and try again.");
      setPayingOnline(false);
      return;
    }

    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email: userEmail,
      amount: getAmountInKobo(effectivePlan, billingType),
      currency: "NGN",
      ref: paystackReference,
      metadata: { auth_user_id: userId },
      callback: (response: { reference: string }) => {
        verifyPayment(response.reference, data.id);
      },
      onClose: () => {
        alert("Payment window closed. If payment was completed successfully, your account will update automatically after verification.");
        router.replace("/vendordashboard");
      },
    });

    handler.openIframe();
  }

  async function verifyPayment(reference: string, paymentId: string) {
    if (!vendor || !userId) return;
    try {
      const { error } = await supabase.functions.invoke("verify-paystack-payment", {
        body: { reference, payment_id: paymentId, auth_user_id: userId },
      });

      if (error) {
        // The webhook (paystack-webhook) is the PRIMARY activation path
        // — this client-side verify call is really just a UX nicety.
        // If it fails for a network reason, check the vendor's actual
        // current status before showing a scary "payment failed"
        // message that may not even be true.
        const { data: refreshedVendor } = await supabase
          .from("vendors")
          .select("subscription_status, plan_tier")
          .eq("id", vendor.id)
          .maybeSingle();

        if (refreshedVendor?.subscription_status === "active" && refreshedVendor?.plan_tier === effectivePlan) {
          setSuccessScreen(true);
          setTimeout(() => router.replace("/vendordashboard"), 2500);
          return;
        }

        alert("We couldn't confirm your payment right away. If money was deducted, your account will update automatically within a few minutes once our system receives confirmation. Please check your dashboard shortly.");
        router.replace("/vendordashboard");
        return;
      }

      setSuccessScreen(true);
      setTimeout(() => router.replace("/vendordashboard"), 2500);
    } catch (err) {
      console.error("Unexpected verification error:", err);
      alert("Payment verification failed. Please contact support.");
    } finally {
      setPayingOnline(false);
    }
  }

  function handleReceiptFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setReceiptFile(file);
    setReceiptFileName(file ? file.name : "No file chosen");
  }

  async function handleSubmitReceipt() {
    if (!vendor || !userId) return;

    if (!receiptFile) {
      alert("Select a receipt file.");
      return;
    }

    setSubmittingReceipt(true);

    const { data: paymentData, error: paymentError } = await supabase
      .from("vendor_payments")
      .insert({
        vendor_id: vendor.id,
        auth_user_id: userId,
        plan: effectivePlan,
        amount: getAmountInKobo(effectivePlan, billingType),
        billing_type: billingType,
        payment_method: "bank",
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (paymentError || !paymentData) {
      alert(paymentError?.message || "Could not create payment record.");
      setSubmittingReceipt(false);
      return;
    }

    let uploadResult;
    try {
      uploadResult = await uploadVendorFile(receiptFile, "receipt");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Receipt upload failed.");
      setSubmittingReceipt(false);
      return;
    }

    const { error: receiptLinkError } = await supabase
      .from("vendor_payments")
      .update({ transfer_proof_url: uploadResult.path })
      .eq("id", paymentData.id);

    if (receiptLinkError) {
      console.error("Failed to attach receipt to payment record:", receiptLinkError);
      alert("Your receipt file uploaded, but we couldn't attach it to your payment record. Please contact support@spotlightdirectories.com so we can complete this manually.");
      setSubmittingReceipt(false);
      return;
    }

    const { error: statusError } = await supabase
      .from("vendors")
      .update({ subscription_status: "pending" })
      .eq("id", vendor.id);

    if (statusError) {
      console.error("Failed to mark subscription as pending:", statusError);
      alert("Your receipt was received, but we couldn't update your account status. Please contact support@spotlightdirectories.com so we can complete this manually.");
      setSubmittingReceipt(false);
      return;
    }

    router.replace("/payment-status");
  }

  if (successScreen) {
    return (
      <div className={styles.successOverlay}>
        <div className={styles.successCard}>
          <h2>&#10004; Payment Verified Successfully</h2>
          <p>Redirecting you to complete onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />

      <h1>Complete Your Subscription</h1>

      {loading ? (
        <p className={styles.loading}>Loading...</p>
      ) : (
        <>
          <div className={styles.planSummary}>You selected the {effectivePlan.toUpperCase()} plan.</div>

          {isMidCycleUpgrade && (
            <div className={styles.upgradeDisclaimer}>
              <p>
                You&apos;re upgrading while your current subscription is still active. Your new plan and billing
                cycle will start <strong>immediately</strong> upon payment, and any unused time remaining on your
                current plan will be forfeited. Spotlight Directories does not offer refunds for upgrades made
                before the end of an existing subscription period — all payments are final. See our{" "}
                <a href="/disclaimer" target="_blank" rel="noopener noreferrer">Disclaimer</a> for full terms.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={disclaimerChecked}
                  onChange={(e) => setDisclaimerChecked(e.target.checked)}
                />
                I understand and agree to these terms
              </label>
            </div>
          )}

          {!bankSectionOpen ? (
            <div className={styles.paymentActions}>
              <button type="button" className={styles.actionBtn} onClick={handlePayOnline} disabled={paymentDisabled || payingOnline}>
                {payingOnline ? "Processing..." : "Pay Online"}
              </button>
              <button type="button" className={styles.actionBtnSecondary} onClick={() => setBankSectionOpen(true)} disabled={paymentDisabled}>
                Pay via Bank Transfer
              </button>
            </div>
          ) : (
            <div className={styles.bankSection}>
              <h3>Bank Transfer Instructions</h3>
              <p>
                Bank: Sterling Bank Plc<br />
                Account Name: Spotlight Digital Services Ltd<br />
                Account Number: 0140270780
              </p>
              <p className={styles.bankNote}>
                After payment, upload your receipt below or send receipt to support@spotlightdirectories.com
              </p>

              <label className={styles.fieldLabel} htmlFor="receiptFile">Your Receipt (png, jpeg or PDF)</label>
              <div className={styles.chooseRow}>
                <label htmlFor="receiptFile" className={styles.chooseBtn}>Choose File</label>
                <span className={styles.chooseFileName}>{receiptFileName}</span>
                <input id="receiptFile" type="file" accept="image/*,application/pdf" hidden onChange={handleReceiptFileChange} />
              </div>

              <button type="button" className={styles.actionBtn} onClick={handleSubmitReceipt} disabled={submittingReceipt}>
                {submittingReceipt ? "Uploading Receipt..." : "Submit Receipt"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
