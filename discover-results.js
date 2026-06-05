document.addEventListener(
  "DOMContentLoaded",
  () => {

    /* ========================= */
    /* URL PARAMS */
    /* ========================= */

 /* URL PARAMS */

function getUrlParams() {

  return new URLSearchParams(
    window.location.search
  );

}

    /* ========================= */
    /* ELEMENTS */
    /* ========================= */

    const resultsBackBtn =
      document.getElementById(
        "resultsBackBtn"
      );

    const discoverResultsSearchInput =
      document.getElementById(
        "discoverResultsSearchInput"
      );

    const resultsVerifiedOnly =
      document.getElementById(
        "resultsVerifiedOnly"
      );

    const resultsDistanceBtn =
      document.getElementById(
        "resultsDistanceBtn"
      );

    let nearbyLoading = false;

    const resultsSummaryText =
      document.getElementById(
        "resultsSummaryText"
      );

    /* FILTER DRAWER */

    const resultsMoreFiltersBtn =
      document.getElementById(
        "resultsMoreFiltersBtn"
      );

    const resultsFiltersDrawer =
      document.getElementById(
        "resultsFiltersDrawer"
      );

    const resultsDrawerOverlay =
      document.getElementById(
        "resultsDrawerOverlay"
      );

    const closeResultsFiltersBtn =
      document.getElementById(
        "closeResultsFiltersBtn"
      );

          const resultsCategory =
      document.getElementById(
        "resultsCategory"
      );

    const resultsSubcategory =
      document.getElementById(
        "resultsSubcategory"
      );

    const resultsState =
      document.getElementById(
        "resultsState"
      );

    const resultsLga =
      document.getElementById(
        "resultsLga"
      );

    const resultsApplyFiltersBtn =
      document.getElementById(
        "resultsApplyFiltersBtn"
      );

    const resultsResetFiltersBtn =
      document.getElementById(
        "resultsResetFiltersBtn"
      );

    /* ========================= */
    /* BACK BUTTON */
    /* ========================= */

    if (resultsBackBtn) {

      resultsBackBtn.addEventListener(
        "click",
        () => {

          window.history.back();

        }
      );

    }

    /* ========================= */
    /* FILTER DRAWER */
    /* ========================= */

    function openResultsFiltersDrawer() {

      if (
        resultsFiltersDrawer &&
        resultsDrawerOverlay
      ) {

        resultsFiltersDrawer.classList.add(
          "active"
        );

        resultsDrawerOverlay.classList.add(
          "active"
        );

        document.body.style.overflow =
          "hidden";

      }

    }

    function closeResultsFiltersDrawer() {

      if (
        resultsFiltersDrawer &&
        resultsDrawerOverlay
      ) {

        resultsFiltersDrawer.classList.remove(
          "active"
        );

        resultsDrawerOverlay.classList.remove(
          "active"
        );

        document.body.style.overflow =
          "";

      }

    }

    if (resultsMoreFiltersBtn) {

      resultsMoreFiltersBtn.addEventListener(
        "click",
        openResultsFiltersDrawer
      );

    }

    if (closeResultsFiltersBtn) {

      closeResultsFiltersBtn.addEventListener(
        "click",
        closeResultsFiltersDrawer
      );

    }

    if (resultsDrawerOverlay) {

      resultsDrawerOverlay.addEventListener(
        "click",
        closeResultsFiltersDrawer
      );

    }

    /* ========================= */
    /* HYDRATE SEARCH INPUT */
    /* ========================= */

    const keyword =
      getUrlParams().get(
        "keyword"
      );

    if (
      keyword &&
      discoverResultsSearchInput
    ) {

      discoverResultsSearchInput.value =
        keyword;

    }

    /* ========================= */
    /* HYDRATE VERIFIED */
    /* ========================= */

    const verified =
      getUrlParams().get(
        "verified"
      );

    if (
      verified === "true" &&
      resultsVerifiedOnly
    ) {

      resultsVerifiedOnly.checked =
        true;

    }

function hydrateDistanceState() {

  const distanceEnabled =
    getUrlParams().get(
      "distance"
    );

  const radius =
    getUrlParams().get(
      "radius"
    );

  if (
    !resultsDistanceBtn
  ) {
    return;
  }

  const isNearbyActive =
    distanceEnabled === "true";

  resultsDistanceBtn.classList.toggle(
    "active",
    isNearbyActive
  );

  if (
    resultsSummaryText
  ) {

    if (
      isNearbyActive &&
      radius
    ) {

      resultsSummaryText.textContent =
        `Showing vendors within ${radius}km`;

    } else {

      resultsSummaryText.textContent =
        "Showing all vendors";

    }

  }

}

hydrateDistanceState();

/* ========================= */
/* SUPABASE */
/* ========================= */

const supabase =
  window.supabaseClient;


/* ========================= */
/* REVIEW MODAL */
/* ========================= */

const reviewModal =
  document.getElementById(
    "reviewModal"
  );

const reviewVendorId =
  document.getElementById(
    "reviewVendorId"
  );

const closeReviewModalBtn =
  document.getElementById(
    "closeReviewModal"
  );

let selectedRating = 0;

const reviewStars =
  document.querySelectorAll(
    ".review-stars button"
  );

const reviewForm =
  document.getElementById(
    "reviewForm"
  );

/* CLOSE MODAL */

if (
  closeReviewModalBtn
) {

  closeReviewModalBtn.addEventListener(
    "click",
    () => {

      reviewModal.classList.add(
        "hidden"
      );

      reviewModal.style.display =
        "none";

      reviewModal.style.visibility =
        "hidden";

      reviewModal.style.opacity =
        "0";

    }
  );

}

/* OVERLAY CLOSE */

if (
  reviewModal
) {

  reviewModal.addEventListener(
    "click",
    event => {

      if (
        event.target === reviewModal
      ) {

        reviewModal.classList.add(
          "hidden"
        );

      }

    }
  );

}

/* STAR SELECTION */

reviewStars.forEach(star => {

  star.addEventListener(
    "click",
    () => {

      selectedRating =
        Number(
          star.dataset.rating
        );

      reviewStars.forEach(btn => {

        btn.classList.remove(
          "active"
        );

      });

      reviewStars.forEach(btn => {

        if (
          Number(
            btn.dataset.rating
          ) <= selectedRating
        ) {

          btn.classList.add(
            "active"
          );

        }

      });

    }
  );

});

/* REVIEW SUBMISSION */

if (reviewForm) {

  reviewForm.addEventListener(
    "submit",
    async event => {

      console.log(
        "Review form submitted"
      );

      event.preventDefault();

      if (!selectedRating) {

        alert(
          "Please select a rating."
        );

        return;

      }

      const vendorId =
        reviewVendorId.value;

      console.log(
        "Review Vendor ID:",
        vendorId
      );

      const reviewerName =
        document.getElementById(
          "reviewerName"
        ).value.trim();

      const reviewerEmail =
        document.getElementById(
          "reviewerEmail"
        ).value.trim();

      const reviewText =
        document.getElementById(
          "reviewText"
        ).value.trim();

      console.log(
        "Submitting review..."
      );

      const insertPayload = {

        vendor_id:
          vendorId,

        reviewer_name:
          reviewerName,

        reviewer_email:
          reviewerEmail,

        rating:
          selectedRating,

        review_text:
          reviewText

      };

      console.log(
        "Review payload:",
        insertPayload
      );

      const {
        data,
        error
      } = await supabase
        .from(
          "vendor_reviews"
        )
        .insert([
          insertPayload
        ])
        .select();

      console.log(
        "Review insert response:",
        data
      );

      console.log(
        "Review insert error:",
        error
      );

      if (error) {

        console.error(
          "Review error:",
          error
        );

        alert(
          JSON.stringify(error)
        );

        return;

      }

      alert(
        "Review submitted successfully."
      );

      reviewModal.classList.add(
        "hidden"
      );

      reviewModal.style.display =
        "none";

      reviewModal.style.visibility =
        "hidden";

      reviewModal.style.opacity =
        "0";

      reviewForm.reset();

      selectedRating = 0;

      reviewStars.forEach(btn => {

        btn.classList.remove(
          "active"
        );

      });

      const {
        data: reviewsData,
        error: reviewsError
      } = await supabase
        .from("vendor_reviews")
        .select("rating")
        .eq(
          "vendor_id",
          vendorId
        );

      if (
        !reviewsError &&
        reviewsData
      ) {

        const totalReviews =
          reviewsData.length;

        const averageRating =
          totalReviews

            ? (
                reviewsData.reduce(
                  (sum, review) =>

                    sum +
                    Number(
                      review.rating || 0
                    ),

                  0
                ) / totalReviews
              ).toFixed(1)

            : 0;

        const {
          data: vendorUpdateData,
          error: vendorUpdateError
        } = await supabase
          .from("vendors")
          .update({

            average_rating:
              Number(
                averageRating
              ),

            reviews_count:
              totalReviews

          })
          .eq(
            "id",
            vendorId
          )
          .select();

        console.log(
          "Vendor update data:",
          vendorUpdateData
        );

        console.log(
          "Vendor update error:",
          vendorUpdateError
        );

      }

      await fetchPublicVendors();

    }
  );

}

/* ========================= */
/* LOAD FILTER OPTIONS */
/* ========================= */

async function loadFilterOptions() {

  try {

    const {
      data: vendors,
      error
    } = await supabase
      .from("vendors")
      .select(`
        category,
        subcategory,
        state,
        lga
      `)
      .eq(
        "public_listing_accepted",
        true
      )
      .eq(
        "account_status",
        "active"
      );

    if (error) {

      console.error(
        "Filter load error:",
        error
      );

      return;

    }

    const categories =
      [...new Set(
        vendors
          .map(v => v.category)
          .filter(Boolean)
      )];

    const subcategories =
      [...new Set(
        vendors
          .map(v => v.subcategory)
          .filter(Boolean)
      )];

    const states =
      [...new Set(
        vendors
          .map(v => v.state)
          .filter(Boolean)
      )];

    const lgas =
      [...new Set(
        vendors
          .map(v => v.lga)
          .filter(Boolean)
      )];

    if (resultsCategory) {

  resultsCategory.innerHTML =
    `
      <option value="">
        Select Category
      </option>
    `;

  categories.forEach(category => {

    resultsCategory.innerHTML += `
      <option value="${category}">
        ${category}
      </option>
    `;

  });

}

    
    if (resultsSubcategory) {

      resultsSubcategory.innerHTML =
        `
          <option value="">
            Select Subcategory
          </option>
        `;

      subcategories.forEach(subcategory => {

        resultsSubcategory.innerHTML += `
          <option value="${subcategory}">
            ${subcategory}
          </option>
        `;

      });

    }

if (resultsState) {

  resultsState.innerHTML =
    `
      <option value="">
        Select State
      </option>
    `;

  Object.keys(
    window.nigeriaData || {}
  ).forEach(state => {

    resultsState.innerHTML += `
      <option value="${state}">
        ${state}
      </option>
    `;

  });

}

if (
  resultsState &&
  resultsLga
) {

  resultsState.addEventListener(
    "change",
    () => {

      const selectedState =
        resultsState.value;

      resultsLga.innerHTML =
        `
          <option value="">
            Select LGA
          </option>
        `;

      if (
        !selectedState ||
        !window.nigeriaData
      ) {
        return;
      }

     const normalizedKey =
       selectedState;

      if (!normalizedKey) {
        return;
      }

      const lgas =
        window.nigeriaData[
          normalizedKey
        ] || [];

      lgas.forEach(lga => {

        const option =
          document.createElement(
            "option"
          );

        option.value = lga;

        option.textContent = lga;

        resultsLga.appendChild(
          option
        );

      });

    }
  );

}

  /* HYDRATE FILTER VALUES */

const currentCategory =
  getUrlParams().get(
    "category"
  );

const currentSubcategory =
  getUrlParams().get(
    "subcategory"
  );

const currentState =
  getUrlParams().get(
    "state"
  );

console.log(
  "DEBUG currentState:",
  currentState
);

console.log(
  "DEBUG full URL:",
  window.location.href
);

console.log(
  "DEBUG resultsState current value:",
  resultsState?.value
);

const currentLga =
  getUrlParams().get(
    "lga"
  );

if (
  currentCategory &&
  resultsCategory
) {

  resultsCategory.value =
    currentCategory;

}

if (
  currentSubcategory &&
  resultsSubcategory
) {

  resultsSubcategory.value =
    currentSubcategory;

}

if (
  currentState &&
  resultsState
) {

  resultsState.value =
    currentState;

  resultsState.dispatchEvent(
    new Event("change")
  );

}

if (
  currentLga &&
  resultsLga
) {

  setTimeout(
    () => {

      resultsLga.value =
        currentLga;

    },
    0
  );

}

  } catch (filterError) {

    console.error(
      "Unexpected filter error:",
      filterError
    );

  }

}

/* ========================= */
/* FETCH PUBLIC VENDORS */
/* ========================= */

async function fetchPublicVendors() {

  if (
    fetchPublicVendors.isLoading
  ) {
    return;
  }

  fetchPublicVendors.isLoading =
    true;

  try {

    /* URL PARAMS */

    const keyword =
      getUrlParams().get(
        "keyword"
      );

    const verified =
      getUrlParams().get(
        "verified"
      );

    const searchType =
      getUrlParams().get(
        "type"
      ) || "vendor";

    const category =
      getUrlParams().get(
        "category"
      );

    const subcategory =
      getUrlParams().get(
        "subcategory"
      );

    const state =
      getUrlParams().get(
        "state"
      );

    const lga =
      getUrlParams().get(
        "lga"
      );

/* BASE QUERY */

let query;

if (
  searchType === "service"
) {

query =
  supabase
    .from("vendor_services")
    .select(`
      id,
      vendor_id,
      service_name,
      short_description,
      vendors (
        id,
        name,
        slug,
        category,
        subcategory,
        address,
        state,
        lga,
        logo_url,
        cover_url,
        latitude,
        longitude,
        verification_status,
        average_rating,
        reviews_count,
        account_status,
        onboarding_completed,
        public_listing_accepted,
        subscription_status
      )
    `);

query =
  query.not(
    "vendors",
    "is",
    null
  );

query =
  query.eq(
    "vendors.account_status",
    "active"
  );

query =
  query.eq(
    "vendors.onboarding_completed",
    true
  );

query =
  query.eq(
    "vendors.public_listing_accepted",
    true
  );

query =
  query.eq(
    "vendors.subscription_status",
    "active"
  );

} else {

  query =
    supabase
      .from("vendors")
      .select(`
        id,
        name,
        slug,
        category,
        subcategory,
        address,
        state,
        lga,
        logo_url,
        cover_url,
        latitude,
        longitude,
        verification_status,
        average_rating,
        reviews_count,
        account_status,
        onboarding_completed,
        public_listing_accepted
      `)
      .eq(
        "public_listing_accepted",
        true
      )
      .eq(
        "account_status",
        "active"
      )
      .eq(
        "onboarding_completed",
        true
      );

}

    /* KEYWORD */

if (keyword) {

  if (
    searchType === "service"
  ) {

  query =
    query.or(
      `service_name.ilike.%${keyword}%,short_description.ilike.%${keyword}%`
  );

  } else {

    query =
      query.or(
        `name.ilike.%${keyword}%,category.ilike.%${keyword}%,subcategory.ilike.%${keyword}%,description.ilike.%${keyword}%`
      );

  }

}

    /* VERIFIED */

if (
  verified === "true"
) {

  if (
    searchType === "service"
  ) {

    query =
      query.not(
        "vendors.verification_status",
        "eq",
        "none"
      );

  } else {

    query =
      query.neq(
        "verification_status",
        "none"
      );

  }

}

   
/* CATEGORY */

if (category) {

  query =
    searchType === "service"

      ? query.eq(
          "vendors.category",
          category
        )

      : query.eq(
          "category",
          category
        );

}

/* SUBCATEGORY */

if (subcategory) {

  query =
    searchType === "service"

      ? query.eq(
          "vendors.subcategory",
          subcategory
        )

      : query.eq(
          "subcategory",
          subcategory
        );

}

/* STATE */

if (state) {

  query =
    searchType === "service"

      ? query.eq(
          "vendors.state",
          state
        )

      : query.eq(
          "state",
          state
        );

}

/* LGA */

if (lga) {

  query =
    searchType === "service"

      ? query.eq(
          "vendors.lga",
          lga
        )

      : query.eq(
          "lga",
          lga
        );

}

    /* EXECUTE */

    const {
      data,
      error
    } = await query;

 /* ========================= */
/* NEARBY FILTER */
/* ========================= */

let filteredData =
  data || [];

const distanceEnabled =
  getUrlParams().get(
    "distance"
  );

const radius =
  Number(
    getUrlParams().get(
      "radius"
    ) || 15
  );

const nearbyRequested =
  distanceEnabled === "true";

const hasCoordinates =
  typeof userLocation.latitude ===
    "number" &&
  typeof userLocation.longitude ===
    "number" &&
  !Number.isNaN(
    userLocation.latitude
  ) &&
  !Number.isNaN(
    userLocation.longitude
  );

if (
  nearbyRequested &&
  hasCoordinates
) {

filteredData =
  filteredData
    .filter(item => {

      const latitude =
        searchType === "service"
          ? item.vendors?.latitude
          : item.latitude;

      const longitude =
        searchType === "service"
          ? item.vendors?.longitude
          : item.longitude;

      const parsedLatitude =
        Number(latitude);

      const parsedLongitude =
        Number(longitude);

return (
  !Number.isNaN(parsedLatitude) &&
  !Number.isNaN(parsedLongitude)
);

    })

    .map(item => {

      const latitude =
        searchType === "service"
          ? item.vendors?.latitude
          : item.latitude;

      const longitude =
        searchType === "service"
          ? item.vendors?.longitude
          : item.longitude;

      const parsedLatitude =
        Number(latitude);

      const parsedLongitude =
        Number(longitude);

      return {

        ...item,

        distance:
          calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            parsedLatitude,
            parsedLongitude
          )

      };

    })
        .filter(
          vendor =>
            typeof vendor.distance ===
              "number" &&
            !Number.isNaN(
              vendor.distance
            ) &&
            vendor.distance <= radius
        )
        .sort(
          (a, b) =>
            a.distance -
            b.distance
        );

  }


    if (error) {

console.error(
  "Vendor fetch error:",
  JSON.stringify(error, null, 2)
);

      return;

    }

/* RENDER RESULTS */

if (
  searchType === "service"
) {

  renderServiceResults(
    filteredData || []
  );

} else {

  renderVendorResults(
    filteredData || []
  );

}

if (
  resultsSummaryText
) {

  const totalResults =
    filteredData.length;

  if (
    distanceEnabled === "true"
  ) {

    resultsSummaryText.textContent =
      `${totalResults} nearby result${totalResults === 1 ? "" : "s"} within ${radius}km`;

  } else {

    resultsSummaryText.textContent =
      `${totalResults} result${totalResults === 1 ? "" : "s"} found`;

  }

}

  } catch (fetchError) {

    console.error(
      "Unexpected fetch error:",
      fetchError
    );

  } finally {

    fetchPublicVendors.isLoading =
      false;

  }

}

/* ========================= */
/* USER LOCATION */
/* ========================= */

const userLocation = {
  latitude:
    Number(
      getUrlParams().get("lat")
    ) || null,

  longitude:
    Number(
      getUrlParams().get("lng")
    ) || null
};


/* ========================= */
/* HAVERSINE DISTANCE */
/* ========================= */

function calculateDistanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const earthRadius =
    6371;

  const dLat =
    (
      (lat2 - lat1) *
      Math.PI
    ) / 180;

  const dLon =
    (
      (lon2 - lon1) *
      Math.PI
    ) / 180;

  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +

    Math.cos(
      (lat1 * Math.PI) / 180
    ) *

    Math.cos(
      (lat2 * Math.PI) / 180
    ) *

    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return (
    earthRadius * c
  );

}

