document.addEventListener("DOMContentLoaded", async () => {


// ===============================
// AUTH + FETCH VENDOR
// ===============================

const supabase = window.supabaseClient;

/* ===============================
SERVICE LIMITS
=============================== */

const SERVICE_LIMITS = {

  free: 3,

  standard: 10,

  enterprise: 25,

  elite: 50,

  custom: Infinity

};

/* ===============================
GET SERVICE LIMIT
=============================== */

function getServiceLimit(
  planTier
) {

  return (
    SERVICE_LIMITS[
      planTier
    ] || 3
  );

}

// Get logged in user
const { data: authData, error: authError } = await supabase.auth.getUser();
const user = authData?.user;

if (authError) {
  console.error(
    "Auth error:",
    authError
  );

  return;
}

if (!user) {
  window.location.href = "login";
  return;
}

// Fetch vendor record
const { data: vendor, error: vendorError } = await supabase
  .from("vendors")
  .select("*")
  .eq("auth_user_id", user.id)
  .maybeSingle();

if (vendorError) {

  console.error(
    "Vendor fetch error:",
    vendorError
  );

  return;
}

if (!vendor) {
  // If no profile yet → still allow access (important for onboarding merge)
  console.warn("No vendor record yet");
}

/* ===============================
BUSINESS TYPE VISIBILITY
=============================== */

const productsSidebarBtn =
  document.getElementById(
    "productsSidebarBtn"
  );

const servicesSidebarBtn =
  document.getElementById(
    "servicesSidebarBtn"
  );

const productsSection =
  document.getElementById(
    "products"
  );

const servicesSection =
  document.getElementById(
    "services"
  );

if (
  vendor?.business_type === "product"
) {

  servicesSidebarBtn?.classList.add(
    "hidden"
  );

  servicesSection?.classList.add(
    "hidden"
  );

}

else if (
  vendor?.business_type === "service"
) {

  productsSidebarBtn?.classList.add(
    "hidden"
  );

  productsSection?.classList.add(
    "hidden"
  );

}

else if (
  vendor?.business_type === "hybrid"
) {

  productsSidebarBtn?.classList.remove(
    "hidden"
  );

  servicesSidebarBtn?.classList.remove(
    "hidden"
  );

  productsSection?.classList.remove(
    "hidden"
  );

  servicesSection?.classList.remove(
    "hidden"
  );

}

/* ===============================
UPGRADE BUTTON ROUTING
=============================== */

const sidebarUpgradeBtn =
  document.getElementById(
    "sidebarUpgradeBtn"
  );

const overviewUpgradeBtn =
  document.getElementById(
    "overviewUpgradeBtn"
  );

const upgradeUrl =
  "getlisted.html";

/* ========================= */
/* PRODUCTS UI */
/* ========================= */

const addProductBtn =
  document.getElementById(
    "addProductBtn"
  );

const productFormWrap =
  document.getElementById(
    "productFormWrap"
  );

if (
  addProductBtn &&
  productFormWrap
) {

  addProductBtn
    .addEventListener(
      "click",
      () => {

        productFormWrap
          .classList
          .toggle("active");

      }
    );

}

/* ========================= */
/* SERVICES UI */
/* ========================= */

const addServiceBtn =
  document.getElementById(
    "addServiceBtn"
  );

const serviceFormWrap =
  document.getElementById(
    "serviceFormWrap"
  );

if (
  addServiceBtn &&
  serviceFormWrap
) {

  addServiceBtn
    .addEventListener(
      "click",
      () => {

        serviceFormWrap
          .classList
          .toggle("active");

      }
    );

}

/* ========================= */
/* SERVICES STATE */
/* ========================= */

let pendingServices = [];

let savedServices = [];

/* ========================= */
/* PRODUCTS STATE */
/* ========================= */

let pendingProducts = [];

let savedProducts = [];

/* ========================= */
/* SERVICE ELEMENTS */
/* ========================= */

const addServiceItemBtn =
  document.getElementById(
    "addServiceItemBtn"
  );

const serviceNameInput =
  document.getElementById(
    "serviceName"
  );

const serviceDescriptionInput =
  document.getElementById(
    "serviceDescription"
  );

const pendingServicesList =
  document.getElementById(
    "pendingServicesList"
  );

const savedServicesList =
  document.getElementById(
    "savedServicesList"
  );

const serviceLimitText =
  document.getElementById(
    "serviceLimitText"
  );

const saveServiceBtn =
  document.getElementById(
    "saveServiceBtn"
  );

  const serviceStartingPriceInput =
  document.getElementById(
    "serviceStartingPrice"
  );

const servicePrimaryImageInput =
  document.getElementById(
    "servicePrimaryImage"
  );

const serviceSecondaryImageInput =
  document.getElementById(
    "serviceSecondaryImage"
  );

let representativeServiceImageUrl =
  "";

let secondaryServiceImageUrl =
  "";

/* ========================= */
/* PRODUCT ELEMENTS */
/* ========================= */

const addProductItemBtn =
  document.getElementById(
    "addProductItemBtn"
  );

const productNameInput =
  document.getElementById(
    "productName"
  );

const productDescriptionInput =
  document.getElementById(
    "productDescription"
  );

const productPriceInput =
  document.getElementById(
    "productPrice"
  );

const primaryProductImageInput =
  document.getElementById(
    "primaryProductImage"
  );

const secondaryProductImageInput =
  document.getElementById(
    "secondaryProductImage"
  );

const tertiaryProductImageInput =
  document.getElementById(
    "tertiaryProductImage"
  );

/* ========================= */
/* PRODUCT IMAGE FILE LABELS */
/* ========================= */

if (
  primaryProductImageInput
) {

  primaryProductImageInput
    .addEventListener(
      "change",
      () => {

        const label =
          document.getElementById(
            "primaryProductImageName"
          );

        label.textContent =
          primaryProductImageInput.files.length
            ? primaryProductImageInput.files[0].name
            : "No file chosen";

      }
    );

}

if (
  secondaryProductImageInput
) {

  secondaryProductImageInput
    .addEventListener(
      "change",
      () => {

        const label =
          document.getElementById(
            "secondaryProductImageName"
          );

        label.textContent =
          secondaryProductImageInput.files.length
            ? secondaryProductImageInput.files[0].name
            : "No file chosen";

      }
    );

}

if (
  tertiaryProductImageInput
) {

  tertiaryProductImageInput
    .addEventListener(
      "change",
      () => {

        const label =
          document.getElementById(
            "tertiaryProductImageName"
          );

        label.textContent =
          tertiaryProductImageInput.files.length
            ? tertiaryProductImageInput.files[0].name
            : "No file chosen";

      }
    );

}

const productKeyDetailsInput =
  document.getElementById(
    "productKeyDetails"
  );

const pendingProductsList =
  document.getElementById(
    "pendingProductsList"
  );

const savedProductsList =
  document.getElementById(
    "savedProductsList"
  );

const productLimitText =
  document.getElementById(
    "productLimitText"
  );

const saveProductBtn =
  document.getElementById(
    "saveProductBtn"
  );

let primaryProductImageUrl =
  "";

let secondaryProductImageUrl =
  "";

let tertiaryProductImageUrl =
  "";

/* ========================= */
/* PRIMARY PRODUCT IMAGE */
/* ========================= */

if (
  primaryProductImageInput
) {

  primaryProductImageInput
    .addEventListener(
      "change",
      async (e) => {

        const file =
          e.target.files[0];

        if (!file) {
          return;
        }

        document.getElementById(
          "primaryProductImageName"
        ).textContent =
          "Uploading...";

        const MAX_IMAGE_SIZE =
          2 * 1024 * 1024;
  
       if (
         file.size >
         MAX_IMAGE_SIZE
       ) {

         alert(
           "Image size must not exceed 2 MB."
        );

        primaryProductImageInput.value =
          "";

        return;

      }

        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp"
        ];

        if (
          !allowedTypes.includes(
            file.type
          )
        ) {

          alert(
            "Only JPG, PNG or WEBP images allowed."
          );

          primaryProductImageInput.value =
            "";

          return;

        }

        const image =
          new Image();

        image.src =
          URL.createObjectURL(
            file
         );

        await new Promise(
          resolve => {

            image.onload =
              resolve;

         }
       );

       if (

          image.width < 800 ||

          image.height < 800

       ) {

         alert(
           "Image resolution must be at least 800 × 800 pixels."
       );

       primaryProductImageInput.value =
         "";

       URL.revokeObjectURL(
         image.src
      );

      return;

      }

      URL.revokeObjectURL(
        image.src
     );

const filePath =
  `${vendor.id}/products/${Date.now()}-${file.name}`;

const {
  error: uploadError
} = await supabase.storage
  .from(
    "vendor-gallery"
  )
  .upload(
    filePath,
    file
  );

if (
  uploadError
) {

  console.error(
    "PRIMARY IMAGE UPLOAD ERROR:",
    uploadError
  );

document.getElementById(
  "primaryProductImageName"
).textContent =
  "";

  alert(
    "Primary image upload failed."
  );

  return;

}

const {
  data
} = supabase.storage
  .from(
    "vendor-gallery"
  )
  .getPublicUrl(
    filePath
  );

primaryProductImageUrl =
  data.publicUrl;

document.getElementById(
  "primaryProductImageName"
).textContent =
  file.name;

  }
);

}

/* ========================= */
/* PRIMARY SERVICE IMAGE */
/* ========================= */

if (
  servicePrimaryImageInput
) {

  servicePrimaryImageInput
    .addEventListener(
      "change",
      async (e) => {

        const file =
          e.target.files[0];

        if (!file) {
          return;
        }

        document.getElementById(
          "servicePrimaryImageName"
        ).textContent =
          "Uploading...";

        const MAX_IMAGE_SIZE =
          2 * 1024 * 1024;
  
       if (
         file.size >
         MAX_IMAGE_SIZE
       ) {

         alert(
           "Image size must not exceed 2 MB."
        );

        servicePrimaryImageInput.value =
          "";

        return;

      }

        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp"
        ];

        if (
          !allowedTypes.includes(
            file.type
          )
        ) {

          alert(
            "Only JPG, PNG or WEBP images allowed."
          );

          servicePrimaryImageInput.value =
            "";

          return;

        }

        const image =
          new Image();

        image.src =
          URL.createObjectURL(
            file
         );

        await new Promise(
          resolve => {

            image.onload =
              resolve;

         }
       );

       if (

          image.width < 800 ||

          image.height < 800

       ) {

         alert(
           "Image resolution must be at least 800 × 800 pixels."
       );

       servicePrimaryImageInput.value =
         "";

       URL.revokeObjectURL(
         image.src
      );

      return;

      }

      URL.revokeObjectURL(
        image.src
     );

const filePath =
  `${vendor.id}/services/${Date.now()}-${file.name}`;

const {
  error: uploadError
} = await supabase.storage
  .from(
    "vendor-gallery"
  )
  .upload(
    filePath,
    file
  );

if (
  uploadError
) {

  document.getElementById(
    "servicePrimaryImageName"
  ).textContent =
    "";

  console.error(
    "SERVICE IMAGE UPLOAD ERROR:",
    uploadError
  );

  alert(
    "Representative image upload failed."
  );

  return;

}

const {
  data
} = supabase.storage
  .from(
    "vendor-gallery"
  )
  .getPublicUrl(
    filePath
  );

representativeServiceImageUrl =
  data.publicUrl;

document.getElementById(
  "servicePrimaryImageName"
).textContent =
  file.name;

  }
);

}

/* ========================= */
/* SECONDARY PRODUCT IMAGE */
/* ========================= */

if (
  secondaryProductImageInput
) {

  secondaryProductImageInput
    .addEventListener(
      "change",
      async (e) => {

        const file =
          e.target.files[0];

        if (!file) {
          return;
        }

        document.getElementById(
          "secondaryProductImageName"
        ).textContent =
          "Uploading...";

        const MAX_IMAGE_SIZE =
          2 * 1024 * 1024;

        if (
          file.size >
          MAX_IMAGE_SIZE
        ) {

          alert(
            "Image size must not exceed 2 MB."
          );

          secondaryProductImageInput.value =
            "";

          return;

        }

        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp"
        ];

        if (
          !allowedTypes.includes(
            file.type
          )
        ) {

          alert(
            "Only JPG, PNG or WEBP images allowed."
          );

          secondaryProductImageInput.value =
            "";

          return;

        }

        const image =
          new Image();

        image.src =
          URL.createObjectURL(
            file
          );

        await new Promise(
          resolve => {

            image.onload =
              resolve;

          }
        );

        if (

          image.width < 800 ||

          image.height < 800

        ) {

          alert(
            "Image resolution must be at least 800 × 800 pixels."
          );

          secondaryProductImageInput.value =
            "";

          URL.revokeObjectURL(
            image.src
          );

          return;

        }

        URL.revokeObjectURL(
          image.src
        );

        const filePath =
          `${vendor.id}/products/${Date.now()}-${file.name}`;

        const {
          error: uploadError
        } = await supabase.storage
          .from(
            "vendor-gallery"
          )
          .upload(
            filePath,
            file
          );

        if (
          uploadError
        ) {

          document.getElementById(
            "secondaryProductImageName"
          ).textContent =
            "";

          alert(
            "Secondary image upload failed."
          );

          return;

        }

        const {
          data
        } = supabase.storage
          .from(
            "vendor-gallery"
          )
          .getPublicUrl(
            filePath
          );

        secondaryProductImageUrl =
          data.publicUrl;

        document.getElementById(
          "secondaryProductImageName"
        ).textContent =
          file.name;

      }
    );

}

