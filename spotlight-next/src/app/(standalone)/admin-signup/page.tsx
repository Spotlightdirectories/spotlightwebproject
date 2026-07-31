"use client";

// ===============================================================
// src/app/(standalone)/admin-signup/page.tsx
//
// Admin Staff Signup — token-gated, per Cyril's request (2026-07-31).
//
// Originally a faithful port of admin-signup.html (free-text email
// field), but that had a real gap: this project auto-confirms new
// accounts, so anyone who simply knew or guessed an invited email
// address could type it in here, set their own password, and
// immediately log in — claiming that admin role without ever
// receiving or opening the invite email.
//
// Fix: this page now requires a valid, unused invitation TOKEN in
// the URL (?token=<admin_invitations.id> — that id is already a
// random UUID, so it doubles as a secret token with no schema
// change needed). The email field is derived entirely from the
// token and is never freely editable — there is no path to sign up
// with an email you weren't actually invited with. Without a valid
// token, this page refuses to show a signup form at all.
//
// Still creates ONLY a Supabase auth account — deliberately does NOT
// create a vendors row. The actual role is applied at first login
// (see admin-login/page.tsx) against admin_invitations.
//
// Uses its own isolated Supabase client (adminSignupSupabase) so
// that signUp()'s automatic sign-in can never hijack a different
// admin's active session elsewhere in /admin.
// ===============================================================

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminSignupSupabase } from "@/lib/adminSignupSupabase";
import styles from "./admin-signup.module.css";

type InvitationLookup = { email: string; role: string; valid: boolean };

export default function AdminSignupPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [invitation, setInvitation] = useState<InvitationLookup | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setChecking(false);
        return;
      }
      const { data, error: rpcError } = await adminSignupSupabase
        .rpc("get_invitation_by_token", { p_token: token })
        .maybeSingle()
        .returns<InvitationLookup | null>();

      if (rpcError || !data) {
        setInvitation(null);
      } else {
        setInvitation(data);
      }
      setChecking(false);
    }
    checkToken();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !invitation) return;

    setError("");

    if (!password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    const { error: signUpError } = await adminSignupSupabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin-login`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    // Sign out immediately: signUp() auto-authenticates the browser
    // as the new account. This page's isolated storage means that
    // can never hijack a different admin's active session elsewhere
    // in /admin — but there's no reason to leave this new, roleless
    // session sitting around either.
    await adminSignupSupabase.auth.signOut();

    setSuccess(true);
  }

  const tokenInvalid = !checking && (!token || !invitation || !invitation.valid);

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Admin Staff Signup</h1>

        {checking && <p className={styles.sectionNote}>Checking your invitation…</p>}

        {tokenInvalid && (
          <>
            <p className={styles.sectionNote}>
              This page requires a valid invitation link from a super admin. Your link may have expired, already
              been used, or been mistyped — please ask your super admin to send a new invite.
            </p>
            <p className={styles.authLink}>
              Already have an account? <a href="/admin-login">Log in</a>
            </p>
          </>
        )}

        {!checking && invitation && invitation.valid && !success && (
          <>
            <p className={styles.sectionNote}>
              You&apos;ve been invited as a <strong>{invitation.role.replace("_", " ")}</strong>. Creating an account
              here does not grant access on its own — your role is applied automatically the first time you log in.
            </p>

            <form className={styles.authForm} onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email">Email</label>
                <input type="email" id="email" readOnly value={invitation.email} />
                <p className={styles.sectionNote} style={{ margin: "4px 0 0", fontStyle: "normal" }}>
                  This account will be created for the email address you were invited with.
                </p>
              </div>

              <div>
                <label htmlFor="password">Password</label>
                <div className={styles.passwordWrap}>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    placeholder="Create a password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    👁
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className={styles.passwordWrap}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    placeholder="Repeat your password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    👁
                  </button>
                </div>
              </div>

              <button type="submit" className={styles.authBtn} disabled={submitting}>
                {submitting ? "Creating account..." : "Create account"}
              </button>
            </form>
          </>
        )}

        {error && <p className={styles.authError}>{error}</p>}

        {success && (
          <p className={styles.authSuccess}>
            Account created. You can log in now — your role will be applied automatically.
          </p>
        )}

        {!tokenInvalid && (
          <p className={styles.authLink}>
            Already have an account? <a href="/admin-login">Log in</a>
          </p>
        )}
      </div>
    </div>
  );
}
