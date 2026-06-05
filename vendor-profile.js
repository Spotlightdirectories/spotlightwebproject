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

  let showAllReviews =
  false;

  // ===============================
  // PLAN CAPABILITIES
  // ===============================
  const TIER_CAPABILITIES = {
    free: { media: true },
    standard: { media: true },
    enterprise: { media: true },
    elite: { media: true },
    custom: { media: true }
  };

  const SOCIAL_LIMITS = {
    free: 1,
    standard: 2,
    enterprise: 3,
    elite: 5,
    custom: Infinity
  };

  const BRANCH_LIMITS = {
  free: 0,
  standard: 1,
  enterprise: 10,
  elite: 30,
  custom: Infinity
};

  const VIDEO_LIMITS = {
  free: { allowed: false, maxDuration: 0, maxSize: 0 },
  standard: { allowed: true, maxDuration: 30, maxSize: 8 * 1024 * 1024 },
  enterprise: { allowed: true, maxDuration: 60, maxSize: 12 * 1024 * 1024 },
  elite: { allowed: true, maxDuration: 90, maxSize: 18 * 1024 * 1024 },
  custom: { allowed: true, maxDuration: 120, maxSize: 24 * 1024 * 1024 }
};

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

    const isOwner = 
      currentUser &&
      vendor.auth_user_id === currentUser.id;

      vendor.plan_tier = getSafePlanTier(vendor.plan_tier);

// ===============================
// TRIAL STATE
// ===============================
let trial_active = false;
let trial_expired = false;

if (vendor.plan_tier === "free" && vendor.trial_started_at) {

  const start = new Date(vendor.trial_started_at);
  const now = new Date();

  const diffDays = Math.floor(
    (now - start) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 90) {
    trial_active = true;
  } else {
    trial_expired = true;
  }

}

// ===============================
// EFFECTIVE LIMITS (PLAN + TRIAL)
// ===============================
let effectiveSocialLimit = 0;
let effectiveGalleryLimit = 0;

if (vendor.plan_tier === "free") {

  if (trial_active) {
    effectiveSocialLimit = 1;
    effectiveGalleryLimit = 3;
  }

  if (trial_expired) {
    effectiveSocialLimit = 0;
    effectiveGalleryLimit = 1;
  }

} else {
  effectiveSocialLimit = SOCIAL_LIMITS[vendor.plan_tier] ?? 0;

  const GALLERY_LIMITS = {
    free: 3,
    standard: 6,
    enterprise: 12,
    elite: 24,
    custom: 24
  };

  effectiveGalleryLimit = GALLERY_LIMITS[vendor.plan_tier] ?? 0;
}

      const isFree = vendor.plan_tier === "free";
      const isPaid = !isFree;

      const galleryInput = document.getElementById("galleryInput");

      const videoInput = document.getElementById("videoInput");
      const videoPlayer = document.getElementById("vendorVideo");
      const videoUploader = document.getElementById("videoUploader");

      const videoNote = document.getElementById("videoPlanNote");

if (videoNote) {

  const limits = VIDEO_LIMITS[vendor.plan_tier];

  if (limits.allowed) {

    const sizeMB = limits.maxSize / (1024 * 1024);

    videoNote.textContent =
      `MP4 only • Max ${limits.maxDuration}s • Max size ${sizeMB}MB`;

  } else {

    videoNote.textContent =
      "Video upload not available on this plan.";

  }

}

if (galleryInput) {

galleryInput.addEventListener("change", async (e) => {

let file = e.target.files[0];
if (!file) return;

// ===============================
// RESIZE + COMPRESS IMAGE
// ===============================
const img = document.createElement("img");
img.src = URL.createObjectURL(file);

await new Promise(resolve => {
  img.onload = resolve;
});

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

// MAX SIZE
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;

let width = img.width;
let height = img.height;

// Maintain aspect ratio
if (width > height) {
  if (width > MAX_WIDTH) {
    height *= MAX_WIDTH / width;
    width = MAX_WIDTH;
  }
} else {
  if (height > MAX_HEIGHT) {
    width *= MAX_HEIGHT / height;
    height = MAX_HEIGHT;
  }
}

canvas.width = width;
canvas.height = height;

ctx.drawImage(img, 0, 0, width, height);

// COMPRESS
const blob = await new Promise(resolve =>
  canvas.toBlob(resolve, "image/jpeg", 0.7)
);

// Replace file
file = new File([blob], `optimized-${Date.now()}.jpg`, {
  type: "image/jpeg"
});


// ===============================
// ENFORCE GALLERY LIMIT
// ===============================
const limit = effectiveGalleryLimit;

const { data: existingImages } = await supabase
  .from("vendor_media")
  .select("id")
  .eq("vendor_id", vendor.id)
  .eq("media_type", "image");

if (existingImages && existingImages.length >= limit) {
  alert("You have reached the maximum number of images allowed for your plan.");
  return;
}

       // file type validation
           const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
           if (!allowedTypes.includes(file.type)) {
           alert("Only JPG, PNG or WEBP images allowed.");
           return;
          }

        // 750KB size limit
           if (file.size > 750 * 1024) {
           alert("Image must be less than 750KB.");
           return;
          }

          // ===============================
// INSTANT PREVIEW (UX IMPROVEMENT)
// ===============================
const previewUrl = URL.createObjectURL(file);

const grid = document.getElementById("galleryGrid");
if (grid) {
  const previewItem = document.createElement("div");
  previewItem.className = "gallery-item";

  const previewImg = document.createElement("img");
  previewImg.src = previewUrl;
  previewImg.style.opacity = "0.5";

  previewItem.appendChild(previewImg);
  grid.prepend(previewItem);
}

           const fileName = `${Date.now()}-${file.name}`;
           const filePath = `${vendor.id}/gallery/${fileName}`;

         // upload to storage
        const { error: uploadError } = await supabase.storage
          .from("vendor-branding")
          .upload(filePath, file);

          if (uploadError) {
          console.error("Upload error:", uploadError.message);
          alert("Upload failed.");
          return;
          }


          const { data } = supabase.storage
           .from("vendor-branding")
           .getPublicUrl(filePath);

    // save record in vendor_media
        // GET CURRENT MAX ORDER
const { data: existing } = await supabase
  .from("vendor_media")
  .select("display_order")
  .eq("vendor_id", vendor.id)
  .order("display_order", { ascending: false })
  .limit(1);

const nextOrder = existing && existing.length > 0
  ? existing[0].display_order + 1
  : 1;

const { error: dbError } = await supabase
  .from("vendor_media")
  .insert({
    vendor_id: vendor.id,
    media_type: "image",
    file_url: data.publicUrl,
    display_order: nextOrder
  });

    if (dbError) {
      console.error("DB error:", dbError.message);
      return;
    }

    await loadGallery();

  });

}

