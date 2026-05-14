document.addEventListener("DOMContentLoaded", () => {

  const supabase = window.supabaseClient;
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginBtn");

  if (!form) return;

  let isSubmitting = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    isSubmitting = true;

    errorEl.style.display = "none";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in...";
    }

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    // ===============================
    // AUTHENTICATE
    // ===============================
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      errorEl.textContent = "Invalid email or password.";
      errorEl.style.display = "block";
      resetSubmitState();
      return;
    }

    const user = data.user;

    // ===============================
    // FETCH VENDOR (DATABASE IS TRUTH)
    // ===============================
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (vendorError) {
      console.error(vendorError);
      alert("Error fetching vendor record.");
      resetSubmitState();
      return;
    }

    // =====================================================
    // IF NO VENDOR ROW → something is wrong
    // =====================================================
    if (!vendor) {
      window.location.replace("getlisted");
      return;
    }

    // ===============================
// BLOCK CLOSED ACCOUNT
// ===============================
if (vendor.account_status === "closed") {
  errorEl.textContent = "Your account has been closed. Please contact support.";
  errorEl.style.display = "block";
  await supabase.auth.signOut();
  resetSubmitState();
  return;
}

    // =====================================================
    // FREE PLAN
    // =====================================================
if (vendor.plan_tier === "free") {

  window.location.replace(
    "vendordashboard"
  );

  return;
}

    // =====================================================
    // PAID PLAN
    // =====================================================
    if (vendor.subscription_status === "pending") {
      window.location.replace("payment-status");
      return;
    }

    if (vendor.subscription_status === "failed") {
      window.location.replace("payment-failed");
      return;
    }

if (
  vendor.subscription_status ===
  "active"
) {

  window.location.replace(
    "vendordashboard"
  );

  return;
}

/* ===============================
UNPAID / FAILED / ABANDONED
PAID FLOW FALLBACK
=============================== */

window.location.replace(
  "payment"
);

function resetSubmitState() {
  isSubmitting = false;

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
}

});

// Password toggle
document.querySelectorAll(".toggle-password").forEach(btn => {

  btn.addEventListener("click", (e) => {

    e.preventDefault();

    const input = document.getElementById(
      btn.dataset.target
    );

    if (!input) return;

    input.type =
      input.type === "password"
        ? "text"
        : "password";

  });

});

});

