document.addEventListener(
  "DOMContentLoaded",
  () => {

const existingLoader =
  document.getElementById(
    "discoverSearchLoading"
  );

if (existingLoader) {

  existingLoader.classList.remove(
    "active"
  );

}

window.addEventListener(
  "pageshow",
  () => {

    const restoredLoader =
      document.getElementById(
        "discoverSearchLoading"
      );

    if (restoredLoader) {

      restoredLoader.classList.remove(
        "active"
      );

    }

  }
);

const supabase =
  window.supabaseClient;

    /* ========================= */
    /* SEARCH TYPE TABS */
    /* ========================= */

    const discoverTabs =
      document.querySelectorAll(
        ".discover-tab"
      );

discoverTabs.forEach(tab => {

  tab.addEventListener(
    "click",
    () => {

      discoverTabs.forEach(btn => {

        btn.classList.remove(
          "active"
        );

      });

      tab.classList.add(
        "active"
      );

      sessionStorage.setItem(
        "discoverSearchType",
        tab.dataset.type
      );

    }
  );

});

    /* ========================= */
    /* FILTER DRAWER */
    /* ========================= */

    const moreFiltersBtn =
      document.getElementById(
        "moreFiltersBtn"
      );

    const closeFiltersDrawerBtn =
      document.getElementById(
        "closeFiltersDrawerBtn"
      );

    const discoverFiltersDrawer =
      document.getElementById(
        "discoverFiltersDrawer"
      );

    const discoverDrawerOverlay =
      document.getElementById(
        "discoverDrawerOverlay"
      );

    function openFiltersDrawer() {

      if (
        discoverFiltersDrawer &&
        discoverDrawerOverlay
      ) {

        discoverFiltersDrawer.classList.add(
          "active"
        );

        discoverDrawerOverlay.classList.add(
          "active"
        );

        document.body.style.overflow =
          "hidden";

      }

    }

    function closeFiltersDrawer() {

      if (
        discoverFiltersDrawer &&
        discoverDrawerOverlay
      ) {

        discoverFiltersDrawer.classList.remove(
          "active"
        );

        discoverDrawerOverlay.classList.remove(
          "active"
        );

        document.body.style.overflow =
          "";

      }

    }

    if (moreFiltersBtn) {

      moreFiltersBtn.addEventListener(
        "click",
        openFiltersDrawer
      );

    }

    if (closeFiltersDrawerBtn) {

      closeFiltersDrawerBtn.addEventListener(
        "click",
        closeFiltersDrawer
      );

    }

    if (discoverDrawerOverlay) {

      discoverDrawerOverlay.addEventListener(
        "click",
        closeFiltersDrawer
      );

    }

/* ========================= */
/* DISTANCE SEARCH */
/* ========================= */

const verifiedOnlyToggle =
  document.getElementById(
    "verifiedOnlyToggle"
  );

const enableDistanceSearch =
  document.getElementById(
    "enableDistanceSearch"
  );

const distanceCard =
  document.querySelector(
    ".discover-distance-card"
  );

const distanceRadiusSlider =
  document.getElementById(
    "distanceRadiusSlider"
  );

const distanceRadiusValue =
  document.getElementById(
    "distanceRadiusValue"
  );

let locationPermissionGranted =
  false;

const userLocation = {
  latitude: null,
  longitude: null
};

const storedLocationData =
  sessionStorage.getItem(
    "discoverUserLocation"
  );

if (storedLocationData) {

  try {

    const parsedLocation =
      JSON.parse(
        storedLocationData
      );

    userLocation.latitude =
      Number(
        parsedLocation.latitude
      );

    userLocation.longitude =
      Number(
        parsedLocation.longitude
      );

  } catch {

    sessionStorage.removeItem(
      "discoverUserLocation"
    );

  }

}

/* SLIDER VALUE */

if (
  distanceRadiusSlider &&
  distanceRadiusValue
) {

  distanceRadiusSlider.addEventListener(
    "input",
    () => {

      distanceRadiusValue.textContent =
        `${distanceRadiusSlider.value}km`;

    }
  );

}

/* ENABLE / DISABLE */

if (
  enableDistanceSearch &&
  distanceCard
) {

  function updateDistanceState() {

    const useLocationBtn =
      document.getElementById(
        "useLocationBtn"
      );

    if (
      enableDistanceSearch.checked
    ) {

      distanceCard.classList.add(
        "distance-enabled"
      );

      if (
        !navigator.geolocation
      ) {

        if (useLocationBtn) {

          useLocationBtn.innerHTML =
            `
              <i class="fa-solid fa-triangle-exclamation"></i>
              Unsupported
            `;

        }

        return;

      }

      if (useLocationBtn) {

        useLocationBtn.innerHTML =
          `
            <i class="fa-solid fa-location-crosshairs"></i>
            Detecting...
          `;

        useLocationBtn.disabled =
          true;

      }

  navigator.geolocation.getCurrentPosition(

position => {

          locationPermissionGranted =
            true;

          userLocation.latitude =
            position.coords.latitude;

          userLocation.longitude =
            position.coords.longitude;

          sessionStorage.setItem(
            "discoverUserLocation",
            JSON.stringify({
              latitude:
                userLocation.latitude,
              longitude:
                userLocation.longitude,
              timestamp:
                Date.now()
            })
          );

          if (useLocationBtn) {

            useLocationBtn.innerHTML =
              `
                <i class="fa-solid fa-circle-check"></i>
                Location Ready
              `;

            useLocationBtn.disabled =
              false;

          }

        },

() => {

          locationPermissionGranted =
            false;

          userLocation.latitude =
            null;

          userLocation.longitude =
            null;

          sessionStorage.removeItem(
            "discoverUserLocation"
          );

          if (useLocationBtn) {
          
          enableDistanceSearch.checked =
            false;

            useLocationBtn.innerHTML =
              `
                <i class="fa-solid fa-location-xmark"></i>
                Denied
              `;

            useLocationBtn.disabled =
              false;

          }

          enableDistanceSearch.checked =
            false;

          distanceCard.classList.remove(
            "distance-enabled"
          );

        },

        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }

      );

} else {

      locationPermissionGranted =
        false;

      distanceCard.classList.remove(
        "distance-enabled"
      );

      if (useLocationBtn) {

        useLocationBtn.innerHTML =
          `
            <i class="fa-solid fa-location-crosshairs"></i>
            Use Current
          `;

      }

    }

  }

  updateDistanceState();

  enableDistanceSearch.addEventListener(
    "change",
    updateDistanceState
  );

}

/* ========================= */
/* DYNAMIC CATEGORY LOAD */
/* ========================= */

async function loadCategories() {

  if (!discoverCategory) {
    return;
  }

  try {

    const {
      data,
      error
    } = await supabase
      .from("vendors")
      .select("category")
      .not(
        "category",
        "is",
        null
      );

    if (error) {

      console.error(
        "Category load error:",
        error
      );

      return;

    }

    const uniqueCategories =
      [
        ...new Set(

          data
            .map(
              item =>
                item.category?.trim()
            )
            .filter(Boolean)

        )
      ].sort();

    discoverCategory.innerHTML =
      `
        <option value="">
          Select Category
        </option>
      `;

    uniqueCategories.forEach(
      category => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          category;

        option.textContent =
          category;

        discoverCategory.appendChild(
          option
        );

      }
    );

  } catch (loadError) {

    console.error(
      "Unexpected category error:",
      loadError
    );

  }

}

