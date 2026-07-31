"use client";

// ===============================================================
// src/app/(standalone)/verify-email/page.tsx
//
// Ported faithfully from verify-email.html's inline script.
//
// Reached via the confirmation link in the vendor welcome/signup
// email. Exchanges the ?code= param for a real session (if present),
// then marks vendors.email_verified = true for that auth_user_id,
// and redirects back to the vendor dashboard.
// ===============================================================

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./verify-email.module.css";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [message, setMessage] = useState("Verifying your email...");
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");

  useEffect(() => {
    async function verify() {
      const code = searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session?.user) {
          setMessage("Invalid or expired verification link.");
          setStatus("error");
          return;
        }

        const { error: vendorError } = await supabase
          .from("vendors")
          .update({ email_verified: true })
          .eq("auth_user_id", session.user.id);

        if (vendorError) {
          setMessage("Unable to verify email.");
          setStatus("error");
          return;
        }

        setMessage("Your email has been verified successfully.");
        setStatus("success");

        // Refresh auth session
        await supabase.auth.refreshSession();

        // Redirect owner back to dashboard
        setTimeout(() => {
          router.push("/vendordashboard");
        }, 1500);
      } catch (err) {
        console.error(err);
        setMessage("Verification failed.");
        setStatus("error");
      }
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.verifyCard}>
        <h1>Email Verification</h1>
        <p className={status === "success" ? styles.success : status === "error" ? styles.error : undefined}>
          {message}
        </p>
      </div>
    </div>
  );
}