/* ========================= */
/* RENDER RESULTS */
/* ========================= */

function renderVendorResults(
  vendors
) {

  const discoverResultsList =
    document.getElementById(
      "discoverResultsList"
    );

  const discoverResultsEmpty =
    document.getElementById(
      "discoverResultsEmpty"
    );

  if (
    !discoverResultsList
  ) {
    return;
  }

  /* EMPTY */

  if (
    !vendors.length
  ) {

    discoverResultsList.innerHTML =
      "";

    if (
      discoverResultsEmpty
    ) {

      discoverResultsEmpty.classList.remove(
        "hidden"
      );

    }

    return;

  }


  if (
  discoverResultsEmpty
) {

  discoverResultsEmpty.classList.add(
    "hidden"
  );

}



  /* BUILD HTML */

  const resultsHtml =
    vendors.map(vendor => {

const verificationStatus =
  vendor.verification_status || "none";

const isVerified =
  verificationStatus !== "none";

const vendorLogo =

  vendor.logo_url &&
  vendor.logo_url !== "null" &&
  vendor.logo_url.trim() !== ""

    ? vendor.logo_url

    : "images/default-vendor-logo.webp";

      const vendorAddress =
        vendor.address ||
        `${vendor.lga || ""}, ${vendor.state || ""}`;

      const averageRating =
        Number(
          vendor.average_rating || 0
        ).toFixed(1);

      const reviewsCount =
        vendor.reviews_count || 0;

      return `
        <article
          class="discover-result-card"
          data-slug="${vendor.slug || ""}"
          data-vendor-id="${vendor.id || ""}"
        >

          <div class="discover-result-left">

            <img
              src="${vendorLogo}"
              alt="${vendor.name || "Vendor"}"
              class="discover-result-logo"

             onerror="
              this.onerror=null;
              this.src='images/default-vendor-logo.webp';
             "
           >

          </div>

<div class="discover-result-center">

<div class="discover-result-title-row">

  <div class="discover-vendor-heading">

    <h3>
      ${vendor.name || "Unnamed Vendor"}
    </h3>

${
  isVerified
    ? `
      <span
        class="discover-verified-badge badge-wrap"
        data-tooltip="${
          verificationStatus === "gray"
            ? "Verified Identity — business owner identity confirmed"
            : "Verified Business — official business documents reviewed by Spotlight. This vendor operates a registered and credible business."
        }"
      >
        <img
          src="${
            verificationStatus === "gray"
              ? "images/graybadge.png"
              : "images/bluebadge.png"
          }"
          alt="Verification Badge"
          class="discover-badge-image verification-badge"
        >
      </span>
    `
    : ""
}

    <div class="discover-rating-wrap">

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

            <p class="discover-result-address">
              ${vendorAddress}
            </p>

            <span class="discover-result-distance">

              ${
                vendor.subcategory ||
                vendor.category ||
                "Business Vendor"
              }

              ${
                typeof vendor.distance === "number"
                  ? `
                    • <span class="vendor-distance-value">
                        ${vendor.distance.toFixed(1)}km away
                      </span>
                  `
                  : ""
              }

            </span>

                    <div class="discover-result-actions">

            <button
              class="open-review-btn"
              data-vendor-id="${vendor.id}"
            >
              Leave Review
            </button>

            <button
              class="view-profile-btn"
              data-slug="${vendor.slug || ""}"
            >
              View Profile
            </button>

          </div>

          </div>

        </article>
      `;

    }).join("");

  discoverResultsList.innerHTML =
    resultsHtml;

  }

