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

      // ===============================
// CHECK PHONE VERIFICATION
// ===============================
   const { data: phoneCheck } = await supabase
      .from("phone_verifications")
      .select("verified")
      .eq("auth_user_id", user.id)
      .eq("verified", true)
      .maybeSingle();
      

   if (!phoneCheck) {
      window.location.replace("verify-phone.html");
      return;
    }

    

    // 🔍 SINGLE SOURCE OF TRUTH — vendors table ONLY
    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select("slug, plan_tier, subscription_status")
      .eq("auth_user_id", user.id)
      .maybeSingle();


// ===============================
// ROUTING (LOCKED — DB IS SOURCE)
// ===============================

// 1️⃣ No vendor yet → route by plan intent (ONE TIME ONLY)
if (!vendor) {
  const selectedPlan = localStorage.getItem("selectedPlan");

  // Safety fallback
  if (!selectedPlan) {
    window.location.replace("getlisted.html");
    return;
  }

  // FREE → onboarding
  if (selectedPlan === "free") {
    window.location.replace("onboarding.html");
    return;
  }

  // PREMIUM → payment
  window.location.replace("payment.html");
  return;
}

// 🔥 PLAN INTENT ENDS HERE
localStorage.removeItem("selectedPlan");
localStorage.removeItem("billingType");

// 2️⃣ FREE vendor → private profile
if (vendor.plan_tier === "free") {
  window.location.replace(
    `vendor-profile.html?slug=${vendor.slug}`
  );
  return;
}

// 3️⃣ PREMIUM unpaid → payment
if (vendor.subscription_status !== "active") {
  window.location.replace("payment.html");
  return;
}

// 4️⃣ PREMIUM paid → dashboard
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
