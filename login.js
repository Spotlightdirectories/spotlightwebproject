document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginBtn");

  let isSubmitting = false;
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    errorEl.classList.add("hidden");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in...";
    }

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
       errorEl.textContent = "Invalid email or password.";
       errorEl.style.display = "block";

       document.getElementById("email").classList.add("input-error");
       document.getElementById("password").classList.add("input-error");

       resetSubmitState();
       return;
    }


    const user = data.user;

    console.log("Email confirmed at:", user.email_confirmed_at);

    // ===============================
    // EMAIL VERIFICATION CHECK
    // ===============================
    if (!user.email_confirmed_at) {
      errorEl.textContent = "Please verify your email before logging in.";
      errorEl.style.display = "block";

      await supabase.auth.signOut();
      resetSubmitState();
      return;
    }

    errorEl.style.display = "none";
    document.getElementById("email").classList.remove("input-error");
    document.getElementById("password").classList.remove("input-error");

    // ===============================
// ENSURE USER ROLE EXISTS (ONCE)
// ===============================
    await supabase
      .from("user_roles")
      .insert({
       user_id: user.id,
       role: "vendor"
    })
      .select()
      .maybeSingle();

    // 🔍 SINGLE SOURCE OF TRUTH — vendors table ONLY
    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select("slug, plan_tier, subscription_status")
      .eq("auth_user_id", user.id)
      .maybeSingle();


    // ===============================
// ROUTING (DATABASE IS TRUTH)
// ===============================

// If vendor row does not exist → go to onboarding
if (!vendor) {

  const selectedPlan = localStorage.getItem("selectedPlan");

  // FREE plan → onboarding
  if (selectedPlan === "free") {
    window.location.replace("onboarding.html");
    return;
  }

  // PAID plan → create partial row then go to payment
  if (selectedPlan && selectedPlan !== "free") {

    const pendingName = localStorage.getItem("pendingBusinessName");
    const pendingEmail = localStorage.getItem("pendingEmail");

    const { error: insertError } = await supabase
     .from("vendors")
     .insert({
       auth_user_id: user.id,
       name: pendingName,
       email: pendingEmail,
       plan_tier: selectedPlan,
       subscription_status: "pending"
     });

   if (insertError) {
     console.error("Partial vendor creation failed:", insertError);
     alert("Unable to start paid plan. Please try again.");
     return;
   }
    
   window.location.replace("payment.html");
    return;
  }

  // Fallback
  window.location.replace("getlisted.html");
  return;
}

// FREE vendor
if (vendor.plan_tier === "free") {
  window.location.replace(`vendor-profile.html?slug=${vendor.slug}`);
  return;
}

// PREMIUM but not paid
if (vendor.plan_tier !== "free" && vendor.subscription_status !== "active") {
  window.location.replace("payment.html");
  return;
}

// PREMIUM paid but not onboarded
if (vendor.plan_tier !== "free" && vendor.subscription_status === "active" && !vendor.slug) {
  window.location.replace("onboarding.html");
  return;
}

// PREMIUM fully active
window.location.replace("dashboard.html");

});

  // 👁️ Password toggle (LOGIN PAGE)
document.querySelectorAll(".toggle-password").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
  });
});

    
});
