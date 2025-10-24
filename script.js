
// hamburger MENU SCRIPT

document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector('nav ul');
  const openBtn = document.querySelector('.menu-open');
  const closeBtn = document.querySelector('.xclose');

  if (openBtn && closeBtn && menu) {
  openBtn.addEventListener('click', () => {
      menu.classList.add('open')
   });
  
    closeBtn.addEventListener('click', () => {
      menu.classList.remove('open')
    });
   }
 });

// END OF hamburger MENU SCRIPT


// FAQ TOGGLE SCRIPT
document.addEventListener('DOMContentLoaded', () => {
const headers = document.querySelectorAll('.accordion-header');

headers.forEach(header => {
  header.addEventListener('click', () => {

          // 1️⃣ Close all others first
      headers.forEach(h => {
        if (h !== header) {
          h.classList.remove('active');
        }
      });


     // 2️⃣ Toggle the clicked one
    header.classList.toggle('active');
    });
  });
});
// END OF FAQ TOGGLE SCRIPT

//GET LISTED PLAN TOGGLE SCRIPT

  const toggle = document.getElementById("billingToggle");
  console.log(toggle);
  const prices = document.querySelectorAll(".price");
  const yearlyTexts = document.querySelectorAll(".yearly");

  toggle.addEventListener("change", () => {
    const yearly = toggle.checked;

    prices.forEach(price => {
      price.textContent = yearly 
        ? price.getAttribute("data-yearly") 
        : price.getAttribute("data-monthly");
    });

    yearlyTexts.forEach(text => {
      text.style.display = yearly ? "none" : "block";
    });
  });
// END OF GET LISTED PLAN TOGGLE SCRIPT

// ADDON BILLING TOGGLE SCRIPT

//<script defer>
document.addEventListener("DOMContentLoaded", function() {
  const toggle = document.getElementById("addonBillingToggle");
  const cards = document.querySelectorAll(".addon-card");

  function updatePrices() {
    const yearly = toggle.checked;
    cards.forEach(card => {
      const basicPrice = card.querySelector(".addon-plan.addon-basic .addon-price");
      const proPrice = card.querySelector(".addon-plan.addon-pro .addon-price");

      if (yearly) {
        basicPrice.innerHTML = "₦26,000<span>/year</span>";
        proPrice.innerHTML = "₦42,000<span>/year</span>";
      } else {
        basicPrice.innerHTML = "₦3,000<span>/month</span>";
        proPrice.innerHTML = "₦4,500<span>/month</span>";
      }
    });
  }

  toggle.addEventListener("change", updatePrices);
  updatePrices();
});
//</script>
// END OF ADDON BILLING TOGGLE SCRIPT

//SEARCH BUTTON

// ============================
// 1️⃣ Initialize Supabase
// ============================
const SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ✅ Test Supabase connection
(async () => {
  const { data, error } = await supabase.from("Vendors").select("*").limit(1);
  if (error) {
    console.error("❌ Connection test failed:", error.message);
  } else {
    console.log("✅ Supabase connected! Sample data:", data);
  }
})();

// ============================
// 2️⃣ Get HTML Elements
// ============================
const searchInput = document.getElementById("search-input");

// Create a container dynamically for search results
const resultsContainer = document.createElement("div");
resultsContainer.id = "results-container";

// Append it under your vendor content section
const vendorContent = document.querySelector(".vendor-content");
if (vendorContent) {
  vendorContent.appendChild(resultsContainer);
}

// ============================
// 3️⃣ Search by Vendor Name
// ============================
async function searchByName() {
  const term = searchInput.value.trim();

  if (!term) {
    resultsContainer.innerHTML = "<p>Please enter a vendor name.</p>";
    return;
  }

  const { data, error } = await supabase
    .from("Vendors")
    .select("id, name, category, state, lga, logo_url, tier, is_verified")
    .ilike("name", `%${term}%`);

  displayResults(data, error);
}

// ============================
// 4️⃣ Search by Category
// ============================
async function searchByCategory() {
  const term = searchInput.value.trim();

  if (!term) {
    resultsContainer.innerHTML = "<p>Please enter a category.</p>";
    return;
  }

  const { data, error } = await supabase
    .from("Vendors")
    .select("id, name, category, state, lga, logo_url, tier, is_verified")
    .ilike("category", `%${term}%`);

  displayResults(data, error);
}

// ============================
// 5️⃣ Display Results
// ============================
function displayResults(data, error) {
  if (error) {
    console.error("Supabase Error:", error);
    resultsContainer.innerHTML = "<p>❌ Error fetching vendors. Check console for details.</p>";
    return;
  }

  if (!data || data.length === 0) {
    resultsContainer.innerHTML = "<p>No vendors found.</p>";
    return;
  }

  // Build vendor cards
  resultsContainer.innerHTML = data
    .map((vendor) => `
      <div class="vendor-card">
        <img 
          src="https://YOUR_PROJECT_URL.supabase.co/storage/v1/object/public/${vendor.logo_url}" 
          alt="${vendor.name}" 
          width="80" 
        />
        <h3>${vendor.name}</h3>
        <p>${vendor.category} — ${vendor.lga}, ${vendor.state}</p>
        <p>${vendor.is_verified ? "✅ Verified" : "❌ Unverified"}</p>
      </div>
    `)
    .join("");
}

//SEARCH BUTTON ENDED