const nigeriaData =
  window.nigeriaData;

/* ========================= */
/* DYNAMIC LGA LOAD */
/* ========================= */

function loadLgas(
  selectedState
) {

  if (!discoverLga) {
    return;
  }

  discoverLga.innerHTML =
    `
      <option value="">
        Select LGA
      </option>
    `;

  if (
    !selectedState ||
    !nigeriaData[selectedState]
  ) {
    return;
  }

  nigeriaData[
    selectedState
  ].forEach(
    lga => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        lga;

      option.textContent =
        lga;

      discoverLga.appendChild(
        option
      );

    }
  );

}

/* ========================= */
/* FILTER ACTIONS */
/* ========================= */

const applyFiltersBtn =
  document.getElementById(
    "applyFiltersBtn"
  );

const resetFiltersBtn =
  document.getElementById(
    "resetFiltersBtn"
  );

const discoverCategory =
  document.getElementById(
    "discoverCategory"
  );

const discoverSubcategory =
  document.getElementById(
    "discoverSubcategory"
  );

const discoverState =
  document.getElementById(
    "discoverState"
  );

const discoverLga =
  document.getElementById(
    "discoverLga"
  );

/* APPLY FILTERS */

if (applyFiltersBtn) {

  applyFiltersBtn.addEventListener(
    "click",
    () => {

      closeFiltersDrawer();

    }
  );

}

