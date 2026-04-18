document.addEventListener("DOMContentLoaded", () => {

// -----------------------------
// CAPTURE REFERRAL CODE (ENTRY PAGE)
// -----------------------------
const urlParams = new URLSearchParams(window.location.search);
const referralCode = urlParams.get("ref");

if (referralCode) {

  const supabase = window.supabaseClient;

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  // 🚫 If user already exists → ignore referral
  if (user) {

    const { data: existingVendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (existingVendor) {
      console.log("Existing vendor detected — referral ignored");
      return;
    }
  }

  // ✅ Only save for new users
  localStorage.setItem("referral_code", referralCode);
  console.log("REF SAVED FROM GETLISTED:", referralCode);
}

  const billingToggle = document.getElementById("billingToggle");
  const planButtons = document.querySelectorAll(".glcard .btn");

  if (!billingToggle || planButtons.length === 0) return;

  // -----------------------------
  // Billing toggle UI (UNCHANGED)
  // -----------------------------
  const prices = document.querySelectorAll(".price");
  const yearlyTexts = document.querySelectorAll(".yearly");

  billingToggle.addEventListener("change", () => {
    const yearly = billingToggle.checked;

    prices.forEach(price => {
      price.textContent = yearly
        ? price.dataset.yearly
        : price.dataset.monthly;
    });

    yearlyTexts.forEach(text => {
      text.style.display = yearly ? "none" : "block";
    });
  });

  // -----------------------------
  // Plan intent capture (LOCKED)
  // -----------------------------
  planButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const card = btn.closest(".glcard");
      if (!card) return;

      // 🔒 AUTHORITATIVE PLAN SOURCE
      const plan = card.querySelector("h2")?.dataset.plan;

      if (!plan) {
        console.error("Plan missing data-plan attribute on h2");
        return;
      }

      // 🔒 ALLOWED PLANS ONLY
      const allowedPlans = ["free", "standard", "enterprise", "elite", "custom"];
      if (!allowedPlans.includes(plan)) {
        console.error("Invalid plan selected:", plan);
        return;
      }

      const billing = billingToggle.checked ? "yearly" : "monthly";

      localStorage.setItem("selectedPlan", plan);
      localStorage.setItem("billingType", billing);

      window.location.href = "signup.html";
    });
  });
});

// ===============================
// VERIFIED BADGE BUTTONS
// ===============================

document.querySelectorAll(".verify-btn").forEach(btn => {
  btn.addEventListener("click", async () => {

    const badgeType = btn.dataset.badge;

    const { data: { user } } = await window.supabaseClient.auth.getUser();

    if (!user) {
      localStorage.setItem("pendingBadgeType", badgeType);
      window.location.href = "login.html";
      return;
    }

    localStorage.setItem("pendingBadgeType", badgeType);
    window.location.href = "verify-badge.html";
  });
});

