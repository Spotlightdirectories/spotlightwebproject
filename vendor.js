// ✅ Supabase setup
//const SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
//const SUPABASE_ANON_KEY =
  //"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";

//const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {

  console.log("✅ vendor.js is running");

  // ===============================
  // DOM ELEMENTS
  // ===============================
  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  const locationToggle = document.getElementById("locationToggle");
  const locationHint = document.getElementById("locationHint");
  const vendorsGrid = document.getElementById("vendorsGrid");
  const resultsCount = document.getElementById("resultsCount");
  const categorySelect = document.getElementById("categorySelect");
  const subcategorySelect = document.getElementById("subcategorySelect");

  // ===============================
  // STATE
  // ===============================
  let userLocation = null;

  // ===============================
  // DUMMY VENDOR DATA
  // ===============================
  const vendors = [
    {
      id: 1,
      name: "Mama T’s Kitchen",
      category: "Canteen",
      subcategory: "Mama Put",
      address: "Alimosho, Lagos",
      latitude: 6.6175,
      longitude: 3.2916,
      phone: "2348012345678",
      verification_status: "blue",
      is_premium: true
    },
    {
      id: 2,
      name: "Bright Spark Electricians",
      category: "Home Services",
      subcategory: "Electrician",
      address: "Egbeda, Lagos",
      latitude: 6.6098,
      longitude: 3.3051,
      phone: "2348098765432",
      verification_status: "gray",
      is_premium: false
    },
    {
      id: 3,
      name: "Calabar Delight",
      category: "Canteen",
      subcategory: "Calabar Kitchen",
      address: "Akowonjo, Lagos",
      latitude: 6.6202,
      longitude: 3.2804,
      phone: "2348076543210",
      verification_status: "none",
      is_premium: true
    }
  ];

  // ===============================
  // HELPERS
  // ===============================
  function renderBadge(status) {
    if (status === "blue") return `<img src="images/bluebadge.png" class="verification-badge">`;
    if (status === "gray") return `<img src="images/graybadge.png" class="verification-badge">`;
    return "";
  }

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

function renderVendorCard(vendor) {
  return `
    <article class="vendor-card">
      <div class="vendor-header">
        <h3>${vendor.name}</h3>
        ${renderBadge(vendor.verification_status)}
      </div>

      <p class="category">
        ${vendor.category} • ${vendor.subcategory}
      </p>

      <p class="address">${vendor.address}</p>

      ${vendor.distance !== undefined
        ? `<p class="distance">${vendor.distance.toFixed(1)} km away</p>`
        : ``}

      <div class="actions">
        <a href="https://wa.me/${vendor.phone}" target="_blank" rel="noopener">
          WhatsApp
        </a>

        <a
          href="https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}"
          target="_blank"
          rel="noopener"
        >
          Map
        </a>

        ${vendor.is_premium
          ? `<a href="/vendors/${vendor.id}">View Profile</a>`
          : ``}
      </div>
    </article>
  `;
}


  function renderVendors(list) {
    vendorsGrid.innerHTML = list.length
      ? list.map(renderVendorCard).join("")
      : "<p>No vendors found</p>";
    resultsCount.textContent = `${list.length} vendors found`;
  }

  function populateCategories(list) {
    const cats = [...new Set(list.map(v => v.category))];
    categorySelect.innerHTML = `<option value="">All Categories</option>` +
      cats.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  function populateSubcategories(list, cat) {
    const subs = [...new Set(list.filter(v => v.category === cat).map(v => v.subcategory))];
    subcategorySelect.disabled = !cat;
    subcategorySelect.innerHTML = `<option value="">All Subcategories</option>` +
      subs.map(s => `<option value="${s}">${s}</option>`).join("");
  }

  function applyFilters() {
    let filtered = vendors.filter(v =>
      (!searchInput.value ||
        v.name.toLowerCase().includes(searchInput.value.toLowerCase()) ||
        v.category.toLowerCase().includes(searchInput.value.toLowerCase()) ||
        v.subcategory.toLowerCase().includes(searchInput.value.toLowerCase())) &&
      (!categorySelect.value || v.category === categorySelect.value) &&
      (!subcategorySelect.value || v.subcategory === subcategorySelect.value)
    );

    if (userLocation) {
      filtered = filtered
        .map(v => ({
          ...v,
          distance: haversineDistance(
            userLocation.lat,
            userLocation.lng,
            v.latitude,
            v.longitude
          )
        }))
        .filter(v => v.distance <= 10)
        .sort((a, b) => a.distance - b.distance);
    }

    renderVendors(filtered);
  }

  // ===============================
  // EVENT LISTENERS
  // ===============================
  searchForm.addEventListener("submit", e => {
    e.preventDefault();
    applyFilters();
  });

  categorySelect.addEventListener("change", () => {
    populateSubcategories(vendors, categorySelect.value);
    applyFilters();
  });

  subcategorySelect.addEventListener("change", applyFilters);

  locationToggle.addEventListener("change", () => {
    locationHint.classList.toggle("hidden", !locationToggle.checked);

    if (!locationToggle.checked) {
      userLocation = null;
      applyFilters();
      return;
    }

    navigator.geolocation.getCurrentPosition(pos => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      applyFilters();
    });
  });

  // ===============================
  // INIT
  // ===============================
  populateCategories(vendors);
  renderVendors(vendors);

});


