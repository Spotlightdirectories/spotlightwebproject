"use client";

// ===============================================================
// src/app/(standalone)/insight/page.tsx
//
// Faithful port of production insight.html + insight.js — the
// "Business Insights" page reached from the vendor dashboard's
// profile-dropdown "Performance" link. Everything here is real,
// dynamic data from analytics_events / vendors / vendor_products /
// vendor_services / vendor_sponsorships — production's insight.js
// was already fully wired to live data (no hardcoded demo numbers
// left to port over), so this is a structural port, not a rebuild.
//
// Ported differences from the vanilla version:
// - Production's single 1270-line insight.js (DOM manipulation +
//   Supabase calls interleaved) is split here into: pure helper
//   functions (getPeriodRanges/calcGrowth/bucketRecords/health
//   scoring), async data-fetch functions parameterized by vendorId
//   instead of a module-level currentVendorId, and the component
//   itself which holds state and renders JSX instead of querying
//   the DOM by id.
// - Two small, deliberate fixes found while porting:
//   1) production's CSS never defined a background/color for the
//      "Catalog Visits" lead icon (.lead-icon-catalog) — every other
//      lead type had one. Added, matching the same palette.
//   2) the Growth Coach's two-button layout (See Details + Sponsor
//      Now) had a "coach-action-group" class in the generated HTML
//      with no matching CSS rule anywhere — added a small flex rule
//      so the two buttons actually line up instead of just stacking
//      as bare inline defaults.
//   3) production's .sponsor-status-text was color:#666 (dark gray)
//      set against the Sponsorship card's near-black gradient
//      background — a real legibility bug (dark gray text on a
//      near-black card is close to invisible). Changed to a light
//      gray (#ccc) consistent with the card's other text colors
//      (#B8B8B8 elsewhere in the same card).
// - Everything else (health score formula, growth-coach cross-
//   indexing into healthData.items, ranking logic against the
//   legacy vendors.category/subcategory text columns, the hardcoded
//   5-category ranking-category picker) is intentionally identical
//   to production, not "improved," since this module's numbers need
//   to match what a vendor already sees today.
//
// Known, not-yet-solved gaps (flagged for later, not fixed here):
// - "View All Products/Services" links land on /vendordashboard's
//   Overview tab, not the Products/Services tab directly — the
//   dashboard shell doesn't yet support a ?tab= deep link.
// - Marketplace Ranking's peer lookup uses vendors.category /
//   vendors.subcategory (plain text columns), same as production.
//   Once the Services-module category/subcategory restructuring
//   (Accounting & Finance / Insurance Services / Agency Services /
//   Legal Services / Business Consulting) lands, the ranking
//   category modal's hardcoded 5-category map here will need
//   updating to match — it's currently just as stale as production's
//   own copy of it.
// ===============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import { supabase } from "@/lib/supabase";
import styles from "./insight.module.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

type Period = "Today" | "This Week" | "This Month" | "This Quarter" | "This Year";
const PERIODS: Period[] = ["Today", "This Week", "This Month", "This Quarter", "This Year"];

type VendorRow = {
  id: string;
  name: string | null;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  open_time: string | null;
  close_time: string | null;
  business_days: string | null;
  whatsapp: string | null;
  telephone: string | null;
  email: string | null;
  verification_status: string | null;
  average_rating: number | null;
  reviews_count: number | null;
  category: string | null;
  subcategory: string | null;
};

type Sponsorship = {
  sponsorship_type: string;
  target_id: string | null;
  tier: string;
  expires_at: string;
  billing_cycle: string | null;
};

type StatWithGrowth = { value: number; growth: number | string; up: boolean };
type HealthItem = { label: string; score: number; max: number };
type HealthData = {
  total: number;
  items: HealthItem[];
  profileDetails: { logo: boolean; cover: boolean; description: boolean; hours: boolean; contact: boolean };
  catalogDetails: { products: number; services: number; total: number; required: number };
  reviewDetails: { rating: number; count: number };
};
type CoachItem = {
  title: string;
  done: boolean;
  impact: "high" | "recommended" | null;
  actionLabel: string;
  secondaryAction?: string | null;
};
type CatalogItem = { name: string; views: number };
type AudienceRow = { city: string; count: number; pct: number; cls: string };
type KeywordRow = { term: string; searches: number; pct: number };
type RankingState = { current: number | string; sponsored: number | null; category: string; totalPeers: number };
const RANKING_CATEGORY_MAP: Record<string, string[]> = {
  "Professional Services": ["Accountant / Auditor", "Tax Consultant", "Lawyer", "Architect"],
  "Fashion & Tailoring": ["Fashion Designer", "Tailor", "Makeup Artist", "Barber"],
  "Local Food & Canteens": ["Restaurant", "Caterer", "Bakery", "Food Vendor"],
  "Digital & Tech Services": ["Web Designer", "Graphic Designer", "Software Developer", "Digital Marketer"],
  "Home Services": ["Plumber", "Electrician", "Painter", "Cleaner"],
};

/* ===========================
   PURE HELPERS
=========================== */

function fmt(n: number | null | undefined) {
  return (n || 0).toLocaleString();
}

function getPeriodRanges(period: Period) {
  const now = new Date();
  let currentStart = new Date();
  let previousStart = new Date();
  let previousEnd = new Date();

  switch (period) {
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
    case "This Quarter": {
      const quarter = Math.floor(now.getMonth() / 3);
      currentStart = new Date(now.getFullYear(), quarter * 3, 1);
      previousStart = new Date(now.getFullYear(), quarter * 3 - 3, 1);
      previousEnd = new Date(currentStart);
      break;
    }
    case "This Year":
      currentStart = new Date(now.getFullYear(), 0, 1);
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(currentStart);
      break;
  }

  return { currentStart, currentEnd: now, previousStart, previousEnd };
}

function calcGrowth(current: number, previous: number): { growth: number | string; up: boolean } {
  if (!previous) return { growth: current > 0 ? "NEW" : 0, up: true };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { growth: Math.abs(pct), up: pct >= 0 };
}

