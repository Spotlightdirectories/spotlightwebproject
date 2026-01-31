document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ vendor-profile.js loaded");

  
  // ===============================
  // SUPABASE
  // ===============================
  const supabase = window.supabaseClient;

  // ===============================
  // RESOLVE CURRENT USER (OWNER CHECK)
  // ===============================
  const {
    data: { session }
  } = await supabase.auth.getSession();

  window.currentUser = session?.user || null;

  // ===============================
  // PLAN CAPABILITIES (BLUEPRINT)
  // ===============================
  const TIER_CAPABILITIES = {
    free: {
      about: true,
      media: false,
      videoSeconds: 0,
      gallery: false,
      socialLinks: 0
    },
    standard: {
      about: true,
      media: true,
      videoSeconds: 20,
      gallery: true,
      socialLinks: 2
    },
    enterprise: {
      about: true,
      media: true,
      videoSeconds: 40,
      gallery: true,
      socialLinks: 3
    },
    elite: {
      about: true,
      media: true,
      videoSeconds: 60,
      gallery: true,
      socialLinks: 5
    },
    custom: {
      about: true,
      media: true,
      videoSeconds: 120,
      gallery: true,
      socialLinks: 999
    }
  };

  // ===============================
  // BADGE RENDERER (SINGLE SOURCE)
  // ===============================
  function renderBadge(status) {

    if (!status) return "";

    const value = status.toString().toLowerCase();

    if (value === "blue") {
      return `
        <div class="badge-wrap" data-tooltip="Fully verified business. This means business identity, address, and phone have been verified.">
          <img src="images/bluebadge.png" class="verification-badge" />
        </div>
      `;
    }

    if (value === "gray") {
      return `
        <div class="badge-wrap" data-tooltip="Partially verified business. This means some business details have been verified, but not all.">
          <img src="images/graybadge.png" class="verification-badge" />
        </div>
      `;
    }

    return "";
  }

  // ===============================
  // LOAD VENDOR PROFILE
  // ===============================
  async function loadVendorProfile() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");

    if (!slug || slug === "null") {
  console.error("❌ Invalid vendor slug:", slug);
  return;
}


    const { data: vendor, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !vendor) {
      console.error("❌ Vendor fetch failed", error);
      return;
    }

    renderVendorProfile(vendor);
  }

  // ===============================
  // RENDER PROFILE
  // ===============================
  function renderVendorProfile(vendor) {
      console.log("🔍 CTA DEBUG START");
  console.log("Logged-in user:", window.currentUser);
  console.log("Vendor auth_user_id:", vendor.auth_user_id);
  console.log("Current user id:", window.currentUser?.id);
  console.log("Vendor plan_tier (raw):", vendor.plan_tier);
  console.log("Is free vendor:", vendor.plan_tier === "free");

    const isVendorOwner =
      !!window.currentUser &&
      vendor.auth_user_id === window.currentUser.email;


  console.log("Is vendor owner:", isVendorOwner);

    const caps = TIER_CAPABILITIES[vendor.plan_tier];

     if (!caps) {
    console.warn("Unknown plan tier:", vendor.plan_tier);
  }
    if (!TIER_CAPABILITIES[vendor.plan_tier]) {
       console.warn("Unknown plan tier:", vendor.plan_tier);
  }


    // -------------------------------
    // HERO
    // -------------------------------
    document.getElementById("vendorName").textContent = vendor.name;
    document.getElementById("vendorCategory").textContent = vendor.category;
    document.getElementById("vendorAddress").textContent = vendor.address;

    const logoImg = document.getElementById("vendorLogo");
    if (vendor.logo_url) {
      logoImg.src = vendor.logo_url;
      logoImg.style.display = "block";
    } else {
      logoImg.style.display = "none";
    }

    const coverImg = document.getElementById("vendorCover");
    if (vendor.cover_url) {
      coverImg.src = vendor.cover_url;
      coverImg.style.display = "block";
    } else {
      coverImg.style.display = "none";
    }

    // -------------------------------
    // BADGE (PUBLIC)
    // -------------------------------
    const badgeEl = document.getElementById("vendorBadge");
    if (badgeEl) {
      badgeEl.classList.remove("badge-skeleton");
      badgeEl.innerHTML = renderBadge(vendor.verification_status);
    }

    // -------------------------------
    // CONTACT
    // -------------------------------
    document.getElementById("vendorPhone").textContent =
      vendor.phone || "—";
    document.getElementById("vendorEmail").textContent =
      vendor.email || "—";

    if (vendor.phone) {
      document.getElementById("whatsappLink").href =
        `https://wa.me/${vendor.phone}`;
    }

    if (vendor.latitude && vendor.longitude) {
      document.getElementById("mapLink").href =
        `https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}`;
    }

    // -------------------------------
    // ABOUT
    // -------------------------------
    document.getElementById("vendorDescription").textContent =
      vendor.description || "This vendor has not added a description yet.";

    // -------------------------------
    // MEDIA (TIER-AWARE) — FIXED
    // -------------------------------
    const mediaSection = document.getElementById("mediaSection");
    const galleryWrap = document.getElementById("galleryWrap");
    const videoWrap = document.getElementById("videoWrap");

    if (!caps.media) {
      mediaSection.classList.add("hidden");
    } else {
      mediaSection.classList.remove("hidden");

      if (
        Array.isArray(vendor.gallery_image_url) &&
        vendor.gallery_image_url.length
      ) {
        galleryWrap.classList.remove("hidden");
        galleryWrap.innerHTML = vendor.gallery_image_url
          .slice(0, 12)
          .map(img => `<img src="${img}" />`)
          .join("");
      } else {
        galleryWrap.classList.add("hidden");
      }

      if (vendor.promo_video_url) {
        videoWrap.classList.remove("hidden");
        videoWrap.innerHTML = `
          <video controls>
            <source src="${vendor.promo_video_url}" type="video/mp4" />
          </video>
          <small>Max video length: ${caps.videoSeconds}s</small>
        `;
      } else {
        videoWrap.classList.add("hidden");
      }
    }
// -------------------------------
// UPGRADE CTA (FREE + OWNER ONLY)
// -------------------------------

const upgradeSection = document.getElementById("upgradeCTA");
const upgradeMessage = document.getElementById("upgradeMessage");

if (upgradeSection && upgradeMessage) {
  const isVendorOwner =
    !!window.currentUser &&
    !!vendor.auth_user_id &&
    vendor.auth_user_id === window.currentUser.id;

  const isFreeVendor = vendor.plan_tier === "free";

  if (isVendorOwner && isFreeVendor) {
    upgradeSection.classList.remove("hidden");
    upgradeMessage.textContent =
      "Upgrade your profile to add photos, videos, and boost visibility.";
  } else {
    upgradeSection.classList.add("hidden");
  }
}


  }

  // ===============================
  // INIT
  // ===============================
  loadVendorProfile();
});
