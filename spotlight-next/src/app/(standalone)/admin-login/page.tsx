"use client";

// ===============================================================
// src/app/(standalone)/admin-login/page.tsx
//
// Faithful port of admin-login.html + admin-login.js.
//
// Auth flow (unchanged from production):
//  1. Sign in via Supabase Auth (isolated admin client — see
//     src/lib/adminSupabase.ts).
//  2. Look up this user's row in user_roles.
//  3. If they don't have a real admin role yet (no row, or the
//     default 'vendor' row every signup gets), check for a pending
//     admin_invitations row matching their email and self-claim it —
//     this lets newly-invited staff get their role on first login
//     instead of a super_admin needing to run raw SQL.
//  4. Reject (and sign out) anyone who still has no valid admin role.
//  5. Store { user_id, email, role } in localStorage as admin_session
//     — this is what the dashboard shell's auth guard reads on every
//     page load, exactly like production.
// ===============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminSupabase, setAdminSession, ADMIN_ROLES, type AdminRole } from "@/lib/adminSupabase";
import styles from "./admin-login.module.css";

type RoleRow = { user_id: string; role: string };
type InvitationRow = { id: string; role: string };

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    // 1. AUTHENTICATE WITH SUPABASE AUTH
    const { data, error: signInError } = await adminSupabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message || "Login failed.");
      setSubmitting(false);
      return;
    }

    // Ensure session is fully established before querying (matches
    // production's admin-login.js — supabase-js needs a beat before
    // the new session is reliably attached to subsequent requests).
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 2. VERIFY ADMIN ROLE
    const {
      data: { session },
    } = await adminSupabase.auth.getSession();

    if (!session) {
      setError("You are not authorized as an admin");
      setSubmitting(false);
      return;
    }

    const { data: roleRow, error: roleError } = await adminSupabase
      .from("user_roles")
      .select("user_id, role")
      .eq("user_id", session.user.id)
      .returns<RoleRow[]>();

    let finalRoleRow = roleRow;

    const currentRoleValue = roleRow && roleRow.length > 0 ? roleRow[0].role : null;

    if (!roleError && !(ADMIN_ROLES as string[]).includes(currentRoleValue || "")) {
      const { data: invitation } = await adminSupabase
        .from("admin_invitations")
        .select("id, role")
        .eq("email", session.user.email)
        .eq("used", false)
        .maybeSingle()
        .returns<InvitationRow | null>();

      if (invitation) {
        // Upsert, not insert: a 'vendor' row from the signup trigger
        // already exists for this user_id, so this is an update.
        const { error: claimError } = await adminSupabase
          .from("user_roles")
          .upsert({ user_id: session.user.id, role: invitation.role }, { onConflict: "user_id" });

        if (!claimError) {
          await adminSupabase
            .from("admin_invitations")
            .update({ used: true, used_at: new Date().toISOString() })
            .eq("id", invitation.id);

          // Log this self-claim event in the permanent audit trail.
          // Allowed by the self_claim_insert_audit_log policy, which
          // only permits a person to log this ONE action type about
          // themselves.
          await adminSupabase.from("admin_audit_log").insert({
            actor_id: session.user.id,
            actor_email: session.user.email,
            action: "claimed_invitation",
            target_email: session.user.email,
            role: invitation.role,
          });

          finalRoleRow = [{ user_id: session.user.id, role: invitation.role }];
        }
      }
    }

    if (roleError || !finalRoleRow || finalRoleRow.length === 0) {
      await adminSupabase.auth.signOut();
      setError("You are not authorized as an admin");
      setSubmitting(false);
      return;
    }

    const role = finalRoleRow[0].role;

    if (!(ADMIN_ROLES as string[]).includes(role)) {
      await adminSupabase.auth.signOut();
      setError("You are not authorized as an admin");
      setSubmitting(false);
      return;
    }

    // 3. STORE ADMIN SESSION
    setAdminSession({
      user_id: data.user.id,
      email: data.user.email || "",
      role: role as AdminRole,
    });

    // 4. REDIRECT
    router.replace("/admin");
  }

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Admin Login</h1>

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="admin@spotlight.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Enter your password"
                required
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

          <button type="submit" className={styles.authBtn} disabled={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>

        {error && <p className={styles.authError}>{error}</p>}
      </div>
    </div>
  );
}
