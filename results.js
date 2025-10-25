// ✅ Supabase setup
const SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ Extract URL params
const params = new URLSearchParams(window.location.search);
const searchType = params.get("type");
const searchTerm = params.get("term");

const resultsTitle = document.getElementById("results-title");
const resultsContainer = document.getElementById("results-container");

// ✅ Haversine formula
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ✅ Check if coordinates are reasonable (within Nigeria)
function isWithinNigeria(lat, lon) {
  // Nigeria roughly spans between latitudes 4–14°N, longitudes 3–15°E
  return lat >= 4 && lat <= 14 && lon >= 3 && lon <= 15;
}

// ✅ Lagos fallback coordinates
const LAGOS_COORDS = { lat: 6.5244, lon: 3.3792 };

// ✅ Load vendors and filter
(async function () {
  try {
    let userLat, userLon;

    try {
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        })
      );

      userLat = position.coords.latitude;
      userLon = position.coords.longitude;

      // ✅ Validate location sanity
      if (!isWithinNigeria(userLat, userLon)) {
        console.warn("Detected location seems outside Nigeria. Using Lagos instead.");
        alert("⚠️ Location not accurate — showing results around Lagos.");
        userLat = LAGOS_COORDS.lat;
        userLon = LAGOS_COORDS.lon;
      }
    } catch (geoErr) {
      console.warn("Geolocation failed or blocked. Falling back to Lagos.");
      alert("⚠️ Unable to detect location — showing results around Lagos.");
      userLat = LAGOS_COORDS.lat;
      userLon = LAGOS_COORDS.lon;
    }

    const { data: vendors, error } = await supabase.from("Vendors").select("*");
    if (error) throw error;

    console.log("Fetched vendors:", vendors);
    console.log("User location used:", userLat, userLon);
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

    // ✅ Update results section
    resultsTitle.textContent = `${searchTerm}s Nearby`;
    resultsContainer.innerHTML =
      filtered.length > 0
        ? filtered
            .map(
              (v) => `
              <div class="vendor-card">
                <h3>
                  <a href="vendor.html?id=${v.id}" class="vendor-link">${v.name}</a>
                </h3>
                <p>${v.address}</p>
                <p><strong>Distance:</strong> ${v.distance.toFixed(1)} km away</p>
                ${
                  v.phone
                    ? `<a class="whatsapp-btn" href="https://wa.me/${v.phone}" target="_blank">Chat on WhatsApp</a>`
                    : ""
                }
              </div>
            `
            )
            .join("")
        : "<p>No vendors found within 100 km.</p>";
  } catch (err) {
    console.error("Error loading results:", err);
    resultsContainer.innerHTML =
      "<p>Unable to get location or load results.</p>";
  }
})();
