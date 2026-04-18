document.addEventListener("DOMContentLoaded", async () => {

  const BADGE_TOOLTIPS = {
  blue: "Verified Business — official business documents reviewed by Spotlight. This vendor operates a registered and credible business.",
  gray: "Verified Identity — business owner identity confirmed"
};

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
        subscription_status,
        onboarding_completed,
        account_status
      `)
      .eq("subscription_status", "active")
      .eq("onboarding_completed", true);

    if (error) {
     console.error("Vendors fetch error:", error);
     vendorsGrid.innerHTML = "<p>Error loading vendors</p>";
     return;
    }
     
  const { data: branches, error: branchesError } = await supabase
  .from("branches")
  .select(`
    id,
    vendor_id,
    branch_name,
    address,
    latitude,
    longitude,
    phone,
    whatsapp
  `);

if (branchesError) {
  console.error("Branches fetch error:", branchesError);
}

    vendors = (data || []).filter(v => v.account_status === "active");

  const vendorMap = {};
   vendors.forEach(v => {
    vendorMap[v.id] = v;
  });

if (branches && branches.length) {

  branches.forEach(branch => {

  const parentVendor = vendorMap[branch.vendor_id];

if (!parentVendor || parentVendor.onboarding_completed !== true) return;

    vendors.push({
      id: branch.id,
      name: branch.branch_name,
      category: parentVendor.category,
      subcategory: parentVendor.subcategory,
      address: branch.address,
      state: parentVendor.state,
      lga: parentVendor.lga,
      latitude: branch.latitude,
      longitude: branch.longitude,
      whatsapp: branch.whatsapp || parentVendor.whatsapp,
      telephone: branch.phone || parentVendor.telephone,
      verification_status: parentVendor.verification_status,
      plan_tier: parentVendor.plan_tier,
      is_premium: parentVendor.is_premium,
      slug: parentVendor.slug,
      subscription_status: parentVendor.subscription_status
    });

  });

}

    populateCategories();
    renderVendors(vendors);
  }

  // ===============================
  // HELPERS
  // ===============================

  function formatWhatsAppNumber(num) {

  if (!num) return "";

  let clean = String(num).replace(/\D/g, "");

  // Nigeria fix
  if (clean.startsWith("0")) {
    clean = "234" + clean.slice(1);
  }

  // If already starts with 234 → keep
  if (clean.startsWith("234")) {
    return clean;
  }

  return clean;
}

function renderBadge(status) {

  if (!status) return "";

  const normalized = String(status).toLowerCase();

  if (normalized === "blue") {
    return `
      <span class="badge-wrap" data-tooltip="${BADGE_TOOLTIPS.blue}">
        <img src="images/bluebadge.png" class="verification-badge">
      </span>
    `;
  }

  if (status === "gray") {
    return `
      <span class="badge-wrap" data-tooltip="${BADGE_TOOLTIPS.gray}">
        <img src="images/graybadge.png" class="verification-badge">
      </span>
    `;
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

  const category = v.category || "";
  const subcategory = v.subcategory || "";

  return `
    <article class="vendor-card">
      <h3 class="vendor-name">
        ${v.name}
        ${renderBadge(v.verification_status)}
      </h3>

      <p class="vendor-category">
        ${category ? `<span class="cat">${category}</span>` : ""}
        ${subcategory ? `<span class="dot"> • </span><span class="subcat">${subcategory}</span>` : ""}
      </p>

      <p>${v.address || ""}</p>

      ${typeof v.distance === "number"
        ? `<p class="distance">${v.distance.toFixed(1)} km away</p>`
        : ""}

      <div class="actions">
        ${v.whatsapp ? `
          <a href="https://wa.me/${formatWhatsAppNumber(v.whatsapp)}" target="_blank">
            WhatsApp
          </a>
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

  const safeList = list.filter(v => v && v.name);

  vendorsGrid.innerHTML = safeList.length
    ? safeList.map(renderVendorCard).join("")
    : "<p>No vendors found</p>";

  resultsCount.textContent = `${safeList.length} vendors found`;
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
        .filter(v => v.distance <= 15)
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

    if (!navigator.geolocation) {
      console.error("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {

         // 🔒 Accuracy check
     if (pos.coords.accuracy > 100) {
        console.warn("Low accuracy location:", pos.coords.accuracy);

        locationHint.classList.remove("hidden");
        locationHint.textContent =
           "Using approximate location. Results may be less accurate.";
      }

       userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      applyFilters();
     },
     err => {
  console.error("Location error:", err);

  // ===============================
  // GEOJS FALLBACK
  // ===============================
  fetch("https://get.geojs.io/v1/ip/geo.json")
    .then(res => res.json())
    .then(data => {
      userLocation = {
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude)
      };

      locationHint.classList.remove("hidden");
      locationHint.textContent =
        "Using approximate location based on network.";

      applyFilters();
    })
    .catch(e => {
      console.error("GeoJS fallback failed:", e);
    });
},

     {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
     }
   );
  });

  // ===============================
  // INIT
  // ===============================

  await loadVendors();

});
