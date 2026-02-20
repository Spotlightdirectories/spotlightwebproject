document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const planSummaryEl = document.getElementById("planSummary");
  const paymentActions = document.getElementById("paymentActions");
  const bankSection = document.getElementById("bankSection");
  const lockedState = document.getElementById("lockedState");

  const payOnlineBtn = document.getElementById("payOnlineBtn");
  const payBankBtn = document.getElementById("payBankBtn");
  const submitReceiptBtn = document.getElementById("submitReceiptBtn");
  const receiptFileInput = document.getElementById("receiptFile");

  // ===============================
  // AUTH CHECK
  // ===============================
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  const billingType = localStorage.getItem("billingType") || "monthly";


  // ===============================
  // GET VENDOR FROM DATABASE
  // ===============================
  const { data: vendor } = await supabase
    .from("vendors")
    .select("plan_tier, subscription_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!vendor) {
    window.location.replace("onboarding.html");
    return;
  }

  // FREE USERS SHOULD NEVER BE HERE
  if (vendor.plan_tier === "free") {
    window.location.replace("vendor-profile.html");
    return;
  }

  // If already paid → go to onboarding
  if (vendor.subscription_status === "active") {
    window.location.replace("onboarding.html");
    return;
  }

  // Show correct plan
  planSummaryEl.textContent =
    `You selected the ${vendor.plan_tier.toUpperCase()} plan.`;

  // ===============================
  // PAY ONLINE
  // ===============================
  payOnlineBtn.onclick = async () => {

  // 1️⃣ Create payment record first
  const { data, error } = await supabase
    .from("vendorpayments")
    .insert({
      auth_user_id: user.id,
      plan: vendor.plan_tier,
      payment_method: "card",
      status: "pending"
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    alert("Could not create payment record.");
    return;
  }

  // Save payment ID globally
  window.currentPaymentId = data.id;

  // 2️⃣ Open Paystack
  const handler = PaystackPop.setup({
    key: "pk_test_3dc48990c568ef43d2b42a9571cde21b9175d699",
    email: user.email,
    amount: getAmountInKobo(vendor.plan_tier, billingType),
    currency: "NGN",
    ref: `SPOT_${Date.now()}`,
    metadata: {
      auth_user_id: user.id
    },

    callback: function (response) {
      verifyPayment(response.reference);
    },

    onClose: function () {
      alert("Payment cancelled");
    }
  });

  handler.openIframe();
};


  async function verifyPayment(reference) {

  try {

    const { data, error } = await supabase.functions.invoke(
      "verify-paystack-payment",
      {
        body: {
          reference: reference,
          payment_id: window.currentPaymentId,
          auth_user_id: user.id
        }
      }
    );

    if (error) {
      console.log("VERIFY ERROR:", error);
      alert("Payment verification failed.");
      return;
    }

    alert("Payment verified successfully.");
    window.location.href = "onboarding.html";

  } catch (err) {
    console.error(err);
    alert("Payment verification failed. Contact support.");
  }

}



  // ===============================
  // BANK TRANSFER
  // ===============================
  payBankBtn.onclick = async () => {
    const { data, error } = await supabase
      .from("vendorpayments")
      .insert({
        auth_user_id: user.id,
        plan: vendor.plan_tier,
        payment_method: "bank",
        status: "pending"
      })
      .select("id")
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    window.currentPaymentId = data.id;
    paymentActions.classList.add("hidden");
    bankSection.classList.remove("hidden");
  };

  submitReceiptBtn.onclick = async () => {
    const file = receiptFileInput.files[0];
    if (!file) {
      alert("Select a receipt file.");
      return;
    }

    const filePath = `bank-receipts/${window.currentPaymentId}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-receipts")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    await supabase
      .from("vendorpayments")
      .update({
        transfer_proof_url: filePath,
        status: "awaiting_review"
      })
      .eq("id", window.currentPaymentId);

    bankSection.classList.add("hidden");
    lockedState.classList.remove("hidden");
  };

  function getAmountInKobo(plan, billingType) {
  const prices = {
    standard: { monthly: 299800, yearly: 2597600 },
    enterprise: { monthly: 899800, yearly: 8297600 },
    elite: { monthly: 2299800, yearly: 11097600 }
  };

  return prices[plan]?.[billingType] ?? prices[plan]?.monthly ?? 0;
}

});
