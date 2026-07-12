// ======================================
// DISCOVER RESULTS PAGE
// INITIALIZATION
// ======================================

const searchParams =
  new URLSearchParams(
    window.location.search
  );

const discoverResultsState = {

  keyword:
    searchParams.get("keyword") || "",

  searchType:
    searchParams.get("type") || "all",

  category:
    searchParams.get("category") || "",

  subcategory:
    searchParams.get("subcategory") || "",

  state:
    searchParams.get("state") || "",

  lga:
    searchParams.get("lga") || "",

  verified:
    searchParams.get("verified") === "true",

  distanceEnabled:
    searchParams.get("distance") === "true",

  radius:
    Number(
      searchParams.get("radius")
    ) || 5,

  latitude:
    Number(
      searchParams.get("lat")
    ) || null,

  longitude:
    Number(
      searchParams.get("lng")
    ) || null,

    showAllProducts:
      false,

    showAllServices:
      false,
    
    showAllVendors:
      false

 };

document.addEventListener(
  "DOMContentLoaded",
  initializeDiscoverResultsPage
);

function initializeDiscoverResultsPage() {

  initializeBackButton();

  populateSearchInput();

  activateSearchTab();

  initializeSearchButton();
  
  initializeVerifiedToggle();

  initializeSeeAllButtons();

  updateSearchSummary(
    0
  );

  if (

  discoverResultsState.keyword

    .trim() !== ""

) {

  performMarketplaceSearch();

}

}

// ======================================
// POPULATE SEARCH INPUT
// ======================================

function populateSearchInput() {

  const searchInput =

    document.getElementById(

      "discoverResultsSearchInput"

    );

  if (

    !searchInput

  ) {

    return;

  }

  searchInput.value =

    discoverResultsState.keyword;

  const verifiedToggle =

    document.getElementById(

      "discoverResultsVerifiedToggle"

    );

  if (

    verifiedToggle

  ) {

    verifiedToggle.checked =

      discoverResultsState.verified || false;

  }

}

// ======================================
// ACTIVATE SEARCH TAB
// ======================================

function activateSearchTab() {

  const tabs =
    document.querySelectorAll(
      ".discover-results-tab"
    );

  tabs.forEach((tab) => {

    tab.classList.remove(
      "active"
    );

  });

  const activeTab =
    document.querySelector(

      '.discover-results-tab[data-type="' +
      discoverResultsState.searchType +
      '"]'

    );

  if (activeTab) {

    activeTab.classList.add(
      "active"
    );

  }

  tabs.forEach((tab) => {

    tab.addEventListener(
      "click",
      function () {

        tabs.forEach((item) => {

          item.classList.remove(
            "active"
          );

        });

        this.classList.add(
          "active"
        );

        discoverResultsState.searchType =
          this.dataset.type;

      }
    );

  });

}

// ======================================
// BACK BUTTON
// ======================================

function initializeBackButton() {

  const backButton =
    document.getElementById(
      "discoverResultsBackBtn"
    );

  if (!backButton) {

    return;

  }

  backButton.addEventListener(
    "click",
    function () {

      window.location.href =
        "discover.html";

    }
  );

}

// ======================================
// SEARCH BUTTON
// ======================================

function initializeSearchButton() {

  const searchButton =
    document.getElementById(
      "discoverResultsSearchBtn"
    );

  const searchInput =
    document.getElementById(
      "discoverResultsSearchInput"
    );

  if (

    !searchButton ||

    !searchInput

  ) {

    return;

  }

  searchButton.addEventListener(

    "click",

    function () {

      const keyword =
        searchInput.value.trim();

      if (

        keyword === ""

     ) {

       alert(

         "Please enter a keyword."

      );

       return;

     }

      const params =
        new URLSearchParams();

      params.set(
        "keyword",
        keyword
      );

      params.set(
        "type",
        discoverResultsState.searchType
      );

      if (
        discoverResultsState.category
      ) {

        params.set(
          "category",
          discoverResultsState.category
        );

      }

      if (
        discoverResultsState.subcategory
      ) {

        params.set(
          "subcategory",
          discoverResultsState.subcategory
        );

      }

      if (
        discoverResultsState.state
      ) {

        params.set(
          "state",
          discoverResultsState.state
        );

      }

      if (
        discoverResultsState.lga
      ) {

        params.set(
          "lga",
          discoverResultsState.lga
        );

      }

      params.set(
        "verified",
        discoverResultsState.verified
      );

      params.set(
        "distance",
        discoverResultsState.distanceEnabled
      );

      params.set(
        "radius",
        discoverResultsState.radius
      );

      if (

        discoverResultsState.latitude !== null &&

        discoverResultsState.longitude !== null

      ) {

        params.set(
          "lat",
          discoverResultsState.latitude
        );

        params.set(
          "lng",
          discoverResultsState.longitude
        );

      }

      window.location.href =
        "discover-results.html?" +

        params.toString();

    }

  );

}

// ======================================
// VERIFIED TOGGLE
// ======================================

function initializeVerifiedToggle() {

  const toggle =

    document.getElementById(

      "discoverResultsVerifiedToggle"

    );

  if (

    !toggle

  ) {

    return;

  }

  toggle.addEventListener(

    "change",

    function() {

      discoverResultsState.verified =

        toggle.checked;

      // Previously this only updated state silently, so toggling
      // had no visible effect until the next unrelated search —
      // it now re-runs the search immediately so the change is
      // actually visible right away.
      performMarketplaceSearch();

    }

  );

}

// ======================================
// INITIALIZE SEE ALL BUTTONS
// ======================================

