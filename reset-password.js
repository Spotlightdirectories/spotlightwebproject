document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);

  const userType = localStorage.getItem("reset_type");

  const supabase = window.supabaseClient;

  // Password toggle
document.querySelectorAll(".toggle-password").forEach(btn => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
  });
});

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

  // Let Supabase auto-detect recovery session
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    msg.textContent = "Invalid or expired reset link.";
    msg.classList.remove("hidden");
    form.style.display = "none";
    return;
  }

  // Handle password update
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

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      msg.textContent = error.message;
      return;
    }

    // SUCCESS UI
      form.style.display = "none";

      msg.textContent = "Password reset successful! Redirecting to login...";
      msg.classList.remove("hidden");
      msg.style.color = "#16a34a"; // clean green
      msg.style.fontWeight = "600";
      msg.style.marginTop = "15px";

      setTimeout(() => {
      if (userType === "partner") {
       localStorage.removeItem("reset_type");
       window.location.href = "/partner-program";
     } else {
       window.location.href = "/login";
     }
    }, 2500);

  });
});
