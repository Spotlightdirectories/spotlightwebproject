document.addEventListener("DOMContentLoaded", () => {

  // PASSWORD TOGGLE (safe — only runs if elements exist)
  const togglePassword = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("login-password");

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      passwordInput.type =
        passwordInput.type === "password" ? "text" : "password";
    });
  }

  // TABS
const tabs = document.querySelectorAll(".partner-tab");
const contents = document.querySelectorAll(".partner-tab-content");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.getAttribute("data-tab");

    tabs.forEach(t => t.classList.remove("active"));
    contents.forEach(c => c.classList.remove("active"));

    tab.classList.add("active");

    const targetContent = document.getElementById(target);
    if (targetContent) targetContent.classList.add("active");
  });
});

// FAQ ACCORDION
const faqItems = document.querySelectorAll(".partner-faq-item");

faqItems.forEach(item => {
  const question = item.querySelector(".partner-faq-question");

  if (question) {
    question.addEventListener("click", () => {
      faqItems.forEach(i => {
        if (i !== item) i.classList.remove("active");
      });

      item.classList.toggle("active");
    });
  }
});

  });

  window.addEventListener("load", () => {
  const hash = window.location.hash.replace("#", "");

  if (!hash) return;

  const tabs = document.querySelectorAll(".partner-tab");
  const contents = document.querySelectorAll(".partner-tab-content");

  const targetTab = document.querySelector(`.partner-tab[data-tab="${hash}"]`);
  const targetContent = document.getElementById(hash);

  if (targetTab && targetContent) {
    tabs.forEach(t => t.classList.remove("active"));
    contents.forEach(c => c.classList.remove("active"));

    targetTab.classList.add("active");
    targetContent.classList.add("active");
  }
});