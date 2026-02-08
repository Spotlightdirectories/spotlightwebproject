document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminLoginForm");
  const errorEl = document.getElementById("loginError");

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
    errorEl.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    // 1. AUTHENTICATE WITH SUPABASE AUTH
    const { data, error } =
      await window.supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      errorEl.textContent = error.message;
      return;
    }

    // 2. VERIFY ADMIN ROLE
    const { data: roleRow, error: roleError } =
      await window.supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .in("role", ["admin", "super_admin"])
        .limit(1);

    if (roleError || !roleRow) {
      await window.supabaseClient.auth.signOut();
      errorEl.textContent = "You are not authorized as an admin";
      return;
    }

    // 3. REDIRECT TO ADMIN DASHBOARD
    window.location.href = "admin-payments.html";
  });
});
