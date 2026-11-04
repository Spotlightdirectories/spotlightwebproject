"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createVendorRow, sendVendorWelcomeEmail, clearSignupStorage, PENDING_VENDOR_KEY, type VendorFormDetails } from "@/lib/createVendorRecord";
import styles from "./login.module.css";

// 2026-08 addition, per Cyril: the "New Visit Request" email links to
// /vendordashboard?tab=visitRequests — a logged-out vendor clicking it
// lands here first via vendordashboard's auth guard, which passes the
// intended destination through ?next=. On success, that destination is
// used instead of the hardcoded /vendordashboard, but only in the two
// cases that already went to the dashboard (free plan / active paid
// plan) — every other branch (no vendor row, closed account, missing
// business type, pending/failed payment) is a genuine blocker and
// keeps its own redirect regardless of ?next=. useSearchParams()
// requires a Suspense boundary in Next.js, hence the wrapper.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/vendordashboard";
  // "?setup=vendor" arrives from the vendor signup page when the email already belongs to a
  // customer account: after a correct login, the business is added to that same account.
  const setupMode = searchParams.get("setup") === "vendor";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    // 1. Authenticate
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // 2. Fetch vendor record
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (vendorError) {
      setError("Error fetching vendor record.");
      setLoading(false);
      return;
    }

    // 3a. Setup mode: add the business to this existing (customer) account
    if (!vendor && setupMode) {
      let pending: VendorFormDetails | null = null;
      try { pending = JSON.parse(localStorage.getItem(PENDING_VENDOR_KEY) || "null"); } catch { /* ignore */ }
      const selectedPlan = localStorage.getItem("selectedPlan");
      if (!pending || !selectedPlan || pending.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
        await supabase.auth.signOut();
        setError("We could not find your saved business details. Please go back to the vendor signup page and fill in the form again.");
        setLoading(false);
        return;
      }
      const billingType = localStorage.getItem("billingType") || "monthly";
      const createErr = await createVendorRow(authData.user.id, pending, selectedPlan, billingType);
      if (createErr) {
        await supabase.auth.signOut();
        setError(/duplicate key|unique/i.test(createErr)
          ? "This business name or email is already used by another vendor account. Please go back to the signup page and choose a different business name."
          : "Could not add your business. Please try again.");
        setLoading(false);
        return;
      }
      await sendVendorWelcomeEmail(pending, selectedPlan);
      clearSignupStorage();
      router.replace("/business-type");
      return;
    }

    // 3. No vendor row → go get listed
    if (!vendor) {
      router.replace("/getlisted");
      return;
    }

    // 4. Closed account
    if (vendor.account_status === "closed") {
      setError("This account has been closed and the closure is final. Its data is being permanently erased. If you think this is a mistake, please contact support straight away.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // 5. Business type not set yet → must select before dashboard
    if (!vendor.business_type) {
      router.replace("/business-type");
      return;
    }

    // 6. Free plan → dashboard
    if (vendor.plan_tier === "free") {
      router.replace(nextUrl);
      return;
    }

    // 7. Paid plan routing
    if (vendor.subscription_status === "pending") {
      router.replace("/payment");
      return;
    }
    if (vendor.subscription_status === "failed") {
      router.replace("/payment-failed");
      return;
    }
    if (vendor.subscription_status === "active") {
      router.replace(nextUrl);
      return;
    }

    // Fallback
    router.replace("/payment");
  }

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>

        <h1 className={styles.authTitle}>Vendor Login</h1>
        <p className={styles.authSubtitle}>{setupMode ? "Log in with your customer password and we will add your business to the same account." : "Access your Spotlight dashboard"}</p>

        {error && (
          <div className={styles.authError}>{error}</div>
        )}

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email address</label>
            <input
              type="email"
              id="email"
              placeholder="you@business.com"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Your password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                👁
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.authBtn}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className={styles.authLink}>
          <a href="/forgot-password">Forgot password?</a>
        </p>

        <div className={styles.authFooter}>
          Don't have a vendor account?{" "}
          <a href="/getlisted">Get listed</a>
        </div>

      </div>
    </div>
  );
}
