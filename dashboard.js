document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  // ===============================
  // AUTH CHECK
  // ===============================
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "login";
    return;
  }

  // ===============================
  // FETCH VENDOR
  // ===============================
  const { data: vendor } = await supabase
   .from("vendors")
   .select("*, expires_at")
   .eq("auth_user_id", user.id)
   .maybeSingle();

   console.log("Vendor record:", vendor);

   // ===============================
// FORCE BLOCK IF CLOSED
// ===============================
if (vendor.account_status === "closed") {
  await supabase.auth.signOut();
  alert("Your account has been closed. Please contact support.");
  window.location.href = "login";
  return;
}

   // ===============================
// AUTO TRANSITION TO CLOSED
// ===============================
if (
  vendor.account_status === "closing" &&
  vendor.scheduled_deletion_at
) {
  const now = new Date();
  const deletionDate = new Date(vendor.scheduled_deletion_at);

  if (now >= deletionDate) {

    await supabase
      .from("vendors")
      .update({
        account_status: "closed"
      })
      .eq("auth_user_id", vendor.auth_user_id);

    // force reload after transition
    location.reload();
    return;
  }
 }

const closeAccountBtn = document.getElementById("closeAccountBtn");

if (closeAccountBtn) {
  closeAccountBtn.addEventListener("click", async () => {

    const confirmClose = confirm(
      "Are you sure you want to close your account?\n\n" +
      "Your profile will be removed immediately and permanently deleted after 14 days.\n\n" +
      "Closing your account does NOT cancel or refund any active subscription. All payments are final."
    );

    if (!confirmClose) return;

    if (!vendor) {
      alert("Unable to verify account.");
      return;
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 14);

    const { data, error: updateError } = await supabase
      .from("vendors")
      .update({
        account_status: "closing",
        scheduled_deletion_at: deletionDate.toISOString()
      })
      .eq("auth_user_id", vendor.auth_user_id)
      .eq("account_status", "active")
      .select();

    if (updateError) {
      console.error("CLOSE ERROR:", updateError);
      alert(`Failed to schedule account closure: ${updateError.message}`);
      return;
    }

    alert("Your account has been scheduled for closure.");
    location.reload();

  });
}

  if (!vendor) {
    window.location.href = "onboarding";
    return;
  }

  // ===============================
  // FLAGS
  // ===============================
  const isActive = vendor.subscription_status === "active";
  const isPending = vendor.subscription_status === "pending";
  const isRejected = vendor.subscription_status === "rejected";
  const isFree = vendor.plan_tier === "free";

  // ===============================
  // STATUS BANNER
  // ===============================
  const banner = document.getElementById("statusBanner");

  const closingBanner = document.getElementById("closingBanner");
  const closingText = document.getElementById("closingText");
  const restoreAccountBtn = document.getElementById("restoreAccountBtn");

  if (isPending) {
    banner.textContent = "Account Pending – Payment Verification";
    banner.className = "status-banner warning";
  }

  if (isRejected) {
    banner.textContent = "Payment Rejected – Contact Support";
    banner.className = "status-banner danger";
  }

 if (vendor.account_status === "closed") {

  banner.textContent = "Account Closed";
  banner.className = "status-banner danger";

} else if (vendor.account_status === "closing") {

  banner.classList.add("hidden");

} else if (isActive) {

  banner.textContent = "Account Active";
  banner.className = "status-banner success";

}

  // ===============================
// ACCOUNT CLOSING STATE
// ===============================
if (vendor.account_status === "closing") {

  banner.classList.add("hidden");

  if (closingBanner) {
    closingBanner.classList.remove("hidden");

    const deletionDate = new Date(vendor.scheduled_deletion_at);
    const now = new Date();

    const daysLeft = Math.ceil(
      (deletionDate - now) / (1000 * 60 * 60 * 24)
    );

    closingText.textContent =
      `Your account is scheduled for deletion in ${daysLeft} day(s).`;

  }

    // ===============================
  // LOCK DASHBOARD ACTIONS
  // ===============================
  document.getElementById("editProfileBtn")?.setAttribute("disabled", true);
  document.getElementById("upgradeBtn")?.setAttribute("disabled", true);
  document.getElementById("applyGrayBtn")?.setAttribute("disabled", true);
  document.getElementById("applyBlueBtn")?.setAttribute("disabled", true);
  document.getElementById("closeAccountBtn")?.setAttribute("disabled", true);

}

  // ===============================
  // ACCOUNT INFO
  // ===============================
  document.getElementById("bizName").textContent = vendor.name || "—";
  document.getElementById("bizEmail").textContent = vendor.email || "—";
  document.getElementById("planTier").textContent = vendor.plan_tier;

  // -------------------------------
