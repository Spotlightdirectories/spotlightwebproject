document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "customer-login.html";
    return;
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!customer) {
    // Logged in, but no customer profile — likely a vendor-only
    // account that ended up here by mistake.
    window.location.href = "customer-login.html";
    return;
  }

  const nameEl = document.getElementById("cpName");
  const emailEl = document.getElementById("cpEmail");
  if (nameEl) nameEl.textContent = customer.name || "My Account";
  if (emailEl) emailEl.textContent = customer.email || "";

  // -------------------------------
  // AUTH BUTTON (navbar) — show as logged in
  // -------------------------------
  const authButton = document.getElementById("authButton");
  if (authButton) {
    authButton.innerHTML = `<button id="navLogoutBtn" class="nav-login-btn">Log out</button>`;
    document.getElementById("navLogoutBtn")?.addEventListener("click", logout);
  }

  // -------------------------------
  // VENDOR SWITCH — same auth_user_id might also have a vendor row
  // -------------------------------
  const { data: vendorRow } = await supabase
    .from("vendors")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (vendorRow) {
    document.getElementById("cpVendorSwitch")?.classList.remove("hidden");
  }

  // -------------------------------
  // FAVORITE VENDORS
  // -------------------------------
  const favoritesList = document.getElementById("cpFavoritesList");

  const { data: favorites, error: favError } = await supabase
    .from("customer_favorites")
    .select(`
      id,
      vendors (
        id, slug, name, logo_url, category, subcategory, average_rating, reviews_count
      )
    `)
    .eq("customer_id", customer.id);

  if (favError) {
    console.error("Favorites load error:", favError);
    if (favoritesList) favoritesList.innerHTML = `<p class="cp-empty">Couldn't load favorites right now.</p>`;
  } else if (!favorites || favorites.length === 0) {
    if (favoritesList) favoritesList.innerHTML = `<p class="cp-empty">No favorite vendors yet — browse Discover and tap the heart on a vendor's profile to save them here.</p>`;
  } else if (favoritesList) {
    favoritesList.innerHTML = "";
    favorites.forEach(fav => {
      const v = fav.vendors;
      if (!v) return;
      const card = document.createElement("a");
      card.href = `vendor-profile.html?slug=${encodeURIComponent(v.slug || "")}`;
      card.className = "cp-favorite-card";
      card.innerHTML = `
        <img src="${v.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.name)}&background=e6c200&color=000000&size=128`}" alt="${v.name}">
        <div>
          <strong>${v.name}</strong>
          <span>${v.subcategory || v.category || ""}</span>
          <span class="cp-favorite-rating"><i class="fa-solid fa-star"></i> ${Number(v.average_rating || 0).toFixed(1)} (${v.reviews_count || 0})</span>
        </div>
      `;
      favoritesList.appendChild(card);
    });
  }

  // -------------------------------
  // MY REVIEWS — matched by email (see honest caveat in the page
  // itself; a real customer_id link is item 55, not yet built)
  // -------------------------------
  const reviewsList = document.getElementById("cpReviewsList");

  if (customer.email) {
    const { data: reviews, error: reviewError } = await supabase
      .from("vendor_reviews")
      .select(`
        id, rating, review_text, created_at,
        vendors ( name, slug )
      `)
      .eq("reviewer_email", customer.email)
      .order("created_at", { ascending: false });

    if (reviewError) {
      console.error("Reviews load error:", reviewError);
      if (reviewsList) reviewsList.innerHTML = `<p class="cp-empty">Couldn't load reviews right now.</p>`;
    } else if (!reviews || reviews.length === 0) {
      if (reviewsList) reviewsList.innerHTML = `<p class="cp-empty">No reviews yet.</p>`;
    } else if (reviewsList) {
      reviewsList.innerHTML = "";
      reviews.forEach(r => {
        const row = document.createElement("div");
        row.className = "cp-review-row";
        row.innerHTML = `
          <div class="cp-review-top">
            <strong>${r.vendors?.name || "Vendor"}</strong>
            <span class="cp-review-stars">${"★".repeat(r.rating || 0)}${"☆".repeat(5 - (r.rating || 0))}</span>
          </div>
          <p>${(r.review_text || "").replace(/</g, "&lt;")}</p>
          <span class="cp-review-date">${new Date(r.created_at).toLocaleDateString()}</span>
        `;
        reviewsList.appendChild(row);
      });
    }
  }

  document.getElementById("cpLogoutBtn")?.addEventListener("click", logout);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "index.html";
  }

});