if (videoInput) {

  videoInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    videoInput.disabled = true;

    if (file.type !== "video/mp4") {
     alert("Only MP4 videos are allowed.");
     videoInput.disabled = false;
     return;
    }

    const limits = VIDEO_LIMITS[vendor.plan_tier];

    if (!limits.allowed) {
      alert("Your current plan does not allow video upload.");
      return;
    }

    if (file.size > limits.maxSize) {
      alert("Video file exceeds the maximum size allowed for your plan.");
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";

video.src = URL.createObjectURL(file);

await new Promise((resolve) => {
  video.onloadedmetadata = resolve;
});

if (video.duration > limits.maxDuration) {
  alert("Video duration exceeds the maximum allowed for your plan.");
  return;
}
 // remove existing vendor video
  const { data: existingVideos } = await supabase
  .from("vendor_media")
  .select("*")
  .eq("vendor_id", vendor.id)
  .eq("media_type", "video");

if (existingVideos && existingVideos.length > 0) {

  const oldVideo = existingVideos[0];

  const oldPath = oldVideo.file_url.includes("/vendor-videos/")
  ? oldVideo.file_url.split("/vendor-videos/")[1]
  : null;

  if (!oldPath) {
  console.error("Invalid video file path:", oldVideo.file_url);
  return;
  }

  await supabase.storage
  .from("vendor-videos")
  .remove([oldPath]);

  await supabase
    .from("vendor_media")
    .delete()
    .eq("id", oldVideo.id);
   }

   const videoFileName = `video-${Date.now()}.mp4`;
   const videoPath = `${vendor.id}/video/${videoFileName}`;

   const { error: uploadError } = await supabase.storage
     .from("vendor-videos")
     .upload(videoPath, file);

   if (uploadError) {
     console.error("Video upload error:", uploadError.message);
     alert("Video upload failed.");
     videoInput.disabled = false;
     return;
   }

   const { data: videoData } = supabase.storage
  .from("vendor-videos")
  .getPublicUrl(videoPath);

const { error: videoDbError } = await supabase
  .from("vendor_media")
  .insert({
    vendor_id: vendor.id,
    media_type: "video",
    file_url: videoData.publicUrl,
    display_order: Math.floor(Date.now() / 1000)
  });

if (videoDbError) {
  console.error("Video DB error:", videoDbError.message);
  videoInput.disabled = false;
  return;
}

await loadVideo();
videoInput.value = "";
videoInput.disabled = false;

  });

}

      const galleryUploader = document.getElementById("galleryUploader");

      
     if (galleryUploader && isOwner && TIER_CAPABILITIES[vendor.plan_tier].media) {
        galleryUploader.classList.remove("hidden");
    }

    const videoLimits = VIDEO_LIMITS[vendor.plan_tier];

    if (videoUploader && isOwner && videoLimits.allowed) {
      videoUploader.classList.remove("hidden");
    }

     if (isFree && galleryInput) {
     galleryInput.disabled = false;
    }

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
  categoryEl.innerHTML = `
    <span class="cat">${category}</span>
    <span class="dot"> • </span>
    <span class="subcat"><strong>${subcategory}</strong></span>
    `;
   } else {
      categoryEl.textContent = category || subcategory;
   }
  }

  const reviewSummary =
  document.getElementById(
    "vendorReviewSummary"
  );

if (reviewSummary) {

  const averageRating =
    Number(
      vendor.average_rating || 0
    ).toFixed(1);

  const reviewsCount =
    Number(
      vendor.reviews_count || 0
    );

  const viewAllReviewsBtn =
  document.getElementById(
    "viewAllReviewsBtn"
  );

if (
  viewAllReviewsBtn
) {

  viewAllReviewsBtn.style.display =
    reviewsCount > 3
      ? "block"
      : "none";

}

reviewSummary.innerHTML =
  `
  <span class="review-star">
    ★
  </span>

  <span class="review-rating-text">
    ${averageRating} (${reviewsCount})
  </span>
  `;

}

const reviewsSummary =
  document.getElementById(
    "reviewsSummary"
  );

if (reviewsSummary) {

  const averageRating =
    Number(
      vendor.average_rating || 0
    );

  const reviewsCount =
    Number(
      vendor.reviews_count || 0
    );

const fullStars =
  Math.floor(
    averageRating
  );

const partialStar =
  averageRating -
  fullStars;

let starsHtml = "";

for (
  let i = 0;
  i < 5;
  i++
) {

  if (
    i < fullStars
  ) {

    starsHtml +=
      `
      <span
        class="star-full"
      >
        ★
      </span>
      `;

  } else if (
  i === fullStars &&
  partialStar > 0
) {

  starsHtml +=
    `
    <span
      class="star-partial"
      data-fill="${
        Math.round(
          partialStar * 100
        )
      }"
    >
      <span
        class="star-empty"
      >
        ★
      </span>

      <span
        class="star-fill"
      >
        ★
      </span>
    </span>
    `;

  } else {

    starsHtml +=
      `
      <span
        class="star-empty"
      >
        ★
      </span>
      `;

  }

}

reviewsSummary.innerHTML =
  `
  <span
    class="reviews-stars"
  >
    ${starsHtml}
  </span>

  <span
    class="review-rating-text"
  >
    ${averageRating.toFixed(1)}
    (${reviewsCount} Reviews)
  </span>
  `;

const partialStars =
  reviewsSummary.querySelectorAll(
    ".star-partial"
  );

partialStars.forEach(
  star => {

    const fill =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            star.dataset.fill || 0
         )
       )
     );

    const fillStar =
      star.querySelector(
        ".star-fill"
      );

    if (
      fillStar
    ) {

      fillStar.style.width =
        `${fill}%`;

    }

  }
);

}

const rateVendorBtn =
  document.getElementById(
    "rateVendorBtn"
  );

