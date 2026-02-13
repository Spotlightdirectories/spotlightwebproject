document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const form = document.getElementById("resetForm");
  const msg = document.getElementById("resetMsg");

  // ---------------------------------
  // 1️⃣ Handle Supabase recovery CODE
  // ---------------------------------
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) {
    msg.textContent = "Invalid or expired reset link.";
    msg.classList.remove("hidden");
    return;
  }

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    msg.textContent = "Invalid or expired reset link.";
    msg.classList.remove("hidden");
    return;
  }

  // ---------------------------------
  // 2️⃣ Update password
  // ---------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = document.getElementById("newPassword").value.trim();
    const confirm = document.getElementById("confirmPassword").value.trim();

    if (password.length < 8) {
      msg.textContent = "Password must be at least 8 characters.";
      msg.classList.remove("hidden");
      return;
    }

    if (password !== confirm) {
      msg.textContent = "Passwords do not match.";
      msg.classList.remove("hidden");
      return;
    }

    msg.textContent = "Updating password...";
    msg.classList.remove("hidden");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      msg.textContent = error.message;
      return;
    }

    msg.textContent = "Password updated successfully. Redirecting…";

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
  });
});
