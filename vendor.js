// ✅ Supabase setup
//const SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
//const SUPABASE_ANON_KEY =
  //"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";

//const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// ===============================
// LOCATION TOGGLE UI
// ===============================
locationToggle.addEventListener("change", () => {
  locationHint.classList.toggle("hidden", !locationToggle.checked);
});

// ===============================
// DUMMY VENDOR DATA (PHASE 1A)
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
// BADGE RENDERER (SINGLE SOURCE)
// ===============================
function renderBadge(status) {
  if (status === "blue") {
    return `<img src="images/bluebadge.png" alt="Fully verified" class="verification-badge">`;
  }

  if (status === "gray") {
    return `<img src="images/graybadge.png" alt="Partially verified" class="verification-badge">`;
  }

  return "";
}

// ===============================
// VENDOR CARD TEMPLATE
// ===============================
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

      <div class="actions">
        <a href="https://wa.me/${vendor.phone}" target="_blank" rel="noopener">WhatsApp</a>
        <a
          href="https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}"
          target="_blank"
          rel="noopener"
        >
          Map
        </a>
        ${vendor.is_premium ? `<a href="/vendors/${vendor.id}">View Profile</a>` : ``}
      </div>
    </article>
  `;
}

// ===============================
// RENDER VENDORS
// ===============================
function renderVendors(list) {
  vendorsGrid.innerHTML = "";
  resultsCount.textContent = "";

  if (!list.length) {
    vendorsGrid.innerHTML = "<p>No vendors found.</p>";
    return;
  }

  list.forEach(vendor => {
    vendorsGrid.insertAdjacentHTML("beforeend", renderVendorCard(vendor));
  });

  resultsCount.textContent = `${list.length} vendors found`;
}

// ===============================
// INITIAL LOAD
// ===============================
renderVendors(vendors);

// ===============================
// FORM SUBMIT (PHASE 1B READY)
// ===============================
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const query = searchInput.value.toLowerCase().trim();

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(query) ||
    v.category.toLowerCase().includes(query) ||
    v.subcategory.toLowerCase().includes(query)
  );

  renderVendors(filtered);
});