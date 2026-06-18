document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;

const params =
  new URLSearchParams(
    window.location.search
  );

const serviceSlug =
  params.get(
    "slug"
  );

console.log(
  "Service Slug:",
  serviceSlug
);

if (!serviceSlug)
  return;

const { data, error } = await supabase
  .from("vendor_services")
  .select(`
    *,
    vendors(
      whatsapp,
      telephone,
      slug,
      name,
      category,
      subcategory,
      verification_status,
      average_rating,
      reviews_count,
      is_sponsored
    )
  `)
  .eq(
    "slug",
     serviceSlug
  )
  .single();

  console.log(
  "Service Query Error:",
  error
);

console.log(
  "Service Query Data:",
  data
);

  console.log(
  "Service:",
  data
);

console.log(
  "Representative Image:",
  data.representative_image_url
);

console.log(
  "Additional Image:",
  data.secondary_image_url
);

console.log(
  "Error:",
  error
);

  if (error) {
    console.error("Product load error:", error.message);
    return;
  }

  const imageEl = document.getElementById("productImage");
  const titleEl = document.getElementById("productTitle");
  const priceEl = document.getElementById("productPrice");
  const descEl = document.getElementById("productDescription");
  const keyDetailsEl = document.getElementById("productKeyDetails");

const contactBtn =
  document.getElementById(
    "contactVendorBtn"
  );

const callBtn =
  document.getElementById(
    "callVendorBtn"
  );

const backLink =
  document.getElementById(
    "backToVendor"
  );

const secondaryImageEl =
  document.getElementById(
    "secondaryProductImage"
  );

if (imageEl) {

  /* Representative Image */

  if (data.representative_image_url) {

     imageEl.src =
           data.representative_image_url;

    imageEl.onerror =
      function () {

        this.style.display =
          "none";

      };

  }

  /* No Representative Image but Additional Image exists */

  else if (
    data.secondary_image_url
  ) {

    imageEl.src =
      data.secondary_image_url;

    imageEl.onerror =
      function () {

        this.style.display =
          "none";

      };

  }

  /* No images uploaded */

/* No Representative Image or Additional Image */

else {

  imageEl.closest(
    ".product-media"
  ).style.display =
    "none";

}

}

if (
  secondaryImageEl &&
  data.secondary_image_url
) {

  /* Additional Image */

  secondaryImageEl.src =
    data.secondary_image_url;

  secondaryImageEl.classList.remove(
    "hidden"
  );

  secondaryImageEl.onclick =
    () => {

      const current =
        imageEl.src;

      imageEl.src =
        secondaryImageEl.src;

      secondaryImageEl.src =
        current;

    };

} else if (
  secondaryImageEl
) {

  /* No Additional Image */

  secondaryImageEl.style.display =
    "none";

}

/* ========================= */
/* SERVICE TITLE */
/* ========================= */

if (titleEl) {

  titleEl.textContent =
    data.service_name || "";

}

/* ========================= */
/* STARTING PRICE */
/* ========================= */

if (priceEl) {

  if (data.starting_price) {

    priceEl.innerHTML =
      `Starting From <span>₦${Number(
        data.starting_price
      ).toLocaleString(
        "en-NG",
        {
          minimumFractionDigits:2,
          maximumFractionDigits:2
        }
      )}</span>`;

  } else {

    priceEl.style.display =
      "none";

  }

}

/* ========================= */
/* SERVICE DESCRIPTION */
/* ========================= */

const rawDescription =
  data.short_description || "";

const hasRepresentativeImage =
  !!data.representative_image_url;

const productContainer =
  document.querySelector(
    ".product-container"
  );

if (
  productContainer &&
  !hasRepresentativeImage
) {

  productContainer.classList.add(
    "no-image"
  );

}

if (descEl) {

  const lines =
    rawDescription
      .split("\n")
      .map(
        line => line.trim()
      )
      .filter(Boolean);

  if (!lines.length) {

    descEl.innerHTML = "";

  } else {

    const intro =
      lines.shift();

    let expanded =
      false;

    const renderDescription =
      () => {

        let html =
          `<p>${intro}</p>`;

        const displayLines =
          hasRepresentativeImage &&
          !expanded
            ? lines.slice(0,2)
            : lines;

        if (
          displayLines.length
        ) {

          html += "<ul>";

          displayLines.forEach(
            line => {

              html +=
                `<li>${line}</li>`;

            }
          );

          html += "</ul>";

        }

        descEl.innerHTML =
          html;

        if (
          hasRepresentativeImage &&
          lines.length > 2
        ) {

          const toggle =
            document.createElement(
              "a"
            );

          toggle.href =
            "#";

          toggle.textContent =
            expanded
              ? " Read Less"
              : " Read More";

          toggle.onclick =
            function(e){

              e.preventDefault();

              expanded =
                !expanded;

              renderDescription();

            };

          descEl.appendChild(
            toggle
          );

        }

      };

    renderDescription();

  }

}

