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
    ) || null

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

  updateSearchSummary(
    0
  );

  performMarketplaceSearch();

}

// ======================================
// POPULATE SEARCH INPUT
// ======================================

function populateSearchInput() {

  const searchInput =
    document.getElementById(
      "discoverResultsSearchInput"
    );

  if (!searchInput) {

    return;

  }

  searchInput.value =
    discoverResultsState.keyword;

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

    updateSearchSummary(

      products.length +

      services.length +

      vendors.length

    );

const classifiedResults =

  classifyMarketplaceResults(
    marketplaceResults
  );

const sponsoredFeed =

  buildSponsoredFeed(
    classifiedResults
  );

applySearchTypeVisibility(
  classifiedResults
);

// renderSponsoredFeed(
//   sponsoredFeed
// );

renderProductCards(
  classifiedResults.products
);

renderVendorCards(
  classifiedResults.vendors
);

hideLoading();

}

  catch (error) {

    console.error(error);

    hideLoading();

  }

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

  const resultsHtml =

    vendors.map(

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

data-slug="${vendor.slug}"

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

    products.length === 0

  ) {

    return;

  }

  products.forEach(

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
      >

      <h3>

        ${product.productName}

      </h3>

      <p>

        ${product.vendorName}

      </p>

      `;

      card.addEventListener(

        "click",

        function() {

          /*
             Screen 3
          */

        }

      );

      container.appendChild(
        card
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
          category,
          subcategory,
          state,
          lga,
          verification_status,
          is_sponsored,
          average_rating,
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

      return {

        id:
          service.id,

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