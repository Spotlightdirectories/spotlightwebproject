import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// -----------------------------------------------------------------
// resolve-visitor-location
//
// Resolves the CALLER's real IP address to a state/city using
// ip-api.com — a free service that requires no API key and returns
// state-level data directly (field: regionName). Called once per
// browser session from analytics-utils.js, then cached client-side
// (sessionStorage) so we don't burn requests on every page view.
//
// No auth required — anonymous visitors (not just logged-in vendors)
// need this too, since analytics events are logged for every visitor.
// -----------------------------------------------------------------

serve(async (req) => {

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Supabase's edge runtime sits behind a proxy that forwards the
    // real client IP in this header. Fall back gracefully if it's
    // ever missing (e.g. local testing) rather than erroring out.
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const callerIp = forwardedFor.split(",")[0].trim();

    if (!callerIp) {
      return new Response(JSON.stringify({ state: null, city: null, reason: "no_ip" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ip-api.com free tier: no key, no signup, 45 req/min, HTTP only
    // (fine here since this call happens server-side, never in the
    // browser, so there's no mixed-content concern).
    const lookupUrl = `http://ip-api.com/json/${callerIp}?fields=status,regionName,city`;

    const geoResponse = await fetch(lookupUrl);
    const geoData = await geoResponse.json();

    if (geoData.status !== "success") {
      // Private/reserved IP ranges (common in local dev, or certain
      // proxy setups) legitimately fail here — not a real error.
      return new Response(JSON.stringify({ state: null, city: null, reason: "lookup_failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      state: geoData.regionName || null,
      city: geoData.city || null
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ state: null, city: null, reason: "server_error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
