 let selectedRating = 0;

const reviewsSupabase =
  window.supabaseClient;

// Cached across modal opens so we don't re-check the session every
// single time — refreshed once per page load, which is fine since a
// login/logout mid-session already triggers a page navigation here.
let cachedReviewingCustomer = undefined; // undefined = not yet checked, null = not a customer

async function getReviewingCustomer() {

  if (cachedReviewingCustomer !== undefined) return cachedReviewingCustomer;

  const { data: { session } } = await reviewsSupabase.auth.getSession();

  if (!session) {
    cachedReviewingCustomer = null;
    return null;
  }

  const { data: customer } = await reviewsSupabase
    .from("customers")
    .select("id, name, email")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  cachedReviewingCustomer = customer || null;
  return cachedReviewingCustomer;

}

window.ReviewsUtils = {

  async openReviewModal(
    vendorId
  ) {

    const reviewingCustomer = await getReviewingCustomer();

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

// Applies on EVERY open (not just first build) — either shows the
// soft nudge for an anonymous submitter, or auto-fills and locks
// name/email for a logged-in customer so their review is genuinely
// tied to their real identity, not just whatever they might type.
function applyReviewerIdentity() {

  const notice = document.getElementById("reviewAnonNotice");
  const nameField = document.getElementById("reviewerName");
  const emailField = document.getElementById("reviewerEmail");

  if (reviewingCustomer) {

    if (notice) notice.classList.add("hidden");

    if (nameField) {
      nameField.value = reviewingCustomer.name || "";
      nameField.readOnly = true;
    }

    if (emailField) {
      emailField.value = reviewingCustomer.email || "";
      emailField.readOnly = true;
    }

  } else {

    if (notice) notice.classList.remove("hidden");

    if (nameField) nameField.readOnly = false;
    if (emailField) emailField.readOnly = false;

  }

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

    <div id="reviewAnonNotice" class="review-anon-notice hidden">
      Reviews from signed-in Spotlight customers are marked <strong>Verified Customer</strong> and carry more weight with other shoppers. You can still submit without signing in, or
      <a href="customer-login.html">log in</a> / <a href="customer-signup.html">sign up</a> first.
    </div>

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

const reviewStars =
  reviewModal.querySelectorAll(
    ".review-stars button"
  );

reviewStars.forEach(star => {

  star.addEventListener(
    "click",
    () => {

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

      // Re-fetched (cheap — cached after the first real check) rather
      // than trusting a value captured when this listener was first
      // attached, since the modal element itself is only ever built
      // once and reused across opens.
      const currentReviewingCustomer = await getReviewingCustomer();

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
              reviewText,

            customer_id:
              currentReviewingCustomer?.id || null

          }
        ]);

      if (error) {

        console.error(
          error
        );

        // Postgres returns SQLSTATE 42501 (insufficient_privilege) when
        // an RLS WITH CHECK fails. The only realistic way this INSERT
        // policy blocks a submission from this exact form is the
        // self-review guard — the customer_id sent is always the
        // reviewer's own real one (fetched above), so this can't be
        // triggered by an actual spoofing attempt through this UI.
        if (error.code === "42501") {
          alert(
            "You cannot submit a review for yourself."
          );
        } else {
          alert(
            "Unable to submit review."
          );
        }

        return;

      }

      // Only log this AFTER confirming the review itself actually
      // saved — previously this fired unconditionally, so a failed
      // submission was still recorded as a successful one.
      await reviewsSupabase
  .from("analytics_events")
  .insert({
    vendor_id:
      vendorId,
    event_type:
      "review_submitted",
      visitor_id: window.visitorId
  });

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

    applyReviewerIdentity();

  }

};