/* ========================= */
/* SECONDARY SERVICE IMAGE */
/* ========================= */

if (
  serviceSecondaryImageInput
) {

  serviceSecondaryImageInput
    .addEventListener(
      "change",
      async (e) => {

        const file =
          e.target.files[0];

        if (!file) {
          return;
        }

        document.getElementById(
          "serviceSecondaryImageName"
        ).textContent =
          "Uploading...";

        const MAX_IMAGE_SIZE =
          2 * 1024 * 1024;

        if (
          file.size >
          MAX_IMAGE_SIZE
        ) {

          alert(
            "Image size must not exceed 2 MB."
          );

          serviceSecondaryImageInput.value =
            "";

          return;

        }

        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp"
        ];

        if (
          !allowedTypes.includes(
            file.type
          )
        ) {

          alert(
            "Only JPG, PNG or WEBP images allowed."
          );

          serviceSecondaryImageInput.value =
            "";

          return;

        }

        const image =
          new Image();

        image.src =
          URL.createObjectURL(
            file
          );

        await new Promise(
          resolve => {

            image.onload =
              resolve;

          }
        );

        if (

          image.width < 800 ||

          image.height < 800

        ) {

          alert(
            "Image resolution must be at least 800 × 800 pixels."
          );

          serviceSecondaryImageInput.value =
            "";

          URL.revokeObjectURL(
            image.src
          );

          return;

        }

        URL.revokeObjectURL(
          image.src
        );

        const filePath =
          `${vendor.id}/services/${Date.now()}-${file.name}`;

        const {
          error: uploadError
        } = await supabase.storage
          .from(
            "vendor-gallery"
          )
          .upload(
            filePath,
            file
          );

         if (
           uploadError
          ) {

           document.getElementById(
             "serviceSecondaryImageName"
           ).textContent =
             "";

           alert(
             "Additional image upload failed."
           );

           return;

           }

        const {
          data
        } = supabase.storage
          .from(
            "vendor-gallery"
          )
          .getPublicUrl(
            filePath
          );

        secondaryServiceImageUrl =
          data.publicUrl;

      document.getElementById(
        "serviceSecondaryImageName"
      ).textContent =
        file.name;

      }
    );

}


/* ========================= */
/* TERTIARY PRODUCT IMAGE */
/* ========================= */

if (
  tertiaryProductImageInput
) {

  tertiaryProductImageInput
    .addEventListener(
      "change",
      async (e) => {

        const file =
          e.target.files[0];

        if (!file) {
          return;
        }

        document.getElementById(
          "tertiaryProductImageName"
        ).textContent =
          "Uploading...";

        const MAX_IMAGE_SIZE =
          2 * 1024 * 1024;

        if (
          file.size >
          MAX_IMAGE_SIZE
        ) {

          alert(
            "Image size must not exceed 2 MB."
          );

          tertiaryProductImageInput.value =
            "";

          return;

        }

        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp"
        ];

        if (
          !allowedTypes.includes(
            file.type
          )
        ) {

          alert(
            "Only JPG, PNG or WEBP images allowed."
          );

          tertiaryProductImageInput.value =
            "";

          return;

        }

        const image =
          new Image();

        image.src =
          URL.createObjectURL(
            file
          );

        await new Promise(
          resolve => {

            image.onload =
              resolve;

          }
        );

        if (

          image.width < 800 ||

          image.height < 800

        ) {

          alert(
            "Image resolution must be at least 800 × 800 pixels."
          );

          tertiaryProductImageInput.value =
            "";

          URL.revokeObjectURL(
            image.src
          );

          return;

        }

        URL.revokeObjectURL(
          image.src
        );

        const filePath =
          `${vendor.id}/products/${Date.now()}-${file.name}`;

        const {
          error: uploadError
        } = await supabase.storage
          .from(
            "vendor-gallery"
          )
          .upload(
            filePath,
            file
          );

        if (
          uploadError
        ) {

          document.getElementById(
            "tertiaryProductImageName"
          ).textContent =
            "";

          alert(
            "Third image upload failed."
          );

          return;

        }

        const {
          data
        } = supabase.storage
          .from(
            "vendor-gallery"
          )
          .getPublicUrl(
            filePath
          );

        tertiaryProductImageUrl =
          data.publicUrl;

        document.getElementById(
          "tertiaryProductImageName"
        ).textContent =
          file.name;

      }
    );

}

/* ===============================
PRODUCT LIMITS
=============================== */

const PRODUCT_LIMITS = {

  trial: 3,

  free: 1,

  standard: 6,

  enterprise: 12,

  elite: 24,

  custom: Infinity

};

/* ===============================
GET PRODUCT LIMIT
=============================== */

function getProductLimit(
  planTier
) {

  return (
    PRODUCT_LIMITS[
      planTier
    ] || 1
  );

}

const currentProductLimit =
  getProductLimit(
    vendor?.plan_tier || "free"
  );

if (productLimitText) {

  productLimitText.textContent =
    `Your current plan allows up to ${currentProductLimit} products.`;

}

/* EXISTING SAVED PRODUCTS */

let existingProductsCount = 0;

const {
  count: savedProductsCount
} = await supabase
  .from("vendor_products")
  .select(
    "*",
    {
      count: "exact",
      head: true
    }
  )
  .eq(
    "vendor_id",
    vendor.id
  );

existingProductsCount =
  savedProductsCount || 0;

/* ========================= */
/* FETCH SAVED PRODUCTS */
/* ========================= */

const {
  data: fetchedProducts,
  error: fetchedProductsError
} = await supabase
  .from("vendor_products")
  .select("*")
  .eq(
    "vendor_id",
    vendor.id
  )
  .order(
    "display_order",
    {
      ascending: true
    }
  );

if (
  fetchedProductsError
) {

  console.error(
    "Fetch products error:",
    fetchedProductsError
  );

} else {

  savedProducts =
    fetchedProducts || [];

renderSavedProducts();

}

/* ========================= */
/* RENDER PENDING PRODUCTS */
/* ========================= */

function renderPendingProducts() {

  if (!pendingProductsList) {
    return;
  }

  pendingProductsList.innerHTML =
    "";

  if (!pendingProducts.length) {

    pendingProductsList.innerHTML =
      "";

    return;

  }

  pendingProducts.forEach(
    (product, index) => {

      const item =
        document.createElement("div");

      item.className =
        "vd-service-pill";

      item.innerHTML = `
        <span>
          ${product.product_name}
        </span>

        <button
          type="button"
          class="vd-remove-product-btn"
          data-index="${index}"
        >
          ×
        </button>
      `;

      pendingProductsList.appendChild(
        item
      );

    }
  );

}

/* INITIAL EMPTY STATE */

renderPendingProducts();

/* ========================= */
/* RENDER SAVED PRODUCTS */
/* ========================= */

function renderSavedProducts() {

  if (!savedProductsList) {
    return;
  }

  savedProductsList.innerHTML =
    "";

  if (!savedProducts.length) {

    savedProductsList.innerHTML = `
      <div class="vd-empty-services">
        No saved products yet.
      </div>
    `;

    return;

  }

  savedProducts.forEach(
    product => {

      const item =
        document.createElement("div");

      item.className =
        "vd-service-pill saved";

      item.innerHTML = `

        <img
          class="vd-product-thumb"
          src="${product.primary_image_url}"
          alt="${product.product_name}"
        >

        <div class="vd-service-content">

          <div class="vd-service-name">
            ${product.product_name}
          </div>

          <div class="vd-service-description">
            ${
              (product.short_description || "")
                .length > 160
                  ? product.short_description.slice(0, 160) + "..."
                  : (product.short_description || "")
            }
          </div>

          <div class="vd-product-price">
            ₦${Number(product.price).toLocaleString()}
          </div>

        </div>

        <button
          type="button"
          class="vd-edit-product-btn"
          data-id="${product.id}"
        >
          Edit
        </button>

        <button
          type="button"
          class="vd-delete-product-btn"
          data-id="${product.id}"
        >
          ×
        </button>

      `;

      savedProductsList.appendChild(
        item
      );

    }
  );

}

renderSavedProducts();

let editingProductId =
  null;

/* ========================= */
/* ADD PRODUCT */
/* ========================= */

if (
  addProductItemBtn
) {

  addProductItemBtn
    .addEventListener(
      "click",
      () => {

        const productName =
          productNameInput.value.trim();

        const shortDescription =
          productDescriptionInput.value.trim();

        const productPrice =
          productPriceInput.value.trim();

        const keyDetails =
          productKeyDetailsInput.value.trim();

if (
  !productName ||
  !shortDescription ||
  !productPrice
) {

  alert(
    "Product name, description and price are required."
  );

  return;

}

if (
  !primaryProductImageUrl
) {

  alert(
    "Primary product image is required."
  );

  return;

}

        if (
          (
            existingProductsCount +
            pendingProducts.length
          ) >= currentProductLimit
        ) {

          alert(
            `Your plan allows only ${currentProductLimit} products.`
          );

          return;

        }

pendingProducts.push({

  product_name:
    productName,

  short_description:
    shortDescription,

  price:
    Number(
      productPrice
    ),

  primary_image_url:
    primaryProductImageUrl,

  secondary_image_url:
    secondaryProductImageUrl || null,

  tertiary_image_url:
    tertiaryProductImageUrl || null,

  key_details:
    keyDetails

});

        renderPendingProducts();

        productNameInput.value =
          "";

        productDescriptionInput.value =
          "";

        productPriceInput.value =
          "";

        productKeyDetailsInput.value =
          "";

      }
    );

}

/* ========================= */
/* PRODUCT EDIT / DELETE */
/* ========================= */

if (
  savedProductsList
) {

  savedProductsList
    .addEventListener(
      "click",
      async (e) => {

        const editBtn =
          e.target.closest(
            ".vd-edit-product-btn"
          );

        if (editBtn) {

          const productId =
            editBtn.dataset.id;

          const product =
            savedProducts.find(
              item =>
                String(item.id) ===
                String(productId)
            );

          if (!product) {
            return;
          }

          editingProductId =
            product.id;

          addProductItemBtn.disabled =
            true;

          addProductItemBtn.textContent =
            "Editing...";

          productNameInput.value =
            product.product_name || "";

          productDescriptionInput.value =
            product.short_description || "";

          productPriceInput.value =
            product.price || "";

          productKeyDetailsInput.value =
            product.key_details || "";

          primaryProductImageUrl =
            product.primary_image_url || "";

          secondaryProductImageUrl =
            product.secondary_image_url || "";

          tertiaryProductImageUrl =
            product.tertiary_image_url || "";

          const currentPrimaryImageName =
            document.getElementById(
              "currentPrimaryImageName"
        );

         const currentSecondaryImageName =
           document.getElementById(
             "currentSecondaryImageName"
       );

         const currentTertiaryImageName =
           document.getElementById(
             "currentTertiaryImageName"
      );

if (
  currentPrimaryImageName
) {

  currentPrimaryImageName.textContent =
    primaryProductImageUrl
      ? `Current: ${
          primaryProductImageUrl
            .split("/")
            .pop()
        }`
      : "";

}

if (
  currentSecondaryImageName
) {

  currentSecondaryImageName.textContent =
    secondaryProductImageUrl
      ? `Current: ${
          secondaryProductImageUrl
            .split("/")
            .pop()
        }`
      : "";

}

if (
  currentTertiaryImageName
) {

  currentTertiaryImageName.textContent =
    tertiaryProductImageUrl
      ? `Current: ${
          tertiaryProductImageUrl
            .split("/")
            .pop()
        }`
      : "";

}

          saveProductBtn.textContent =
            "Update Product";

          return;

        }

        const deleteBtn =
          e.target.closest(
            ".vd-delete-product-btn"
          );

        if (!deleteBtn) {
          return;
        }

const productId =
  deleteBtn.dataset.id;

const confirmed =
  confirm(
    "Delete this product?"
  );

if (!confirmed) {
  return;
}

const product =
  savedProducts.find(
    item =>
      String(item.id) ===
      String(productId)
  );

const storagePaths =
  [];

if (
  product?.primary_image_url
) {

  const primaryPath =
    new URL(
      product.primary_image_url
    ).pathname
      .split(
        "/object/public/vendor-gallery/"
      )[1];

  if (primaryPath) {
    storagePaths.push(
      decodeURIComponent(
        primaryPath
      )
    );
  }

}

if (
  product?.secondary_image_url
) {

  const secondaryPath =
    new URL(
      product.secondary_image_url
    ).pathname
      .split(
        "/object/public/vendor-gallery/"
      )[1];

  if (secondaryPath) {

    storagePaths.push(
      decodeURIComponent(
        secondaryPath
      )
    );

  }

}

if (
  product?.tertiary_image_url
) {

  const tertiaryPath =
    new URL(
      product.tertiary_image_url
    ).pathname
      .split(
        "/object/public/vendor-gallery/"
      )[1];

  if (tertiaryPath) {

    storagePaths.push(
      decodeURIComponent(
        tertiaryPath
      )
    );

  }

}

if (
  storagePaths.length
) {

const {
  data: storageData,
  error: storageError
} = await supabase.storage
  .from(
    "vendor-gallery"
  )
  .remove(
    storagePaths
  );


  if (
    storageError
  ) {

    console.error(
      storageError
    );

  }

}

const {
  error
} = await supabase
  .from(
    "vendor_products"
  )
  .delete()
  .eq(
    "id",
    productId
  );

if (error) {
  throw error;
}

savedProducts =
  savedProducts.filter(
    product =>
      String(product.id) !==
      String(productId)
  );

existingProductsCount =
  Math.max(
    0,
    existingProductsCount - 1
  );

renderSavedProducts();


      }
    );

}