function initializeSeeAllButtons() {

  const productsBtn =

    document.getElementById(

      "discoverResultsProductsMoreBtn"

    );

  if (

    productsBtn

  ) {

    productsBtn.addEventListener(

      "click",

      function() {

        discoverResultsState.showAllProducts =

          !discoverResultsState.showAllProducts;

        performMarketplaceSearch();

     }

  );

  }

const servicesBtn =

    document.getElementById(

      "discoverResultsServicesMoreBtn"

    );

  if (

    servicesBtn

  ) {

    servicesBtn.addEventListener(

      "click",

      function() {

        discoverResultsState.showAllServices =

          !discoverResultsState.showAllServices;

        performMarketplaceSearch();

      }

    );

  }

  const vendorsBtn =

    document.getElementById(

      "discoverResultsVendorsMoreBtn"

    );

  if (

    vendorsBtn

  ) {

    vendorsBtn.addEventListener(

      "click",

      function() {

        discoverResultsState.showAllVendors =

          !discoverResultsState.showAllVendors;

        performMarketplaceSearch();

      }

    );

  }

}

// ======================================
// SEARCH SUMMARY
// ======================================

function updateSearchSummary(
  totalResults = 0
) {

  const summary =
    document.getElementById(
      "discoverResultsSummary"
    );

  if (!summary) {

    return;

  }

  if (totalResults === 1) {

    summary.textContent =
      "1 result found";

    return;

  }

  summary.textContent =

    totalResults +

    " results found";

}

// ======================================
// MARKETPLACE SEARCH
// ======================================

async function performMarketplaceSearch() {

  showLoading();

  try {

let vendors = [];

let products = [];

let services = [];

if (

  discoverResultsState.searchType ===

  "all"

) {

  vendors =

    await searchVendors();

  products =

    await searchProducts();

  services =

    await searchServices();

  services.forEach(

    function(service){

      if (

        !vendors.find(

          vendor =>

            vendor.id ===

            service.vendor_id

        )

      ) {

        vendors.push(

          service.vendors

        );

      }

    }

  );

}

else if (

  discoverResultsState.searchType ===

  "product"

) {

  products =

    await searchProducts();

}

else if (

  discoverResultsState.searchType ===

  "service"

) {

  services =

    await searchServices();

}

else if (

  discoverResultsState.searchType ===

  "vendor"

) {

  vendors =

    await searchVendors();

}

    const marketplaceResults = {

      sponsoredVendors: [],

      sponsoredProducts: [],

      sponsoredServices: [],

      vendors:

        normalizeVendorResults(
          vendors
        ),

      products:

        normalizeProductResults(
          products
        ),

      services:

        normalizeServiceResults(
          services
       )

    };

const classifiedResults =

  classifyMarketplaceResults(
    marketplaceResults
  );

const sponsoredFeed =

  buildSponsoredFeed(
    classifiedResults
  );

const displayResults =

  applyVerifiedFilter(

    classifiedResults
 );

const searchImpressions = [];

displayResults.vendors.forEach(
  vendor => {

    searchImpressions.push({
      vendor_id: vendor.id,
      event_type: "search_impression",
      search_keyword:
        discoverResultsState.keyword,
      visitor_id:
        window.visitorId
    });

  }
);

displayResults.products.forEach(
  product => {

    searchImpressions.push({
      vendor_id: product.vendorId,
      product_id: product.id,
      event_type: "search_impression",
      search_keyword:
        discoverResultsState.keyword,
      visitor_id:
        window.visitorId
    });

  }
);

displayResults.services.forEach(
  service => {

    searchImpressions.push({
      vendor_id: service.vendorId,
      service_id: service.id,
      event_type: "search_impression",
      search_keyword:
        discoverResultsState.keyword,
      visitor_id:
        window.visitorId
    });

  }
);

if (
  searchImpressions.length
) {

  const result =

    await window.supabaseClient

      .from("analytics_events")

      .insert(
        searchImpressions
      );

}

updateSearchSummary(

  displayResults.products.length +

  displayResults.services.length +

  displayResults.vendors.length

);

  applySearchTypeVisibility(

  displayResults

);

renderSponsoredFeed(
  sponsoredFeed
);

renderProductCards(

  displayResults.products

);

renderServiceCards(

  displayResults.services

);

renderVendorCards(

  displayResults.vendors

);

hideLoading();

  }

  catch (error) {

    console.error(
      error
    );

    hideLoading();

  }

}

window.refreshDiscoverResults =

  performMarketplaceSearch;

// ======================================
// VERIFIED FILTER
// ======================================

function applyVerifiedFilter(
  results
) {

  const verifiedToggle =

    document.getElementById(

      "discoverResultsVerifiedToggle"

    );

  if (

    !verifiedToggle ||

    !verifiedToggle.checked

  ) {

    return results;

  }

  return {

    sponsoredProducts:

      results.sponsoredProducts.filter(

        item =>

          item.vendorVerification === "blue"

          ||

          item.vendorVerification === "gray"

      ),

    sponsoredServices:

      results.sponsoredServices.filter(

        item =>

          item.vendorVerification === "blue"

          ||

          item.vendorVerification === "gray"

      ),

    sponsoredVendors:

      results.sponsoredVendors.filter(

        item =>

          item.verificationStatus === "blue"

          ||

          item.verificationStatus === "gray"

      ),

    products:

      results.products.filter(

        item =>

          item.vendorVerification === "blue"

          ||

          item.vendorVerification === "gray"

      ),

    services:

      results.services.filter(

        item =>

          item.vendorVerification === "blue"

          ||

          item.vendorVerification === "gray"

      ),

    vendors:

      results.vendors.filter(

        item =>

          item.verificationStatus === "blue"

          ||

          item.verificationStatus === "gray"

      )

  };

}

// ======================================
// SEARCH TYPE VISIBILITY
// ======================================

