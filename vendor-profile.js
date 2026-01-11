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
    return `<img src="images/bluebadge.png" alt="Fully verified" class="verification-badge">`;
  }
  if (status === "gray") {
    return `<img src="images/graybadge.png" alt="Partially verified" class="verification-badge">`;
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
 
    // HERO
  document.getElementById("vendorName").textContent = vendor.name;
  document.getElementById("vendorCategory").textContent = vendor.category;
  document.getElementById("vendorAddress").textContent = vendor.address;
  document.getElementById("vendorPlan").textContent = vendor.plan_tier;

  document.getElementById("vendorBadge").innerHTML =
    renderBadge(vendor.verification_status);

  // ACTIONS
  if (vendor.phone) {
    document.getElementById("whatsappLink").href = `https://wa.me/${vendor.phone}`;
  }

  document.getElementById("mapLink").href =
    `https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}`;

  // ABOUT
  document.getElementById("vendorDescription").textContent =
    vendor.description || "No description provided.";

  // CONTACT
  document.getElementById("vendorPhone").textContent = vendor.phone || "—";
  document.getElementById("vendorEmail").textContent = vendor.email || "—";

  // MEDIA (TIER RULES)
  handleTierMedia(vendor);

}

function handleTierMedia(vendor) {
  const mediaSection = document.getElementById("mediaSection");
  const galleryWrap = document.getElementById("galleryWrap");
  const videoWrap = document.getElementById("videoWrap");

  const tier = vendor.plan_tier;

  if (tier === "basic") return;

  mediaSection.classList.remove("hidden");

  // Gallery
  if (vendor.gallery_image_url?.length) {
    galleryWrap.classList.remove("hidden");

    galleryWrap.innerHTML = vendor.gallery_image_url
      .map(img => `<img src="${img}" alt="">`)
      .join("");
  }

  // Video limits
  if (vendor.promo_video_url) {
    let maxSeconds = 0;

    if (tier === "standard") maxSeconds = 20;
    if (tier === "enterprise") maxSeconds = 40;
    if (tier === "elite" || tier === "custom") maxSeconds = 60;

    videoWrap.classList.remove("hidden");
    videoWrap.innerHTML = `
      <video controls>
        <source src="${vendor.promo_video_url}" type="video/mp4">
      </video>
      <small>Max video length: ${maxSeconds}s</small>
    `;
  }
}


});
