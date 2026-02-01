document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ vendor-profile.js loaded");

  const supabase = window.supabaseClient;

  // ===============================
  // RESOLVE CURRENT USER
  // ===============================
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const currentUser = session?.user || null;

  // ===============================
  // PLAN CAPABILITIES
  // ===============================
  const TIER_CAPABILITIES = {
    free: { media: false },
    standard: { media: true },
    enterprise: { media: true },
    elite: { media: true },
    custom: { media: true }
  };

  // ===============================
  // BADGE RENDERER
  // ===============================
  function renderBadge(status) {
    if (!status) return "";
    if (status === "blue") {
      return `<img src="images/bluebadge.png" class="verification-badge">`;
    }
    if (status === "gray") {
      return `<img src="images/graybadge.png" class="verification-badge">`;
    }
    return "";
  }

  // ===============================
  // LOAD VENDOR
  // ===============================
  async function loadVendorProfile() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");

    let vendor = null;

    if (slug) {
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      vendor = data;
    }

    // fallback: owner profile
    if (!vendor && currentUser) {
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .eq("auth_user_id", currentUser.id)
        .maybeSingle();
      vendor = data;
    }

    if (!vendor) {
      console.error("❌ Vendor not found");
      return;
    }

    renderVendorProfile(vendor);
  }

  // ===============================
  // RENDER PROFILE
  // ===============================
  function renderVendorProfile(vendor) {
    const isOwner =
      currentUser &&
      vendor.auth_user_id === currentUser.id;

    // -------------------------------
    // HERO
    // -------------------------------
    const nameEl = document.getElementById("vendorName");
    if (nameEl) nameEl.textContent = vendor.name || "";

    const categoryEl = document.getElementById("vendorCategory");
    if (categoryEl) {
      categoryEl.textContent =
        [vendor.category, vendor.subcategory]
          .filter(Boolean)
          .join(" • ");
    }

    const addressEl = document.getElementById("vendorAddress");
    if (addressEl) addressEl.textContent = vendor.address || "";

    // -------------------------------
    // LOGO & COVER
    // -------------------------------
    const logo = document.getElementById("vendorLogo");
    if (logo && vendor.logo_url) logo.src = vendor.logo_url;

    const cover = document.getElementById("vendorCover");
    if (cover && vendor.cover_url) cover.src = vendor.cover_url;

    // -------------------------------
    // BADGE
    // -------------------------------
    const badgeEl = document.getElementById("vendorBadge");
    if (badgeEl) badgeEl.innerHTML = renderBadge(vendor.verification_status);

    // -------------------------------
    // CONTACT
    // -------------------------------
    const whatsapp = document.getElementById("whatsappLink");
    if (whatsapp && vendor.phone) {
      whatsapp.href = `https://wa.me/${vendor.phone}`;
      whatsapp.style.pointerEvents = "auto";
    }

    const map = document.getElementById("mapLink");

    if (map) {
     if (vendor.latitude && vendor.longitude) {
    // Preferred: coordinates
       map.href = `https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}`;
     } else if (vendor.address) {
    // Fallback: address (same as public profile)
       map.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address)}`;
     } else {
       map.href = "#";
    }

     map.style.pointerEvents = "auto";
    }


    // -------------------------------
    // ABOUT
    // -------------------------------
    const desc = document.getElementById("vendorDescription");
    if (desc) desc.textContent = vendor.description || "";

    // -------------------------------
    // MEDIA
    // -------------------------------
    const mediaSection = document.getElementById("mediaSection");
    if (mediaSection) {
      mediaSection.classList.toggle(
        "hidden",
        !TIER_CAPABILITIES[vendor.plan_tier]?.media
      );
    }

    // -------------------------------
    // UPGRADE CTA (FREE + OWNER ONLY)
    // -------------------------------
    const upgradeSection = document.getElementById("upgradeCTA");
    const upgradeMessage = document.getElementById("upgradeMessage");

    if (upgradeSection && upgradeMessage) {
      if (isOwner && vendor.plan_tier === "free") {
        upgradeSection.style.display = "flex";
        upgradeMessage.textContent =
          "Upgrade your profile to make it editable to add photos, videos, gallery and boost visibility.";
      } else {
        upgradeSection.style.display = "none";
      }
    }
  }

  loadVendorProfile();
});