/* RESET FILTERS */

if (resetFiltersBtn) {

  resetFiltersBtn.addEventListener(
    "click",
    () => {

      if (discoverCategory) {
        discoverCategory.value = "";
      }

      if (discoverSubcategory) {
        discoverSubcategory.value = "";
      }

      if (discoverState) {
        discoverState.value = "";
      }

      if (discoverLga) {
        discoverLga.value = "";
      }

    }
  );

}

/* ========================= */
/* TRENDING SEARCHES */
/* ========================= */

function renderTrendingSearches() {

  if (
    !discoverTrendingTags
  ) {
    return;
  }

  const shuffledKeywords =
    [...trendingKeywords]
      .sort(
        () =>
          Math.random() - 0.5
      )
      .slice(0, 5);

  discoverTrendingTags.innerHTML =
    "";

  shuffledKeywords.forEach(
    keyword => {

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.textContent =
        keyword;

      button.addEventListener(
        "click",
        () => {

          if (
            discoverSearchInput
          ) {

            discoverSearchInput.value =
              keyword;

          }

          executeSearch();

        }
      );

      discoverTrendingTags.appendChild(
        button
      );

    }
  );

}

/* ========================= */
/* TRENDING SEARCHES LIST */
/* ========================= */

const discoverTrendingTags =
  document.getElementById(
    "discoverTrendingTags"
  );

const trendingKeywords = [

  "Plumber Near Me",
  "POS Agent",
  "Dry Cleaners",
  "Makeup Artist",
  "Electrician",
  "Catering Services",
  "Generator Repair",
  "Phone Repair",
  "Tailor",
  "Hair Stylist",

  "Graphic Designer",
  "Solar Installer",
  "Laundry Service",
  "Mechanic",
  "Fashion Designer",
  "Carpenter",
  "AC Technician",
  "Baker",
  "Event Planner",
  "DJ Services",

  "Photographer",
  "Barber",
  "Interior Decorator",
  "Vulcanizer",
  "Painter",
  "POP Installer",
  "Tiles Installer",
  "Video Editor",
  "POS Machine Repair",
  "Furniture Maker",

  "Real Estate Agent",
  "Cleaning Service",
  "Web Designer",
  "MC Services",
  "Laptop Repair",
  "Car Wash",
  "Private Tutor",
  "Home Lesson Teacher",
  "Nail Technician",
  "CCTV Installer",

  "Security Guard",
  "Delivery Rider",
  "Cook",
  "Perfumery",
  "Shoemaker",
  "Travel Agent",
  "Cyber Cafe",
  "Recharge Card Vendor",
  "Water Supplier",
  "Printing Service"

];

/* ========================= */
/* SEARCH EXECUTION */
/* ========================= */

const discoverSearchInput =
  document.getElementById(
    "discoverSearchInput"
  );

const discoverSearchBtn =
  document.getElementById(
    "discoverSearchBtn"
  );

const discoverSearchLoading =
  document.getElementById(
    "discoverSearchLoading"
  );

const discoverSearchError =
  document.getElementById(
    "discoverSearchError"
  );

const recentSearchesContainer =
  document.querySelector(
    ".discover-recent-list"
  );

const currentUrlParams =
  new URLSearchParams(
    window.location.search
  );

const persistedKeyword =
  currentUrlParams.get(
    "keyword"
  ) ||
  sessionStorage.getItem(
    "discoverKeyword"
  );

const persistedSearchType =
  currentUrlParams.get(
    "type"
  ) ||
  sessionStorage.getItem(
    "discoverSearchType"
  ) ||
  "all";

const matchingTab =
  document.querySelector(
    `.discover-tab[data-type="${persistedSearchType}"]`
  );

if (matchingTab) {

  discoverTabs.forEach(
    tab => {

      tab.classList.remove(
        "active"
      );

    }
  );

  matchingTab.classList.add(
    "active"
  );

}

if (
  persistedKeyword &&
  discoverSearchInput
) {

  discoverSearchInput.value =
    persistedKeyword;

}

/* GET ACTIVE SEARCH TYPE */

function getActiveSearchType() {

  const activeTab =
    document.querySelector(
      ".discover-tab.active"
    );

  if (!activeTab) {
    return "all";
  }

  return activeTab.dataset.type;

}

