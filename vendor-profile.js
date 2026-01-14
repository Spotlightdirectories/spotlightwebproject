document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ vendor-profile.js loaded");
  console.log("URL search:", window.location.search);

// ✅ Supabase setup
//now exist in supabase-client.js

const supabase = window.supabaseClient;

  // 1️⃣ CONSTANTS / CONFIG (TOP LEVEL)
  const TIER_CAPABILITIES = {
    basic: {
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

//helper function is the renderBadge

function renderBadge(status) {
  if (status === "blue") {
    return `
      <div class="badge-wrap" data-tooltip="Fully verified business. Identity and location confirmed.">
        <img src="images/bluebadge.png" alt="Fully verified" class="verification-badge">
      </div>
    `;
  }

  if (status === "gray") {
    return `
      <div class="badge-wrap" data-tooltip="Partially verified business. Verification in progress.">
        <img src="images/graybadge.png" alt="Partially verified" class="verification-badge">
      </div>
    `;
  }

  return "";
}



async function loadVendorProfile() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    console.error("❌ No vendor slug provided");
    return;
  }

  console.log("🔍 Loading vendor profile for slug:", slug);

  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error(
      "❌ Supabase fetch error:",
      error.message,
      error.details,
      error
    );
    return;
  }

  const vendor = data;

  // ✅ TIER CAPABILITY RESOLUTION (WAS MISSING)
  const plan = vendor.plan_tier;
  const caps = TIER_CAPABILITIES[plan];

  if (!caps) {
  console.error("❌ Unknown plan tier:", plan);
  return;
}

// 🧭 Tier-based section ordering
const aboutSection = document.getElementById("aboutSection");
const mediaSection = document.getElementById("mediaSection");
const contactSection = document.querySelector(".profile-section:last-of-type");

// Basic plan: About → Contact
if (plan === "basic") {
  mediaSection?.remove();
  aboutSection.after(contactSection);
}

// Paid plans: About → Media → Contact
else {
  aboutSection.after(mediaSection);
  mediaSection.after(contactSection);
}

  // ✅ HARD GATING (SEO-SAFE)
  if (!caps.media) {
    document.getElementById("mediaSection")?.remove();
  }

  // ✅ RENDER AFTER GATING
  renderVendorProfile(vendor);
}

  // 🚀 CALL IT
  loadVendorProfile();

  function renderVendorProfile(vendor) {

  // ===============================
  // OWNERSHIP CHECK
  // ===============================
  const isVendorOwner =
    window.currentUser &&
    vendor.auth_user_id === window.currentUser.id;

    // ===============================
// SEO META (DYNAMIC)
// ===============================
   document.title = `${vendor.name} – ${vendor.category} at ${vendor.address}`;

   const metaDesc = document.querySelector('meta[name="description"]');
   if (metaDesc) {
    metaDesc.setAttribute(
    "content",
    `${vendor.name} is a verified ${vendor.category} located at ${vendor.address}. Contact details, location, and services available on Spotlight.`
  );
 }

 // ===============================
// CANONICAL URL
// ===============================
  const canonical = document.getElementById("canonicalLink");
    if (canonical) {
   canonical.href = `${window.location.origin}/vendor-profile.html?slug=${vendor.slug}`;
 }

  // ===============================
  // HERO (PUBLIC CONTENT)
  // ===============================
  document.getElementById("vendorName").textContent = vendor.name;
  document.getElementById("vendorCategory").textContent = vendor.category;
  document.getElementById("vendorAddress").textContent = vendor.address;

  // ===============================
  // PLAN (VENDOR-ONLY)
  // ===============================
  const planEl = document.getElementById("vendorPlan");
  const planWrap = document.querySelector(".plan-label");

  if (isVendorOwner) {
    planEl.textContent = vendor.plan_tier;
    planWrap.classList.remove("hidden");
  } else {
    planWrap.remove(); // completely remove for public users
  }

  // ===============================
  // UPGRADE CTA (VENDOR-ONLY)
  // ===============================
  const upgradeSection = document.getElementById("upgradeCTA");
  const upgradeMessage = document.getElementById("upgradeMessage");

  if (
    isVendorOwner &&
    vendor.plan_tier !== "elite" &&
    vendor.plan_tier !== "custom"
  ) {
    upgradeSection.classList.remove("hidden");

    if (vendor.plan_tier === "basic") {
      upgradeMessage.textContent =
        "Upgrade to add photos, videos & social links to your profile.";
    }

    if (vendor.plan_tier === "standard") {
      upgradeMessage.textContent =
        "Upgrade to add longer videos, more branches & enhanced visibility.";
    }

    if (vendor.plan_tier === "enterprise") {
      upgradeMessage.textContent =
        "Upgrade to Elite for nationwide visibility and premium placement.";
    }
  } else {
    upgradeSection.remove();
  }

  // ===============================
  // BADGE (ALWAYS PUBLIC)
  // ===============================
  const badgeEl = document.getElementById("vendorBadge");
  badgeEl.classList.remove("badge-skeleton");
  badgeEl.innerHTML = renderBadge(vendor.verification_status);

  // ===============================
  // ACTIONS
  // ===============================
  if (vendor.phone) {
    document.getElementById("whatsappLink").href =
      `https://wa.me/${vendor.phone}`;
  }

  document.getElementById("mapLink").href =
    `https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}`;

  // ===============================
  // ABOUT
  // ===============================
  document.getElementById("vendorDescription").textContent =
    vendor.description || "This vendor has not added a description yet.";

  // ===============================
  // CONTACT
  // ===============================
  document.getElementById("vendorPhone").textContent =
    vendor.phone || "—";
  document.getElementById("vendorEmail").textContent =
    vendor.email || "—";


// ===============================
// OPEN GRAPH
// ===============================
document.querySelector('meta[property="og:title"]')
  ?.setAttribute("content", vendor.name);

document.querySelector('meta[property="og:description"]')
  ?.setAttribute(
    "content",
    `${vendor.name} – verified ${vendor.category} in ${vendor.address}`
  );

document.getElementById("ogUrl")
  ?.setAttribute(
    "content",
    `${window.location.origin}/vendor-profile.html?slug=${vendor.slug}`
  );


  // ===============================
  // MEDIA (TIER RULES)
  // ===============================
  handleTierMedia(vendor);
}


