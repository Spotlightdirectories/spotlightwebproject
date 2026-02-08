// ✅ Supabase setup
//const SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
//const SUPABASE_ANON_KEY =
  //"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";
//const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ Extract URL params
const params = new URLSearchParams(window.location.search);
const searchType = params.get("type");
const searchTerm = params.get("term");

const resultsTitle = document.getElementById("results-title");
const resultsContainer = document.getElementById("results-container");

// ✅ Haversine formula
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ✅ Tooltip messages for badges
const badgeTooltips = {
  blue: "Verified: Email, Phone, ID, CAC, and Business Address",
  gray: "Verified: Email, Phone, and ID",
};

// ✅ Load vendors and filter
(async function () {
  try {
    let userLat, userLon;

    try {
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
        })
      );
      userLat = position.coords.latitude;
      userLon = position.coords.longitude;
    } catch (geoError) {
      // ⚠️ Lagos fallback
      console.warn("⚠️ Location error detected — using Lagos fallback.");
      userLat = 6.5244;
      userLon = 3.3792;
    }

     // ✅ Query vendors directly by category or name (case-insensitive)
       let query = supabase.from("vendors").select("*");

       if (searchType === "name") {
        query = query.ilike("name", `%${searchTerm}%`);
      } else if (searchType === "category") {
        query = query.ilike("category", `%${searchTerm}%`);
     }

       const { data: vendors, error } = await query;
       if (error) throw error;

    console.log("Fetched vendors:", vendors);
    console.log("User location:", userLat, userLon);
    console.log("Search type:", searchType, "Search term:", searchTerm);

    const filtered = vendors
      .map((vendor) => {
        if (!vendor.latitude || !vendor.longitude) return null;

        const match =
          searchType === "name"
            ? vendor.name?.toLowerCase().includes(searchTerm.toLowerCase())
            : vendor.category?.toLowerCase().includes(searchTerm.toLowerCase());

        if (!match) return null;

        const distance = getDistance(
          userLat,
          userLon,
          vendor.latitude,
          vendor.longitude
        );

        return { ...vendor, distance };
      })
      .filter((v) => v && v.distance <= 100)
      .sort((a, b) => a.distance - b.distance);

    // ✅ Build HTML results
    resultsTitle.textContent = `${searchTerm}s Nearby`;

    if (filtered.length === 0) {
      resultsContainer.innerHTML = "<p>No vendors found within 100 km.</p>";
      return;
    }

    resultsContainer.innerHTML = filtered
      .map((v) => {
        // Determine badge and status
        let badgeHTML = "";
        let verificationHTML = "";

        if (v.badge === "blue") {
          badgeHTML = `<img src="images/bluebadge.png" alt="Blue Verified Badge" class="vendor-badge" title="${badgeTooltips.blue}" />`;
        } else if (v.badge === "gray") {
          badgeHTML = `<img src="images/graybadge.png" alt="Gray Verified Badge" class="vendor-badge" title="${badgeTooltips.gray}" />`;
        } else {
          verificationHTML =
            '<p><em style="color:red;">Unverified</em> — proceed with caution</p>';
        }

        // Vendor image
        const profileImage = v.profile_image_url
          ? `<img src="${v.profile_image_url}" alt="${v.name}" class="vendor-photo" />`
          : `<div class="vendor-photo placeholder">No Image</div>`;

        return `
          <div class="vendor-card">
            <div class="vendor-header">
              ${profileImage}
              <div class="vendor-info">
                <h3>
                  <a href="vendor.html?id=${v.id}" class="vendor-link">${v.name}</a>
                  ${badgeHTML}
                </h3>
                ${verificationHTML}
              </div>
            </div>
            <p>${v.address || "Address not provided"}</p>
            <p><strong>Distance:</strong> ${v.distance.toFixed(1)} km away</p>
            ${
              v.phone
                ? `<a class="whatsapp-btn" href="https://wa.me/${v.phone}" target="_blank">Chat on WhatsApp</a>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Error loading results:", err);
    resultsContainer.innerHTML =
      "<p>Unable to get location or load results.</p>";
  }
})();