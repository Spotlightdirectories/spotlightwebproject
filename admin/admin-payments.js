document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const table = document.getElementById("paymentsTable");

  // -----------------------------
  // ADMIN SESSION GUARD
  // -----------------------------
  const adminSession = JSON.parse(localStorage.getItem("admin_session"));

  if (!adminSession || !["admin", "super_admin"].includes(adminSession.role)) {
    alert("Admin access only");
    window.location.href = "admin-login.html";
    return;
  }

  // -----------------------------
  // LOAD PAYMENTS
  // -----------------------------
  const { data: payments, error } = await supabase
    .from("vendorpayments")
    .select(`
      id,
      plan,
      billing_type,
      status,
      transfer_proof_url,
      vendors ( id, name, email )
    `)
    .eq("payment_method", "bank")
    .eq("status", "awaiting_review");

  if (error) {
    table.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
    return;
  }

  if (!payments.length) {
    table.innerHTML = `<tr><td colspan="6">No pending payments</td></tr>`;
    return;
  }

  table.innerHTML = "";

  payments.forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.vendors?.name || "—"}</td>
      <td>${p.plan}</td>
      <td>${p.billing_type}</td>
      <td>
        ${
          p.transfer_proof_url
            ? `<a href="${supabase.storage
                .from("payment-receipts")
                .getPublicUrl(p.transfer_proof_url).data.publicUrl}"
                target="_blank">View</a>`
            : "—"
        }
      </td>
      <td>${p.status}</td>
      <td>
        <button class="approve-btn" data-approve="${p.id}">Approve</button>
        <button class="reject-btn" data-reject="${p.id}">Reject</button>
      </td>
    `;

    table.appendChild(tr);
  });

  table.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");

  if (e.target.dataset.approve) {
    await approvePayment(e.target.dataset.approve, row);
  }

  if (e.target.dataset.reject) {
    await rejectPayment(e.target.dataset.reject, row);
  }
});

  // -----------------------------
  // APPROVE
  // -----------------------------
    async function approvePayment(paymentId, row) {

     if (!confirm("Approve this payment?")) return;

     const approveBtn = document.querySelector(`[data-approve="${paymentId}"]`);
     if (approveBtn) {
      approveBtn.disabled = true;
      approveBtn.textContent = "Processing...";
    }

  const { data: payment, error } = await supabase
    .from("vendorpayments")
    .select(`
      id,
      vendor_id,
      plan,
      billing_type,
      status,
      vendors ( id, email )
    `)
    .eq("id", paymentId)
    .single();

    if (error || !payment) {
      alert("Payment not found.");
      if (approveBtn) {
        approveBtn.disabled = false;
        approveBtn.textContent = "Approve";
     }
     return;
  }

  if (payment.status !== "awaiting_review") {
  alert("This payment is already processed.");
  return;
 }

  const now = new Date().toISOString();

  // 1️⃣ Update vendorpayment
  const { error: updateError } = await supabase
  .from("vendorpayments")
  .update({
    status: "approved",
    reviewed_at: now,
    approved_at: now,
    rejected_at: null,
    rejection_reason: null,
    reviewed_by: adminSession.user_id
  })
  .eq("id", paymentId);

if (updateError) {
  console.error("VendorPayment update failed:", updateError);
  alert("Failed to update payment record.");
  return;
}

  // 2️⃣ Activate vendor

  await supabase
    .from("vendors")
    .update({
      subscription_status: "active",
      plan_tier: payment.plan,
      billing_cycle: payment.billing_type,
      is_premium: true,
      paid_at: now
    })
    .eq("id", payment.vendor_id);

  // 3️⃣ Send email
  await sendEmail({
    to: payment.vendors.email,
    subject: "Payment Approved 🎉",
    html: `<p>Your bank transfer has been verified. You can now complete onboarding and access your dashboard.</p>`
  });

  await supabase
  .from("vendorpayments")
  .update({ notification_sent: true })
  .eq("id", paymentId);

  alert("Payment approved");

  if (row) row.remove();
  }

  // -----------------------------
  // REJECT
  // -----------------------------
  async function rejectPayment(paymentId, row) {
    console.log("REJECT FUNCTION ENTERED");
    const reason = prompt("Reason for rejection?");
  
    if (!reason) return;

  const rejectBtn = document.querySelector(`[data-reject="${paymentId}"]`);
   if (rejectBtn) {
     rejectBtn.disabled = true;
     rejectBtn.textContent = "Processing...";
   }

  const { data: payment, error } = await supabase
    .from("vendorpayments")
    .select(`
      id,
      vendor_id,
      status,
      vendors ( email )
    `)
    .eq("id", paymentId)
    .single();

  console.log("FETCHED PAYMENT:", payment);
  console.log("FETCH ERROR:", error);

    if (error || !payment) {
      alert("Payment not found.");
      if (rejectBtn) {
        rejectBtn.disabled = false;
        rejectBtn.textContent = "Reject";
     }
     return;
   }

  console.log("CURRENT STATUS:", payment.status);

  if (payment.status !== "awaiting_review") {
  alert("This payment is rejected.");
  return;
}

  const { data: authData } = await supabase.auth.getUser();
  console.log("AUTH USER:", authData?.user);

  const now = new Date().toISOString();

  // 1️⃣ Update vendorpayment
  const { data: updatedRow, error: updateError } = await supabase
  .from("vendorpayments")
  .update({
  status: "rejected",
  reviewed_at: now,
  approved_at: null,
  rejected_at: now,
  rejection_reason: reason,
  reviewed_by: adminSession.user_id
})
.eq("id", paymentId);

console.log("UPDATE RESULT:", updatedRow);
console.log("UPDATE ERROR:", updateError);

if (updateError) {
  console.error("VendorPayment update failed:", updateError);
  alert("Failed to update payment record.");
  if (rejectBtn) {
    rejectBtn.disabled = false;
    rejectBtn.textContent = "Reject";
  }
  return;
}

  // 2️⃣ Update vendor
  await supabase
    .from("vendors")
    .update({
      subscription_status: "rejected"
    })
    .eq("id", payment.vendor_id);

  // 3️⃣ Send email
  await sendEmail({
    to: payment.vendors.email,
    subject: "Payment Rejected",
    html: `<p>Your bank transfer could not be verified.<br/>Reason: ${reason}</p>`
  });

  await supabase
  .from("vendorpayments")
  .update({ notification_sent: true })
  .eq("id", paymentId);

  alert("Payment rejected");

  if (row) row.remove();
  
}
  // -----------------------------
  // EMAIL (RESEND EDGE)
  // -----------------------------
  async function sendEmail(payload) {
    await fetch(
      "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": window.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${window.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      }
    );
  }
});