/* ========================= */
/* RENDER SERVICE RESULTS */
/* ========================= */

function renderServiceResults(
  services
) {

  const discoverResultsList =
    document.getElementById(
      "discoverResultsList"
    );

  const discoverResultsEmpty =
    document.getElementById(
      "discoverResultsEmpty"
    );

  if (
    !discoverResultsList
  ) {
    return;
  }

  /* EMPTY */

  if (
    !services.length
  ) {

    discoverResultsList.innerHTML =
      "";

    if (
      discoverResultsEmpty
    ) {

      discoverResultsEmpty.classList.remove(
        "hidden"
      );

    }

    return;

  }


  if (
  discoverResultsEmpty
) {

  discoverResultsEmpty.classList.add(
    "hidden"
  );

}

const resultsHtml =
    services.map(service => {

const vendor =
  Array.isArray(service.vendors)
    ? service.vendors[0] || {}
    : service.vendors || {};

      const verificationStatus =
        vendor.verification_status || "none";

      const isVerified =
        verificationStatus !== "none";

      const vendorLogo =

        vendor.logo_url &&
        vendor.logo_url !== "null" &&
        vendor.logo_url.trim() !== ""

          ? vendor.logo_url

          : "images/default-vendor-logo.webp";

      const averageRating =
        Number(
          vendor.average_rating || 0
        ).toFixed(1);

      const reviewsCount =
        vendor.reviews_count || 0;
      
      const serviceDescription =

        service.short_description
          ? (
             service.short_description
               .length > 80

               ? service.short_description
                   .slice(0, 80) + "..."

               : service.short_description
            )

         : "";

      return `

      <article
        class="discover-result-card"
        data-slug="${vendor.slug || ""}"
        data-vendor-id="${vendor.id || ""}"
      >

          <div class="discover-result-left">

            <img
              src="${vendorLogo}"
              alt="${vendor.name || "Vendor"}"
              class="discover-result-logo"

              onerror="
                this.onerror=null;
                this.src='images/default-vendor-logo.webp';
              "
            >

          </div>

          <div class="discover-result-center">

            <div class="discover-result-title-row">

              <div class="discover-vendor-heading">

                <h3>
                  ${service.service_name || "Service"}
                </h3>

              </div>

            </div>

              <div class="discover-vendor-heading">

              <p class="discover-service-vendor">

                By:
                ${vendor.name || "Vendor"}

              </p>

${
  isVerified
    ? `
      <span
        class="discover-verified-badge badge-wrap"
        data-tooltip="${
          verificationStatus === "gray"
            ? "Verified Identity — business owner identity confirmed"
            : "Verified Business — official business documents reviewed by Spotlight. This vendor operates a registered and credible business."
        }"
      >
        <img
          src="${
            verificationStatus === "gray"
              ? "images/graybadge.png"
              : "images/bluebadge.png"
          }"
          alt="Verification Badge"
          class="discover-badge-image verification-badge"
        >
      </span>
    `
    : ""
}

              <div class="discover-rating-wrap">

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
                ? `
                  <p class="discover-service-description">
                    ${serviceDescription}
                  </p>
               `
               : ""
             }

            </div>

            <p class="discover-result-address">

           ${vendor.lga || ""}
           ${vendor.state ? `, ${vendor.state}` : ""}

            </p>

            <span class="discover-result-distance">

              ${
                vendor.subcategory ||
                vendor.category ||
                "Service"
              }

              ${
                typeof service.distance === "number"
                  ? `
                    • <span class="vendor-distance-value">
                        ${service.distance.toFixed(1)}km away
                      </span>
                  `
                  : ""
              }

            </span>

            <div class="discover-result-actions">

              <button
                class="open-review-btn"
                data-vendor-id="${vendor.id || ""}"
              >
                Leave Review
              </button>

              <button
                class="view-profile-btn"
                data-slug="${vendor.slug || ""}"
              >
                View Profile
              </button>

            </div>

          </div>

        </article>

      `;

    }).join("");

  discoverResultsList.innerHTML =
    resultsHtml;

}


