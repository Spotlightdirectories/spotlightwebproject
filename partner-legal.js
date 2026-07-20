document.addEventListener("DOMContentLoaded", () => {

  const supabase = window.supabaseClient;

  // -----------------------------
  // MOBILE MENU + AUTH BUTTON (same pattern as other pages)
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

  // -----------------------------
  // TABS (supports #hash deep-linking, e.g. partner-legal#assets)
  // -----------------------------
  const tabs = document.querySelectorAll(".pl-tab");
  const tabContents = document.querySelectorAll(".pl-tab-content");

  function activateTab(tabName) {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
    tabContents.forEach(c => c.classList.toggle("active", c.id === tabName));
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
      history.replaceState(null, "", `#${tab.dataset.tab}`);
    });
  });

  const initialTab = window.location.hash.replace("#", "");
  if (initialTab && document.getElementById(initialTab)) {
    activateTab(initialTab);
  }

  // -----------------------------
  // FAQ ACCORDION
  // -----------------------------
  document.querySelectorAll(".pl-faq-item").forEach(item => {
    const question = item.querySelector(".pl-faq-question");
    question.addEventListener("click", () => {
      item.classList.toggle("active");
    });
  });

  // -----------------------------
  // EARNING CALCULATOR
  // Uses the real, confirmed plan prices and commission structure.
  // -----------------------------
  const planPrices = {
    standard: 26982,
    enterprise: 113400,
    elite: 201600
  };

  const calcBtn = document.getElementById("calc-btn");
  const calcCount = document.getElementById("calc-count");
  const calcPlan = document.getElementById("calc-plan");
  const calcResults = document.getElementById("calc-results");
  const calcFirst = document.getElementById("calc-first");
  const calcRenewal = document.getElementById("calc-renewal");
  const calcBonus = document.getElementById("calc-bonus");
  const calcTotal = document.getElementById("calc-total");

  function formatNaira(amount) {
    return `₦${Math.round(amount).toLocaleString()}`;
  }

  if (calcBtn) {
    calcBtn.addEventListener("click", () => {
      const count = Math.max(0, parseInt(calcCount.value) || 0);
      const price = planPrices[calcPlan.value];

      const firstPaymentCommission = count * price * 0.20;
      const renewalCommission = count * price * 0.10;

      const bonusUnits = Math.floor(count / 50);
      const bonusAmount = bonusUnits * 30000;

      calcFirst.textContent = formatNaira(firstPaymentCommission);
      calcRenewal.textContent = `${formatNaira(renewalCommission)} per renewal year`;
      calcBonus.textContent = bonusAmount > 0
        ? formatNaira(bonusAmount)
        : "Not yet — refer 50+ yearly vendors in a month to qualify";
      calcTotal.textContent = formatNaira(firstPaymentCommission + bonusAmount);

      calcResults.style.display = "block";
    });
  }

});
