const params = new URLSearchParams(window.location.search);
const vendorId = params.get("id");

const vendorName = document.getElementById("vendorName");
const vendorContent = document.getElementById("vendorContent");

(async function () {
  try {
    const { data: vendor, error } = await supabaseClient
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    if (error || !vendor) {
      vendorContent.innerHTML = "<p>Vendor not found.</p>";
      return;
    }

    vendorName.textContent = vendor.name;

    // ✅ Basic info (always shown)
    let html = `
      <div class="vendor-details">
        <p><strong>Category:</strong> ${vendor.category || "N/A"}</p>
        <p><strong>Address:</strong> ${vendor.address || "N/A"}</p>
        <p><strong>Phone:</strong> ${vendor.phone || "N/A"}</p>
        <p><strong>Email:</strong> ${vendor.email || "N/A"}</p>
        ${
          vendor.phone
            ? `<p><a class="whatsapp-btn" href="https://wa.me/${vendor.phone}" target="_blank">Chat on WhatsApp</a></p>`
            : ""
        }
      </div>
    `;

    // ✅ For paid plans, add more details
    if (vendor.plan && vendor.plan.toLowerCase() !== "free") {
      if (vendor.logo_url) {
        html += `<img src="${vendor.logo_url}" alt="${vendor.name} Logo" class="vendor-logo" />`;
      }

      if (vendor.description) {
        html += `<p class="vendor-description">${vendor.description}</p>`;
      }

      if (vendor.video_url) {
        html += `
          <div class="vendor-video">
            <video width="100%" controls>
              <source src="${vendor.video_url}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>
        `;
      }

      if (vendor.gallery_urls && vendor.gallery_urls.length > 0) {
        html += `
          <div class="vendor-gallery">
            ${vendor.gallery_urls
              .map((img) => `<img src="${img}" class="gallery-image" />`)
              .join("")}
          </div>
        `;
      }
    } else {
      // ✅ Message for free vendors
      html += `
        <div class="upgrade-hint">
          <p>Want to showcase your profile picture, gallery, logo, and videos?</p>
          <a href="getListed.html" class="upgrade-btn">Upgrade Your Plan</a>
        </div>
      `;
    }

    vendorContent.innerHTML = html;
  } catch (err) {
    console.error(err);
    vendorContent.innerHTML =
      "<p>Something went wrong loading this vendor's page.</p>";
  }
})();