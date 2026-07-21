// ===============================================================
// admin-signup.js
//
// Creates ONLY a Supabase auth account — deliberately does NOT
// create a vendors row. This is the entire point of this page:
// admin staff should never need a throwaway vendor profile just to
// get an admin role.
//
// The actual role is applied later, at first login (see
// admin-login.js), once we have a confirmed session to check against
// admin_invitations. This account has zero admin access on its own —
// creating it here does nothing unless a super_admin has already
// created a matching invitation.
// ===============================================================

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminSignupForm");
  const errorEl = document.getElementById("signupError");
  const successEl = document.getElementById("signupSuccess");
  const submitBtn = document.getElementById("signupBtn");

  if (!form) return;

  const supabase = window.supabaseClient;

  let isSubmitting = false;

  // Password visibility toggle (same pattern as admin-login.js)
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    errorEl.textContent = "";
    successEl.classList.add("hidden");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!email || !password || !confirmPassword) {
      errorEl.textContent = "All fields are required.";
      return;
    }

    if (password !== confirmPassword) {
      errorEl.textContent = "Passwords do not match.";
      return;
    }

    if (password.length < 8) {
      errorEl.textContent = "Password must be at least 8 characters.";
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://spotlightdirectories.com/admin/admin-login",
      },
    });

    if (error) {
      errorEl.textContent = error.message;
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
      return;
    }

    // Whether or not an invitation exists for this email, account
    // creation itself always succeeds — the invitation is only
    // checked (and the role applied) at first login. This keeps the
    // message honest without confirming or denying who's been
    // invited to a stranger typing in random emails.
    //
    // Sign out immediately: signUp() auto-authenticates the browser
    // as the new account. This page uses its own isolated storage
    // (see admin-signup-supabase-client.js) so that can never hijack
    // a different admin's active session elsewhere in /admin/ — but
    // there's no reason to leave this new, roleless session sitting
    // around either. The person logs in properly at admin-login.html.
    await supabase.auth.signOut();

    form.classList.add("hidden");
    successEl.textContent =
      "Account created. You can log in now — your role will be applied automatically if you were invited.";
    successEl.classList.remove("hidden");
  });
});
