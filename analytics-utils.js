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
      return JSON.parse(cached);
    } catch {
      // fall through and re-resolve if the cached value is corrupt
    }
  }

  let location = { state: null, city: null };

  try {
    const response = await fetch(
      "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/resolve-visitor-location",
      {
        method: "GET",
        headers: { "apikey": window.SUPABASE_ANON_KEY }
      }
    );

    if (response.ok) {
      const data = await response.json();
      location = { state: data.state || null, city: data.city || null };
    }
  } catch (err) {
    console.error("Visitor location resolution failed:", err);
  }

  sessionStorage.setItem("visitor_location", JSON.stringify(location));
  return location;

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

  const location = await window.resolveVisitorLocation();

  return supabase
    .from("analytics_events")
    .insert({
      ...fields,
      visitor_state: location.state,
      visitor_lga: location.city
    });

};
