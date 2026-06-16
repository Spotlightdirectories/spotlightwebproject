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
      ".discover-results2-tab"
    );

  tabs.forEach((tab) => {

    tab.classList.remove(
      "active"
    );

  });

  const activeTab =
    document.querySelector(

      '.discover-results2-tab[data-type="' +
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

        "discover-results2.html?" +

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

    const vendors =
      await searchVendors();

    const products =
      await searchProducts();

    const services =
      await searchServices();

    services.forEach(
      function(service) {

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

updateSearchSummary(

  displayResults.products.length +

  displayResults.services.length +

  displayResults.vendors.length

);

  applySearchTypeVisibility(

  displayResults

);

// renderSponsoredFeed(
//   buildSponsoredFeed(
//     displayResults
//   )
// );

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

  if (

    vendors.length === 0

  ) {

    return;

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

class="discover-results2-vendor-card"

data-slug="${vendor.slug}"

data-vendor-id="${vendor.id}"

>

<div class="discover-results2-vendor-left">

<img

src="${vendorLogo}"

alt="${vendor.name}"

class="discover-results2-vendor-logo"

onerror="
this.onerror=null;
this.src='images/default-vendor-logo.webp';
"

>

</div>

<div class="discover-results2-vendor-center">

<div class="discover-results2-vendor-title-row">

<div class="discover-results2-vendor-heading">

<h3>

${vendor.name}

</h3>

${
isVerified

?

`

<span
class="discover-results2-badge-wrap"
>

<img

src="${
verificationStatus === "gray"

?

"images/graybadge.png"

:

"images/bluebadge.png"

}"

class="discover-results2-badge"

>

</span>

`

:

""

}

<div class="discover-results2-rating-wrap">

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

<p class="discover-results2-address">

${vendorAddress}

</p>

<span class="discover-results2-category">

${vendor.subcategory ||

vendor.category ||

"Business Vendor"}

</span>

<div class="discover-results2-actions">

<button

class="discover-results2-review-btn"

data-vendor-id="${vendor.id}"

>

Leave Review

</button>

<button

class="discover-results2-profile-btn"

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

    ".discover-results2-profile-btn, .discover-results2-review-btn"

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

              "discover-results2-profile-btn"

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

              "discover-results2-review-btn"

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

    return;

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
        "discover-results2-product-card";

      card.innerHTML =

`

<img
src="${product.image}"
class="discover-results2-product-image"
alt="${product.productName}"
>

<h3 class="discover-results2-product-title">
${product.productName}
</h3>

<p class="discover-results2-product-price">
₦${Number(product.price || 0).toLocaleString()}
</p>

<div class="discover-results2-product-vendor">

<span>
By ${product.vendorName}
</span>

${
product.vendorVerification === "blue"
? `<img src="images/bluebadge.png" class="discover-results2-product-badge">`
: product.vendorVerification === "gray"
? `<img src="images/graybadge.png" class="discover-results2-product-badge">`
: ""
}

</div>

<div class="discover-results2-product-rating">

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
? `<p class="discover-results2-product-sponsored">Sponsored</p>`
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

  if (!services.length) {

    return;

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

class="discover-results2-service-card"

data-slug="${service.slug}"

data-vendor-id="${service.vendorId}"

>

<div class="discover-results2-vendor-left">

<img

src="${vendorLogo}"

class="discover-results2-vendor-logo"

onerror="
this.onerror=null;
this.src='images/default-vendor-logo.webp';
"

>

</div>

<div class="discover-results2-vendor-center">

<div class="discover-results2-vendor-title-row">

<div class="discover-results2-vendor-heading">

<h3>

${service.serviceName}

</h3>

</div>

</div>

<div class="discover-results2-vendor-heading">

<p class="discover-results2-service-vendor">

By:

${service.vendorName}

</p>

${
isVerified

?

`

<span
class="discover-results2-badge-wrap"
>

<img

src="${
verificationStatus === "gray"

?

"images/graybadge.png"

:

"images/bluebadge.png"

}"

class="discover-results2-badge"

>

</span>

`

:

""

}

<div class="discover-results2-rating-wrap">

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

<p class="discover-results2-service-description">

${serviceDescription}

</p>

`

:

""

}

</div>

<p class="discover-results2-address">

${service.vendorLga || ""}

${service.vendorState ? `, ${service.vendorState}` : ""}

</p>

<span class="discover-results2-category">

${service.vendorSubcategory ||

service.vendorCategory ||

"Service"}

</span>

<div class="discover-results2-actions">

<button

class="discover-results2-review-btn"

data-vendor-id="${service.vendorId}"

>

Leave Review

</button>

<button

class="discover-results2-profile-btn"

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

    ".discover-results2-profile-btn, .discover-results2-review-btn"

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

              "discover-results2-profile-btn"

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

              "discover-results2-review-btn"

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

    ".discover-results2-service-card"

  )

  .forEach(

    function(card){

      card.addEventListener(

        "click",

        function(){

const slug =

  card.dataset.slug;

console.log(
  "Service slug:",
  slug
);

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

  return data || [];

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

        vendor

      };

    }

  );

}


// ======================================
// SEARCH PRODUCTS
// ======================================

async function searchProducts() {

  const keyword =
    discoverResultsState.keyword.trim();

  let query =

    window.supabaseClient

      .from("vendor_products")

      .select(`
        *,
        vendors (
          id,
          name,
          category,
          subcategory,
          state,
          lga,
          verification_status,
          is_sponsored,
          average_rating,
          reviews_count,
          account_status
        )
      `);

  const {

    data,

    error

  } = await query;

  if (error) {

    console.error(error);

    return [];

  }

  let results =

    (data || []).filter((product) => {

      if (

        !product.vendors ||

        product.vendors.account_status !== "active"

      ) {

        return false;

      }

      if (!keyword) {

        return true;

      }

      const text = [

        product.product_name,

        product.short_description,

        product.key_details,

        product.vendors.name,

        product.vendors.category,

        product.vendors.subcategory

      ]

        .join(" ")

        .toLowerCase();

      return text.includes(

        keyword.toLowerCase()

      );

    });

  if (

    discoverResultsState.category

  ) {

    results = results.filter(

      (product) =>

        product.vendors.category ===

        discoverResultsState.category

    );

  }

  if (

    discoverResultsState.subcategory

  ) {

    results = results.filter(

      (product) =>

        product.vendors.subcategory ===

        discoverResultsState.subcategory

    );

  }

  if (

    discoverResultsState.state

  ) {

    results = results.filter(

      (product) =>

        product.vendors.state ===

        discoverResultsState.state

    );

  }

  if (

    discoverResultsState.lga

  ) {

    results = results.filter(

      (product) =>

        product.vendors.lga ===

        discoverResultsState.lga

    );

  }

  if (

    discoverResultsState.verified

  ) {

    results = results.filter(

      (product) =>

        product.vendors.verification_status !==

        "none"

    );

  }

  return results;

}

// ======================================
// NORMALIZE PRODUCTS
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

        keyDetails:
          product.key_details || "",

        price:
          product.price,

        image:
          product.primary_image_url || "",

        secondaryImage:
          product.secondary_image_url || "",

        tertiaryImage:
          product.tertiary_image_url || "",

        vendorName:
          product.vendors.name || "",

        vendorCategory:
          product.vendors.category || "",

        vendorSubcategory:
          product.vendors.subcategory || "",

        vendorState:
          product.vendors.state || "",

        vendorLga:
          product.vendors.lga || "",

        vendorRating:
          Number(
            product.vendors.average_rating
          ) || 0,

        vendorReviews:

          Number(
            product.vendors.reviews_count
          ) || 0,

        vendorVerification:

          product.vendors.verification_status ||

          "none",

        sponsored:

          product.vendors.is_sponsored,

        vendorSlug:

          product.vendors.slug || "",

        raw:
          product

      };

    }

  );

}

