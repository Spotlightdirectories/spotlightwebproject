"use client";

// ===============================================================
// src/app/(standalone)/partner-program/page.tsx
//
// Partner Programme — application form + existing-partner login,
// combined on one page (tab-switched), matching production's
// partner-program.html structure.
//
// IMPORTANT — this is a faithful port of the CORRECT referral logic,
// not of the current live partner-program.js. Research (2026-08)
// confirmed the current live version writes to columns that don't
// exist on the real `partners` table (`lga`, `referred_by_code`) —
// meaning it cannot successfully insert a row at all against the
// live schema. An older archived file, partner-program-legacy.js,
// has the correct logic (local_government, referred_by, uppercase
// referral-code matching, checking both email AND phone for
// duplicates) — that's what this page follows.
//
// Referral-code resolution uses a new SECURITY DEFINER RPC,
// get_partner_id_by_referral_code, instead of a raw
// `.from("partners").select(...)` — the live `partners` table is
// fully public-readable (a separate, pre-existing gap flagged to
// Cyril, not fixed here since it also affects the already-working
// vendor-signup referral flow and needs its own dedicated pass), so
// new code written today deliberately avoids relying on that broad
// read rather than adding to what depends on it.
//
// Uses the isolated partnerSupabase client (its own storageKey) so a
// partner's login never collides with a vendor/customer session in
// the same browser.
// ===============================================================

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { partnerSupabase, setPartnerSession } from "@/lib/partnerSupabase";
import { nigeriaData } from "@/lib/nigeria-data";
import { EmailTemplates } from "@/lib/emailTemplates";
import styles from "./partner-program.module.css";

type Tab = "apply" | "login";

function isAtLeast18(dob: string): boolean {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 18;
}

