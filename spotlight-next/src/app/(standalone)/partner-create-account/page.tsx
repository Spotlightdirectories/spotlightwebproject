"use client";

// ===============================================================
// src/app/(standalone)/partner-create-account/page.tsx
//
// Reached from the "Create your account" link in the partner
// approval email (PartnerApprovalsTab.tsx's approvePartner), which
// includes ?partner_id=<partners.id>. Faithful port of
// partner-create-account.js, with these deliberate fixes:
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
//
// 2026-08 addition, per Cyril: payout bank details + NIN are now
// collected on this same one-time form, right after password setup —
// his explicit choice of procedure, tied to the moment a partner
// completes account setup post-approval (same link, no separate
// email/page). Saved via submit_partner_payout_details(), the same
// self-service-write pattern as link_partner_account() above: a
// narrow SECURITY DEFINER function that only ever updates the
// caller's own row. Account holder name must match the name on the
// NIN — stated on the form, not machine-checked (no NIN-verification
// API access), matching how identity docs are already handled
// elsewhere on the platform (e.g. vendor verification badges).
//
// 2026-08 addition #2, per Cyril: this platform runs ONE shared
// Supabase Auth identity per email across vendor/customer/partner/
// admin — each role is just a separate table pointing at that same
// login. If someone tries to create a partner account with an email
// that already has a Spotlight login (as a customer or vendor,
// typically), signUp() correctly rejects it as a duplicate. The old
// version of this page just dead-ended there with a plain error
// message and no way forward. Fixed by mirroring the existing
// "Dual customer/vendor account model" already used on
// customer-login: on "already registered", switch into a `link`
// mode where the SAME form now signs in with the visitor's EXISTING
// password instead of creating a new one, then continues through the
// identical link_partner_account() + payout-details path.
//
// 2026-08 addition #3, per Cyril: NIN is collected as an uploaded ID
// document (image or PDF), not a typed 11-digit number — matching
// how the platform already collects vendor verification documents.
// Uses the new "partner_nin" upload category on the shared
// validate-upload Edge Function, via uploadPartnerFile.ts.
// ===============================================================

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { partnerSupabase, setPartnerSession } from "@/lib/partnerSupabase";
import { uploadPartnerFile } from "@/lib/uploadPartnerFile";
import { EmailTemplates } from "@/lib/emailTemplates";
import styles from "./partner-create-account.module.css";

// Next.js requires useSearchParams() to sit inside a Suspense boundary
// so the page shell can still be prerendered — without this, `npm run
// build` fails outright ("should be wrapped in a suspense boundary").
export default function PartnerCreateAccountPage() {
  return (
    <Suspense fallback={null}>
      <PartnerCreateAccountForm />
    </Suspense>
  );
}

type Prefill = {
  email: string | null;
  name: string | null;
  user_id: string | null;
  payout_details_submitted_at: string | null;
};

function PartnerCreateAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerId = searchParams.get("partner_id");

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // "new" = creating a brand-new Spotlight login for this email.
  // "link" = this email already has a Spotlight login (customer or
  // vendor, usually) — the visitor signs in with their EXISTING
  // password instead, and we attach the partner role to that same
  // identity.
  const [mode, setMode] = useState<"new" | "link">("new");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Payout details — Cyril's requested procedure: collected here,
  // right after account setup/linking.
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [ninFile, setNinFile] = useState<File | null>(null);

  useEffect(() => {
    if (!partnerId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    (async () => {
      // This runs before the visitor has signed up or authenticated
      // (straight off the approval email link), so it goes through a
      // narrow RPC rather than a raw table read — the partners table
      // has no public read policy.
      const { data } = (await partnerSupabase
        .rpc("get_partner_signup_prefill", { p_partner_id: partnerId })
        .maybeSingle()) as { data: Prefill | null };

      if (!data || !data.email) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setEmail(data.email);
      setName(data.name || "");
      if (data.payout_details_submitted_at) {
        setAlreadyDone(true);
      }
      setLoading(false);
    })();
  }, [partnerId]);

  function validatePayoutFields(): string | null {
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      return "Please fill in all payout details.";
    }
    if (!/^\d{10}$/.test(accountNumber.trim())) {
      return "Account number must be exactly 10 digits.";
    }
    if (!ninFile) {
      return "Please upload a photo or scan of your NIN (National Identification Number) slip or card.";
    }
    return null;
  }

  async function finishLinkingAndPayout(userId: string) {
    const { data: linkedPartnerId, error: linkError } = await partnerSupabase.rpc("link_partner_account");

    if (linkError || !linkedPartnerId) {
      console.error("Partner account linking failed:", linkError);
      setError(
        linkError?.message?.includes("already linked")
          ? "This partner application is already linked to a different account. Please contact support@spotlightdirectories.com."
          : "Your login was verified, but we couldn't connect it to your partner application. Please contact support@spotlightdirectories.com."
      );
      setSubmitting(false);
      return;
    }

    let ninPath: string;
    try {
      const uploadResult = await uploadPartnerFile(ninFile as File, "partner_nin");
      ninPath = uploadResult.path;
    } catch (err) {
      console.error("NIN upload failed:", err);
      setError(err instanceof Error ? err.message : "Could not upload your NIN document. Please try again.");
      setSubmitting(false);
      return;
    }

    const { error: payoutError } = await partnerSupabase.rpc("submit_partner_payout_details", {
      p_bank_name: bankName.trim(),
      p_account_number: accountNumber.trim(),
      p_account_name: accountName.trim(),
      p_nin_document_path: ninPath,
    });

    if (payoutError) {
      console.error("Partner payout details failed to save:", payoutError);
      setError(
        `Your account was created, but your payout details couldn't be saved (${payoutError.message}). Please contact support@spotlightdirectories.com so we can add them for you.`
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
      user_id: userId,
      partner_id: linkedPartnerId as unknown as string,
      name: partnerRow?.name || name,
      email: partnerRow?.email || email,
      referral_code: partnerRow?.referral_code || null,
    });

    router.push("/partner-dashboard");
  }

  async function handleSubmit() {
    setError("");

    if (mode === "new") {
      if (!password || password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    } else {
      if (!password) {
        setError("Please enter your existing Spotlight password.");
        return;
      }
    }

    const payoutError = validatePayoutFields();
    if (payoutError) {
      setError(payoutError);
      return;
    }

    setSubmitting(true);

    if (mode === "new") {
      const { data: signUpData, error: signUpError } = await partnerSupabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/partner-program#login` },
      });

      if (signUpError) {
        if (
          signUpError.message.toLowerCase().includes("already registered") ||
          signUpError.message.toLowerCase().includes("already been registered")
        ) {
          // This email already has a Spotlight login (as a customer or
          // vendor, typically) — switch to linking an existing account
          // instead of dead-ending. Same shared-identity model as
          // customer-login's "Dual customer/vendor account model".
          setMode("link");
          setPassword("");
          setConfirmPassword("");
          setError(
            "This email already has a Spotlight account. Enter your existing password below to link your Partner access to it."
          );
          setSubmitting(false);
          return;
        }
        setError(signUpError.message);
        setSubmitting(false);
        return;
      }

      if (!signUpData.user) {
        setError("Could not create your account. Please try again.");
        setSubmitting(false);
        return;
      }

      await finishLinkingAndPayout(signUpData.user.id);
      return;
    }

    // mode === "link": sign in with the EXISTING password instead of
    // creating a new account.
    const { data: signInData, error: signInError } = await partnerSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      setError(signInError?.message || "Could not sign in. Please check your password and try again.");
      setSubmitting(false);
      return;
    }

    await finishLinkingAndPayout(signInData.user.id);
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

  if (alreadyDone) {
    return (
      <main className={styles.authWrapper}>
        <div className={styles.authCard}>
          <div className={styles.successCard}>
            <h2>Already Set Up</h2>
            <p>
              This partner account has already been activated and payout details have already been submitted. Head
              to the <a href="/partner-program#login">Partner Login</a> page to sign in.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>
          {mode === "new" ? "Create Your Partner Account" : "Link Your Partner Account"}
        </h1>
        <p className={styles.authSubtitle}>
          {mode === "new"
            ? "Set a password and add your payout details to activate your Spotlight Partner login."
            : "Sign in with your existing Spotlight password to add Partner access, then add your payout details."}
        </p>

        <div className={styles.authForm}>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} readOnly disabled />
          </div>
          <div>
            <label htmlFor="password">{mode === "new" ? "Password" : "Your Existing Password"}</label>
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
          {mode === "new" && (
            <div>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}
          <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--color-border, #e5e7eb)" }} />

          <p style={{ fontWeight: 600, marginBottom: 4 }}>Payout Details</p>
          <p style={{ fontSize: 13, color: "var(--color-text-muted, #64748b)", marginBottom: 16 }}>
            This is where your commissions get paid to, so please double-check everything.{" "}
            <strong>Your bank account name must match the name on your NIN</strong> — a mismatch can delay or block
            your payout.
          </p>

          <div>
            <label htmlFor="bankName">Bank Name</label>
            <input id="bankName" type="text" placeholder="e.g. GTBank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="accountNumber">Account Number</label>
            <input
              id="accountNumber"
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <label htmlFor="accountName">Account Holder Name</label>
            <input
              id="accountName"
              type="text"
              placeholder="Must match your NIN name exactly"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="nin">NIN Document (slip or card — photo or PDF)</label>
            <input
              id="nin"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setNinFile(e.target.files?.[0] ?? null)}
            />
            <p style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)", marginTop: 4 }}>
              Upload a clear photo or scan showing your 11-digit NIN. JPG, PNG, or PDF, up to 4MB.
            </p>
          </div>

          <button type="button" className={styles.authBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : mode === "new" ? "Create Account" : "Link Account"}
          </button>
          {error && <p className={styles.authError}>{error}</p>}
        </div>
      </div>
    </main>
  );
}
