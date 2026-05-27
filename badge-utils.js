const BADGE_TOOLTIPS = {
  blue: "Verified Business — official business documents reviewed by Spotlight. This vendor operates a registered and credible business.",
  gray: "Verified Identity — business owner identity confirmed"
};

  // ===============================
  // BADGE RENDERER
  // ===============================
function renderBadge(status) {

  if (!status) return "";

  const normalized = String(status).toLowerCase();

  if (normalized === "blue") {
    return `
      <span class="badge-wrap" data-tooltip="${BADGE_TOOLTIPS.blue}">
        <img src="images/bluebadge.png" class="verification-badge">
      </span>
    `;
  }

  if (status === "gray") {
    return `
      <span class="badge-wrap" data-tooltip="${BADGE_TOOLTIPS.gray}">
        <img src="images/graybadge.png" class="verification-badge">
      </span>
    `;
  }

  return "";
}