document.addEventListener("DOMContentLoaded", async () => {
  console.log("PAYMENT JS STARTED");
  const supabase = window.supabaseClient;

  const planSummaryEl = document.getElementById("planSummary");
  const paymentActions = document.getElementById("paymentActions");
  const bankSection = document.getElementById("bankSection");
  const lockedState = document.getElementById("lockedState");

  const payOnlineBtn = document.getElementById("payOnlineBtn");
  const payBankBtn = document.getElementById("payBankBtn");
  const submitReceiptBtn = document.getElementById("submitReceiptBtn");
  console.log("SUBMIT BTN:", submitReceiptBtn);
  const receiptFileInput = document.getElementById("receiptFile");

  // ===============================
  // AUTH CHECK
  // ===============================
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.replace("login");
    return;
  }

  // ===============================
  // GET VENDOR FROM DATABASE
  // ===============================
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, plan_tier, subscription_status, billing_cycle, created_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

    const billingType = vendor?.billing_cycle || "monthly";

      // Show correct plan
    if (planSummaryEl && vendor) {
     planSummaryEl.textContent =
    `You selected the ${vendor.plan_tier.toUpperCase()} plan.`;
    }

  if (!vendor) {
    window.location.replace(
  "vendordashboard"
);
    return;
  }
  if (vendor.plan_tier === "free") {
    window.location.replace(
  "vendordashboard"
);
    return;
  }

  // 🔹 If payment approved
const paidPlans = [
  "standard",
  "enterprise",
  "elite",
  "custom"
];

if (
  paidPlans.includes(
    (vendor.plan_tier || "").toLowerCase()
  ) &&
  vendor.subscription_status === "active"
) {

  window.location.replace(
    "vendordashboard"
  );

  return;

}

  // 🔹 If payment awaiting review
  if (vendor.subscription_status === "pending") {
    window.location.replace("payment-status");
    return;
  }

if (
  vendor.subscription_status === "pending"
) {

  const { data: latestPendingPayment } =
    await supabase
      .from("vendorpayments")
      .select("created_at")
      .eq("vendor_id", vendor.id)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

  if (latestPendingPayment?.created_at) {

    const createdAt =
      new Date(
        latestPendingPayment.created_at
      );

    const now =
      new Date();

    const hoursPassed =
      (now - createdAt) /
      (1000 * 60 * 60);

    // 24-hour recovery fallback
    if (hoursPassed >= 24) {

   await supabase
  .from("vendors")
  .update({
    plan_tier: "free",
    billing_cycle: null,
    subscription_status: "free",
    is_premium: false
  })
  .eq("id", vendor.id);

  await supabase
    .from("vendorpayments")
    .update({
    status: "expired"
    })
    .eq("vendor_id", vendor.id)
    .eq("status", "pending");

      window.location.replace(
        "vendordashboard"
      );

      return;

    }

  }

}

  // ===============================
  // PAY ONLINE
  // ===============================
  payOnlineBtn.onclick = async () => {


    // Expire older pending card payments
await supabase
  .from("vendorpayments")
  .update({
    status: "expired"
  })
  .eq("vendor_id", vendor.id)
  .eq("payment_method", "card")
  .eq("status", "pending");

  // 1️⃣ Create payment record first
   const paystackReference = `SPOT_${Date.now()}`;

const { data, error } = await supabase
  .from("vendorpayments")
  .insert({
     vendor_id: vendor.id,
     auth_user_id: user.id,
     plan: vendor.plan_tier,
     billing_type: billingType,
     amount: getAmountInKobo(vendor.plan_tier, billingType),
     payment_method: "card",
     status: "pending",
     gateway_ref: paystackReference
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
    ref: paystackReference,
    metadata: {
      auth_user_id: user.id
    },

    callback: function (response) {
      verifyPayment(response.reference);
    },

onClose: function () {

  alert(
    "Payment window closed. If payment was completed successfully, your account will update automatically after verification."
  );

  window.location.replace(
    "vendordashboard"
  );

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

    console.log("Invoke result:", data, error);

    if (error) {
      console.log("VERIFY ERROR:", error);
      alert("Payment verification failed.");
      return;
    }

     // Show inline success state
document.body.innerHTML = `
  <div style="
    display:flex;
    align-items:center;
    justify-content:center;
    height:100vh;
    font-family:system-ui;
    background:#f9fafb;
  ">
    <div style="
      background:white;
      padding:40px;
      border-radius:12px;
      box-shadow:0 10px 30px rgba(0,0,0,0.08);
      text-align:center;
      max-width:420px;
    ">
      <h2 style="margin-bottom:15px;color:#16a34a;">
        ✔ Payment Verified Successfully
      </h2>
      <p style="margin-bottom:20px;color:#555;">
        Redirecting you to complete onboarding...
      </p>
    </div>
  </div>
`;

// Redirect automatically
setTimeout(() => {
  window.location.replace(
  "vendordashboard"
);
}, 2500);

  } catch (err) {
    console.error("Unexpected verification error:", err);
    alert("Payment verification failed. Please contact support.");
  }

}



  // ===============================
  // BANK TRANSFER
  // ===============================
  payBankBtn.onclick = async () => {
    const { data, error } = await supabase
      .from("vendorpayments")
      .insert({
       vendor_id: vendor.id,
       auth_user_id: user.id,
       plan: vendor.plan_tier,
       amount: getAmountInKobo(vendor.plan_tier, billingType),
       billing_type: billingType,
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

  console.log("ATTACHING CLICK HANDLER");

  submitReceiptBtn.onclick = async () => {
    

    submitReceiptBtn.disabled = true;
    submitReceiptBtn.textContent = "Uploading Receipt...";

    const file = receiptFileInput.files[0];
    console.log("FILE INPUT:", receiptFileInput.files);

    if (!file) {
      alert("Select a receipt file.");
      submitReceiptBtn.disabled = false;
      submitReceiptBtn.textContent = "Submit Receipt";
      return;
    }

    const filePath = `bank-receipts/${window.currentPaymentId}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-receipts")
      .upload(filePath, file, { upsert: true });

      console.log("UPLOAD COMPLETED");

    if (uploadError) {
      console.log("UPLOAD ERROR:", uploadError);
      alert(uploadError.message);
      submitReceiptBtn.disabled = false;
      submitReceiptBtn.textContent = "Submit Receipt";
      return;
    }

    // 1️⃣ Update payment record
    const { data: updateData, error: updateError } = await supabase
      .from("vendorpayments")
      .update({
       transfer_proof_url: filePath
     })
      .eq("id", window.currentPaymentId)
      .select();

console.log("UPDATE RESULT:", updateData, updateError, window.currentPaymentId);

// 2️⃣ Ensure vendor subscription is pending
    await supabase
      .from("vendors")
      .update({
        subscription_status: "pending"
     })
      .eq("auth_user_id", user.id);

// 3️⃣ Redirect to status page (terminal state)
  window.location.replace("payment-status");
  };

  function getAmountInKobo(plan, billingType) {
  const prices = {
    standard: { monthly: 299800, yearly: 2597600 },
    enterprise: { monthly: 899800, yearly: 8297600 },
    elite: { monthly: 2299800, yearly: 11097600 }
  };

  const normalizedPlan =
  plan?.toLowerCase();

return prices[normalizedPlan]?.[billingType]
  ?? prices[normalizedPlan]?.monthly
  ?? 0;
}

});