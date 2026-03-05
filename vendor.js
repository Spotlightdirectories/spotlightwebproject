document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;

  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  const locationToggle = document.getElementById("locationToggle");
  const locationHint = document.getElementById("locationHint");
  const vendorsGrid = document.getElementById("vendorsGrid");
  const resultsCount = document.getElementById("resultsCount");
  const categorySelect = document.getElementById("categorySelect");
  const subcategorySelect = document.getElementById("subcategorySelect");

  let vendors = [];
  let userLocation = null;

  // ===============================
  // LOAD VENDORS
  // ===============================

  async function loadVendors() {
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
        whatsapp,
        telephone,
        verification_status,
        plan_tier,
        is_premium,
        slug,
        subscription_status
      `)
      .eq("subscription_status", "active");

    if (error) {
      console.error("Supabase error:", error);
      vendorsGrid.innerHTML = "<p>Error loading vendors</p>";
      return;
    }

    vendors = data || [];

    populateCategories();
    renderVendors(vendors);
  }

  // ===============================
  // HELPERS
  // ===============================

  function renderBadge(status) {

  if (!status) return "";

  if (status === "blue") {
    return `<img src="images/bluebadge.png" class="card-badge">`;
  }

  if (status === "gray") {
    return `<img src="images/graybadge.png" class="card-badge">`;
  }

  return "";
}

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function renderVendorCard(v) {
  return `
    <article class="vendor-card">
      <h3 class="vendor-name">
        ${v.name}
        ${renderBadge(v.verification_status)}
      </h3>

      <p>
        ${(v.category || "")}
        ${v.subcategory ? " • <strong>" + v.subcategory + "</strong>" : ""}
      </p>

      <p>${v.address || ""}</p>

      ${v.distance !== undefined
        ? `<p class="distance">${v.distance.toFixed(1)} km away</p>`
        : ""}

      <div class="actions">
        ${v.whatsapp ? `
          <a href="https://wa.me/${v.whatsapp}" target="_blank">WhatsApp</a>
        ` : ""}

        ${v.telephone ? `
          <a href="tel:${v.telephone}">Call</a>
        ` : ""}

        ${v.latitude && v.longitude ? `
          <a href="https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}" target="_blank">
            Map
          </a>
        ` : ""}

        <a href="vendor-profile.html?slug=${v.slug}" class="view-profile">
        View Profile
        </a>
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

  function populateCategories() {
    const categories = [...new Set(
      vendors.map(v => v.category).filter(Boolean)
    )];

    categorySelect.innerHTML =
      `<option value="">All Categories</option>` +
      categories.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  function populateSubcategories(selectedCategory) {
    const subs = [...new Set(
      vendors
        .filter(v => v.category === selectedCategory)
        .map(v => v.subcategory)
        .filter(Boolean)
    )];

    subcategorySelect.disabled = !selectedCategory;

    subcategorySelect.innerHTML =
      `<option value="">All Subcategories</option>` +
      subs.map(s => `<option value="${s}">${s}</option>`).join("");
  }

  function applyFilters() {
    const searchText = (searchInput.value || "").toLowerCase();

    let filtered = vendors.filter(v => {
      const name = (v.name || "").toLowerCase();
      const category = (v.category || "").toLowerCase();
      const subcategory = (v.subcategory || "").toLowerCase();

      return (
        (!searchText ||
          name.includes(searchText) ||
          category.includes(searchText) ||
          subcategory.includes(searchText)) &&
        (!categorySelect.value || v.category === categorySelect.value) &&
        (!subcategorySelect.value || v.subcategory === subcategorySelect.value)
      );
    });

    // Location filtering
    if (userLocation) {
      filtered = filtered
        .filter(v => v.latitude && v.longitude)
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
  // EVENTS
  // ===============================

  searchForm.addEventListener("submit", e => {
    e.preventDefault();
    applyFilters();
  });

  categorySelect.addEventListener("change", () => {
    populateSubcategories(categorySelect.value);
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

    navigator.geolocation.getCurrentPosition(
      pos => {
        userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        applyFilters();
      },
      err => {
        console.error("Location error:", err);
     },
     {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 60000
     }
   );
  });

  // ===============================
  // INIT
  // ===============================

  await loadVendors();

});
