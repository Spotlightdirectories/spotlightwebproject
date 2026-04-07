document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  await supabase.rpc("unlock_commissions");

  const table = document.getElementById("commissionTable");
  const pendingEl = document.getElementById("pendingTotal");
  const availableEl = document.getElementById("availableTotal");
  const paidEl = document.getElementById("paidTotal");

  try {
    // ===============================
    // AUTH USER
    // ===============================
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      table.innerHTML = `<tr><td colspan="5">Not logged in</td></tr>`;
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
      table.innerHTML = `<tr><td colspan="5">Partner not found</td></tr>`;
      return;
    }

    const partnerId = partner.id;

    // ===============================
    // FETCH COMMISSIONS + VENDOR INFO
    // ===============================
    const { data: commissions, error } = await supabase
      .from("commissions")
      .select(`
        id,
        amount,
        status,
        created_at,
        vendors (
          name,
          plan_tier
        )
      `)
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });

    if (error) {
      table.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
      return;
    }

    if (!commissions || commissions.length === 0) {
      table.innerHTML = `<tr><td colspan="5">No commissions yet</td></tr>`;
      return;
    }

    // ===============================
    // TOTALS
    // ===============================
    let pending = 0;
    let available = 0;
    let paid = 0;

    table.innerHTML = "";

    commissions.forEach(c => {
      if (c.status === "pending") pending += Number(c.amount) / 100;
      if (c.status === "available") available += Number(c.amount) / 100;
      if (c.status === "paid") paid += Number(c.amount) / 100;

      // Map status to admin badge style
      let statusClass = `status-${c.status}`;

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${c.vendors?.name || "—"}</td>
        <td>${c.vendors?.plan_tier || "—"}</td>
        <td>₦${(Number(c.amount) / 100).toLocaleString()}</td>
        <td><span class="status-badge ${statusClass}">${c.status}</span></td>
        <td>${new Date(c.created_at).toLocaleDateString()}</td>
      `;

      table.appendChild(tr);
    });

    // ===============================
    // UPDATE TOTAL UI
    // ===============================
    pendingEl.textContent = `₦${pending.toLocaleString()}`;
    availableEl.textContent = `₦${available.toLocaleString()}`;
    paidEl.textContent = `₦${paid.toLocaleString()}`;

  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td colspan="5">Unexpected error</td></tr>`;
  }
});