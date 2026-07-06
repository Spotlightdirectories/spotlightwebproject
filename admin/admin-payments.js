document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const table = document.getElementById("paymentsTable");
  const verificationTable = document.getElementById("verificationsTable");
  const partnersTable = document.getElementById("partnersTable");
  const commissionsTable = document.getElementById("commissionsTable");
  const summaryTable = document.getElementById("commissionSummaryTable");
  console.log("Verification table:", verificationTable);

  // -----------------------------
  // ADMIN SESSION GUARD
  // -----------------------------
  const adminSession = JSON.parse(localStorage.getItem("admin_session"));

  if (!adminSession || !["admin", "super_admin"].includes(adminSession.role)) {
    alert("Admin access only");
    window.location.href = "admin-login";
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
  .eq("status", "pending");

console.log("PAYMENTS RESULT:", payments, error);

if (error) {
  table.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
} else if (!payments.length) {
  table.innerHTML = `<tr><td colspan="6">No pending payments</td></tr>`;
} else {
  table.innerHTML = "";

  payments.forEach(p => {
    console.log("DB PAYMENT ID:", p.id);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.vendors?.name || "—"}</td>
      <td>${p.plan}</td>
      <td>${p.billing_type}</td>
      <td>
        ${
          p.transfer_proof_url
            ? `<a href="#" onclick="viewSignedUrl('payment-receipts','${p.transfer_proof_url}');return false;">View</a>`
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
}
  // -----------------------------
// LOAD BADGE VERIFICATIONS
// -----------------------------
const { data: verifications, error: verificationError } = await window.supabaseClient
  .from("vendor_verifications")
  .select(`
    id,
    badge_type,
    status,
    created_at,
    id_url,
    passport_photo_url,
    cac_url,
    utility_url,
    memart_url,
    status_report_url,
    vendor:vendors ( name )  
  `)
  
    .eq("status", "pending");

  console.log("VERIFICATIONS RESULT:", verifications, verificationError);

if (verificationError) {
  verificationTable.innerHTML = `<tr><td colspan="6">${verificationError.message}</td></tr>`;
} else if (!verifications.length) {
  verificationTable.innerHTML = `<tr><td colspan="6">No pending verifications</td></tr>`;
} else {
  verificationTable.innerHTML = "";

  verifications.forEach(v => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${v.vendor?.name || "—"}</td>
      <td>${v.badge_type}</td>
      <td>${new Date(v.created_at).toLocaleDateString()}</td>
      <td>
        <a href="#" onclick="viewSignedUrl('vendor-verifications','${v.id_url}');return false;">ID</a> |
        ${v.passport_photo_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.passport_photo_url}');return false;">Passport</a> |` : ""}
        ${v.cac_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.cac_url}');return false;">CAC</a> |` : ""}
        ${v.utility_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.utility_url}');return false;">Utility</a> |` : ""}
        ${v.memart_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.memart_url}');return false;">MEMART</a> |` : ""}
        ${v.status_report_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.status_report_url}');return false;">Status Report</a>` : ""}
      </td>
      <td>${v.status}</td>
      <td>
        <button class="approve-btn" data-verify-approve="${v.id}">Approve</button>
        <button class="reject-btn" data-verify-reject="${v.id}">Reject</button>
      </td>
    `;

    verificationTable.appendChild(tr);
  });
}

// -----------------------------
// LOAD PENDING PARTNERS
// -----------------------------
const { data: partners, error: partnersError } = await supabase
  .from("partners")
  .select("id, name, phone, state, local_government, status")
  .eq("status", "pending");

console.log("PARTNERS RESULT:", partners, partnersError);

if (partnersError) {
  partnersTable.innerHTML = `<tr><td colspan="6">${partnersError.message}</td></tr>`;
} else if (!partners.length) {
  partnersTable.innerHTML = `<tr><td colspan="6">No pending partners</td></tr>`;
} else {
  partnersTable.innerHTML = "";

  partners.forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.name || "—"}</td>
      <td>${p.phone || "—"}</td>
      <td>${p.state || "—"}</td>
      <td>${p.local_government || "—"}</td>
      <td>${p.status}</td>
      <td>
        <button class="approve-btn" data-partner-approve="${p.id}">Approve</button>
        <button class="reject-btn" data-partner-reject="${p.id}">Reject</button>
      </td>
    `;

    partnersTable.appendChild(tr);
  });
}

// -----------------------------
// LOAD ALL COMMISSIONS
// -----------------------------
const { data: commissions, error: commissionsError } = await supabase
  .from("commissions")
  .select(`
  amount,
  status,
  created_at,
  partners ( id, name, referral_code, status ),
  vendors ( name ),
  vendorpayments ( plan )
`)
  .order("created_at", { ascending: false });

console.log("COMMISSIONS RESULT:", commissions, commissionsError);

if (commissionsError) {
  commissionsTable.innerHTML = `<tr><td colspan="8">${commissionsError.message}</td></tr>`;
} else if (!commissions.length) {
  commissionsTable.innerHTML = `<tr><td colspan="8">No commissions</td></tr>`;
} else {
  commissionsTable.innerHTML = "";

  commissions.forEach(c => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${c.partners?.name || "—"}</td>
      <td>${c.partners?.referral_code || "—"}</td>
      <td>${c.vendors?.name || "—"}</td>
      <td>${c.vendorpayments?.plan || "—"}</td>
      <td>₦${(Number(c.amount) / 100).toLocaleString()}</td>
      <td><span class="status-badge status-${c.status}">${c.status}</span></td>
      <td>${c.partners?.status || "—"}</td>
      <td>${new Date(c.created_at).toLocaleDateString()}</td>
    `;

    commissionsTable.appendChild(tr);
  });

// ==============================
// COMMISSION SUMMARY (PER PARTNER)
// ==============================
const summaryMap = {};

commissions.forEach(c => {
  const partnerId = c.partners?.id || "unknown";

  if (!summaryMap[partnerId]) {
    summaryMap[partnerId] = {
      id: c.partners?.id,
      name: c.partners?.name || "—",
      code: c.partners?.referral_code || "—",
      pending: 0,
      available: 0,
      paid: 0
    };
  }

  const amount = Number(c.amount) / 100;

  if (c.status === "pending") summaryMap[partnerId].pending += amount;
  if (c.status === "available") summaryMap[partnerId].available += amount;
  if (c.status === "paid") summaryMap[partnerId].paid += amount;
});

if (!summaryTable) {
  console.error("Summary table not found");
  return;
}
summaryTable.innerHTML = "";

Object.values(summaryMap).forEach(p => {
  const tr = document.createElement("tr");

  tr.innerHTML = `
  <td>${p.name}</td>
  <td>${p.code}</td>
  <td>₦${Math.round(p.pending).toLocaleString()}</td>
  <td>₦${Math.round(p.available).toLocaleString()}</td>
  <td>₦${Math.round(p.paid).toLocaleString()}</td>
  <td>
    ${
      p.available > 0
        ? `<button class="approve-btn" data-pay="${p.id}">Pay</button>`
        : "-"
    }
  </td>
`;

  summaryTable.appendChild(tr);
});

}

  document.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");

  if (e.target.dataset.approve) {
    await approvePayment(e.target.dataset.approve, row);
  }

  if (e.target.dataset.reject) {
    await rejectPayment(e.target.dataset.reject, row);
  }

  if (e.target.dataset.verifyApprove) {
  await approveVerification(e.target.dataset.verifyApprove, row);
}

if (e.target.dataset.verifyReject) {
  await rejectVerification(e.target.dataset.verifyReject, row);
}

if (e.target.dataset.partnerApprove) {
  await approvePartner(e.target.dataset.partnerApprove, row);
}

if (e.target.dataset.partnerReject) {
  await rejectPartner(e.target.dataset.partnerReject, row);
}
  if (e.target.dataset.pay) {
  await payPartner(e.target.dataset.pay);
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

  if (payment.status !== "pending") {
  alert("This payment is already processed.");
  return;
 }

  const now = new Date().toISOString();

  // 1️⃣ Update vendorpayment
  const { error: updateError } = await supabase
  .from("vendorpayments")
  .update({
    status: "confirmed",
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

  const expiry =
  payment.billing_type === "monthly"
    ? new Date(new Date(now).setMonth(new Date(now).getMonth() + 1))
    : new Date(new Date(now).setFullYear(new Date(now).getFullYear() + 1));

await supabase
  .from("vendors")
  .update({
    subscription_status: "active",
    plan_tier: payment.plan,
    billing_cycle: payment.billing_type,
    is_premium: true,
    paid_at: now,
    expires_at: expiry
  })
  .eq("id", payment.vendor_id);


  // 3️⃣ Send email

  console.log("SENDING EMAIL TO:", payment.vendors.email); 

  try {
  await sendEmail({
    to: payment.vendors.email,
    subject: "Payment Approved 🎉",
    html: `<p>Your bank transfer has been verified.</p>
           <p>You can now complete onboarding and access your dashboard.</p>`
  });
} catch (err) {
  console.error("Email failed:", err);
}

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

  if (payment.status !== "pending") {
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
      subscription_status: "failed"
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
// APPROVE BADGE VERIFICATION
// -----------------------------
async function approveVerification(verificationId, row) {

  if (!confirm("Approve this badge verification?")) return;

  const now = new Date().toISOString();

  const { data: verification } = await supabase
    .from("vendor_verifications")
    .select("vendor_id, badge_type, status")
    .eq("id", verificationId)
    .single();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("email")
    .eq("id", verification.vendor_id)
    .single();

   if (!verification) {
     alert("Verification not found.");
      return;
  }

   if (verification.status === "rejected") {
     alert("This verification is already rejected.");
     return;
  }

   if (verification.status === "approved") {
     alert("This verification is already approved.");
     return;
  }

  await supabase
    .from("vendor_verifications")
    .update({
      status: "approved",
      reviewed_at: now,
      reviewed_by: adminSession.user_id
    })
    .eq("id", verificationId);

  await supabase
    .from("vendors")
    .update({
      verification_status: verification.badge_type
    })
    .eq("id", verification.vendor_id);

    try {
      await sendEmail({
        to: vendor.email,
        subject: "Verification Approved ✔️",
        html: `<p>Your vendor verification has been approved.</p>
           <p>Your listing now displays the ${verification.badge_type} badge.</p>`
     });
   } catch (err) {
     console.error("Verification email failed:", err);
   }

   alert("Verification approved");

  if (row) row.remove();
}

// -----------------------------
// REJECT BADGE VERIFICATION
// -----------------------------
async function rejectVerification(verificationId, row) {

  const reason = prompt("Reason for rejection?");
  if (!reason) return;

  const { data: verification } = await supabase
    .from("vendor_verifications")
    .select("vendor_id, badge_type, status")
    .eq("id", verificationId)
    .single();

  if (!verification) {
    alert("Verification not found.");
    return;
  }

  if (verification.status === "rejected") {
    alert("This verification is already rejected.");
    return;
  }

  if (verification.status === "approved") {
    alert("This verification is already approved.");
    return;
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("email")
    .eq("id", verification.vendor_id)
    .single();

  const now = new Date().toISOString();

  await supabase
    .from("vendor_verifications")
    .update({
      status: "rejected",
      reviewed_at: now,
      reviewed_by: adminSession.user_id
    })
    .eq("id", verificationId);

  try {
    await sendEmail({
      to: vendor.email,
      subject: "Verification Rejected",
      html: `<p>Your verification request was not approved.</p>
             <p>Please review your documents and submit again.</p>`
    });
  } catch (err) {
    console.error("Verification rejection email failed:", err);
  }

  alert("Verification rejected");

  if (row) row.remove();
}

// -----------------------------
// APPROVE PARTNER
// -----------------------------
async function approvePartner(partnerId, row) {

  if (!confirm("Approve this partner?")) return;

  const { data: partner, error } = await supabase
    .from("partners")
    .select("id, name, email, status")
    .eq("id", partnerId)
    .single();

  if (error || !partner) {
    alert("Partner not found.");
    return;
  }

  if (partner.status === "approved") {
    alert("This partner is already approved.");
    return;
  }

  // 1️⃣ Generate referral code
  const referralCode =
    "SPOT" +
    Math.random().toString(36).substring(2, 8).toUpperCase();

// 2️⃣ Update partner
const { data: updateData, error: updateError } = await supabase
  .from("partners")
  .update({
    status: "approved",
    referral_code: referralCode,
  })
  .eq("id", partnerId)
  .select();

console.log("PARTNER UPDATE RESULT:", updateData);
console.log("PARTNER UPDATE ERROR:", updateError);

if (updateError) {
  alert("Failed to approve partner: " + updateError.message);
  return;
}

  // 3️⃣ Send email
  const vendorReferralLink = `https://spotlightdirectories.com/getlisted.html?ref=${referralCode}`;
  const partnerReferralLink = `https://spotlightdirectories.com/partner-program.html?ref=${referralCode}`;

  if (!partner.email) {
  alert("Partner has no email. Cannot send approval email.");
  return;
}

await sendEmail({
  to: partner.email,
  subject: "You're Approved 🎉",
    html: `
      <p>Hello ${partner.name},</p>
      <p>Your partner application has been approved.</p>
      <p><a href="https://spotlightdirectories.com/partner-create-account.html?partner_id=${partner.id}">Create your account</a></p>
      <p><strong>Your Referral Code:</strong> ${referralCode}</p>
      <p><strong>Vendor Referral Link:</strong> ${vendorReferralLink}</p>
      <p><strong>Partner Referral Link:</strong> ${partnerReferralLink}</p>
      <p><a href="https://spotlightdirectories.com/partner-legal.html#assets"> visit here for induction</a></p>
    `
  });

  // 4️⃣ Mark notification sent
  await supabase
    .from("partners")
    .update({ notification_sent: true })
    .eq("id", partnerId);

  alert("Partner approved and email sent");

  if (row) row.remove();
}

// -----------------------------
// REJECT PARTNER
// -----------------------------
async function rejectPartner(partnerId, row) {

  const reason = prompt("Reason for rejection?");
  if (!reason) return;

  const { data: partner, error } = await supabase
    .from("partners")
    .select("id, name, email, status")
    .eq("id", partnerId)
    .single();

  if (error || !partner) {
    alert("Partner not found.");
    return;
  }

  if (partner.status === "rejected") {
    alert("This partner is already rejected.");
    return;
  }

  // 1️⃣ Update status
  const { error: updateError } = await supabase
    .from("partners")
    .update({
      status: "rejected"
    })
    .eq("id", partnerId);

  if (updateError) {
    alert("Failed to reject partner.");
    return;
  }

  // 2️⃣ Send email
  await sendEmail({
    to: partner.email,
    subject: "Application Update",
    html: `
      <p>Hello ${partner.name},</p>
      <p>We regret to inform you that your partner application was not approved.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>You may reapply after addressing the issue.</p>
    `
  });

  // 3️⃣ Mark notification sent
  await supabase
    .from("partners")
    .update({ notification_sent: true })
    .eq("id", partnerId);

  alert("Partner rejected and email sent");

  if (row) row.remove();
}

// -----------------------------
// PAY PARTNER (MARK COMMISSIONS AS PAID)
// -----------------------------
async function payPartner(partnerId) {

  if (!confirm("Mark all available commissions as paid for this partner?")) return;

  const now = new Date().toISOString();

  // 1️⃣ Update commissions
  const { error } = await supabase
    .from("commissions")
    .update({
      status: "paid",
      paid_at: now
    })
    .eq("partner_id", partnerId)
    .eq("status", "available");

  if (error) {
    console.error("Payment update failed:", error);
    alert("Failed to mark commissions as paid.");
    return;
  }

  alert("Partner commissions marked as paid");

  // 2️⃣ Refresh page (simple & safe)
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
         "apikey": window.SUPABASE_ANON_KEY
       },
       body: JSON.stringify(payload)
    }
   );
 }