function applySearchTypeVisibility(
  results
) {

  const sponsoredSection =
    document.getElementById(
      "discoverResultsSponsoredSection"
    );

  const productsSection =
    document.getElementById(
      "discoverResultsProductsSection"
    );

  const servicesSection =
    document.getElementById(
      "discoverResultsServicesSection"
    );

  const vendorsSection =
    document.getElementById(
      "discoverResultsVendorsSection"
    );

  sponsoredSection.style.display =
    "none";

  productsSection.style.display =
    "none";

  servicesSection.style.display =
    "none";

  vendorsSection.style.display =
    "none";

  switch (

    discoverResultsState.searchType

  ) {

    case "product":

      productsSection.style.display =
        "block";

      break;

    case "service":

      servicesSection.style.display =
        "block";

      break;

    case "vendor":

      vendorsSection.style.display =
        "block";

      break;

    default:

      sponsoredSection.style.display =
        "block";

      productsSection.style.display =
        "block";

      servicesSection.style.display =
        "block";

      vendorsSection.style.display =
        "block";

  }

}

function renderVendorCards(
  vendors
) {

  const container =

    document.getElementById(
      "discoverResultsVendorsList"
    );

  if (!container) {

    return;

  }

container.innerHTML = "";

const section =

  document.getElementById(
    "discoverResultsVendorsSection"
  );

if (

  vendors.length === 0

) {

  if (section) {

    section.style.display =
      "none";

  }

  return;

}

if (section) {

  section.style.display =
    "";

}

  const visibleVendors =

    discoverResultsState.showAllVendors

      ? vendors

      : vendors.slice(0, 6);

  const moreButton =

    document.getElementById(

      "discoverResultsVendorsMoreBtn"

    );

if (

  moreButton

) {

  moreButton.textContent =

    discoverResultsState.showAllVendors

      ? "Show Less"

      : "See All";

}

  const resultsHtml =

    visibleVendors.map(

        vendor => {

        const verificationStatus =

          vendor.verificationStatus || "none";

        const isVerified =

          verificationStatus !== "none";

        const vendorLogo =

          vendor.logo &&

          vendor.logo.trim() !== ""

            ? vendor.logo

            : "images/default-vendor-logo.webp";

        const vendorAddress =

          vendor.address ||

          `${vendor.lga || ""}, ${vendor.state || ""}`;

        const averageRating =

          Number(

            vendor.rating || 0

          ).toFixed(1);

        const reviewsCount =

          vendor.reviews || 0;
        
        return `

<article

class="discover-results-vendor-card"

data-slug="${vendor.slug}"

data-vendor-id="${vendor.id}"

>

<div class="discover-results-vendor-left">

<img

src="${vendorLogo}"

alt="${vendor.name}"

class="discover-results-vendor-logo"

onerror="
this.onerror=null;
this.src='images/default-vendor-logo.webp';
"

>

</div>

<div class="discover-results-vendor-center">

<div class="discover-results-vendor-title-row">

<div class="discover-results-vendor-heading">

<h3>

${vendor.name}

</h3>

${
isVerified

?

`

<span
class="discover-results-badge-wrap"
>

<img

src="${
verificationStatus === "gray"

?

"images/graybadge.png"

:

"images/bluebadge.png"

}"

class="discover-results-badge"

>

</span>

`

:

""

}

<div class="discover-results-rating-wrap">

<i class="fa-solid fa-star"></i>

<span>

${averageRating}

</span>

<small>

(${reviewsCount})

</small>

</div>

</div>

</div>

<p class="discover-results-address">

${vendorAddress}${formatDistanceInline(vendor.distanceKm)}

</p>

<span class="discover-results-category">

${vendor.subcategory ||

vendor.category ||

"Business Vendor"}

</span>

<div class="discover-results-actions">

<button

class="discover-results-review-btn"

data-vendor-id="${vendor.id}"

>

Leave Review

</button>

<button

class="discover-results-profile-btn"

data-slug="${vendor.slug || ""}"

>

View Profile

</button>

</div>

</div>

</article>

`;

      }

    ).join("");

container.innerHTML =

  resultsHtml;

/* ========================= */
/* VENDOR CARD ACTIONS */
/* ========================= */

container

  .querySelectorAll(

    ".discover-results-profile-btn, .discover-results-review-btn"

  )

  .forEach(

    function(button){

      button.addEventListener(

        "click",

        function(event){

          event.preventDefault();

          event.stopPropagation();

          /* VIEW PROFILE */

          if (

            button.classList.contains(

              "discover-results-profile-btn"

            )

          ) {

            const slug =

              button.dataset.slug;

            if (

              slug

            ) {

              window.location.href =
                "vendor-profile.html?slug=" +

                encodeURIComponent(

                  slug

                );

            }

            return;

          }

          /* LEAVE REVIEW */

          if (

            button.classList.contains(

              "discover-results-review-btn"

            )

          ) {

            const vendorId =

              button.dataset.vendorId;

            if (

              vendorId &&

              window.ReviewsUtils &&

              typeof window.ReviewsUtils.openReviewModal ===

              "function"

            ) {

              window.ReviewsUtils.openReviewModal(

                vendorId

              );

            }

          }

        }

      );

    }

  );

}


// ======================================
// RENDER PRODUCTS
// ======================================

