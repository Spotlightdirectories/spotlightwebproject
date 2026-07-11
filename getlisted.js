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

    localStorage.setItem("referral_code", referralCode);
  }

  const billingToggle = document.getElementById("billingToggle");
  const planButtons = document.querySelectorAll(".gl-btn, .gl-plan-btn");

  if (!billingToggle) {
    console.error("Billing toggle not found");
    return;
  }

  if (planButtons.length === 0) {
    console.error("No plan buttons found");
    return;
  }

  // -----------------------------
  // Billing toggle UI
  // -----------------------------
  const prices = document.querySelectorAll(".gl-price");
  const yearlyNotes = document.querySelectorAll(".gl-yearly-note");

  // Default to yearly on load
  billingToggle.checked = true;

  prices.forEach(price => {
    if (price.dataset.yearly) {
      price.textContent = price.dataset.yearly;
    }
  });

  if (!localStorage.getItem("billingType")) {
    localStorage.setItem("billingType", "yearly");
  }

  billingToggle.addEventListener("change", () => {
    const yearly = billingToggle.checked;

    prices.forEach(price => {
      if (!price.dataset.monthly) return; // skip "Let's talk" custom price
      price.textContent = yearly
        ? price.dataset.yearly
        : price.dataset.monthly;
    });

    yearlyNotes.forEach(note => {
      if (note.textContent.includes("save 25%") || note.textContent.includes("Billed")) {
        note.style.visibility = yearly ? "visible" : "hidden";
      }
    });
  });

  // -----------------------------
  // Plan intent capture
  // -----------------------------
  planButtons.forEach(btn => {
    btn.addEventListener("click", async (e) => {

      // Custom plan → let it navigate normally to contact-us
      const card = btn.closest(".gl-card");
      const isCustomCard = card && !card.querySelector("h2[data-plan]");
      const isCustomTableLink = btn.classList.contains("gl-plan-btn-link");

      if (isCustomCard || isCustomTableLink) {
        return;
      }

      e.preventDefault();

      let plan =
        card?.querySelector("h2")?.dataset.plan ||
        btn.dataset.plan;

      if (!plan) {
        console.error("Plan not detected");
        return;
      }

      const allowedPlans = ["free", "standard", "enterprise", "elite", "custom"];
      if (!allowedPlans.includes(plan)) {
        console.error("Invalid plan selected:", plan);
        return;
      }

      const billing = billingToggle.checked ? "yearly" : "monthly";

      localStorage.setItem("selectedPlan", plan);
      localStorage.setItem("billingType", billing);

      const { data } = await window.supabaseClient.auth.getUser();

      if (data?.user) {
        window.location.href = "payment";
      } else {
        window.location.href = "signup";
      }
    });
  });

});
