// ✅ Supabase setup
//now exist in supabase-client.js

document.addEventListener("DOMContentLoaded", () => {

  console.log("✅ vendor.js is running");

  const supabase = window.supabaseClient;

  function renderBadge(status) {
  if (status === "blue") {
    return `<img src="images/bluebadge.png" alt="Fully verified" class="verification-badge">`;
  }
  if (status === "gray") {
    return `<img src="images/graybadge.png" alt="Partially verified" class="verification-badge">`;
  }
  return "";
}



  async function loadVendors() {
  console.log("🔄 Loading vendors from Supabase...");

  const { data, error } = await supabase
    .from("vendors")
    .select(`
      id,
      name,
      category,
      subcategory,
      address,
      state,
      lga,
      latitude,
      longitude,
      phone,
      verification_status,
      plan_tier,
      is_premium,
      is_demo,
      slug
    `);

  if (error) {
    console.error("❌ Supabase fetch error:", error);
    return;
  }

  console.log("✅ Vendors fetched:", data);

  vendors = data;
  populateCategories(vendors);
  applyFilters();
}

loadVendors(); 

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

  let vendors = [];

  // ===============================
  // HELPERS
  // ===============================


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
         ${[vendor.category, vendor.subcategory].filter(Boolean).join(" • ")}
      </p>

      <p class="address">${vendor.address}</p>

      ${vendor.distance !== undefined
        ? `<p class="distance">${vendor.distance.toFixed(1)} km away</p>`
        : ``}

      <div class="actions">
        <a href="https://wa.me/${vendor.phone}" target="_blank" rel="noopener">
          WhatsApp
        </a>

        ${(() => {
      if (vendor.latitude && vendor.longitude) {
       return `<a
         href="https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}"
         target="_blank"
         rel="noopener"
         >Map</a>`;
      }

      if (vendor.address) {
       return `<a
        href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address)}"
        target="_blank"
        rel="noopener"
        >Map</a>`;
     }

      return ``;
    })()}


        ${vendor.is_premium
          ? `<a href="vendor-profile.html?slug=${vendor.slug}">
  View Profile
</a>
`
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


