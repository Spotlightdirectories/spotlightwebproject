"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
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

    // 3. No vendor row → go get listed
    if (!vendor) {
      router.replace("/getlisted");
      return;
    }

    // 4. Closed account
    if (vendor.account_status === "closed") {
      setError("Your account has been closed. Please contact support.");
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
        <p className={styles.authSubtitle}>Access your Spotlight dashboard</p>

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