/* BUILD SEARCH PARAMS */

function buildSearchParams() {

  return {

  keyword:
    discoverSearchInput
      ? discoverSearchInput.value
          .trim()
          .replace(/[<>]/g, "")
      : "",

    searchType:
      getActiveSearchType(),

    verifiedOnly:
      verifiedOnlyToggle
        ? verifiedOnlyToggle.checked
        : false,

    distanceEnabled:
      enableDistanceSearch?.checked ===
      true,

    radius:
      distanceRadiusSlider
        ? Number(distanceRadiusSlider.value)
        : window.DISCOVER_CONFIG
            .DEFAULT_RADIUS_KM,
    
    latitude:
     userLocation.latitude,

    longitude:
     userLocation.longitude,

    category:
      discoverCategory
        ? discoverCategory.value
        : "",

    subcategory:
      discoverSubcategory
        ? discoverSubcategory.value
        : "",

    state:
      discoverState
        ? discoverState.value
        : "",

    lga:
      discoverLga
        ? discoverLga.value
        : "",

  };
}

/* ========================= */
/* EXECUTE SEARCH */
/* ========================= */

function executeSearch() {

  const searchParams =
    buildSearchParams();

  sessionStorage.setItem(
   "discoverKeyword",
   searchParams.keyword
 );

 sessionStorage.setItem(
  "discoverSearchType",
  searchParams.searchType
);

 if (searchParams.keyword) {

  let recentSearches =
    JSON.parse(
      localStorage.getItem(
        "discoverRecentSearches"
      ) || "[]"
    );

  recentSearches =
    recentSearches.filter(
      item =>
        item.toLowerCase() !==
        searchParams.keyword.toLowerCase()
    );

  recentSearches.unshift(
    searchParams.keyword
  );

  recentSearches =
    recentSearches.slice(0, 5);

  localStorage.setItem(
    "discoverRecentSearches",
    JSON.stringify(
      recentSearches
    )
  );

}

  const queryParams =
    new URLSearchParams();

  /* KEYWORD */

  if (
    searchParams.keyword
  ) {

    queryParams.set(
      "keyword",
      searchParams.keyword
    );

  }

  /* SEARCH TYPE */

  if (
    searchParams.searchType
  ) {

    queryParams.set(
      "type",
      searchParams.searchType
    );

  }

  /* VERIFIED */

  queryParams.set(
    "verified",
    searchParams.verifiedOnly
      ? "true"
      : "false"
  );


  /* DISTANCE */

  if (
    searchParams.distanceEnabled
  ) {

    queryParams.set(
      "distance",
      "true"
    );

    queryParams.set(
      "radius",
      searchParams.radius
    );

    if (

      searchParams.latitude !== null &&

      searchParams.longitude !== null

    ) {

      queryParams.set(
        "lat",
        searchParams.latitude
      );

      queryParams.set(
        "lng",
        searchParams.longitude
      );

    }

}

  /* CATEGORY */

  if (
    searchParams.category
  ) {

    queryParams.set(
      "category",
      searchParams.category
    );

  }

  /* SUBCATEGORY */

  if (
    searchParams.subcategory
  ) {

    queryParams.set(
      "subcategory",
      searchParams.subcategory
    );

  }

  /* STATE */

  if (
    searchParams.state
  ) {

    queryParams.set(
      "state",
      searchParams.state
    );

  }

  /* LGA */

  if (
    searchParams.lga
  ) {

    queryParams.set(
      "lga",
      searchParams.lga
    );

  }

 /* NAVIGATE */

if (
  discoverSearchLoading
) {

  discoverSearchLoading.classList.add(
    "active"
  );

}


window.location.href =
  `${window.DISCOVER_CONFIG.SEARCH_REDIRECT_URL}?${queryParams.toString()}`;

}

/* ENTER KEY */

/* ========================= */
/* DYNAMIC SUBCATEGORY LOAD */
/* ========================= */

