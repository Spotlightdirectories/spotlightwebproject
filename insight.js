// ---------- Helpers ----------
const fmt = n => (n || 0).toLocaleString();
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';

const insightSupabase = window.supabaseClient;
const visitorId = window.visitorId;

let currentVendorId = null;
let insightPeriod = "This Month";
let showAllKeywords = false;

/* ===========================
   VENDOR LOADER
=========================== */

async function loadCurrentVendor() {
  const { data: { user } } = await insightSupabase.auth.getUser();
  if (!user) return;

  const { data: vendor } = await insightSupabase
    .from("vendors")
    .select("id,name,plan_tier")
    .eq("auth_user_id", user.id)
    .single();

  currentVendorId = vendor?.id || null;
}

/* ===========================
   PERIOD RANGES
=========================== */

function getPeriodRanges() {
  const now = new Date();
  let currentStart = new Date();
  let previousStart = new Date();
  let previousEnd = new Date();

  switch (insightPeriod) {
    case "Today":
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 1);
      previousEnd = new Date(currentStart);
      break;

    case "This Week":
      currentStart = new Date(now);
      currentStart.setDate(now.getDate() - 6);
      previousEnd = new Date(currentStart);
      previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      break;

    case "This Month":
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(currentStart);
      break;

    case "This Quarter":
      const quarter = Math.floor(now.getMonth() / 3);
      currentStart = new Date(now.getFullYear(), quarter * 3, 1);
      previousStart = new Date(now.getFullYear(), (quarter * 3) - 3, 1);
      previousEnd = new Date(currentStart);
      break;

    case "This Year":
      currentStart = new Date(now.getFullYear(), 0, 1);
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(currentStart);
      break;
  }

  return { currentStart, currentEnd: now, previousStart, previousEnd };
}

/* ===========================
   GROWTH HELPER
=========================== */

function calcGrowth(current, previous) {
  if (!previous) return { growth: current > 0 ? "NEW" : 0, up: true };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { growth: Math.abs(pct), up: pct >= 0 };
}

/* ===========================
   COUNT HELPER
   Reusable for any event_type
=========================== */

async function countEvents(eventType, start, end = null) {
  let query = insightSupabase
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", currentVendorId)
    .gte("created_at", start.toISOString());

  if (eventType) query = query.eq("event_type", eventType);
  if (end) query = query.lt("created_at", end.toISOString());

  const { count } = await query;
  return count || 0;
}

/* ===========================
   FETCH EVENTS WITH FIELDS
=========================== */

async function fetchEvents(fields, eventType = null) {
  const { currentStart } = getPeriodRanges();

  let query = insightSupabase
    .from("analytics_events")
    .select(fields)
    .eq("vendor_id", currentVendorId)
    .gte("created_at", currentStart.toISOString());

  if (eventType) query = query.eq("event_type", eventType);

  const { data, error } = await query;
  if (error) console.error("fetchEvents error:", error);
  return data || [];
}

/* ===========================
   MARKETPLACE STATS
=========================== */

async function getStatWithGrowth(eventType) {
  const { currentStart, previousStart, previousEnd } = getPeriodRanges();
  const current = await countEvents(eventType, currentStart);
  const previous = await countEvents(eventType, previousStart, previousEnd);
  return { value: current, ...calcGrowth(current, previous) };
}

async function getUniqueVisitorsWithGrowth() {
  const { currentStart, previousStart, previousEnd } = getPeriodRanges();

  const getUnique = async (start, end = null) => {
    let query = insightSupabase
      .from("analytics_events")
      .select("visitor_id")
      .eq("vendor_id", currentVendorId)
      .gte("created_at", start.toISOString());

    if (end) query = query.lt("created_at", end.toISOString());
    const { data } = await query;
    return new Set((data || []).map(r => r.visitor_id).filter(Boolean)).size;
  };

  const current = await getUnique(currentStart);
  const previous = await getUnique(previousStart, previousEnd);

  return { value: current, ...calcGrowth(current, previous) };
}