function renderProductCards(
  products
) {

  const container =
    document.getElementById(
      "discoverResultsProductsGrid"
    );

  if (!container) {

    return;

  }

container.innerHTML = "";

const section =

  document.getElementById(
    "discoverResultsProductsSection"
  );

if (

  discoverResultsState.showAllProducts

) {

  container.classList.add(

    "show-all"

  );

}

else {

  container.classList.remove(

    "show-all"

  );

}

if (

  products.length === 0

) {

  if (section) {

    section.style.display =
      "none";

  }

  return;

}

if (section) {

  section.style.display =
    "";

}

const moreButton =

  document.getElementById(

    "discoverResultsProductsMoreBtn"

  );

if (

  moreButton

) {

  moreButton.textContent =

    discoverResultsState.showAllProducts

      ? "Show Less"

      : "See All";

}

const visibleProducts =

  discoverResultsState.showAllProducts

    ? products

    : products.slice(0, 9);

visibleProducts.forEach(

  function(product) {

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "discover-results-product-card";

      card.innerHTML =

`

<img
src="${product.image}"
class="discover-results-product-image"
alt="${product.productName}"
>

<h3 class="discover-results-product-title">
${product.productName}
</h3>

<p class="discover-results-product-price">
₦${Number(product.price || 0).toLocaleString()}
</p>

<div class="discover-results-product-vendor">

<span>
By ${product.vendorName}
</span>

${
product.vendorVerification === "blue"
? `<img src="images/bluebadge.png" class="discover-results-product-badge">`
: product.vendorVerification === "gray"
? `<img src="images/graybadge.png" class="discover-results-product-badge">`
: ""
}

</div>

${formatDistanceLabel(product.distanceKm)}

<div class="discover-results-product-rating">

<i class="fa-solid fa-star"></i>

<span>
${Number(product.vendorRating || 0).toFixed(1)}
</span>

<small>
(${product.vendorReviews || 0})
</small>

</div>

${
product.sponsored
? `<p class="discover-results-product-sponsored">Sponsored</p>`
: ""
}

`;

      card.addEventListener(

        "click",

        function() {

          if (!product.slug) {

            return;

          }

          window.location.href =
            "vendor-product.html?slug=" +
            encodeURIComponent(product.slug);

        }

      );

      container.appendChild(
        card
      );

    }

  );

}

// ======================================
// RENDER SERVICES
// ======================================

function renderServiceCards(
  services
) {

  const container =

    document.getElementById(
      "discoverResultsServicesList"
    );

  if (!container) {

    return;

  }

container.innerHTML = "";

const section =

  document.getElementById(
    "discoverResultsServicesSection"
  );

if (!services.length) {

  if (section) {

    section.style.display =
      "none";

  }

  return;

}

if (section) {

  section.style.display =
    "";

}

  if (

    discoverResultsState.showAllServices

  ) {

    container.classList.add(

      "show-all"

    );

  }

  else {

    container.classList.remove(

      "show-all"

    );

  }

  const visibleServices =

    discoverResultsState.showAllServices

      ? services

      : services.slice(0, 9);

  const moreButton =

    document.getElementById(

      "discoverResultsServicesMoreBtn"

    );

if (

  moreButton

) {

  moreButton.textContent =

    discoverResultsState.showAllServices

      ? "Show Less"

      : "See All";

}

  const resultsHtml =

    visibleServices.map(

      service => {

        const verificationStatus =

          service.vendorVerification ||

          "none";

        const isVerified =

          verificationStatus !== "none";

        const vendorLogo =

          service.vendorLogo &&

          service.vendorLogo.trim() !== ""

            ? service.vendorLogo

            : "images/default-vendor-logo.webp";

        const averageRating =

          Number(

            service.vendorRating || 0

          ).toFixed(1);

        const reviewsCount =

          service.vendorReviews || 0;

        const serviceDescription =

          service.description

            ? (

                service.description.length > 60

                  ? service.description.slice(

                      0,

                      80

                    ) + "..."

                  : service.description

              )

            : "";

        return `

<article

class="discover-results-service-card"

data-slug="${service.slug}"

data-vendor-id="${service.vendorId}"

>

<div class="discover-results-vendor-left">

<img

src="${vendorLogo}"

class="discover-results-vendor-logo"

onerror="
this.onerror=null;
this.src='images/default-vendor-logo.webp';
"

>

</div>

<div class="discover-results-vendor-center">

<div class="discover-results-vendor-title-row">

<div class="discover-results-vendor-heading">

<h3>

${service.serviceName}

</h3>

</div>

</div>

<div class="discover-results-vendor-heading">

<p class="discover-results-service-vendor">

By:

${service.vendorName}

</p>

${
isVerified

?

`

<span
class="discover-results-badge-wrap"
>

<img

src="${
verificationStatus === "gray"

?

"images/graybadge.png"

:

"images/bluebadge.png"

}"

class="discover-results-badge"

>

</span>

`

:

""

}

<div class="discover-results-rating-wrap">

<i class="fa-solid fa-star"></i>

<span>

${averageRating}

</span>

<small>

(${reviewsCount})

</small>

</div>

${
serviceDescription

?

`

<p class="discover-results-service-description">

${serviceDescription}

</p>

`

:

""

}

</div>

<p class="discover-results-address">

${service.vendorLga || ""}

${service.vendorState ? `, ${service.vendorState}` : ""}${formatDistanceInline(service.distanceKm)}

</p>

<span class="discover-results-category">

${service.vendorSubcategory ||

service.vendorCategory ||

"Service"}

</span>

<div class="discover-results-actions">

<button

class="discover-results-review-btn"

data-vendor-id="${service.vendorId}"

>

Leave Review

</button>

<button

class="discover-results-profile-btn"

data-slug="${service.vendorSlug}"

>

View Profile

</button>

</div>

</div>

</article>

`;

      }

    ).join("");

  container.innerHTML =

    resultsHtml;

/* ========================= */
/* SERVICE CARD ACTIONS */
/* ========================= */

container

  .querySelectorAll(

    ".discover-results-profile-btn, .discover-results-review-btn"

  )

  .forEach(

    function(button){

      button.addEventListener(

        "click",

        function(event){

          event.preventDefault();

          event.stopPropagation();

          /* VIEW PROFILE */

          if (

            button.classList.contains(

              "discover-results-profile-btn"

            )

          ) {

            const slug =

              button.dataset.slug;

            if (

              slug

            ) {

              window.location.href =

                "vendor-profile.html?slug=" +

                encodeURIComponent(

                  slug

                );

            }

            return;

          }

          /* LEAVE REVIEW */

          if (

            button.classList.contains(

              "discover-results-review-btn"

            )

          ) {

            const vendorId =

              button.dataset.vendorId;

            if (

              vendorId &&

              window.ReviewsUtils

            ) {

              window.ReviewsUtils.openReviewModal(

                vendorId

              );

            }

          }

        }

      );

    }

  );

