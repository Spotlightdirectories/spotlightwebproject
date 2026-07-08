document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const logoutBtn = document.getElementById("logoutBtn");

  const closeAccountBtn = document.getElementById("closeAccountBtn");

if (closeAccountBtn) {
  closeAccountBtn.addEventListener("click", async () => {

    const confirmation = confirm(
`Are you sure you want to close your account?

Your profile will be removed immediately and permanently deleted after 14 days.

All vendors and referred partners linked to your account will be permanently detached and will NOT be restored, even if you reactivate within the 14-day period.

Closing your account does not cancel or refund any active subscriptions. 

All commission earnings will stop immediately, and any pending or unpaid commissions — even those near payout — may be lost.`
    );

    if (!confirmation) return;

    try {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("User not found");
    return;
  }

  // GET PARTNER ID
const { data: partner, error: partnerError } = await supabase
  .from("partners")
  .select("id, account_status")
  .eq("user_id", user.id)
  .maybeSingle();

if (partnerError || !partner) {
  alert("Invalid session. Please login again.");
  await supabase.auth.signOut();
  window.location.href = "/partner-program.html#login";
  return;
}

  const partnerId = partner.id;
    // SET 14 DAYS FROM NOW
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + 14);

  // 1️⃣ UPDATE PARTNER STATUS
const { data, error: updateError } = await supabase
  .from("partners")
  .update({
    account_status: "closing",
    scheduled_deletion_at: deletionDate.toISOString()
  })
  .eq("id", partnerId)
  .eq("account_status", "active")
  .select();

if (updateError) {
  console.error("CLOSE ERROR:", updateError);
  alert(`Failed to update account: ${updateError.message}`);
  return;
}

if (!data || data.length === 0) {
  alert("Close not allowed. Account is not active.");
  return;
}

  // 2️⃣ DETACH VENDORS
  const { error: vendorError } = await supabase
    .from("vendors")
    .update({ referred_by_partner_id: null })
    .eq("referred_by_partner_id", partnerId);

  if (vendorError) {
    alert("Account updated, but failed to detach vendors");
    return;
  }

  alert("Your account has been scheduled for closure. You have 14 days to restore it.");

  window.location.reload();

} catch (err) {
  console.error(err);
  alert("Unexpected error occurred");
}
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/partner-program.html#login";
  });
}

const { error: unlockError } = await supabase.rpc("unlock_commissions");

if (unlockError) {
  console.error("UNLOCK COMMISSIONS ERROR:", unlockError);
}

  // ===============================
  // ELEMENTS
  // ===============================
  const table = document.getElementById("commissionTable");

if (!table) {
  console.error("commissionTable not found");
  return;
}

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
      .select("id, account_status, scheduled_deletion_at, created_at")
      .eq("user_id", user.id)
      .single();

    if (partnerError || !partner) {
  console.error("INVALID SESSION: Not a partner");

  await supabase.auth.signOut();

  window.location.href = "/partner-program.html#login";
  return;
}

const partnerId = partner.id;

// ===============================
// ENFORCE ACCOUNT EXPIRATION
// ===============================
if (partner.scheduled_deletion_at) {

  const now = new Date();
  const deletionDate = new Date(partner.scheduled_deletion_at);

  if (now >= deletionDate) {

    // 1. UPDATE STATUS TO CLOSED
    const { error: closeError } = await supabase
      .from("partners")
      .update({
        account_status: "closed"
      })
      .eq("id", partnerId);

    if (closeError) {
      console.error("FORCE CLOSE ERROR:", closeError);
      alert("Account enforcement failed. Contact support.");
      return;
    }

    // 2. DETACH VENDORS
    const { error: vendorDetachError } = await supabase
      .from("vendors")
      .update({ referred_by_partner_id: null })
      .eq("referred_by_partner_id", partnerId);

    if (vendorDetachError) {
      console.error("DETACH VENDORS ERROR:", vendorDetachError);
    }

    // 3. DETACH DOWNLINE PARTNERS
    const { error: partnerDetachError } = await supabase
      .from("partners")
      .update({ referred_by: null })
      .eq("referred_by", partnerId);

    if (partnerDetachError) {
      console.error("DETACH PARTNERS ERROR:", partnerDetachError);
    }

    // 4. FORCE LOGOUT
    alert("Your account has been permanently closed.");

    await supabase.auth.signOut();
    window.location.href = "/partner-program.html#login";
    return;
  }
}

// ===============================
// ACCOUNT INFO DISPLAY
// ===============================
const partnerSinceEl = document.getElementById("partnerSince");
const accountStatusEl = document.getElementById("accountStatus");

