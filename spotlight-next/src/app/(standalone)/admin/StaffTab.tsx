"use client";

// ===============================================================
// src/app/(standalone)/admin/StaffTab.tsx
//
// Admin Staff Management — super_admin only. Faithful port of the
// "ADMIN STAFF MANAGEMENT" block in admin-payments.js:
//  - Assign a role to a user by email (matches an existing vendor
//    account, upgrades an existing staff member directly, or creates
//    a pending invitation + sends an email if no account exists yet).
//  - Current staff list (get_admin_staff_list RPC) with Revoke.
//  - Pending invitations table with Revoke.
//  - Permanent staff activity history (admin_audit_log), searchable
//    and filterable, "see more" pagination (5 rows at a time).
//
// Revoke actions go through the same admin-revoke-role /
// admin-revoke-invitation Edge Functions production uses — those do
// real cleanup (removing a roleless account entirely if it has no
// vendor profile) that can't be done safely with a plain table
// delete from the browser.
// ===============================================================

import { useCallback, useEffect, useState } from "react";
import { adminSupabase, getAdminSession, type AdminRole } from "@/lib/adminSupabase";
import { EmailTemplates } from "@/lib/emailTemplates";

const SUPABASE_FUNCTIONS_URL = "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  finance_admin: "Finance Admin",
  verification_admin: "Verification Admin",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  invited: "Invited",
  assigned_role: "Assigned Role",
  claimed_invitation: "Claimed Invitation",
  revoked_role: "Revoked Role",
  revoked_invitation: "Revoked Invitation",
};

const AUDIT_PAGE_SIZE = 5;

type StaffRow = { user_id: string; email: string; role: string; created_at: string | null };
type InvitationRow = { id: string; email: string; role: string; created_at: string | null };
type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target_email: string | null;
  role: string | null;
  details: string | null;
  created_at: string | null;
};

// NOTE: intentionally NOT using .returns<StaffRow[]>() here — chaining
// .returns() directly on .rpc() for a set-returning function trips a
// known supabase-js typing quirk on this untyped client ("Cannot cast
// single object to array type"), since the client isn't constructed
// with a generic Database type. A plain assertion on the destructured
// data is the honest fix, scoped to this one RPC call.
async function fetchAdminStaffList(): Promise<{ data: StaffRow[] | null; error: unknown }> {
  const { data, error } = await adminSupabase.rpc("get_admin_staff_list");
  return { data: data as StaffRow[] | null, error };
}

// Shared email sender for every path in this tab (invitations AND the
// direct-grant notifications below). Returns whether it actually sent
// so callers can be honest with the super admin about what happened —
// previously a failure here was only logged to the console and the
// success alert fired regardless, which is why an earlier re-invite
// silently produced no email at all.
async function sendNotificationEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
    if (!res.ok) {
      console.error("send-email failed:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("send-email threw:", err);
    return false;
  }
}

async function logAdminAudit(action: string, targetEmail?: string | null, role?: string | null, details?: string | null) {
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user) return;
  await adminSupabase.from("admin_audit_log").insert({
    actor_id: user.id,
    actor_email: user.email,
    action,
    target_email: targetEmail || null,
    role: role || null,
    details: details || null,
  });
}