async function renderMarketplaceStats() {
  const [profileViews, uniqueVisitors, searchImpressions] = await Promise.all([
    getStatWithGrowth("profile_view"),
    getUniqueVisitorsWithGrowth(),
    getStatWithGrowth("search_impression")
  ]);

  const perfStats = [
    { label: "Profile Views",       ...profileViews },
    { label: "Unique Visitors",     ...uniqueVisitors },
    { label: "Search Impressions",  ...searchImpressions }
  ];

  $("perfStats").innerHTML = "";
  $("perfStats").className = "grid-3";

  perfStats.forEach(p => {
    const div = document.createElement("div");
    div.className = "perf-stat";
    div.innerHTML = `
      <div class="p-lbl">${p.label}</div>
      <div class="p-val">${fmt(p.value)}</div>
      <div class="p-trend ${p.up ? "up" : "down"}">
        ${p.up ? "▲" : "▼"} ${p.growth}%
      </div>`;
    $("perfStats").appendChild(div);
  });
}

/* ===========================
   LINE CHART  (fully dynamic)
=========================== */

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/**
 * Builds { labels, values } buckets from raw analytics_events rows.
 * Works for Today (hourly), This Week (daily), This Month (weekly),
 * This Quarter (monthly), This Year (quarterly).
 */