const vendorMeta =

  document.getElementById(

    "productVendorMeta"

  );

if (

  vendorMeta

) {

  vendorMeta.innerHTML =

`

<div class="discover-results2-product-vendor">

<span>

By ${data.vendors?.name || ""}

</span>

${
data.vendors?.verification_status === "blue"
? `<img src="images/bluebadge.png" class="discover-results2-product-badge">`
: data.vendors?.verification_status === "gray"
? `<img src="images/graybadge.png" class="discover-results2-product-badge">`
: ""
}

</div>

<div class="discover-results2-product-rating">

<i class="fa-solid fa-star"></i>

<span>

${Number(data.vendors?.average_rating || 0).toFixed(1)}

</span>

<small>

(${data.vendors?.reviews_count || 0})

</small>

</div>

${
data.vendors?.is_sponsored
? `<p class="discover-results2-product-sponsored">Sponsored</p>`: ""}`;
}

if (contactBtn) {

  const whatsapp =
    data.vendors?.whatsapp;

  if (whatsapp) {

    contactBtn.href =
      `https://wa.me/${whatsapp}`;

  } else {

    contactBtn.style.display =
      "none";

  }

}

if (callBtn) {

  const telephone =
    data.vendors?.telephone;

  if (telephone) {

    callBtn.href =
      `tel:${telephone}`;

  } else {

    callBtn.style.display =
      "none";

  }

}

if (
  backLink &&
  data.vendors?.slug
) {

  backLink.href =
    `vendor-profile.html?slug=${data.vendors.slug}`;

}

/* ========================= */
/* MORE PRODUCTS */
/* ========================= */

const moreProductsGrid =
  document.getElementById(
    "moreProductsGrid"
  );

if (
  moreProductsGrid &&
  data.vendor_id
) {

const {
  data: moreProducts,
  error: moreProductsError
} = await supabase
  .from(
    "vendor_services"
  )
  .select(`
    slug,
    service_name,
    short_description,
    starting_price,
    representative_image_url,
    vendor_id,
    vendors(
      slug,
      name,
      verification_status,
      average_rating,
      reviews_count,
      is_sponsored
    )
  `)
  .eq(
    "vendor_id",
    data.vendor_id
  )
  .neq(
    "slug",
    data.slug
  );

console.log(
  "More Products:",
  moreProducts
);

console.log(
  "More Products Error:",
  moreProductsError
);

console.log(
  "First Product:",
  moreProducts[0]
);

console.log(
  "Vendor Object:",
  moreProducts[0]?.vendors
);

  if (
    moreProducts?.length
  ) {

moreProducts.forEach(product => {

  const badge =
    product.vendors?.verification_status === "blue"
      ? `<img src="images/bluebadge.png" alt="Verified" class="discover-results2-product-badge">`
      : product.vendors?.verification_status === "gray"
      ? `<img src="images/graybadge.png" alt="Verified" class="discover-results2-product-badge">`
      : "";

  const sponsored =
    product.vendors?.is_sponsored
      ? `<p class="discover-results2-product-sponsored">Sponsored</p>`
      : "";

const card = document.createElement("div");

card.className =
  product.representative_image_url
    ? "discover-results2-service-card"
    : "discover-results2-service-card no-image";

  card.innerHTML = `

${
product.representative_image_url
?

`<img
src="${product.representative_image_url}"
class="discover-results2-product-image"
alt="${product.service_name}"
>`

: ""

}

<div>

<h3 class="discover-results2-product-title">

${product.service_name}

</h3>

<p class="discover-results2-product-price">

Starting From
<span>

₦${Number(product.starting_price || 0).toLocaleString()}

</span>

</p>

<div class="discover-results2-product-vendor">

<span>

By ${product.vendors?.name || ""}

</span>

${
product.vendors?.verification_status === "blue"
? `<img src="images/bluebadge.png" class="discover-results2-product-badge">`
: product.vendors?.verification_status === "gray"
? `<img src="images/graybadge.png" class="discover-results2-product-badge">`
: ""
}

</div>

<div class="discover-results2-product-rating">

<i class="fa-solid fa-star"></i>

<span>${Number(product.vendors?.average_rating || 0).toFixed(1)}</span>

<small>(${product.vendors?.reviews_count || 0})</small>

</div>

${sponsored}

</div>

`;

card.onclick = () => {
  location.href = `vendor-service.html?slug=${product.slug}`;
};

  moreProductsGrid.appendChild(card);

});

  }

}

