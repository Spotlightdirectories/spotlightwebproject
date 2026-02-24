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
    .in("status", ["pending", "awaiting_review"]);

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
    if (e.target.dataset.approve) {
      await approvePayment(e.target.dataset.approve);
    }
    if (e.target.dataset.reject) {
      await rejectPayment(e.target.dataset.reject);
    }
  });

  // -----------------------------
  // APPROVE
  // -----------------------------
async function approvePayment(paymentId) {
  if (!confirm("Approve this payment?")) return;

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
    return;
  }

  if (payment.status !== "awaiting_review") {
  alert("This payment is already processed.");
  return;
 }

  const now = new Date().toISOString();

  // 1️⃣ Update vendorpayment
  await supabase
    .from("vendorpayments")
    .update({
      status: "approved",
      reviewed_at: now,
      approved_at: now,
      paid_at: now,
      reviewed_by: adminSession.user_id
    })
    .eq("id", paymentId);

  // 2️⃣ Activate vendor
  await supabase
    .from("vendors")
    .update({
      subscription_status: "active",
      plan_tier: payment.plan,
      billing_cycle: payment.billing_type,
      is_premium: true,
      paid_at: new Date()
    })
    .eq("id", payment.vendor_id);

  // 3️⃣ Send email
  await sendEmail({
    to: payment.vendors.email,
    subject: "Payment Approved 🎉",
    html: `<p>Your bank transfer has been verified. You can now complete onboarding and access your dashboard.</p>`
  });

  alert("Payment approved");
  location.reload();
}

  // -----------------------------
  // REJECT
  // -----------------------------
  async function rejectPayment(paymentId) {
  const reason = prompt("Reason for rejection?");
  if (!reason) return;

  const { data: payment, error } = await supabase
    .from("vendorpayments")
    .select(`
      id,
      vendor_id,
      vendors ( email )
    `)
    .eq("id", paymentId)
    .single();

  if (error || !payment) {
    alert("Payment not found.");
    return;
  }

  const now = new Date().toISOString();

  // 1️⃣ Update vendorpayment
  await supabase
    .from("vendorpayments")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_at: now,
      rejected_at: now,
      reviewed_by: adminSession.user_id
    })
    .eq("id", paymentId);

  // 2️⃣ Update vendor
  await supabase
    .from("vendors")
    .update({
      subscription_status: "failed"
    })
    .eq("id", payment.vendor_id);

  // 3️⃣ Send email
  await sendEmail({
    to: payment.vendors.email,
    subject: "Payment Rejected",
    html: `<p>Your bank transfer could not be verified.<br/>Reason: ${reason}</p>`
  });

  alert("Payment rejected");
  location.reload();
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
