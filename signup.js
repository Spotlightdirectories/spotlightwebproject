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


    const businessName =
      document.getElementById("businessName").value.trim();
    const email =
      document.getElementById("email").value.trim();
    const password =
      document.getElementById("password").value;
    const confirmPassword =
      document.getElementById("confirmPassword").value;

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
    const { error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      showError(error.message);
      resetSubmitState();
      return;
    }

    // 🔒 ENSURE PLAN INTENT EXISTS BEFORE PROCEEDING
    const selectedPlan = localStorage.getItem("selectedPlan");

    if (!selectedPlan) {
     showError("Please select a plan before creating an account.");
     resetSubmitState();
     return;
   }



 // Store business name for later onboarding
     localStorage.setItem("pendingBusinessName", businessName);

// ✅ Success feedback
     errorEl.textContent = "Account created successfully. Redirecting to login...";
     errorEl.classList.remove("hidden");
     errorEl.classList.remove("form-error");
     errorEl.classList.add("form-success");

// Redirect after short delay
     setTimeout(() => {
     window.location.href = "login.html";
   }, 1500);


    window.location.href = "login.html";

  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  // 👁️ Password eye toggle (WORKING)
  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); // 🔴 critical
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  function resetSubmitState() {
  isSubmitting = false;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create account";
  }
}

});