/* INITIAL FETCH */

loadFilterOptions();

fetchPublicVendors();

/* ========================= */
/* URL PARAM UPDATES */
/* ========================= */

function updateResultsUrlParam(
  key,
  value
) {

  const currentUrl =
    new URL(
      window.location.href
    );

if (
  value === null ||
  value === "" ||
  value === false ||
  value === "false"
) {

  currentUrl.searchParams.delete(
    key
  );

} else {

  currentUrl.searchParams.set(
    key,
    value
  );

}

  window.history.replaceState(
    {},
    "",
    currentUrl
  );

}

/* ========================= */
/* VERIFIED TOGGLE */
/* ========================= */

if (resultsVerifiedOnly) {

  resultsVerifiedOnly.addEventListener(
    "change",
    () => {

      updateResultsUrlParam(
        "verified",
        resultsVerifiedOnly.checked
          ? "true"
          : "false"
      );

      fetchPublicVendors();

      hydrateDistanceState();

    }
  );

}

if (resultsDistanceBtn) {

  resultsDistanceBtn.addEventListener(
    "click",
    async () => {

      if (nearbyLoading) {
        return;
      }

      nearbyLoading = true;

      const originalHtml =
        resultsDistanceBtn.innerHTML;

      resultsDistanceBtn.innerHTML =
        `
          <i class="fa-solid fa-location-crosshairs"></i>
          Locating...
        `;

      resultsDistanceBtn.style.pointerEvents =
        "none";

      /* CURRENT STATE */

      const isActive =
        getUrlParams().get(
          "distance"
        ) === "true";

      /* TOGGLE URL PARAMS */

      if (isActive) {

        updateResultsUrlParam(
          "distance",
          null
        );

        updateResultsUrlParam(
          "radius",
          null
        );

      } else {

        updateResultsUrlParam(
          "distance",
          "true"
        );

        const existingRadius =
          getUrlParams().get(
            "radius"
          ) || "20";

        updateResultsUrlParam(
          "radius",
          existingRadius
        );

      }

      /* FETCH */

      await fetchPublicVendors();

      hydrateDistanceState();

      setTimeout(
        () => {

          resultsDistanceBtn.innerHTML =
            originalHtml;

          resultsDistanceBtn.style.pointerEvents =
            "";

          nearbyLoading = false;

        },
        500
      );

      hydrateDistanceState();
    
    }
  );

}