// ======================================
// SEARCH SERVICES
// ======================================

async function searchServices() {

  const keyword =
    discoverResultsState.keyword.trim();

  const {
    data,
    error
  } =

    await window.supabaseClient

      .from("vendor_services")

      .select(`
        *,
         vendors (
           id,
           name,
           slug,
           logo_url,
           category,
           subcategory,
           state,
           lga,
           verification_status,
           is_sponsored,
           average_rating,
           reviews_count,
           account_status
        )
      `);

  if (error) {

    console.error(error);

    return [];

  }

  let results =

    (data || []).filter(

      (service) => {

        if (

          !service.vendors ||

          service.vendors.account_status !==
          "active"

        ) {

          return false;

        }

        if (!keyword) {

          return true;

        }

        const text = [

          service.service_name,

          service.short_description,

          service.vendors.name,

          service.vendors.category,

          service.vendors.subcategory

        ]

          .join(" ")

          .toLowerCase();

        return text.includes(

          keyword.toLowerCase()

        );

      }

    );

  if (

    discoverResultsState.category

  ) {

    results =

      results.filter(

        (service) =>

          service.vendors.category ===

          discoverResultsState.category

      );

  }

  if (

    discoverResultsState.subcategory

  ) {

    results =

      results.filter(

        (service) =>

          service.vendors.subcategory ===

          discoverResultsState.subcategory

      );

  }

  if (

    discoverResultsState.state

  ) {

    results =

      results.filter(

        (service) =>

          service.vendors.state ===

          discoverResultsState.state

      );

  }

  if (

    discoverResultsState.lga

  ) {

    results =

      results.filter(

        (service) =>

          service.vendors.lga ===

          discoverResultsState.lga

      );

  }

  if (

    discoverResultsState.verified

  ) {

    results =

      results.filter(

        (service) =>

          service.vendors.verification_status !==

          "none"

      );

  }

  return results;

}

// ======================================
// NORMALIZE SERVICES
// ======================================

function normalizeServiceResults(
  services
) {

  return services.map(

    function (service) {

      console.log(
  "SERVICE:",
  service.service_name,
  "SLUG:",
  service.slug
);

      return {

        id:
          service.id,
        slug:
        service.slug || "",
      
        rawSlug:
          service.slug,

        vendorId:
          service.vendor_id,

        serviceName:
          service.service_name || "",

        description:
          service.short_description || "",

        vendorName:
          service.vendors.name || "",

        vendorCategory:
          service.vendors.category || "",

        vendorSubcategory:
          service.vendors.subcategory || "",

        vendorState:
          service.vendors.state || "",

        vendorLga:
          service.vendors.lga || "",

        vendorRating:
          Number(
            service.vendors.average_rating
          ) || 0,
        vendorReviews:

        service.vendors.reviews_count || 0,

        vendorVerification:

          service.vendors.verification_status ||

          "none",

        sponsored:

          service.vendors.is_sponsored,

        vendorSlug:

          service.vendors.slug || "",

        raw:
          service

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



