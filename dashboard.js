document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const MEDIA_LIMITS = {
  free: {
    gallery: 0,
    videoSeconds: 0
  },
  standard: {
    gallery: 6,
    videoSeconds: 20
  },
  enterprise: {
    gallery: 12,
    videoSeconds: 40
  },
  elite: {
    gallery: 20,
    videoSeconds: 60
  },
  custom: {
    gallery: 50,
    videoSeconds: 120
  }
};

  // 1️⃣ Ensure user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // 2️⃣ Fetch vendor linked to this user
  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !vendor) {
    console.error("Vendor not found:", error);
    alert("Vendor profile not found. Please complete onboarding.");
    window.location.href = "getlisted.html";
    return;
  }

  // 🔒 BLOCK BASIC VENDORS FROM DASHBOARD
if (vendor.subscription_status !== "active") {
  window.location.href = `vendor-profile.html?slug=${vendor.slug}`;
  return;
}



// ===============================
// LOAD EXISTING MEDIA (PHASE 2C-4)
// ===============================
const galleryPreview = document.getElementById("galleryPreview");
const videoPreview = document.getElementById("videoPreview");

// Guard: dashboard may not have media section yet
if (galleryPreview && Array.isArray(vendor.gallery_image_url)) {
  galleryPreview.innerHTML = vendor.gallery_image_url
    .map((url, index) => `
      <div class="media-thumb">
        <img src="${url}" alt="Gallery image">
        <button
          type="button"
          class="remove-media"
          data-index="${index}"
        >✕</button>
      </div>
    `)
    .join("");
}

if (videoPreview && vendor.promo_video_url) {
  videoPreview.innerHTML = `
    <video controls src="${vendor.promo_video_url}"></video>
    <button
      type="button"
      id="removeVideoBtn"
      class="remove-media"
    >
      Remove video
    </button>
  `;
}


const galleryInput = document.getElementById("galleryInput");
const videoInput = document.getElementById("videoInput");
const mediaError = document.getElementById("mediaError");
const mediaSuccess = document.getElementById("mediaSuccess");

const limits = MEDIA_LIMITS[vendor.plan_tier];

galleryInput?.addEventListener("change", async (e) => {
  mediaError.classList.add("hidden");
  mediaSuccess.classList.add("hidden");

  if (limits.gallery === 0) {
    mediaError.textContent = "Your plan does not support gallery images.";
    mediaError.classList.remove("hidden");
    return;
  }

  const files = Array.from(e.target.files).slice(0, limits.gallery);
  const uploadedUrls = [];

  for (const file of files) {
    if (file.size > 1_000_000) continue;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}-${Math.random()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("vendor-gallery")
      .upload(path, file);

    if (uploadErr) continue;

    const { data } = supabase.storage
      .from("vendor-gallery")
      .getPublicUrl(path);

    uploadedUrls.push(data.publicUrl);
  }

  if (!uploadedUrls.length) return;

  await supabase
    .from("vendors")
    .update({ gallery_image_url: uploadedUrls })
    .eq("auth_user_id", user.id);

  mediaSuccess.textContent = "Gallery uploaded successfully ✓";
  mediaSuccess.classList.remove("hidden");
});

videoInput?.addEventListener("change", async (e) => {
  mediaError.classList.add("hidden");
  mediaSuccess.classList.add("hidden");

  if (limits.videoSeconds === 0) {
    mediaError.textContent = "Your plan does not support video uploads.";
    mediaError.classList.remove("hidden");
    return;
  }

  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 20_000_000) {
    mediaError.textContent = "Video file too large.";
    mediaError.classList.remove("hidden");
    return;
  }

  const ext = file.name.split(".").pop();
  const path = `${user.id}/promo.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("vendor-videos")
    .upload(path, file, { upsert: true });

  if (uploadErr) {
    mediaError.textContent = uploadErr.message;
    mediaError.classList.remove("hidden");
    return;
  }

  const { data } = supabase.storage
    .from("vendor-videos")
    .getPublicUrl(path);

  await supabase
    .from("vendors")
    .update({ promo_video_url: data.publicUrl })
    .eq("auth_user_id", user.id);

  mediaSuccess.textContent = "Video uploaded successfully ✓";
  mediaSuccess.classList.remove("hidden");
});

// ===============================
// MEDIA UPLOADS (LOGO & COVER)
// ===============================
const logoInput = document.getElementById("logoInput");
const coverInput = document.getElementById("coverInput");
const uploadError = document.getElementById("uploadError");
const uploadSuccess = document.getElementById("uploadSuccess");

async function uploadImage(file, bucket, column) {
  uploadError.classList.add("hidden");
  uploadSuccess.classList.add("hidden");

  if (!file) return;

  // Size limits
  const maxSize = bucket === "vendor-logos" ? 1_000_000 : 2_000_000;
  if (file.size > maxSize) {
    uploadError.textContent = "File too large.";
    uploadError.classList.remove("hidden");
    return;
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${user.id}/${Date.now()}.${fileExt}`;

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { upsert: true });

  if (uploadErr) {
    uploadError.textContent = uploadErr.message;
    uploadError.classList.remove("hidden");
    return;
  }

  // Get public URL
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  // Save URL to vendor record
  const { error: dbErr } = await supabase
    .from("vendors")
    .update({ [column]: data.publicUrl })
    .eq("auth_user_id", user.id);

  if (dbErr) {
    uploadError.textContent = dbErr.message;
    uploadError.classList.remove("hidden");
    return;
  }

  uploadSuccess.textContent = "Upload successful ✓";
  uploadSuccess.classList.remove("hidden");
}


  // 3️⃣ Populate dashboard
    document.getElementById("bizName")?.textContent = vendor.name;
    document.getElementById("bizPlan")?.textContent = vendor.plan_tier;

  // ===============================
