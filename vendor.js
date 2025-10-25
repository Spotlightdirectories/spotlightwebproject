// ✅ Supabase setup
const SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const vendorId = params.get("id");

const vendorName = document.getElementById("vendor-name");
const vendorContent = document.getElementById("vendor-content");

(async function () {
  try {
    const { data: vendor, error } = await supabase
      .from("Vendors")
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