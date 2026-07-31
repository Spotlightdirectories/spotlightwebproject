"use client";

// ===============================================================
// src/app/(main)/customer-login/page.tsx
//
// Customer login — ported faithfully from customer-login.html +
// customer-login.js.
//
// Dual customer/vendor account model: a "setup" mode (?setup=1&
// email=&name=) arrives from customer-signup when the email already
// has a Spotlight identity (almost always an existing vendor
// account). Logging in here in setup mode attaches a new `customers`
// row to that same already-authenticated auth_user_id, rather than
// dead-ending. A plain login attempt with no customer row and no
// setup params still correctly rejects.
//
// "Forgot password?" is a genuine addition, not a porting gap fix —
// production has no password reset flow for customer accounts at
// all. Added per Cyril's explicit request, reusing the same
// forgot-password/reset-password pages already built for vendors and
// partners via a new ?type=customer.
// ===============================================================

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./customer-login.module.css";

export default function CustomerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setupMode = searchParams.get("setup") === "1";
  const setupEmail = searchParams.get("email") || "";
  const setupName = searchParams.get("name") || "";

  useEffect(() => {
    if (setupEmail) setEmail(setupEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (!customer) {
      if (setupMode) {
        // Explicitly arrived here to attach a customer profile to
        // this already-authenticated identity — create it now.
        const { error: createError } = await supabase.from("customers").insert([
          {
            auth_user_id: data.user.id,
            name: setupName || null,
            email: email.trim(),
          },
        ]);

        if (createError) {
          setError("Could not set up your customer profile. Please try again.");
          setLoading(false);
          return;
        }

        router.push("/customer-profile");
        return;
      }

      // No customer profile, and not in setup mode — a genuine
      // vendor-only account trying the wrong login.
      setError("No customer account found for this email. If you signed up as a vendor, please use the vendor login instead.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push("/customer-profile");
  }

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>

        <h1 className={styles.authTitle}>Welcome back</h1>
        <p className={styles.authSubtitle}>
          {setupMode
            ? "Log in below and we'll set up your customer profile on this account."
            : "Log in to see your favorite vendors and reviews."}
        </p>

        {error && <div className={styles.authError}>{error}</div>}

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
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

          <button type="submit" className={styles.authBtn} disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className={styles.authLink}>
          <a href="/forgot-password?type=customer">Forgot password?</a>
        </p>

        <p className={styles.authFooter}>
          New here? <a href="/customer-signup">Create an account</a>
        </p>

        <p className={styles.authFooter}>
          Own a business? <a href="/login">Log in as a vendor instead</a>
        </p>

      </div>
    </div>
  );
}