function bucketRecords(records: { created_at: string }[], period: Period): { labels: string[]; values: number[] } {
  const get = (r: { created_at: string }) => new Date(r.created_at);

  if (period === "Today") {
    const labels = ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"];
    const slots: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
    records.forEach((r) => {
      const h = get(r).getHours();
      if (h < 3) slots["12am"]++;
      else if (h < 6) slots["3am"]++;
      else if (h < 9) slots["6am"]++;
      else if (h < 12) slots["9am"]++;
      else if (h < 15) slots["12pm"]++;
      else if (h < 18) slots["3pm"]++;
      else if (h < 21) slots["6pm"]++;
      else slots["9pm"]++;
    });
    return { labels, values: labels.map((l) => slots[l]) };
  }

  if (period === "This Week") {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const slots: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
    records.forEach((r) => {
      const day = get(r).toLocaleDateString("en-US", { weekday: "short" });
      if (day in slots) slots[day]++;
    });
    return { labels: days, values: days.map((d) => slots[d]) };
  }

  if (period === "This Month") {
    const labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
    const slots: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
    records.forEach((r) => {
      const day = get(r).getDate();
      if (day <= 7) slots["Week 1"]++;
      else if (day <= 14) slots["Week 2"]++;
      else if (day <= 21) slots["Week 3"]++;
      else slots["Week 4"]++;
    });
    return { labels, values: labels.map((l) => slots[l]) };
  }

  if (period === "This Quarter") {
    const now = new Date();
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = [monthNames[quarterMonth], monthNames[quarterMonth + 1], monthNames[quarterMonth + 2]];
    const slots: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
    records.forEach((r) => {
      const label = monthNames[get(r).getMonth()];
      if (label in slots) slots[label]++;
    });
    return { labels, values: labels.map((l) => slots[l]) };
  }

  // This Year
  const labels = ["Q1", "Q2", "Q3", "Q4"];
  const slots: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
  records.forEach((r) => {
    const q = Math.floor(get(r).getMonth() / 3);
    slots[`Q${q + 1}`]++;
  });
  return { labels, values: labels.map((l) => slots[l]) };
}

function healthLabelFor(score: number) {
  if (score >= 80) return "Excellent Visibility";
  if (score >= 60) return "Good Visibility";
  if (score >= 40) return "Fair Visibility";
  return "Needs Improvement";
}

/* ===========================
   DATA FETCHERS (module scope,
   parameterized by vendorId so
   there's no stale-closure risk)
=========================== */

async function countEvents(vendorId: string, eventType: string | null, start: Date, end?: Date): Promise<number> {
  let query = supabase
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .gte("created_at", start.toISOString());
  if (eventType) query = query.eq("event_type", eventType);
  if (end) query = query.lt("created_at", end.toISOString());
  const { count } = await query;
  return count || 0;
}

async function fetchEvents(
  vendorId: string,
  fields: string,
  currentStart: Date,
  eventType?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  let query = supabase
    .from("analytics_events")
    .select(fields)
    .eq("vendor_id", vendorId)
    .gte("created_at", currentStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);
  if (eventType) query = query.eq("event_type", eventType);
  const { data, error } = await query;
  if (error) console.error("fetchEvents error:", error);
  return data || [];
}

async function getStatWithGrowth(
  vendorId: string,
  eventType: string,
  ranges: ReturnType<typeof getPeriodRanges>
): Promise<StatWithGrowth> {
  // current/previous don't depend on each other — run them together
  // instead of one after another. This (plus the same fix applied to
  // every other current/previous pair below, and firing all six
  // period-data sections independently instead of one after another)
  // is what was making period switching feel ~3s slower here than in
  // production: the port had accidentally serialized what production
  // runs concurrently.
  const [current, previous] = await Promise.all([
    countEvents(vendorId, eventType, ranges.currentStart),
    countEvents(vendorId, eventType, ranges.previousStart, ranges.previousEnd),
  ]);
  return { value: current, ...calcGrowth(current, previous) };
}

async function getUniqueVisitorsWithGrowth(
  vendorId: string,
  ranges: ReturnType<typeof getPeriodRanges>
): Promise<StatWithGrowth> {
  const getUnique = async (start: Date, end?: Date) => {
    let query = supabase
      .from("analytics_events")
      .select("visitor_id")
      .eq("vendor_id", vendorId)
      .gte("created_at", start.toISOString());
    if (end) query = query.lt("created_at", end.toISOString());
    const { data } = await query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Set((data || []).map((r: any) => r.visitor_id).filter(Boolean)).size;
  };
  const [current, previous] = await Promise.all([
    getUnique(ranges.currentStart),
    getUnique(ranges.previousStart, ranges.previousEnd),
  ]);
  return { value: current, ...calcGrowth(current, previous) };
}

// ---------------------------------------------------------------
// The six period-scoped sections below are deliberately six
// SEPARATE functions instead of one big "loadPeriodData" — the
// component fires all six independently (see the effect in
// InsightPage) so each renders the moment ITS OWN query resolves,
// the same way production's syncPeriod() runs all seven of its
// render* functions concurrently via Promise.all instead of one
// after another. A single combined loader would force the whole
// page to wait for its single slowest section before showing
// anything.
// ---------------------------------------------------------------

async function loadStats(
  vendorId: string,
  period: Period
): Promise<{ label: string; value: number; growth: number | string; up: boolean }[]> {
  const ranges = getPeriodRanges(period);
  const [profileViews, uniqueVisitors, searchImpressions] = await Promise.all([
    getStatWithGrowth(vendorId, "profile_view", ranges),
    getUniqueVisitorsWithGrowth(vendorId, ranges),
    getStatWithGrowth(vendorId, "search_impression", ranges),
  ]);
  return [
    { label: "Profile Views", ...profileViews },
    { label: "Unique Visitors", ...uniqueVisitors },
    { label: "Search Impressions", ...searchImpressions },
  ];
}

async function loadChart(vendorId: string, period: Period): Promise<{ labels: string[]; values: number[] }> {
  const ranges = getPeriodRanges(period);
  const chartRecords = await fetchEvents(vendorId, "created_at", ranges.currentStart, "profile_view");
  return bucketRecords(chartRecords as { created_at: string }[], period);
}