/* ========================= */
/* SAVE PRODUCTS */
/* ========================= */

if (
  saveProductBtn
) {

  saveProductBtn
    .addEventListener(
      "click",
      async () => {

        if (!vendor?.id) {
          return;
        }

        if (
          !editingProductId &&
          !pendingProducts.length
        ) {

          alert(
            "No products to save."
          );

          return;

        }

        saveProductBtn.disabled =
          true;

        saveProductBtn.innerHTML =
          editingProductId
            ? "Updating..."
            : "Saving...";

        try {

          if (
            editingProductId
          ) {

 const {
  data,
  error
} = await supabase
  .from("vendor_products")
  .update({

    product_name:
      productNameInput.value.trim(),

    short_description:
      productDescriptionInput.value.trim(),

    price:
      Number(
        productPriceInput.value
      ),

    key_details:
      productKeyDetailsInput.value.trim(),

    primary_image_url:
      primaryProductImageUrl,

    secondary_image_url:
      secondaryProductImageUrl,

    tertiary_image_url:
      tertiaryProductImageUrl
  })
  .eq(
    "id",
    editingProductId
  )
  .select();

            if (error) {
              throw error;
            }

            const target =
              savedProducts.find(
                item =>
                  String(item.id) ===
                  String(editingProductId)
              );

            if (target) {

              target.product_name =
                productNameInput.value.trim();

              target.short_description =
                productDescriptionInput.value.trim();

              target.price =
                Number(
                  productPriceInput.value
                );

              target.key_details =
                productKeyDetailsInput.value.trim();

              target.primary_image_url =
                primaryProductImageUrl;

              target.secondary_image_url =
                secondaryProductImageUrl;

              target.tertiary_image_url =
                tertiaryProductImageUrl;

            }

            editingProductId =
              null;

            addProductItemBtn.disabled =
              false;

            addProductItemBtn.textContent =
              "Add";

            saveProductBtn.innerHTML =
              "Save Products";

            productNameInput.value =
              "";

            productDescriptionInput.value =
              "";

            productPriceInput.value =
              "";

            productKeyDetailsInput.value =
              "";

            primaryProductImageUrl =
              "";

            secondaryProductImageUrl =
              "";

            tertiaryProductImageUrl =
              "";

            document.getElementById(
              "currentPrimaryImageName"
            ).textContent = "";

            document.getElementById(
              "currentSecondaryImageName"
            ).textContent = "";

            document.getElementById(
              "currentTertiaryImageName"
            ).textContent = "";

            renderSavedProducts();

            alert(
              "Product updated successfully."
           );

            return;

          }

const payload =
  pendingProducts.map(
    product => ({

      vendor_id:
        vendor.id,

      product_name:
        product.product_name,

      short_description:
        product.short_description,

      price:
        product.price,

      primary_image_url:
        product.primary_image_url,

      secondary_image_url:
        product.secondary_image_url,

      tertiary_image_url:
        product.tertiary_image_url,

      key_details:
        product.key_details

    })
  );

          const {
            error
          } = await supabase
            .from(
              "vendor_products"
            )
            .insert(
              payload
            );

          if (error) {
            throw error;
          }

          existingProductsCount +=
            payload.length;

          pendingProducts = [];

          renderPendingProducts();

productNameInput.value =
  "";

productDescriptionInput.value =
  "";

productPriceInput.value =
  "";

productKeyDetailsInput.value =
  "";

primaryProductImageInput.value =
  "";

secondaryProductImageInput.value =
  "";

tertiaryProductImageInput.value =
  "";

document.getElementById(
  "primaryProductImageName"
).textContent =
  "No file chosen";

document.getElementById(
  "secondaryProductImageName"
).textContent =
  "No file chosen";

document.getElementById(
  "tertiaryProductImageName"
).textContent =
  "No file chosen";

primaryProductImageUrl =
  "";

secondaryProductImageUrl =
  "";

tertiaryProductImageUrl =
  "";

alert(
  "Products saved successfully."
);

        } catch (err) {

          console.error(
            "Save product error:",
            err
          );

          alert(
            "Unable to save products."
          );

        } finally {

          saveProductBtn.disabled =
            false;

          saveProductBtn.innerHTML =
            "Save Products";

        }

      }
    );

}

/* ========================= */
/* SERVICE CURRENT LIMIT */
/* ========================= */

const currentServiceLimit =
  getServiceLimit(
    vendor?.plan_tier || "free"
  );

/* EXISTING SAVED SERVICES */

let existingServicesCount = 0;

const {
  count: savedServicesCount
} = await supabase
  .from("vendor_services")
  .select(
    "*",
    {
      count: "exact",
      head: true
    }
  )
  .eq(
    "vendor_id",
    vendor.id
  );

existingServicesCount =
  savedServicesCount || 0;

/* ========================= */
/* FETCH SAVED SERVICES */
/* ========================= */

const {
  data: fetchedServices,
  error: fetchedServicesError
} = await supabase
  .from("vendor_services")
  .select("*")
  .eq(
    "vendor_id",
    vendor.id
  )
  .order(
    "created_at",
    {
      ascending: true
    }
  );

if (
  fetchedServicesError
) {

  console.error(
    "Fetch services error:",
    fetchedServicesError
  );

} else {

  savedServices =
    fetchedServices || [];

}

console.log(
  "Saved Services:",
  savedServices
);

/* LIMIT TEXT */

if (serviceLimitText) {

  serviceLimitText.textContent =
    `Your current plan allows up to ${currentServiceLimit} services.`;

}

/* ========================= */
/* RENDER PENDING SERVICES */
/* ========================= */

function renderPendingServices() {

  if (!pendingServicesList) {
    return;
  }

  pendingServicesList.innerHTML =
    "";

if (!pendingServices.length) {

  pendingServicesList.innerHTML =
    "";

  return;

}

  pendingServices.forEach(
    (service, index) => {

      const item =
        document.createElement("div");

      item.className =
        "vd-service-pill";

item.innerHTML = `

  <img
    class="vd-service-image"
    src="${
      service.representative_image_url ||
      "images/placeholder.png"
    }"
    alt="${service.service_name}"
  >

  <div class="vd-service-content">

<div class="vd-service-name">

${service.service_name}

</div>

${
service.short_description
? `<div class="vd-service-description">
${service.short_description}
</div>`
: ""
}

${
service.starting_price
? `<div class="vd-service-price">
From ₦${Number(service.starting_price).toLocaleString()}
</div>`
: ""
}

<div class="vd-service-assets">

${
service.representative_image_url
? "📷 Representative Image"
: ""
}

${
service.secondary_image_url
? " 📷 Additional Image"
: ""
}

</div>

</div>

<button
type="button"
class="vd-remove-service-btn"
data-index="${index}"
>

×

</button>

`;

      pendingServicesList.appendChild(
        item
      );

    }
  );

}

/* INITIAL EMPTY STATE */

renderPendingServices();

renderSavedServices();

/* ========================= */
/* RENDER SAVED SERVICES */
/* ========================= */

function renderSavedServices() {

  if (!savedServicesList) {
    return;
  }

  savedServicesList.innerHTML =
    "";

  if (!savedServices.length) {

    savedServicesList.innerHTML = `
      <div class="vd-empty-services">
        No saved services yet.
      </div>
    `;

    return;

  }

  savedServices.forEach(
    service => {

      const item =
        document.createElement("div");

      item.className =
        "vd-service-pill saved";

item.innerHTML = `

  <img
    class="vd-service-image"
    src="${
      service.representative_image_url ||
      "images/placeholder.png"
    }"
    alt="${service.service_name}"
  >

  <div class="vd-service-content">

    <div class="vd-service-name">
      ${service.service_name}
    </div>

    <div class="vd-service-description">
      ${
        (service.short_description || "").length > 280
          ? service.short_description.slice(0, 280) + "..."
          : (service.short_description || "")
      }
    </div>

    ${
      service.starting_price
        ? `<div class="vd-service-price">
            From ₦${Number(service.starting_price).toLocaleString()}
           </div>`
        : ""
    }

    <div class="vd-service-assets">

      ${
        service.representative_image_url
          ? "📷 Representative Image"
          : ""
      }

      ${
        service.secondary_image_url
          ? " 📷 Additional Image"
          : ""
      }

    </div>

  </div>

  <button
    type="button"
    class="vd-edit-service-btn"
    data-id="${service.id}"
  >
    Edit
  </button>

  <button
    type="button"
    class="vd-delete-service-btn"
    data-id="${service.id}"
  >
    ×
  </button>

`;

      savedServicesList.appendChild(
        item
      );

    }
  );

}

let editingServiceId = null;

/* ========================= */
/* DELETE SAVED SERVICE */
/* ========================= */

if (
  savedServicesList
) {

  savedServicesList
    .addEventListener(
      "click",
      async (e) => {

const editBtn =
  e.target.closest(
    ".vd-edit-service-btn"
  );

if (editBtn) {

  const serviceId =
    editBtn.dataset.id;

  const service =
    savedServices.find(
      item =>
        String(item.id) ===
        String(serviceId)
    );

  console.log(service);
    

  if (!service) {
    return;
  }

  editingServiceId =
    service.id;

  if (
  addServiceItemBtn
) {

  addServiceItemBtn.disabled =
    true;

  addServiceItemBtn.textContent =
    "Editing...";

}

  serviceNameInput.value =
    service.service_name || "";

  if (
    serviceDescriptionInput
  ) {

    serviceDescriptionInput.value =
      service.short_description || "";

  }

serviceStartingPriceInput.value =
  service.starting_price || "";

representativeServiceImageUrl =
  service.representative_image_url || "";

secondaryServiceImageUrl =
  service.secondary_image_url || "";

  
const currentRepresentativeImageName =
  document.getElementById(
    "currentRepresentativeImageName"
  );

const currentAdditionalImageName =
  document.getElementById(
    "currentAdditionalImageName"
  );

if (
  currentRepresentativeImageName
) {

  currentRepresentativeImageName.textContent =
    representativeServiceImageUrl
      ? `Current: ${
          representativeServiceImageUrl
            .split("/")
            .pop()
        }`
      : "";

}


if (
  currentAdditionalImageName
) {

  currentAdditionalImageName.textContent =
    secondaryServiceImageUrl
      ? `Current: ${
          secondaryServiceImageUrl
            .split("/")
            .pop()
        }`
      : "";

}

  if (saveServiceBtn) {

    saveServiceBtn.textContent =
      "Update Service";

  }

  return;

}

        const deleteBtn =
          e.target.closest(
            ".vd-delete-service-btn"
          );

        if (!deleteBtn) {
          return;
        }

        const serviceId =
          deleteBtn.dataset.id;



        if (!serviceId) {
          return;
        }

        const confirmed =
          confirm(
            "Delete this service?"
          );

        if (!confirmed) {
          return;
        }

        try {

const {
  error,
  data
} = await supabase
  .from(
    "vendor_services"
  )
  .delete()
  .eq(
    "id",
    serviceId
  )
  .select();

if (error) {
  throw error;
}



          /* REMOVE FROM STATE */

          savedServices =
            savedServices.filter(
              service =>
                String(service.id) !==
                String(serviceId)
            );

          /* UPDATE LIMIT COUNT */

          existingServicesCount =
            Math.max(
              0,
              existingServicesCount - 1
            );

          /* RE-RENDER */

          renderSavedServices();

        } catch (err) {

          console.error(
            "Delete service error:",
            err
          );

          alert(
            "Unable to delete service."
          );

        }

      }
    );

}

if (
  savedProductsList
) {

  savedProductsList
    .addEventListener(
      "click",
      async (e) => {

      }
    );

}

/* ========================= */
/* ADD SERVICE ITEM */
/* ========================= */