if (
  rateVendorBtn &&
  window.ReviewsUtils
) {

  rateVendorBtn.addEventListener(
    "click",
    () => {

      window.ReviewsUtils
        .openReviewModal(
          vendor.id
        );

    }
  );

}

const viewAllReviewsBtn =
  document.getElementById(
    "viewAllReviewsBtn"
  );

if (
  viewAllReviewsBtn
) {

  viewAllReviewsBtn.textContent =
    showAllReviews
      ? "Show Less"
      : "View all reviews";

  viewAllReviewsBtn.onclick =
    async () => {

      showAllReviews =
        !showAllReviews;

      viewAllReviewsBtn.textContent =
        showAllReviews
          ? "Show Less"
          : "View all reviews";

      await loadRecentReviews(
        vendor.id
      );

    };

}

const reviewsList =
  document.getElementById(
    "reviewsList"
  );

const similarBusinessesList =
  document.getElementById(
    "similarBusinessesList"
  );

if (
  reviewsList
) {

  reviewsList.innerHTML =
    "";

  loadRecentReviews(
    vendor.id
  );

}

if (
  similarBusinessesList
) {

  similarBusinessesList.innerHTML =
    `
    <div class="similar-business-placeholder">
      Similar businesses will appear here.
    </div>
    `;

  loadSimilarBusinesses(
    vendor
  );

}

    const addressEl = document.getElementById("vendorAddress");
    if (addressEl) addressEl.textContent = vendor.address || "";

// -------------------------------
// LOGO & COVER
// -------------------------------

const cover = document.getElementById("vendorCover");
const logo = document.getElementById("vendorLogo");

const coverPlaceholder = document.getElementById("coverPlaceholder");
const logoPlaceholder = document.getElementById("logoPlaceholder");

const deleteCoverBtn = document.getElementById("deleteCoverBtn");
const deleteLogoBtn = document.getElementById("deleteLogoBtn");

function renderBranding() {

if (cover) {

  if (vendor.cover_url) {

    cover.style.opacity = "0.3";
    cover.src = vendor.cover_url;

    cover.onload = () => {
      cover.style.opacity = "1";
    };

    cover.style.display = "block";

  } else {
    cover.removeAttribute("src");
    cover.style.display = "none";
  }

}

  if (coverPlaceholder) {
    coverPlaceholder.style.display =
      isOwner && !vendor.cover_url ? "flex" : "none";
  }

  if (deleteCoverBtn) {
    deleteCoverBtn.style.display =
      isOwner && vendor.cover_url ? "flex" : "none";
  }

  if (logo) {

      if (vendor.logo_url) {

      logo.style.opacity = "0.3";
      logo.src = vendor.logo_url;

      logo.onload = () => {
      logo.style.opacity = "1";
     };

      logo.style.display = "block";
     } else {
      logo.removeAttribute("src");
      logo.style.display = "none";
    }

  }

  if (logoPlaceholder) {
    logoPlaceholder.style.display =
      isOwner && !vendor.logo_url ? "flex" : "none";
  }

  if (deleteLogoBtn) {
    deleteLogoBtn.style.display =
      isOwner && vendor.logo_url ? "flex" : "none";
  }

}

renderBranding();


    // -------------------------------
    // BADGE
    // -------------------------------
    const badgeEl = document.getElementById("vendorBadge");
    if (badgeEl) {
       badgeEl.classList.remove("badge-skeleton");
        badgeEl.innerHTML = renderBadge(vendor.verification_status);
   }

    // -------------------------------
    // CONTACT
    // -------------------------------
    const phoneEl = document.getElementById("vendorPhone");
if (phoneEl) phoneEl.textContent = vendor.phone || vendor.whatsapp || "";

const emailEl = document.getElementById("vendorEmail");
if (emailEl) emailEl.textContent = vendor.email || "";

const addressDetail = document.getElementById("vendorAddressDetail");
if (addressDetail) addressDetail.textContent = vendor.address || "";


    const whatsapp = document.getElementById("whatsappLink");
    if (whatsapp) {
    if (vendor.whatsapp) {
      whatsapp.href = `https://wa.me/${vendor.whatsapp}`;
      whatsapp.style.display = "inline-block";
    } else {
      whatsapp.style.display = "none";
    }
  }

  const callLink = document.getElementById("callLink");

