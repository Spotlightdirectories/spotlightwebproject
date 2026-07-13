document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;

  // -----------------------------
  // NAVBAR (same pattern as other pages)
  // -----------------------------
  const menuOpenBtn = document.querySelector(".menu-open");
  const menuCloseBtn = document.querySelector(".xclose");
  const navLinks = document.querySelector(".nav-links");
  if (menuOpenBtn && navLinks) menuOpenBtn.addEventListener("click", () => navLinks.classList.add("open"));
  if (menuCloseBtn && navLinks) menuCloseBtn.addEventListener("click", () => navLinks.classList.remove("open"));

  const authBtn = document.getElementById("authBtn");
  if (authBtn && supabase) {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { authBtn.textContent = "Log out"; authBtn.href = "#"; }
    });
    authBtn.addEventListener("click", async (e) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.reload();
      }
    });
  }

  // -----------------------------
  // APPROVED PRICING (from the pricing workbook Cyril approved)
  // -----------------------------
  const PRODUCT_SERVICE_TIERS = [
    { tier: "standard", items: 1,  monthly: 2000 },
    { tier: "silver",   items: 3,  monthly: 5000 },
    { tier: "gold",     items: 5,  monthly: 8000 },
    { tier: "platinum", items: 8,  monthly: 12000 },
    { tier: "diamond",  items: 12, monthly: 16000 }
  ];

  const BUSINESS_TIERS_STANDARD_PLAN = [
    { tier: "standard", monthly: 3000 },
    { tier: "silver",   monthly: 6000 },
    { tier: "gold",     monthly: 10000 },
    { tier: "platinum", monthly: 15000 },
    { tier: "diamond",  monthly: 20000 }
  ];

  const PLAN_MULTIPLIER = { standard: 1, enterprise: 1.5, elite: 2 };

  // Matches the exact catalog limits in vendordashboard.js — a
  // sponsorship tier covering more items than the vendor's plan
  // even allows would always be partially wasted money.
  const CATALOG_LIMITS = { free: 1, standard: 6, enterprise: 12, elite: 24, custom: Infinity };

  const TIER_LABELS = {
    standard: "Standard", silver: "Silver", gold: "Gold",
    platinum: "Platinum", diamond: "Diamond"
  };

  function yearlyOf(monthly) {
    return monthly * 9;
  }

  // -----------------------------
  // STATE
  // -----------------------------
  let vendor = null;
  let vendorProducts = [];
  let vendorServices = [];
  let selectedType = null; // 'business' | 'product' | 'service'
  let selectedCycle = "monthly";
  let selectedTier = null;
  let selectedItemIds = [];

  // -----------------------------
  // AUTH + VENDOR
  // -----------------------------
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.replace("login");
    return;
  }

  const { data: vendorRow } = await supabase
    .from("vendors")
    .select("id, name, plan_tier, subscription_status, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!vendorRow) {
    window.location.replace("vendordashboard");
    return;
  }

  vendor = vendorRow;

  document.getElementById("gsLoadingState").classList.add("hidden");

  // Sponsorship isn't available on Free plan — matches how other
  // premium features (video upload, etc.) are already gated.
  if (!vendor.plan_tier || vendor.plan_tier === "free") {
    document.getElementById("gsEmptyState").classList.remove("hidden");
    return;
  }

  const { data: products } = await supabase
    .from("vendor_products")
    .select("id, slug, product_name, primary_image_url")
    .eq("vendor_id", vendor.id);

  const { data: services } = await supabase
    .from("vendor_services")
    .select("id, slug, service_name, representative_image_url")
    .eq("vendor_id", vendor.id);

  vendorProducts = products || [];
  vendorServices = services || [];

  await loadCurrentSponsorships();

  document.getElementById("gsMainContent").classList.remove("hidden");

  // -----------------------------
  // RENDER TYPE TABS — only for what this vendor actually sells
  // -----------------------------
  const tabsContainer = document.getElementById("gsTypeTabs");
  const availableTypes = [];

  availableTypes.push({ type: "business", label: "Business" });
  if (vendorProducts.length > 0) availableTypes.push({ type: "product", label: "Products" });
  if (vendorServices.length > 0) availableTypes.push({ type: "service", label: "Services" });

  tabsContainer.innerHTML = availableTypes.map((t, i) => `
    <button type="button" class="gs-type-tab ${i === 0 ? "active" : ""}" data-type="${t.type}">${t.label}</button>
  `).join("");

  selectedType = availableTypes[0].type;

  tabsContainer.querySelectorAll(".gs-type-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      tabsContainer.querySelectorAll(".gs-type-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedType = btn.dataset.type;
      selectedTier = null;
      selectedItemIds = [];
      renderTierGrid();
      updateBusinessNote();
      hideItemPickerAndSummary();
    });
  });

  // -----------------------------
  // BILLING TOGGLE
  // -----------------------------
  document.querySelectorAll(".gs-billing-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".gs-billing-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedCycle = btn.dataset.cycle;
      renderTierGrid();
      if (selectedTier) updateCheckoutSummary();
    });
  });

  // -----------------------------
  // CURRENT SPONSORSHIPS SUMMARY
  // So a vendor clicking "Manage Sponsorship" sees what's already
  // active before deciding what to buy next.
  // -----------------------------
  async function loadCurrentSponsorships() {

    const { data: activeSponsorships } = await supabase
      .from("vendor_sponsorships")
      .select("sponsorship_type, target_id, tier, billing_cycle, expires_at")
      .eq("vendor_id", vendor.id)
      .eq("payment_status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false });

    if (!activeSponsorships || activeSponsorships.length === 0) return;

    const container = document.getElementById("gsCurrentSponsorships");
    const list = document.getElementById("gsCurrentSponsorshipsList");

    list.innerHTML = activeSponsorships.map(s => {

      let targetLabel;

      if (s.sponsorship_type === "business") {
        targetLabel = "Your whole business";
      } else {
        const items = s.sponsorship_type === "product" ? vendorProducts : vendorServices;
        const item = items.find(i => i.id === s.target_id);
        targetLabel = item ? (s.sponsorship_type === "product" ? item.product_name : item.service_name) : "(item no longer available)";
      }

      const expiryDate = new Date(s.expires_at).toLocaleDateString();

      return `
        <div class="gs-current-item">
          <div>
            <strong>${TIER_LABELS[s.tier]} ${s.sponsorship_type}</strong>
            <span> — ${targetLabel}</span>
          </div>
          <div>
            <span>Until ${expiryDate}</span>
            <span class="gs-current-badge">Active</span>
          </div>
        </div>
      `;

    }).join("");

    container.classList.remove("hidden");

  }

  // -----------------------------
  // BUSINESS NOTE
  // -----------------------------
  function updateBusinessNote() {
    const note = document.getElementById("gsBusinessNote");
    const noteText = document.getElementById("gsBusinessNoteText");
    if (selectedType === "business") {
      note.classList.remove("hidden");
      noteText.textContent = `Business sponsorship pricing is scaled to your ${vendor.plan_tier} subscription plan, and automatically covers your vendor card and every product/service you sell.`;
    } else {
      note.classList.add("hidden");
    }
  }

  // -----------------------------
  // TIER PRICING FOR CURRENT TYPE
  // -----------------------------
  function getTierPrice(tierConfig) {
    let monthly = tierConfig.monthly;
    if (selectedType === "business") {
      const multiplier = PLAN_MULTIPLIER[vendor.plan_tier] || 1;
      monthly = monthly * multiplier;
    }
    return selectedCycle === "monthly" ? monthly : yearlyOf(monthly);
  }

  // -----------------------------
  // RENDER TIER GRID
  // -----------------------------
  function renderTierGrid() {
    const grid = document.getElementById("gsTierGrid");
    const tiers = selectedType === "business" ? BUSINESS_TIERS_STANDARD_PLAN : PRODUCT_SERVICE_TIERS;

    // A tier covering more items than the vendor's plan even allows
    // is locked, with an upgrade prompt — doesn't apply to Business
    // sponsorship, which isn't tied to an item count.
    const catalogLimit = CATALOG_LIMITS[vendor.plan_tier] ?? 0;

    grid.innerHTML = tiers.map(t => {
      const price = getTierPrice(t);
      const isLocked = selectedType !== "business" && t.items > catalogLimit;

      return `
        <div class="gs-tier-card ${selectedTier === t.tier ? "selected" : ""} ${isLocked ? "locked" : ""}" data-tier="${t.tier}" data-locked="${isLocked}">
          <div class="gs-tier-name">${TIER_LABELS[t.tier]}</div>
          ${t.items ? `<div class="gs-tier-items">${t.items} item${t.items > 1 ? "s" : ""}</div>` : `<div class="gs-tier-items">Whole business</div>`}
          <div class="gs-tier-price">\u20a6${price.toLocaleString()}<br><small>/${selectedCycle === "monthly" ? "mo" : "yr"}</small></div>
          ${isLocked ? `<div class="gs-tier-lock-note">Needs a bigger catalog — <a href="getlisted.html">Upgrade Plan</a></div>` : ""}
        </div>
      `;
    }).join("");

    grid.querySelectorAll(".gs-tier-card").forEach(card => {
      card.addEventListener("click", (e) => {

        if (card.dataset.locked === "true") {
          if (e.target.tagName !== "A") {
            alert(`Your current plan (${vendor.plan_tier}) only supports up to ${catalogLimit} products/services, so this tier's slots couldn't all be used. Upgrade your plan to unlock it.`);
          }
          return;
        }

        selectedTier = card.dataset.tier;
        selectedItemIds = [];
        renderTierGrid();
        if (selectedType === "business") {
          hideItemPicker();
          updateCheckoutSummary();
        } else {
          renderItemPicker();
        }
      });
    });
  }

  // -----------------------------
  // ITEM PICKER (products/services)
  // -----------------------------
  function renderItemPicker() {
    const picker = document.getElementById("gsItemPicker");
    const list = document.getElementById("gsItemList");
    const title = document.getElementById("gsItemPickerTitle");
    const note = document.getElementById("gsItemPickerNote");

    const tierConfig = PRODUCT_SERVICE_TIERS.find(t => t.tier === selectedTier);
    const maxItems = tierConfig.items;
    const items = selectedType === "product" ? vendorProducts : vendorServices;

    title.textContent = `Select up to ${maxItems} ${selectedType}${maxItems > 1 ? "s" : ""} to sponsor`;
    note.textContent = `You picked the ${TIER_LABELS[selectedTier]} tier, which covers ${maxItems} item${maxItems > 1 ? "s" : ""}.`;

    list.innerHTML = items.map(item => {
      const name = selectedType === "product" ? item.product_name : item.service_name;
      const image = selectedType === "product" ? item.primary_image_url : item.representative_image_url;
      return `
        <label class="gs-item-row" data-id="${item.id}">
          <input type="checkbox" value="${item.id}">
          <img src="${image || "images/placeholder.png"}" alt="${name}">
          <span>${name}</span>
        </label>
      `;
    }).join("");

    picker.classList.remove("hidden");

    list.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        const checkedBoxes = list.querySelectorAll("input[type=checkbox]:checked");

        if (checkedBoxes.length > maxItems) {
          cb.checked = false;
          alert(`This tier covers a maximum of ${maxItems} item${maxItems > 1 ? "s" : ""}.`);
          return;
        }

        selectedItemIds = Array.from(checkedBoxes).map(b => b.value);
        updateCheckoutSummary();
      });
    });
  }

  function hideItemPicker() {
    document.getElementById("gsItemPicker").classList.add("hidden");
  }

  function hideItemPickerAndSummary() {
    hideItemPicker();
    document.getElementById("gsCheckoutSummary").classList.add("hidden");
    document.getElementById("gsBankSection").classList.add("hidden");
  }

  // -----------------------------
  // CHECKOUT SUMMARY
  // -----------------------------
  function updateCheckoutSummary() {
    const summary = document.getElementById("gsCheckoutSummary");

    if (selectedType !== "business" && selectedItemIds.length === 0) {
      summary.classList.add("hidden");
      return;
    }

    const tierConfig = (selectedType === "business" ? BUSINESS_TIERS_STANDARD_PLAN : PRODUCT_SERVICE_TIERS)
      .find(t => t.tier === selectedTier);

    const unitPrice = getTierPrice(tierConfig);

    let targetLabel;
    if (selectedType === "business") {
      targetLabel = `Your business (${vendor.name})`;
    } else {
      const items = selectedType === "product" ? vendorProducts : vendorServices;
      const names = selectedItemIds.map(id => {
        const item = items.find(i => i.id === id);
        return selectedType === "product" ? item?.product_name : item?.service_name;
      });
      targetLabel = names.join(", ");
    }

    document.getElementById("gsSummaryTarget").textContent = targetLabel;
    document.getElementById("gsSummaryTier").textContent = `${TIER_LABELS[selectedTier]} (${selectedCycle === "monthly" ? "Monthly" : "Yearly"})`;
    document.getElementById("gsSummaryTotal").textContent = `\u20a6${unitPrice.toLocaleString()}`;

    summary.classList.remove("hidden");
  }

  // -----------------------------
  // CREATE PENDING SPONSORSHIP ROW(S)
  // Business = 1 row. Product/Service = 1 row per selected item.
  // -----------------------------
  async function createPendingSponsorships(paymentMethod) {

    const tierConfig = (selectedType === "business" ? BUSINESS_TIERS_STANDARD_PLAN : PRODUCT_SERVICE_TIERS)
      .find(t => t.tier === selectedTier);

    const unitPrice = getTierPrice(tierConfig);

    const targetIds = selectedType === "business" ? [null] : selectedItemIds;

    // Each row records the same total price paid for the whole
    // purchase — the total charged is unitPrice regardless of how
    // many items it covers (bundle pricing, not per-item
    // multiplication), so every row in this batch shares that value.
    const rows = targetIds.map(targetId => ({
      vendor_id: vendor.id,
      sponsorship_type: selectedType,
      target_id: targetId,
      tier: selectedTier,
      billing_cycle: selectedCycle,
      amount_paid: unitPrice,
      payment_method: paymentMethod,
      payment_status: "pending"
    }));

    const { data, error } = await supabase
      .from("vendor_sponsorships")
      .insert(rows)
      .select("id");

    if (error || !data) {
      throw new Error(error?.message || "Could not create sponsorship record.");
    }

    return data.map(r => r.id);
  }

  // -----------------------------
  // PAY ONLINE (Paystack)
  // -----------------------------
  document.getElementById("gsPayOnlineBtn").addEventListener("click", async () => {

    const tierConfig = (selectedType === "business" ? BUSINESS_TIERS_STANDARD_PLAN : PRODUCT_SERVICE_TIERS)
      .find(t => t.tier === selectedTier);
    const unitPrice = getTierPrice(tierConfig);

    let sponsorshipIds;

    try {
      sponsorshipIds = await createPendingSponsorships("paystack");
    } catch (err) {
      alert(err.message);
      return;
    }

    const reference = `SPONSOR_${Date.now()}`;

    const handler = PaystackPop.setup({
      key: "pk_test_3dc48990c568ef43d2b42a9571cde21b9175d699",
      email: vendor.email || user.email,
      amount: unitPrice * 100,
      currency: "NGN",
      ref: reference,
      metadata: { auth_user_id: user.id },

      callback: function (response) {
        verifySponsorshipPayment(response.reference, sponsorshipIds);
      },

      onClose: function () {
        alert("Payment window closed. If payment was completed, your sponsorship will activate automatically after verification.");
      }
    });

    handler.openIframe();
  });

  async function verifySponsorshipPayment(reference, sponsorshipIds) {
    try {
      const { data, error } = await supabase.functions.invoke("verify-paystack-sponsorship", {
        body: { reference, sponsorship_ids: sponsorshipIds, auth_user_id: user.id }
      });

      if (error) {
        alert("We couldn't confirm your payment right away. If money was deducted, your sponsorship will activate automatically within a few minutes.");
        window.location.replace("vendordashboard");
        return;
      }

      showSponsorshipSuccessScreen();

    } catch (err) {
      console.error("Sponsorship verification error:", err);
      alert("Verification failed. Please contact support if you were charged.");
    }
  }

  function showSponsorshipSuccessScreen() {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#f9fafb;">
        <div style="background:white;padding:40px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.08);text-align:center;max-width:420px;">
          <h2 style="margin-bottom:15px;color:#16a34a;">\u2714 Sponsorship Activated</h2>
          <p style="margin-bottom:20px;color:#555;">Redirecting you to your dashboard...</p>
        </div>
      </div>
    `;
    setTimeout(() => { window.location.replace("vendordashboard"); }, 2500);
  }

  // -----------------------------
  // PAY BY BANK TRANSFER
  // -----------------------------
  document.getElementById("gsPayBankBtn").addEventListener("click", () => {
    document.getElementById("gsBankSection").classList.remove("hidden");
  });

  document.getElementById("gsSubmitReceiptBtn").addEventListener("click", async () => {

    const btn = document.getElementById("gsSubmitReceiptBtn");
    const fileInput = document.getElementById("gsReceiptFile");
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select a receipt file.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Uploading...";

    let sponsorshipIds;

    try {
      sponsorshipIds = await createPendingSponsorships("bank_transfer");
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = "Submit Receipt";
      return;
    }

    let uploadResult;

    try {
      uploadResult = await uploadVendorFile(file, "sponsorship_receipt");
    } catch (err) {
      alert(err.message || "Receipt upload failed.");
      btn.disabled = false;
      btn.textContent = "Submit Receipt";
      return;
    }

    const { error: updateError } = await supabase
      .from("vendor_sponsorships")
      .update({ receipt_url: uploadResult.path })
      .in("id", sponsorshipIds);

    if (updateError) {
      console.error("Receipt link update failed:", updateError);
    }

    alert("Receipt submitted. Your sponsorship will go live once an admin confirms your payment.");
    window.location.replace("vendordashboard");
  });

  // -----------------------------
  // INITIAL RENDER
  // -----------------------------
  renderTierGrid();
  updateBusinessNote();

});