if (
  addServiceItemBtn &&
  serviceNameInput
) {

  addServiceItemBtn
    .addEventListener(
      "click",
      () => {

        const serviceName =
          serviceNameInput.value
            .trim();

const serviceDescription =
  serviceDescriptionInput
    ?.value
    .trim() || "";

if (
  serviceDescription.length < 280
) {

  alert(
    "Service description must contain at least 280 characters including spaces."
  );

  return;

}

if (
  serviceDescription.length > 500
) {

  alert(
    "Service description must not exceed 500 characters including spaces."
  );

  return;

}

        if (!serviceName) {

          alert(
            "Enter a service name."
          );

          return;

        }

/* ========================= */
/* SERVICE VALIDATION */
/* ========================= */

/* BLOCK COMMAS */

if (
  serviceName.includes(",")
) {

  alert(
    "Add one service at a time."
  );

  return;

}

/* CHARACTER LIMIT */

if (
  serviceName.length > 60
) {

  alert(
    "Service name must not exceed 60 characters."
  );

  return;

}

/* WORD LIMIT */

const wordCount =
  serviceName
    .split(/\s+/)
    .length;

if (
  wordCount > 6
) {

  alert(
    "Service name is too long."
  );

  return;

}

        /* LIMIT ENFORCEMENT */

        if (
          existingServicesCount +
          pendingServices.length >=
          currentServiceLimit
        ) {

          alert(
            "You have reached your current plan limit."
          );

          return;

        }

        /* DUPLICATE PREVENTION */

        const alreadyExists =
          pendingServices.some(
            item =>
              item.toLowerCase() ===
              serviceName.toLowerCase()
          );

        if (alreadyExists) {

          alert(
            "Service already added."
          );

          return;

        }



/* ADD SERVICE */

pendingServices.push({

  service_name:
    serviceName,

  short_description:
    serviceDescriptionInput
      ?.value
      .trim() || "",

  starting_price:
    document.getElementById(
      "serviceStartingPrice"
    )?.value || null,

  representative_image_url:
    representativeServiceImageUrl,

  secondary_image_url:
    secondaryServiceImageUrl

});

        renderPendingServices();

        serviceNameInput.value =
          "";

        if (
          serviceDescriptionInput
        ) {

          serviceDescriptionInput.value =
            "";
          document.getElementById(
            "serviceStartingPrice"
          ).value = "";

          servicePrimaryImageInput.value =
            "";

          serviceSecondaryImageInput.value =
            "";

          representativeServiceImageUrl =
            "";

          secondaryServiceImageUrl =
            "";

          }

      }
    );

}

/* ========================= */
/* REMOVE SERVICE ITEM */
/* ========================= */

if (
  pendingServicesList
) {

  pendingServicesList
    .addEventListener(
      "click",
      (e) => {

        const removeBtn =
          e.target.closest(
            ".vd-remove-service-btn"
          );

        if (!removeBtn) {
          return;
        }

        const index =
          Number(
            removeBtn.dataset.index
          );

        pendingServices.splice(
          index,
          1
        );

        renderPendingServices();

      }
    );

}

/* ========================= */
/* SAVE SERVICES */
/* ========================= */

if (
  saveServiceBtn
) {

  saveServiceBtn
    .addEventListener(
      "click",
      async () => {

        if (!vendor?.id) {
          return;
        }

        if (
           !editingServiceId &&
           !pendingServices.length
        ) {

          alert(
            "Add at least one service."
          );

          return;

        }

        saveServiceBtn.disabled =
          true;

        saveServiceBtn.innerHTML =
          "Saving...";

        try {

        if (
  editingServiceId
) {

  const serviceName =
    serviceNameInput.value
      .trim();

  const serviceDescription =
    serviceDescriptionInput
      ?.value
      .trim() || "";

const { error } =
  await supabase
    .from(
      "vendor_services"
    )
    .update({

      service_name:
        serviceName,

      slug:
        serviceName
          .toLowerCase()
          .trim()
          .replace(
            /[^a-z0-9\s-]/g,
            ""
          )
           .replace(
             /\s+/g,
             "-"
         ),


      short_description:
        serviceDescription,

      starting_price:
        Number(
          serviceStartingPriceInput.value
        ) || null,

      representative_image_url:
        representativeServiceImageUrl,

      secondary_image_url:
        secondaryServiceImageUrl

    })
    .eq(
      "id",
      editingServiceId
    );
  if (error) {
    throw error;
  }

  const target =
    savedServices.find(
      item =>
        String(item.id) ===
        String(editingServiceId)
    );

  if (target) {

    target.service_name =
      serviceName;

    target.short_description =
      serviceDescription;

  }

  editingServiceId =
    null;

  if (
  addServiceItemBtn
) {

  addServiceItemBtn.disabled =
    false;

  addServiceItemBtn.textContent =
    "Add";

}

  serviceNameInput.value =
    "";

  if (
    serviceDescriptionInput
  ) {

    serviceDescriptionInput.value =
      "";

  }

  saveServiceBtn.innerHTML =
    "Save Services";

  renderSavedServices();

  alert(
  "Service updated successfully."
);

  return;

}

          const payload =
            pendingServices.map(
              service => ({

                vendor_id:
                  vendor.id,

                vendor_name:
                  vendor.name,

                service_name:
                  service.service_name,
                
                slug:
                  service.service_name
                    .toLowerCase()
                    .trim()
                    .replace(
                      /[^a-z0-9\s-]/g,
                      ""
                    )
                    .replace(
                      /\s+/g,
                      "-"
                    ),

                short_description:
                  service.short_description,

                starting_price:
                  service.starting_price,

                representative_image_url:
                  service.representative_image_url,

                secondary_image_url:
                  service.secondary_image_url

              })
          );

const {
  data,
  error
} = await supabase
  .from(
    "vendor_services"
  )
  .insert(
    payload
  )
  .select();

console.log(
  "SERVICE INSERT DATA:",
  data
);

console.log(
  "SERVICE INSERT ERROR:",
  error
);

          if (error) {
            throw error;
          }

          alert(
            "Services saved successfully."
          );

          /* RESET */

          existingServicesCount +=
            payload.length;

          pendingServices = [];

          renderPendingServices();

          serviceNameInput.value =
            "";

          if (
            serviceDescriptionInput
         ) {

            serviceDescriptionInput.value =
              "";

            serviceStartingPriceInput.value =
              "";

            servicePrimaryImageInput.value =
              "";

            serviceSecondaryImageInput.value =
              "";

            representativeServiceImageUrl =
              "";

            secondaryServiceImageUrl =
              "";

            }

        } catch (err) {

console.log(err);
console.log(err.message);
console.log(err.details);
console.log(err.hint);


          alert(
            "Unable to save services."
          );

        } finally {

          saveServiceBtn.disabled =
            false;

          saveServiceBtn.innerHTML =
            "Save Services";

        }

      }
    );

}


if (sidebarUpgradeBtn) {

  sidebarUpgradeBtn.addEventListener(
    "click",
    () => {

      window.location.href =
        upgradeUrl;

    }
  );

}

if (overviewUpgradeBtn) {

  overviewUpgradeBtn.addEventListener(
    "click",
    () => {

      window.location.href =
        upgradeUrl;

    }
  );

}

/* ===============================
MEDIA SIDEBAR LINK
=============================== */

const mediaSidebarLink =
  document.getElementById(
    "mediaSidebarLink"
  );

if (
  mediaSidebarLink &&
  vendor?.slug
) {

  mediaSidebarLink.addEventListener(
    "click",
    () => {

      window.location.href =
        `vendor-profile.html?slug=${vendor.slug}`;

    }
  );

}

  const navItems = document.querySelectorAll(".vd-nav-item");
  const sections = document.querySelectorAll(".vd-section");
  const pageTitle = document.getElementById("vdPageTitle");

  // ===============================
  // TAB SWITCHING
  // ===============================
  navItems.forEach(btn => {

    btn.addEventListener("click", () => {

      const target = btn.dataset.tab;

      // Remove active from all nav
      navItems.forEach(n => n.classList.remove("active"));

      // Add active to clicked
      btn.classList.add("active");

      // Hide all sections
      sections.forEach(sec => sec.classList.remove("active"));

      // Show selected section
      const targetSection =
        document.getElementById(target);

      if (!targetSection) {
        return;
      }

        targetSection.classList.add("active");

      // Update header title
      if (pageTitle) {
        pageTitle.textContent =
          target.charAt(0).toUpperCase() + target.slice(1);
      }

      /* MOBILE AUTO CLOSE */

if (
  window.innerWidth <= 900 &&
  sidebar &&
  mobileSidebarOverlay
) {

  sidebar.classList.remove(
    "active"
  );

  mobileSidebarOverlay
    .classList.add(
      "hidden"
    );

}

    });

  });

  // ===============================
// PROFILE DROPDOWN TOGGLE
// ===============================

const profileBtn = document.getElementById("profileMenuBtn");
const dropdown = document.getElementById("profileDropdown");

if (profileBtn && dropdown) {

  // Toggle on click
  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });

  // Close when clicking outside
  document.addEventListener("click", () => {
    dropdown.classList.add("hidden");
  });

  // Prevent closing when clicking inside dropdown
  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

}

/* ===============================
LOGOUT
=============================== */

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );

if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    async () => {

      logoutBtn.disabled = true;

      try {

        const { error } =
          await supabase.auth.signOut();

        if (error) {

          console.error(
            "Logout error:",
            error
          );

          logoutBtn.disabled = false;

          return;
        }

        window.location.replace(
          "login.html"
        );

      } catch (err) {

        console.error(
          "Unexpected logout error:",
          err
        );

        logoutBtn.disabled = false;

      }

    }
  );

}

// ===============================
// POPULATE OVERVIEW + PROFILE
// ===============================

