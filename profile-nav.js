// -----------------------------------------------------------------
// PROFILE NAV — shared logic for the Profile icon on discover.html
// and discover-results.html (item 54).
//
// Behavior (matches Cyril's confirmed spec):
// - Logged out -> customer login/signup (this icon lives on
//   shopper-facing search pages, so logged-out defaults to customer,
//   not vendor).
// - Logged in as vendor only -> small menu: "Vendor Dashboard" +
//   "Set Up Customer Profile" (same email can hold both, no logout
//   needed to add the other).
// - Logged in as customer only -> straight to customer profile, no
//   menu needed, no ambiguity.
// - Logged in as both -> small menu: "Vendor Dashboard" + "Customer
//   Profile".
// -----------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  const profileBtn =
    document.getElementById("discoverProfileNav") ||
    document.getElementById("discoverResultsProfileNav");

  if (!profileBtn) return;

  const supabase = window.supabaseClient;

  function closeMenu() {
    document.getElementById("profileNavMenu")?.remove();
    document.removeEventListener("click", outsideClickHandler);
  }

  function outsideClickHandler(e) {
    const menu = document.getElementById("profileNavMenu");
    if (menu && !menu.contains(e.target) && e.target !== profileBtn && !profileBtn.contains(e.target)) {
      closeMenu();
    }
  }

  function showMenu(options) {
    closeMenu();

    const menu = document.createElement("div");
    menu.id = "profileNavMenu";
    menu.className = "profile-nav-menu";

    options.forEach(opt => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "profile-nav-menu-item";
      item.innerHTML = `<i class="${opt.icon}"></i> ${opt.label}`;
      item.addEventListener("click", () => {
        window.location.href = opt.href;
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    const rect = profileBtn.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.left = `${Math.max(12, rect.left - 60)}px`;
    menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;

    setTimeout(() => document.addEventListener("click", outsideClickHandler), 0);
  }

  profileBtn.addEventListener("click", async () => {

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "customer-login.html";
      return;
    }

    const userId = session.user.id;

    const [{ data: vendorRow }, { data: customerRow }] = await Promise.all([
      supabase.from("vendors").select("id").eq("auth_user_id", userId).maybeSingle(),
      supabase.from("customers").select("id").eq("auth_user_id", userId).maybeSingle()
    ]);

    const hasVendor = !!vendorRow;
    const hasCustomer = !!customerRow;

    if (hasCustomer && !hasVendor) {
      window.location.href = "customer-profile.html";
      return;
    }

    if (hasVendor && !hasCustomer) {
      showMenu([
        { label: "Vendor Dashboard", href: "vendordashboard.html", icon: "fa-solid fa-store" },
        { label: "Set Up Customer Profile", href: "customer-signup.html", icon: "fa-regular fa-user" }
      ]);
      return;
    }

    if (hasVendor && hasCustomer) {
      showMenu([
        { label: "Vendor Dashboard", href: "vendordashboard.html", icon: "fa-solid fa-store" },
        { label: "Customer Profile", href: "customer-profile.html", icon: "fa-regular fa-user" }
      ]);
      return;
    }

    // Neither profile exists yet despite having a session — safety
    // net, shouldn't normally happen since signup always creates one.
    window.location.href = "customer-login.html";

  });

});
