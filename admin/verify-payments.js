document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  // 🔒 ADMIN EMAILS (ONLY YOU / TRUSTED STAFF)
  const ADMIN_EMAILS = [
    "spotlightdirectoriesmap@gmail.com"
  ];

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    window.location.href = "../login.html";
    return;
  }

  // Fetch pending payments
  const { data: payments } = await supabase
    .from("vendorpayments")
    .select("id, vendor_id, plan, billing_type")
    .eq("status", "pending");

  const list = document.getElementById("paymentList");

  payments.forEach(p => {
    const row = document.createElement("div");
    row.innerHTML = `
      <p>${p.plan} (${p.billing_type})</p>
      <button data-id="${p.vendor_id}">Approve</button>
    `;
    list.appendChild(row);
  });

  list.addEventListener("click", async (e) => {
    if (!e.target.dataset.id) return;

    const vendorId = e.target.dataset.id;

    // Generate PAID SPOTID
    const { data: spotId } = await supabase.rpc(
      "generate_spot_id",
      { vendor_type: "P" }
    );

    await supabase
      .from("vendors")
      .update({
        spot_id: spotId,
      //subscription_status: "active"
      })
      .eq("id", vendorId);

    await supabase
      .from("vendorpayments")
      .update({ status: "approved" })
      .eq("vendor_id", vendorId);

    alert("Vendor activated");
    location.reload();
  });
});