if (vendor) {

    // HEADER INFO
const vdUserName = document.getElementById("vdUserName");
const vdUserSpotId = document.getElementById("vdUserSpotId");
const vdSidebarPlan = document.getElementById("vdSidebarPlan");

const vdProfileAvatar =
  document.getElementById(
    "vdProfileAvatar"
  );

const vdProfileFallback =
  document.getElementById(
    "vdProfileFallback"
  );

const verifyEmailBtn =
  document.getElementById(
    "verifyEmailBtn"
  );

const verifiedEmailBadge =
  document.getElementById(
    "verifiedEmailBadge"
  );

if (vdUserName) {
  vdUserName.textContent =
    vendor.name || "—";
}

if (vdUserSpotId) {
  vdUserSpotId.textContent =
    vendor.spot_id || "—";
}

if (vdSidebarPlan) {
  vdSidebarPlan.textContent =
    vendor.plan_tier || "—";
}

/* ===============================
PROFILE AVATAR
=============================== */
if (
  vdProfileAvatar &&
  vdProfileFallback
) {

  const fallbackLetter =
    vendor.name
      ? vendor.name.charAt(0)
      : "S";

  vdProfileFallback.textContent =
    fallbackLetter;

  /* ===============================
  LOGO EXISTS
  =============================== */

  if (vendor.logo_url) {

    vdProfileAvatar.onload =
      () => {

        vdProfileAvatar.classList.remove(
          "hidden"
        );

        vdProfileFallback.classList.add(
          "hidden"
        );

      };

    vdProfileAvatar.onerror =
      () => {

        vdProfileAvatar.classList.add(
          "hidden"
        );

        vdProfileFallback.classList.remove(
          "hidden"
        );

      };

    vdProfileAvatar.src =
      vendor.logo_url;

  }

  /* ===============================
  NO LOGO
  =============================== */

  else {

    vdProfileAvatar.classList.add(
      "hidden"
    );

    vdProfileFallback.classList.remove(
      "hidden"
    );

  }

}
  // OVERVIEW
  const bizName = document.getElementById("bizName");
  const bizEmail = document.getElementById("bizEmail");
  const spotId = document.getElementById("spotId");
  const overviewCategory =
  document.getElementById("overviewCategory");

  const overviewSubcategory =
  document.getElementById("overviewSubcategory"); 

  const planText = document.getElementById("planText");

if (bizName) {
  bizName.textContent =
    vendor.name || "—";
}

if (bizEmail) {
  bizEmail.textContent =
    vendor.email || "—";
}

/* ===============================
EMAIL VERIFICATION STATE
=============================== */

const emailVerified =
  vendor.email_verified === true;

if (
  verifyEmailBtn &&
  verifiedEmailBadge
) {

  if (emailVerified) {

    verifiedEmailBadge
      .classList
      .remove("hidden");

    verifyEmailBtn
      .classList
      .add("hidden");

  } else {

    verifyEmailBtn
      .classList
      .remove("hidden");

    verifiedEmailBadge
      .classList
      .add("hidden");

  }

}

/* ===============================
SEND VERIFICATION EMAIL
=============================== */

if (
  verifyEmailBtn &&
  !emailVerified
) {

  verifyEmailBtn.addEventListener(
    "click",
    async () => {

      verifyEmailBtn.disabled =
        true;

      verifyEmailBtn.textContent =
        "Sending...";

      try {

        const response =
          await fetch(
            "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/swift-task",
            {
              method: "POST",

headers: {
  "Content-Type":
    "application/json",

  "Authorization":
    `Bearer ${
      (
        await supabase.auth.getSession()
      ).data.session.access_token
    }`,
},

              body: JSON.stringify({
                vendorId:
                  vendor.id,

                email:
                  vendor.email
              }),
            }
          );

        const result =
          await response.json();

        if (!response.ok) {

          console.error(
          JSON.stringify(
            result,
            null,
            2
          )
        );

          verifyEmailBtn.textContent =
            "Try Again";

          verifyEmailBtn.disabled =
            false;

          return;
        }

        verifyEmailBtn.textContent =
          "Email Sent";

      } catch (err) {

        console.error(err);

        verifyEmailBtn.textContent =
          "Try Again";

        verifyEmailBtn.disabled =
          false;

      }

    }
  );

}

if (spotId) {
  spotId.textContent =
    vendor.spot_id || "—";
}

if (overviewCategory) {
  overviewCategory.textContent =
    vendor.category || "—";
}

if (overviewSubcategory) {
  overviewSubcategory.textContent =
    vendor.subcategory || "—";
}

 if (planText) {
  planText.textContent =
    vendor.plan_tier || "—";
}

/* ========================= */
/* SUBSCRIPTION SECTION */
/* ========================= */

const subscriptionPlanName =
  document.getElementById(
    "subscriptionPlanName"
  );

const subscriptionBillingCycle =
  document.getElementById(
    "subscriptionBillingCycle"
  );

const subscriptionAmount =
  document.getElementById(
    "subscriptionAmount"
  );

const subscriptionBillingDate =
  document.getElementById(
    "subscriptionBillingDate"
  );

const subscriptionStatusBadge =
  document.getElementById(
    "subscriptionStatusBadge"
  );

const billingHistoryList =
  document.getElementById(
    "billingHistoryList"
  );

const subscriptionUpgradeBtn =
  document.getElementById(
    "subscriptionUpgradeBtn"
  );

const manageBranchesBtn =
  document.getElementById(
    "manageBranchesBtn"
  );

const managePaymentMethodBtn =
  document.getElementById(
    "managePaymentMethodBtn"
  );

/* ACTIVE PLAN */

if (subscriptionPlanName) {

  subscriptionPlanName.textContent =
    vendor.plan_tier || "free";

}

/* BILLING INTERVAL */

if (subscriptionBillingCycle) {

  if (
    vendor.plan_tier === "free"
  ) {

    subscriptionBillingCycle.textContent =
      "Free Forever";

  } else {

    subscriptionBillingCycle.textContent =
      vendor.billing_cycle || "—";

  }

}

/* STATUS */

if (subscriptionStatusBadge) {

  const status =
    vendor.subscription_status ||
    "active";

  subscriptionStatusBadge.textContent =
    status.toUpperCase();

}

/* LATEST PAYMENT */

const { data: latestPayment } =
  await supabase
    .from("vendorpayments")
    .select(`
      amount,
      approved_at
    `)
    .eq("vendor_id", vendor.id)
    .in("status", ["confirmed"])
    .order("approved_at", {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

/* PAYMENT AMOUNT */

if (subscriptionAmount) {

  if (
    vendor.plan_tier === "free"
  ) {

    subscriptionAmount.textContent =
      "No active billing";

  } else {

    subscriptionAmount.textContent =
      latestPayment?.amount
        ? `₦${(
            latestPayment.amount / 100
          ).toLocaleString()}`
        : "₦0.00";

  }

}

if (manageBranchesBtn) {

  if (
    vendor.plan_tier === "free"
  ) {

    manageBranchesBtn.classList.add(
      "hidden"
    );

  } else {

    manageBranchesBtn.classList.remove(
      "hidden"
    );

  }

}

if (managePaymentMethodBtn) {

  if (
    vendor.plan_tier === "free"
  ) {

    managePaymentMethodBtn.classList.add(
      "hidden"
    );

  } else {

    managePaymentMethodBtn.classList.remove(
      "hidden"
    );

  }

}

/* NEXT BILLING DATE */

if (subscriptionBillingDate) {

  subscriptionBillingDate.textContent =
    vendor.expires_at
      ? new Date(
          vendor.expires_at
        ).toLocaleDateString()
      : "—";

}

/* BILLING HISTORY */

if (billingHistoryList) {

  const { data: payments } =
    await supabase
      .from("vendorpayments")
      .select(`
        amount,
        approved_at
      `)
      .eq("vendor_id", vendor.id)
      .in("status", ["confirmed"])
      .order("approved_at", {
        ascending: false
      })
      .limit(5);

  billingHistoryList.innerHTML = "";

  if (
    payments &&
    payments.length
  ) {

    payments.forEach(payment => {

      const row =
        document.createElement("div");

      row.className =
        "vd-history-row";

      row.innerHTML = `
        <span>
          ${new Date(
            payment.approved_at
          ).toLocaleDateString()}
        </span>

        <strong>
          ₦${(
            payment.amount / 100
          ).toLocaleString()}
        </strong>
      `;

      billingHistoryList.appendChild(
        row
      );

    });

  } else {

    billingHistoryList.innerHTML = `
      <div class="vd-history-row">
        <span>No billing history</span>
        <strong>—</strong>
      </div>
    `;

  }

}

/* BUTTONS */

if (subscriptionUpgradeBtn) {

  subscriptionUpgradeBtn
    .addEventListener(
      "click",
      () => {

        window.location.href =
          "getlisted.html";

      }
    );

}

if (manageBranchesBtn) {

  manageBranchesBtn
    .addEventListener(
      "click",
      () => {

        window.location.href =
          "dashboard-branches";

      }
    );

}

/* PAYMENT METHOD */

if (managePaymentMethodBtn) {

  managePaymentMethodBtn
    .addEventListener(
      "click",
      () => {

        alert(
          "Payment method management will be connected later."
        );

      }
    );

}

/* ========================= */
/* VERIFICATION SECTION */
/* ========================= */

const verificationStatusText =
  document.getElementById(
    "verificationStatusText"
  );

const verificationBadge =
  document.getElementById(
    "verificationBadge"
  );

const applyGrayBtn =
  document.getElementById(
    "applyGrayBtn"
  );

const applyBlueBtn =
  document.getElementById(
    "applyBlueBtn"
  );

const verificationStatus =
  vendor.verification_status || "none";

/* BLUE VERIFIED */

if (verificationStatus === "blue") {

  if (verificationStatusText) {
    verificationStatusText.textContent =
      "Blue Verified";
  }

  if (verificationBadge) {

    verificationBadge.textContent =
      "BLUE";

    verificationBadge.style.background =
      "#dbeafe";

    verificationBadge.style.color =
      "#2563eb";

  }

  if (applyGrayBtn) {
    applyGrayBtn.style.display = "none";
  }

  if (applyBlueBtn) {
    applyBlueBtn.style.display = "none";
  }

}

/* GRAY VERIFIED */

else if (
  verificationStatus === "gray"
) {

  if (verificationStatusText) {
    verificationStatusText.textContent =
      "Gray Verified";
  }

  if (verificationBadge) {

    verificationBadge.textContent =
      "GRAY";

    verificationBadge.style.background =
      "#e2e8f0";

    verificationBadge.style.color =
      "#475569";

  }

  if (applyGrayBtn) {
    applyGrayBtn.style.display = "none";
  }

  if (applyBlueBtn) {
    applyBlueBtn.textContent =
      "Upgrade to Blue Badge";
  }

}

/* UNVERIFIED */

else {

  if (verificationStatusText) {
    verificationStatusText.textContent =
      "Unverified";
  }

  if (verificationBadge) {

    verificationBadge.textContent =
      "NONE";

    verificationBadge.style.background =
      "#e5e7eb";

    verificationBadge.style.color =
      "#64748b";

  }

}

/* BUTTON ROUTING */

if (applyGrayBtn) {

  applyGrayBtn
    .addEventListener(
      "click",
      () => {

        localStorage.setItem(
          "pendingBadgeType",
          "gray"
        );

        window.location.href =
          "verify-badge";

      }
    );

}

if (applyBlueBtn) {

  applyBlueBtn
    .addEventListener(
      "click",
      () => {

        localStorage.setItem(
          "pendingBadgeType",
          "blue"
        );

        window.location.href =
          "verify-badge";

      }
    );

}

/* ========================= */
/* FREE TRIAL COUNTDOWN */
/* ========================= */

const trialBox =
  document.getElementById(
    "trialBox"
  );

const trialDaysLeftEl =
  document.getElementById(
    "trialDaysLeft"
  );

const trialTimeLeftEl =
  document.getElementById(
    "trialTimeLeft"
  );

const isFreeVendor =
  vendor.plan_tier === "free";

if (
  isFreeVendor &&
  vendor.trial_started_at &&
  trialBox
) {

  trialBox.classList.remove(
    "hidden"
  );

  const startDate =
    new Date(
      vendor.trial_started_at
    );

  const expiryDate =
    new Date(startDate);

  expiryDate.setDate(
    expiryDate.getDate() + 90
  );

  const updateTrialCountdown =
    () => {

      const now =
        new Date();

      let timeDiff =
        expiryDate - now;

      if (timeDiff < 0) {
        timeDiff = 0;
      }

      const daysLeft =
        Math.floor(
          timeDiff /
          (1000 * 60 * 60 * 24)
        );

      const hoursLeft =
        Math.floor(
          (
            timeDiff /
            (1000 * 60 * 60)
          ) % 24
        );

      const minutesLeft =
        Math.floor(
          (
            timeDiff /
            (1000 * 60)
          ) % 60
        );

      trialDaysLeftEl.textContent =
        `${daysLeft} Days Left`;

      if (trialTimeLeftEl) {

        trialTimeLeftEl.textContent =
          `${hoursLeft}h ${minutesLeft}m remaining`;

      }

    };

  updateTrialCountdown();

  setInterval(
    updateTrialCountdown,
    60000
  );

}

  // PROFILE FORM
  const whatsappInput = document.getElementById("whatsapp");
  const telephoneInput = document.getElementById("telephone");
  const addressInput = document.getElementById("address");

  if (whatsappInput) whatsappInput.value = vendor.whatsapp || "";
  if (telephoneInput) telephoneInput.value = vendor.telephone || "";
  if (addressInput) addressInput.value = vendor.address || "";

const openTimeInput =
  document.getElementById(
    "openTime"
  );

const closeTimeInput =
  document.getElementById(
    "closeTime"
  );

const profileHoursText =
  document.getElementById(
    "profileHoursText"
  );

if (openTimeInput) {
  openTimeInput.value =
    vendor.open_time || "";
}

if (closeTimeInput) {
  closeTimeInput.value =
    vendor.close_time || "";
}

const selectedDays =
  (
    vendor.business_days || ""
  )
    .split(",")
    .filter(Boolean);

document
  .querySelectorAll(
    ".business-day"
  )
  .forEach(cb => {

    cb.checked =
      selectedDays.includes(
        cb.value
      );

  });

if (profileHoursText) {

  if (
    vendor.open_time &&
    vendor.close_time
  ) {

    profileHoursText.textContent =
      `${vendor.open_time} - ${vendor.close_time}
      (${vendor.business_days || ""})`;

  } else {

    profileHoursText.textContent =
      "—";

  }

}

/* =========================
PROFILE DISPLAY VALUES
========================= */

const profileBusinessName =
  document.getElementById("profileBusinessName");

const profileWhatsappText =
  document.getElementById("profileWhatsappText");

const profileTelephoneText =
  document.getElementById("profileTelephoneText");

const profileEmailText =
  document.getElementById("profileEmailText");

const profileStateText =
  document.getElementById("profileStateText");

const profileLgaText =
  document.getElementById("profileLgaText");

const profileAddressText =
  document.getElementById("profileAddressText");

const profileCategoryText =
  document.getElementById("profileCategoryText");

const profileSubcategoryText =
  document.getElementById("profileSubcategoryText");

const profileCoordinatesText =
  document.getElementById("profileCoordinatesText");

/* POPULATE DISPLAY VALUES */

if (profileBusinessName) {
  profileBusinessName.textContent =
    vendor.name || "—";
}

if (profileWhatsappText) {
  profileWhatsappText.textContent =
    vendor.whatsapp || "—";
}

if (profileTelephoneText) {
  profileTelephoneText.textContent =
    vendor.telephone || "—";
}

if (profileEmailText) {
  profileEmailText.textContent =
    vendor.email || "—";
}

if (profileStateText) {
  profileStateText.textContent =
    vendor.state || "—";
}

if (profileLgaText) {
  profileLgaText.textContent =
    vendor.lga || "—";
}

if (profileAddressText) {
  profileAddressText.textContent =
    vendor.address || "—";
}

if (profileCategoryText) {
  profileCategoryText.textContent =
    vendor.category || "—";
}

if (profileSubcategoryText) {
  profileSubcategoryText.textContent =
    vendor.subcategory || "—";
}

/* =========================
PROFILE COORDINATES DISPLAY
========================= */

if (profileCoordinatesText) {

  if (vendor.latitude && vendor.longitude) {

    profileCoordinatesText.textContent =
     `${Number(vendor.latitude).toFixed(5)}, ${Number(vendor.longitude).toFixed(5)}`;

  } else {

    profileCoordinatesText.textContent = "—";

  }

}

/* ========================= */
/* PROFILE COMPLETION LOGIC */
/* ========================= */

/* FETCH MEDIA COUNT */
const { count: mediaCount } = await supabase
  .from("vendor_media")
  .select("*", { count: "exact", head: true })
  .eq("vendor_id", vendor.id);

/* FETCH SOCIAL COUNT */
const { count: socialCount } = await supabase
  .from("vendor_social_links")
  .select("*", { count: "exact", head: true })
  .eq("vendor_id", vendor.id);

/* ELEMENTS */
const statusText = document.getElementById("profileStatusText");
const statusSub = document.getElementById("profileStatusSubtext");
const statusIcon = document.getElementById("profileStatusIcon");
const progressBar = document.getElementById("profileProgress");

/* ========================= */
/* REQUIRED (LISTING GATE) */
/* ========================= */

const hasBasic =
  vendor.name &&
  vendor.email;

const hasDetails =
  vendor.address &&
  vendor.description;

const hasCategory =
  vendor.category &&
  vendor.subcategory;

const hasContact =
  vendor.whatsapp &&
  vendor.telephone;

const hasLocation =
  vendor.latitude &&
  vendor.longitude;

/* LISTING ELIGIBILITY */
const isListed =
  hasBasic &&
  hasDetails &&
  hasCategory &&
  hasContact &&
  hasLocation;

/* ========================= */
/* OPTIONAL (OPTIMIZATION) */
/* ========================= */

const hasEmailVerified =
  vendor.email_verified === true;
const hasMedia = (mediaCount || 0) > 0;
const hasSocial = (socialCount || 0) > 0;

/* ========================= */
/* SCORING SYSTEM */
/* ========================= */

let score = 0;
let total = 8;

/* REQUIRED (5) */
if (hasBasic) score++;
if (hasDetails) score++;
if (hasCategory) score++;
if (hasContact) score++;
if (hasLocation) score++;

/* OPTIONAL (3) */
if (hasEmailVerified) score++;
if (hasMedia) score++;
if (hasSocial) score++;

const percent = Math.round((score / total) * 100);

/* ========================= */
/* UI TEXT */
/* ========================= */

if (statusText) {
  statusText.textContent =
    percent === 100
      ? "Fully Onboarded & Optimized"
      : "Partially Onboarded & Less Optimized";
}

if (statusSub) {
  statusSub.textContent = `Your business listing is ${percent}% complete.`;
}

/* ========================= */
/* CHECKLIST */
/* ========================= */

const checklist = document.getElementById("profileChecklist");

if (checklist) {
  checklist.innerHTML = "";

const items = [
  { label: "Business name & email", ok: hasBasic },
  { label: "Address & description", ok: hasDetails },

  { label: "Category & subcategory", ok: hasCategory },
  { label: "WhatsApp & telephone", ok: hasContact },

  { label: "Business location (map)", ok: hasLocation },
  { label: "Email verified", ok: hasEmailVerified },

  { label: "Add at least 1 media", ok: hasMedia },
  { label: "Add at least 1 social link", ok: hasSocial }
];

  items.forEach(item => {
    const li = document.createElement("li");

    li.className = item.ok ? "vd-check-ok" : "vd-check-missing";

    li.innerHTML = `
      <span>${item.ok ? "✔" : "✖"}</span>
      <span>${item.label}</span>
    `;

    checklist.appendChild(li);
  });
}

/* ========================= */
/* PROGRESS BAR */
/* ========================= */

if (progressBar) {
  progressBar.style.width =
    `${percent}%`;
}

/* ========================= */
/* COLOR SYSTEM */
/* ========================= */

if (progressBar && statusIcon) {

  if (percent === 100) {
    progressBar.style.background = "#22c55e";

    statusIcon.style.background = "#dcfce7";
    statusIcon.style.color = "#166534";

  } else {
    progressBar.style.background = "#facc15";

    statusIcon.style.background = "#fef3c7";
    statusIcon.style.color = "#92400e";
  }
}
  
}

/*
DESCRIPTION TOOLBAR


function applyFormat(command) {

  const selection =
    window.getSelection();

  if (!selection.rangeCount) return;

  const range =
    selection.getRangeAt(0);

  if (command === "bold") {

    const strong =
      document.createElement("strong");

    strong.appendChild(
      range.extractContents()
    );

    range.insertNode(strong);

  }

  if (command === "italic") {

    const em =
      document.createElement("em");

    em.appendChild(
      range.extractContents()
    );

    range.insertNode(em);

  }

  if (command === "underline") {

    const u =
      document.createElement("u");

    u.appendChild(
      range.extractContents()
    );

    range.insertNode(u);

  }

}

if (aboutToolbar) {

  aboutToolbar.classList.remove(
    "hidden"
  );

  aboutToolbar
    .querySelectorAll("button")
    .forEach(btn => {

      btn.addEventListener(
        "mousedown",
        function (e) {

          e.preventDefault();

          const cmd =
            this.getAttribute(
              "data-cmd"
            );

          applyFormat(cmd);

        }
      );

    });

}
*/

/* =========================
INLINE EDIT TOGGLES
========================= */

const editButtons =
  document.querySelectorAll(".vd-edit-btn");

editButtons.forEach(btn => {

  btn.addEventListener("click", () => {

    const targetId =
      btn.dataset.toggle;

    if (!targetId) return;

    const editor =
      document.getElementById(targetId);

    if (!editor) return;

    editor.classList.toggle("active");

  });

});

/* =========================
WHATSAPP NORMALIZATION
========================= */

const whatsappField =
  document.getElementById("whatsapp");

if (whatsappField) {

  whatsappField.addEventListener(
    "input",
    () => {

      /* REMOVE NON-DIGITS */
      whatsappField.value =
        whatsappField.value.replace(/\D/g, "");

      /* REMOVE LEADING ZERO */
      if (
        whatsappField.value.startsWith("0")
      ) {

        whatsappField.value =
          whatsappField.value.substring(1);

      }

      /* LIMIT TO 10 DIGITS */
      whatsappField.value =
        whatsappField.value.slice(0, 10);

    }
  );

}

/* =========================
CATEGORY + SUBCATEGORY
========================= */

const categorySelect =
  document.getElementById("category");

const subcategorySelect =
  document.getElementById("subcategory");

const stateSelect =
  document.getElementById("state");

const lgaSelect =
  document.getElementById("lga");

async function loadCategories() {

  if (!categorySelect) return;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    alert(JSON.stringify(error));
    console.error(error);
    return;
  }

  categorySelect.innerHTML = `
    <option value="">
      Select Category
    </option>
  `;

  data.forEach(category => {

    const option =
      document.createElement("option");

    option.value = category.id;

    option.textContent = category.name;

    categorySelect.appendChild(option);

  });

}

async function loadSubcategories(
  categoryId
) {

  if (!subcategorySelect) return;

  subcategorySelect.innerHTML = `
    <option value="">
      Select Subcategory
    </option>
  `;

  if (!categoryId) return;

  const { data, error } = await supabase
    .from("subcategories")
    .select("*")
    .eq("category_id", categoryId)
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  data.forEach(subcategory => {

    const option =
      document.createElement("option");

    option.value = subcategory.id;

    option.textContent =
      subcategory.name;

    subcategorySelect.appendChild(option);

  });

}

if (categorySelect) {

  categorySelect.addEventListener(
    "change",
    async () => {

      await loadSubcategories(
        categorySelect.value
      );

    }
  );

}

await loadCategories();

if (
  vendor?.category_id &&
  categorySelect
) {

  categorySelect.value =
    vendor.category_id;

  await loadSubcategories(
    vendor.category_id
  );

}

if (
  vendor?.subcategory_id &&
  subcategorySelect
) {

  subcategorySelect.value =
    vendor.subcategory_id;

}

 //NIGERIA STATES AND LGAS SCRIPT
  const nigeriaData = {
    "Abia": ["Aba North","Aba South","Arochukwu","Bende","Ikwuano","Isiala Ngwa North","Isiala Ngwa South","Isuikwuato","Obi Ngwa","Ohafia","Osisioma","Ugwunagbo","Ukwa East","Ukwa West","Umuahia North","Umuahia South","Umu Nneochi"],
    "Adamawa": ["Demsa","Fufore","Ganye","Girei","Gombi","Guyuk","Hong","Jada","Lamurde","Madagali","Maiha","Mayo-Belwa","Michika","Mubi North","Mubi South","Numan","Shelleng","Song","Toungo","Yola North","Yola South"],
    "Akwa Ibom": ["Abak","Eastern Obolo","Eket","Esit-Eket","Essien Udim","Etim Ekpo","Etinan","Ibeno","Ibesikpo Asutan","Ibiono Ibom","Ika","Ikono","Ikot Abasi","Ikot Ekpene","Ini","Itu","Mbo","Mkpat-Enin","Nsit-Atai","Nsit-Ibom","Nsit-Ubium","Obot Akara","Okobo","Onna","Oron","Oruk Anam","Udung-Uko","Ukanafun","Uruan","Urue-Offong/Oruko","Uyo"],
    "Anambra": ["Aguata","Anambra East","Anambra West","Anaocha","Awka North","Awka South","Ayamelum","Dunukofia","Ekwusigo","Idemili North","Idemili South","Ihiala","Njikoka","Nnewi North","Nnewi South","Ogbaru","Onitsha North","Onitsha South","Orumba North","Orumba South","Oyi"],
    "Bauchi": ["Alkaleri","Bauchi","Bogoro","Damban","Darazo","Dass","Gamawa","Ganjuwa","Giade","Itas/Gadau","Jama'are","Katagum","Kirfi","Misau","Ningi","Shira","Tafawa Balewa","Toro","Warji","Zaki"],
    "Bayelsa": ["Brass","Ekeremor","Kolokuma/Opokuma","Nembe","Ogbia","Sagbama","Southern Ijaw","Yenagoa"],
    "Benue": ["Ado","Agatu","Apa","Buruku","Gboko","Guma","Gwer East","Gwer West","Katsina-Ala","Konshisha","Kwande","Logo","Makurdi","Obi","Ogbadibo","Ohimini","Oju","Okpokwu","Otukpo","Tarka","Ukum","Ushongo","Vandeikya"],
    "Borno": ["Abadam","Askira/Uba","Bama","Bayo","Biu","Chibok","Damboa","Dikwa","Gubio","Guzamala","Gwoza","Hawul","Jere","Kaga","Kala/Balge","Konduga","Kukawa","Kwaya Kusar","Mafa","Magumeri","Maiduguri","Marte","Mobbar","Monguno","Ngala","Nganzai","Shani"],
    "Cross River": ["Abi","Akamkpa","Akpabuyo","Bakassi","Bekwarra","Biase","Boki","Calabar Municipal","Calabar South","Etung","Ikom","Obanliku","Obubra","Obudu","Odukpani","Ogoja","Yakuur","Yala"],
    "Delta": ["Aniocha North","Aniocha South","Bomadi","Burutu","Ethiope East","Ethiope West","Ika North East","Ika South","Isoko North","Isoko South","Ndokwa East","Ndokwa West","Okpe","Oshimili North","Oshimili South","Patani","Sapele","Udu","Ughelli North","Ughelli South","Ukwuani","Uvwie","Warri North","Warri South","Warri South West"],
    "Ebonyi": ["Abakaliki","Afikpo North","Afikpo South","Ebonyi","Ezza North","Ezza South","Ikwo","Ishielu","Ivo","Izzi","Ohaozara","Ohaukwu","Onicha"],
    "Edo": ["Akoko-Edo","Egor","Esan Central","Esan North-East","Esan South-East","Esan West","Etsako Central","Etsako East","Etsako West","Igueben","Ikpoba-Okha","Orhionmwon","Oredo","Ovia North-East","Ovia South-West","Owan East","Owan West","Uhunmwonde"],
    "Ekiti": ["Ado-Ekiti","Efon","Ekiti East","Ekiti South-West","Ekiti West","Emure","Gbonyin","Ido Osi","Ijero","Ikere","Ikole","Ilejemeje","Irepodun/Ifelodun","Ise/Orun","Moba","Oye"],
    "Enugu": ["Aninri","Awgu","Enugu East","Enugu North","Enugu South","Ezeagu","Igbo Etiti","Igbo Eze North","Igbo Eze South","Isi Uzo","Nkanu East","Nkanu West","Nsukka","Oji River","Udenu","Udi","Uzo-Uwani"],
    "Gombe": ["Akko","Balanga","Billiri","Dukku","Funakaye","Gombe","Kaltungo","Kwami","Nafada","Shongom","Yamaltu/Deba"],
    "Imo": ["Aboh Mbaise","Ahiazu Mbaise","Ehime Mbano","Ezinihitte","Ideato North","Ideato South","Ihitte/Uboma","Ikeduru","Isiala Mbano","Isu","Mbaitoli","Ngor Okpala","Njaba","Nkwerre","Nwangele","Obowo","Oguta","Ohaji/Egbema","Okigwe","Onuimo","Orlu","Orsu","Oru East","Oru West","Owerri Municipal","Owerri North","Owerri West"],
    "Jigawa": ["Auyo","Babura","Biriniwa","Birnin Kudu","Buji","Dutse","Gagarawa","Garki","Gumel","Guri","Gwaram","Gwiwa","Hadejia","Jahun","Kafin Hausa","Kazaure","Kiri Kasama","Kiyawa","Maigatari","Malam Madori","Miga","Ringim","Roni","Sule Tankarkar","Taura","Yankwashi"],
    "Kaduna": ["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zangon Kataf","Zaria"],
    "Kano": ["Ajingi","Albasu","Bagwai","Bebeji","Bichi","Bunkure","Dala","Dambatta","Dawakin Kudu","Dawakin Tofa","Doguwa","Fagge","Gabasawa","Garko","Garun Mallam","Gaya","Gezawa","Gwale","Gwarzo","Kabo","Kano Municipal","Karaye","Kibiya","Kiru","Kumbotso","Kunchi","Kura","Madobi","Makoda","Minjibir","Nasarawa","Rano","Rimin Gado","Rogo","Shanono","Sumaila","Takai","Tarauni","Tofa","Tsanyawa","Tudun Wada","Ungogo","Warawa","Wudil"],
    "Katsina": ["Bakori","Batagarawa","Batsari","Baure","Bindawa","Charanchi","Dandume","Danja","Dan Musa","Daura","Dutsi","Dutsin Ma","Faskari","Funtua","Ingawa","Jibia","Kafur","Kaita","Kankara","Kankia","Katsina","Kurfi","Kusada","Mai’Adua","Malumfashi","Mani","Mashi","Matazu","Musawa","Rimi","Sabuwa","Safana","Sandamu","Zango"],
    "Kebbi": ["Aleiro","Arewa Dandi","Argungu","Augie","Bagudo","Birnin Kebbi","Bunza","Dandi","Fakai","Gwandu","Jega","Kalgo","Koko/Besse","Maiyama","Ngaski","Sakaba","Shanga","Suru","Wasagu/Danko","Yauri","Zuru"],
    "Kogi": ["Adavi","Ajaokuta","Ankpa","Bassa","Dekina","Ibaji","Idah","Igalamela Odolu","Ijumu","Kabba/Bunu","Kogi","Lokoja","Mopa Muro","Ofu","Ogori/Magongo","Okehi","Okene","Olamaboro","Omala","Yagba East","Yagba West"],
    "Kwara": ["Asa","Baruten","Edu","Ekiti","Ifelodun","Ilorin East","Ilorin South","Ilorin West","Irepodun","Isin","Kaiama","Moro","Offa","Oke Ero","Oyun","Pategi"],
    "Lagos": ["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Shomolu","Surulere"],
    "Nasarawa": ["Akwanga","Awe","Doma","Karu","Keana","Keffi","Kokona","Lafia","Nasarawa","Nasarawa Egon","Obi","Toto","Wamba"],
    "Niger": ["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Muya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"],
    "Ogun": ["Abeokuta North","Abeokuta South","Ado-Odo/Ota","Egbado North","Egbado South","Ewekoro","Ifo","Ijebu East","Ijebu North","Ijebu North East","Ijebu Ode","Ikenne","Imeko Afon","Ipokia","Obafemi Owode","Odeda","Odogbolu","Ogun Waterside","Remo North","Shagamu"],
    "Ondo": ["Akoko North-East","Akoko North-West","Akoko South-West","Akoko South-East","Akure North","Akure South","Ese Odo","Idanre","Ifedore","Ilaje","Ile Oluji/Okeigbo","Irele","Odigbo","Okitipupa","Ondo East","Ondo West","Ose","Owo"],
    "Osun": ["Atakunmosa East","Atakunmosa West","Aiyedaade","Aiyedire","Boluwaduro","Boripe","Ede North","Ede South","Egbedore","Ejigbo","Ife Central","Ife East","Ife North","Ife South","Ifedayo","Ifelodun","Ila","Ilesa East","Ilesa West","Irepodun","Irewole","Isokan","Iwo","Obokun","Odo Otin","Ola Oluwa","Olorunda","Oriade","Orolu","Osogbo"],
    "Oyo": ["Afijio","Akinyele","Atiba","Atisbo","Egbeda","Ibadan North","Ibadan North-East","Ibadan North-West","Ibadan South-East","Ibadan South-West","Ibarapa Central","Ibarapa East","Ibarapa North","Ido","Irepo","Iseyin","Itesiwaju","Iwajowa","Kajola","Lagelu","Ogbomosho North","Ogbomosho South","Ogo Oluwa","Olorunsogo","Oluyole","Ona Ara","Orelope","Ori Ire","Oyo East","Oyo West","Saki East","Saki West","Surulere"],
    "Plateau": ["Barkin Ladi","Bassa","Bokkos","Jos East","Jos North","Jos South","Kanam","Kanke","Langtang North","Langtang South","Mangu","Mikang","Pankshin","Qua'an Pan","Riyom","Shendam","Wase"],
    "Rivers": ["Abua/Odual","Ahoada East","Ahoada West","Akuku-Toru","Andoni","Asari-Toru","Bonny","Degema","Eleme","Emohua","Etche","Gokana","Ikwerre","Khana","Obio/Akpor","Ogba/Egbema/Ndoni","Ogu/Bolo","Okrika","Omuma","Opobo/Nkoro","Oyigbo","Port Harcourt","Tai"],
    "Sokoto": ["Binji","Bodinga","Dange Shuni","Gada","Goronyo","Gudu","Gwadabawa","Illela","Isa","Kebbe","Kware","Rabah","Sabon Birni","Shagari","Silame","Sokoto North","Sokoto South","Tambuwal","Tangaza","Tureta","Wamako","Wurno","Yabo"],
    "Taraba": ["Ardo Kola","Bali","Donga","Gashaka","Gassol","Ibi","Jalingo","Karim Lamido","Kumi","Lau","Sardauna","Takum","Ussa","Wukari","Yorro","Zing"],
    "Yobe": ["Bade","Bursari","Damaturu","Fika","Fune","Geidam","Gujba","Gulani","Jakusko","Karasuwa","Machina","Nangere","Nguru","Potiskum","Tarmuwa","Yunusari","Yusufari"],
    "Zamfara": ["Anka","Bakura","Birnin Magaji/Kiyaw","Bukkuyum","Bungudu","Gummi","Gusau","Kaura Namoda","Maradun","Maru","Shinkafi","Talata Mafara","Chafe","Zurmi"],
    "FCT": ["Abaji","Bwari","Gwagwalada","Kuje","Kwali","Municipal Area Council"]
  };

   Object.keys(nigeriaData).forEach(state => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    stateSelect.appendChild(option);
  });

  stateSelect.addEventListener("change", () => {
    const selectedState = stateSelect.value;
    lgaSelect.innerHTML = "<option value=''>Select LGA</option>";
    if (nigeriaData[selectedState]) {
      nigeriaData[selectedState].forEach(lga => {
        const option = document.createElement("option");
        option.value = lga;
        option.textContent = lga;
        lgaSelect.appendChild(option);
      });
    }
  });
  //END OF NIGERIA STATES AND LGAS SCRIPT

  if (vendor?.state && stateSelect) {

  stateSelect.value = vendor.state;

  stateSelect.dispatchEvent(
    new Event("change")
  );

  setTimeout(() => {

    if (
      vendor.lga &&
      lgaSelect
    ) {

      lgaSelect.value =
        vendor.lga;

    }

  }, 100);

}