container

  .querySelectorAll(

    ".discover-results-service-card"

  )

  .forEach(

    function(card){

      card.addEventListener(

        "click",

        function(){

const slug =

  card.dataset.slug;

if (!slug) {

  alert(
    "No service slug found."
  );

  return;

}

          window.location.href =

            "vendor-service.html?slug=" +

            encodeURIComponent(

              slug

            );

        }

      );

    }

  );


}

// ======================================
// LOADING
// ======================================

function showLoading() {

  const loading =
    document.getElementById(
      "discoverResultsLoading"
    );

  if (!loading) {

    return;

  }

  loading.style.display =
    "flex";

}

function hideLoading() {

  const loading =
    document.getElementById(
      "discoverResultsLoading"
    );

  if (!loading) {

    return;

  }

  loading.style.display =
    "none";

}

// ======================================
// HAVERSINE DISTANCE (km)
// ======================================

function haversineDistanceKm(lat1, lon1, lat2, lon2) {

  if (
    lat1 == null || lon1 == null ||
    lat2 == null || lon2 == null
  ) {
    return null;
  }

  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;

}

function applyDistanceFilter(items, getLat, getLng) {

  if (
    !discoverResultsState.distanceEnabled ||
    discoverResultsState.latitude === null ||
    discoverResultsState.longitude === null
  ) {
    return items;
  }

  return items
    .map(item => {
      const distance = haversineDistanceKm(
        discoverResultsState.latitude,
        discoverResultsState.longitude,
        getLat(item),
        getLng(item)
      );
      return { ...item, distanceKm: distance };
    })
    .filter(item =>
      item.distanceKm !== null &&
      item.distanceKm <= discoverResultsState.radius
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);

}

// ======================================
// FORMAT DISTANCE LABEL
// e.g. "3.5km away" or "450m away". Returns
// an empty string when distance wasn't
// computed for this item (distance search
// not enabled), so cards simply omit the
// label rather than showing something wrong.
// ======================================

function formatDistanceLabel(distanceKm) {

  if (
    distanceKm === undefined ||
    distanceKm === null ||
    isNaN(distanceKm)
  ) {
    return "";
  }

  const displayValue =
    distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m`
      : `${distanceKm.toFixed(1)}km`;

  return `<p class="discover-results-distance-label"><i class="fa-solid fa-location-dot"></i>${displayValue} away</p>`;

}

// ======================================
// FORMAT DISTANCE INLINE
// Same as above, but as an inline fragment
// meant to sit directly in front of an
// address/LGA/state line, e.g.
// "0.5km away · Alimosho, Lagos" — rather
// than its own separate block below it.
// ======================================

function formatDistanceInline(distanceKm) {

  if (
    distanceKm === undefined ||
    distanceKm === null ||
    isNaN(distanceKm)
  ) {
    return "";
  }

  const displayValue =
    distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m`
      : `${distanceKm.toFixed(1)}km`;

  return ` · <span class="discover-results-distance-inline"><i class="fa-solid fa-location-dot"></i>${displayValue} away</span>`;

}

// ======================================
// SEARCH VENDORS
// ======================================

async function searchVendors() {

  const keyword =

    discoverResultsState.keyword.trim();

  let query =

    window.supabaseClient

      .from("vendors")

      .select("*")

      .eq(
        "account_status",
        "active"
      );

  if (keyword) {

    query =

      query.or(

        "name.ilike.%" +

        keyword +

        "%," +

        "category.ilike.%" +

        keyword +

        "%," +

        "subcategory.ilike.%" +

        keyword +

        "%," +

        "description.ilike.%" +

        keyword +

        "%"

      );

  }

  if (

    discoverResultsState.category

  ) {

    query =

      query.eq(

        "category",

        discoverResultsState.category

      );

  }

  if (

    discoverResultsState.subcategory

  ) {

    query =

      query.eq(

        "subcategory",

        discoverResultsState.subcategory

      );

  }

  if (

    discoverResultsState.state

  ) {

    query =

      query.eq(

        "state",

        discoverResultsState.state

      );

  }

  if (

    discoverResultsState.lga

  ) {

    query =

      query.eq(

        "lga",

        discoverResultsState.lga

      );

  }

  if (

    discoverResultsState.verified

  ) {

    query =

      query.neq(

        "verification_status",

        "none"

      );

  }

  const {

    data,

    error

  } =

    await query;

  if (error) {

    console.error(error);

    return [];

  }

  return applyDistanceFilter(
    data || [],
    v => v.latitude,
    v => v.longitude
  );

}

// ======================================
// NORMALIZE VENDORS
// ======================================

function normalizeVendorResults(
  vendors
) {

  return vendors.map(

    function (vendor) {

      return {

        id:
          vendor.id,

        slug:
          vendor.slug,

        name:
          vendor.name || "",

        logo:
          vendor.logo_url || "",

        cover:
          vendor.cover_url || "",

        category:
          vendor.category || "",

        subcategory:
          vendor.subcategory || "",

        state:
          vendor.state || "",

        lga:
          vendor.lga || "",

        verificationStatus:
          vendor.verification_status || "none",

        rating:
          Number(
            vendor.average_rating
          ) || 0,

        reviews:
          Number(
            vendor.reviews_count
          ) || 0,

        sponsored:
          vendor.is_sponsored,

        businessType:
          vendor.business_type || "",

        distanceKm:
          vendor.distanceKm,

        vendor

      };

    }

  );

}


// ======================================
// SEARCH PRODUCTS
// Now uses the search_products RPC — real
// server-side filtering (keyword, category,
// subcategory, state, lga, verified), instead
// of fetching every product in the database.
// ======================================

