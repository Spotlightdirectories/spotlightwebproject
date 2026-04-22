document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  const errorEl = document.getElementById("signupError");

  if (!form) return;

  const supabase = window.supabaseClient;

  const submitBtn = document.getElementById("signupBtn");
  let isSubmitting = false;

  form.addEventListener("submit", async (e) => {
    console.log("FORM SUBMIT TRIGGERED");

    e.preventDefault();

    const businessName = document.getElementById("businessName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    const agree = document.getElementById("agreeTerms");

    if (agree && !agree.checked) {
     showError("You must agree to the Terms, Privacy Policy, and Disclaimer.");
     resetSubmitState();
     return;
   }

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

        // -----------------------------
// DEBUG REF READ (SUBMIT LEVEL)
// -----------------------------
    if (isSubmitting) return;
    isSubmitting = true;

    errorEl.classList.add("hidden");

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account...";
    }

    // 🔐 Create auth user (email confirmation ON)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: businessName
        },
        emailRedirectTo: "https://spotlightdirectories.com/login"
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

    // -----------------------------
// RESOLVE REFERRAL CODE → PARTNER ID
// -----------------------------
let partnerId = null;

const storedReferral = localStorage.getItem("referral_code")?.trim().toUpperCase();
console.log("RAW storedReferral:", storedReferral);
console.log("TYPE:", typeof storedReferral);

if (storedReferral) {
  const { data: partners, error } = await supabase
  .from("partners")
  .select("id, referral_code");

console.log("PARTNERS DATA:", partners);
console.log("PARTNERS ERROR:", error);

  if (partners && partners.length > 0) {
    const match = partners.find(
      p => p.referral_code?.trim().toUpperCase() === storedReferral
    );

    if (match) {
      partnerId = match.id;
    }
  }
}

console.log("RESOLVED partnerId:", partnerId);

    if (!selectedPlan) {
      showError("Please select a plan first.");
      resetSubmitState();
      return;
    }
   console.log("BEFORE VENDOR INSERT");
   const insertResponse = await supabase
  .from("vendors")
  .insert([
    {
    auth_user_id: data.user.id,
    name: businessName,
    email: email,
    referred_by_partner_id: partnerId || null,
    plan_tier: selectedPlan,
    billing_cycle: billingType,
    subscription_status: null,
    is_premium: selectedPlan !== "free",

    // ✅ CONSENT RECORD
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString()
  }
  ]);
const { data: vendorData, error: vendorError } = insertResponse;
console.log("AFTER VENDOR INSERT", vendorError);

    if (vendorError) {
      console.error("Vendor creation error:", vendorError);
      showError(vendorError.message);
      resetSubmitState();
      return;
    }

    // 🔥 CLEAR PLAN INTENT AFTER SUCCESS
    localStorage.removeItem("selectedPlan");
    localStorage.removeItem("billingType");
    localStorage.removeItem("referral_code");

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