/* =========================
DETECT BUSINESS LOCATION
========================= */

const detectLocationBtn =
  document.getElementById("detectLocationBtn");

const latitudeInput =
  document.getElementById("latitude");

const longitudeInput =
  document.getElementById("longitude");

const vendorDescription =
  document.getElementById(
    "vendorDescription"
  );

const descriptionInput =
  document.getElementById(
    "descriptionInput"
  );

const aboutToolbar =
  document.getElementById(
    "aboutToolbar"
  );

/* =========================
SAFE DESCRIPTION TOOLBAR
========================= */

if (aboutToolbar && descriptionInput) {

  aboutToolbar.classList.remove(
    "hidden"
  );

  const toolbarButtons =
    aboutToolbar.querySelectorAll(
      "button[data-cmd]"
    );

  toolbarButtons.forEach(btn => {

    btn.addEventListener(
      "click",
      (e) => {

        e.preventDefault();

        const cmd =
          btn.getAttribute(
            "data-cmd"
          );

        if (!cmd) return;

        descriptionInput.focus();

        document.execCommand(
          cmd,
          false,
          null
        );

      }
    );

  });

}

/* =========================
DESCRIPTION DISPLAY
========================= */

if (vendorDescription) {

  vendorDescription.innerHTML =
    vendor.description || "—";

}

