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
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

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
  document.getElementById("subscriptionStatus").textContent = vendor.subscription_status;
  document.getElementById("verificationStatus").textContent =
    vendor.verification_status || "Not verified";
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
     .eq("status", "approved")
     .order("approved_at", { ascending: false })
     .limit(1)
     .single();

  document.getElementById("priceInfo").textContent =
    payment?.amount ? `₦${(payment.amount / 100).toLocaleString()}` : "—";

   document.getElementById("startDate").textContent =
     vendor.paid_at ? new Date(vendor.paid_at).toLocaleDateString() : "—";
   
   document.getElementById("nextBilling").textContent =
    vendor.billing_cycle === "monthly"
      ? "1 month after payment"
      : vendor.billing_cycle === "yearly"
      ? "1 year after payment"
      : "—";

  document.getElementById("upgradeBtn").addEventListener("click", () => {
    window.location.href = "getlisted.html";
  });

  // ===============================
  // MEDIA (Premium Only)
  // ===============================
  const mediaSection = document.getElementById("mediaSection");

  if (!isFree && isActive) {
    mediaSection.classList.remove("hidden");
  }

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
