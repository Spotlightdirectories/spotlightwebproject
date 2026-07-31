"use client";

// ===============================================================
// src/app/(standalone)/partner-create-account/page.tsx
//
// Reached from the "Create your account" link in the partner
// approval email (PartnerApprovalsTab.tsx's approvePartner), which
// includes ?partner_id=<partners.id>. Faithful port of
// partner-create-account.js, with two deliberate fixes:
//
// 1. Account linking (partners.user_id = auth.uid()) now goes
//    through a new SECURITY DEFINER RPC, link_partner_account(),
//    instead of a raw client-side update. Research (2026-08)
//    confirmed the live `partners` table has NO update policy at all
//    for a plain (non-admin) authenticated user — meaning this exact
//    linking step has always silently failed in production (the
//    original file didn't even check the update's error/result). The
//    RPC bypasses RLS safely and only ever links the CALLER's own
//    account to the partner row matching their own email.
// 2. Since signUp() creates a live session immediately (this project
//    auto-confirms new accounts), the partner is sent straight to
//    /partner-dashboard instead of back to a login screen they'd
//    have to fill in again.
// ===============================================================

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { partnerSupabase, setPartnerSession } from "@/lib/partnerSupabase";
import { EmailTemplates } from "@/lib/emailTemplates";
import styles from "../partner-program/partner-program.module.css";

export default function PartnerCreateAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerId = searchParams.get("partner_id");

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!partnerId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    (async () => {
      const { data } = await partnerSupabase
        .from("partners")
        .select("email, name, user_id")
        .eq("id", partnerId)
        .maybeSingle();

      if (!data || !data.email) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setEmail(data.email);
      setName(data.name || "");
      setLoading(false);
    })();
  }, [partnerId]);

  async function handleSubmit() {
    setError("");

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    const { data: signUpData, error: signUpError } = await partnerSupabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/partner-program#login` },
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already registered") || signUpError.message.toLowerCase().includes("already been registered")) {
        setError("An account already exists for this email. Try logging in instead.");
      } else {
        setError(signUpError.message);
      }
      setSubmitting(false);
      return;
    }

    if (!signUpData.user) {
      setError("Could not create your account. Please try again.");
      setSubmitting(false);
      return;
    }

    const { data: linkedPartnerId, error: linkError } = await partnerSupabase.rpc("link_partner_account");

    if (linkError || !linkedPartnerId) {
      console.error("Partner account linking failed:", linkError);
      setError(
        "Your login was created, but we couldn't connect it to your partner application. Please contact support@spotlightdirectories.com."
      );
      setSubmitting(false);
      return;
    }

    const { data: partnerRow } = await partnerSupabase
      .from("partners")
      .select("id, name, email, referral_code")
      .eq("id", linkedPartnerId)
      .single();

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: "Your Spotlight Partner Account is Ready",
          html: EmailTemplates.partnerAccountCreated({
            partnerName: partnerRow?.name || name,
            referralCode: partnerRow?.referral_code || "",
            dashboardUrl: `${window.location.origin}/partner-dashboard`,
          }),
        }),
      });
    } catch (err) {
      console.error("Partner account-created email failed:", err);
    }

    setPartnerSession({
      user_id: signUpData.user.id,
      partner_id: linkedPartnerId as unknown as string,
      name: partnerRow?.name || name,
      email: partnerRow?.email || email,
      referral_code: partnerRow?.referral_code || null,
    });

    router.push("/partner-dashboard");
  }

  if (loading) {
    return (
      <main className={styles.authWrapper}>
        <div className={styles.authCard}>
          <p>Loading…</p>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className={styles.authWrapper}>
        <div className={styles.authCard}>
          <div className={styles.successCard}>
            <h2>Link Not Found</h2>
            <p>
              This account-creation link isn&apos;t valid or has already been used. If you were recently approved as
              a Spotlight Partner, check your approval email for the correct link, or contact
              support@spotlightdirectories.com.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Create Your Partner Account</h1>
        <p className={styles.authSubtitle}>Set a password to activate your Spotlight Partner login.</p>

        <div className={styles.authForm}>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} readOnly disabled />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button type="button" className={styles.authBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating Account..." : "Create Account"}
          </button>
          {error && <p className={styles.authError}>{error}</p>}
        </div>
      </div>
    </main>
  );
}