async function loadSubcategories(
  selectedCategory
) {

  if (
    !discoverSubcategory
  ) {
    return;
  }

  discoverSubcategory.innerHTML =
    `
      <option value="">
        Select Subcategory
      </option>
    `;

  if (!selectedCategory) {
    return;
  }

  try {

    const {
      data,
      error
    } = await supabase
      .from("vendors")
      .select(
        "subcategory"
      )
      .eq(
        "category",
        selectedCategory
      )
      .not(
        "subcategory",
        "is",
        null
      );

    if (error) {

      console.error(
        "Subcategory load error:",
        error
      );

      return;

    }

    const uniqueSubcategories =
      [
        ...new Set(

          data
            .map(
              item =>
                item.subcategory?.trim()
            )
            .filter(Boolean)

        )
      ].sort();

    uniqueSubcategories.forEach(
      subcategory => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          subcategory;

        option.textContent =
          subcategory;

        discoverSubcategory.appendChild(
          option
        );

      }
    );

  } catch (loadError) {

    console.error(
      "Unexpected subcategory error:",
      loadError
    );

  }

}

if (discoverCategory) {

  discoverCategory.addEventListener(
    "change",
    () => {

      loadSubcategories(
        discoverCategory.value
      );

    }
  );

}

/* ========================= */
/* DYNAMIC STATE LOAD */
/* ========================= */

function loadStates() {

  if (!discoverState) {
    return;
  }

  discoverState.innerHTML =
    `
      <option value="">
        Select State
      </option>
    `;

  Object.keys(
    nigeriaData
  )
    .sort()
    .forEach(
      state => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          state;

        option.textContent =
          state;

        discoverState.appendChild(
          option
        );

      }
    );

}

/* ========================= */
/* SPONSORED VENDORS */
/* ========================= */

