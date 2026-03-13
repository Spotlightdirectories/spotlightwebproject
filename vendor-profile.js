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

  const SOCIAL_LIMITS = {
    free: 0,
    standard: 2,
    enterprise: 3,
    elite: 5,
    custom: Infinity
  };

  const BRANCH_LIMITS = {
  free: 0,
  standard: 1,
  enterprise: 10,
  elite: 50,
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

      vendor.plan_tier = vendor.plan_tier || "free";

      const isFree = vendor.plan_tier === "free";

      const GALLERY_LIMITS = {
        free: 0,
        standard: 6,
        enterprise: 12,
        elite: 24,
        custom: 24
     };

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

      if (galleryInput && !isFree) {

         galleryInput.addEventListener("change", async (e) => {

           const file = e.target.files[0];
           if (!file) return;

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
        const { error: dbError } = await supabase
          .from("vendor_media")
          .insert({
            vendor_id: vendor.id,
            media_type: "image",
            file_url: data.publicUrl,
            display_order: Math.floor(Date.now() / 1000)
         });

    if (dbError) {
      console.error("DB error:", dbError.message);
      return;
    }

    location.reload();

  });

}

if (videoInput) {

  videoInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

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

  const oldPath = oldVideo.file_url.split("/vendor-videos/")[1];

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
  return;
}

location.reload();

  });

}

      const galleryUploader = document.getElementById("galleryUploader");

      
      if (galleryUploader && isOwner) {
        galleryUploader.classList.remove("hidden");
    }

    const videoLimits = VIDEO_LIMITS[vendor.plan_tier];

    if (videoUploader && isOwner && videoLimits.allowed) {
      videoUploader.classList.remove("hidden");
    }

      if (isFree && galleryInput) {
      galleryInput.disabled = true;
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

    document.execCommand(cmd, false, null);

  });

});

}

  } else {

    desc.innerHTML = vendor.description || "";

  }

}

    // -------------------------------
    // MEDIA
    // -------------------------------

    const mediaSection = document.getElementById("mediaSection");

    if (mediaSection) {
      mediaSection.classList.remove("hidden");
    }

    const videoWrap = document.getElementById("videoWrap");

    if (videoWrap && VIDEO_LIMITS[vendor.plan_tier].allowed) {
      videoWrap.classList.remove("hidden");
   }

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

  grid.innerHTML = "";

  const limit = GALLERY_LIMITS[vendor.plan_tier] ?? 0;

  const { data: images } = await supabase
    .from("vendor_media")
    .select("*")
    .eq("vendor_id", vendor.id)
    .eq("media_type", "image")
    .order("display_order", { ascending: true });

  const imageList = images || [];

  for (let i = 0; i < limit; i++) {

    const slot = document.createElement("div");
    slot.className = "gallery-item";

    if (!isOwner) {

  slot.addEventListener("click", () => {

    if (!imageList[i]) return;

    const mediaId = imageList[i].id;

    window.location.href = `vendor-product.html?media_id=${mediaId}`;

  });

}

    if (imageList[i]) {

      const img = document.createElement("img");
      img.src = imageList[i].file_url;

      const moveUpBtn = document.createElement("button");
      moveUpBtn.className = "gallery-move-up";
      moveUpBtn.textContent = "↑";

      const moveDownBtn = document.createElement("button");
      moveDownBtn.className = "gallery-move-down";
      moveDownBtn.textContent = "↓";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "gallery-delete";
      deleteBtn.textContent = "✕";

      if (!isOwner) {
      moveUpBtn.style.display = "none";
      moveDownBtn.style.display = "none";
      deleteBtn.style.display = "none";
      }

      deleteBtn.addEventListener("click", async () => {

        console.log("Delete button clicked");

        const confirmDelete = confirm("Delete this image?");
        if (!confirmDelete) return;

        const fileUrl = imageList[i].file_url;
        const path = fileUrl.split("/vendor-branding/")[1];

        await supabase.storage
          .from("vendor-branding")
          .remove([path]);

        await supabase
          .from("vendor_media")
          .delete()
          .eq("id", imageList[i].id);
          
          location.reload();

       });

moveUpBtn.addEventListener("click", async () => {

  if (i === 0) return;

  const current = imageList[i];
  const above = imageList[i - 1];

  const tempOrder = current.display_order;

  await supabase
    .from("vendor_media")
    .update({ display_order: -1 })
    .eq("id", above.id);

  await supabase
    .from("vendor_media")
    .update({ display_order: above.display_order })
    .eq("id", current.id);

  await supabase
    .from("vendor_media")
    .update({ display_order: tempOrder })
    .eq("id", above.id);

  location.reload();

});

moveDownBtn.addEventListener("click", async () => {

  if (i === imageList.length - 1) return;

  const current = imageList[i];
  const below = imageList[i + 1];

  const tempOrder = current.display_order;

  await supabase
    .from("vendor_media")
    .update({ display_order: -1 })
    .eq("id", below.id);

  await supabase
    .from("vendor_media")
    .update({ display_order: below.display_order })
    .eq("id", current.id);

  await supabase
    .from("vendor_media")
    .update({ display_order: tempOrder })
    .eq("id", below.id);

  location.reload();

});

      const meta = document.createElement("div");
      meta.className = "gallery-meta";

      const title = document.createElement("input");
      title.className = "gallery-title";
      title.placeholder = "Product or service name";
      title.value = imageList[i].title || "";

      if (!isOwner) {
        title.readOnly = true;
      }

      const desc = document.createElement("textarea");
      desc.className = "gallery-desc";
      desc.placeholder = "Describe the product or service (features, size, benefits, usage, delivery if applicable)";
      desc.value = imageList[i].description || "";

      if (!isOwner) {
        desc.readOnly = true;
      }

      const price = document.createElement("input");
      price.className = "gallery-price";
      price.type = "text";
      price.placeholder = "Price";
      price.step = "0.01";

      if (!isOwner) {
         price.readOnly = true;
      } 
      price.value = imageList[i].price
        ? "₦ " + Number(imageList[i].price).toLocaleString("en-NG", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
     : "";

      async function saveMeta() {

        console.log("saveMeta triggered");

    let priceValue = price.value.replace(/[^\d.]/g, "");

    console.log("Raw price input:", price.value);

    if (priceValue) {
      priceValue = parseFloat(priceValue);
    } else {
      priceValue = null;
    }

  const { data, error } = await supabase
    .from("vendor_media")
    .update({
      title: title.value.trim(),
      description: desc.value.trim(),
      price: priceValue
    })
    .eq("id", imageList[i].id)
    .select();
    console.log("Saved price value:", priceValue);
    console.log("Update returned data:", data);

  if (error) {
    console.error("Update error:", error.message);
  }

}

      title.addEventListener("blur", saveMeta);
      desc.addEventListener("blur", saveMeta);
      price.addEventListener("blur", saveMeta);

      meta.appendChild(desc);
      meta.appendChild(price);

      const wrapper = document.createElement("div");
      wrapper.className = "gallery-content";

      wrapper.appendChild(title);
      wrapper.appendChild(img);

      if (isOwner) {
        wrapper.appendChild(moveUpBtn);
        wrapper.appendChild(moveDownBtn);
        wrapper.appendChild(deleteBtn);
      }

      wrapper.appendChild(meta);

      slot.appendChild(wrapper);

    } else if (isOwner && !isFree) {

  const placeholder = document.createElement("div");
  placeholder.className = "gallery-placeholder";
  placeholder.textContent = "+";

  const meta = document.createElement("div");
  meta.className = "gallery-meta";

  const title = document.createElement("div");
  title.className = "gallery-title";
  title.textContent = "Title";

  const desc = document.createElement("div");
  desc.className = "gallery-desc";
  desc.textContent = "Description";

  const price = document.createElement("div");
  price.className = "gallery-price";
  price.textContent = "Price";

  meta.appendChild(desc);
  meta.appendChild(price);

  const wrapper = document.createElement("div");
  wrapper.className = "gallery-content";

  wrapper.appendChild(placeholder);
  wrapper.appendChild(meta);

  slot.appendChild(wrapper);

}

    grid.appendChild(slot);

  }

}

