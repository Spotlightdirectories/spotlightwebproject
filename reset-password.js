document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const form = document.getElementById("resetForm");
  const msg = document.getElementById("resetMsg");

  // 👁 Password toggle
  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  // ---------------------------------
  // 1️⃣ Extract recovery code
  // ---------------------------------
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.replace("#", ""));
  const access_token = params.get("access_token");
  const type = params.get("type");

  if (!access_token || type !== "recovery") {
    msg.textContent = "Invalid or expired reset link.";
    msg.classList.remove("hidden");
    form.style.display = "none";
    return;
  }

  // ---------------------------------
  // 2️⃣ Exchange recovery code for session
  // ---------------------------------
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(access_token);

  if (exchangeError) {
    msg.textContent = "Invalid or expired reset link.";
    msg.classList.remove("hidden");
    form.style.display = "none";
    return;
  }

  // ---------------------------------
  // 3️⃣ Handle password update
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

    const { error: updateError } =
      await supabase.auth.updateUser({ password });

    if (updateError) {
      msg.textContent = updateError.message;
      return;
    }

    msg.textContent = "Password updated successfully. Redirecting to login...";

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
  });
});
