// ============================
// 1️⃣ Initialize Supabase
// ============================
const SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ✅ Test Supabase connection
   (async() => {
    try {
      const { data, error } = await supabaseClient.from("Vendors").select("*").limit(1);
      if (error) console.error("❌ Supabase connection failed:", error.message);
      else console.log("✅ Supabase connected! Sample:", data);
    } catch (err) {
      console.error("⚠️ Supabase test error:", err);
    }
  })();


//MAIN DOM WRAPPER

document.addEventListener('DOMContentLoaded', async () => {
  console.log("✅ Page scripts initialized successfully.");

// HAMBURGER MENU SCRIPT

  const menu = document.querySelector('nav ul');
  const openBtn = document.querySelector('.menu-open');
  const closeBtn = document.querySelector('.xclose');

  if (openBtn && closeBtn && menu) {
    openBtn.addEventListener('click', () => menu.classList.add('open'));
    
    closeBtn.addEventListener('click', () => menu.classList.remove('open'));
   }

// END OF hamburger MENU SCRIPT


// FAQ TOGGLE SCRIPT
const headers = document.querySelectorAll('.accordion-header');

headers.forEach(header => {
  header.addEventListener('click', () => {

          // 1️⃣ Close all others first
      headers.forEach(h => {
        if (h !== header) h.classList.remove('active');
      });

     // 2️⃣ Toggle the clicked one
    header.classList.toggle('active');
    });
  });

// END OF FAQ TOGGLE SCRIPT

//GET LISTED PLAN TOGGLE SCRIPT

  const billingToggle = document.getElementById("billingToggle");
  const prices = document.querySelectorAll(".price");
  const yearlyTexts = document.querySelectorAll(".yearly");

  if (billingToggle) {
  billingToggle.addEventListener("change", () => {
    const yearly = billingToggle.checked;

    prices.forEach(price => {
      price.textContent = yearly 
        ? price.getAttribute("data-yearly") 
        : price.getAttribute("data-monthly");
    });

    yearlyTexts.forEach(text => {
      text.style.display = yearly ? "none" : "block";
    });
  });
}
// END OF GET LISTED PLAN TOGGLE SCRIPT

// ADDON BILLING TOGGLE SCRIPT

  const addonToggle = document.getElementById("addonBillingToggle");
  const addonCards = document.querySelectorAll(".addon-card");

  if (addonToggle && addonCards.length > 0) {
  function updateAddonPrices() {
    const yearly = addonToggle.checked;
    addonCards.forEach(card => {
      const basicPrice = card.querySelector(".addon-plan.addon-basic .addon-price");
      const proPrice = card.querySelector(".addon-plan.addon-pro .addon-price");
   
    if (basicPrice && proPrice) {
      if (yearly) {
        basicPrice.innerHTML = "₦26,000<span>/year</span>";
        proPrice.innerHTML = "₦42,000<span>/year</span>";
      } else {
        basicPrice.innerHTML = "₦3,000<span>/month</span>";
        proPrice.innerHTML = "₦4,500<span>/month</span>";
      }
    }
    });
  }

  addonToggle.addEventListener("change", updateAddonPrices);
  updateAddonPrices();
}
//</script>
// END OF ADDON BILLING TOGGLE SCRIPT


//SEARCH BUTTON using SUPABASE LOGIC


  // -----------------------------
  // 🔍 SEARCH LOGIC (SUPABASE)
  // -----------------------------
  const searchInput = document.getElementById("search-input");
  const vendorContent = document.querySelector(".vendor-content");
  let resultsContainer = document.getElementById("results-container");

  if (!resultsContainer && vendorContent) {
    resultsContainer = document.createElement("div");
    resultsContainer.id = "results-container";
    vendorContent.appendChild(resultsContainer);
  }

  function displayResults(data, error) {
    if (!resultsContainer) return;

    if (error) {
      resultsContainer.innerHTML = "<p>❌ Error fetching vendors.</p>";
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      resultsContainer.innerHTML = "<p>No vendors found.</p>";
      return;
    }

    resultsContainer.innerHTML = data
      .map(
        (vendor) => `
        <div class="vendor-card">
          <img src="https://gyvzmktavyrevfxnwsay.supabase.co/storage/v1/object/public/${vendor.logo_url}" 
               alt="${vendor.name}" width="80" />
          <h3>${vendor.name}</h3>
          <p>${vendor.category} — ${vendor.lga}, ${vendor.state}</p>
          <p>${vendor.is_verified ? "✅ Verified" : "❌ Unverified"}</p>
        </div>
      `
      )
      .join("");
  }

  async function searchByName() {
    const term = searchInput?.value?.trim();
    if (!term) {
      resultsContainer.innerHTML = "<p>Please enter a vendor name.</p>";
      return;
    }

    const { data, error } = await supabaseClient
      .from("Vendors")
      .select("id, name, category, state, lga, logo_url, tier, is_verified")
      .ilike("name", `%${term}%`);

    displayResults(data, error);
  }

  async function searchByCategory() {
    const term = searchInput?.value?.trim();
    if (!term) {
      resultsContainer.innerHTML = "<p>Please enter a category.</p>";
      return;
    }

    const { data, error } = await supabaseClient
      .from("Vendors")
      .select("id, name, category, state, lga, logo_url, tier, is_verified")
      .ilike("category", `%${term}%`);

    displayResults(data, error);
  }

  // ✅ Make available for button clicks in HTML
  window.searchByName = searchByName;
  window.searchByCategory = searchByCategory;

  // ✅ Handle typing log
  if (searchInput) {
    searchInput.addEventListener("keyup", () => {
      const value = searchInput.value.trim();
      console.log("🔎 User typing:", value);
    });
  }

  // ✅ Redirect search actions to results.html
function searchByName() {
  const term = document.getElementById("search-input").value.trim();
  if (term)
    window.location.href = `results.html?type=name&term=${encodeURIComponent(term)}`;
}

function searchByCategory() {
  const term = document.getElementById("search-input").value.trim();
  if (term)
    window.location.href = `results.html?type=category&term=${encodeURIComponent(term)}`;
}

// Make sure they're available to your HTML buttons
window.searchByName = searchByName;
window.searchByCategory = searchByCategory;
});

//SEARCH BUTTON ENDED