async function loadLeads(
  vendorId: string,
  period: Period
): Promise<{ label: string; icon: string; cls: string; value: number; growth: number | string; up: boolean }[]> {
  const ranges = getPeriodRanges(period);
  const leadTypes = [
    { label: "WhatsApp Chats", icon: "fa-brands fa-whatsapp", cls: styles["lead-icon-whatsapp"], event: "whatsapp_click" },
    { label: "Phone Calls", icon: "fa-solid fa-phone", cls: styles["lead-icon-phone"], event: "phone_click" },
    { label: "Directions", icon: "fa-solid fa-location-dot", cls: styles["lead-icon-direction"], event: "direction_click" },
    { label: "Catalog Visits", icon: "fa-solid fa-book-open", cls: styles["lead-icon-catalog"], event: "catalog_visit" },
    {
      label: "External Visits",
      icon: "fa-solid fa-arrow-up-right-from-square",
      cls: styles["lead-icon-external"],
      event: "external_visit",
    },
  ];
  return Promise.all(
    leadTypes.map(async (lt) => {
      const [current, previous] = await Promise.all([
        countEvents(vendorId, lt.event, ranges.currentStart),
        countEvents(vendorId, lt.event, ranges.previousStart, ranges.previousEnd),
      ]);
      return { label: lt.label, icon: lt.icon, cls: lt.cls || "", value: current, ...calcGrowth(current, previous) };
    })
  );
}

async function loadAudience(vendorId: string, period: Period): Promise<{ total: number; rows: AudienceRow[] }> {
  const ranges = getPeriodRanges(period);

  const totalCountPromise = (async () => {
    try {
      const { count } = await supabase
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", vendorId)
        .gte("created_at", ranges.currentStart.toISOString());
      return typeof count === "number" ? count : null;
    } catch (err) {
      console.error("Audience total count error:", err);
      return null;
    }
  })();

  const [audienceRecords, totalCount] = await Promise.all([
    fetchEvents(vendorId, "visitor_id,visitor_state,visitor_lga", ranges.currentStart),
    totalCountPromise,
  ]);

  let total = audienceRecords.length;
  if (typeof totalCount === "number") total = totalCount;

  const stateMap: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (audienceRecords as any[]).forEach((r) => {
    const state = r.visitor_state || "Unknown";
    stateMap[state] = (stateMap[state] || 0) + 1;
  });
  const sampleSize = audienceRecords.length;
  const sortedStates = Object.entries(stateMap).sort((a, b) => b[1] - a[1]);
  const dotClasses = ["dot-red", "dot-blue", "dot-green", "dot-gold", "dot-purple", "dot-gray"];
  const top5 = sortedStates.slice(0, 5);
  const othersCount = sortedStates.slice(5).reduce((s, [, n]) => s + n, 0);
  const rows: AudienceRow[] = [
    ...top5.map(([state, count], i) => ({
      city: state,
      count,
      pct: sampleSize ? Math.round((count / sampleSize) * 100) : 0,
      cls: dotClasses[i],
    })),
    ...(othersCount > 0
      ? [{ city: "Others", count: othersCount, pct: sampleSize ? Math.round((othersCount / sampleSize) * 100) : 0, cls: "dot-gray" }]
      : []),
  ];

  return { total, rows };
}

async function loadKeywords(vendorId: string, period: Period): Promise<KeywordRow[]> {
  const ranges = getPeriodRanges(period);
  const keywordRecords = await fetchEvents(vendorId, "search_keyword", ranges.currentStart, "search_impression");
  const termMap: Record<string, number> = {};
  const displayMap: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (keywordRecords as any[]).forEach((r) => {
    const raw = (r.search_keyword || "").trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    termMap[key] = (termMap[key] || 0) + 1;
    if (!displayMap[key]) {
      displayMap[key] = raw.replace(/\w\S*/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
  });
  const keyworded = Object.values(termMap).reduce((s, n) => s + n, 0) || 1;
  return Object.entries(termMap)
    .sort((a, b) => b[1] - a[1])
    .map(([key, searches]) => ({ term: displayMap[key], searches, pct: Math.round((searches / keyworded) * 100) }));
}

async function loadCatalog(vendorId: string, period: Period): Promise<{ products: CatalogItem[]; services: CatalogItem[] }> {
  const ranges = getPeriodRanges(period);

  const [productRes, serviceRes] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("product_id, vendor_products(id, product_name)")
      .eq("vendor_id", vendorId)
      .eq("event_type", "product_view")
      .not("product_id", "is", null)
      .gte("created_at", ranges.currentStart.toISOString()),
    supabase
      .from("analytics_events")
      .select("service_id, vendor_services(id, service_name)")
      .eq("vendor_id", vendorId)
      .eq("event_type", "service_view")
      .not("service_id", "is", null)
      .gte("created_at", ranges.currentStart.toISOString()),
  ]);

  if (productRes.error) console.error("Catalog product query error:", productRes.error);
  if (serviceRes.error) console.error("Catalog service query error:", serviceRes.error);

  const productMap: Record<string, CatalogItem> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (productRes.data || []).forEach((r: any) => {
    const id = r.product_id;
    const name = r.vendor_products?.product_name || `Product ${id?.slice(0, 8)}`;
    if (!productMap[id]) productMap[id] = { name, views: 0 };
    productMap[id].views++;
  });
  const serviceMap: Record<string, CatalogItem> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (serviceRes.data || []).forEach((r: any) => {
    const id = r.service_id;
    const name = r.vendor_services?.service_name || `Service ${id?.slice(0, 8)}`;
    if (!serviceMap[id]) serviceMap[id] = { name, views: 0 };
    serviceMap[id].views++;
  });

  return {
    products: Object.values(productMap).sort((a, b) => b.views - a.views),
    services: Object.values(serviceMap).sort((a, b) => b.views - a.views),
  };
}

async function computeHealthScore(vendor: VendorRow, activeSponsorships: Sponsorship[]): Promise<HealthData> {
  const profileDetails = {
    logo: !!vendor.logo_url,
    cover: !!vendor.cover_url,
    description: !!(vendor.description && vendor.description.replace(/<[^>]*>/g, "").trim()),
    hours: !!(vendor.open_time && vendor.close_time && vendor.business_days),
    contact: !!((vendor.whatsapp || vendor.telephone) && vendor.email),
  };
  const profileScore = Object.values(profileDetails).filter(Boolean).length * 4;

  let verificationScore = 0;
  if (vendor.verification_status === "blue") verificationScore = 20;
  else if (vendor.verification_status === "gray") verificationScore = 12;

  const rating = Number(vendor.average_rating || 0);
  const reviewCount = Number(vendor.reviews_count || 0);
  const reviewsScore = Math.round((rating / 5) * 12 + Math.min(reviewCount / 10, 1) * 8);

  const { count: productCount } = await supabase
    .from("vendor_products")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", vendor.id);
  const { count: serviceCount } = await supabase
    .from("vendor_services")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", vendor.id);

  const totalListings = (productCount || 0) + (serviceCount || 0);
  const catalogRequired = 6;
  const catalogScore = Math.round(Math.min(totalListings / catalogRequired, 1) * 20);

  const sponsorshipScore = activeSponsorships.length > 0 ? 20 : 0;
  const total = Math.min(100, profileScore + verificationScore + reviewsScore + catalogScore + sponsorshipScore);

  return {
    total,
    items: [
      { label: "Profile Completeness", score: profileScore, max: 20 },
      { label: "Verification", score: verificationScore, max: 20 },
      { label: "Reviews", score: reviewsScore, max: 20 },
      { label: "Catalog", score: catalogScore, max: 20 },
      { label: "Sponsorship", score: sponsorshipScore, max: 20 },
    ],
    profileDetails,
    catalogDetails: { products: productCount || 0, services: serviceCount || 0, total: totalListings, required: catalogRequired },
    reviewDetails: { rating, count: reviewCount },
  };
}