/* ========================= */
/* APPLY FILTERS */
/* ========================= */

if (
  resultsApplyFiltersBtn
) {

  resultsApplyFiltersBtn.addEventListener(
    "click",
    () => {

      updateResultsUrlParam(
        "category",
        resultsCategory?.value || null
      );

      updateResultsUrlParam(
        "subcategory",
        resultsSubcategory?.value || null
      );

      updateResultsUrlParam(
        "state",
        resultsState?.value || null
      );

      updateResultsUrlParam(
        "lga",
        resultsLga?.value || null
      );

      closeResultsFiltersDrawer();

      fetchPublicVendors();

    }
  );

}

/* ========================= */
/* RESET FILTERS */
/* ========================= */

if (
  resultsResetFiltersBtn
) {

  resultsResetFiltersBtn.addEventListener(
    "click",
    () => {

      if (resultsCategory) {
        resultsCategory.value = "";
      }

      if (resultsSubcategory) {
        resultsSubcategory.value = "";
      }

      if (resultsState) {

        resultsState.value = "";

        resultsState.dispatchEvent(
          new Event("change")
      );

     }

      if (resultsLga) {
        resultsLga.value = "";
      }

      resultsLga.innerHTML =
       `
         <option value="">
           Select LGA
         </option>
       `;

      updateResultsUrlParam(
        "category",
        null
      );

      updateResultsUrlParam(
        "subcategory",
        null
      );

      updateResultsUrlParam(
        "state",
        null
      );

     updateResultsUrlParam(
       "lga",
       null
   );

loadFilterOptions();

fetchPublicVendors();

    }
  );

}

