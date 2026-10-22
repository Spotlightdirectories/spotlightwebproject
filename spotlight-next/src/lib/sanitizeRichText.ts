// ===============================================================
// src/lib/sanitizeRichText.ts
//
// Added 2026-10-22 (security audit). Business descriptions are stored as
// HTML (the profile editor's Bold / Italic / Underline buttons) and shown
// to every visitor. Without filtering, a vendor could save a description
// containing a script or an event handler (for example an <img onerror=...>)
// and it would run in other people's browsers. This keeps ONLY plain
// formatting tags with NO attributes, removes every other tag, and turns
// any stray "<" into text. It behaves identically on the server and in the
// browser, so it never causes a hydration mismatch.
// ===============================================================

const ALLOWED = ["b", "strong", "i", "em", "u", "br", "div", "p", "span", "ul", "ol", "li"];
const ALLOWED_RE = ALLOWED.join("|");

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  // 1. Keep allowed tags (re-written WITHOUT attributes); drop all other tags.
  let out = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_m, slash: string, tag: string) => {
    const t = tag.toLowerCase();
    return ALLOWED.includes(t) ? `<${slash}${t}>` : "";
  });
  // 2. Anything that still starts with "<" but is not one of the clean tags above becomes plain text.
  out = out.replace(new RegExp(`<(?!\\/?(?:${ALLOWED_RE})>)`, "g"), "&lt;");
  return out;
}
