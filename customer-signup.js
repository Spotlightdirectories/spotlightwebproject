document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("customerSignupForm");
  const errorEl = document.getElementById("authError");
  const confirmationEl = document.getElementById("signupConfirmation");

  if (!form) return;

  const supabase = window.supabaseClient;
  const submitBtn = document.getElementById("signupBtn");
  let isSubmitting = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!fullName || !email || !password) {
      showError("All fields are required.");
      return;
    }

    if (isSubmitting) return;
    isSubmitting = true;

    if (errorEl) errorEl.style.display = "none";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account...";
    }

    // Create auth user (email confirmation ON — same as vendor signup)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: "https://spotlightdirectories.com/customer-login"
      }
    });

    if (error) {

      // Someone with this email already has a Spotlight identity —
      // most likely an existing vendor account. Rather than a dead-
      // end error, offer the real path forward: log in with that
      // existing password, and we'll attach a customer profile to
      // that same identity (same email can be both, per Cyril's
      // decision). Carrying name+email through so it isn't lost.
      const alreadyRegistered = /already registered/i.test(error.message || "");

      if (alreadyRegistered) {
        showError(
          `An account with this email already exists on Spotlight. `
        );
        const loginLink = document.createElement("a");
        loginLink.href = `customer-login.html?setup=1&email=${encodeURIComponent(email)}&name=${encodeURIComponent(fullName)}`;
        loginLink.textContent = "Log in to set up your customer profile";
        loginLink.style.display = "block";
        loginLink.style.marginTop = "6px";
        loginLink.style.fontWeight = "700";
        errorEl.appendChild(loginLink);
      } else {
        showError(error.message);
      }

      resetSubmitState();
      return;
    }

    // Create customer row immediately, same proven pattern as vendor
    // signup (signup.js) — signUp()'s session is usable right away
    // for this insert, even before the confirmation link is clicked.
    const { error: customerError } = await supabase
      .from("customers")
      .insert([
        {
          auth_user_id: data.user.id,
          name: fullName,
          email: email
        }
      ]);

    if (customerError) {
      console.error("Customer creation error:", customerError);
      showError(customerError.message);
      resetSubmitState();
      return;
    }

    // Send welcome email — same fetch pattern used elsewhere in this
    // codebase, non-fatal if it fails.
    try {
      await fetch(
        "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": window.SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            to: email,
            subject: "Welcome to Spotlight",
            html: `<p>Hi ${fullName},</p><p>Your Spotlight customer account is ready. Save your favorite vendors and manage your reviews any time you're logged in.</p>`
          })
        }
      );
    } catch (err) {
      console.error("Welcome email failed:", err);
    }

    form.classList.add("hidden");
    if (confirmationEl) confirmationEl.classList.remove("hidden");
  });

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  function resetSubmitState() {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
  }
});