/* ========================= */
/* SEARCH INPUT */
/* ========================= */

if (
  discoverResultsSearchInput
) {

  discoverResultsSearchInput
    .addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter"
        ) {

          const keyword =
            discoverResultsSearchInput.value.trim();

          updateResultsUrlParam(
            "keyword",
            keyword
          );

          fetchPublicVendors();

        }

      }
    );

}

/* ========================= */
/* REVIEW BUTTON CLICK */
/* ========================= */

const discoverResultsList =
  document.getElementById(
    "discoverResultsList"
  );

if (
  discoverResultsList
) {

  discoverResultsList.addEventListener(
    "click",
    event => {

        const profileButton =
        event.target.closest(
          ".view-profile-btn"
        );

      if (profileButton) {

        const slug =
          profileButton.dataset.slug;

        if (slug) {

          window.location.href =
            `vendor-profile.html?slug=${encodeURIComponent(slug)}`;

        }

        return;

      }

      const reviewButton =
        event.target.closest(
          ".open-review-btn"
        );

      if (!reviewButton) {
        return;
      }

      const vendorId =
        reviewButton.dataset.vendorId;

      if (
        reviewVendorId
      ) {

        reviewVendorId.value =
          vendorId;

      }

      if (
        reviewModal
      ) {

        reviewModal.classList.remove(
          "hidden"
        );

        reviewModal.style.display =
          "flex";

        reviewModal.style.visibility =
          "visible";

        reviewModal.style.opacity =
          "1";

      }

    }
  );

}

  }
);