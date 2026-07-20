document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminLoginForm");
  const errorEl = document.getElementById("loginError");
  const submitBtn = document.getElementById("adminLoginBtn");

  if (!form) return;

   let isSubmitting = false;
  // -------------------------
  // PASSWORD TOGGLE (UNCHANGED)
  // -------------------------
  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  // -------------------------
  // ADMIN LOGIN
  // -------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    isSubmitting = true;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in...";
    }

    errorEl.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    // 1. AUTHENTICATE WITH SUPABASE AUTH
    const { data, error } =
      await window.supabaseClient.auth.signInWithPassword({
        email,
        password
      });

  const { data: sessionData } = await window.supabaseClient.auth.getSession();

    if (error) {
      errorEl.textContent = error.message;
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Login";
      }
      return;
   }

   // Ensure session is fully established before querying
   await new Promise(resolve => setTimeout(resolve, 800));

    // 2. VERIFY ADMIN ROLE
    const {
    data: { session }
    } = await window.supabaseClient.auth.getSession();

   const { data: roleRow, error: roleError } =
     await window.supabaseClient
    .from("user_roles")
    .select("user_id, role")
    .eq("user_id", session.user.id);

// If no REAL admin role exists yet (either no row at all, or the
// default 'vendor' row that Supabase's on_auth_user_created trigger
// gives every new signup), check for a pending admin invitation
// matching this email. Lets newly-invited staff self-claim their
// role on first login, instead of a super_admin needing raw SQL.
// Existing admins with a real role already on file skip this
// entirely — their login behaves exactly as before.
let finalRoleRow = roleRow;

const ADMIN_ROLE_VALUES = ["super_admin", "admin", "finance_admin", "verification_admin"];
const currentRoleValue = roleRow && roleRow.length > 0 ? roleRow[0].role : null;

if (!roleError && !ADMIN_ROLE_VALUES.includes(currentRoleValue)) {

  const { data: invitation } = await window.supabaseClient
    .from("admin_invitations")
    .select("id, role")
    .eq("email", session.user.email)
    .eq("used", false)
    .maybeSingle();

  if (invitation) {

    // Upsert, not insert: a 'vendor' row from the signup trigger
    // already exists for this user_id, so this is an update.
    const { error: claimError } = await window.supabaseClient
      .from("user_roles")
      .upsert({
        user_id: session.user.id,
        role: invitation.role
      }, { onConflict: "user_id" });

    if (!claimError) {

      await window.supabaseClient
        .from("admin_invitations")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("id", invitation.id);

      // Log this self-claim event in the permanent audit trail.
      // Allowed by the self_claim_insert_audit_log policy, which only
      // permits a person to log this ONE action type about themselves.
      await window.supabaseClient.from("admin_audit_log").insert({
        actor_id: session.user.id,
        actor_email: session.user.email,
        action: "claimed_invitation",
        target_email: session.user.email,
        role: invitation.role
      });

      finalRoleRow = [{ user_id: session.user.id, role: invitation.role }];

    }

  }

}

   if (
  roleError ||
  !finalRoleRow ||
  finalRoleRow.length === 0
) {
  await window.supabaseClient.auth.signOut();
  errorEl.textContent = "You are not authorized as an admin";
  isSubmitting = false;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Login";
  }
  return;
}

const role = finalRoleRow[0].role;

const VALID_ADMIN_ROLES = ["super_admin","admin","finance_admin","verification_admin"];
if (!VALID_ADMIN_ROLES.includes(role)) {
  await window.supabaseClient.auth.signOut();
  errorEl.textContent = "You are not authorized as an admin";
  isSubmitting = false;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Login";
  }
  return;
}

    // 3. REDIRECT TO ADMIN DASHBOARD
    // 3. STORE ADMIN SESSION
localStorage.setItem("admin_session", JSON.stringify({
  user_id: data.user.id,
  email: data.user.email,
  role: role
}));

// 4. REDIRECT
window.location.href = "admin-payments";
  });
});
