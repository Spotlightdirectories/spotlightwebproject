"use client";

// ===============================================================
// src/app/(main)/customer-signup/page.tsx
//
// Customer signup — ported faithfully from customer-signup.html +
// customer-signup.js.
//
// If the email already has a Spotlight identity (almost always an
// existing vendor account, since the same email/password can be both
// a vendor and a customer per Cyril's decision), this doesn't dead-
// end — it offers a link to customer-login in "setup mode"
// (?setup=1&email=&name=), which logs into that existing identity
// and attaches a new customers row to it.
// ===============================================================

import { useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./customer-signup.module.css";

export default function CustomerSignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ReactNode>("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!fullName.trim() || !email.trim() || !password) {
      setError("All fields are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    // Create auth user (email confirmation ON — same as vendor signup)
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/customer-login`,
      },
    });

    if (authError) {
      const alreadyRegistered = /already registered/i.test(authError.message || "");
      if (alreadyRegistered) {
        setError(
          <>
            An account with this email already exists on Spotlight.
            <a
              href={`/customer-login?setup=1&email=${encodeURIComponent(email.trim())}&name=${encodeURIComponent(fullName.trim())}`}
              style={{ display: "block", marginTop: 6, fontWeight: 700 }}
            >
              Log in to set up your customer profile
            </a>
          </>
        );
      } else {
        setError(authError.message);
      }
      setSubmitting(false);
      return;
    }

    // Create customer row immediately, same proven pattern as vendor
    // signup — signUp()'s session is usable right away for this
    // insert, even before the confirmation link is clicked.
    const { error: customerError } = await supabase.from("customers").insert([
      {
        auth_user_id: data.user!.id,
        name: fullName.trim(),
        email: email.trim(),
      },
    ]);

    if (customerError) {
      setError(customerError.message);
      setSubmitting(false);
      return;
    }

    // Send welcome email — same fire-and-forget pattern used
    // elsewhere in this codebase, non-fatal if it fails.
    try {
      await fetch(
        "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email.trim(),
            subject: "Welcome to Spotlight",
            html: `<p>Hi ${fullName.trim()},</p><p>Your Spotlight customer account is ready. Save your favorite vendors and manage your reviews any time you're logged in.</p>`,
          }),
        }
      );
    } catch { /* non-fatal */ }

    setSubmitting(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className={styles.authWrapper}>
        <div className={styles.authCard}>
          <div className={styles.confirmationBox}>
            <h3>Check your email</h3>
            <p>We've sent a confirmation link to your email address. Click it to activate your account, then log in.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>

        <h1 className={styles.authTitle}>Create your account</h1>
        <p className={styles.authSubtitle}>Save your favorite vendors and manage your reviews in one place.</p>

        {error && <div className={styles.authError}>{error}</div>}

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <div>
            <label htmlFor="fullName">Full name</label>
            <input
              type="text"
              id="fullName"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
          </div>

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
            <input
              type="password"
              id="password"
              minLength={6}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className={styles.authBtn} disabled={submitting}>
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className={styles.authFooter}>
          Already have an account? <a href="/customer-login">Log in</a>
        </p>

        <p className={styles.authFooter}>
          Own a business? <a href="/signup">Sign up as a vendor instead</a>
        </p>

      </div>
    </div>
  );
}