// -----------------------------
// PAYMENT HISTORY
// Shows all confirmed and rejected bank transfer payments.
// Admins can view receipts via signed URLs —
// no Supabase dashboard needed.
// -----------------------------

let allReviewedPayments = [];

async function loadPaymentHistory() {
  const historyTable = document.getElementById("paymentHistoryTable");
  if (!historyTable) return;

  const { data: payments, error } = await supabase
    .from("vendorpayments")
    .select(`
      id,
      plan,
      billing_type,
      amount,
      status,
      transfer_proof_url,
      reviewed_at,
      rejection_reason,
      vendors ( name )
    `)
    .eq("payment_method", "bank")
    .in("status", ["confirmed", "rejected"])
    .order("reviewed_at", { ascending: false });

  if (error) {
    historyTable.innerHTML = `<tr><td colspan="7">Failed to load payment history.</td></tr>`;
    return;
  }

  if (!payments || !payments.length) {
    historyTable.innerHTML = `<tr><td colspan="7">No reviewed payments yet.</td></tr>`;
    return;
  }

  allReviewedPayments = payments;
  renderPaymentHistory(payments);

  // Wire up search and filter
  const searchInput = document.getElementById("paymentHistorySearch");
  const statusFilter = document.getElementById("paymentHistoryFilter");

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const statusValue = statusFilter.value;
    const filtered = allReviewedPayments.filter(p => {
      const nameMatch = (p.vendors?.name || "").toLowerCase().includes(searchTerm);
      const statusMatch = statusValue === "all" || p.status === statusValue;
      return nameMatch && statusMatch;
    });
    renderPaymentHistory(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
}

function renderPaymentHistory(payments) {
  const historyTable = document.getElementById("paymentHistoryTable");
  if (!historyTable) return;

  if (!payments.length) {
    historyTable.innerHTML = `<tr><td colspan="7">No results found.</td></tr>`;
    return;
  }

  historyTable.innerHTML = "";

  payments.forEach(p => {
    const tr = document.createElement("tr");

    const reviewedDate = p.reviewed_at
      ? new Date(p.reviewed_at).toLocaleDateString()
      : "—";

    // Format amount from kobo to naira where possible
    const amountDisplay = p.amount
      ? `₦${Number(p.amount).toLocaleString()}`
      : "—";

    const statusClass = p.status === "confirmed"
      ? "status-approved"
      : "status-rejected";

    const receiptLink = p.transfer_proof_url
      ? `<a href="#"
           onclick="viewSignedUrl('payment-receipts','${p.transfer_proof_url}');return false;"
           style="color:#2563eb;text-decoration:underline;cursor:pointer;">View Receipt</a>`
      : "—";

    tr.innerHTML = `
      <td>${p.vendors?.name || "—"}</td>
      <td>${p.plan || "—"}</td>
      <td>${p.billing_type || "—"}</td>
      <td>${amountDisplay}</td>
      <td>${reviewedDate}</td>
      <td><span class="status-badge ${statusClass}">${p.status}</span></td>
      <td>${receiptLink}</td>
    `;

    historyTable.appendChild(tr);
  });
}

loadPaymentHistory();

// -----------------------------
// VERIFICATION HISTORY
// Shows all approved and rejected verifications.
// Admins can view documents via signed URLs directly
// from the UI — no Supabase dashboard needed.
// -----------------------------

let allReviewedVerifications = [];

async function loadVerificationHistory() {
  const historyTable = document.getElementById("verificationHistoryTable");
  if (!historyTable) return;

  const { data: reviewed, error } = await supabase
    .from("vendor_verifications")
    .select(`
      id,
      badge_type,
      status,
      created_at,
      reviewed_at,
      id_url,
      passport_photo_url,
      cac_url,
      utility_url,
      memart_url,
      status_report_url,
      vendor:vendors ( name )
    `)
    .in("status", ["approved", "rejected"])
    .order("reviewed_at", { ascending: false });

  if (error) {
    historyTable.innerHTML = `<tr><td colspan="6">Failed to load history.</td></tr>`;
    return;
  }

  if (!reviewed || !reviewed.length) {
    historyTable.innerHTML = `<tr><td colspan="6">No reviewed verifications yet.</td></tr>`;
    return;
  }

  allReviewedVerifications = reviewed;
  renderVerificationHistory(reviewed);

  // Wire up search and filter
  const searchInput = document.getElementById("verificationSearch");
  const statusFilter = document.getElementById("verificationStatusFilter");

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const statusValue = statusFilter.value;
    const filtered = allReviewedVerifications.filter(v => {
      const nameMatch = (v.vendor?.name || "").toLowerCase().includes(searchTerm);
      const statusMatch = statusValue === "all" || v.status === statusValue;
      return nameMatch && statusMatch;
    });
    renderVerificationHistory(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
}

function renderVerificationHistory(verifications) {
  const historyTable = document.getElementById("verificationHistoryTable");
  if (!historyTable) return;

  if (!verifications.length) {
    historyTable.innerHTML = `<tr><td colspan="6">No results found.</td></tr>`;
    return;
  }

  historyTable.innerHTML = "";

  verifications.forEach(v => {
    const tr = document.createElement("tr");
    const submittedDate = v.created_at ? new Date(v.created_at).toLocaleDateString() : "—";
    const reviewedDate  = v.reviewed_at ? new Date(v.reviewed_at).toLocaleDateString() : "Not recorded";
    const statusClass   = v.status === "approved" ? "status-approved" : "status-rejected";

    const docLinks = [
      { label: "ID",            url: v.id_url },
      { label: "Passport",      url: v.passport_photo_url },
      { label: "CAC",           url: v.cac_url },
      { label: "Utility",       url: v.utility_url },
      { label: "MEMART",        url: v.memart_url },
      { label: "Status Report", url: v.status_report_url }
    ]
    .filter(doc => doc.url)
    .map(doc =>
      `<a href="#"
         onclick="viewSignedUrl('vendor-verifications','${doc.url}');return false;"
         style="margin-right:6px;color:#2563eb;text-decoration:underline;cursor:pointer;">${doc.label}</a>`
    )
    .join("");

    tr.innerHTML = `
      <td>${v.vendor?.name || "—"}</td>
      <td>${v.badge_type}</td>
      <td>${submittedDate}</td>
      <td>${reviewedDate}</td>
      <td><span class="status-badge ${statusClass}">${v.status}</span></td>
      <td>${docLinks || "—"}</td>
    `;

    historyTable.appendChild(tr);
  });
}

loadVerificationHistory();

});

// -----------------------------
// VIEW SIGNED URL (Private Buckets)
// Defined OUTSIDE DOMContentLoaded so it is globally
// accessible from onclick attributes in the HTML.
// Handles both full URLs (legacy) and file paths (new).
// Link expires after 60 minutes automatically.
// -----------------------------
async function viewSignedUrl(bucket, pathOrUrl) {
  if (!pathOrUrl) return;

  // If a full URL was stored (legacy documents before this fix),
  // extract just the file path from it.
  let filePath = pathOrUrl;
  const marker = `/object/public/${bucket}/`;
  if (pathOrUrl.includes(marker)) {
    filePath = pathOrUrl.split(marker)[1];
  }

  const supabase = window.supabaseClient;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 3600);

  if (error || !data?.signedUrl) {
    alert("Could not generate document link. Please try again.");
    return;
  }

  window.open(data.signedUrl, "_blank");
}
