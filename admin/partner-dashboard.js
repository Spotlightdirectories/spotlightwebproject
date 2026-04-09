document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  await supabase.rpc("unlock_commissions");

  // ===============================
  // ELEMENTS
  // ===============================
  const table = document.getElementById("commissionTable");

  const pendingEl = document.getElementById("pendingTotal");
  const availableEl = document.getElementById("availableTotal");
  const paidEl = document.getElementById("paidTotal");
  const totalEl = document.getElementById("totalEarnings");

  const vendorEl = document.getElementById("vendorEarnings");
  const freeVendorEl = document.getElementById("freeVendorEarnings");
  const overrideEl = document.getElementById("overrideEarnings");
  const bonusEl = document.getElementById("bonusEarnings");

  try {
    // ===============================
    // AUTH USER
    // ===============================
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      table.innerHTML = `<tr><td colspan="6">Not logged in</td></tr>`;
      return;
    }

    // ===============================
    // GET PARTNER
    // ===============================
    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (partnerError || !partner) {
      table.innerHTML = `<tr><td colspan="6">Partner not found</td></tr>`;
      return;
    }

    const partnerId = partner.id;

    // ===============================
    // FETCH COMMISSIONS
    // ===============================
    const { data: commissions, error } = await supabase
      .from("commissions")
      .select(`
        id,
        amount,
        status,
        type,
        created_at,
        vendors (
          name,
          plan_tier
        )
      `)
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });

    if (error) {
      table.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
      return;
    }

    if (!commissions || commissions.length === 0) {
      table.innerHTML = `<tr><td colspan="6">No rewards yet</td></tr>`;
      return;
    }

    // ===============================
    // TOTALS + BREAKDOWN
    // ===============================
    let pending = 0;
    let available = 0;
    let paid = 0;
    let total = 0;

    let vendorTotal = 0;
    let freeVendorTotal = 0;
    let overrideTotal = 0;
    let bonusTotal = 0;

    table.innerHTML = "";

    commissions.forEach(c => {
      const amount = Number(c.amount) / 100;
      total += amount;

      // STATUS TOTALS
      if (c.status === "pending") pending += amount;
      if (c.status === "available") available += amount;
      if (c.status === "paid") paid += amount;

      // TYPE BREAKDOWN
      if (c.type === "vendor") vendorTotal += amount;
      if (c.type === "free_vendor") freeVendorTotal += amount;
      if (c.type === "override") overrideTotal += amount;
      if (c.type === "bonus") bonusTotal += amount;

      // STATUS CLASS
      let statusClass = `status-${c.status}`;

      // TYPE LABEL
      let typeLabel = "—";
      if (c.type === "vendor") typeLabel = "Paid Vendor";
      if (c.type === "free_vendor") typeLabel = "Free Vendor";
      if (c.type === "override") typeLabel = "Override";
      if (c.type === "bonus") typeLabel = "Bonus";

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${c.vendors?.name || "—"}</td>
        <td>${c.vendors?.plan_tier || "—"}</td>
        <td>${typeLabel}</td>
        <td>₦${amount.toLocaleString()}</td>
        <td class="${statusClass}">${c.status}</td>
        <td>${new Date(c.created_at).toLocaleDateString()}</td>
      `;

      table.appendChild(tr);
    });

    // ===============================
    // UPDATE SUMMARY
    // ===============================
    pendingEl.textContent = `₦${pending.toLocaleString()}`;
    availableEl.textContent = `₦${available.toLocaleString()}`;
    paidEl.textContent = `₦${paid.toLocaleString()}`;
    totalEl.textContent = `₦${total.toLocaleString()}`;

    // ===============================
    // UPDATE BREAKDOWN
    // ===============================
    vendorEl.textContent = `₦${vendorTotal.toLocaleString()}`;
    freeVendorEl.textContent = `₦${freeVendorTotal.toLocaleString()}`;
    overrideEl.textContent = `₦${overrideTotal.toLocaleString()}`;
    bonusEl.textContent = `₦${bonusTotal.toLocaleString()}`;

  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td colspan="6">Unexpected error</td></tr>`;
  }
});