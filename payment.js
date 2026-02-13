document.addEventListener("DOMContentLoaded", async () => {
  // ===============================
  // SUPABASE
  // ===============================
  const supabase = window.supabaseClient;

  // ===============================
  // ELEMENTS
  // ===============================
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

  // ===============================
  // PLAN DATA
  // ===============================
  const selectedPlan = localStorage.getItem("selectedPlan");
  const billingType = localStorage.getItem("billingType");

  if (!selectedPlan || !billingType) {
    window.location.replace("getlisted.html");
    return;
  }

  planSummaryEl.textContent =
    `You selected the ${selectedPlan.toUpperCase()} plan (${billingType}).`;

  // ===============================
  // PAY ONLINE — GUARANTEED TO FIRE
  // ===============================
  payOnlineBtn.onclick = () => {
    const handler = PaystackPop.setup({
      key: "pk_test_3dc48990c568ef43d2b42a9571cde21b9175d699", // <-- PUT YOUR REAL TEST KEY
      email: user.email,
      amount: getAmountInKobo(selectedPlan, billingType),
      currency: "NGN",
      ref: `SPOT_${Date.now()}`,
      metadata: {
        auth_user_id: user.id,
        plan: selectedPlan,
        billing_type: billingType
      },
      callback: function () {
        alert("Paystack popup opened successfully");
        // later: verification + redirect
      },
      onClose: function () {
        alert("Payment cancelled");
      }
    });

    handler.openIframe();
  };

  // ===============================
  // BANK TRANSFER (UNCHANGED)
  // ===============================
  payBankBtn.onclick = async () => {
    const { data, error } = await supabase
      .from("vendorpayments")
      .insert({
        auth_user_id: user.id,
        plan: selectedPlan,
        billing_type: billingType,
        payment_method: "bank",
        status: "pending"
      })
      .select("id")
      .single();

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

  // ===============================
  // PRICING
  // ===============================
  function getAmountInKobo(plan, billingType) {
    const prices = {
      standard: { monthly: 299800, yearly: 2597600 },
      enterprise: { monthly: 899800, yearly: 8297600 },
      elite: { monthly: 2299800, yearly: 11097600 }
    };
    return prices[plan][billingType];
  }
});