export default function PartnerProgramPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("apply");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#login") {
      setTab("login");
    }
  }, []);

  // ---------------------------------------------------------------
  // APPLY FORM STATE
  // ---------------------------------------------------------------
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [lga, setLga] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  const lgaOptions: string[] = stateVal ? nigeriaData[stateVal as keyof typeof nigeriaData] || [] : [];

  function handleStateChange(next: string) {
    setStateVal(next);
    setLga("");
  }

  async function handleApply() {
    setApplyError("");

    if (!name.trim() || !email.trim() || !phone.trim() || !stateVal || !lga || !dob) {
      setApplyError("Please fill in every field.");
      return;
    }
    if (!consent) {
      setApplyError("Please agree to the terms to continue.");
      return;
    }
    if (!isAtLeast18(dob)) {
      setApplyError("You must be at least 18 years old to join the Partner Programme.");
      return;
    }

    setApplying(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    // Matches both unique constraints that actually exist on the
    // table (unique_partner_email, unique_partner_phone) — the
    // current live page only ever checked email.
    const { data: existing } = await partnerSupabase
      .from("partners")
      .select("id")
      .or(`email.eq.${trimmedEmail},phone.eq.${trimmedPhone}`)
      .maybeSingle();

    if (existing) {
      setApplyError("An application already exists with this email or phone number.");
      setApplying(false);
      return;
    }

    // Referral capture — a partner sharing their own link with a
    // prospective sub-partner. Codes are always generated uppercase
    // (see PartnerApprovalsTab.tsx), so the lookup normalizes case on
    // both ends regardless of how the link was shared/typed.
    let referredBy: string | null = null;
    const refParam = searchParams.get("ref");
    if (refParam) {
      const { data: resolvedId } = await partnerSupabase
        .rpc("get_partner_id_by_referral_code", { p_code: refParam })
        .maybeSingle();
      if (resolvedId) referredBy = resolvedId as unknown as string;
    }

    const { data: partner, error } = await partnerSupabase
      .from("partners")
      .insert({
        name: name.trim(),
        email: trimmedEmail,
        phone: trimmedPhone,
        state: stateVal,
        local_government: lga,
        date_of_birth: dob,
        status: "pending",
        referred_by: referredBy,
      })
      .select("id, name")
      .single();

    if (error || !partner) {
      setApplyError(error?.message || "Could not submit your application. Please try again.");
      setApplying(false);
      return;
    }

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: trimmedEmail,
          subject: "Application Received — Spotlight Partner Programme",
          html: EmailTemplates.partnerApplicationReceived({ partnerName: partner.name || "" }),
        }),
      });
    } catch (err) {
      console.error("Application acknowledgment email failed:", err);
    }

    setApplying(false);
    setSubmitted(true);
  }

  // ---------------------------------------------------------------
  // LOGIN FORM STATE
  // ---------------------------------------------------------------
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  async function handleLogin() {
    setLoginError("");
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Enter your email and password.");
      return;
    }
    setLoggingIn(true);

    const { data: signInData, error: signInError } = await partnerSupabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });

    if (signInError || !signInData.user) {
      setLoginError("Incorrect email or password.");
      setLoggingIn(false);
      return;
    }

    // Defensive re-link on every login (mirrors production's intent)
    // — bootstraps the very first link right after account creation,
    // and is a safe no-op on every login after that. Surfaces a clear
    // message if this login has no matching partner application at
    // all, rather than dropping the visitor into a broken dashboard.
    const { data: partnerId, error: linkError } = await partnerSupabase.rpc("link_partner_account");

    if (linkError || !partnerId) {
      setLoginError(
        linkError?.message ||
          "We couldn't find a partner account for this login. If you just applied, please wait for approval and use the account setup link from your approval email."
      );
      await partnerSupabase.auth.signOut();
      setLoggingIn(false);
      return;
    }

    const { data: partnerRow } = await partnerSupabase
      .from("partners")
      .select("id, name, email, referral_code")
      .eq("id", partnerId)
      .single();

    setPartnerSession({
      user_id: signInData.user.id,
      partner_id: partnerId as unknown as string,
      name: partnerRow?.name || "",
      email: partnerRow?.email || loginEmail.trim(),
      referral_code: partnerRow?.referral_code || null,
    });

    router.push("/partner-dashboard");
  }

  if (submitted) {
    return (
      <main className={styles.authWrapper}>
        <div className={styles.authCard}>
          <div className={styles.successCard}>
            <h2>Application Received</h2>
            <p>
              Thank you for applying to the Spotlight Partner Programme. We&apos;ve sent a confirmation to your
              email — our team typically reviews applications within 2–5 business days. You&apos;ll receive an
              email with next steps once a decision has been made.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Spotlight Partner Programme</h1>
        <p className={styles.authSubtitle}>Earn commissions referring businesses and partners to Spotlight.</p>

        <div className={styles.tabRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === "apply" ? styles.active : ""}`}
            onClick={() => setTab("apply")}
          >
            Apply
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === "login" ? styles.active : ""}`}
            onClick={() => setTab("login")}
          >
            Log In
          </button>
        </div>

        {tab === "apply" ? (
          <div className={styles.authForm}>
            <div>
              <label htmlFor="name">Full Name</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="phone">Phone</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className={styles.fieldRow}>
              <div>
                <label htmlFor="state">State</label>
                <select id="state" value={stateVal} onChange={(e) => handleStateChange(e.target.value)}>
                  <option value="">Select State</option>
                  {Object.keys(nigeriaData).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="lga">LGA</label>
                <select id="lga" value={lga} onChange={(e) => setLga(e.target.value)} disabled={!stateVal}>
                  <option value="">Select LGA</option>
                  {lgaOptions.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="dob">Date of Birth</label>
              <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <label className={styles.consentRow}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                I agree to the{" "}
                <a href="/partner-legal#terms" target="_blank" rel="noopener noreferrer">Partner Programme Terms</a>{" "}
                and{" "}
                <a href="/partner-legal#privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </span>
            </label>
            <button type="button" className={styles.authBtn} onClick={handleApply} disabled={applying}>
              {applying ? "Submitting..." : "Submit Application"}
            </button>
            {applyError && <p className={styles.authError}>{applyError}</p>}
          </div>
        ) : (
          <div className={styles.authForm}>
            <div>
              <label htmlFor="loginEmail">Email</label>
              <input id="loginEmail" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="loginPassword">Password</label>
              <div className={styles.passwordWrap}>
                <input
                  id="loginPassword"
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
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
            <button type="button" className={styles.authBtn} onClick={handleLogin} disabled={loggingIn}>
              {loggingIn ? "Logging in..." : "Log In"}
            </button>
            {loginError && <p className={styles.authError}>{loginError}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