if (partnerSinceEl && partner.created_at) {
  const createdDate = new Date(partner.created_at);
  partnerSinceEl.textContent = createdDate.toLocaleDateString();
}

if (accountStatusEl) {
  accountStatusEl.textContent = partner.account_status;
}

// ===============================
// ACTIVITY STATUS (30 DAYS RULE)
// ===============================
const { data: recentVendors } = await supabase
  .from("vendors")
  .select("id, created_at")
  .eq("referred_by_partner_id", partnerId);

let isActive = false;

if (recentVendors && recentVendors.length > 0) {
  const now = new Date();

  isActive = recentVendors.some(v => {
    const created = new Date(v.created_at);
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  });
}

// Update display
if (accountStatusEl) {
  let displayStatus = "";

  if (partner.scheduled_deletion_at) {
    displayStatus = "Closing";
  } else if (partner.account_status === "closed") {
    displayStatus = "Closed";
  } else {
    displayStatus = isActive ? "Active" : "Inactive";
  }

  accountStatusEl.textContent = displayStatus;
}

// ===============================
// ACCOUNT CLOSING NOTICE
// ===============================
const noticeEl = document.getElementById("accountClosingNotice");

if (noticeEl) {

  // CLEAR any existing restore button (prevents duplicates or stale state)
  const existingBtn = document.getElementById("restoreAccountBtn");
  if (existingBtn) existingBtn.remove();

  if (partner.scheduled_deletion_at) {

    const deletionDate = new Date(partner.scheduled_deletion_at);
    const now = new Date();

    const diffTime = deletionDate - now;
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    noticeEl.classList.remove("hidden");

    const textNode = noticeEl.querySelector("p");
    if (textNode) {
      textNode.textContent = `Your account is scheduled for deletion in ${daysRemaining} day(s).`;
    }

    // CREATE restore button ONLY in closing state
    const restoreBtn = document.createElement("button");
    restoreBtn.id = "restoreAccountBtn";
    restoreBtn.textContent = "Restore Account";

    restoreBtn.onclick = async () => {
      const confirmRestore = confirm("Do you want to restore your account?");
      if (!confirmRestore) return;

      try {
        const { data, error } = await supabase
          .from("partners")
          .update({
            account_status: "active",
            scheduled_deletion_at: null
          })
          .eq("id", partnerId)
          .select();

        if (error) {
          console.error("RESTORE ERROR:", error);
          alert(error.message || "Failed to restore account");
          return;
        }

        if (!data || data.length === 0) {
          alert("Update blocked. No rows affected.");
          return;
        }

        alert("Your account has been restored.");
       
        // ===============================
// FORCE UI RESET (NO RELOAD)
// ===============================

noticeEl.classList.add("hidden");

const restoreTextNode = noticeEl.querySelector("p");
if (restoreTextNode) {
  restoreTextNode.textContent = "";
}

restoreBtn.remove();

if (accountStatusEl) {
  accountStatusEl.textContent = "Active";
}

      } catch (err) {
        console.error(err);
        alert("Unexpected error occurred");
      }
    };

    noticeEl.appendChild(restoreBtn);

  } else {
  noticeEl.classList.add("hidden");

  const textNode = noticeEl.querySelector("p");
  if (textNode) {
    textNode.textContent = "";
  }
}
}

// ===== PAID VENDORS COUNT (CORRECT SOURCE: COMMISSIONS) =====
const { data: paidData } = await supabase
  .from("commissions")
  .select("vendor_id")
  .eq("partner_id", partnerId)
  .eq("type", "vendor");

const uniquePaidVendors = new Set(
  (paidData || []).map(v => v.vendor_id)
).size;

const paidVendorsEl = document.getElementById("paidVendors");
if (paidVendorsEl) {
  paidVendorsEl.textContent = uniquePaidVendors;
}

 
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

// SET REFERRED PARTNERS COUNT
const referredPartnersEl = document.getElementById("referredPartners");

if (referredPartnersEl) {
  referredPartnersEl.textContent = (downline || []).length;
}

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
      vendor_payments (
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
  const isYearly = c.vendor_payments?.billing_type === "yearly";

  const createdDate = new Date(c.created_at);

  const isCurrentMonth =
    createdDate.getMonth() === currentMonth &&
    createdDate.getFullYear() === currentYear;

   if (isVendor && isYearly && isCurrentMonth) {
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
  console.error("MAIN ERROR:", err);

  if (table) {
    table.innerHTML = `<tr><td colspan="6">Unexpected error</td></tr>`;
  } else {
    alert("A critical error occurred. Check console.");
  }
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