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
    console.log("7fc1e3c0-a9b9-4d05-93b3-a4c73f2ac199:", user.id);

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
      console.log("PARTNER:", partner, "ERROR:", partnerError);

    if (partnerError || !partner) {
      table.innerHTML = `<tr><td colspan="6">Partner not found</td></tr>`;
      return;
    }

const partnerId = partner.id;
    
// ===============================
// LOAD DOWNLINE PARTNERS
// ===============================
const downlineTable = document.getElementById("downlineTable");

if (downlineTable) {

  downlineTable.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

  const { data: downline, error: downlineError } = await supabase
    .from("partners")
    .select("id, name")
    .eq("referred_by", partnerId);

  if (downlineError) {
    downlineTable.innerHTML = `<tr><td colspan="4">${downlineError.message}</td></tr>`;
  } else if (!downline || downline.length === 0) {
    downlineTable.innerHTML = `<tr><td colspan="4">No referred partners</td></tr>`;
  } else {

    downlineTable.innerHTML = "";

    for (const p of downline) {

      const { data: earnings } = await supabase
        .from("commissions")
        .select("amount")
        .eq("partner_id", p.id);

      const total = (earnings || [])
        .reduce((sum, c) => sum + Number(c.amount || 0), 0) / 100;

      const override = total * 0.05;

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${p.name}</td>
        <td>-</td>
        <td>₦${total.toLocaleString()}</td>
        <td>₦${override.toLocaleString()}</td>
      `;

      downlineTable.appendChild(tr);
    }
  }
}

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
        available_at,
        vendors (
          name,
          plan_tier
      ),
      vendorpayments (
      plan,
      billing_type
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
// MONTHLY BONUS CALCULATION (STEP 3)
// ===============================
let monthlyQualified = 0;

const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

commissions.forEach(c => {

  const isVendor = c.type === "vendor";
  const isAvailable = c.status === "available";
  const isYearly = c.vendorpayments?.billing_type === "yearly";

  const availableDate = c.available_at ? new Date(c.available_at) : null;

  const isCurrentMonth =
    availableDate &&
    availableDate.getMonth() === currentMonth &&
    availableDate.getFullYear() === currentYear;

  if (isVendor && isAvailable && isYearly && isCurrentMonth) {
    monthlyQualified++;
  }

});

const bonusUnits = Math.floor(monthlyQualified / 50);
const bonusAmount = bonusUnits * 30000;

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

    // ===============================
// UPDATE BONUS UI (YEARLY COUNT)
// ===============================
const bonusCurrentEl = document.getElementById("bonusCurrent");
const bonusStatusEl = document.getElementById("bonusStatus");

const monthlyEl = document.getElementById("monthlyVendors");
const progressEl = document.getElementById("bonusProgress");

if (monthlyEl) {
  monthlyEl.innerText = monthlyQualified;
}

if (progressEl) {
  progressEl.innerText = `${monthlyQualified} / 50`;
}

if (bonusCurrentEl) {
  bonusCurrentEl.innerText = monthlyQualified;
}

if (bonusStatusEl) {
  bonusStatusEl.innerText =
    bonusUnits > 0 ? `₦${bonusAmount.toLocaleString()} Earned` : "Not Achieved";
}

    const downloadBtn = document.getElementById("downloadStatementBtn");

if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    downloadCSV(commissions, bonusAmount);
  });
}

  } catch (err) {
    console.error(err);
    table.innerHTML = `<tr><td colspan="6">Unexpected error</td></tr>`;
  }
});

function downloadCSV(data, bonusAmount) {

  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }

  // 1️⃣ Remove pending
  const filtered = data.filter(c => c.status !== "pending");

  if (filtered.length === 0 && bonusAmount === 0) {
    alert("No available or paid records to export");
    return;
  }

  // 2️⃣ Sort by date ASC (important for balance)
  filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let balance = 0;

  const rows = [];

  filtered.forEach(c => {
    const amount = Number(c.amount) / 100;

    let credit = 0;
    let debit = 0;
    let description = "";

    if (c.status === "available") {
      credit = amount;
      balance += amount;
      description = `${c.type} earning`;
    }

    if (c.status === "paid") {
      debit = amount;
      balance -= amount;
      description = "Payout";
    }

    rows.push({
      Date: new Date(c.created_at).toLocaleDateString(),
      Description: description,
      Credit: credit ? credit.toFixed(2) : "",
      Debit: debit ? debit.toFixed(2) : "",
      Balance: balance.toFixed(2)
    });
  });

  // ===============================
// ADD MONTHLY BONUS TO STATEMENT
// ===============================
if (bonusAmount > 0) {

  balance += bonusAmount;

  rows.push({
    Date: new Date().toLocaleDateString(),
    Description: "Monthly Bonus",
    Credit: bonusAmount.toFixed(2),
    Debit: "",
    Balance: balance.toFixed(2)
  });

}

  const csvContent = [
    Object.keys(rows[0]).join(","),
    ...rows.map(r => Object.values(r).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "statement.csv";
  a.click();

  URL.revokeObjectURL(url);
}