document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  const errorEl = document.getElementById("signupError");

  if (!form) return;

  const supabase = window.supabaseClient;

  const submitBtn = document.getElementById("signupBtn");
  let isSubmitting = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    isSubmitting = true;

    errorEl.classList.add("hidden");

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account...";
    }

    const businessName = document.getElementById("businessName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!businessName || !email || !password || !confirmPassword) {
      showError("All fields are required.");
      resetSubmitState();
      return;
    }

    if (password !== confirmPassword) {
      showError("Passwords do not match.");
      resetSubmitState();
      return;
    }

    // 🔐 Create auth user (email confirmation ON)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: businessName
        },
        emailRedirectTo: "https://spotlightdirectories.com/login.html"
      }
    });

    if (error) {
      showError(error.message);
      resetSubmitState();
      return;
    }

    // ===============================
    // CREATE VENDOR ROW IMMEDIATELY
    // ===============================

    const selectedPlan = localStorage.getItem("selectedPlan");
    const billingType = localStorage.getItem("billingType") || "monthly";

    if (!selectedPlan) {
      showError("Please select a plan first.");
      resetSubmitState();
      return;
    }

    const { error: vendorError } = await supabase
      .from("vendors")
      .insert({
        auth_user_id: data.user.id,
        name: businessName,
        email: email,
        plan_tier: selectedPlan,
        billing_cycle: billingType,
        subscription_status: selectedPlan === "free" ? "active" : null,
        is_premium: selectedPlan !== "free"
      });

    if (vendorError) {
      console.error("Vendor creation error:", vendorError);
      showError(vendorError.message);
      resetSubmitState();
      return;
    }

    // 🔥 CLEAR PLAN INTENT AFTER SUCCESS
    localStorage.removeItem("selectedPlan");
    localStorage.removeItem("billingType");

    // Store business name and email for onboarding
    localStorage.setItem("pendingBusinessName", businessName);
    localStorage.setItem("pendingEmail", email);

    // ✅ Success message
    errorEl.textContent =
      "Account created. Please check your email to verify before logging in.";
    errorEl.classList.remove("hidden");
    errorEl.classList.remove("form-error");
    errorEl.classList.add("form-success");

    submitBtn.textContent = "Verification email sent";
    submitBtn.disabled = true;
  });

  // 👁️ Password toggle
  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  function resetSubmitState() {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
    }
  }
});