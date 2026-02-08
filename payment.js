document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const planSummaryEl = document.getElementById("planSummary");
  const paymentActions = document.getElementById("paymentActions");
  const bankSection = document.getElementById("bankSection");
  const lockedState = document.getElementById("lockedState");
  const receiptStatus = document.getElementById("receiptStatus");

  const payOnlineBtn = document.getElementById("payOnlineBtn");
  const payBankBtn = document.getElementById("payBankBtn");
  const submitReceiptBtn = document.getElementById("submitReceiptBtn");
  const receiptFileInput = document.getElementById("receiptFile");

  // ===============================
  // AUTH
  // ===============================
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  const selectedPlan = localStorage.getItem("selectedPlan");
  const billingType = localStorage.getItem("billingType");

  if (!selectedPlan || !billingType) {
    window.location.replace("getlisted.html");
    return;
  }

  planSummaryEl.textContent =
    `You selected the ${selectedPlan.toUpperCase()} plan (${billingType}).`;

  // ===============================
  // CHECK EXISTING PAYMENT (LOCK PAGE)
  // ===============================
  const { data: existingPayment } = await supabase
    .from("vendorpayments")
    .select("id,status")
    .eq("auth_user_id", user.id)
    .in("status", ["pending", "awaiting_review", "approved"])
    .maybeSingle();

  if (existingPayment) {
    paymentActions.classList.add("hidden");
    bankSection.classList.add("hidden");
    lockedState.classList.remove("hidden");
    return;
  }

  // ===============================
  // PAY ONLINE (STUB)
  // ===============================
  payOnlineBtn.addEventListener("click", async () => {
    await supabase.from("vendorpayments").insert({
      auth_user_id: user.id,
      plan: selectedPlan,
      billing_type: billingType,
      payment_method: "paystack",
      status: "pending"
    });

    paymentActions.classList.add("hidden");
    lockedState.classList.remove("hidden");
  });

  // ===============================
  // BANK TRANSFER
  // ===============================
  payBankBtn.addEventListener("click", async () => {
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
  });

  // ===============================
  // SUBMIT RECEIPT
  // ===============================
  submitReceiptBtn.addEventListener("click", async () => {
    const file = receiptFileInput.files[0];
    if (!file) {
      alert("Please select a receipt file.");
      return;
    }

    const filePath =
      `bank-receipts/${window.currentPaymentId}-${file.name}`;

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
  });
});
