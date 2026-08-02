"use client";

// ===============================================================
// src/app/(main)/forgot-password/page.tsx
//
// Ported faithfully from forgot-password.html + forgot-password.js.
//
// Shared between vendors (login.html links to plain "forgot-password"),
// partners (partner-program.html links to "forgot-password?type=partner"),
// and customers (customer-login links to "forgot-password?type=customer" —
// added per Cyril's request, since production itself has no password
// reset flow for customer accounts yet). The type read from the URL is
// stashed in localStorage so reset-password (reached later via the
// emailed link, with no query params of its own carried through
// Supabase's redirect) knows where to send the user afterward.
// ===============================================================

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./forgot-password.module.css";

// Next.js requires useSearchParams() to sit inside a Suspense boundary
// so the page shell can still be prerendered — without this, `npm run
// build` fails outright ("should be wrapped in a suspense boundary").
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordInner />
    </Suspense>
  );
}

function ForgotPasswordInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;

    setSending(true);
    setStatusMsg("Sending reset link...");

    const typeParam = searchParams.get("type");
    const resetType = typeParam === "partner" ? "partner" : typeParam === "customer" ? "customer" : "vendor";
    localStorage.setItem("reset_type", resetType);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password?type=${resetType}`,
    });

    setSending(false);

    if (error) {
      setStatusMsg(error.message);
      return;
    }

    setStatusMsg("Check your email for the reset link.");
  }

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h2>Forgot your password?</h2>
        <p>Enter your email and we&rsquo;ll send you a reset link.</p>

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="you@email.com"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button type="submit" className={styles.authBtn} disabled={sending}>
            {sending ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {statusMsg && <p className={styles.formMsg}>{statusMsg}</p>}
      </div>
    </div>
  );
}
