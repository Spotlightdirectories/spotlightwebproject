document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;

const params =
  new URLSearchParams(
    window.location.search
  );

const productSlug =
  params.get(
    "slug"
  );

console.log(
  "Product Slug:",
  productSlug
);

if (!productSlug)
  return;

const { data, error } = await supabase
  .from("vendor_products")
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
    productSlug
  )
  .single();

  console.log(
  "Product:",
  data
);

console.log(
  "Error:",
  error
);

  if (error) {
    console.error("Product load error:", error.message);
    return;
  }

try {

const result =
  await supabase
    .from("analytics_events")
    .insert({
      vendor_id: data.vendor_id,
      product_id: data.id,
      event_type: "product_view",
      visitor_id: window.visitorId
    });

  console.log(
    "PRODUCT ANALYTICS RESULT:",
    result
  );

} catch(err) {

  console.error(
    "PRODUCT ANALYTICS CATCH:",
    err
  );

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

const tertiaryImageEl =
  document.getElementById(
    "tertiaryProductImage"
  );

if (imageEl) {

  imageEl.src =
    data.primary_image_url ||
    "images/placeholder.png";

  imageEl.onerror =
    function () {

      this.onerror = null;

      this.src =
        "images/placeholder.png";

    };

}

if (
  secondaryImageEl &&
  data.secondary_image_url
) {

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

  secondaryImageEl.remove();

}

if (
  tertiaryImageEl &&
  data.tertiary_image_url
) {

  tertiaryImageEl.src =
    data.tertiary_image_url;

  tertiaryImageEl.classList.remove(
    "hidden"
  );

  tertiaryImageEl.onclick =
    () => {

      const current =
        imageEl.src;

      imageEl.src =
        tertiaryImageEl.src;

      tertiaryImageEl.src =
        current;

    };

} else if (
  tertiaryImageEl
) {

  tertiaryImageEl.remove();

}

if (titleEl) {

  titleEl.textContent =
    data.product_name || "";

}

const rawDescription =
  data.short_description || "";

const rawKeyDetails =
  data.key_details || "";

const keyDetailsContainer = document.getElementById("productKeyDetails");
const keyDetailsList = document.getElementById("keyDetailsList");

/* Render Key Details */
if (rawKeyDetails && keyDetailsContainer && keyDetailsList) {

  const lines = rawKeyDetails
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length > 0) {
    keyDetailsContainer.classList.remove("hidden");

    keyDetailsList.innerHTML = "";

    lines.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item;
      keyDetailsList.appendChild(li);
    });
  }
}

/* Render Description (independent) */
if (descEl) {
  descEl.textContent = rawDescription;
}

  if (priceEl && data.price) {
    priceEl.textContent = "₦ " + Number(data.price).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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

const moreProductsSection =

  document.querySelector(
    ".more-products"
  );

if (

  !moreProducts?.length

) {

  if (

    moreProductsSection

  ) {

    moreProductsSection.style.display =
      "none";

  }

}
else {

  if (

    moreProductsSection

  ) {

    moreProductsSection.style.display =
      "";

  }

}

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

const similarProductsSection =

  document.querySelector(
    ".similar-products"
  );

if (

  filteredProducts.length === 0

) {

  if (

    similarProductsSection

  ) {

    similarProductsSection.style.display =
      "none";

  }

}
else {

  if (

    similarProductsSection

  ) {

    similarProductsSection.style.display =
      "";

  }

}

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