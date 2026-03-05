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
  return `
    <span class="badge-wrap" data-tooltip="Verified Business — official business documents reviewed by Spotlight. This vendor operates a registered and credible business..">
      <img src="images/bluebadge.png" class="verification-badge">
    </span>
  `;
}

  if (status === "gray") {
    return `
      <span class="badge-wrap" data-tooltip="Identity Verified — business owner identity confirmed">
        <img src="images/graybadge.png" class="verification-badge">
      </span>
    `;
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

    // ===============================
    // CHECK PRELOADED VENDOR
    // ===============================

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

    console.log("FULL VENDOR OBJECT:", vendor);  // 👈 ADD THIS LINE HERE

    const isOwner = 
      currentUser &&
      vendor.auth_user_id === currentUser.id;

      const isFree = vendor.plan_tier === "free";
      const isPaid = !isFree;

    // -------------------------------
    // HERO
    // -------------------------------
    const nameEl = document.getElementById("vendorName");
    if (nameEl) nameEl.textContent = vendor.name || "";

    const categoryEl = document.getElementById("vendorCategory");
    if (categoryEl) {
      const category = vendor.category || "";
      const subcategory = vendor.subcategory || "";

    if (category && subcategory) {
      categoryEl.innerHTML = `${category} • <strong>${subcategory}</strong>`;
     } else {
      categoryEl.textContent = category || subcategory;
    }
    }

    const addressEl = document.getElementById("vendorAddress");
    if (addressEl) addressEl.textContent = vendor.address || "";

    // -------------------------------
    // LOGO & COVER
    // -------------------------------
 
const logo = document.getElementById("vendorLogo");
if (logo) {
  if (vendor.logo_url) {
    logo.src = vendor.logo_url + "?t=" + new Date().getTime();
    logo.style.display = "block";
  } else {
    logo.style.display = "none";
  }
}

const logoWrap = document.querySelector(".logo-wrap");

if (logoWrap) {
  // Remove any existing placeholder first
  const existing = logoWrap.querySelector(".logo-placeholder");
  if (existing) existing.remove();

  if (isOwner && !vendor.logo_url) {
    const placeholder = document.createElement("div");
    placeholder.className = "logo-placeholder";
    placeholder.innerHTML = `
      112 × 112px<br>
      Max size: 1MB<br>
      JPG, PNG, WEBP
    `;
    logoWrap.appendChild(placeholder);
  }
}



const cover = document.getElementById("vendorCover");
if (cover) {
  if (vendor.cover_url) {
    cover.src = vendor.cover_url + "?t=" + new Date().getTime();
    cover.style.display = "block";
  } else {
    cover.style.display = "none";
  }
}

const coverPlaceholder = document.getElementById("coverPlaceholder");
if (coverPlaceholder) {
  if (isOwner && !vendor.cover_url) {
    coverPlaceholder.style.display = "flex";
  } else {
    coverPlaceholder.style.display = "none";
  }
}

    // -------------------------------
    // BADGE
    // -------------------------------
    const badgeEl = document.getElementById("vendorBadge");
    if (badgeEl) badgeEl.innerHTML = renderBadge(vendor.verification_status);

    // -------------------------------
    // CONTACT
    // -------------------------------
    const whatsapp = document.getElementById("whatsappLink");
    if (whatsapp) {
    if (vendor.whatsapp) {
      whatsapp.href = `https://wa.me/${vendor.whatsapp}`;
      whatsapp.style.display = "inline-block";
    } else {
      whatsapp.style.display = "none";
    }
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
    // -------------------------------
    // OWNER MODE — Enable Branding Upload
    // -------------------------------
    if (isOwner) {
  const coverLabel = document.getElementById("coverUploadLabel");
  const logoLabel = document.getElementById("logoUploadLabel");
  const coverInput = document.getElementById("coverInput");
  const logoInput = document.getElementById("logoInput");

  if (coverLabel) coverLabel.classList.remove("hidden");
  if (logoLabel) logoLabel.classList.remove("hidden");

  // COVER UPLOAD
  if (coverInput) {
    coverInput.addEventListener("change", async (e) => {
      console.log("Cover input triggered");
      const file = e.target.files[0];
      if (!file) return;

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
      alert("Only JPG, PNG or WEBP images allowed.");
      return;
    }

    // 1MB file size limit
    if (file.size > 1024 * 1024) {
       alert("Cover image must be less than 1MB.");
       return;
    }

      const filePath = `${currentUser.id}/cover`;

      console.log("Cover filePath being used:", filePath);

      // Step 1: Remove existing cover (if any)
      const { data: removeData, error: removeError } =
      await supabase.storage
        .from("vendor-branding")
        .remove([filePath]);

     console.log("Remove Result:", removeData);
     console.log("Remove Error:", removeError);

      // Step 2: Upload new cover
     const { error } = await supabase.storage
       .from("vendor-branding")
       .upload(filePath, file);

      if (error) {
        console.error("Storage Upload Error:", error.message);
        return;
      }

      const { data } = supabase.storage
        .from("vendor-branding")
        .getPublicUrl(filePath);

        console.log("Public URL:", data.publicUrl);
        console.log("Current User ID:", currentUser?.id);
        console.log("Vendor auth_user_id:", vendor.auth_user_id);

      await supabase
        .from("vendors")
        .update({ cover_url: data.publicUrl })
        .eq("id", vendor.id);

        console.log("Updated cover_url in DB");

      vendor.cover_url = data.publicUrl;
      document.getElementById("vendorCover").src =
      data.publicUrl + "?t=" + new Date().getTime();
      document.getElementById("vendorCover").style.display = "block";
    });
  }
  // LOGO UPLOAD
if (logoInput) {
  logoInput.addEventListener("change", async (e) => {
    console.log("Logo input triggered");

    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Only JPG, PNG or WEBP images allowed.");
      return;
    }

    // 1MB size limit
    if (file.size > 1024 * 1024) {
      alert("Logo image must be less than 1MB.");
      return;
    }

    const filePath = `${currentUser.id}/logo`;

    // Remove existing logo
    await supabase.storage
      .from("vendor-branding")
      .remove([filePath]);

    // Upload new logo
    const { error } = await supabase.storage
      .from("vendor-branding")
      .upload(filePath, file);

    if (error) {
      console.error("Logo Upload Error:", error.message);
      return;
    }

    const { data } = supabase.storage
      .from("vendor-branding")
      .getPublicUrl(filePath);

    // Update database
    await supabase
      .from("vendors")
      .update({ logo_url: data.publicUrl })
      .eq("id", vendor.id);

    // Update UI immediately (cache-busted)
    const logoImg = document.getElementById("vendorLogo");
    if (logoImg) {
      logoImg.src = data.publicUrl + "?t=" + new Date().getTime();
      logoImg.style.display = "block";
    }

    // Hide placeholder
    const logoPlaceholder = document.getElementById("logoPlaceholder");
    if (logoPlaceholder) {
      logoPlaceholder.style.display = "none";
    }
  });
  }
 }
}

  loadVendorProfile();
});
