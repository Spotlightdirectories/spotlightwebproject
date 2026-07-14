document.addEventListener("DOMContentLoaded", () => {
  const supabase = window.supabaseClient;
  const form = document.getElementById("forgotForm");
  const msg = document.getElementById("statusMsg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    msg.textContent = "Sending reset link...";

    const email = document.getElementById("email").value.trim();

    // This page is shared between vendors (login.html links to plain
    // "forgot-password") and partners (partner-program.html links to
    // "forgot-password?type=partner"). Previously this always wrote
    // "partner" regardless of which page linked here, so every vendor
    // password reset incorrectly redirected to /partner-program
    // afterward instead of /login. Now it reads the actual URL param
    // that each page already sends.
    const params = new URLSearchParams(window.location.search);
    const resetType = params.get("type") === "partner" ? "partner" : "vendor";
    localStorage.setItem("reset_type", resetType);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `https://spotlightdirectories.com/reset-password.html?type=${resetType}`
  });


    if (error) {
      msg.textContent = error.message;
      return;
    }

    msg.textContent = "Check your email for the reset link.";
  });
});
