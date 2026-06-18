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

if (descEl) {

  descEl.style.whiteSpace =
    "pre-line";

  const hasRepresentativeImage =
    !!data.representative_image_url;

  if (
    hasRepresentativeImage &&
    rawDescription.length > 280
  ) {

    const shortText =
      rawDescription.substring(
        0,
        280
      );

    let expanded =
      false;

    const renderDescription =
      () => {

        descEl.textContent =
          expanded
            ? rawDescription
            : shortText + "...";

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

      };

    renderDescription();

  } else {

    descEl.textContent =
      rawDescription;

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
    "vendor_products"
  )
  .select(`
    slug,
    product_name,
    price,
    primary_image_url,
    vendor_id,
    vendors(
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
    "id",
    data.id
  )
  .order(
    "display_order",
    {
      ascending:true
    }
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

  const card =
    document.createElement("div");

  card.className =
    "discover-results2-product-card";

  card.innerHTML = `

<img
src="${product.primary_image_url || "images/placeholder.png"}"
class="discover-results2-product-image"
alt="${product.product_name}"
>

<div>

<h3 class="discover-results2-product-title">

${product.product_name}

</h3>

<p class="discover-results2-product-price">

₦${Number(product.price || 0).toLocaleString()}

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

    location.href =
      `vendor-product.html?slug=${product.slug}`;

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
    .from("vendor_products")
    .select(`
      slug,
      product_name,
      price,
      primary_image_url,
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
    "Similar Products:",
    similarProducts
  );

  console.log(
  "Similar Products Error:",
  similarProductsError
);

console.log(
  "First Similar Product:",
  similarProducts?.[0]
);

console.log(
  "First Vendor Object:",
  similarProducts?.[0]?.vendors
);

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

}

console.log(
  "Filtered Products:",
  filteredProducts
);

if (filteredProducts.length) {

  filteredProducts.forEach(product => {

    const card =
      document.createElement("div");

    card.className =
      "discover-results2-product-card";

    card.innerHTML = `

<img
src="${product.primary_image_url || "images/placeholder.png"}"
class="discover-results2-product-image"
alt="${product.product_name}"
>

<h3 class="discover-results2-product-title">

${product.product_name}

</h3>

<p class="discover-results2-product-price">

₦${Number(product.price || 0).toLocaleString()}

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

<span>

${Number(product.vendors?.average_rating || 0).toFixed(1)}

</span>

<small>

(${product.vendors?.reviews_count || 0})

</small>

</div>

${
product.vendors?.is_sponsored
? `<p class="discover-results2-product-sponsored">Sponsored</p>`
: ""
}

`;

    card.onclick =
      () => {

        location.href =
          `vendor-product.html?slug=${product.slug}`;

      };

    similarProductsGrid.appendChild(card);

  });

}

}

});