const shareBtn =
  document.getElementById(
    "shareProductBtn"
  );

if (shareBtn) {

  shareBtn.onclick =
    async () => {

      const shareData = {

        title:
          data.product_name,

        text:
          `Check out ${data.product_name} on Spotlight Directories.`,

        url:
          window.location.href

      };

      if (
        navigator.share
      ) {

        try {

          await navigator.share(
            shareData
          );

        } catch (err) {}

      } else {

        await navigator.clipboard.writeText(
          window.location.href
        );

        alert(
          "Product link copied to clipboard."
        );

      }

    };

}

/* ========================= */
/* SIMILAR PRODUCTS */
/* ========================= */

const similarProductsGrid =
  document.getElementById(
    "similarProductsGrid"
  );

if (
  similarProductsGrid &&
  data.vendor_id
) {

const {
  data: similarProducts,
  error: similarProductsError
} = await supabase
  .from("vendor_services")
  .select(`
      slug,
      service_name,
      short_description,
      starting_price,
      representative_image_url,
      vendor_id,
      vendors(
        name,
        subcategory,
        category,
        verification_status,
        average_rating,
        reviews_count,
        is_sponsored
      )
    `);

console.log(
  "Similar Services:",
  similarProducts
);

console.log(
  "Similar Services Error:",
  similarProductsError
);

console.log(
  "First Similar Service:",
  similarProducts?.[0]
);

console.log(
  "First Vendor Object:",
  similarProducts?.[0]?.vendors
);

console.log(
  "Current Subcategory:",
  data.vendors?.subcategory
);

console.log(
  "Current Category:",
  data.vendors?.category
);

similarProducts.forEach(product => {

  console.log(

    product.service_name,

    product.vendors?.subcategory,

    product.vendors?.category

  );

});

let filteredProducts =
  similarProducts.filter(
    product =>

      product.vendor_id !== data.vendor_id &&

      product.slug !== data.slug &&

      product.vendors?.subcategory ===
      data.vendors?.subcategory

  );

/* Fallback to Category */

if (
  filteredProducts.length === 0
) {

  filteredProducts =
    similarProducts.filter(
      product =>

        product.vendor_id !== data.vendor_id &&

        product.slug !== data.slug &&

        product.vendors?.category ===
        data.vendors?.category

    );

console.log(
  JSON.stringify(
    data.vendors,
    null,
    2
  )
);

}

console.log(
  "Filtered Products:",
  filteredProducts
);

if (filteredProducts.length) {

  filteredProducts.forEach(product => {

const card = document.createElement("div");

card.className =
  product.representative_image_url
    ? "discover-results2-service-card"
    : "discover-results2-service-card no-image";

card.innerHTML = `

${product.representative_image_url ?

`<img
src="${product.representative_image_url}"
class="discover-results2-product-image"
alt="${product.service_name}"
>` : ""}

<div class="more-service-info">

${
product.representative_image_url

?

`<h3 class="discover-results2-product-title">

${product.service_name}

</h3>`

:

`<h3 class="discover-results2-product-title no-image-title">

${product.service_name}

</h3>`

}

${
product.starting_price ?

`<p class="discover-results2-product-price">

Starting From
<span>

₦${Number(
product.starting_price
).toLocaleString()}

</span>

</p>`

: ""

}

<div class="discover-results2-product-vendor">

<span>

By ${product.vendors?.name || ""}

</span>

${
product.vendors?.verification_status === "blue"

? `<img src="images/bluebadge.png" class="discover-results2-product-badge">`

: product.vendors?.verification_status === "gray"

? `<img src="images/graybadge.png" class="discover-results2-product-badge">`

: ""

}

</div>

<div class="discover-results2-product-rating">

<i class="fa-solid fa-star"></i>

<span>

${Number(
product.vendors?.average_rating || 0
).toFixed(1)}

</span>

<small>

(${product.vendors?.reviews_count || 0})

</small>

</div>


</div>

`;

card.onclick =
  () => {

    console.log(
      "Clicked:",
      product.service_name,
      product.slug
    );

    location.href =
      `vendor-service.html?slug=${product.slug}`;

  };

    similarProductsGrid.appendChild(card);

  });

}

}

});