async function searchProducts() {

  const keyword =
    discoverResultsState.keyword.trim();

  const { data, error } =
    await window.supabaseClient.rpc(
      "search_products",
      {
        p_keyword: keyword || null,
        p_category: discoverResultsState.category || null,
        p_subcategory: discoverResultsState.subcategory || null,
        p_state: discoverResultsState.state || null,
        p_lga: discoverResultsState.lga || null,
        p_verified_only: discoverResultsState.verified
      }
    );

  if (error) {

    console.error("search_products error:", error);
    return [];

  }

  return applyDistanceFilter(
    data || [],
    p => p.vendor_latitude,
    p => p.vendor_longitude
  );

}

// ======================================
// NORMALIZE PRODUCTS
// Adapted for the flat RPC row shape
// (vendor_* columns) instead of a nested join.
// ======================================

function normalizeProductResults(
  products
) {

  return products.map(

    function (product) {

      return {

        id:
          product.id,

        slug:
          product.slug || "",

        vendorId:
          product.vendor_id,

        productName:
          product.product_name || "",

        description:
          product.short_description || "",

        price:
          product.price,

        image:
          product.primary_image_url || "",

        vendorName:
          product.vendor_name || "",

        vendorCategory:
          product.vendor_category || "",

        vendorSubcategory:
          product.vendor_subcategory || "",

        vendorState:
          product.vendor_state || "",

        vendorLga:
          product.vendor_lga || "",

        vendorRating:
          Number(
            product.vendor_average_rating
          ) || 0,

        vendorReviews:

          Number(
            product.vendor_reviews_count
          ) || 0,

        vendorVerification:

          product.vendor_verification_status ||

          "none",

        sponsored:

          product.vendor_is_sponsored,

        vendorSlug:

          product.vendor_slug || "",

        vendorLogo:

          product.vendor_logo_url || "",

        distanceKm:

          product.distanceKm,

        raw:
          product

      };

    }

  );

}

// ======================================
// SEARCH SERVICES
// Now uses the search_services RPC — same
// real server-side filtering as products.
// ======================================

async function searchServices() {

  const keyword =
    discoverResultsState.keyword.trim();

  const { data, error } =
    await window.supabaseClient.rpc(
      "search_services",
      {
        p_keyword: keyword || null,
        p_category: discoverResultsState.category || null,
        p_subcategory: discoverResultsState.subcategory || null,
        p_state: discoverResultsState.state || null,
        p_lga: discoverResultsState.lga || null,
        p_verified_only: discoverResultsState.verified
      }
    );

  if (error) {

    console.error("search_services error:", error);
    return [];

  }

  return applyDistanceFilter(
    data || [],
    s => s.vendor_latitude,
    s => s.vendor_longitude
  );

}

// ======================================
// NORMALIZE SERVICES
// Adapted for the flat RPC row shape, and now
// carries full vendor fields (slug/logo/etc)
// so a service's vendor can be safely merged
// into vendor results without missing data —
// fixes the previous broken-image/broken-link
// bug when merging services into "All" search.
// ======================================

function normalizeServiceResults(
  services
) {

  return services.map(

    function (service) {

     return {

        id:
          service.id,
        slug:
        service.slug || "",

        vendorId:
          service.vendor_id,

        serviceName:
          service.service_name || "",

        description:
          service.short_description || "",

        vendorName:
          service.vendor_name || "",

        vendorCategory:
          service.vendor_category || "",

        vendorSubcategory:
          service.vendor_subcategory || "",

        vendorState:
          service.vendor_state || "",

        vendorLga:
          service.vendor_lga || "",

        vendorRating:
          Number(
            service.vendor_average_rating
          ) || 0,
        vendorReviews:

        service.vendor_reviews_count || 0,

        vendorVerification:

          service.vendor_verification_status ||

          "none",

        sponsored:

          service.vendor_is_sponsored,

        vendorSlug:

          service.vendor_slug || "",

        vendorLogo:

          service.vendor_logo_url || "",

        distanceKm:

          service.distanceKm,

        raw:
          service,

        // Full vendor shape available for safe merging into
        // vendor results (fixes the missing slug/logo bug)
        vendors: {
          id: service.vendor_id,
          slug: service.vendor_slug || "",
          name: service.vendor_name || "",
          logo_url: service.vendor_logo_url || "",
          category: service.vendor_category || "",
          subcategory: service.vendor_subcategory || "",
          verification_status: service.vendor_verification_status || "none",
          average_rating: service.vendor_average_rating || 0,
          reviews_count: service.vendor_reviews_count || 0,
          is_sponsored: service.vendor_is_sponsored
        }

      };

    }

  );

}

// ======================================
// CLASSIFY MARKETPLACE RESULTS
// ======================================

function classifyMarketplaceResults(
  marketplaceResults
) {

  marketplaceResults.sponsoredProducts =

    marketplaceResults.products.filter(

      (product) =>

        product.sponsored === true

    );

  marketplaceResults.sponsoredServices =

    marketplaceResults.services.filter(

      (service) =>

        service.sponsored === true

    );

  marketplaceResults.sponsoredVendors =

    marketplaceResults.vendors.filter(

      (vendor) =>

        vendor.sponsored === true

    );

  /*
    Keep the original arrays intact.

    Sponsored items should
    appear BOTH in the
    Sponsored section
    AND in their natural
    Product / Service /
    Vendor sections.

    This matches major
    ecommerce marketplaces
    and provides maximum
    value for advertisers.
  */

  return marketplaceResults;

}

// ======================================
// BUILD SPONSORED FEED
// ======================================

function buildSponsoredFeed(
  marketplaceResults
) {

  return [

    ...marketplaceResults.sponsoredProducts,

    ...marketplaceResults.sponsoredServices,

    ...marketplaceResults.sponsoredVendors

  ];

}

// ======================================
// RENDER SPONSORED FEED
// Previously built but never rendered (the
// call was commented out and no render
// function existed). Now actually renders the
// dedicated Sponsored section, reusing the
// same card markup patterns as the other
// sections.
// ======================================

