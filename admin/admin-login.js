document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminLoginForm");
  const errorEl = document.getElementById("loginError");

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

    errorEl.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    // 1. AUTHENTICATE WITH SUPABASE AUTH
    const { data, error } =
      await window.supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      console.log("Logged in user:", data.user);

  const { data: sessionData } = await window.supabaseClient.auth.getSession();
  console.log("Session user:", sessionData.session?.user);

    if (error) {
      errorEl.textContent = error.message;
      isSubmitting = false;
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

    console.log("Role row:", roleRow);

   if (
  roleError ||
  !roleRow ||
  roleRow.length === 0
) {
  await window.supabaseClient.auth.signOut();
  errorEl.textContent = "You are not authorized as an admin";
  isSubmitting = false;
  return;
}

const role = roleRow[0].role;

const VALID_ADMIN_ROLES = ["super_admin","admin","finance_admin","verification_admin"];
if (!VALID_ADMIN_ROLES.includes(role)) {
  await window.supabaseClient.auth.signOut();
  errorEl.textContent = "You are not authorized as an admin";
  isSubmitting = false;
  return;
}

    // 3. REDIRECT TO ADMIN DASHBOARD
    // 3. STORE ADMIN SESSION
localStorage.setItem("admin_session", JSON.stringify({
  user_id: data.user.id,
  email: data.user.email,
  role: roleRow[0].role
}));

// 4. REDIRECT
window.location.href = "admin-payments";
  });
});