loadGallery();

async function loadVideo() {

  const { data: videos } = await supabase
    .from("vendor_media")
    .select("*")
    .eq("vendor_id", vendor.id)
    .eq("media_type", "video")
    .limit(1);

  if (!videos || videos.length === 0) return;

  const videoRecord = videos[0];

  const deleteBtn = document.getElementById("deleteVideoBtn");

if (deleteBtn) {

  deleteBtn.onclick = async () => {

    const confirmDelete = confirm("Delete this video?");
    if (!confirmDelete) return;

    const videoPath = videoRecord.file_url.split("/vendor-videos/")[1];

    await supabase.storage
      .from("vendor-videos")
      .remove([videoPath]);

    await supabase
      .from("vendor_media")
      .delete()
      .eq("id", videoRecord.id);

    location.reload();

  };

}

  const videoPlayer = document.getElementById("vendorVideo");

  if (videoPlayer) {
  videoPlayer.src = videoRecord.file_url;
  videoPlayer.style.display = "block";
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

links.forEach(link => {

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

      const { error } = await supabase
        .from("vendor_social_links")
        .delete()
        .eq("id", link.id);

      if (!error) location.reload();

    });

    wrapper.appendChild(del);

  }

  row.appendChild(wrapper);

});

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
    const url = document.getElementById("socialUrl").value.trim();

    if (!url) {
      alert("Please enter a link.");
      return;
    }
    
    // Check plan limit
    const { data: existingLinks } = await supabase
      .from("vendor_social_links")
      .select("id")
      .eq("vendor_id", vendor.id);

    const limit = SOCIAL_LIMITS[vendor.plan_tier] ?? 0;

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

    location.reload();

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
    // -------------------------------
    // OWNER MODE — Enable Branding Upload
    // -------------------------------
    if (isOwner) {

    const socialEditor = document.getElementById("socialEditor");
    const socialLimit = SOCIAL_LIMITS[vendor.plan_tier] ?? 0;

    if (socialEditor) {

      socialEditor.classList.remove("hidden");

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
