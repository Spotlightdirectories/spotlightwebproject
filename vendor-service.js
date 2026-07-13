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
  const serviceSlug = params.get("slug");

  if (!serviceSlug) return;

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
    .eq("slug", serviceSlug)
    .single();

  if (error) {
    console.error("Service load error:", error.message);
    return;
  }

  try {
    await supabase.from("analytics_events").insert({
      vendor_id: data.vendor_id,
      service_id: data.id,
      event_type: "service_view",
      visitor_id: window.visitorId
    });
  } catch (err) {
    console.error("Service analytics error:", err);
  }

  const imageEl = document.getElementById("productImage");
  const titleEl = document.getElementById("productTitle");
  const priceEl = document.getElementById("productPrice");
  const descEl = document.getElementById("productDescription");

  const contactBtn = document.getElementById("contactVendorBtn");
  const callBtn = document.getElementById("callVendorBtn");
  const backLink = document.getElementById("backToVendor");
  const secondaryImageEl = document.getElementById("secondaryProductImage");

  const vsContainer = document.querySelector(".vs-container");
  const hasRepresentativeImage = !!data.representative_image_url;

  if (!hasRepresentativeImage && !data.secondary_image_url && vsContainer) {
    vsContainer.classList.add("no-image");
  }

  // -----------------------------
  // IMAGE — sourced from vendor dashboard uploads
  // (representative_image_url, falling back to secondary),
  // with a real fallback if a stored URL ever fails to load.
  // -----------------------------
  if (imageEl) {

    const mainImageUrl = data.representative_image_url || data.secondary_image_url || "";

    if (mainImageUrl) {
      imageEl.src = mainImageUrl;
      imageEl.onload = function () {
        this.classList.add("loaded");
      };
      imageEl.onerror = function () {
        this.onerror = null;
        this.src = "images/placeholder.png";
      };
    } else if (imageEl.closest(".vs-media")) {
      imageEl.closest(".vs-media").style.display = "none";
    }

  }

  if (secondaryImageEl && data.secondary_image_url && data.representative_image_url) {
    // Only show the secondary thumbnail when it's genuinely a second
    // image — if there's no representative image, the secondary one
    // is already being used as the main image above.
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

  if (titleEl) {
    titleEl.textContent = data.service_name || "";
  }

  if (priceEl) {
    if (data.starting_price) {
      priceEl.innerHTML = `Starting From <span>₦${Number(data.starting_price).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}</span>`;
    } else {
      priceEl.style.display = "none";
    }
  }

  // -----------------------------
  // DESCRIPTION — expandable Read More/Less, unchanged logic
  // -----------------------------
  const rawDescription = data.short_description || "";

  if (descEl) {

    const lines = rawDescription.split("\n").map(line => line.trim()).filter(Boolean);

    if (!lines.length) {
      descEl.innerHTML = "";
    } else {

      const intro = lines.shift();
      let expanded = false;

      const renderDescription = () => {

        let html = `<p>${intro}</p>`;

        const displayLines = hasRepresentativeImage && !expanded ? lines.slice(0, 2) : lines;

        if (displayLines.length) {
          html += "<ul>";
          displayLines.forEach(line => { html += `<li>${line}</li>`; });
          html += "</ul>";
        }

        descEl.innerHTML = html;

        if (hasRepresentativeImage && lines.length > 2) {
          const toggle = document.createElement("a");
          toggle.href = "#";
          toggle.textContent = expanded ? " Read Less" : " Read More";
          toggle.onclick = function (e) {
            e.preventDefault();
            expanded = !expanded;
            renderDescription();
          };
          descEl.appendChild(toggle);
        }

      };

      renderDescription();

    }

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
  function renderServiceCard(service) {

    const hasImage = !!service.representative_image_url;

    const card = document.createElement("div");
    card.className = hasImage ? "discover-results-service-card" : "discover-results-service-card no-image";

    card.innerHTML = `
      ${
        hasImage
          ? `<img src="${service.representative_image_url}" class="discover-results-product-image" alt="${service.service_name}"
                  onerror="this.onerror=null;this.src='images/placeholder.png';">`
          : ""
      }
      <div>
        <h3 class="discover-results-product-title">${service.service_name}</h3>
        ${
          service.starting_price
            ? `<p class="discover-results-product-price">Starting From <span>₦${Number(service.starting_price).toLocaleString()}</span></p>`
            : ""
        }
        <div class="discover-results-product-vendor">
          <span>By ${service.vendorName || ""}</span>
          ${
            service.vendorVerification === "blue"
              ? `<img src="images/bluebadge.png" class="discover-results-product-badge">`
              : service.vendorVerification === "gray"
                ? `<img src="images/graybadge.png" class="discover-results-product-badge">`
                : ""
          }
        </div>
        <div class="discover-results-product-rating">
          <i class="fa-solid fa-star"></i>
          <span>${Number(service.vendorRating || 0).toFixed(1)}</span>
          <small>(${service.vendorReviews || 0})</small>
        </div>
        ${service.sponsored ? `<p class="discover-results-product-sponsored">Sponsored</p>` : ""}
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `vendor-service.html?slug=${service.slug}`;
    });

    return card;
  }

  // -----------------------------
  // MORE SERVICES FROM THIS VENDOR
  // Already correctly scoped server-side — unchanged.
  // -----------------------------
  const moreProductsGrid = document.getElementById("moreProductsGrid");

  if (moreProductsGrid && data.vendor_id) {

    const { data: moreServices, error: moreServicesError } = await supabase
      .from("vendor_services")
      .select(`
        slug, service_name, starting_price, representative_image_url, vendor_id,
        vendors(name, verification_status, average_rating, reviews_count, is_sponsored)
      `)
      .eq("vendor_id", data.vendor_id)
      .neq("slug", data.slug);

    const moreServicesSection = document.querySelector(".vs-more-section");

    if (moreServicesError) {
      console.error("More services error:", moreServicesError.message);
    }

    if (!moreServices?.length) {
      if (moreServicesSection) moreServicesSection.style.display = "none";
    } else {
      if (moreServicesSection) moreServicesSection.style.display = "";
      moreServices.forEach(service => {
        moreProductsGrid.appendChild(renderServiceCard({
          slug: service.slug,
          service_name: service.service_name,
          starting_price: service.starting_price,
          representative_image_url: service.representative_image_url,
          vendorName: service.vendors?.name,
          vendorVerification: service.vendors?.verification_status,
          vendorRating: service.vendors?.average_rating,
          vendorReviews: service.vendors?.reviews_count,
          sponsored: service.vendors?.is_sponsored
        }));
      });
    }

  }

  // -----------------------------
  // SHARE
  // Fixed: previously referenced data.product_name (always
  // undefined on this page — this is a service), which produced
  // a blank share title. Now correctly uses data.service_name.
  // -----------------------------
  const shareBtn = document.getElementById("shareProductBtn");

  if (shareBtn) {
    shareBtn.onclick = async () => {
      const shareData = {
        title: data.service_name,
        text: `Check out ${data.service_name} on Spotlight Directories.`,
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {}
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Service link copied to clipboard.");
      }
    };
  }

  // -----------------------------
  // SIMILAR SERVICES FROM OTHER VENDORS
  // Now uses the get_similar_services RPC — real server-side
  // filtering and ranking, instead of fetching every service in
  // the database and filtering in the browser. The old code also
  // had a completely empty, do-nothing forEach loop here — removed.
  // Now has real error handling before using the result.
  // -----------------------------
  const similarProductsGrid = document.getElementById("similarProductsGrid");

  if (similarProductsGrid && data.vendor_id) {

    const { data: similarServices, error: similarError } = await supabase.rpc(
      "get_similar_services",
      {
        p_exclude_vendor_id: data.vendor_id,
        p_exclude_service_id: data.id,
        p_target_subcategory: data.vendors?.subcategory || null,
        p_target_category: data.vendors?.category || null,
        p_limit: 12
      }
    );

    const similarServicesSection = document.querySelector(".vs-similar-section");

    if (similarError) {
      console.error("Similar services error:", similarError.message);
    }

    if (!similarServices?.length) {
      if (similarServicesSection) similarServicesSection.style.display = "none";
    } else {
      if (similarServicesSection) similarServicesSection.style.display = "";
      similarServices.forEach(service => {
        similarProductsGrid.appendChild(renderServiceCard({
          slug: service.slug,
          service_name: service.service_name,
          starting_price: service.starting_price,
          representative_image_url: service.representative_image_url,
          vendorName: service.vendor_name,
          vendorVerification: service.vendor_verification_status,
          vendorRating: service.vendor_average_rating,
          vendorReviews: service.vendor_reviews_count,
          sponsored: service.vendor_is_sponsored
        }));
      });
    }

  }

});
