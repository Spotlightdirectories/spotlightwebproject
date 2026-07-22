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

  // Check this BEFORE anything below tries to read vendor.plan_tier —
  // a vendor row can genuinely not exist yet (e.g. signup completed
  // but business profile setup was never finished), and reading a
  // property off null here would crash the whole script silently,
  // before any payment button click handlers get attached.
  if (!vendor) {
    window.location.replace(
  "vendordashboard"
);
    return;
  }

    const billingType = vendor?.billing_cycle || "monthly";

    const selectedPlan =
      localStorage.getItem("selectedPlan");

    const effectivePlan =
      selectedPlan &&
      selectedPlan !== vendor.plan_tier
        ? selectedPlan
        : vendor.plan_tier;

      // Show correct plan
if (planSummaryEl && vendor) {
  planSummaryEl.textContent =
    `You selected the ${effectivePlan.toUpperCase()} plan.`;
}

const upgradingFromFree =
  vendor.plan_tier === "free" &&
  selectedPlan &&
  selectedPlan !== "free";

if (
  vendor.plan_tier === "free" &&
  !upgradingFromFree
) {
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

const upgradingPlan =
  selectedPlan &&
  selectedPlan !== vendor.plan_tier;

// A genuine mid-cycle upgrade: vendor already has an ACTIVE paid
// plan and is switching to a different one before it's ended. This
// is exactly the scenario the Disclaimer's "Mid-Cycle Plan Upgrades"
// section covers — shown here at the actual decision point, not
// just buried in a legal page, so it's genuinely informed consent.
const isMidCycleUpgrade =
  paidPlans.includes((vendor.plan_tier || "").toLowerCase()) &&
  vendor.subscription_status === "active" &&
  upgradingPlan;

const upgradeDisclaimer = document.getElementById("upgradeDisclaimer");
const upgradeDisclaimerCheckbox = document.getElementById("upgradeDisclaimerCheckbox");

if (isMidCycleUpgrade && upgradeDisclaimer) {

  upgradeDisclaimer.classList.remove("hidden");

  // Payment buttons stay disabled until the disclaimer is explicitly
  // acknowledged — this is the actual gate, not just a visual note.
  payOnlineBtn.disabled = true;
  payBankBtn.disabled = true;
  payOnlineBtn.style.opacity = "0.5";
  payBankBtn.style.opacity = "0.5";

  if (upgradeDisclaimerCheckbox) {
    upgradeDisclaimerCheckbox.addEventListener("change", () => {
      const checked = upgradeDisclaimerCheckbox.checked;
      payOnlineBtn.disabled = !checked;
      payBankBtn.disabled = !checked;
      payOnlineBtn.style.opacity = checked ? "1" : "0.5";
      payBankBtn.style.opacity = checked ? "1" : "0.5";
    });
  }

}

if (
  paidPlans.includes(
    (vendor.plan_tier || "").toLowerCase()
  ) &&
  vendor.subscription_status === "active" &&
  !upgradingPlan
) {

  window.location.replace(
    "vendordashboard"
  );

  return;

}

  // // 🔹 If payment awaiting review
  // if (vendor.subscription_status === "pending") {
  //   window.location.replace("payment-status");
  //   return;
  // }

if (
  vendor.subscription_status === "pending"
) {

  const { data: latestPendingPayment } =
    await supabase
      .from("vendor_payments")
      .select("created_at, payment_method")
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

    // Downgrade window:
    // Bank transfers: 48 hours (admin needs time to review receipts)
    // Card payments: 24 hours (webhook should fire within seconds)
    const downgradeCutoffHours =
      latestPendingPayment.payment_method === "bank" ? 48 : 24;

    if (hoursPassed >= downgradeCutoffHours) {

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
    .from("vendor_payments")
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
  .from("vendor_payments")
  .update({
    status: "expired"
  })
  .eq("vendor_id", vendor.id)
  .eq("payment_method", "card")
  .eq("status", "pending");

  // 1️⃣ Create payment record first
   const paystackReference = `SPOT_${Date.now()}`;

const { data, error } = await supabase
  .from("vendor_payments")
  .insert({
     vendor_id: vendor.id,
     auth_user_id: user.id,
     plan: effectivePlan,
     billing_type: billingType,
     amount: getAmountInKobo(effectivePlan, billingType),
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
    key: "sk_live_e53ffa8faa0e3b98a3e9e461095c1b86cba76605",
    email: user.email,
    amount: getAmountInKobo(effectivePlan, billingType),
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

    if (error) {

      // The webhook (paystack-webhook) is the PRIMARY activation path
      // — this client-side verify call is really just a UX nicety for
      // showing the success screen a little faster. If this call
      // fails for a network reason, check the vendor's actual current
      // status before showing a scary "payment failed" message that
      // may not even be true.
      const { data: refreshedVendor } = await supabase
        .from("vendors")
        .select("subscription_status, plan_tier")
        .eq("id", vendor.id)
        .maybeSingle();

      if (
        refreshedVendor?.subscription_status === "active" &&
        refreshedVendor?.plan_tier === effectivePlan
      ) {
        // The webhook already activated the plan successfully —
        // this was a false alarm, not a real failure.
        showPaymentSuccessScreen();
        return;
      }

      alert(
        "We couldn't confirm your payment right away. If money was deducted, your account will update automatically within a few minutes once our system receives confirmation. Please check your dashboard shortly."
      );

      window.location.replace("vendordashboard");

      return;
    }

    showPaymentSuccessScreen();

  } catch (err) {
    console.error("Unexpected verification error:", err);
    alert("Payment verification failed. Please contact support.");
  }

}

function showPaymentSuccessScreen() {

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

}



  // ===============================
  // BANK TRANSFER
  // ===============================
payBankBtn.onclick = async () => {

  paymentActions.classList.add("hidden");
  bankSection.classList.remove("hidden");

};

  submitReceiptBtn.onclick = async () => {
    

    submitReceiptBtn.disabled = true;
    submitReceiptBtn.textContent = "Uploading Receipt...";

    const file = receiptFileInput.files[0];

    if (!file) {
      alert("Select a receipt file.");
      submitReceiptBtn.disabled = false;
      submitReceiptBtn.textContent = "Submit Receipt";
      return;
    }

const { data: paymentData, error: paymentError } =
  await supabase
    .from("vendor_payments")
    .insert({
      vendor_id: vendor.id,
      auth_user_id: user.id,
      plan: effectivePlan,
      amount: getAmountInKobo(
        effectivePlan,
        billingType
      ),
      billing_type: billingType,
      payment_method: "bank",
      status: "pending"
    })
    .select("id")
    .maybeSingle();

if (paymentError || !paymentData) {
  alert(
    paymentError?.message ||
    "Could not create payment record."
  );

  submitReceiptBtn.disabled = false;
  submitReceiptBtn.textContent =
    "Submit Receipt";

  return;
}

 window.currentPaymentId =
  paymentData.id;

// Sends the file to the validate-upload Edge Function, which checks
// it server-side (real file type, size) before it reaches storage.
let uploadResult;

try {
  uploadResult = await uploadVendorFile(file, "receipt");
} catch (err) {
  alert(err.message || "Receipt upload failed.");
  submitReceiptBtn.disabled = false;
  submitReceiptBtn.textContent = "Submit Receipt";
  return;
}

    // 1️⃣ Update payment record
    const { data: updateData, error: updateError } = await supabase
      .from("vendor_payments")
      .update({
       transfer_proof_url: uploadResult.path
     })
      .eq("id", window.currentPaymentId)
      .select();

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
    standard: { monthly: 299800, yearly: 2698200 },
    enterprise: { monthly: 1260000, yearly: 11340000 },
    elite: { monthly: 2240000, yearly: 20160000 }
  };

  const normalizedPlan =
  plan?.toLowerCase();

return prices[normalizedPlan]?.[billingType]
  ?? prices[normalizedPlan]?.monthly
  ?? 0;
}

});