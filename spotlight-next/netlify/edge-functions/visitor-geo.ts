// visitor-geo: tells the website/app which Nigerian state a visitor is
// connecting from, using the location Netlify itself already works out
// for every request. The IP address is never read, sent to anyone else,
// or stored -- only the state name is returned.
// Minimal shape of the geo info Netlify attaches to every request.
type Context = { geo?: { country?: { code?: string }; subdivision?: { name?: string } } };

export default async (_req: Request, context: Context) => {
  let state: string | null = null;
  const geo = context.geo;
  if (geo?.country?.code === "NG" && geo.subdivision?.name) {
    let s = String(geo.subdivision.name).replace(/\s+State$/i, "").trim();
    if (/federal capital territory/i.test(s)) s = "FCT";
    state = s;
  } else if (geo?.country?.code) {
    state = "Outside Nigeria";
  }
  return new Response(JSON.stringify({ state }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const config = { path: "/api/visitor-geo" };
