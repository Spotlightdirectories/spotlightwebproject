document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  // ===============================
  // AUTH CHECK
  // ===============================
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "login.html";
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

  if (!vendor) {
    window.location.href = "onboarding.html";
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

  if (isPending) {
    banner.textContent = "Account Pending – Payment Verification";
    banner.className = "status-banner warning";
  }

  if (isRejected) {
    banner.textContent = "Payment Rejected – Contact Support";
    banner.className = "status-banner danger";
  }

  if (isActive) {
    banner.textContent = "Account Active";
    banner.className = "status-banner success";
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
      window.location.href = "dashboard-branches.html";
    });

  }

}
  document.getElementById("subscriptionStatus").textContent = vendor.subscription_status;

  const badgeStatus = document.getElementById("badgeStatus");

  if (badgeStatus) {
    if (vendor.verification_status === "blue") {
      badgeStatus.textContent = "Blue Verified";
    } 
    else if (vendor.verification_status === "gray") {
    badgeStatus.textContent = "Gray Verified";
   } 
    else {
      badgeStatus.textContent = "None";
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
    window.location.href = "onboarding.html";
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
     .in("status", ["approved", "active"])
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
    window.location.href = "getlisted.html";
  });

  // ===============================
  // BADGE APPLICATION
  // ===============================
  document.getElementById("applyGrayBtn")?.addEventListener("click", () => {
    localStorage.setItem("pendingBadgeType", "gray");
    window.location.href = "verify-badge.html";
  });

  document.getElementById("applyBlueBtn")?.addEventListener("click", () => {
    localStorage.setItem("pendingBadgeType", "blue");
    window.location.href = "verify-badge.html";
  });

  // ===============================
  // LOGOUT
  // ===============================
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
});
