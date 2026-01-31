document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const planSummaryEl = document.getElementById("planSummary");
  const hintEl = document.getElementById("paymentHint");

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const selectedPlan = localStorage.getItem("selectedPlan");
  const billingType = localStorage.getItem("billingType");

  if (!selectedPlan) {
    window.location.href = "getlisted.html";
    return;
  }

  planSummaryEl.textContent =
    `You selected the ${selectedPlan.toUpperCase()} plan (${billingType}).`;

  // 🔒 IMPORTANT:
  // ❌ DO NOT create vendor here
  // Payment happens BEFORE onboarding

  // PAY ONLINE (Paystack – stub)
  document.getElementById("payOnlineBtn").addEventListener("click", async () => {
    hintEl.textContent = "Redirecting to secure online payment…";
    hintEl.classList.remove("hidden");

    await supabase.from("vendorpayments").insert({
      auth_user_id: user.id,
      plan: selectedPlan,
      billing_type: billingType,
      payment_method: "paystack",
      status: "pending"
    });

    // Paystack redirect later
  });

  // BANK TRANSFER
  document.getElementById("payBankBtn").addEventListener("click", async () => {
    await supabase.from("vendorpayments").insert({
      auth_user_id: user.id,
      plan: selectedPlan,
      billing_type: billingType,
      payment_method: "bank",
      status: "pending"
    });

    hintEl.innerHTML = `
      <strong>Bank Transfer Instructions</strong><br><br>
      Bank: Sterling Bank Plc<br>
      Account Name: Spotlight Directories Ltd<br>
      Account Number: 0123456789<br><br>
      After payment, send receipt to
      <strong>payments@spotlightdirectories.com</strong>.
      Your account will be activated after payment is confirmed.
    `;
    hintEl.classList.remove("hidden");
  });
});