function renderSponsoredFeed(items) {

  const section = document.getElementById("discoverResultsSponsoredSection");
  const container = document.getElementById("discoverResultsSponsoredContainer");

  if (!section || !container) {
    return;
  }

  if (!items || items.length === 0) {
    section.style.display = "none";
    return;
  }

  container.innerHTML = "";

  items.forEach(item => {

    const card = document.createElement("article");
    card.className = "discover-results-sponsored-card";

    const isProduct = "productName" in item;
    const isService = "serviceName" in item;

    const name = isProduct
      ? item.productName
      : isService
        ? item.serviceName
        : item.name;

    const image = isProduct
      ? item.image
      : isService
        ? (item.vendorLogo || "images/default-vendor-logo.webp")
        : (item.logo || "images/default-vendor-logo.webp");

    const slugTarget = isProduct
      ? `vendor-product.html?slug=${encodeURIComponent(item.slug)}`
      : isService
        ? `vendor-service.html?slug=${encodeURIComponent(item.slug)}`
        : `vendor-profile.html?slug=${encodeURIComponent(item.slug)}`;

    const vendorName = isProduct || isService ? item.vendorName : item.name;
    const rating = isProduct || isService ? item.vendorRating : item.rating;
    const reviews = isProduct || isService ? item.vendorReviews : item.reviews;
    const verification = isProduct || isService ? item.vendorVerification : item.verificationStatus;

    const badge =
      verification === "blue"
        ? `<img src="images/bluebadge.png" class="discover-results-product-badge">`
        : verification === "gray"
          ? `<img src="images/graybadge.png" class="discover-results-product-badge">`
          : "";

    card.innerHTML = `
      <img src="${image}" class="discover-results-product-image" alt="${name}">
      <h3 class="discover-results-product-title">${name}</h3>
      <div class="discover-results-product-vendor">
        <span>By ${vendorName}</span>
        ${badge}
      </div>
      ${formatDistanceLabel(item.distanceKm)}
      <div class="discover-results-product-rating">
        <i class="fa-solid fa-star"></i>
        <span>${Number(rating || 0).toFixed(1)}</span>
        <small>(${reviews || 0})</small>
      </div>
      <p class="discover-results-product-sponsored">Sponsored</p>
    `;

    card.addEventListener("click", () => {
      window.location.href = slugTarget;
    });

    container.appendChild(card);

  });

  section.style.display = "";

}

/* ========================= */
/* SERVICES CAROUSEL ARROWS */
/* ========================= */

const servicesPrevBtn =
  document.getElementById(
    "discoverResultsServicesPrevBtn"
  );

const servicesNextBtn =
  document.getElementById(
    "discoverResultsServicesNextBtn"
  );

const servicesList =
  document.getElementById(
    "discoverResultsServicesList"
  );

if (
  servicesPrevBtn &&
  servicesNextBtn &&
  servicesList
) {

  servicesPrevBtn.addEventListener(
    "click",
    function () {

      servicesList.scrollBy({

        left: -380,

        behavior: "smooth"

      });

    }
  );

  servicesNextBtn.addEventListener(
    "click",
    function () {

      servicesList.scrollBy({

        left: 380,

        behavior: "smooth"

      });

    }
  );

}

/* ========================= */
/* PRODUCTS CAROUSEL ARROWS */
/* ========================= */

const productsPrevBtn =
  document.getElementById(
    "discoverResultsProductsPrevBtn"
  );

const productsNextBtn =
  document.getElementById(
    "discoverResultsProductsNextBtn"
  );

const productsGrid =
  document.getElementById(
    "discoverResultsProductsGrid"
  );

if (
  productsPrevBtn &&
  productsNextBtn &&
  productsGrid
) {

  productsPrevBtn.addEventListener(
    "click",
    function () {

      productsGrid.scrollBy({

        left: -180,

        behavior: "smooth"

      });

    }
  );

  productsNextBtn.addEventListener(
    "click",
    function () {

      productsGrid.scrollBy({

        left: 180,

        behavior: "smooth"

      });

    }
  );

}

/* ========================= */
/* DISTANCE FILTER DRAWER UI  */
/* (mirrors discover.js) */
/* ========================= */