function handleTierMedia(vendor) {
  const mediaSection = document.getElementById("mediaSection");
  const galleryWrap = document.getElementById("galleryWrap");
  const videoWrap = document.getElementById("videoWrap");

  const tier = vendor.plan_tier;

  // -------------------------------
  // BASIC TIER — EMPTY STATE
  // -------------------------------
  if (tier === "basic") {
    mediaSection.classList.remove("hidden");
    mediaSection.innerHTML = `
      <h2>Media</h2>
      <p class="upgrade-placeholder">
        Upgrade your plan to showcase photos and videos.
      </p>
    `;
    return;
  }

  // -------------------------------
  // PAID TIERS
  // -------------------------------
  mediaSection.classList.remove("hidden");

  // Reset (important for re-renders)
  galleryWrap.classList.add("hidden");
  videoWrap.classList.add("hidden");
  galleryWrap.innerHTML = "";
  videoWrap.innerHTML = "";

  // -------------------------------
  // GALLERY (soft-capped)
  // -------------------------------
  if (Array.isArray(vendor.gallery_image_url) && vendor.gallery_image_url.length) {
    galleryWrap.classList.remove("hidden");

    galleryWrap.innerHTML = vendor.gallery_image_url
      .slice(0, 12) // soft cap for layout safety
      .map(img => `<img src="${img}" alt="Vendor gallery image">`)
      .join("");
  }

  // -------------------------------
  // VIDEO (tier-based duration)
  // -------------------------------
  if (vendor.promo_video_url) {
    let maxSeconds = 0;

    if (tier === "standard") maxSeconds = 20;
    if (tier === "enterprise") maxSeconds = 40;
    if (tier === "elite") maxSeconds = 60;
    if (tier === "custom") maxSeconds = 120;

    if (maxSeconds > 0) {
      videoWrap.classList.remove("hidden");
      videoWrap.innerHTML = `
        <video controls>
          <source src="${vendor.promo_video_url}" type="video/mp4">
        </video>
        <small>Max video length for this plan: ${maxSeconds}s</small>
      `;
    }
  }
}



});