if (descriptionInput) {

  descriptionInput.innerHTML =
    vendor.description || "";

}

const confirmLocationCheckbox =
  document.getElementById(
    "confirmLocationCheckbox"
  );

const locationStatus =
  document.getElementById("locationStatus");

if (detectLocationBtn) {

  detectLocationBtn.addEventListener(
    "click",
    () => {

      if (
        !confirmLocationCheckbox ||
        !confirmLocationCheckbox.checked
      ) {

        if (locationStatus) {

          locationStatus.textContent =
            "Please confirm you are at your business location before detecting.";

        }

        return;
      }

      if (!navigator.geolocation) {

        if (locationStatus) {

          locationStatus.textContent =
            "Geolocation is not supported by your browser.";

        }

        return;
      }

      if (locationStatus) {
        locationStatus.textContent =
          "Detecting location...";
      }

      navigator.geolocation.getCurrentPosition(

        (position) => {

          const lat =
            position.coords.latitude;

          const lng =
            position.coords.longitude;

          if (latitudeInput) {
            latitudeInput.value =
              lat.toFixed(6);
          }

          if (longitudeInput) {
            longitudeInput.value =
              lng.toFixed(6);
          }

          const profileCoordinatesText =
            document.getElementById(
              "profileCoordinatesText"
            );

          if (profileCoordinatesText) {

            profileCoordinatesText.textContent =
              `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

          }

          if (locationStatus) {

            locationStatus.textContent =
              "Location detected successfully.";

          }

        },

        (error) => {

          console.error(
            "Geolocation error:",
            error
          );

          if (locationStatus) {

            locationStatus.textContent =
              "Unable to retrieve location. Please allow location permission or enter coordinates manually.";

          }

        },

        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }

      );

    }
  );

}

/* =========================
SAVE PROFILE CHANGES
========================= */

const saveProfileBtn =
  document.getElementById("saveProfileBtn");

const profileStatusMsg =
  document.getElementById("profileStatusMsg");

if (saveProfileBtn && vendor) {

  saveProfileBtn.addEventListener(
    "click",
    async () => {

      saveProfileBtn.disabled = true;

      if (profileStatusMsg) {
        profileStatusMsg.textContent =
          "Saving changes...";
      }

      try {

  const publicConsent =
  document.getElementById(
    "publicConsent"
  );

if (
  !publicConsent ||
  !publicConsent.checked
) {

  if (profileStatusMsg) {

    profileStatusMsg.textContent =
      "You must agree to the public listing consent before saving.";

  }

  saveProfileBtn.disabled = false;

  return;
}

const addressField =
  document.getElementById("address");

const whatsappField =
  document.getElementById("whatsapp");

const telephoneField =
  document.getElementById("telephone");

const descriptionField =
  document.getElementById(
    "descriptionInput"
  );



/* =========================
REQUIRED FIELD VALIDATION
========================= */

const requiredChecks = [

  {
    field: whatsappField,
    label: "WhatsApp number"
  },

  {
    field: telephoneField,
    label: "Telephone number"
  },

  {
    field: addressField,
    label: "Business address"
  },

  {
    field: stateSelect,
    label: "State"
  },

  {
    field: lgaSelect,
    label: "LGA"
  }

];

for (const item of requiredChecks) {

  if (
    !item.field ||
    !item.field.value ||
    !item.field.value.trim()
  ) {

    if (profileStatusMsg) {

      profileStatusMsg.textContent =
        `${item.label} is required.`;

    }

    saveProfileBtn.disabled = false;

    return;
  }

}

/* CATEGORY VALIDATION */

const category =
  categorySelect?.value;

const subcategory =
  subcategorySelect?.value;

if (
  !category ||
  !subcategory
) {

  if (profileStatusMsg) {

    profileStatusMsg.textContent =
      "Category and subcategory are required.";

  }

  saveProfileBtn.disabled = false;

  return;

}
/* =========================
DETECT ACTUAL CHANGES
========================= */

const nextWhatsapp =
  whatsappField
    ? whatsappField.value.trim()
    : vendor.whatsapp;

const nextTelephone =
  telephoneField
    ? telephoneField.value.trim()
    : vendor.telephone;

const nextAddress =
  addressField
    ? addressField.value.trim()
    : vendor.address;

const nextDescription =
  descriptionField &&
  descriptionField.innerHTML
    ? descriptionField.innerHTML.trim()
    : vendor.description;

const nextState =
  stateSelect?.value || null;

const nextLga =
  lgaSelect?.value || null;

const nextCategoryId =
  categorySelect?.value
    ? categorySelect.value
    : vendor.category_id;

const nextSubcategoryId =
  subcategorySelect?.value
    ? subcategorySelect.value
    : vendor.subcategory_id;

const nextLatitude =
  latitudeInput?.value
    ? parseFloat(latitudeInput.value)
    : vendor.latitude;

const nextLongitude =
  longitudeInput?.value
    ? parseFloat(longitudeInput.value)
    : vendor.longitude;

const nextOpenTime =
  document.getElementById("openTime")?.value || "";

const nextCloseTime =
  document.getElementById("closeTime")?.value || "";

const nextBusinessDays =
  [...document.querySelectorAll(".business-day")]
    .filter(cb => cb.checked)
    .map(cb => cb.value)
    .join(",");

const hasChanges =

  nextWhatsapp !==
    (vendor.whatsapp || "") ||

  nextTelephone !==
    (vendor.telephone || "") ||

  nextAddress !==
    (vendor.address || "") ||

  nextDescription !==
    (vendor.description || "") ||

  nextState !==
    (vendor.state || null) ||

  nextLga !==
    (vendor.lga || null) ||

  nextCategoryId !==
    (vendor.category_id || null) ||

  nextSubcategoryId !==
  (vendor.subcategory_id || null) ||

nextLatitude !==
  vendor.latitude ||

nextLongitude !==
  vendor.longitude ||

nextOpenTime !==
  (vendor.open_time || "") ||

nextCloseTime !==
  (vendor.close_time || "") ||

nextBusinessDays !==
  (vendor.business_days || "");

if (!hasChanges) {

  if (profileStatusMsg) {

    profileStatusMsg.textContent =
      "No new changes to save.";

  }

  saveProfileBtn.disabled = false;

  return;

}

const payload = {

    whatsapp:
    whatsappField
      ? whatsappField.value.trim()
      : vendor.whatsapp,

  telephone:
    telephoneField
      ? telephoneField.value.trim()
      : vendor.telephone,

  address:
    addressField
      ? addressField.value.trim()
      : vendor.address,

  description:
  descriptionField &&
  descriptionField.innerHTML
    ? descriptionField.innerHTML.trim()
    : vendor.description,

  latitude:
    latitudeInput?.value
      ? parseFloat(latitudeInput.value)
      : vendor.latitude,

  longitude:
    longitudeInput?.value
      ? parseFloat(longitudeInput.value)
      : vendor.longitude,

category_id:
  categorySelect?.value
    ? categorySelect.value
    : vendor.category_id,

subcategory_id:
  subcategorySelect?.value
    ? subcategorySelect.value
    : vendor.subcategory_id,

category:
  categorySelect?.value
    ? categorySelect.options[
        categorySelect.selectedIndex
      ]?.text
    : vendor.category,

subcategory:
  subcategorySelect?.value
    ? subcategorySelect.options[
        subcategorySelect.selectedIndex
      ]?.text
    : vendor.subcategory,

  state:
  stateSelect?.value || null,

  lga:
  lgaSelect?.value || null,

open_time:
  document.getElementById("openTime")?.value || null,

close_time:
  document.getElementById("closeTime")?.value || null,

  business_days:
    [...document.querySelectorAll(".business-day")]
      .filter(cb => cb.checked)
      .map(cb => cb.value)
      .join(","),

};

const updatedPayload = {
  ...payload,

  onboarding_completed:
    !!(
      (vendor.name || "").trim() &&
      (vendor.email || "").trim() &&
      (payload.address || "").trim() &&
      (payload.description || "").trim() &&
      (payload.category || "").trim() &&
      (payload.subcategory || "").trim() &&
      (payload.whatsapp || "").trim() &&
      (payload.telephone || "").trim() &&
      payload.latitude &&
      payload.longitude
    )
};

const { error } = await supabase
  .from("vendors")
  .update(updatedPayload)
  .eq("id", vendor.id);

        if (error) {
          throw error;
        }

        /* =========================
        UPDATE DISPLAY VALUES
        ========================= */

        if (profileWhatsappText) {
          profileWhatsappText.textContent =
            payload.whatsapp || "—";
        }

        if (profileTelephoneText) {
          profileTelephoneText.textContent =
            payload.telephone || "—";
        }

        if (profileAddressText) {
          profileAddressText.textContent =
            payload.address || "—";
        }

if (profileHoursText) {

  if (
    payload.open_time &&
    payload.close_time
  ) {

    profileHoursText.textContent =
      `${payload.open_time} - ${payload.close_time}
      (${payload.business_days || ""})`;

  } else {

    profileHoursText.textContent =
      "—";

  }

}

        if (profileStateText) {
          profileStateText.textContent =
            payload.state || "—";
         }

        if (profileLgaText) {
           profileLgaText.textContent =
            payload.lga || "—";
        }
 
        if (
          profileCategoryText &&
          categorySelect
       ) {

          profileCategoryText.textContent =
            categorySelect.options[
            categorySelect.selectedIndex
           ]?.text || "—";

            }

         if (
           profileSubcategoryText &&
           subcategorySelect
          ) {

             profileSubcategoryText.textContent =
               subcategorySelect.options[
               subcategorySelect.selectedIndex
              ]?.text || "—";

           }

       
        if (profileCoordinatesText &&
          payload.latitude &&
          payload.longitude
        ) {

          profileCoordinatesText.textContent =
            `${payload.latitude.toFixed(5)}, ${payload.longitude.toFixed(5)}`;

        }

        if (profileStatusMsg) {

          profileStatusMsg.textContent =
            "Profile updated successfully.";

        }

      } catch (err) {

        console.error(err);
        alert(err.message);

        if (profileStatusMsg) {

          profileStatusMsg.textContent =
            "Unable to save profile changes.";

        }

      } finally {

        saveProfileBtn.disabled = false;

      }

    }
  );

}

/* ========================= */
/* SETTINGS - CLOSE ACCOUNT */
/* ========================= */

const closeAccountBtn =
  document.getElementById(
    "closeAccountBtn"
  );

const restoreAccountBtn =
  document.getElementById(
    "restoreAccountBtn"
  );

const closingBanner =
  document.getElementById(
    "closingBanner"
  );

const closingText =
  document.getElementById(
    "closingText"
  );

/* CHECK CLOSURE STATUS */

const isClosing =
  vendor.account_status === "closing";

if (
  isClosing &&
  vendor.scheduled_deletion_at
) {

  const deletionDate =
    new Date(
      vendor.scheduled_deletion_at
    );

  if (closingBanner) {

    closingBanner.classList.remove(
      "hidden"
    );

  }

  if (closingText) {

    closingText.textContent =
      `Your account is scheduled for permanent closure on ${deletionDate.toLocaleDateString()}. Restore your account before this date to regain access.`;

  }

  /* DISABLE CLOSE BUTTON */

  if (closeAccountBtn) {

    closeAccountBtn.disabled = true;

    closeAccountBtn.textContent =
      "Closure Scheduled";

    closeAccountBtn.style.opacity =
      "0.6";

    closeAccountBtn.style.cursor =
      "not-allowed";

  }

}

/* CLOSE ACCOUNT */

if (closeAccountBtn) {

  closeAccountBtn
    .addEventListener(
      "click",
      async () => {

        const confirmed =
          confirm(`
Are you sure you want to close your account?

Your profile will be removed immediately and permanently deleted after 14 days.

Closing your account does NOT cancel or refund any active subscription. All payments are final.
          `);

        if (!confirmed) {
          return;
        }

        const now =
          new Date().toISOString();

        const { error } =
          await supabase
            .from("vendors")
            .update({
              account_status: "closing",
              scheduled_deletion_at:
               new Date(
               Date.now() +
               14 * 24 * 60 * 60 * 1000
             ).toISOString()
          })
            .eq("id", vendor.id);

        if (error) {

          alert(
            "Unable to schedule account closure."
          );

          console.error(error);

          return;

        }

        alert(
          "Your account closure has been scheduled. You may restore your account within 14 days."
        );

        window.location.reload();

      }
    );

}

/* RESTORE ACCOUNT */

if (restoreAccountBtn) {

  restoreAccountBtn
    .addEventListener(
      "click",
      async () => {

        const confirmed =
          confirm(
            "Restore your vendor account?"
          );

        if (!confirmed) {
          return;
        }

        const { error } =
          await supabase
            .from("vendors")
            .update({
              account_status: "active",
              scheduled_deletion_at: null
           })
            .eq("id", vendor.id);

        if (error) {

          alert(
            "Unable to restore account."
          );

          console.error(error);

          return;

        }

        alert(
          "Your account has been restored."
        );

        window.location.reload();

      }
    );

}

/* ========================= */
/* MOBILE SIDEBAR */
/* ========================= */

const mobileMenuToggle =
  document.getElementById(
    "mobileMenuToggle"
  );

const mobileSidebarOverlay =
  document.getElementById(
    "mobileSidebarOverlay"
  );

const sidebar =
  document.querySelector(
    ".vd-sidebar"
  );

if (
  mobileMenuToggle &&
  mobileSidebarOverlay &&
  sidebar
) {

  /* OPEN MENU */
  mobileMenuToggle.addEventListener(
    "click",
    () => {

      sidebar.classList.add(
        "active"
      );

      mobileSidebarOverlay
        .classList.remove(
          "hidden"
        );

    }
  );

  /* CLOSE MENU */
  mobileSidebarOverlay
    .addEventListener(
      "click",
      () => {

        sidebar.classList.remove(
          "active"
        );

        mobileSidebarOverlay
          .classList.add(
            "hidden"
          );

      }
    );

}

/* =========================
CHANGE EMAIL (SETTINGS)
========================= */

const settingsCurrentEmail =
  document.getElementById(
    "settingsCurrentEmail"
  );

const showChangeEmailBtn =
  document.getElementById(
    "showChangeEmailBtn"
  );

const changeEmailForm =
  document.getElementById(
    "changeEmailForm"
  );

const newEmailInput =
  document.getElementById(
    "newEmailInput"
  );

const sendEmailChangeBtn =
  document.getElementById(
    "sendEmailChangeBtn"
  );

const cancelEmailChangeBtn =
  document.getElementById(
    "cancelEmailChangeBtn"
  );

const emailChangeStatus =
  document.getElementById(
    "emailChangeStatus"
  );

// Show current email in settings
if (settingsCurrentEmail && vendor) {
  settingsCurrentEmail.textContent =
    vendor.email || "—";
}

// Toggle the change email form
if (showChangeEmailBtn && changeEmailForm) {

  showChangeEmailBtn.addEventListener(
    "click",
    () => {
      changeEmailForm.classList.toggle("active");
      if (emailChangeStatus) {
        emailChangeStatus.textContent = "";
      }
    }
  );

}

// Cancel button hides the form
if (cancelEmailChangeBtn && changeEmailForm) {

  cancelEmailChangeBtn.addEventListener(
    "click",
    () => {
      changeEmailForm.classList.remove("active");
      if (newEmailInput) newEmailInput.value = "";
      if (emailChangeStatus) emailChangeStatus.textContent = "";
    }
  );

}

// Send confirmation emails to both old and new address
if (sendEmailChangeBtn && newEmailInput) {

  sendEmailChangeBtn.addEventListener(
    "click",
    async () => {

      const newEmail = newEmailInput.value.trim();

      if (!newEmail) {
        if (emailChangeStatus) {
          emailChangeStatus.textContent =
            "Please enter a new email address.";
          emailChangeStatus.style.color = "#c0392b";
        }
        return;
      }

      // Basic email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        if (emailChangeStatus) {
          emailChangeStatus.textContent =
            "Please enter a valid email address.";
          emailChangeStatus.style.color = "#c0392b";
        }
        return;
      }

      // Block if same as current email
      if (newEmail === vendor.email) {
        if (emailChangeStatus) {
          emailChangeStatus.textContent =
            "This is already your current email address.";
          emailChangeStatus.style.color = "#c0392b";
        }
        return;
      }

      sendEmailChangeBtn.disabled = true;
      sendEmailChangeBtn.textContent = "Sending...";

      try {

        // Supabase sends confirmation to BOTH old and new email.
        // The change only takes effect when both are confirmed.
        const { error } =
          await supabase.auth.updateUser({
            email: newEmail
          });

        if (error) {
          throw error;
        }

        if (emailChangeStatus) {
          emailChangeStatus.textContent =
            `✓ Confirmation links have been sent to ${vendor.email} and ${newEmail}. ` +
            `You must click the confirmation link in BOTH emails to complete the change. ` +
            `Check your inbox and spam folder.`;
          emailChangeStatus.style.color = "#1a6b3a";
        }

        sendEmailChangeBtn.textContent =
          "Confirmation Sent";

      } catch (err) {

        console.error("Email change error:", err);

        if (emailChangeStatus) {
          emailChangeStatus.textContent =
            err.message ||
            "Unable to send confirmation. Please try again.";
          emailChangeStatus.style.color = "#c0392b";
        }

        sendEmailChangeBtn.disabled = false;
        sendEmailChangeBtn.textContent = "Send Confirmation";

      }

    }
  );

}

/* ========================= */
/* BUSINESS INSIGHTS */
/* ========================= */

const businessInsightsSidebarBtn =

document.getElementById(

"businessInsightsSidebarBtn"

);

if (

businessInsightsSidebarBtn

){

businessInsightsSidebarBtn.onclick =

function(){

window.location.href =

"insight.html";

};

}

});