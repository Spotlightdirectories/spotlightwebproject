document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("customerLoginForm");
  const errorEl = document.getElementById("authError");

  if (!form) return;

  const supabase = window.supabaseClient;
  const submitBtn = document.getElementById("loginBtn");
  let isSubmitting = false;

  // -------------------------------
  // SETUP PARAMS — present only when arriving from the "this email
  // already exists" path on customer-signup.html. Pre-fills email and,
  // after a successful login, creates the missing customer profile
  // for that already-authenticated identity using the name they
  // originally typed. This ONLY happens when these params are present
  // — a plain login attempt with no customer profile still correctly
  // rejects, rather than silently turning every mistaken vendor login
  // attempt here into a customer signup.
  // -------------------------------
  const params = new URLSearchParams(window.location.search);
  const setupMode = params.get("setup") === "1";
  const setupEmail = params.get("email") || "";
  const setupName = params.get("name") || "";

  if (setupEmail) {
    const emailField = document.getElementById("email");
    if (emailField) emailField.value = setupEmail;
  }

  if (setupMode) {
    const header = document.querySelector(".auth-header p");
    if (header) {
      header.textContent = "Log in below and we'll set up your customer profile on this account.";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (isSubmitting) return;
    isSubmitting = true;

    if (errorEl) errorEl.style.display = "none";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in...";
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showError(error.message);
      resetSubmitState();
      return;
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (!customer) {

      if (setupMode) {
        // Explicitly arrived here to attach a customer profile to
        // this already-authenticated identity — create it now.
        const { error: createError } = await supabase
          .from("customers")
          .insert([
            {
              auth_user_id: data.user.id,
              name: setupName || null,
              email: email
            }
          ]);

        if (createError) {
          console.error("Customer profile setup error:", createError);
          showError("Could not set up your customer profile. Please try again.");
          resetSubmitState();
          return;
        }

        window.location.href = "customer-profile.html";
        return;
      }

      // No customer profile, and not in setup mode — a genuine
      // vendor-only account trying the wrong login, same as before.
      showError("No customer account found for this email. If you signed up as a vendor, please use the vendor login instead.");
      await supabase.auth.signOut();
      resetSubmitState();
      return;
    }

    window.location.href = "customer-profile.html";
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
      submitBtn.textContent = "Log In";
    }
  }
});