export default function StaffTab({ currentRole }: { currentRole: AdminRole }) {
  void currentRole; // this tab is only ever rendered for super_admin (enforced by the shell's role gate)

  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [staffError, setStaffError] = useState("");
  const [invitations, setInvitations] = useState<InvitationRow[] | null>(null);
  const [invitationsError, setInvitationsError] = useState("");
  const [auditEntries, setAuditEntries] = useState<AuditRow[] | null>(null);
  const [auditError, setAuditError] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");
  const [auditExpanded, setAuditExpanded] = useState(false);

  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState("");
  const [assigning, setAssigning] = useState(false);

  // NOTE (2026-07-31 audit fix): these three loaders previously
  // collapsed any query error into a plain empty array, so a failed
  // RPC/table read looked identical to "genuinely nothing here yet."
  // On the one tab that manages who has admin access at all, that's
  // the wrong place to hide a failure — now the real error message is
  // kept and shown, matching every other tab's loadError pattern.
  const loadStaff = useCallback(async () => {
    const { data, error } = await fetchAdminStaffList();
    if (error) {
      setStaffError(error instanceof Error ? error.message : "Failed to load admin staff.");
      setStaff([]);
      return;
    }
    setStaffError("");
    setStaff(data || []);
  }, []);

  const loadInvitations = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("admin_invitations")
      .select("id, email, role, created_at")
      .eq("used", false)
      .order("created_at", { ascending: false })
      .returns<InvitationRow[]>();
    if (error) {
      setInvitationsError(error.message);
      setInvitations([]);
      return;
    }
    setInvitationsError("");
    setInvitations(data || []);
  }, []);

  const loadAuditLog = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("admin_audit_log")
      .select("id, actor_email, action, target_email, role, details, created_at")
      .order("created_at", { ascending: false })
      .returns<AuditRow[]>();
    if (error) {
      setAuditError(error.message);
      setAuditEntries([]);
      return;
    }
    setAuditError("");
    setAuditEntries(data || []);
  }, []);

  useEffect(() => {
    loadStaff();
    loadInvitations();
    loadAuditLog();
  }, [loadStaff, loadInvitations, loadAuditLog]);

  async function handleAssign() {
    const email = assignEmail.trim();
    const role = assignRole;

    if (!email || !role) {
      alert("Please enter an email address and select a role.");
      return;
    }

    setAssigning(true);
    const session = getAdminSession();

    try {
      // Is this email an existing vendor account?
      const { data: vendorMatch } = await adminSupabase
        .from("vendors")
        .select("auth_user_id, email")
        .eq("email", email)
        .maybeSingle()
        .returns<{ auth_user_id: string; email: string } | null>();

      if (!vendorMatch?.auth_user_id) {
        // Not a vendor. Is this email already an active admin? If so,
        // update their role directly instead of creating an
        // invitation they'll never see (an existing admin's login
        // never re-checks invitations once they have a real role).
        const { data: existingStaff } = await fetchAdminStaffList();

        const matchedStaff = existingStaff?.find((s) => s.email?.toLowerCase() === email.toLowerCase());

        if (matchedStaff) {
          const { error: updateRoleError } = await adminSupabase
            .from("user_roles")
            .update({ role })
            .eq("user_id", matchedStaff.user_id);

          if (updateRoleError) {
            alert("Failed to update role: " + updateRoleError.message);
            setAssigning(false);
            return;
          }

          const roleChangeEmailOk = await sendNotificationEmail(
            email,
            "Your Spotlight Admin Role Has Changed",
            EmailTemplates.adminRoleChanged({ role, loginUrl: `${window.location.origin}/admin-login` })
          );

          await logAdminAudit("assigned_role", email, role, "Role changed directly (was already an active admin).");
          alert(
            `Role updated!\n\n${email} is now a ${ROLE_LABELS[role]}.\n\nThis takes effect immediately — no need to log out or back in.` +
              (roleChangeEmailOk ? "" : "\n\n(Note: the notification email could not be sent — you may want to let them know directly.)")
          );

          setAssignEmail("");
          setAssignRole("");
          setAssigning(false);
          loadStaff();
          loadAuditLog();
          return;
        }

        // No existing account found. Create an invitation — the
        // person signs up at /admin-signup and their role is applied
        // automatically the first time they log in.
        const { data: inviteRow, error: inviteError } = await adminSupabase
          .from("admin_invitations")
          .upsert(
            { email, role, invited_by: session?.user_id || null, used: false, used_at: null },
            { onConflict: "email" }
          )
          .select("id")
          .single()
          .returns<{ id: string }>();

        if (inviteError || !inviteRow) {
          alert("Failed to create invitation: " + (inviteError?.message || "Unknown error"));
          setAssigning(false);
          return;
        }

        // Link by TOKEN (the invitation's own id — already a random
        // UUID, so it doubles as a secret token), not by plain email.
        // /admin-signup requires this exact, unused token before it
        // will show a signup form at all — someone who merely knows
        // or guesses the invited email address has no path in.
        const signupLink = `${window.location.origin}/admin-signup?token=${inviteRow.id}`;
        const inviteEmailOk = await sendNotificationEmail(
          email,
          "You've Been Invited to Spotlight Admin",
          EmailTemplates.adminInvitation({ role, signupLink })
        );

        await logAdminAudit("invited", email, role);

        if (inviteEmailOk) {
          alert(`Invitation created and email sent!\n\n${email} has been invited as a ${ROLE_LABELS[role]} and notified by email with a signup link.\n\nTheir role is applied automatically the first time they log in.`);
        } else {
          alert(`Invitation created, but the email could not be sent.\n\nShare this signup link with ${email} directly:\n${signupLink}\n\nTheir role is applied automatically the first time they log in.`);
        }

        setAssignEmail("");
        setAssignRole("");
        setAssigning(false);
        loadInvitations();
        loadAuditLog();
        return;
      }

      // Existing vendor account — upsert their role directly.
      const targetUserId = vendorMatch.auth_user_id;
      const { error: upsertError } = await adminSupabase
        .from("user_roles")
        .upsert(
          { user_id: targetUserId, role, assigned_by: session?.user_id || null, created_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        alert("Failed to assign role: " + upsertError.message);
        setAssigning(false);
        return;
      }

      // Notify them — per Cyril's decision (2026-07-31): keep the
      // instant grant for existing vendor accounts, but never let it
      // happen silently. This is real admin/finance access; the
      // account holder needs to know it was granted even though
      // nothing further is required of them to activate it.
      const grantEmailOk = await sendNotificationEmail(
        email,
        "You've Been Given Admin Access on Spotlight",
        EmailTemplates.adminAccessGranted({ role, loginUrl: `${window.location.origin}/admin-login` })
      );

      await logAdminAudit("assigned_role", email, role);
      alert(
        `Role assigned successfully!\n\n${email} is now a ${ROLE_LABELS[role]}.\n\nThey can log in at the admin login page with their existing account credentials.` +
          (grantEmailOk ? " They've been emailed to let them know." : "\n\n(Note: the notification email could not be sent — you may want to let them know directly.)")
      );

      setAssignEmail("");
      setAssignRole("");
      setAssigning(false);
      loadStaff();
      loadAuditLog();
    } catch (err) {
      alert("Something went wrong assigning this role. Please try again.");
      console.error(err);
      setAssigning(false);
    }
  }

  async function handleRevokeRole(userId: string, email: string, role: string) {
    if (!confirm("Revoke this person's admin access? If they have no separate vendor profile, their account will be fully removed rather than just downgraded.")) return;

    const { data: { session } } = await adminSupabase.auth.getSession();
    if (!session) {
      alert("Your session has expired. Please log in again.");
      return;
    }

    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/admin-revoke-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ targetUserId: userId, email, role }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        alert("Failed to revoke role: " + (result.error || "Unknown error"));
        return;
      }

      alert(`Admin access revoked.\n\n${result.cleanupNote || ""}`);
      loadStaff();
      loadAuditLog();
    } catch (err) {
      alert("Failed to revoke role: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!confirm("Revoke this invitation? If the person created a signup account that was never activated, it will be fully removed too — re-inviting this email later will start completely fresh.")) return;

    const { data: { session } } = await adminSupabase.auth.getSession();
    if (!session) {
      alert("Your session has expired. Please log in again.");
      return;
    }

    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/admin-revoke-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ invitationId }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        alert("Failed to revoke invitation: " + (result.error || "Unknown error"));
        return;
      }

      alert(`Invitation revoked.\n\n${result.cleanupNote || ""}`);
      loadInvitations();
      loadAuditLog();
    } catch (err) {
      alert("Failed to revoke invitation: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  const filteredAudit = (auditEntries || []).filter((e) => {
    const term = auditSearch.toLowerCase().trim();
    const emailMatch =
      !term ||
      (e.target_email || "").toLowerCase().includes(term) ||
      (e.actor_email || "").toLowerCase().includes(term);
    const actionMatch = auditFilter === "all" || e.action === auditFilter;
    return emailMatch && actionMatch;
  });
  const visibleAudit = auditExpanded ? filteredAudit : filteredAudit.slice(0, AUDIT_PAGE_SIZE);
  const auditRemaining = filteredAudit.length - AUDIT_PAGE_SIZE;

  return (
    <div>
      <h1 className="adm-section-heading adm-super-admin-heading">
        <i className="fa-solid fa-shield-halved"></i> Admin Staff Management
      </h1>
      <p className="adm-section-note">Assign or revoke admin roles. Only you can see and use this section.</p>

      <div className="adm-assign-form">
        <input
          type="email"
          placeholder="Enter staff email address..."
          className="adm-history-search"
          value={assignEmail}
          onChange={(e) => setAssignEmail(e.target.value)}
        />
        <select
          className="adm-history-filter"
          value={assignRole}
          onChange={(e) => setAssignRole(e.target.value)}
        >
          <option value="">Select role...</option>
          <option value="admin">Admin (full operations)</option>
          <option value="finance_admin">Finance Admin (payments &amp; commissions)</option>
          <option value="verification_admin">Verification Admin (badge reviews only)</option>
        </select>
        <button className="adm-btn adm-approve-btn" disabled={assigning} onClick={handleAssign}>
          {assigning ? "Assigning..." : "Assign Role"}
        </button>
      </div>

      <h2 style={{ marginTop: 24, fontSize: 16 }}>Assigned Admin Staff</h2>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Email</th><th>Role</th><th>Assigned</th><th>Action</th></tr>
          </thead>
          <tbody>
            {staff === null && <tr><td colSpan={4} className="adm-empty-cell">Loading…</td></tr>}
            {staff !== null && staffError && (
              <tr><td colSpan={4} className="adm-empty-cell">{staffError}</td></tr>
            )}
            {staff !== null && !staffError && staff.length === 0 && (
              <tr><td colSpan={4} className="adm-empty-cell">No admin staff assigned yet.</td></tr>
            )}
            {staff?.map((r) => (
              <tr key={r.user_id}>
                <td>{r.email}</td>
                <td><span className={`adm-role-badge role-${r.role}`}>{ROLE_LABELS[r.role] || r.role}</span></td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                <td>
                  <button className="adm-btn adm-reject-btn" onClick={() => handleRevokeRole(r.user_id, r.email, r.role)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 24, fontSize: 16 }}>Pending Invitations</h2>
      <p className="adm-section-note">
        People invited but who haven&apos;t logged in yet to claim their role. Send them the /admin-signup link.
      </p>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Email</th><th>Role</th><th>Invited</th><th>Action</th></tr>
          </thead>
          <tbody>
            {invitations === null && <tr><td colSpan={4} className="adm-empty-cell">Loading…</td></tr>}
            {invitations !== null && invitationsError && (
              <tr><td colSpan={4} className="adm-empty-cell">{invitationsError}</td></tr>
            )}
            {invitations !== null && !invitationsError && invitations.length === 0 && (
              <tr><td colSpan={4} className="adm-empty-cell">No pending invitations.</td></tr>
            )}
            {invitations?.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.email}</td>
                <td><span className={`adm-role-badge role-${inv.role}`}>{ROLE_LABELS[inv.role] || inv.role}</span></td>
                <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}</td>
                <td>
                  <button className="adm-btn adm-reject-btn" onClick={() => handleRevokeInvitation(inv.id)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 24, fontSize: 16 }}>Staff Activity History</h2>
      <p className="adm-section-note">
        A permanent record of every invite, assignment, and revocation. This log is never altered or deleted, even
        after the underlying invitation or account is cleaned up.
      </p>
      <div className="adm-review-history-controls">
        <input
          type="text"
          placeholder="Search by email..."
          className="adm-history-search"
          value={auditSearch}
          onChange={(e) => setAuditSearch(e.target.value)}
        />
        <select className="adm-history-filter" value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="invited">Invited</option>
          <option value="assigned_role">Assigned Role</option>
          <option value="claimed_invitation">Claimed Invitation</option>
          <option value="revoked_role">Revoked Role</option>
          <option value="revoked_invitation">Revoked Invitation</option>
        </select>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>When</th><th>Action</th><th>Target Email</th><th>Role</th><th>By</th><th>Details</th></tr>
          </thead>
          <tbody>
            {auditEntries === null && <tr><td colSpan={6} className="adm-empty-cell">Loading…</td></tr>}
            {auditEntries !== null && auditError && (
              <tr><td colSpan={6} className="adm-empty-cell">{auditError}</td></tr>
            )}
            {auditEntries !== null && !auditError && auditEntries.length === 0 && (
              <tr><td colSpan={6} className="adm-empty-cell">No activity recorded yet.</td></tr>
            )}
            {auditEntries !== null && !auditError && auditEntries.length > 0 && filteredAudit.length === 0 && (
              <tr><td colSpan={6} className="adm-empty-cell">No results found.</td></tr>
            )}
            {visibleAudit.map((e) => (
              <tr key={e.id}>
                <td>{e.created_at ? new Date(e.created_at).toLocaleString() : "—"}</td>
                <td>{AUDIT_ACTION_LABELS[e.action] || e.action}</td>
                <td>{e.target_email || "—"}</td>
                <td>{e.role || "—"}</td>
                <td>{e.actor_email || "—"}</td>
                <td>{e.details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {auditRemaining > 0 && (
        <button
          className="adm-section-note"
          style={{ background: "none", border: "none", color: "#2563eb", textDecoration: "underline", cursor: "pointer", marginTop: 8, padding: 0 }}
          onClick={() => setAuditExpanded((v) => !v)}
        >
          {auditExpanded ? "See less" : `See more (${auditRemaining} older)`}
        </button>
      )}
    </div>
  );
}