function buildCoachItems(healthData: HealthData, activeSponsorships: Sponsorship[]): CoachItem[] {
  return [
    {
      title: "Complete Profile",
      done: healthData.items[0].score >= 20,
      impact: healthData.items[0].score >= 20 ? null : "recommended",
      actionLabel: "See Details",
    },
    {
      title: "Complete Business Verification",
      done: healthData.items[1].score >= 20,
      impact: healthData.items[1].score >= 20 ? null : "high",
      actionLabel: "See Details",
    },
    {
      title: "Add & Complete Products / Services",
      done: healthData.items[3].score >= 20,
      impact: healthData.items[3].score >= 20 ? null : "high",
      actionLabel: "See Details",
    },
    {
      title: "Get More Reviews",
      done: healthData.items[2].score >= 20,
      impact: healthData.items[2].score >= 20 ? null : "recommended",
      actionLabel: "See Details",
    },
    {
      title: "Sponsor Business / Products / Services",
      done: activeSponsorships.length > 0,
      impact: activeSponsorships.length > 0 ? null : "high",
      actionLabel: "See Details",
      secondaryAction: activeSponsorships.length > 0 ? null : "Sponsor Now",
    },
  ];
}

async function loadRanking(vendorId: string, category: string, subcategory: string, period: Period): Promise<RankingState> {
  const { currentStart } = getPeriodRanges(period);
  const combinedLabel = `${category} / ${subcategory}`;

  // Fixed 2026-07-31: this used to fetch peer vendor IDs and then
  // query analytics_events directly filtered to those IDs. That
  // table's RLS only ever lets a vendor read their OWN rows, so every
  // peer silently came back with zero events — the comparison was
  // never real. get_vendor_period_ranking runs the same computation
  // server-side (SECURITY DEFINER, same pattern as get_vendor_rank),
  // returning only the aggregate rank numbers.
  const { data, error } = await supabase
    .rpc("get_vendor_period_ranking", {
      p_vendor_id: vendorId,
      p_category: category,
      p_subcategory: subcategory,
      p_period_start: currentStart.toISOString(),
    })
    .maybeSingle()
    .returns<{ view_rank: number | null; sponsored_rank: number | null; total_peers: number } | null>();

  if (error || !data || !data.total_peers) {
    return { current: "—", sponsored: null, category: combinedLabel, totalPeers: data?.total_peers ?? 0 };
  }

  return {
    current: data.view_rank ?? "—",
    sponsored: data.sponsored_rank,
    category: combinedLabel,
    totalPeers: data.total_peers,
  };
}

/* ===========================
   SMALL PRESENTATIONAL PIECES
=========================== */