// PREFILL EDIT FORM
// ===============================
document.getElementById("editName").value = vendor.name || "";
document.getElementById("editAddress").value = vendor.address || "";
document.getElementById("editState").value = vendor.state || "";
document.getElementById("editLga").value = vendor.lga || "";
document.getElementById("editPhone").value = vendor.phone || "";
document.getElementById("editEmail").value = vendor.email || "";
// ===============================
// SAVE PROFILE UPDATES
// ===============================
document
  .getElementById("profileForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("saveProfileBtn");
     submitBtn.disabled = true;
     submitBtn.textContent = "Saving...";


    const updates = {
      name: document.getElementById("editName").value.trim(),
      address: document.getElementById("editAddress").value.trim(),
      state: document.getElementById("editState").value.trim(),
      lga: document.getElementById("editLga").value.trim(),
      phone: document.getElementById("editPhone").value.trim(),
      email: document.getElementById("editEmail").value.trim(),
   };


    const { error } = await supabase
      .from("vendors")
      .update(updates)
      .eq("auth_user_id", user.id);

    const successEl = document.getElementById("profileSuccess");
    const errorEl = document.getElementById("profileError");

    successEl.classList.add("hidden");
    errorEl.classList.add("hidden");

    if (error) {
  errorEl.textContent = error.message;
  errorEl.classList.remove("hidden");
  submitBtn.disabled = false;
  submitBtn.textContent = "Save changes";
  return;
}

   successEl.classList.remove("hidden");
   submitBtn.textContent = "Saved ✓";
   setTimeout(() => {
   submitBtn.disabled = false;
   submitBtn.textContent = "Save changes";
 }, 1500);
});

// ===============================
// REMOVE GALLERY IMAGE
// ===============================
const galleryPreviewEl = document.getElementById("galleryPreview");

galleryPreviewEl?.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("remove-media")) return;

  const index = Number(e.target.dataset.index);

  if (!Array.isArray(vendor.gallery_image_url)) return;

  const updatedGallery = [...vendor.gallery_image_url];
  updatedGallery.splice(index, 1);

  const { error } = await supabase
    .from("vendors")
    .update({ gallery_image_url: updatedGallery })
    .eq("auth_user_id", user.id);

  if (error) {
    alert(error.message);
    return;
  }

  vendor.gallery_image_url = updatedGallery;
  e.target.closest(".media-thumb")?.remove();
});

// ===============================
// REMOVE PROMO VIDEO
// ===============================
const videoPreviewEl = document.getElementById("videoPreview");

videoPreviewEl?.addEventListener("click", async (e) => {
  if (e.target.id !== "removeVideoBtn") return;

                     

  if (error) {
    alert(error.message);
    return;
  }

  videoPreviewEl.innerHTML = "";
});


  document.getElementById("planTier").textContent = vendor.plan_tier;
  document.getElementById("verificationStatus").textContent =
    vendor.verification_status || "Not verified";

  const profileLink = document.getElementById("profileLink");
  profileLink.href = `vendor-profile.html?slug=${vendor.slug}`;

  // 4️⃣ Logout
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });

  logoInput?.addEventListener("change", (e) => {
  uploadImage(e.target.files[0], "vendor-logos", "logo_url");
});

coverInput?.addEventListener("change", (e) => {
  uploadImage(e.target.files[0], "vendor-covers", "cover_url");
});

});