function bucketRecords(records) {
  const get = r => new Date(r.created_at);

  if (insightPeriod === "Today") {
    const slots = { "12am":0,"3am":0,"6am":0,"9am":0,"12pm":0,"3pm":0,"6pm":0,"9pm":0 };
    records.forEach(r => {
      const h = get(r).getHours();
      if      (h < 3)  slots["12am"]++;
      else if (h < 6)  slots["3am"]++;
      else if (h < 9)  slots["6am"]++;
      else if (h < 12) slots["9am"]++;
      else if (h < 15) slots["12pm"]++;
      else if (h < 18) slots["3pm"]++;
      else if (h < 21) slots["6pm"]++;
      else             slots["9pm"]++;
    });
    return { labels: Object.keys(slots), values: Object.values(slots) };
  }

  if (insightPeriod === "This Week") {
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const slots = Object.fromEntries(days.map(d => [d, 0]));
    records.forEach(r => {
      const day = get(r).toLocaleDateString("en-US", { weekday: "short" });
      if (day in slots) slots[day]++;
    });
    return { labels: days, values: days.map(d => slots[d]) };
  }

  if (insightPeriod === "This Month") {
    // 4 ISO weeks of the month
    const slots = { "Week 1": 0, "Week 2": 0, "Week 3": 0, "Week 4": 0 };
    records.forEach(r => {
      const day = get(r).getDate();
      if      (day <= 7)  slots["Week 1"]++;
      else if (day <= 14) slots["Week 2"]++;
      else if (day <= 21) slots["Week 3"]++;
      else                slots["Week 4"]++;
    });
    return { labels: Object.keys(slots), values: Object.values(slots) };
  }

  if (insightPeriod === "This Quarter") {
    const now = new Date();
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const labels = [monthNames[quarterMonth], monthNames[quarterMonth+1], monthNames[quarterMonth+2]];
    const slots = Object.fromEntries(labels.map(l => [l, 0]));
    records.forEach(r => {
      const label = monthNames[get(r).getMonth()];
      if (label in slots) slots[label]++;
    });
    return { labels, values: labels.map(l => slots[l]) };
  }

  if (insightPeriod === "This Year") {
    const slots = { "Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0 };
    records.forEach(r => {
      const q = Math.floor(get(r).getMonth() / 3);
      slots[`Q${q + 1}`]++;
    });
    return { labels: ["Q1","Q2","Q3","Q4"], values: Object.values(slots) };
  }

  return { labels: [], values: [] };
}

async function renderLineChart() {
  const svg = $("perfLineChart");
  if (!svg) return;

  svg.innerHTML = "";

  // Fetch profile_view records for the current period
  const records = await fetchEvents("created_at", "profile_view");
  const chart = bucketRecords(records);

  const labels = chart.labels;
  const values = chart.values;

  const W = 600, H = 160, PAD = 20;
  const max = Math.max(...values, 1); // avoid divide-by-zero

  // Gradient defs
  const defs = svgEl("defs", {});
  const grad = svgEl("linearGradient", { id: "areaGradient", x1: "0%", y1: "0%", x2: "0%", y2: "100%" });
  grad.appendChild(svgEl("stop", { offset: "0%",   "stop-color": "#E6B800", "stop-opacity": "0.35" }));
  grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#E6B800", "stop-opacity": "0" }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Grid lines
  for (let i = 0; i < 5; i++) {
    const y = PAD + ((H - PAD * 2) / 4) * i;
    svg.appendChild(svgEl("line", { x1: 0, y1: y, x2: W, y2: y, class: "chart-grid-line" }));
  }

  // Points
  const xStep = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = PAD + xStep * i;
    const y = H - PAD - ((v / max) * (H - PAD * 2));
    return [x, y];
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const areaPath = linePath
    + ` L ${points[points.length - 1][0]} ${H - PAD} L ${points[0][0]} ${H - PAD} Z`;

  svg.appendChild(svgEl("path", { d: areaPath, fill: "url(#areaGradient)" }));
  svg.appendChild(svgEl("path", { d: linePath, class: "chart-line" }));

  // Dots on each data point
  points.forEach(([x, y]) => {
    svg.appendChild(svgEl("circle", { cx: x, cy: y, r: 3, class: "chart-dot", fill: "#E6B800" }));
  });

  // X-axis labels
  $("perfXAxis").innerHTML = labels.map(l => `<span>${l}</span>`).join("");
}

/* ===========================
   LEAD GENERATION  (with growth)
=========================== */

async function renderLeadGeneration() {
  const { currentStart, previousStart, previousEnd } = getPeriodRanges();

  if (!currentVendorId) {
    $("leadGrid").innerHTML = "";
    return;
  }

  const leadTypes = [
    { label: "WhatsApp Chats",   icon: "fa-brands fa-whatsapp",                    cls: "lead-icon-whatsapp",  event: "whatsapp_click" },
    { label: "Phone Calls",      icon: "fa-solid fa-phone",                         cls: "lead-icon-phone",     event: "phone_click" },
    { label: "Directions",       icon: "fa-solid fa-location-dot",                  cls: "lead-icon-direction", event: "direction_click" },
    { label: "Catalog Visits",   icon: "fa-solid fa-book-open",                     cls: "lead-icon-catalog",   event: "catalog_visit" },
    { label: "External Visits",  icon: "fa-solid fa-arrow-up-right-from-square",    cls: "lead-icon-external",  event: "external_visit" }
  ];

  const results = await Promise.all(
    leadTypes.map(async lt => {
      const current  = await countEvents(lt.event, currentStart);
      const previous = await countEvents(lt.event, previousStart, previousEnd);
      return { ...lt, value: current, ...calcGrowth(current, previous) };
    })
  );

  $("leadGrid").innerHTML = results.map(c => `
    <div class="lead-card">
      <div class="lead-icon ${c.cls}"><i class="${c.icon}"></i></div>
      <div class="lead-label">${c.label}</div>
      <div class="lead-value">${fmt(c.value)}</div>
      <div class="lead-trend ${c.up ? "up" : "down"}">
        ${c.up ? "▲" : "▼"} ${c.growth}%
      </div>
    </div>
  `).join("");
}

/* ===========================
   AUDIENCE  (by visitor_state + visitor_lga)
=========================== */

async function renderAudience() {
  if (!currentVendorId) return;

  // Fetch all events in period — use visitor_state as primary grouping,
  // visitor_lga as secondary detail. Count unique visitors per state.
  const records = await fetchEvents("visitor_id,visitor_state,visitor_lga");

  // Count by state (primary audience breakdown)
  const stateMap = {};
  records.forEach(r => {
    const state = r.visitor_state || "Unknown";
    stateMap[state] = (stateMap[state] || 0) + 1;
  });

  const total = records.length;
  const sorted = Object.entries(stateMap).sort((a, b) => b[1] - a[1]);

  const dotClasses = ["dot-red","dot-blue","dot-green","dot-gold","dot-purple","dot-gray"];
  const top5 = sorted.slice(0, 5);
  const othersCount = sorted.slice(5).reduce((s, [, n]) => s + n, 0);

  const rows = [
    ...top5.map(([state, count], i) => ({
      city: state,   // reuse city label for display
      count,
      pct: total ? Math.round((count / total) * 100) : 0,
      cls: dotClasses[i]
    })),
    ...(othersCount > 0
      ? [{ city: "Others", count: othersCount, pct: total ? Math.round((othersCount / total) * 100) : 0, cls: "dot-gray" }]
      : [])
  ];

  const totalEl = document.querySelector(".audience-total");
  if (totalEl) totalEl.textContent = fmt(total);

  const audienceList = $("audienceList");
  if (audienceList) {
    audienceList.innerHTML = rows.length
      ? rows.map(a => `
          <div class="audience-row">
            <span class="audience-dot ${a.cls}"></span>
            <span class="audience-city">${a.city}</span>
            <span class="audience-count">${fmt(a.count)}</span>
            <span class="audience-pct">${a.pct}%</span>
          </div>`).join("")
      : `<div class="audience-row" style="color:var(--text-muted)">No audience data yet</div>`;
  }
}

/* ===========================
   SEARCH KEYWORDS  (dynamic)
   Column: search_keyword  (not search_term)
=========================== */

async function renderKeywords() {
  if (!currentVendorId) {
    $("keywordList").innerHTML = "";
    return;
  }

  // search_keyword is the actual column name in analytics_events
  const records = await fetchEvents("search_keyword", "search_impression");

  const termMap = {};
  records.forEach(r => {
    const kw = (r.search_keyword || "").trim();
    if (!kw) return;
    termMap[kw] = (termMap[kw] || 0) + 1;
  });

  // total = events that had a keyword (not all records, to keep % meaningful)
  const keyworded = Object.values(termMap).reduce((s, n) => s + n, 0) || 1;

  const sorted = Object.entries(termMap)
    .sort((a, b) => b[1] - a[1])
    .map(([term, searches]) => ({
      term,
      searches,
      pct: Math.round((searches / keyworded) * 100)
    }));

  const keywords = showAllKeywords ? sorted : sorted.slice(0, 5);

  if (!keywords.length) {
    $("keywordList").innerHTML = `<div class="kw-row" style="color:var(--text-muted)">No keyword data yet</div>`;
    return;
  }

  $("keywordList").innerHTML = keywords.map((k, i) => `
    <div class="kw-row">
      <div class="kw-top">
        <span>${k.term}</span>
        <span class="kw-metrics">
          <span>${fmt(k.searches)}</span>
          <span>${k.pct}%</span>
        </span>
      </div>
      <div class="kw-bar-track">
        <div class="kw-bar-fill" id="kwBar${i}"></div>
      </div>
    </div>
  `).join("");

  keywords.forEach((k, i) => {
    const bar = $("kwBar" + i);
    if (bar) bar.style.width = k.pct + "%";
  });

  const toggleLink = $("toggleKeywordsLink");
  if (toggleLink) {
    toggleLink.textContent = showAllKeywords ? "View Less Keywords ↑" : "View All Keywords →";
    toggleLink.onclick = e => {
      e.preventDefault();
      showAllKeywords = !showAllKeywords;
      renderKeywords();
    };
  }
}

/* ===========================
   CATALOG  (dynamic)
   Uses product_id → vendor_products and service_id → vendor_services
   event_types: "product_view" for products, "service_view" for services
=========================== */

async function renderCatalog() {
  if (!currentVendorId) return;

  const { currentStart } = getPeriodRanges();

  // Fetch product views — join vendor_products to get the name
  const { data: productEvents } = await insightSupabase
    .from("analytics_events")
    .select("product_id, vendor_products(id, name)")
    .eq("vendor_id", currentVendorId)
    .eq("event_type", "product_view")
    .not("product_id", "is", null)
    .gte("created_at", currentStart.toISOString());

  // Fetch service views — join vendor_services to get the name
  const { data: serviceEvents } = await insightSupabase
    .from("analytics_events")
    .select("service_id, vendor_services(id, name)")
    .eq("vendor_id", currentVendorId)
    .eq("event_type", "service_view")
    .not("service_id", "is", null)
    .gte("created_at", currentStart.toISOString());

  // Aggregate product views by product_id
  const productMap = {};
  (productEvents || []).forEach(r => {
    const id   = r.product_id;
    const name = r.vendor_products?.name || `Product ${id?.slice(0,8)}`;
    if (!productMap[id]) productMap[id] = { name, views: 0 };
    productMap[id].views++;
  });

  // Aggregate service views by service_id
  const serviceMap = {};
  (serviceEvents || []).forEach(r => {
    const id   = r.service_id;
    const name = r.vendor_services?.name || `Service ${id?.slice(0,8)}`;
    if (!serviceMap[id]) serviceMap[id] = { name, views: 0 };
    serviceMap[id].views++;
  });

  const products = Object.values(productMap).sort((a, b) => b.views - a.views);
  const services = Object.values(serviceMap).sort((a, b) => b.views - a.views);

  renderRankList("topProducts", products.slice(0, 5));
  renderRankList("topServices", services.slice(0, 5));

  if ($("viewAllProductsLink")) $("viewAllProductsLink").style.display = products.length <= 5 ? "none" : "";
  if ($("viewAllServicesLink")) $("viewAllServicesLink").style.display = services.length <= 5 ? "none" : "";
}

function renderRankList(id, items) {
  $(id).innerHTML = items.length
    ? items.map((it, i) => `
        <div class="rank-row">
          <div class="rank-num">${i + 1}</div>
          <div class="rank-name">${it.name}</div>
          <div class="rank-views">${fmt(it.views)} views</div>
        </div>`).join("")
    : `<div class="rank-row"><div class="rank-name" style="color:var(--text-muted)">No data yet</div></div>`;
}

/* ===========================
   RANKING  (dynamic position)

   Strategy: analytics_events has no category column.
   We get vendor IDs in the same category from the vendors
   table, then count profile_views for each of them and
   find our rank within that set.

   Requires vendors table to have: category, subcategory columns.
   If those columns don't exist yet, ranking falls back gracefully.
=========================== */

let selectedRankingCategory    = "Professional Services";
let selectedRankingSubcategory = "Accountant";

async function renderRanking() {
  if (!currentVendorId) return;

  const { currentStart } = getPeriodRanges();
  const category = `${selectedRankingCategory} / ${selectedRankingSubcategory}`;

  // Step 1: get all vendor IDs in the same category/subcategory
  // (adjust column names to match your vendors table)
  const { data: peers } = await insightSupabase
    .from("vendors")
    .select("id")
    .eq("category", selectedRankingCategory)
    .eq("subcategory", selectedRankingSubcategory);

  const peerIds = (peers || []).map(v => v.id);

  // If category columns don't exist or return nothing, show a dash
  if (!peerIds.length) {
    _applyRankingUI({ current: "—", sponsored: null, category });
    return;
  }

  // Step 2: count profile_views per peer vendor in this period
  const { data: viewEvents } = await insightSupabase
    .from("analytics_events")
    .select("vendor_id")
    .eq("event_type", "profile_view")
    .in("vendor_id", peerIds)
    .gte("created_at", currentStart.toISOString());

  const countMap = {};
  peerIds.forEach(id => { countMap[id] = 0; }); // seed all peers at 0
  (viewEvents || []).forEach(r => {
    if (countMap[r.vendor_id] !== undefined) countMap[r.vendor_id]++;
  });

  const sorted  = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
  const rankIdx = sorted.findIndex(([id]) => id === currentVendorId);
  const current = rankIdx >= 0 ? rankIdx + 1 : sorted.length + 1;

  // Step 3: sponsored rank — vendors with a "sponsored_click" or
  // "sponsored_impression" event among peers
  const { data: sponsorEvents } = await insightSupabase
    .from("analytics_events")
    .select("vendor_id")
    .eq("event_type", "sponsored_impression")
    .in("vendor_id", peerIds)
    .gte("created_at", currentStart.toISOString());

  const sponsorMap = {};
  (sponsorEvents || []).forEach(r => {
    sponsorMap[r.vendor_id] = (sponsorMap[r.vendor_id] || 0) + 1;
  });
  const sponsoredSorted = Object.entries(sponsorMap).sort((a, b) => b[1] - a[1]);
  const sponsoredIdx    = sponsoredSorted.findIndex(([id]) => id === currentVendorId);
  const sponsored       = sponsoredIdx >= 0 ? sponsoredIdx + 1 : null;

  _applyRankingUI({ current, sponsored, category, totalPeers: sorted.length });
}

function _applyRankingUI({ current, sponsored, category, totalPeers = 50 }) {
  const numbers = document.querySelectorAll(".rank-number");
  if (numbers.length >= 2) {
    numbers[0].textContent = typeof current === "number" ? `#${current}` : current;
    numbers[1].textContent = sponsored
      ? (sponsored <= 5 ? `Top ${sponsored}` : `#${sponsored}`)
      : "—";
  }

  const subs = document.querySelectorAll(".rank-sub");
  if (subs.length) subs[0].textContent = category;

  const currentLabel = document.querySelector(".rank-current-label");
  if (currentLabel) currentLabel.textContent = typeof current === "number" ? `#${current}` : current;

  const rightLabel = document.querySelector(".rank-right-label");
  if (rightLabel) rightLabel.textContent = sponsored ? `🏆 Top ${sponsored}` : "—";

  const dot = $("rankCurrentDot");
  if (dot && typeof current === "number") {
    const maxRank = Math.max(totalPeers, 50);
    const pct = Math.min(100, (current / maxRank) * 100);
    dot.style.left = `${pct}%`;
  }
}

/* ===========================
   DATE RANGE LABEL
=========================== */

function updateDateRange() {
  const today = new Date();
  let start = new Date(today);

  switch (insightPeriod) {
    case "Today":    start = new Date(today); break;
    case "This Week": start.setDate(today.getDate() - 6); break;
    case "This Quarter":
      start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1); break;
    case "This Year":
      start = new Date(today.getFullYear(), 0, 1); break;
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const opts = { month: "short", day: "numeric", year: "numeric" };
  $("dateRange").textContent =
    `${start.toLocaleDateString("en-US", opts)} – ${today.toLocaleDateString("en-US", opts)}`;
}

/* ===========================
   SYNC PERIOD  (master trigger)
=========================== */

async function syncPeriod(period) {
  insightPeriod = period;
  document.querySelectorAll(".period-select").forEach(s => s.value = period);
  updateDateRange();

  if (currentVendorId) {
    await Promise.all([
      renderMarketplaceStats(),
      renderLineChart(),
      renderLeadGeneration(),
      renderAudience(),
      renderKeywords(),
      renderCatalog(),
      renderRanking()
    ]);
  }
}

/* ===========================
   GAUGE  (static — score fed from backend separately)
=========================== */

const health = {
  score: 84, max: 100, stars: 4, deltaPct: 12,
  items: [
    { label: "Profile Completeness", score: 20, max: 20 },
    { label: "Verification",         score: 20, max: 20 },
    { label: "Reviews",              score: 18, max: 20 },
    { label: "Catalog",              score: 16, max: 20 },
    { label: "Sponsorship",          score: 10, max: 20 }
  ]
};

(function renderGauge() {
  const svg = $('gaugeSvg');
  const defs = svgEl('defs', {});
  const grad = svgEl('linearGradient', { id: 'gaugeGradient', x1: '0%', y1: '0%', x2: '100%', y2: '0%' });
  [['0%','#D93025'],['50%','#E6B800'],['100%','#1E8E3E']].forEach(([offset, color]) => {
    grad.appendChild(svgEl('stop', { offset, 'stop-color': color }));
  });
  defs.appendChild(grad);
  svg.insertBefore(defs, svg.firstChild);

  const fullLength = Math.PI * 90;
  const pct = health.score / health.max;
  $('gaugeFill').style.strokeDasharray = `${fullLength * pct} ${fullLength}`;
  $('healthValue').textContent = health.score;

  const starsEl = $('starRow');
  starsEl.textContent = '★'.repeat(health.stars) + '☆'.repeat(5 - health.stars);
})();

/* ===========================
   GROWTH COACH  (static config)
=========================== */

const growthCoachData = {
  profile: {
    description: true, logo: true, coverImage: true,
    businessVideo: false, contactInformation: true,
    businessHours: true, socialLinks: false
  },
  verification: { score: 20, maxScore: 20, emailVerified: true, businessVerified: true },
  catalog: {
    score: 12, maxScore: 20, plan: "standard", businessType: "hybrid",
    products: 3, services: 1, current: 4,
    required: 6
  },
  reviews:     { score: 8,  maxScore: 20, thisMonth: 4, targetThisMonth: 10 },
  sponsorship: {
    score: 10, maxScore: 20, businessType: "hybrid",
    businessSponsoredText: "No", productsSponsoredText: "Yes", servicesSponsoredText: "No"
  }
};

const coachItems = [
  { title: 'Complete Profile',                   done: false, score: 14, maxScore: 20, impact: 'recommended', actionLabel: 'See Details' },
  { title: 'Complete Business Verification',     done: true,  score: 20, maxScore: 20, impact: 'high',        actionLabel: 'See Details' },
  { title: 'Add & Complete Products / Services', done: false, score: 12, maxScore: 20, impact: 'high',        actionLabel: 'See Details' },
  { title: 'Get More Reviews',                   done: false, score: 8,  maxScore: 20, impact: 'recommended', actionLabel: 'See Details' },
  { title: 'Sponsor Business / Products / Services', done: false, score: 10, maxScore: 20, impact: 'high', actionLabel: 'See Details', secondaryAction: 'Sponsor Now' }
];

(function renderGrowthCoach() {
  $('coachList').innerHTML = coachItems.map((c, index) => `
    <div class="coach-item-wrap">
      <div class="coach-item">
        <div class="coach-status ${c.done ? 'done' : 'todo'}">${c.done ? '✓' : '○'}</div>
        <div class="coach-body">
          <div class="coach-title">${c.title}</div>
          ${c.impact ? `<div class="coach-impact ${c.impact}">${c.impact === 'high' ? 'High Impact' : 'Recommended'}</div>` : ''}
        </div>
        ${c.secondaryAction
          ? `<div class="coach-action-group">
               <button class="coach-action" data-index="${index}">${c.actionLabel}</button>
               <button class="coach-action sponsor-action" data-action="sponsor">${c.secondaryAction}</button>
             </div>`
          : c.actionLabel
            ? `<button class="coach-action" data-index="${index}">${c.actionLabel}</button>`
            : ''}
      </div>
      <div class="coach-details" id="coachDetails${index}" style="display:none;"></div>
    </div>
  `).join('');

  const growthScore = coachItems.reduce((t, c) => t + c.score, 0);
  $("coachProgressLabel").textContent = growthScore + "%";
  $("coachProgressFill").style.width   = growthScore + "%";

  // Breakdown toggle
  const toggle = $("coachBreakdownToggle");
  const breakdown = $("coachBreakdown");
  if (toggle) {
    toggle.onclick = () => {
      const hidden = breakdown.style.display === "none";
      breakdown.style.display = hidden ? "block" : "none";
      toggle.textContent = hidden ? "Breakdown ▲" : "Breakdown ▼";
    };
  }

  $("coachBreakdown").innerHTML = `
    ${coachItems.map((c, i) => `
      <div class="coach-breakdown-row">
        <span>${['Profile Completion','Verification','Products & Services','Reviews','Sponsorship'][i]}</span>
        <span>${c.score}/${c.maxScore}</span>
      </div>`).join('')}
    <div class="coach-breakdown-total">
      <span>Growth Score</span>
      <span>${growthScore}/100</span>
    </div>`;

  // Detail expansion
  const detailContent = [
    () => `
      <div class="coach-detail-score">Current Score: ${coachItems[0].score}/${coachItems[0].maxScore}</div>
      ${Object.entries(growthCoachData.profile).map(([k, v]) =>
        `<div>${v ? '✓' : '✗'} ${k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}</div>`
      ).join('')}`,
    () => `
      <div class="coach-detail-score">Current Score: ${growthCoachData.verification.score}/${growthCoachData.verification.maxScore}</div>
      <div>${growthCoachData.verification.emailVerified    ? '✓' : '✗'} Email Verified</div>
      <div>${growthCoachData.verification.businessVerified ? '✓' : '✗'} Business Verified</div>`,
    () => `
      <div class="coach-detail-score">Current Score: ${growthCoachData.catalog.score}/${growthCoachData.catalog.maxScore}</div>
      <div>Plan: ${growthCoachData.catalog.plan}</div>
      <div>Products: ${growthCoachData.catalog.products} | Services: ${growthCoachData.catalog.services}</div>
      <div>Current Listings: ${growthCoachData.catalog.current} / Required: ${growthCoachData.catalog.required}</div>
      <div>${growthCoachData.catalog.required - growthCoachData.catalog.current} more listing(s) required</div>`,
    () => `
      <div class="coach-detail-score">Current Score: ${growthCoachData.reviews.score}/${growthCoachData.reviews.maxScore}</div>
      <div>This Month: ${growthCoachData.reviews.thisMonth} / Target: ${growthCoachData.reviews.targetThisMonth}</div>
      <div>${growthCoachData.reviews.targetThisMonth - growthCoachData.reviews.thisMonth} more reviews required</div>`,
    () => `
      <div class="coach-detail-score">Current Score: ${growthCoachData.sponsorship.score}/${growthCoachData.sponsorship.maxScore}</div>
      <div>Business Sponsored: ${growthCoachData.sponsorship.businessSponsoredText}</div>
      <div>Products Sponsored: ${growthCoachData.sponsorship.productsSponsoredText}</div>
      <div>Services Sponsored: ${growthCoachData.sponsorship.servicesSponsoredText}</div>`
  ];

  document.querySelectorAll(".coach-action").forEach(btn => {
    btn.onclick = () => {
      const index = btn.dataset.index;
      if (index === undefined) return;
      const details = $(`coachDetails${index}`);
      const hidden = details.style.display === "none";
      details.style.display = hidden ? "block" : "none";
      btn.textContent = hidden ? "Hide Details" : "See Details";
      if (hidden) details.innerHTML = detailContent[+index]();
    };
  });
})();

/* ===========================
   RANKING CATEGORY MODAL
=========================== */

const rankingCategoryMap = {
  "Professional Services": ["Accountant/Auditor","Tax Consultant","Lawyer","Architect"],
  "Fashion & Tailoring":   ["Fashion Designer","Tailor","Makeup Artist","Barber"],
  "Local Food & Canteens": ["Restaurant","Caterer","Bakery","Food Vendor"],
  "Digital & Tech Services":["Web Designer","Graphic Designer","Software Developer","Digital Marketer"],
  "Home Services":          ["Plumber","Electrician","Painter","Cleaner"]
};

/* ===========================
   MODALS & NAV
=========================== */

const backToDashboardBtn = $("backToDashboardBtn");
if (backToDashboardBtn) {
  backToDashboardBtn.addEventListener("click", () => {
    window.location.href = "vendordashboard.html";
  });
}

const healthDetailsBtn = $("healthDetailsBtn");
const healthModal      = $("healthModal");
const closeHealthModal = $("closeHealthModal");

if (healthDetailsBtn) healthDetailsBtn.onclick = () => healthModal.classList.add("show");
if (closeHealthModal) closeHealthModal.onclick = () => healthModal.classList.remove("show");
if (healthModal)      healthModal.onclick = e => { if (e.target === healthModal) healthModal.classList.remove("show"); };

/* ===========================
   DOM READY
=========================== */

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".period-select").forEach(select => {
    select.addEventListener("change", e => syncPeriod(e.target.value));
  });

  // Ranking modals
  const rankingFactorsBtn          = $("rankingFactorsBtn");
  const rankingFactorsModal        = $("rankingFactorsModal");
  const closeRankingFactorsModal   = $("closeRankingFactorsModal");
  const rankingModal               = $("rankingCategoryModal");
  const changeRankingCategoryBtn   = $("changeRankingCategoryBtn");
  const closeRankingCategoryModal  = $("closeRankingCategoryModal");
  const rankingCategorySelect      = $("rankingCategorySelect");
  const rankingSubcategorySelect   = $("rankingSubcategorySelect");
  const applyRankingCategoryBtn    = $("applyRankingCategoryBtn");

  if (rankingCategorySelect) {
    rankingCategorySelect.onchange = () => {
      const subs = rankingCategoryMap[rankingCategorySelect.value] || [];
      rankingSubcategorySelect.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join("");
    };
  }

  if (changeRankingCategoryBtn)  changeRankingCategoryBtn.onclick  = () => rankingModal?.classList.add("show");
  if (closeRankingCategoryModal) closeRankingCategoryModal.onclick = () => rankingModal?.classList.remove("show");
  if (rankingModal)              rankingModal.onclick = e => { if (e.target === rankingModal) rankingModal.classList.remove("show"); };
  if (rankingFactorsBtn)         rankingFactorsBtn.onclick         = () => rankingFactorsModal?.classList.add("show");
  if (closeRankingFactorsModal)  closeRankingFactorsModal.onclick  = () => rankingFactorsModal?.classList.remove("show");
  if (rankingFactorsModal)       rankingFactorsModal.onclick = e => { if (e.target === rankingFactorsModal) rankingFactorsModal.classList.remove("show"); };

  if (applyRankingCategoryBtn) {
    applyRankingCategoryBtn.onclick = () => {
      selectedRankingCategory    = rankingCategorySelect.value;
      selectedRankingSubcategory = rankingSubcategorySelect.value;
      renderRanking();
      $("rankingCategoryModal").classList.remove("show");
    };
  }

  // Boot sequence — load vendor first, then render everything
  await loadCurrentVendor();
  await syncPeriod("This Month");
});
