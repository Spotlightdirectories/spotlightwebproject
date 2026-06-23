 let selectedRating = 0;

const reviewsSupabase =
  window.supabaseClient;
 
window.ReviewsUtils = {

  openReviewModal(
    vendorId
  ) {

  console.log(
  "openReviewModal fired",
  vendorId
);

    let reviewModal =
      document.getElementById(
        "reviewModal"
      );

   const existingVendorField =
  document.getElementById(
    "reviewVendorId"
  );

if (
  existingVendorField
) {

  existingVendorField.value =
    vendorId || "";

}

    if (!reviewModal) {

      document.body.insertAdjacentHTML(
        "beforeend",
        `
<div
  id="reviewModal"
  class="review-modal"
>

  <div class="review-modal-content">

    <button
      id="closeReviewModal"
      class="review-close-btn"
    >
      ×
    </button>

    <h3>
      Leave a Review
    </h3>

    <form id="reviewForm">

    <div id="reviewDebug"></div>

      <input
        type="hidden"
        id="reviewVendorId"
      >

      <div class="review-stars">

        <button type="button" data-rating="1">★</button>
        <button type="button" data-rating="2">★</button>
        <button type="button" data-rating="3">★</button>
        <button type="button" data-rating="4">★</button>
        <button type="button" data-rating="5">★</button>

      </div>

      <input
        type="text"
        id="reviewerName"
        placeholder="Your name"
        required
      >

      <input
        type="email"
        id="reviewerEmail"
        placeholder="Your email"
        required
      >

      <textarea
        id="reviewText"
        placeholder="Write your review"
        required
      ></textarea>

      <button
  type="button"
  id="submitReviewBtn"
>
  Submit Review
</button>


  </form>

  </div>

</div>
        `
      );

      reviewModal =
        document.getElementById(
          "reviewModal"
        );

        const reviewVendorId =
  document.getElementById(
    "reviewVendorId"
  );

if (
  reviewVendorId
) {

  reviewVendorId.value =
    vendorId || "";

}

console.log(
  "Review Vendor ID:",
  reviewVendorId.value
);

    const reviewStars =
  reviewModal.querySelectorAll(
    ".review-stars button"
  );

reviewStars.forEach(star => {

  star.addEventListener(
    "click",
    () => {

    console.log(
  "Star clicked",
  star.dataset.rating
);

      selectedRating =
        Number(
          star.dataset.rating
        );

      reviewStars.forEach(btn =>
        btn.classList.remove(
          "active"
        )
      );

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

document
  .getElementById(
    "submitReviewBtn"
  )
  .addEventListener(
    "click",
    async () => {

      if (!selectedRating) {

        alert(
          "Please select a rating."
        );

        return;

      }

      const vendorId =
        document.getElementById(
          "reviewVendorId"
        ).value;

      const reviewForm =
        document.getElementById(
          "reviewForm"
      );

     if (
       !reviewForm.reportValidity()
      ) {

        return;

      }

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

      const {
        error
      } = await reviewsSupabase
        .from(
          "vendor_reviews"
        )
        .insert([
          {

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

          }
        ]);

      await reviewsSupabase
  .from("analytics_events")
  .insert({
    vendor_id:
      vendorId,
    event_type:
      "review_submitted",
      visitor_id: window.visitorId
  });

      if (error) {

        console.error(
          error
        );

        alert(
          "Unable to submit review."
        );

        return;

      }

alert(
  "Review submitted successfully."
);

selectedRating = 0;

reviewModal.remove();

if (
  typeof window.loadSponsoredVendors ===
  "function"
) {

  await window.loadSponsoredVendors();

}

if (
  typeof window.loadVendorProfile ===
  "function"
) {

  await window.loadVendorProfile();

}

if (

  typeof window.refreshDiscoverResults ===

  "function"

) {

  await window.refreshDiscoverResults();

}

  }
);

      document
        .getElementById(
          "closeReviewModal"
        )
        .addEventListener(
          "click",
          () => {

            reviewModal.remove();

          }
        );

      reviewModal.addEventListener(
        "click",
        event => {

         if (
           event.target === reviewModal
       ) {

          reviewModal.remove();

       }

     }
    );

    }

  }

};