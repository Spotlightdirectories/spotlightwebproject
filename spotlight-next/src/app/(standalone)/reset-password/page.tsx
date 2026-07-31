"use client";

// ===============================================================
// src/app/(standalone)/reset-password/page.tsx
//
// Ported faithfully from reset-password.html + reset-password.js.
//
// Reached via the recovery link Supabase emails after
// forgot-password's resetPasswordForEmail() call, which Supabase
// auto-detects and turns into a real signed-in session on this page
// (no code/token handling needed here). "reset_type" — stashed in
// localStorage by forgot-password since Supabase's own redirect
// doesn't carry it through as a query param here — decides where to
// send the user after a successful reset: partners go back to
// /partner-program, customers go back to /customer-login (added per
// Cyril's request — production itself has no customer reset flow),
// everyone else (vendors) goes to /login.
// ===============================================================

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./reset-password.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionValid(!!session);
      if (!session) setMsg("Invalid or expired reset link.");
      setCheckingSession(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMsg(error.message);
      return;
    }

    setSuccess(true);
    setMsg("Password reset successful! Redirecting to login...");

    const userType = localStorage.getItem("reset_type");
    setTimeout(() => {
      if (userType === "partner") {
        localStorage.removeItem("reset_type");
        router.push("/partner-program");
      } else if (userType === "customer") {
        localStorage.removeItem("reset_type");
        router.push("/customer-login");
      } else {
        router.push("/login");
      }
    }, 2500);
  }

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>

        <h1 className={styles.authTitle}>Reset your password</h1>
        <p className={styles.authSubtitle}>Choose a new secure password</p>

        {!checkingSession && sessionValid && !success && (
          <form className={styles.authForm} onSubmit={handleSubmit}>
            <div className={styles.passwordWrap}>
              <input
                type={showNew ? "text" : "password"}
                placeholder="New password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowNew(v => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                👁
              </button>
            </div>

            <div className={styles.passwordWrap}>
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                👁
              </button>
            </div>

            <button type="submit" className={styles.authBtn}>
              Update password
            </button>
          </form>
        )}

        {msg && (
          <p className={`${styles.formMsg} ${success ? styles.formMsgSuccess : ""}`}>
            {msg}
          </p>
        )}

      </div>
    </div>
  );
}
