// ===============================================================
// theme-toggle.js
//
// Applies the saved theme immediately (runs synchronously, before
// the page paints) so switching pages never shows a flash of the
// wrong theme. Then wires up any element with [data-theme-toggle]
// to actually switch themes on click.
//
// Usage: add <script src="theme-toggle.js"></script> in <head>,
// BEFORE any stylesheet that depends on data-theme (i.e. as early
// as possible) — not deferred, not at the bottom of body.
// Add a toggle button anywhere with the attribute data-theme-toggle.
// ===============================================================

(function () {
  const saved = localStorage.getItem("spotlight-theme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtns = document.querySelectorAll("[data-theme-toggle]");
  if (!toggleBtns.length) return;

  function isDarkNow() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function updateToggleUI() {
    const dark = isDarkNow();
    toggleBtns.forEach(btn => {
      btn.classList.toggle("theme-toggle-dark", dark);
      btn.setAttribute(
        "aria-label",
        dark ? "Switch to light mode" : "Switch to dark mode"
      );
    });
  }

  updateToggleUI();

  toggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (isDarkNow()) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("spotlight-theme", "light");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("spotlight-theme", "dark");
      }
      updateToggleUI();
    });
  });
});
