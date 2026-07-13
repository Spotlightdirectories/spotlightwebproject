document.addEventListener("DOMContentLoaded", async () => {


  const supabase = window.supabaseClient;

  // ===============================
  // NAVBAR (mobile menu + auth button, same pattern as other pages)
  // ===============================
  const menuOpenBtn = document.querySelector(".menu-open");
  const menuCloseBtn = document.querySelector(".xclose");
  const navLinks = document.querySelector(".nav-links");

  if (menuOpenBtn && navLinks) {
    menuOpenBtn.addEventListener("click", () => navLinks.classList.add("open"));
  }
  if (menuCloseBtn && navLinks) {
    menuCloseBtn.addEventListener("click", () => navLinks.classList.remove("open"));
  }

  const navAuthBtn = document.getElementById("authBtn");
  if (navAuthBtn && supabase) {
    function updateNavAuthBtn(user) {
      navAuthBtn.textContent = user ? "Log out" : "Log in";
      navAuthBtn.href = user ? "#" : "login";
    }
    supabase.auth.onAuthStateChange((event, session) => updateNavAuthBtn(session?.user || null));
    supabase.auth.getSession().then(({ data: { session } }) => updateNavAuthBtn(session?.user || null));
    navAuthBtn.addEventListener("click", async (e) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.reload();
      }
    });
  }

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
  const SOCIAL_LIMITS = {
    free: 1,
    standard: 2,
    enterprise: 3,
    elite: 5,
    custom: Infinity
  };

  const BRANCH_LIMITS = {
  free: 0,
  standard: 0,
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

  const DESCRIPTION_WORD_LIMITS = {
  free: 100,
  standard: 150,
  enterprise: 300,
  elite: 500,
  custom: 650
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

const isOwner =
  currentUser &&
  vendor.auth_user_id === currentUser.id;

if (!isOwner) {


const result =
  await supabase
    .from("analytics_events")
    .insert({
      vendor_id: vendor.id,
      event_type: "profile_view",
      visitor_id: window.visitorId
    })
    .select();

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

if (vendor.plan_tier === "free") {

  if (trial_active) {
    effectiveSocialLimit = 1;
  } else if (trial_expired) {
    effectiveSocialLimit = 0;
  } else {
    // No trial record on file — treat as permanent Free baseline
    effectiveSocialLimit = 0;
  }

} else {
  effectiveSocialLimit = SOCIAL_LIMITS[vendor.plan_tier] ?? 0;
}

      const isFree = vendor.plan_tier === "free";
      const isPaid = !isFree;

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

if (videoInput) {

  videoInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    videoInput.disabled = true;

    const videoUploadLabel = document.querySelector('label[for="videoInput"]');
    const setVideoStatus = (text) => {
      if (videoUploadLabel) videoUploadLabel.textContent = text;
    };

    setVideoStatus("⏳ Checking video...");

    if (file.type !== "video/mp4") {
     alert("Only MP4 videos are allowed.");
     videoInput.disabled = false;
     setVideoStatus("Upload Video");
     return;
    }

    const limits = VIDEO_LIMITS[vendor.plan_tier];

    if (!limits.allowed) {
      alert("Your current plan does not allow video upload.");
      videoInput.disabled = false;
      setVideoStatus("Upload Video");
      return;
    }

    if (file.size > limits.maxSize) {
      alert("Video file exceeds the maximum size allowed for your plan.");
      videoInput.disabled = false;
      setVideoStatus("Upload Video");
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
  videoInput.disabled = false;
  setVideoStatus("Upload Video");
  return;
}

// ===============================
// RESOLUTION CHECK (720p max)
// ===============================
const videoLongSide = Math.max(video.videoWidth, video.videoHeight);
const videoShortSide = Math.min(video.videoWidth, video.videoHeight);

if (videoLongSide > 1280 || videoShortSide > 720) {
  alert("Video resolution must be 720p or lower. Please lower your phone's recording quality and try again.");
  videoInput.disabled = false;
  setVideoStatus("Upload Video");
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

   setVideoStatus("⏳ Uploading video...");

   const { error: uploadError } = await supabase.storage
     .from("vendor-videos")
     .upload(videoPath, file);

   if (uploadError) {
     console.error("Video upload error:", uploadError.message);
     alert("Video upload failed.");
     videoInput.disabled = false;
     setVideoStatus("Upload Video");
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
  setVideoStatus("Upload Video");
  return;
}

await loadVideo();
videoInput.value = "";
videoInput.disabled = false;
setVideoStatus("Upload Video");

  });

}

    const videoLimits = VIDEO_LIMITS[vendor.plan_tier];

    if (videoUploader && isOwner && videoLimits.allowed) {
      videoUploader.classList.remove("hidden");
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

    whatsapp.href =
      `https://wa.me/${vendor.whatsapp}`;

    whatsapp.style.display =
      "inline-block";

    whatsapp.addEventListener(
      "click",
      async () => {

await supabase
  .from("analytics_events")
  .insert({
    vendor_id: vendor.id,
    event_type: "whatsapp_click",
    visitor_id: window.visitorId
  });

      }
    );

  } else {

    whatsapp.style.display =
      "none";

  }

}

const callLink =
  document.getElementById(
    "callLink"
  );

if (callLink) {

  const phoneNumber =
    vendor.phone ||
    vendor.whatsapp;

  if (phoneNumber) {

    callLink.href =
      `tel:${phoneNumber}`;

    callLink.addEventListener(
      "click",
      async () => {

        await supabase
          .from("analytics_events")
          .insert({
            vendor_id: vendor.id,
            event_type: "phone_click",
            visitor_id: window.visitorId
          });

      }
    );

  } else {

    callLink.style.display =
      "none";

  }

}

const map =
  document.getElementById(
    "mapLink"
  );

if (map) {

  if (
    vendor.latitude &&
    vendor.longitude
  ) {

    map.href =
      `https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}`;

  } else if (
    vendor.address
  ) {

    map.href =
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address)}`;

  } else {

    map.href = "#";

  }

  map.addEventListener(
    "click",
    async () => {

      await supabase
        .from("analytics_events")
        .insert({
          vendor_id: vendor.id,
          event_type: "direction_click",
          visitor_id: window.visitorId
        });

    }
  );

  map.style.pointerEvents =
    "auto";

}

const catalogBtn =

  document.getElementById(
    "catalogBtn"
  );

if (catalogBtn) {

  catalogBtn.onclick = async function () {

const result =
  await supabase
    .from("analytics_events")
    .insert({
      vendor_id: vendor.id,
      event_type: "catalog_visit",
      visitor_id: window.visitorId
    });

      document
        .getElementById("mediaSection")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

    };

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

      const descriptionWordLimit =
        DESCRIPTION_WORD_LIMITS[vendor.plan_tier] ?? 100;

      const plainText = textarea.innerText.trim();
      const wordCount = plainText ? plainText.split(/\s+/).length : 0;

      if (wordCount > descriptionWordLimit) {
        alert(`Your business description exceeds the ${descriptionWordLimit}-word limit for your plan. Please shorten it — changes were not saved.`);
        return;
      }

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


async function loadServices() {

  if (!servicesWrap || !servicesList) return;

  servicesList.innerHTML = "";

const { data: services } = await supabase
  .from("vendor_services")
  .select(`
    *,
    vendors(
      slug,
      name,
      category,
      subcategory,
      state,
      lga,
      verification_status,
      average_rating,
      reviews_count,
      is_sponsored
    )
  `)
  .eq(
    "vendor_id",
    vendor.id
  );

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

  const averageRating =
    Number(
      service.vendors?.average_rating || 0
    ).toFixed(1);

  const reviewsCount =
    service.vendors?.reviews_count || 0;

  const verificationBadge =

    service.vendors?.verification_status === "blue"

      ? `<img
          src="images/bluebadge.png"
          class="discover-results2-badge"
        >`

      : service.vendors?.verification_status === "gray"

      ? `<img
          src="images/graybadge.png"
          class="discover-results2-badge"
        >`

      : "";

      const card =
    document.createElement("article");

  card.className =
      "vendor-profile-service-card";

 card.innerHTML = `

<div class="vendor-profile-service-content">
<h3>

${service.service_name}

</h3>

<div class="discover-results2-vendor-heading">

<p class="discover-results2-service-vendor">

By: ${service.vendors?.name || ""}

</p>

<span class="discover-results2-badge-wrap">

${verificationBadge}

</span>

</div>

<div class="discover-results2-rating-wrap">
</div>

<div class="discover-results2-rating-wrap">

<i class="fa-solid fa-star"></i>

<span>

${averageRating}

</span>

<small>

(${reviewsCount})

</small>

</div>

<p class="vendor-profile-service-price">

Starting From

<span>

₦${Number(
service.starting_price || 0
).toLocaleString()}

</span>

</p>

<p class="discover-results2-address">

${service.vendors?.lga || ""}

${service.vendors?.state ? `, ${service.vendors.state}` : ""}

</p>

<span class="discover-results2-category">

${service.vendors?.subcategory ||

service.vendors?.category ||

"Service"}

</span>

</div>

`;

  card.onclick = () => {

    window.location.href =

      "vendor-service.html?slug=" +

      encodeURIComponent(

        service.slug

      );

  };

  servicesList.appendChild(card);

});

}

// -------------------------------
// LOAD PRODUCTS
// -------------------------------
async function loadProducts() {

  const grid =
    document.getElementById(
      "galleryGrid"
    );

  if (!grid) return;

  grid.innerHTML = "";

  const {
    data: products,
    error
  } = await supabase

    .from("vendor_products")

    .select("*")

    .eq(
      "vendor_id",
      vendor.id
    )

    .order(
      "display_order",
      {
        ascending: true
      }
    );

  if (
    error ||
    !products ||
    products.length === 0
  ) {

    return;

  }

  const heading =
    document.getElementById(
      "productsHeading"
    );

  if (heading) {

    heading.classList.remove(
      "hidden"
    );

  }

  products.forEach(
    product => {

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "discover-results2-product-card";

      card.onclick =
        () => {

  window.location.href =
    `vendor-product.html?slug=${product.slug}`;

 };

card.innerHTML = `

<img
src="${product.primary_image_url || "images/placeholder.png"}"
class="discover-results2-product-image"
alt="${product.product_name}"
>

<h3 class="discover-results2-product-title">

${product.product_name}

</h3>

<p class="discover-results2-product-price">

₦${Number(product.price || 0).toLocaleString()}

</p>

<div class="discover-results2-product-vendor">

<span>

By ${vendor.name || ""}

</span>

${
vendor.verification_status === "blue"
? `<img src="images/bluebadge.png" class="discover-results2-product-badge">`
: vendor.verification_status === "gray"
? `<img src="images/graybadge.png" class="discover-results2-product-badge">`
: ""
}

</div>

<div class="discover-results2-product-rating">

<i class="fa-solid fa-star"></i>

<span>

${Number(vendor.average_rating || 0).toFixed(1)}

</span>

<small>

(${vendor.reviews_count || 0})

</small>

</div>

${
vendor.is_sponsored
? `<p class="discover-results2-product-sponsored">Sponsored</p>`
: ""
}

`;

grid.appendChild(
  card
);

}

);

}

loadProducts();

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

  a.addEventListener(
  "click",
  async () => {

    await supabase
      .from("analytics_events")
      .insert({
        vendor_id: vendor.id,
        event_type: "external_visit",
        visitor_id: window.visitorId
      });

  }
);

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

if (error) {
  console.error("Reviews load error:", error.message);
}

  const reviewsList =
  document.getElementById(
    "reviewsList"
  );

if (
  reviewsList
) {

  reviewsList.innerHTML =
    "";

  if (error) {

    reviewsList.innerHTML =
      `
      <div class="no-reviews-message">
        Couldn't load reviews right now. Please try again shortly.
      </div>
      `;

    return;

  }

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

  const {
    data: businesses,
    error
  } = await supabase.rpc(
    "get_similar_businesses",
    {
      p_exclude_vendor_id: vendor.id,
      p_target_category: vendor.category,
      p_limit: 6
    }
  );

  if (
  error ||
  !businesses
) {

  console.error("Similar businesses error:", error?.message);

  return;

}

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

    // Client-side size pre-check — instant feedback instead of
    // silently converting the whole file to base64 and uploading it
    // over the network before the server eventually rejects it.
    const maxCoverSize = 1 * 1024 * 1024;

    if (file.size > maxCoverSize) {
      alert("Cover image must be 1MB or smaller. Please choose a smaller file.");
      coverInput.value = "";
      return;
    }

    // Visible feedback while the upload is actually in flight —
    // there was previously no indication anything was happening
    // during this network round-trip.
    if (coverLabel) {
      coverLabel.style.pointerEvents = "none";
      coverLabel.firstChild.textContent = "⏳ Uploading...";
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

    let uploadResult;

    try {
      uploadResult = await uploadVendorFile(file, "cover");
    } catch (err) {
      console.error("Cover Upload Error:", err.message);
      alert(err.message || "Cover upload failed.");
      coverInput.value = "";
      if (coverLabel) {
        coverLabel.firstChild.textContent = "📷";
        coverLabel.style.pointerEvents = "";
      }
      return;
    }

    await supabase
      .from("vendors")
      .update({
        cover_url: uploadResult.publicUrl
      })
      .eq("id", vendor.id);

    vendor.cover_url = uploadResult.publicUrl;

    renderBranding();

    coverInput.value = "";

    if (coverLabel) {
      coverLabel.firstChild.textContent = "📷";
      coverLabel.style.pointerEvents = "";
    }

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

    // Same client-side size pre-check as cover — instant feedback.
    const maxLogoSize = 1 * 1024 * 1024;

    if (file.size > maxLogoSize) {
      alert("Logo image must be 1MB or smaller. Please choose a smaller file.");
      logoInput.value = "";
      return;
    }

    if (logoLabel) {
      logoLabel.style.pointerEvents = "none";
      logoLabel.firstChild.textContent = "⏳";
    }

    if (vendor.logo_url) {

      const oldPath = vendor.logo_url.split("/vendor-branding/")[1];

      if (oldPath) {
        await supabase.storage
          .from("vendor-branding")
          .remove([oldPath]);
      }

    }

    let uploadResult;

    try {
      uploadResult = await uploadVendorFile(file, "logo");
    } catch (err) {
      console.error("Logo Upload Error:", err.message);
      alert(err.message || "Logo upload failed.");
      logoInput.value = "";
      if (logoLabel) {
        logoLabel.firstChild.textContent = "📷";
        logoLabel.style.pointerEvents = "";
      }
      return;
    }

    await supabase
      .from("vendors")
      .update({ logo_url: uploadResult.publicUrl })
      .eq("id", vendor.id);

    vendor.logo_url = uploadResult.publicUrl;

    renderBranding();

    logoInput.value = "";

    if (logoLabel) {
      logoLabel.firstChild.textContent = "📷";
      logoLabel.style.pointerEvents = "";
    }

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