// BRANCHES CARD VISIBILITY
// -------------------------------

const branchesCard = document.getElementById("branchesCard");
const manageBranchesBtn = document.getElementById("manageBranchesBtn");

if (branchesCard && manageBranchesBtn) {

  const tier = vendor.plan_tier;

  if (tier === "enterprise" || tier === "elite") {

    branchesCard.classList.remove("hidden");

    manageBranchesBtn.addEventListener("click", () => {
      window.location.href = "dashboard-branches";
    });

  }

}
  document.getElementById("subscriptionStatus").textContent = vendor.subscription_status;

  const badgeStatus = document.getElementById("badgeStatus");

  const applyGrayBtn =
  document.getElementById("applyGrayBtn");

  const applyBlueBtn =
  document.getElementById("applyBlueBtn");

if (badgeStatus) {

  if (vendor.verification_status === "blue") {

    badgeStatus.textContent = "Blue Verified";

    if (applyGrayBtn) {
      applyGrayBtn.style.display = "none";
    }

    if (applyBlueBtn) {
      applyBlueBtn.style.display = "none";
    }

  }

  else if (vendor.verification_status === "gray") {

    badgeStatus.textContent = "Gray Verified";

    if (applyGrayBtn) {
      applyGrayBtn.style.display = "none";
    }

    if (applyBlueBtn) {
      applyBlueBtn.style.display = "inline-block";
      applyBlueBtn.textContent = "Upgrade to Blue Badge";
   }

  }

  else {

    badgeStatus.textContent = "None";

    if (applyGrayBtn) {
      applyGrayBtn.style.display = "inline-block";
    }

    if (applyBlueBtn) {
      applyBlueBtn.style.display = "inline-block";
    }

  }

}

  document.getElementById("spotId").textContent =
    vendor.spot_id || "Not generated yet";

  // ===============================
  // PROFILE SECTION
  // ===============================
  const profileLink = document.getElementById("profileLink");
  const profileNotice = document.getElementById("profileNotice");

  if (isActive) {
    profileLink.href = `vendor-profile.html?slug=${vendor.slug}`;
  } else {
    profileLink.removeAttribute("href");
    profileLink.textContent = "Unavailable until active";
  }

  if (isFree) {
    profileNotice.textContent =
      "Public visibility is limited on Free plan. Upgrade to unlock full exposure.";
  }

  document.getElementById("editProfileBtn").addEventListener("click", () => {
    window.location.href = "editvendor-profile.html";
  });

  // ===============================
  // SUBSCRIPTION SECTION
  // ===============================
  document.getElementById("subPlan").textContent = vendor.plan_tier;
  
  document.getElementById("billingType").textContent =
    vendor.billing_cycle || "—";

   const { data: payment } = await supabase
     .from("vendorpayments")
     .select("amount")
     .eq("vendor_id", vendor.id)
     .in("status", ["confirmed"])
     .order("approved_at", { ascending: false })
     .limit(1)
     .single();

  document.getElementById("priceInfo").textContent =
    payment?.amount ? `₦${(payment.amount / 100).toLocaleString()}` : "—";

   document.getElementById("startDate").textContent =
     vendor.paid_at ? new Date(vendor.paid_at).toLocaleDateString() : "—";
   
   document.getElementById("nextBilling").textContent =
     vendor.expires_at
      ? new Date(vendor.expires_at).toLocaleDateString()
    : "—";

  document.getElementById("upgradeBtn").addEventListener("click", () => {
    window.location.href = "getlisted";
  });

  // ===============================
  // BADGE APPLICATION
  // ===============================
  document.getElementById("applyGrayBtn")?.addEventListener("click", () => {
    localStorage.setItem("pendingBadgeType", "gray");
    window.location.href = "verify-badge";
  });

  document.getElementById("applyBlueBtn")?.addEventListener("click", () => {
    localStorage.setItem("pendingBadgeType", "blue");
    window.location.href = "verify-badge";
  });

  // ===============================
// RESTORE ACCOUNT
// ===============================
if (restoreAccountBtn) {
  restoreAccountBtn.addEventListener("click", async () => {

    const confirmRestore = confirm(
      "Do you want to restore your account?"
    );

    if (!confirmRestore) return;

    const { error } = await supabase
      .from("vendors")
      .update({
        account_status: "active",
        scheduled_deletion_at: null
      })
      .eq("auth_user_id", vendor.auth_user_id)
      .eq("account_status", "closing");

    if (error) {
      console.error("RESTORE ERROR:", error);
      alert(`Failed to restore account: ${error.message}`);
      return;
   }

    alert("Account restored successfully.");

    location.reload();

  });
}

  // ===============================
  // LOGOUT
  // ===============================
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login";
  });
});