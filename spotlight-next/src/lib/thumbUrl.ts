// Card thumbnails (2026-11-10).
// Since 10 Nov 2026 the validate-upload server step saves a small copy of
// every product, service, portfolio, gallery, cover and logo photo at
// "thumbs/<same path>" in the same storage bucket (at most 480px on its
// longest side, roughly 4-6 times lighter than the original). Existing
// photos were given small copies by a one-time job on the same day.
//
// thumbUrl() turns a photo's normal public URL into its small copy's URL.
// Anything else (site images, default logos, outside links) comes back
// unchanged. Use it ONLY for cards; product pages keep the full photo.
// Always pair it with a fallback to the original (see ThumbImg), in case a
// small copy is ever missing.
const THUMB_BUCKETS = ["vendor-gallery", "vendor-branding"];

export function thumbUrl(url: string | null | undefined): string {
  if (!url) return "";
  for (const bucket of THUMB_BUCKETS) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const i = url.indexOf(marker);
    if (i === -1) continue;
    const rest = url.slice(i + marker.length);
    if (rest.startsWith("thumbs/")) return url;
    return url.slice(0, i + marker.length) + "thumbs/" + rest;
  }
  return url;
}
