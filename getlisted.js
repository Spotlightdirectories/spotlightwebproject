document.addEventListener("DOMContentLoaded", () => {
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