async function loadSponsoredVendors() {

  const sponsoredSection =
    document.querySelector(
      ".discover-sponsored-section"
    );

  const sponsoredContainer =
    document.querySelector(
      ".discover-sponsored-scroll"
    );

  if (
    !sponsoredSection ||
    !sponsoredContainer
  ) {
    return;
  }

const searchKeyword =
  persistedKeyword
    ? persistedKeyword
        .trim()
        .toLowerCase()
    : (
        discoverSearchInput
          ? discoverSearchInput.value
              .trim()
              .toLowerCase()
          : ""
      );

  try {

let sponsoredQuery =
  supabase
    .from("vendors")
    .select(`
      id,
      slug,
      name,
      category,
      subcategory,
      lga,
      state,
      logo_url,
      verification_status,
      average_rating,
      reviews_count 
    `)
    .eq(
      "is_sponsored",
      true
    )
    .eq(
      "subscription_status",
      "active"
    )
    .eq(
      "account_status",
      "active"
    );

if (searchKeyword) {

  sponsoredQuery =
    sponsoredQuery.or(
      `subcategory.ilike.%${searchKeyword}%,category.ilike.%${searchKeyword}%`
    );

}

const {
  data,
  error
} = await sponsoredQuery
  .order(
    "average_rating",
    { ascending: false }
  )
  .limit(10);

    if (error) {

      console.error(
        "Sponsored vendors error:",
        error
      );

      sponsoredSection.style.display =
        "none";

      return;

    }

if (
  !data ||
  !data.length
) {

  sponsoredContainer.innerHTML =
    `
      <div class="discover-sponsored-empty">
        No sponsored vendors available for this search yet.
      </div>
    `;

  return;

}

    sponsoredContainer.innerHTML =
      "";

    data.forEach(
      vendor => {

        const vendorCard =
          document.createElement(
            "article"
          );

        vendorCard.className =
          "discover-sponsored-card";

        vendorCard.innerHTML =
          `
            <div class="discover-sponsored-top">

              <img
                src="${
                 vendor.logo_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(vendor.name)}&background=e6c200&color=000000&size=128`
                }"
                alt="${vendor.name}"
                class="discover-sponsored-logo"
              >

              <div class="discover-sponsored-meta">

                <h3 class="discover-sponsored-title">

                  <span>
                    ${vendor.name}
                  </span>

                      ${renderBadge(vendor.verification_status)}

                </h3>

                <p>
                  ${vendor.subcategory || "Vendor"}
                </p>

                <div class="discover-sponsored-rating-wrap">

                  <i class="fa-solid fa-star"></i>

                  <span>
                    ${Number(
                      vendor.average_rating || 0
                    ).toFixed(1)}
                  </span>

                  <small>
                    (${vendor.reviews_count || 0})
                  </small>

                </div>   

              </div>

            </div>

            <div class="discover-sponsored-bottom">

              <span class="discover-sponsored-location">

               <i class="fa-solid fa-location-dot"></i>

               ${vendor.lga || ""}, ${vendor.state || ""}

              </span>

              <div class="discover-sponsored-actions">

              <button
                class="review-trigger-btn"
                data-vendor-id="${vendor.id}"
                type="button"
              >
                Review
              </button>

             <button
               class="view-profile-btn"
               data-slug="${vendor.slug || ""}"
             >
              Profile
             </button>

            </div>

          </div>
          `;

        sponsoredContainer.appendChild(
          vendorCard
        );

      }
    );

  } catch (error) {

    console.error(
      "Sponsored vendor fetch failed:",
      error
    );

    sponsoredSection.style.display =
      "none";

  }

}

window.loadSponsoredVendors =
  loadSponsoredVendors;

function renderRecentSearches() {

  if (
    !recentSearchesContainer
  ) {
    return;
  }

  const recentSearches =
    JSON.parse(
      localStorage.getItem(
        "discoverRecentSearches"
      ) || "[]"
    );

  if (!recentSearches.length) {

    recentSearchesContainer.innerHTML =
      `
        <div class="discover-sponsored-empty">
          No recent searches yet.
        </div>
      `;

    return;

  }

  recentSearchesContainer.innerHTML =
    "";

  recentSearches.forEach(
    search => {

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "discover-recent-item";

      button.innerHTML =
        `
          <i class="fa-regular fa-clock"></i>

          <span>
            ${search}
          </span>
        `;

      button.addEventListener(
        "click",
        () => {

          if (
            discoverSearchInput
          ) {

            discoverSearchInput.value =
              search;

          }

          executeSearch();

        }
      );

      recentSearchesContainer.appendChild(
        button
      );

    }
  );

}

renderTrendingSearches();

loadSponsoredVendors();

renderRecentSearches();

document.addEventListener(
  "click",
  event => {

    const reviewButton =
      event.target.closest(
        ".review-trigger-btn"
      );

    if (!reviewButton) {
      return;
    }

    if (
      window.ReviewsUtils &&
      typeof window.ReviewsUtils.openReviewModal ===
        "function"
    ) {

      window.ReviewsUtils.openReviewModal(
       reviewButton.dataset.vendorId
     );

    }

  }
);

document.addEventListener(
  "click",
  event => {

    const profileButton =
      event.target.closest(
        ".view-profile-btn"
      );

    if (!profileButton) {
      return;
    }

    const slug =
      profileButton.dataset.slug;

    if (!slug) {
      return;
    }

    window.location.href =
      `vendor-profile.html?slug=${encodeURIComponent(slug)}`;

  }
);

loadCategories();

if (discoverState) {

  discoverState.addEventListener(
    "change",
    () => {

      loadLgas(
        discoverState.value
      );

    }
  );

}

loadStates();

const discoverProfileNav =
  document.getElementById(
    "discoverProfileNav"
  );

if (discoverProfileNav) {

  discoverProfileNav.addEventListener(
    "click",
    async () => {

      try {

        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (session) {

          window.location.href =
            "vendordashboard.html";

          return;

        }

        window.location.href =
          "login.html";

      } catch {

        window.location.href =
          "login.html";

      }

    }
  );

}

if (discoverSearchBtn) {

  discoverSearchBtn.addEventListener(
    "click",
    () => {

      executeSearch();

    }
  );

}

if (discoverSearchInput) {

  let searchExecuting =
    false;

  discoverSearchInput.addEventListener(
    "keydown",
    event => {

      if (
        event.key !== "Enter"
      ) {
        return;
      }

      event.preventDefault();

      if (searchExecuting) {
        return;
      }

      const keyword =
        discoverSearchInput.value.trim();

      if (
        discoverSearchError
     ) {

        discoverSearchError.classList.remove(
          "active"
       );

      }

      const distanceEnabled =
        enableDistanceSearch?.checked ===
        true;

      const hasFilters =
        discoverCategory?.value ||
        discoverSubcategory?.value ||
        discoverState?.value ||
        discoverLga?.value;

      if (
        !keyword &&
        !distanceEnabled &&
        !hasFilters
      ) {

      if (
        discoverSearchError
      ) {

        discoverSearchError.classList.add(
          "active"
        );

     }

     discoverSearchInput.focus();

     return;

      }

      searchExecuting = true;

try {

  executeSearch();

} finally {

  setTimeout(
    () => {

      searchExecuting =
        false;

    },
    window.DISCOVER_CONFIG
      .SEARCH_LOCK_TIMEOUT
  );

}

    }
  );

}

  }
);