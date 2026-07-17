window.visitorId = (() => {

  let id =
    localStorage.getItem(
      "visitor_id"
    );

  if (!id) {

    id =
      crypto.randomUUID();

    localStorage.setItem(
      "visitor_id",
      id
    );

  }

  return id;

})();

// -----------------------------------------------------------------
// VISITOR LOCATION (real, via resolve-visitor-location Edge Function)
//
// Resolved once per browser session (not on every page view) and
// cached in sessionStorage. Before this, visitor_state/visitor_lga
// were never populated at all — every event silently recorded no
// location, which is why Audience Distribution always showed
// "Unknown". "City" from the geolocation service is used as the
// closest available field to LGA — it's a real city name, not
// guaranteed to exactly match Nigeria's official LGA boundaries.
// -----------------------------------------------------------------

window.resolveVisitorLocation = async function () {

  const cached = sessionStorage.getItem("visitor_location");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // Only trust a cached SUCCESS. A cached failure (state: null)
      // must not block a retry on the next page load — otherwise a
      // real fix (like this one) can never take effect until the
      // browser tab is closed and sessionStorage clears itself.
      if (parsed.state) return parsed;
    } catch {
      // fall through and re-resolve if the cached value is corrupt
    }
  }

  let location = { state: null, city: null };

  try {
    // Uses the same supabase.functions.invoke() pattern already used
    // elsewhere in this codebase (e.g. verify-paystack-sponsorship) —
    // it automatically attaches the correct Authorization header,
    // unlike a raw fetch() which was sending apikey only and getting
    // rejected with 401 by the Edge Function gateway before ever
    // reaching the function's own code.
    const { data, error } = await window.supabaseClient.functions.invoke(
      "resolve-visitor-location",
      { method: "GET" }
    );

    if (!error && data) {
      location = { state: data.state || null, city: data.city || null };
    } else if (error) {
      console.error("Visitor location resolution error:", error);
    }
  } catch (err) {
    console.error("Visitor location resolution failed:", err);
  }

  // Only cache a real success. A failed lookup is left uncached so
  // the very next event on this visit gets a fresh attempt instead
  // of being stuck on "Unknown" for the rest of the browser session.
  if (location.state) {
    sessionStorage.setItem("visitor_location", JSON.stringify(location));
  }

  return location;

};

// -----------------------------------------------------------------
// KNOWN CRAWLER / BOT DETECTION
//
// Search engines and social-media link-preview bots identify
// themselves truthfully in their User-Agent string (that's the whole
// point of the string — so sites CAN recognize them). This checks
// against the standard, well-known signatures for the major ones.
// This is a real analytics-accuracy fix, not an SEO change: crawlers
// still receive the exact same page, same HTML, same response —
// this only decides whether we ALSO write an internal analytics row
// afterward. Won't catch something deliberately disguising itself as
// a normal browser, but that's a much smaller problem than real
// search/social crawlers (which self-identify) inflating real
// vendor-facing metrics like Audience and Marketplace Performance.
// -----------------------------------------------------------------

const KNOWN_CRAWLER_SIGNATURES = [
  "googlebot",
  "bingbot",
  "yandexbot",
  "baiduspider",
  "duckduckbot",
  "applebot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "slackbot",
  "telegrambot",
  "discordbot",
  "pinterestbot",
  "semrushbot",
  "ahrefsbot",
  "mj12bot"
];

window.isKnownCrawler = function () {
  const ua = (navigator.userAgent || "").toLowerCase();
  return KNOWN_CRAWLER_SIGNATURES.some(sig => ua.includes(sig));
};

// -----------------------------------------------------------------
// SHARED ANALYTICS EVENT LOGGER
//
// Wraps the analytics_events insert so visitor_state/visitor_lga get
// attached automatically, without every calling page needing to know
// about geolocation resolution. Pass the same fields you'd normally
// pass to .insert() (vendor_id, event_type, visitor_id, plus any
// event-specific fields like product_id/service_id/search_keyword).
// -----------------------------------------------------------------

window.logAnalyticsEvent = async function (supabase, fields) {

  // Known crawlers never get logged as real audience — see
  // isKnownCrawler() above for exactly why this is safe for SEO.
  if (window.isKnownCrawler()) {
    return { data: null, error: null, skipped: "crawler" };
  }

  const location = await window.resolveVisitorLocation();

  return supabase
    .from("analytics_events")
    .insert({
      ...fields,
      visitor_state: location.state,
      visitor_lga: location.city
    });

};