document.addEventListener("DOMContentLoaded", () => {

  const filtersBtn = document.getElementById("discoverResultsFiltersBtn");
  const drawer = document.getElementById("discoverResultsFiltersDrawer");
  const overlay = document.getElementById("discoverResultsDrawerOverlay");
  const closeBtn = document.getElementById("discoverResultsCloseFiltersBtn");

  function openDrawer() {
    if (drawer && overlay) {
      drawer.classList.add("active");
      overlay.classList.add("active");
    }
  }

  function closeDrawer() {
    if (drawer && overlay) {
      drawer.classList.remove("active");
      overlay.classList.remove("active");
    }
  }

  if (filtersBtn) filtersBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);

  const enableDistance = document.getElementById("discoverResultsEnableDistanceSearch");
  const radiusSlider = document.getElementById("discoverResultsRadiusSlider");
  const radiusValue = document.getElementById("discoverResultsRadiusValue");
  const useLocationBtn = document.getElementById("discoverResultsUseLocationBtn");

  if (radiusSlider && radiusValue) {
    radiusSlider.addEventListener("input", () => {
      radiusValue.textContent = `${radiusSlider.value}km`;
      discoverResultsState.radius = Number(radiusSlider.value);
    });

    // Re-search once the user releases the slider (not on every
    // pixel of drag, which "input" would fire constantly) — only
    // if distance search is actually enabled already.
    radiusSlider.addEventListener("change", () => {
      if (discoverResultsState.distanceEnabled) {
        performMarketplaceSearch();
      }
    });
  }

  if (enableDistance) {

    enableDistance.checked = discoverResultsState.distanceEnabled;

    function fetchFreshLocation(onDone) {

      if (useLocationBtn) {
        useLocationBtn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Detecting...`;
      }

      navigator.geolocation.getCurrentPosition(

        position => {
          discoverResultsState.latitude = position.coords.latitude;
          discoverResultsState.longitude = position.coords.longitude;

          if (useLocationBtn) {
            useLocationBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Location Ready`;
          }

          if (onDone) onDone();
        },

        () => {
          discoverResultsState.distanceEnabled = false;
          enableDistance.checked = false;

          if (useLocationBtn) {
            useLocationBtn.innerHTML = `<i class="fa-solid fa-location-xmark"></i> Denied`;
          }
        },

        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }

      );

    }

    enableDistance.addEventListener("change", () => {

      discoverResultsState.distanceEnabled = enableDistance.checked;

      if (enableDistance.checked && navigator.geolocation) {

        // Reuse an already-captured location instead of re-requesting
        // fresh GPS every time this is toggled on — browser geolocation
        // (especially WiFi/network-based, not true GPS) can genuinely
        // drift between successive requests, which previously made
        // results flicker between on/off toggles for no real reason.
        // An explicit "Use Current Location" click still always
        // refreshes it, for when the visitor has actually moved.
        if (
          discoverResultsState.latitude !== null &&
          discoverResultsState.longitude !== null
        ) {

          if (useLocationBtn) {
            useLocationBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Location Ready`;
          }

          performMarketplaceSearch();

          return;

        }

        fetchFreshLocation(performMarketplaceSearch);

      } else {

        // Unchecked — re-search immediately so results go back to
        // unfiltered-by-distance right away, same instant feedback
        // as turning it on.
        performMarketplaceSearch();

      }

    });

    if (useLocationBtn) {

      useLocationBtn.addEventListener("click", () => {

        if (!navigator.geolocation) return;

        fetchFreshLocation(() => {
          if (discoverResultsState.distanceEnabled) {
            performMarketplaceSearch();
          }
        });

      });

    }

  }

  const applyBtn = document.getElementById("discoverResultsApplyFiltersBtn");
  const resetBtn = document.getElementById("discoverResultsResetFiltersBtn");

  const categorySelect = document.getElementById("discoverResultsCategory");
  const subcategorySelect = document.getElementById("discoverResultsSubcategory");
  const stateSelect = document.getElementById("discoverResultsState");
  const lgaSelect = document.getElementById("discoverResultsLga");

  async function loadFilterOptions() {

    if (categorySelect) {

      const { data } = await window.supabaseClient
        .from("vendors")
        .select("category")
        .not("category", "is", null);

      const unique = [...new Set((data || []).map(r => r.category?.trim()).filter(Boolean))].sort();

      categorySelect.innerHTML = `<option value="">Select Category</option>`;

      unique.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        if (c === discoverResultsState.category) opt.selected = true;
        categorySelect.appendChild(opt);
      });

    }

    if (stateSelect && window.nigeriaData) {

      stateSelect.innerHTML = `<option value="">Select State</option>`;

      Object.keys(window.nigeriaData).sort().forEach(state => {
        const opt = document.createElement("option");
        opt.value = state;
        opt.textContent = state;
        if (state === discoverResultsState.state) opt.selected = true;
        stateSelect.appendChild(opt);
      });

    }

  }

  if (categorySelect) {

    categorySelect.addEventListener("change", async () => {

      subcategorySelect.innerHTML = `<option value="">Select Subcategory</option>`;

      if (!categorySelect.value) return;

      const { data } = await window.supabaseClient
        .from("vendors")
        .select("subcategory")
        .eq("category", categorySelect.value)
        .not("subcategory", "is", null);

      const unique = [...new Set((data || []).map(r => r.subcategory?.trim()).filter(Boolean))].sort();

      unique.forEach(sc => {
        const opt = document.createElement("option");
        opt.value = sc;
        opt.textContent = sc;
        subcategorySelect.appendChild(opt);
      });

    });

  }

  if (stateSelect) {

    stateSelect.addEventListener("change", () => {

      lgaSelect.innerHTML = `<option value="">Select LGA</option>`;

      const lgas = (window.nigeriaData || {})[stateSelect.value] || [];

      lgas.forEach(lga => {
        const opt = document.createElement("option");
        opt.value = lga;
        opt.textContent = lga;
        lgaSelect.appendChild(opt);
      });

    });

  }

  if (applyBtn) {

    applyBtn.addEventListener("click", () => {

      discoverResultsState.category = categorySelect?.value || "";
      discoverResultsState.subcategory = subcategorySelect?.value || "";
      discoverResultsState.state = stateSelect?.value || "";
      discoverResultsState.lga = lgaSelect?.value || "";

      closeDrawer();

      performMarketplaceSearch();

    });

  }

  if (resetBtn) {

    resetBtn.addEventListener("click", () => {

      if (categorySelect) categorySelect.value = "";
      if (subcategorySelect) subcategorySelect.innerHTML = `<option value="">Select Subcategory</option>`;
      if (stateSelect) stateSelect.value = "";
      if (lgaSelect) lgaSelect.innerHTML = `<option value="">Select LGA</option>`;

    });

  }

  const nearbyBtn = document.getElementById("discoverResultsNearbyBtn");

  if (nearbyBtn) {

    nearbyBtn.addEventListener("click", () => {

      if (enableDistance) {
        enableDistance.checked = true;
        enableDistance.dispatchEvent(new Event("change"));
      }

      openDrawer();

    });

  }

  loadFilterOptions();

  const profileNav = document.getElementById("discoverResultsProfileNav");

  if (profileNav) {

    profileNav.addEventListener("click", async () => {

      try {

        const { data: { session } } = await window.supabaseClient.auth.getSession();

        window.location.href = session ? "vendordashboard.html" : "login.html";

      } catch {

        window.location.href = "login.html";

      }

    });

  }

});
