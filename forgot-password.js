document.addEventListener("DOMContentLoaded", () => {
  const supabase = window.supabaseClient;
  const form = document.getElementById("forgotForm");
  const msg = document.getElementById("statusMsg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    msg.textContent = "Sending reset link...";

    const email = document.getElementById("email").value.trim();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://127.0.0.1:5501/reset-password.html"
    });

    if (error) {
      msg.textContent = error.message;
      return;
    }

    msg.textContent = "Check your email for the reset link.";
  });
});
