"use client";

// ===============================================================
// src/app/(standalone)/verify-email/page.tsx
//
// Reached via the confirmation link the "swift-task" edge function
// emails out when a vendor clicks "Verify Email" in the dashboard.
// That function generates its own one-time token (stored in
// email_verification_tokens, NOT Supabase Auth) and links to
// `?token=<uuid>`.
//
// FIXED (2026-08-01): this page previously looked for a `?code=`
// param and tried supabase.auth.exchangeCodeForSession(code) — that's
// the mechanism for Supabase's native magic-link auth, which has
// nothing to do with the custom token system swift-task actually
// uses. Since the email link never contains `?code=`, this always
// failed with "Invalid or expired verification link," regardless of
// whether the token itself was valid. Now it reads `?token=` and
// hands it to the verify-email-token edge function, which validates
// it (expiry + single-use) and flips vendors.email_verified using the
// service role key — no logged-in session required, since email links
// are often opened in a different browser/device than the one the
// vendor is signed into.
// ===============================================================

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./verify-email.module.css";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "This verification link is missing its token.",
  invalid: "Invalid or expired verification link.",
  used: "This verification link has already been used.",
  expired: "This verification link has expired. Please request a new one from your dashboard.",
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [message, setMessage] = useState("Verifying your email...");
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");

  useEffect(() => {
    async function verify() {
      const token = searchParams.get("token");

      if (!token) {
        setMessage("This verification link is missing its token.");
        setStatus("error");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-email-token", {
          body: { token },
        });

        if (error || !data?.success) {
          const code = data?.error as string | undefined;
          setMessage((code && ERROR_MESSAGES[code]) || "Invalid or expired verification link.");
          setStatus("error");
          return;
        }

        setMessage("Your email has been verified successfully.");
        setStatus("success");

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
