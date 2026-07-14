document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;

  // -----------------------------
  // NAVBAR (mobile menu + auth button, same pattern as other pages)
  // -----------------------------
  const menuOpenBtn = document.querySelector(".menu-open");
  const menuCloseBtn = document.querySelector(".xclose");
  const navLinks = document.querySelector(".nav-links");

  if (menuOpenBtn && navLinks) {
    menuOpenBtn.addEventListener("click", () => navLinks.classList.add("open"));
  }
  if (menuCloseBtn && navLinks) {
    menuCloseBtn.addEventListener("click", () => navLinks.classList.remove("open"));
  }

  const authBtn = document.getElementById("authBtn");
  if (authBtn && supabase) {
    function updateAuthBtn(user) {
      authBtn.textContent = user ? "Log out" : "Log in";
      authBtn.href = user ? "#" : "login";
    }
    supabase.auth.onAuthStateChange((event, session) => updateAuthBtn(session?.user || null));
    supabase.auth.getSession().then(({ data: { session } }) => updateAuthBtn(session?.user || null));
    authBtn.addEventListener("click", async (e) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.reload();
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  const productSlug = params.get("slug");

  if (!productSlug) return;

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
        category,
        verification_status,
        average_rating,
        reviews_count,
        is_sponsored
      )
    `)
    .eq("slug", productSlug)
    .single();

  if (error) {
    console.error("Product load error:", error.message);
    return;
  }

  try {
    await window.logAnalyticsEvent(supabase, {
      vendor_id: data.vendor_id,
      product_id: data.id,
      event_type: "product_view",
      visitor_id: window.visitorId
    });
  } catch (err) {
    console.error("Product analytics error:", err);
  }

  const imageEl = document.getElementById("productImage");
  const titleEl = document.getElementById("productTitle");
  const priceEl = document.getElementById("productPrice");
  const descEl = document.getElementById("productDescription");

  const contactBtn = document.getElementById("contactVendorBtn");
  const callBtn = document.getElementById("callVendorBtn");
  const backLink = document.getElementById("backToVendor");
  const secondaryImageEl = document.getElementById("secondaryProductImage");
  const tertiaryImageEl = document.getElementById("tertiaryProductImage");

  // -----------------------------
  // IMAGES — sourced from vendor dashboard uploads
  // (primary/secondary/tertiary_image_url), with a real
  // fallback if a stored URL ever fails to load.
  // -----------------------------
  if (imageEl) {
    imageEl.src = data.primary_image_url || "images/placeholder.png";
    imageEl.onload = function () {
      this.classList.add("loaded");
    };
    imageEl.onerror = function () {
      this.onerror = null;
      this.src = "images/placeholder.png";
    };
  }

  if (secondaryImageEl && data.secondary_image_url) {
    secondaryImageEl.src = data.secondary_image_url;
    secondaryImageEl.classList.remove("hidden");
    secondaryImageEl.onclick = () => {
      const current = imageEl.src;
      imageEl.src = secondaryImageEl.src;
      secondaryImageEl.src = current;
    };
  } else if (secondaryImageEl) {
    secondaryImageEl.remove();
  }

  if (tertiaryImageEl && data.tertiary_image_url) {
    tertiaryImageEl.src = data.tertiary_image_url;
    tertiaryImageEl.classList.remove("hidden");
    tertiaryImageEl.onclick = () => {
      const current = imageEl.src;
      imageEl.src = tertiaryImageEl.src;
      tertiaryImageEl.src = current;
    };
  } else if (tertiaryImageEl) {
    tertiaryImageEl.remove();
  }

  if (titleEl) {
    titleEl.textContent = data.product_name || "";
  }

  const rawDescription = data.short_description || "";
  const rawKeyDetails = data.key_details || "";

  const keyDetailsContainer = document.getElementById("productKeyDetails");
  const keyDetailsList = document.getElementById("keyDetailsList");

  if (rawKeyDetails && keyDetailsContainer && keyDetailsList) {
    const lines = rawKeyDetails.split("\n").map(l => l.trim()).filter(Boolean);
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

  if (descEl) {
    descEl.textContent = rawDescription;
  }

  if (priceEl && data.price) {
    priceEl.textContent = "₦ " + Number(data.price).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  const vendorMeta = document.getElementById("productVendorMeta");

  if (vendorMeta) {
    vendorMeta.innerHTML = `
      <div class="discover-results-product-vendor">
        <span>By ${data.vendors?.name || ""}</span>
        ${
          data.vendors?.verification_status === "blue"
            ? `<img src="images/bluebadge.png" class="discover-results-product-badge">`
            : data.vendors?.verification_status === "gray"
              ? `<img src="images/graybadge.png" class="discover-results-product-badge">`
              : ""
        }
      </div>
      <div class="discover-results-product-rating">
        <i class="fa-solid fa-star"></i>
        <span>${Number(data.vendors?.average_rating || 0).toFixed(1)}</span>
        <small>(${data.vendors?.reviews_count || 0})</small>
      </div>
      ${data.vendors?.is_sponsored ? `<p class="discover-results-product-sponsored">Sponsored</p>` : ""}
    `;
  }

  if (contactBtn) {
    const whatsapp = data.vendors?.whatsapp;
    if (whatsapp) {
      contactBtn.href = `https://wa.me/${whatsapp}`;
    } else {
      contactBtn.style.display = "none";
    }
  }

  if (callBtn) {
    const telephone = data.vendors?.telephone;
    if (telephone) {
      callBtn.href = `tel:${telephone}`;
    } else {
      callBtn.style.display = "none";
    }
  }

  if (backLink && data.vendors?.slug) {
    backLink.href = `vendor-profile.html?slug=${data.vendors.slug}`;
  }

  // -----------------------------
  // CARD RENDERER — shared by both "More" and "Similar" grids
  // -----------------------------
  function renderProductCard(product) {
    const card = document.createElement("div");
    card.className = "discover-results-product-card";

    card.innerHTML = `
      <img src="${product.primary_image_url || product.image || "images/placeholder.png"}"
           class="discover-results-product-image" alt="${product.product_name}"
           onerror="this.onerror=null;this.src='images/placeholder.png';">
      <h3 class="discover-results-product-title">${product.product_name}</h3>
      <p class="discover-results-product-price">₦${Number(product.price || 0).toLocaleString()}</p>
      <div class="discover-results-product-vendor">
        <span>By ${product.vendorName || product.vendors?.name || ""}</span>
        ${
          (product.vendorVerification || product.vendors?.verification_status) === "blue"
            ? `<img src="images/bluebadge.png" class="discover-results-product-badge">`
            : (product.vendorVerification || product.vendors?.verification_status) === "gray"
              ? `<img src="images/graybadge.png" class="discover-results-product-badge">`
              : ""
        }
      </div>
      <div class="discover-results-product-rating">
        <i class="fa-solid fa-star"></i>
        <span>${Number(product.vendorRating ?? product.vendors?.average_rating ?? 0).toFixed(1)}</span>
        <small>(${product.vendorReviews ?? product.vendors?.reviews_count ?? 0})</small>
      </div>
      ${
        (product.sponsored ?? product.vendors?.is_sponsored)
          ? `<p class="discover-results-product-sponsored">Sponsored</p>`
          : ""
      }
    `;

    card.addEventListener("click", () => {
      window.location.href = `vendor-product.html?slug=${product.slug}`;
    });

    return card;
  }

  // -----------------------------
  // MORE PRODUCTS FROM THIS VENDOR
  // Already correctly scoped server-side — unchanged.
  // -----------------------------
  const moreProductsGrid = document.getElementById("moreProductsGrid");

  if (moreProductsGrid && data.vendor_id) {

    const { data: moreProducts, error: moreProductsError } = await supabase
      .from("vendor_products")
      .select(`
        slug, product_name, price, primary_image_url, vendor_id,
        vendors(name, verification_status, average_rating, reviews_count, is_sponsored)
      `)
      .eq("vendor_id", data.vendor_id)
      .neq("id", data.id)
      .order("display_order", { ascending: true });

    const moreProductsSection = document.querySelector(".vp-more-section");

    if (moreProductsError) {
      console.error("More products error:", moreProductsError.message);
    }

    if (!moreProducts?.length) {
      if (moreProductsSection) moreProductsSection.style.display = "none";
    } else {
      if (moreProductsSection) moreProductsSection.style.display = "";
      moreProducts.forEach(product => {
        moreProductsGrid.appendChild(renderProductCard(product));
      });
    }

  }

  // -----------------------------
  // SHARE
  // -----------------------------
  const shareBtn = document.getElementById("shareProductBtn");

  if (shareBtn) {
    shareBtn.onclick = async () => {
      const shareData = {
        title: data.product_name,
        text: `Check out ${data.product_name} on Spotlight Directories.`,
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {}
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Product link copied to clipboard.");
      }
    };
  }

  // -----------------------------
  // SIMILAR PRODUCTS FROM OTHER VENDORS
  // Now uses the get_similar_products RPC — real server-side
  // filtering and ranking, instead of fetching every product in
  // the database and filtering in the browser. Also now has real
  // error handling before using the result.
  // -----------------------------
  const similarProductsGrid = document.getElementById("similarProductsGrid");

  if (similarProductsGrid && data.vendor_id) {

    const { data: similarProducts, error: similarError } = await supabase.rpc(
      "get_similar_products",
      {
        p_exclude_vendor_id: data.vendor_id,
        p_exclude_product_id: data.id,
        p_target_subcategory: data.vendors?.subcategory || null,
        p_target_category: data.vendors?.category || null,
        p_limit: 12
      }
    );

    const similarProductsSection = document.querySelector(".vp-similar-section");

    if (similarError) {
      console.error("Similar products error:", similarError.message);
    }

    if (!similarProducts?.length) {
      if (similarProductsSection) similarProductsSection.style.display = "none";
    } else {
      if (similarProductsSection) similarProductsSection.style.display = "";
      similarProducts.forEach(product => {
        similarProductsGrid.appendChild(renderProductCard({
          slug: product.slug,
          product_name: product.product_name,
          price: product.price,
          primary_image_url: product.primary_image_url,
          vendorName: product.vendor_name,
          vendorVerification: product.vendor_verification_status,
          vendorRating: product.vendor_average_rating,
          vendorReviews: product.vendor_reviews_count,
          sponsored: product.vendor_is_sponsored
        }));
      });
    }

  }

});