if (callLink) {

  const phoneNumber =
    vendor.phone || vendor.whatsapp;

  if (phoneNumber) {

    callLink.href =
      `tel:${phoneNumber}`;

  } else {

    callLink.style.display =
      "none";

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

    function applyFormat(command) {
  const selection = window.getSelection();

  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);

  if (command === "bold") {
    const strong = document.createElement("strong");
    strong.appendChild(range.extractContents());
    range.insertNode(strong);
  }

  if (command === "italic") {
    const em = document.createElement("em");
    em.appendChild(range.extractContents());
    range.insertNode(em);
  }

  if (command === "underline") {
    const u = document.createElement("u");
    u.appendChild(range.extractContents());
    range.insertNode(u);
  }
}

if (desc) {

  if (isOwner) {

    const textarea = document.createElement("div");
    textarea.contentEditable = true;
    textarea.className = "about-editor";
    textarea.innerHTML = vendor.description || "";

    textarea.addEventListener("blur", async () => {

      const { error } = await supabase
        .from("vendors")
        .update({ description: textarea.innerHTML.trim() })
        .eq("id", vendor.id);

      if (error) {
        console.error("About update error:", error.message);
      }

    });

    desc.replaceWith(textarea);

const toolbar = document.getElementById("aboutToolbar");

if (toolbar && isOwner) {

  toolbar.classList.remove("hidden");

toolbar.querySelectorAll("button").forEach(btn => {

  btn.addEventListener("mousedown", function(e){

    e.preventDefault();

    const cmd = this.getAttribute("data-cmd");

    applyFormat(cmd);

  });

});

}

  } else {

    desc.innerHTML = vendor.description || "";

  }

}

function formatTime(time) {

  if (!time) return "";

  const [hour, minute] =
    time.split(":");

  const h = Number(hour);

  const suffix =
    h >= 12 ? "PM" : "AM";

  const displayHour =
    h % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;

}

const contactInfo =
  document.getElementById(
    "businessContactInfo"
  );

if (contactInfo) {

console.log(contactInfo);
console.log(vendor);

  contactInfo.innerHTML = `
  
    <div class="business-contact-row">

      <i class="far fa-clock"></i>

      <div>

        <div class="business-hours">
           Opens ${formatTime(vendor.open_time)}
            •
           Closes ${formatTime(vendor.close_time)}
        </div>

        <div class="business-days">
          ${(vendor.business_days || "")
            .split(",")
            .join(" • ")}
        </div>

      </div>

    </div>

    <div class="business-contact-row">

      <i class="fas fa-phone-alt"></i>

      <span>
        ${vendor.phone || vendor.telephone || ""}
      </span>

    </div>

    <div class="business-contact-row">

      <i class="far fa-envelope"></i>

      <span>
        ${vendor.email || ""}
      </span>

    </div>

  `;

}

    // -------------------------------
    // MEDIA
    // -------------------------------

    const mediaSection = document.getElementById("mediaSection");

    if (mediaSection) {
      mediaSection.classList.remove("hidden");
    }

  const productsHeading =
  document.getElementById(
    "productsHeading"
  );

const servicesWrap =
  document.getElementById(
    "servicesWrap"
  );

const servicesList =
  document.getElementById(
    "servicesList"
  );

    const mediaHint = document.querySelector(".media-hint");

    if (mediaHint && !isOwner) {
      mediaHint.style.display = "none";
    }

// -------------------------------
// LOAD GALLERY
// -------------------------------
async function loadGallery() {

  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  grid.innerHTML = "<div class='gallery-loading'>Loading...</div>";

  const limit = effectiveGalleryLimit;

  const { data: images } = await supabase
    .from("vendor_media")
    .select("*")
    .eq("vendor_id", vendor.id)
    .eq("media_type", "image")
    .order("display_order", { ascending: true });

  const imageList = images || [];
  grid.innerHTML = "";

  const publicProducts = imageList.filter(item =>
  item &&
  item.title &&
  item.title.trim()
);

const totalItems = isOwner
  ? (
      imageList.length <
      effectiveGalleryLimit
    )
      ? effectiveGalleryLimit
      : imageList.length
  : Math.min(
      imageList.length,
      effectiveGalleryLimit
    );

  if (!isOwner && productsHeading) {

  if (publicProducts.length > 0) {
    productsHeading.classList.remove("hidden");
  } else {
    productsHeading.classList.add("hidden");
  }

}

  for (let i = 0; i < totalItems; i++) {

    const slot = document.createElement("div");
    slot.className = "gallery-item";

    if (!isOwner) {
      slot.addEventListener("click", () => {
        if (!imageList[i]) return;
        window.location.href = `vendor-product.html?media_id=${imageList[i].id}`;
      });
    }

   if (imageList[i]) {

  const data = imageList[i];

  // SKIP EMPTY ITEMS FOR PUBLIC
  if (!isOwner && (!data.title || !data.title.trim())) {
    continue;
  }

      const wrapper = document.createElement("div");
      wrapper.className = "gallery-content";

const img = document.createElement("img");

// LAZY LOAD
img.loading = "lazy";

// SET SRC
img.src = data.file_url;

// ERROR FALLBACK
img.onerror = function () {
  this.onerror = null;
  this.src = "images/placeholder.png";
};

      /* ---------- TITLE ---------- */
      const title = document.createElement("input");
        title.className = "gallery-title";
        title.value = data.title || "";
        if (!isOwner && !data.title) {
        wrapper.style.display = "none";
      }

        if (isOwner) {
        title.placeholder = "Product or service name";
        } else {
        title.readOnly = true;

        if (!data.title) {
        title.style.display = "none";
        }
       }

      /* ---------- KEY DETAILS ---------- */
      const rawKeyDetails = data.key_details || "";

      const keyDetailsInput = document.createElement("textarea");
      keyDetailsInput.className = "gallery-key-details";
      keyDetailsInput.value = rawKeyDetails;
      keyDetailsInput.placeholder = "Key Details (each on a new line)";

      const keyDetailsPreview = document.createElement("div");
      keyDetailsPreview.className = "gallery-key-preview";

      const lines = rawKeyDetails
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean)
        .slice(0, 2)
        .map(line => line.length > 22 ? line.slice(0, 22) + "..." : line);

      keyDetailsPreview.innerHTML = lines.map(l => `• ${l}`).join("<br>");

      /* ---------- DESCRIPTION ---------- */
      const desc = document.createElement("textarea");
      desc.className = "gallery-desc";
      desc.value = data.description || "";
      desc.placeholder = "Product description";

      if (!isOwner) desc.style.display = "none";

      /* ---------- PRICE ---------- */
      const price = document.createElement("input");
      price.className = "gallery-price";
      price.type = "text";

      price.addEventListener("input", () => {
      price.value = price.value.replace(/[^\d.]/g, "");
     });

      price.value = data.price
        ? "₦ " + Number(data.price).toLocaleString("en-NG", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        : "";

      if (!isOwner) price.readOnly = true;

      /* ---------- SAVE (DEBOUNCE) ---------- */
      let saveTimer;

 function saveMeta() {

  clearTimeout(saveTimer);

  if (saveStatus) {
    saveStatus.textContent = "Saving...";
  }

  saveTimer = setTimeout(async () => {

  const cleanTitle = title.value.trim();

if (!cleanTitle) {
  if (saveStatus) saveStatus.textContent = "Title required";

  // PREVENT EMPTY DISPLAY
  title.style.border = "1px solid red";

  return;
} else {
  title.style.border = "";
}

    let priceValue = price.value.replace(/[^\d.]/g, "");
    priceValue = priceValue ? parseFloat(priceValue) : null;

    const rawLines = keyDetailsInput.value.split("\n");

    const cleanedKeyDetails = rawLines
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(0, 2)
      .join("\n");

    const { error } = await supabase
      .from("vendor_media")
      .update({
        title: cleanTitle,
        description: desc.value.trim(),
        key_details: cleanedKeyDetails,
        price: priceValue
      })
      .eq("id", data.id);

    if (error) {
      if (saveStatus) saveStatus.textContent = "Failed";
      return;
    }

    if (saveStatus) saveStatus.textContent = "Saved";

    setTimeout(() => {
      if (saveStatus) saveStatus.textContent = "";
    }, 1200);

  }, 600);

}

      if (isOwner) {
        title.addEventListener("input", saveMeta);
        desc.addEventListener("input", saveMeta);
        price.addEventListener("input", saveMeta);
        keyDetailsInput.addEventListener("input", saveMeta);
      }

      /* ---------- META ---------- */
  const meta = document.createElement("div");
  meta.className = "gallery-meta";

  const saveStatus = document.createElement("div");
  saveStatus.className = "save-status";
  meta.appendChild(saveStatus);
     
  if (isOwner) {

  const keyLabel = document.createElement("div");
  keyLabel.textContent = "Key Details";
  keyLabel.className = "field-label";

  const priceLabel = document.createElement("div");
  priceLabel.textContent = "Price";
  priceLabel.className = "field-label";

  meta.appendChild(keyLabel);
  meta.appendChild(keyDetailsInput);

  meta.appendChild(desc);

  meta.appendChild(priceLabel);
  meta.appendChild(price);

} else {

  meta.appendChild(keyDetailsPreview);
  meta.appendChild(price);

}
wrapper.appendChild(title);
wrapper.appendChild(img);

// ===== REORDER CONTROLS (OWNER ONLY) =====
if (isOwner) {

  const controls = document.createElement("div");
  controls.className = "gallery-controls";

  const upBtn = document.createElement("button");
  upBtn.textContent = "↑";

  const downBtn = document.createElement("button");
  downBtn.textContent = "↓";

  upBtn.onclick = async () => {

    if (i === 0) return;

    const prev = imageList[i - 1];

    await supabase
      .from("vendor_media")
      .update({ display_order: prev.display_order })
      .eq("id", data.id);

    await supabase
      .from("vendor_media")
      .update({ display_order: data.display_order })
      .eq("id", prev.id);

    await loadGallery();
  };

  downBtn.onclick = async () => {

    if (i === imageList.length - 1) return;

    const next = imageList[i + 1];

    await supabase
      .from("vendor_media")
      .update({ display_order: next.display_order })
      .eq("id", data.id);

    await supabase
      .from("vendor_media")
      .update({ display_order: data.display_order })
      .eq("id", next.id);

    await loadGallery();
  };

  controls.appendChild(upBtn);
  controls.appendChild(downBtn);

  wrapper.appendChild(controls);
}

// ===== ADD DELETE BUTTON (OWNER ONLY) =====
if (isOwner) {

  const delBtn = document.createElement("button");
  delBtn.className = "gallery-delete";
  delBtn.textContent = "×";

delBtn.addEventListener("click", async () => {

  delBtn.disabled = true;

  const confirmDelete = confirm("Delete this image?");
  if (!confirmDelete) {
    delBtn.disabled = false;
    return;
  }

  // DELETE FROM DATABASE FIRST
const { data: deleted, error: dbError } = await supabase
  .from("vendor_media")
  .delete()
  .eq("id", data.id)
  .select();

console.log("DELETE RESULT:", deleted, dbError);

if (dbError) {
  alert("DB ERROR");
  return;
}

if (!deleted || deleted.length === 0) {
  alert("NOT DELETED (RLS BLOCK)");
  return;
}

  // RELOAD UI IMMEDIATELY
  await loadGallery();
  delBtn.disabled = false;

});

  wrapper.appendChild(delBtn);
}

wrapper.appendChild(meta);

slot.appendChild(wrapper);

    } else if (isOwner) {

      const wrapper = document.createElement("div");
      wrapper.className = "gallery-content";

const placeholder =
  document.createElement("button");

placeholder.type = "button";

placeholder.className =
  "gallery-add-card";

placeholder.innerHTML = `
  <span class="gallery-add-plus">
    +
  </span>

  <span class="gallery-add-text">
    Add New
  </span>

  <span class="gallery-add-note">
    1200×1200px • Max 750KB
  </span>
`;

placeholder.addEventListener(
  "click",
  () => {

    galleryInput.click();

  }
);

      wrapper.appendChild(placeholder);
      slot.appendChild(wrapper);

    }

grid.appendChild(slot);

  }

}

loadGallery();

async function loadServices() {

  if (!servicesWrap || !servicesList) return;

  servicesList.innerHTML = "";

  const { data: services } = await supabase
    .from("vendor_services")
    .select("*")
    .eq("vendor_id", vendor.id);

  const serviceList = services || [];

  if (serviceList.length === 0) {

    servicesWrap.classList.add("hidden");

    return;

  }

  servicesWrap.classList.remove("hidden");

serviceList.forEach(service => {

  const serviceName =
    (service.service_name || "").trim();

  if (!serviceName) return;

  const card =
    document.createElement("div");

  card.className =
    "service-card";

const name =
  document.createElement("div");

name.className =
  "service-name";

name.textContent =
  serviceName;

card.appendChild(name);

const description =
  document.createElement("div");

description.className =
  "service-description";

description.textContent =
  (service.short_description || "").trim();

card.appendChild(description);

servicesList.appendChild(card);

});

}

loadServices();

async function loadVideo() {

  const { data: videos } = await supabase
    .from("vendor_media")
    .select("*")
    .eq("vendor_id", vendor.id)
    .eq("media_type", "video")
    .limit(1);

const videoWrap = document.getElementById("videoWrap");
const videoLimits = VIDEO_LIMITS[vendor.plan_tier];

// If plan does NOT allow video → hide for everyone
if (!videoLimits.allowed) {
  if (videoWrap) videoWrap.classList.add("hidden");
  return;
}

// OWNER VIEW → always show if plan allows
if (currentUser && vendor.auth_user_id === currentUser.id) {
  if (videoWrap) videoWrap.classList.remove("hidden");
} else {
  // PUBLIC VIEW → only show if video exists
  if (!videos || videos.length === 0) {
    if (videoWrap) videoWrap.classList.add("hidden");
    return;
  }

  if (videoWrap) videoWrap.classList.remove("hidden");
}

  const videoRecord = videos && videos.length > 0 ? videos[0] : null;

  if (!videoRecord) return;

  const deleteBtn = document.getElementById("deleteVideoBtn");

if (deleteBtn) {

  deleteBtn.onclick = async () => {

    const confirmDelete = confirm("Delete this video?");
    if (!confirmDelete) return;

  const videoPath = videoRecord.file_url.split("/vendor-videos/")[1];
   if (!videoPath) return;

    await supabase.storage
      .from("vendor-videos")
      .remove([videoPath]);

   const { data: deleted, error } = await supabase
     .from("vendor_media")
     .delete()
     .eq("id", videoRecord.id)
     .eq("vendor_id", vendor.id)
     .select();

   if (error || !deleted || deleted.length === 0) {
     alert("Video delete blocked");
     return;
   }

// RESET VIDEO UI PROPERLY
const player = document.getElementById("vendorVideo");
if (player) {
  player.src = "";
  player.removeAttribute("src");
  player.load();
}

const videoControls = document.getElementById("videoControls");
if (videoControls) {
  videoControls.classList.add("hidden");
}

// RELOAD VIDEO STATE (IMPORTANT)
await loadVideo();

};

}

const player = document.getElementById("vendorVideo");

if (player) {

  player.style.opacity = "0.5";

  player.src = videoRecord.file_url;

  player.onloadeddata = () => {
    player.style.opacity = "1";
  };

}

const videoControls = document.getElementById("videoControls");

if (videoControls && currentUser && vendor.auth_user_id === currentUser.id) {
  videoControls.classList.remove("hidden");
}

}

loadVideo();

    // -------------------------------
    // SOCIAL LINKS
    // -------------------------------
  async function loadSocialLinks() {

  const { data: links } = await supabase
    .from("vendor_social_links")
    .select("*")
    .eq("vendor_id", vendor.id);

  const row = document.getElementById("socialLinksRow");
  if (!row) return;

  if (!links || links.length === 0) {
    row.classList.add("hidden");
    return;
  }

  row.classList.remove("hidden");
  row.innerHTML = "";

  const iconMap = {

    instagram: `<svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.8A4.2 4.2 0 1 0 16.2 12 4.2 4.2 0 0 0 12 7.8zm0 6.9A2.7 2.7 0 1 1 14.7 12 2.7 2.7 0 0 1 12 14.7zm4.4-7.8a1 1 0 1 1-1-1 1 1 0 0 1 1 1z"/></svg>`,

    facebook: `<svg viewBox="0 0 24 24"><path d="M13 22v-9h3l1-4h-4V7a2 2 0 0 1 2-2h2V1h-3a5 5 0 0 0-5 5v3H6v4h3v9z"/></svg>`,

    tiktok: `<svg viewBox="0 0 24 24"><path d="M16 3a6 6 0 0 0 4 4v3a9 9 0 0 1-4-1.1V15a5 5 0 1 1-5-5 4.7 4.7 0 0 1 1 .1v3a2 2 0 1 0 2 2V3z"/></svg>`,

    youtube: `<svg viewBox="0 0 24 24"><path d="M23 7s-.2-1.7-.8-2.5a3.1 3.1 0 0 0-2.2-1.1C17.2 3 12 3 12 3s-5.2 0-8 .4a3.1 3.1 0 0 0-2.2 1.1C1.2 5.3 1 7 1 7S1 9 1 11v2c0 2 .2 4 .2 4s.2 1.7.8 2.5a3.1 3.1 0 0 0 2.2 1.1C6.8 21 12 21 12 21s5.2 0 8-.4a3.1 3.1 0 0 0 2.2-1.1c.6-.8.8-2.5.8-2.5S23 15 23 13v-2c0-2 0-4 0-4zM9.7 14.5V9.5l5.2 2.5z"/></svg>`,

    website: `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm6.9 9h-3.2a15 15 0 0 0-1.1-5A8.1 8.1 0 0 1 18.9 11zM12 4c.9 1.3 1.6 3.3 1.8 5H10.2c.2-1.7.9-3.7 1.8-5zM4.3 13h3.2a15 15 0 0 0 1.1 5A8.1 8.1 0 0 1 4.3 13zm3.2-2H4.3a8.1 8.1 0 0 1 4.3-5 15 15 0 0 0-1.1 5zM12 20c-.9-1.3-1.6-3.3-1.8-5h3.6c-.2 1.7-.9 3.7-1.8 5zm2.4-2a15 15 0 0 0 1.1-5h3.2a8.1 8.1 0 0 1-4.3 5z"/></svg>`
  };

  links.slice(0, effectiveSocialLimit).forEach(link => {

  if (!iconMap[link.platform]) return;

  const wrapper = document.createElement("div");
  wrapper.className = "social-item";

  const a = document.createElement("a");
  a.href = link.url;
  a.target = "_blank";
  a.innerHTML = iconMap[link.platform];

  wrapper.appendChild(a);

  if (isOwner) {

    const del = document.createElement("button");
    del.className = "social-delete";
    del.textContent = "×";

del.addEventListener("click", async () => {

  del.disabled = true;

  const { error } = await supabase
    .from("vendor_social_links")
    .delete()
    .eq("id", link.id);

  if (error) {
    del.disabled = false;
    return;
  }

  // instant UI removal
  wrapper.remove();

});

    wrapper.appendChild(del);

  }

  row.appendChild(wrapper);

});

}


async function loadRecentReviews(
  vendorId
) {

const query =
  supabase
    .from(
      "vendor_reviews"
    )
    .select(
      "reviewer_name, review_text, created_at"
    )
    .eq(
      "vendor_id",
      vendorId
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );

if (
  !showAllReviews
) {

  query.limit(
    3
  );

}

const {
  data: reviews,
  error
} = await query;

console.log(
  "showAllReviews:",
  showAllReviews
);

console.log(
  "Review Count:",
  reviews?.length
);

  console.log(
    "Recent Reviews:",
    reviews
  );

  console.log(
    "Review Error:",
    error
  );

  const reviewsList =
  document.getElementById(
    "reviewsList"
  );

console.log(
  "Reviews List Element:",
  reviewsList
);

if (
  reviewsList
) {

  reviewsList.innerHTML =
    "";

  if (
    !reviews ||
    reviews.length === 0
  ) {

    reviewsList.innerHTML =
      `
      <div class="no-reviews-message">
        No reviews yet.<br>
        Be the first to leave a review.
      </div>
      `;

    return;

  }

  const now =
    new Date();

  reviews.forEach(

    review => {

  const initials =
  (review.reviewer_name || "")
    .split(" ")
    .map(
      part =>
        part.charAt(0)
    )
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const reviewerName =
  review.reviewer_name?.trim()
  || "Anonymous Reviewer";

  const reviewDate =
  new Date(
    review.created_at
  );

const diffDays =
  Math.floor(
    (
      now -
      reviewDate
    ) /
    (
      1000 *
      60 *
      60 *
      24
    )
  );

let relativeDate =
  "";

if (
  diffDays <= 0
) {

  relativeDate =
    "Today";

} else if (
  diffDays < 7
) {

  relativeDate =
    `${diffDays} day${
      diffDays > 1
        ? "s"
        : ""
    } ago`;

} else {

  const weeks =
    Math.min(
      3,
      Math.floor(
        diffDays / 7
      )
    );

  relativeDate =
    `${weeks} week${
      weeks > 1
        ? "s"
        : ""
    } ago`;

}

reviewsList.insertAdjacentHTML(
  "beforeend",
  `
  <div class="review-card">

    <div class="review-header">

  <div class="review-avatar">
    ${initials}
  </div>

<div class="review-meta">

  <div class="review-row">

    <div class="reviewer-name">
      ${reviewerName}
    </div>

    <div class="review-date">
      ${relativeDate}
    </div>

  </div>

</div>

</div>

<div class="review-text">
  ${review.review_text || ""}
</div>

  </div>
  `
);

    }
  );

}

}

async function loadSimilarBusinesses(
  vendor
) {

  console.log(
    "Loading Similar Businesses:",
    vendor.category
  );

  const {
    data: businesses,
    error
  } = await supabase
    .from(
      "vendors"
    )
    .select(
      `
      id,
      slug,
      name,
      logo_url,
      category,
      average_rating,
      reviews_count,
      verification_status,
      is_sponsored
      `
    )
    .eq(
      "category",
      vendor.category
    )
    .eq(
      "account_status",
      "active"
    )

    .eq(
  "onboarding_completed",
  true
)
.eq(
  "public_listing_accepted",
  true
)
.eq(
  "subscription_status",
  "active"
)

    .neq(
      "id",
      vendor.id
    );

  console.log(
    "Similar Businesses:",
    businesses
  );

  console.log(
    "Similar Businesses Error:",
    error
  );

  if (
  error ||
  !businesses
) {

  return;

}

businesses.sort(
  (
    a,
    b
  ) => {

    const getRank =
      vendor => {

        if (
          vendor.is_sponsored
        ) {
          return 1;
        }

        if (
          vendor.verification_status ===
          "blue"
        ) {
          return 2;
        }

        if (
          vendor.verification_status ===
          "gray"
        ) {
          return 3;
        }

        return 4;

      };

    const rankA =
      getRank(a);

    const rankB =
      getRank(b);

    if (
      rankA !== rankB
    ) {

      return (
        rankA -
        rankB
      );

    }

    if (
      Number(
        b.average_rating || 0
      ) !==
      Number(
        a.average_rating || 0
      )
    ) {

      return (
        Number(
          b.average_rating || 0
        ) -
        Number(
          a.average_rating || 0
        )
      );

    }

    return (
      Number(
        b.reviews_count || 0
      ) -
      Number(
        a.reviews_count || 0
      )
    );

  }
);

console.log(
  "Sorted Businesses:",
  businesses
);

const similarBusinessesList =
  document.getElementById(
    "similarBusinessesList"
  );

if (
  !similarBusinessesList
) {

  return;

}

similarBusinessesList.innerHTML =
  "";

businesses
  .slice(0, 6)
  .forEach(
    business => {

      const isVerified =
  business.verification_status === "blue" ||
  business.verification_status === "gray";

const badgeHtml =
  isVerified
    ? `
      <span
        class="badge-wrap"
      >
        <img
          src="${
            business.verification_status === "gray"
              ? "images/graybadge.png"
              : "images/bluebadge.png"
          }"
          alt="Verification Badge"
          class="verification-badge"
        >
      </span>
      `
    : "";

      const stars =
        Number(
          business.average_rating || 0
        ).toFixed(1);

      similarBusinessesList
        .insertAdjacentHTML(
          "beforeend",
          `
          <div class="similar-business-card">

            <a
              href="vendor-profile.html?slug=${business.slug || business.id}"
              class="similar-business-link"
            >

              <div class="similar-business-top">

                <img
                  src="${
                    business.logo_url ||
                    "images/default-vendor-logo.webp"
                  }"
                  class="similar-business-logo"
                  alt="${business.name}"
                >

<div class="similar-business-info">

  <div class="similar-business-name-row">

    <div class="similar-business-name">
      ${business.name}
    </div>

    ${badgeHtml}

  </div>

<div class="similar-business-rating">

  <span class="similar-business-star">
    ★
  </span>

  ${stars}
  (${business.reviews_count || 0} Reviews)

</div>

</div>

              </div>

            </a>

          </div>
          `
        );

    }
  );

}

loadSocialLinks();

loadBranches();

// -------------------------------
// ADD SOCIAL LINK
// -------------------------------
const addSocialBtn = document.getElementById("addSocialBtn");

if (addSocialBtn) {

  addSocialBtn.addEventListener("click", async () => {

  const platform = document.getElementById("socialPlatform").value;
let url = document.getElementById("socialUrl").value.trim();

if (!url) {
  alert("Please enter a link.");
  return;
}

// ENSURE VALID URL FORMAT
if (!url.startsWith("http://") && !url.startsWith("https://")) {
  url = "https://" + url;
}

// BASIC VALIDATION
try {
  new URL(url);
} catch {
  alert("Invalid link format.");
  return;
}
    
    // Check plan limit
    const { data: existingLinks } = await supabase
      .from("vendor_social_links")
      .select("id")
      .eq("vendor_id", vendor.id);

    const limit = effectiveSocialLimit;

    if (existingLinks && existingLinks.length >= limit) {
      alert("You have reached the maximum number of social links allowed for your plan.");
      return;
   }
    const { error } = await supabase
      .from("vendor_social_links")
      .insert({
        vendor_id: vendor.id,
        platform: platform,
        url: url
      });

    if (error) {
      console.error("Insert error:", error.message);
      return;
    }

    await loadSocialLinks();

  });

}

  // -------------------------------
// LOAD BRANCHES
// -------------------------------
async function loadBranches() {

  const branchesSection = document.getElementById("branchesSection");
  const branchesList = document.getElementById("branchesList");

  if (!branchesSection || !branchesList) return;

  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .eq("vendor_id", vendor.id);

  const limit = BRANCH_LIMITS[vendor.plan_tier] ?? 0;

if (!branches || branches.length === 0 || limit === 0) return;

  branchesSection.classList.remove("hidden");

  branchesList.innerHTML = "";

  branches.slice(0, limit).forEach(branch => {

    const item = document.createElement("div");
    item.className = "branch-item";

    const name = document.createElement("div");
    name.className = "branch-name";
    name.textContent = branch.branch_name || "";

    const address = document.createElement("div");
    address.className = "branch-address";
    address.textContent = branch.address || "";

    const map = document.createElement("a");

    if (branch.latitude && branch.longitude) {
      map.href = `https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`;
    } else {
      map.href = "#";
    }

    map.target = "_blank";
    map.textContent = "View on Map";

    item.appendChild(name);
    item.appendChild(address);
    item.appendChild(map);

    branchesList.appendChild(item);

  });

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

    const editProfileBtn =
  document.getElementById(
    "editProfileBtn"
  );

if (
  editProfileBtn
) {

  if (isOwner) {

    editProfileBtn.classList.remove(
      "hidden"
    );

  } else {

    editProfileBtn.classList.add(
      "hidden"
    );

  }

editProfileBtn.addEventListener(
  "click",
  () => {

    window.location.href =
      "vendordashboard.html";

  }
);

}
    // -------------------------------
    // OWNER MODE — Enable Branding Upload
    // -------------------------------
    if (isOwner) {

    const socialEditor = document.getElementById("socialEditor");
    const socialLimit = effectiveSocialLimit;

if (
  socialEditor &&
  isOwner
) {

  socialEditor.classList.remove(
    "hidden"
  );

if (socialLimit === 0) {

    const platform = document.getElementById("socialPlatform");
    const url = document.getElementById("socialUrl");
    const btn = document.getElementById("addSocialBtn");

    if (platform) platform.disabled = true;
    if (url) url.disabled = true;

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Upgrade to add links";
    }

  }

}

  const coverLabel = document.getElementById("coverUploadLabel");
  const logoLabel = document.getElementById("logoUploadLabel");
  const coverInput = document.getElementById("coverInput");
  const logoInput = document.getElementById("logoInput");

  if (coverInput) {

  coverInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Only JPG, PNG or WEBP images allowed.");
      coverInput.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      alert("Cover image must be less than 1MB.");
      coverInput.value = "";
      return;
    }

    if (vendor.cover_url) {

      const oldPath =
        vendor.cover_url.split("/vendor-branding/")[1];

      if (oldPath) {
        await supabase.storage
          .from("vendor-branding")
          .remove([oldPath]);
      }

    }

    const ext =
      file.name.split(".").pop().toLowerCase();

    const filePath =
      `${currentUser.id}/cover-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("vendor-branding")
      .upload(filePath, file);

    if (error) {
      alert("Cover upload failed.");
      coverInput.value = "";
      return;
    }

    const { data } = supabase.storage
      .from("vendor-branding")
      .getPublicUrl(filePath);

    await supabase
      .from("vendors")
      .update({
        cover_url: data.publicUrl
      })
      .eq("id", vendor.id);

    vendor.cover_url = data.publicUrl;

    renderBranding();

    coverInput.value = "";

  });

}

  if (coverLabel) coverLabel.classList.remove("hidden");
  if (logoLabel) logoLabel.classList.remove("hidden");

const deleteCoverBtn = document.getElementById("deleteCoverBtn");
const deleteLogoBtn = document.getElementById("deleteLogoBtn");

if (deleteCoverBtn && vendor.cover_url) {
  deleteCoverBtn.classList.remove("hidden");
}

if (deleteLogoBtn && vendor.logo_url) {
  deleteLogoBtn.classList.remove("hidden");
}

if (deleteLogoBtn) {

  if (!vendor.logo_url) {
    deleteLogoBtn.style.display = "none";
  }

  deleteLogoBtn.onclick = async () => {

    const ok = confirm("Delete logo image?");
    if (!ok) return;

    if (vendor.logo_url) {

      const oldPath =
        vendor.logo_url.split("/vendor-branding/")[1];

      if (oldPath) {
        await supabase.storage
          .from("vendor-branding")
          .remove([oldPath]);
      }

    }

    await supabase
      .from("vendors")
      .update({ logo_url: null })
      .eq("id", vendor.id);

    vendor.logo_url = null;

    renderBranding();

  };

}

if (deleteCoverBtn) {

  if (!vendor.cover_url) {
    deleteCoverBtn.style.display = "none";
  }

  deleteCoverBtn.onclick = async () => {

    const ok = confirm("Delete cover image?");
    if (!ok) return;

    if (vendor.cover_url) {

      const oldPath =
        vendor.cover_url.split("/vendor-branding/")[1];

      if (oldPath) {
        await supabase.storage
          .from("vendor-branding")
          .remove([oldPath]);
      }

    }

    await supabase
      .from("vendors")
      .update({ cover_url: null })
      .eq("id", vendor.id);

    vendor.cover_url = null;

    renderBranding();

  };

}
  
// LOGO UPLOAD
if (logoInput) {

  logoInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      alert("Only JPG, PNG or WEBP images allowed.");
      return;
    }

    if (file.size > 1024 * 1024) {
      alert("Logo image must be less than 1MB.");
      return;
    }

    if (vendor.logo_url) {

      const oldPath = vendor.logo_url.split("/vendor-branding/")[1];

      if (oldPath) {
        await supabase.storage
          .from("vendor-branding")
          .remove([oldPath]);
      }

    }

    const ext = file.name.split(".").pop().toLowerCase();

    const filePath =
      `${currentUser.id}/logo-${Date.now()}.${ext}`;

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

    await supabase
      .from("vendors")
      .update({ logo_url: data.publicUrl })
      .eq("id", vendor.id);

    vendor.logo_url = data.publicUrl;

    renderBranding();

  });

}

 }
}

function getSafePlanTier(plan) {
  const validPlans = ["free", "standard", "enterprise", "elite", "custom"];

  if (!validPlans.includes(plan)) return "free";

  return plan;
}

window.loadVendorProfile =
  loadVendorProfile;

loadVendorProfile();
});
