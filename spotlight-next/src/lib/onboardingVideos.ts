// ===============================================================
// src/lib/onboardingVideos.ts
//
// Single source of truth for onboarding video links, split by
// desktop/mobile so each spot (signup, dashboard banner, resources
// page) stays in sync. Mobile videos don't exist yet — until they
// do, mobile falls back to the desktop recording (Cyril's explicit
// call, 2026-08). Swap the "mobile" values below once mobile
// versions are recorded; nothing else needs to change.
// ===============================================================

export const ONBOARDING_VIDEOS = {
  fullWalkthrough: {
    desktop: "https://youtu.be/n37ooN5ZaXo",
    mobile: "https://youtu.be/n37ooN5ZaXo", // TODO: replace once mobile video exists
  },
  dashboardWalkthrough: {
    desktop: "https://youtu.be/G2QEWiSJ9bo",
    mobile: "https://youtu.be/G2QEWiSJ9bo", // TODO: replace once mobile video exists
  },
};

// Helper to turn a youtu.be link into its embeddable form
export function toEmbedUrl(youtuBeUrl: string): string {
  const id = youtuBeUrl.split("/").pop();
  return `https://www.youtube.com/embed/${id}`;
}
