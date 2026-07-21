document.addEventListener("DOMContentLoaded", async () => {

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
      return;
    }
  }

  // ✅ Only save for new users
  localStorage.setItem("referral_code", referralCode);
}

  const billingToggle = document.getElementById("billingToggle");
  const planButtons = document.querySelectorAll(".glcard .btn, .plan-btn");

  if (planButtons.length === 0) {
  console.error("No plan buttons found");
  return;
}

  // -----------------------------
  // Billing toggle UI (UNCHANGED)
  // -----------------------------
  const prices = document.querySelectorAll(".price");
  const yearlyTexts = document.querySelectorAll(".yearly"); 
  // ✅ FORCE DEFAULT TO YEARLY ON LOAD
billingToggle.checked = true;

// ✅ APPLY YEARLY PRICING IMMEDIATELY
prices.forEach(price => {
  price.textContent = price.dataset.yearly;
});

yearlyTexts.forEach(text => {
  text.style.display = "none";
});

// ✅ ENSURE DEFAULT BILLING IS ALWAYS SET
if (!localStorage.getItem("billingType")) {
  localStorage.setItem("billingType", "yearly");
}

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
    btn.addEventListener("click", async (e) => {

      // ✅ Skip custom plan → allow normal link/navigation
      e.preventDefault();

      const card = btn.closest(".glcard");

      let plan =
        card?.querySelector("h2")?.dataset.plan ||
        btn.dataset.plan;

      if (!plan) {
        console.error("Plan not detected");
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

      const { data } =
        await window.supabaseClient.auth.getUser();

        if (data?.user) {

        window.location.href =
          "payment";

       } else {

        window.location.href =
          "signup";

      }
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
      window.location.href = "login";
      return;
    }

    localStorage.setItem("pendingBadgeType", badgeType);
    window.location.href = "verify-badge";
  });
});