function LineChart({ labels, values }: { labels: string[]; values: number[] }) {
  const W = 600;
  const H = 160;
  const PAD = 20;
  const max = Math.max(...values, 1);
  const xStep = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
  const points: [number, number][] = values.map((v, i) => {
    const x = PAD + xStep * i;
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return [x, y];
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1][0]} ${H - PAD} L ${points[0][0]} ${H - PAD} Z`
    : "";

  return (
    <>
      <svg className={styles["line-chart"]} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E6B800" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#E6B800" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const y = PAD + ((H - PAD * 2) / 4) * i;
          return <line key={i} x1={0} y1={y} x2={W} y2={y} className={styles["chart-grid-line"]} />;
        })}
        {areaPath && <path d={areaPath} fill="url(#areaGradient)" />}
        {linePath && <path d={linePath} className={styles["chart-line"]} />}
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="#E6B800" />
        ))}
      </svg>
      <div className={styles["chart-x-axis"]}>
        {labels.map((l, i) => (
          <span key={l + i}>{l}</span>
        ))}
      </div>
    </>
  );
}

function RankList({ items }: { items: CatalogItem[] }) {
  return (
    <div>
      {items.length ? (
        items.map((it, i) => (
          <div key={it.name + i} className={styles["rank-row"]}>
            <div className={styles["rank-num"]}>{i + 1}</div>
            <div className={styles["rank-name"]}>{it.name}</div>
            <div className={styles["rank-views"]}>{fmt(it.views)} views</div>
          </div>
        ))
      ) : (
        <div className={styles["rank-row"]}>
          <div className={styles["rank-name"]} style={{ color: "var(--ink-soft)" }}>
            No data yet
          </div>
        </div>
      )}
    </div>
  );
}

function CoachDetail({
  index,
  healthData,
  vendor,
  activeSponsorships,
}: {
  index: number;
  healthData: HealthData;
  vendor: VendorRow;
  activeSponsorships: Sponsorship[];
}) {
  if (index === 0) {
    const d = healthData.profileDetails;
    return (
      <>
        <div className={styles["coach-detail-score"]}>Current Score: {healthData.items[0].score}/20</div>
        <div>{d.logo ? "✓" : "✗"} Logo</div>
        <div>{d.cover ? "✓" : "✗"} Cover Image</div>
        <div>{d.description ? "✓" : "✗"} Business Description</div>
        <div>{d.hours ? "✓" : "✗"} Business Hours</div>
        <div>{d.contact ? "✓" : "✗"} Contact Information</div>
      </>
    );
  }
  if (index === 1) {
    return (
      <>
        <div className={styles["coach-detail-score"]}>Current Score: {healthData.items[1].score}/20</div>
        <div>
          {vendor.verification_status && vendor.verification_status !== "none" ? "✓" : "✗"} Business Verified
          {vendor.verification_status === "blue"
            ? " (Fully Verified)"
            : vendor.verification_status === "gray"
              ? " (Partially Verified)"
              : ""}
        </div>
      </>
    );
  }
  if (index === 2) {
    const cd = healthData.catalogDetails;
    return (
      <>
        <div className={styles["coach-detail-score"]}>Current Score: {healthData.items[3].score}/20</div>
        <div>
          Products: {cd.products} | Services: {cd.services}
        </div>
        <div>
          Current Listings: {cd.total} / Recommended: {cd.required}
        </div>
        <div>
          {cd.total < cd.required ? `${cd.required - cd.total} more listing(s) recommended` : "You've met the recommended catalog size."}
        </div>
      </>
    );
  }
  if (index === 3) {
    return (
      <>
        <div className={styles["coach-detail-score"]}>Current Score: {healthData.items[2].score}/20</div>
        <div>Average Rating: {healthData.reviewDetails.rating.toFixed(1)} / 5</div>
        <div>Total Reviews: {healthData.reviewDetails.count}</div>
      </>
    );
  }
  return (
    <>
      <div className={styles["coach-detail-score"]}>Current Score: {healthData.items[4].score}/20</div>
      <div>
        {activeSponsorships.length > 0
          ? `Currently sponsoring ${activeSponsorships.length} item${activeSponsorships.length > 1 ? "s" : ""} (business/product/service combined)`
          : "Not currently sponsoring anything"}
      </div>
    </>
  );
}

/* ===========================
   PAGE
=========================== */

export default function InsightPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [activeSponsorships, setActiveSponsorships] = useState<Sponsorship[]>([]);
  const [businessSponsorship, setBusinessSponsorship] = useState<Sponsorship | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const [period, setPeriod] = useState<Period>("This Month");

  // Six independent pieces of state instead of one combined
  // "periodData" object — each is fetched and set by its own call
  // below, so a card renders the instant ITS OWN query resolves
  // rather than everyone waiting for whichever section is slowest.
  const [stats, setStats] = useState<{ label: string; value: number; growth: number | string; up: boolean }[]>([]);
  const [chart, setChart] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });
  const [leads, setLeads] = useState<{ label: string; icon: string; cls: string; value: number; growth: number | string; up: boolean }[]>([]);
  const [catalog, setCatalog] = useState<{ products: CatalogItem[]; services: CatalogItem[] }>({ products: [], services: [] });
  const [audience, setAudience] = useState<{ total: number; rows: AudienceRow[] }>({ total: 0, rows: [] });
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);

  const [rankingCategory, setRankingCategory] = useState("Professional Services");
  const [rankingSubcategory, setRankingSubcategory] = useState("Accountant / Auditor");
  const [ranking, setRanking] = useState<RankingState | null>(null);
  const [modalCategory, setModalCategory] = useState("Professional Services");
  const [modalSubcategory, setModalSubcategory] = useState("Accountant / Auditor");

  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [expandedCoachIndex, setExpandedCoachIndex] = useState<number | null>(null);
  const [coachBreakdownOpen, setCoachBreakdownOpen] = useState(false);

  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [rankingCategoryModalOpen, setRankingCategoryModalOpen] = useState(false);
  const [rankingFactorsModalOpen, setRankingFactorsModalOpen] = useState(false);

  // ---- One-time load: auth, vendor, sponsorships, health score ----
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        router.replace("/login");
        return;
      }

      const { data: vendorRow } = await supabase.from("vendors").select("*").eq("auth_user_id", authData.user.id).single();
      if (cancelled) return;

      if (!vendorRow) {
        setLoading(false);
        return;
      }

      setVendor(vendorRow as VendorRow);

      const { data: sponsorships } = await supabase
        .from("vendor_sponsorships")
        .select("sponsorship_type, target_id, tier, expires_at, billing_cycle")
        .eq("vendor_id", vendorRow.id)
        .eq("payment_status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });
      if (cancelled) return;

      const active = (sponsorships || []) as Sponsorship[];
      setActiveSponsorships(active);
      setBusinessSponsorship(active.find((s) => s.sponsorship_type === "business") || null);

      const health = await computeHealthScore(vendorRow as VendorRow, active);
      if (cancelled) return;
      setHealthData(health);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ---- Period-dependent data: six independent fetches fired
  // together, each updating its own state as soon as it resolves.
  // (Previously this awaited one combined loader that fetched
  // everything sequentially — that was the ~3s slowdown vs.
  // production, which runs its equivalent sections concurrently too.)
  useEffect(() => {
    if (!vendor) return;
    let cancelled = false;

    loadStats(vendor.id, period).then((r) => { if (!cancelled) setStats(r); });
    loadChart(vendor.id, period).then((r) => { if (!cancelled) setChart(r); });
    loadLeads(vendor.id, period).then((r) => { if (!cancelled) setLeads(r); });
    loadAudience(vendor.id, period).then((r) => { if (!cancelled) setAudience(r); });
    loadKeywords(vendor.id, period).then((r) => { if (!cancelled) setKeywords(r); });
    loadCatalog(vendor.id, period).then((r) => { if (!cancelled) setCatalog(r); });

    return () => {
      cancelled = true;
    };
  }, [vendor, period]);

  // ---- Ranking (depends on period + chosen category/subcategory) ----
  useEffect(() => {
    if (!vendor) return;
    let cancelled = false;
    loadRanking(vendor.id, rankingCategory, rankingSubcategory, period).then((data) => {
      if (!cancelled) setRanking(data);
    });
    return () => {
      cancelled = true;
    };
  }, [vendor, period, rankingCategory, rankingSubcategory]);

  if (loading) {
    return (
      <div className={`${styles["loading-wrap"]} ${inter.className}`}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className={`${styles["loading-wrap"]} ${inter.className}`}>
        <p>Vendor record not found.</p>
      </div>
    );
  }

  const coachItems = healthData ? buildCoachItems(healthData, activeSponsorships) : [];
  const stars = healthData ? Math.max(1, Math.min(5, Math.round(healthData.total / 20))) : 0;
  const fullLength = Math.PI * 90;
  const gaugePct = healthData ? healthData.total / 100 : 0;

  const nearest = activeSponsorships[0]; // already sorted soonest-first by the query
  const othersCount = Math.max(0, activeSponsorships.length - 1);
  const nearestDaysLeft = nearest
    ? Math.max(0, Math.ceil((new Date(nearest.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  function sponsorStatusText(): string {
    if (!nearest) return "Sponsor your business to appear first in search results and reach more customers.";
    const typeLabel = nearest.sponsorship_type === "business" ? "your business" : nearest.sponsorship_type === "product" ? "a product" : "a service";
    const expiryDate = new Date(nearest.expires_at).toLocaleDateString();
    const othersNote =
      othersCount > 0
        ? ` You also have ${othersCount} other active sponsorship${othersCount > 1 ? "s" : ""} — see full details in Sponsorship History on your dashboard.`
        : "";
    return `${nearest.tier.charAt(0).toUpperCase() + nearest.tier.slice(1)}-tier sponsorship on ${typeLabel} is active until ${expiryDate}.${othersNote}`;
  }

  function dateRangeLabel(): string {
    const today = new Date();
    let start = new Date(today);
    switch (period) {
      case "Today":
        start = new Date(today);
        break;
      case "This Week":
        start.setDate(today.getDate() - 6);
        break;
      case "This Quarter":
        start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        break;
      case "This Year":
        start = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    return `${start.toLocaleDateString("en-US", opts)} – ${today.toLocaleDateString("en-US", opts)}`;
  }

  const rankFactorSponsored = businessSponsorship ? `Yes (${businessSponsorship.tier})` : "No";
  const rankFactorVerification =
    vendor.verification_status === "blue" ? "Fully Verified" : vendor.verification_status === "gray" ? "Partially Verified" : "Not Verified";

  const maxRank = ranking ? Math.max(ranking.totalPeers, 50) : 50;
  const rankPct = ranking && typeof ranking.current === "number" ? Math.max(2, Math.min(98, (ranking.current / maxRank) * 100)) : 50;

  const periodSelect = (
    <select className={styles["period-select"]} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
      {PERIODS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );

  return (
    <div className={`${styles.page} ${inter.className}`}>
      <header className={styles.header}>
        <button type="button" className={styles["back-dashboard-btn"]} onClick={() => router.push("/vendordashboard")}>
          ← Dashboard
        </button>
        <div>
          <h1>Business Insights</h1>
          <p>Track your performance, leads and discover opportunities to grow your business.</p>
        </div>
        <div className={styles["header-actions"]}>
          <button type="button" className={styles["date-pill"]}>
            {dateRangeLabel()}
          </button>
        </div>
      </header>

      {/* Row 1: Health Score + Marketplace Performance */}
      <div className={`${styles.grid} ${styles["grid-2-1"]}`}>
        <section className={styles.card}>
          <div className={styles["card-head"]}>
            <h2>Business Health Score</h2>
            <span className={styles["info-dot"]} title="Composite score of profile completeness, activity and reviews">
              ⓘ
            </span>
          </div>
          <div className={styles["health-score"]}>
            <svg className={styles.gauge} viewBox="0 0 200 110">
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D93025" />
                  <stop offset="50%" stopColor="#E6B800" />
                  <stop offset="100%" stopColor="#1E8E3E" />
                </linearGradient>
              </defs>
              <path className={styles["gauge-track"]} d="M10,100 A90,90 0 0 1 190,100" />
              <path
                className={styles["gauge-fill"]}
                d="M10,100 A90,90 0 0 1 190,100"
                style={{ strokeDasharray: `${fullLength * gaugePct} ${fullLength}` }}
              />
            </svg>
            <div className={styles["gauge-center"]}>
              <div className={styles["gauge-value"]}>{healthData?.total ?? 0}</div>
              <div className={styles["gauge-max"]}>/100</div>
            </div>
          </div>
          <div className={styles["health-label"]}>{healthData ? healthLabelFor(healthData.total) : ""}</div>
          <div className={styles.stars}>
            {"★".repeat(stars)}
            {"☆".repeat(5 - stars)}
          </div>
          <button type="button" className={styles["health-details-btn"]} onClick={() => setHealthModalOpen(true)}>
            View Score Breakdown →
          </button>
        </section>

        <section className={styles.card}>
          <div className={styles["card-head"]}>
            <h2>Marketplace Performance</h2>
            {periodSelect}
          </div>
          <div className={styles["grid-3"]}>
            {stats.map((s) => (
              <div key={s.label} className={styles["perf-stat"]}>
                <div className={styles["p-lbl"]}>{s.label}</div>
                <div className={styles["p-val"]}>{fmt(s.value)}</div>
                <div className={`${styles["p-trend"]} ${s.up ? styles.up : styles.down}`}>
                  {s.up ? "▲" : "▼"} {s.growth}
                  {s.growth !== "NEW" ? "%" : ""}
                </div>
              </div>
            ))}
          </div>
          <div className={styles["chart-wrap"]}>
            <LineChart labels={chart.labels} values={chart.values} />
          </div>
        </section>
      </div>

      {/* Row 2: Lead Generation */}
      <section className={styles.card}>
        <div className={styles["card-head"]}>
          <h2>Lead Generation</h2>
          {periodSelect}
        </div>
        <div className={styles["grid-4"]}>
          {leads.map((l) => (
            <div key={l.label} className={styles["lead-card"]}>
              <div className={`${styles["lead-icon"]} ${l.cls}`}>
                <i className={l.icon} />
              </div>
              <div className={styles["lead-label"]}>{l.label}</div>
              <div className={styles["lead-value"]}>{fmt(l.value)}</div>
              <div className={`${styles["lead-trend"]} ${l.up ? styles.up : styles.down}`}>
                {l.up ? "▲" : "▼"} {l.growth}
                {l.growth !== "NEW" ? "%" : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Row 3: Sponsorship + Catalog */}
      <div className={`${styles.grid} ${styles["grid-1-1"]}`}>
        <section className={styles["sponsor-card"]}>
          <div className={styles["sponsor-header"]}>
            <h2>Sponsorship</h2>
            <span className={styles["badge-active"]}>{activeSponsorships.length > 0 ? "Active" : "Not Sponsored"}</span>
          </div>
          <div className={styles["sponsor-summary"]}>
            <div className={styles["sponsor-status-text"]}>{sponsorStatusText()}</div>
          </div>

          {activeSponsorships.length > 0 && (
            <div className={`${styles["sponsor-countdown-box"]} ${nearestDaysLeft <= 7 ? styles.urgent : ""}`}>
              <p className={styles["sponsor-countdown-label"]}>
                {othersCount > 0 ? "NEAREST SPONSORSHIP EXPIRES SOON" : "SPONSORSHIP EXPIRES IN"}
              </p>
              <p className={styles["sponsor-countdown-days"]}>{nearestDaysLeft === 1 ? "1 Day Left" : `${nearestDaysLeft} Days Left`}</p>
            </div>
          )}

          <button type="button" className={styles["manage-sub-btn"]} onClick={() => router.push("/getsponsored")}>
            {activeSponsorships.length > 0 ? "Manage Sponsorship" : "Sponsor Now"}
          </button>
        </section>

        <section className={styles.card}>
          <div className={styles["card-head"]}>
            <h2>Catalog Performance</h2>
          </div>
          <div className={styles["catalog-lists"]}>
            <div>
              <div className={styles["list-head"]}>Top Products</div>
              <RankList items={catalog.products.slice(0, 5)} />
              {catalog.products.length > 5 && (
                <a className={styles["view-all-link"]} href="/vendordashboard">
                  View All Products →
                </a>
              )}
            </div>
            <div>
              <div className={styles["list-head"]}>Top Services</div>
              <RankList items={catalog.services.slice(0, 5)} />
              {catalog.services.length > 5 && (
                <a className={styles["view-all-link"]} href="/vendordashboard">
                  View All Services →
                </a>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Row 4: Marketplace Ranking + Audience */}
      <div className={`${styles.grid} ${styles["grid-1-1"]}`}>
        <section className={styles.card}>
          <div className={styles["card-head"]}>
            <h2>Marketplace Ranking</h2>
            <span className={styles["info-dot"]} title="Your position among similar businesses in your category">
              ⓘ
            </span>
          </div>

          <div className={styles["rank-cols"]}>
            <div className={styles["rank-col"]}>
              <div className={styles["rank-tag"]}>Current Ranking</div>
              <div className={styles["rank-number"]}>
                {typeof ranking?.current === "number" ? `#${ranking.current}` : (ranking?.current ?? "—")}
              </div>
              <div className={styles["rank-sub"]}>{ranking?.category ?? ""}</div>
            </div>
            <div className={styles["rank-col"]}>
              <div className={styles["rank-tag"]}>With Sponsorship</div>
              <div className={`${styles["rank-number"]} ${styles["rank-number-green"]}`}>
                {ranking?.sponsored ? (ranking.sponsored <= 5 ? `Top ${ranking.sponsored}` : `#${ranking.sponsored}`) : "—"}
              </div>
              <div className={styles["rank-sub"]}>within this niche</div>
            </div>
          </div>

          <div className={styles["rank-scale"]}>
            <div className={styles["rank-line"]}>
              <div className={styles["rank-current-dot"]} style={{ left: `${rankPct}%` }} />
            </div>
            <div className={styles["rank-left-label"]}>#{maxRank}</div>
            <div className={styles["rank-current-label"]}>
              {typeof ranking?.current === "number" ? `#${ranking.current}` : (ranking?.current ?? "—")}
            </div>
            <div className={styles["rank-right-label"]}>{ranking?.sponsored ? `🏆 Top ${ranking.sponsored}` : "—"}</div>
          </div>

          <p className={styles["rank-note"]}>
            {typeof ranking?.current === "number" && ranking.current <= 10
              ? "You're doing great! Sponsor your business to reach Top 5."
              : "Sponsor your business to move up in search results and reach more customers."}
          </p>

          <div className={styles["rank-actions"]}>
            <button type="button" className={styles["how-it-works-btn"]} onClick={() => setRankingFactorsModalOpen(true)}>
              Ranking Factors
            </button>
            <button
              type="button"
              className={`${styles["how-it-works-btn"]} ${styles["secondary-btn"]}`}
              onClick={() => {
                setModalCategory(rankingCategory);
                setModalSubcategory(rankingSubcategory);
                setRankingCategoryModalOpen(true);
              }}
            >
              Change Category
            </button>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles["card-head"]}>
            <h2>Audience</h2>
            <span className={styles["view-all-link"]}>Location Distribution</span>
          </div>
          <div className={styles["audience-summary"]}>
            <div className={styles["audience-total"]}>{fmt(audience.total)}</div>
            <div className={styles["audience-caption"]}>People reached this period</div>
          </div>
          <div>
            {audience.rows.length === 0 ? (
              <div className={styles["audience-row"]}>
                <span style={{ color: "var(--ink-soft)" }}>No audience data yet</span>
              </div>
            ) : (
              audience.rows.map((a, i) => (
                <div key={a.city + i} className={styles["audience-row"]}>
                  <span className={`${styles["audience-dot"]} ${styles[a.cls]}`} />
                  <span className={styles["audience-city"]}>{a.city}</span>
                  <span className={styles["audience-count"]}>{fmt(a.count)}</span>
                  <span className={styles["audience-pct"]}>{a.pct}%</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Row 5: Search Keywords + Growth Coach */}
      <div className={`${styles.grid} ${styles["grid-1-1"]}`}>
        <section className={styles.card}>
          <div className={styles["card-head"]}>
            <h2>Search Keywords</h2>
          </div>
          <p className={styles["section-cap"]}>Keywords people used to find your business</p>
          <div>
            {(() => {
              const shown = showAllKeywords ? keywords : keywords.slice(0, 5);
              if (!shown.length) {
                return (
                  <div className={styles["kw-row"]}>
                    <span style={{ color: "var(--ink-soft)" }}>No keyword data yet</span>
                  </div>
                );
              }
              return shown.map((k, i) => (
                <div key={k.term + i} className={styles["kw-row"]}>
                  <div className={styles["kw-top"]}>
                    <span>{k.term}</span>
                    <span className={styles["kw-metrics"]}>
                      <span>{fmt(k.searches)}</span>
                      <span>{k.pct}%</span>
                    </span>
                  </div>
                  <div className={styles["kw-bar-track"]}>
                    <div className={styles["kw-bar-fill"]} style={{ width: `${k.pct}%` }} />
                  </div>
                </div>
              ));
            })()}
          </div>
          {keywords.length > 5 && (
            <a
              className={styles["view-all-link"]}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setShowAllKeywords((v) => !v);
              }}
            >
              {showAllKeywords ? "View Less Keywords ↑" : "View All Keywords →"}
            </a>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles["card-head"]}>
            <h2>Growth Coach</h2>
            <span className={styles["info-dot"]} title="Personalized actions to improve visibility">
              ⓘ
            </span>
          </div>
          <p className={styles["section-cap"]}>Complete these actions to improve your visibility score and generate more leads.</p>
          <div className={styles["coach-score-tip"]}>Complete the remaining tasks to increase your Business Health Score.</div>

          <div>
            {coachItems.map((c, index) => (
              <div key={c.title}>
                <div className={styles["coach-item"]}>
                  <div className={`${styles["coach-status"]} ${c.done ? styles.done : styles.todo}`}>{c.done ? "✓" : "○"}</div>
                  <div className={styles["coach-body"]}>
                    <div className={styles["coach-title"]}>{c.title}</div>
                    {c.impact && (
                      <div className={`${styles["coach-impact"]} ${c.impact === "high" ? styles.high : styles.recommended}`}>
                        {c.impact === "high" ? "High Impact" : "Recommended"}
                      </div>
                    )}
                  </div>
                  {c.secondaryAction ? (
                    <div className={styles["coach-action-group"]}>
                      <button
                        type="button"
                        className={styles["coach-action"]}
                        onClick={() => setExpandedCoachIndex(expandedCoachIndex === index ? null : index)}
                      >
                        {expandedCoachIndex === index ? "Hide Details" : c.actionLabel}
                      </button>
                      <button
                        type="button"
                        className={`${styles["coach-action"]} ${styles["sponsor-action"]}`}
                        onClick={() => router.push("/getsponsored")}
                      >
                        {c.secondaryAction}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles["coach-action"]}
                      onClick={() => setExpandedCoachIndex(expandedCoachIndex === index ? null : index)}
                    >
                      {expandedCoachIndex === index ? "Hide Details" : c.actionLabel}
                    </button>
                  )}
                </div>
                {expandedCoachIndex === index && healthData && (
                  <div className={styles["coach-details"]}>
                    <CoachDetail index={index} healthData={healthData} vendor={vendor} activeSponsorships={activeSponsorships} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={styles["coach-progress-row"]}>
            <span>Growth Progress</span>
            <span>{healthData?.total ?? 0}%</span>
          </div>
          <div className={styles["coach-progress-track"]}>
            <div className={styles["coach-progress-fill"]} style={{ width: `${healthData?.total ?? 0}%` }} />
          </div>

          <div className={styles["coach-breakdown"]}>
            <div className={styles["coach-breakdown-title"]} onClick={() => setCoachBreakdownOpen((v) => !v)}>
              Breakdown {coachBreakdownOpen ? "▲" : "▼"}
            </div>
            {coachBreakdownOpen && healthData && (
              <div>
                {healthData.items.map((item) => (
                  <div key={item.label} className={styles["coach-breakdown-row"]}>
                    <span>{item.label}</span>
                    <span>
                      {item.score}/{item.max}
                    </span>
                  </div>
                ))}
                <div className={styles["coach-breakdown-total"]}>
                  <span>Growth Score</span>
                  <span>{healthData.total}/100</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modals */}
      {healthModalOpen && healthData && (
        <div
          className={`${styles["health-modal"]} ${styles.show}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setHealthModalOpen(false);
          }}
        >
          <div className={styles["health-modal-content"]}>
            <div className={styles["health-modal-head"]}>
              <h3>Business Health Score</h3>
              <button type="button" onClick={() => setHealthModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className={styles["health-modal-score"]}>{healthData.total} / 100</div>
            {healthData.items.map((item) => (
              <div key={item.label} className={styles["health-modal-item"]}>
                <span>{item.label}</span>
                <strong>
                  {item.score}/{item.max}
                </strong>
              </div>
            ))}
            <p className={styles["health-modal-note"]}>Sponsor your business to improve your visibility score.</p>
          </div>
        </div>
      )}

      {rankingCategoryModalOpen && (
        <div
          className={`${styles["health-modal"]} ${styles.show}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRankingCategoryModalOpen(false);
          }}
        >
          <div className={styles["health-modal-content"]}>
            <button type="button" className={styles["close-health-modal"]} onClick={() => setRankingCategoryModalOpen(false)}>
              &times;
            </button>
            <h2>Select Ranking Category</h2>

            <label>Category</label>
            <select
              className={styles["ranking-select"]}
              value={modalCategory}
              onChange={(e) => {
                const cat = e.target.value;
                setModalCategory(cat);
                setModalSubcategory(RANKING_CATEGORY_MAP[cat]?.[0] || "");
              }}
            >
              {Object.keys(RANKING_CATEGORY_MAP).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <label style={{ marginTop: 16, display: "block" }}>Subcategory</label>
            <select className={styles["ranking-select"]} value={modalSubcategory} onChange={(e) => setModalSubcategory(e.target.value)}>
              {(RANKING_CATEGORY_MAP[modalCategory] || []).map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={styles["manage-sub-btn"]}
              style={{ marginTop: 20 }}
              onClick={() => {
                setRankingCategory(modalCategory);
                setRankingSubcategory(modalSubcategory);
                setRankingCategoryModalOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {rankingFactorsModalOpen && healthData && (
        <div
          className={`${styles["health-modal"]} ${styles.show}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRankingFactorsModalOpen(false);
          }}
        >
          <div className={styles["health-modal-content"]}>
            <div className={styles["health-modal-head"]}>
              <h3>Marketplace Ranking Factors</h3>
              <button type="button" onClick={() => setRankingFactorsModalOpen(false)}>
                &times;
              </button>
            </div>
            <p className={styles["health-modal-note"]} style={{ marginTop: 0 }}>
              These are the real factors that determine your position in search results, in priority order.
            </p>
            <div className={styles["health-modal-item"]}>
              <span>1. Sponsored Status</span>
              <strong>{rankFactorSponsored}</strong>
            </div>
            <div className={styles["health-modal-item"]}>
              <span>2. Verification Status</span>
              <strong>{rankFactorVerification}</strong>
            </div>
            <div className={styles["health-modal-item"]}>
              <span>3. Average Rating</span>
              <strong>{healthData.reviewDetails.rating.toFixed(1)} / 5</strong>
            </div>
            <div className={styles["health-modal-item"]}>
              <span>4. Review Count</span>
              <strong>{healthData.reviewDetails.count}</strong>
            </div>
            <p className={styles["health-modal-note"]}>
              Sponsored businesses always rank first, then verified businesses, then by rating and review count. Improve any of these to move up.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
