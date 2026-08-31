"use client";

// ===============================================================
// src/app/(standalone)/discover-results/page.tsx
//
// Ported faithfully from discover-results.html + discover-results.js.
// Reads search params from the URL (keyword, type, category,
// subcategory, state, lga, verified, lat, lng, radius) and runs
// the real Supabase RPCs: search_vendors, search_products,
// search_services, plus branch search.
//
// Standalone page: its own header + bottom nav, no site navbar.
// ===============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getViewingCustomerId } from "@/lib/getViewingCustomerId";
import { nigeriaData } from "@/lib/nigeria-data.js";
import ProfileNav from "@/components/ProfileNav";
import SearchableSelect from "@/components/SearchableSelect";
import styles from "./discover-results.module.css";

// ── Types ─────────────────────────────────────────────────────
interface Vendor {
  id: string;
  slug: string;
  name: string;
  logo: string;
  category: string;
  subcategory: string;
  state: string;
  lga: string;
  verificationStatus: string;
  rating: number;
  reviews: number;
  sponsored: boolean;
  distanceKm?: number | null;
  branchId?: string | null;
  branchName?: string | null;
  branchAddress?: string | null;
  isBranchMatch?: boolean;
}

interface Product {
  id: string;
  slug: string;
  vendorId: string;
  productName: string;
  price: number;
  image: string;
  vendorName: string;
  vendorVerification: string;
  vendorRating: number;
  vendorReviews: number;
  vendorSlug: string;
  vendorLogo: string;
  sponsored: boolean;
  distanceKm?: number | null;
}

interface Service {
  id: string;
  slug: string;
  vendorId: string;
  serviceName: string;
  description: string;
  vendorName: string;
  vendorCategory: string;
  vendorSubcategory: string;
  vendorState: string;
  vendorLga: string;
  vendorRating: number;
  vendorReviews: number;
  vendorVerification: string;
  vendorSlug: string;
  vendorLogo: string;
  startingPrice?: number;
  sponsored: boolean;
  distanceKm?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────
function haversineKm(
  lat1: number, lon1: number,
  lat2: number | null, lon2: number | null
): number | null {
  if (lat2 == null || lon2 == null) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function applyDistance<T>(
  items: T[],
  getLat: (i: T) => number | null,
  getLng: (i: T) => number | null,
  userLat: number | null,
  userLng: number | null,
  radius: number,
  enabled: boolean
): (T & { distanceKm?: number | null })[] {
  // TS can't prove a bare T[] satisfies (T & {optional field})[] just
  // because the field is optional — this cast is safe: every item
  // keeps its original shape, distanceKm is simply left unset.
  if (!enabled || userLat == null || userLng == null) return items as (T & { distanceKm?: number | null })[];
  return items
    .map(i => {
      const d = haversineKm(userLat, userLng, getLat(i), getLng(i));
      return { ...i, distanceKm: d };
    })
    .filter(i => i.distanceKm != null && i.distanceKm <= radius)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

function formatDistanceInline(km?: number | null): string {
  if (km == null || isNaN(km)) return "";
  return km < 1
    ? `${Math.round(km * 1000)}m away`
    : `${km.toFixed(1)}km away`;
}

function DistanceInline({ km }: { km?: number | null }) {
  if (km == null || isNaN(km)) return null;
  const val = km < 1
    ? `${Math.round(km * 1000)}m`
    : `${km.toFixed(1)}km`;
  return (
    <span style={{ color: "#0047ab", fontWeight: 700, fontSize: 12 }}>
      {" · "}<i className="fa-solid fa-location-dot" style={{ fontSize: 10, marginRight: 2 }}></i>{val} away
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────
export default function DiscoverResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL params
  const initKeyword = searchParams.get("keyword") || "";
  const initType = (searchParams.get("type") || "all") as "all" | "product" | "service" | "vendor";
  const initCategory = searchParams.get("category") || "";
  const initSubcategory = searchParams.get("subcategory") || "";
  // Third level (Fashion/Tailoring pilot, 2026-08 per Cyril) — carried
  // through from the homepage search's sub-subcategory click. Not
  // exposed as its own filter-drawer dropdown yet, just honored when
  // it arrives via the URL.
  const initSubSubcategory = searchParams.get("subsubcategory") || "";
  const initState = searchParams.get("state") || "";
  const initLga = searchParams.get("lga") || "";
  // Step 8, 2026-08-23 per Cyril: the Artisan/Goods/Professional
  // navbar pills land here with ?audience=X (and Goods sub-groups
  // with &subgroup=Y). See the search_products/services/vendors RPC
  // updates for the actual filtering logic -- this just reads what
  // arrived in the URL.
  const initAudience = searchParams.get("audience") || "";
  const initSubgroup = searchParams.get("subgroup") || "";
  const initVerified = searchParams.get("verified") === "true";
  const initLat = searchParams.get("lat") ? Number(searchParams.get("lat")) : null;
  const initLng = searchParams.get("lng") ? Number(searchParams.get("lng")) : null;
  const initRadius = searchParams.get("radius") ? Number(searchParams.get("radius")) : 5;
  const initDistanceEnabled = initLat != null && initLng != null;

  // Search state
  const [keyword, setKeyword] = useState(initKeyword);
  const [searchType, setSearchType] = useState(initType);
  const [verifiedOnly, setVerifiedOnly] = useState(initVerified);
  const [distanceEnabled, setDistanceEnabled] = useState(initDistanceEnabled);
  const [userLat, setUserLat] = useState<number | null>(initLat);
  const [userLng, setUserLng] = useState<number | null>(initLng);
  const [radius, setRadius] = useState(initRadius);
  const [locationLabel, setLocationLabel] = useState(initDistanceEnabled ? "Location Ready ✓" : "Use Current");

  // Filter drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(initCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState(initSubcategory);
  const [selectedSubSubcategory, setSelectedSubSubcategory] = useState(initSubSubcategory);
  const [selectedState, setSelectedState] = useState(initState);
  const [selectedLga, setSelectedLga] = useState(initLga);
  // Step 8 -- not exposed in the filter drawer (no UI to change these
  // once on the page yet), just carried through from the navbar pill
  // that brought someone here, same as initSubSubcategory above.
  const [audienceType] = useState(initAudience);
  const [goodsSubgroup] = useState(initSubgroup);
  const [lgaList, setLgaList] = useState<string[]>([]);

  // Results state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [sponsored, setSponsored] = useState<(Product | Service | Vendor)[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Temporary diagnostic, added 2026-08-23 per Cyril: shows how long
  // the actual search round-trip takes, since the database side alone
  // was independently confirmed to be ~33ms -- this reveals whether any
  // real delay is network latency (Lagos <-> US-hosted DB) or something
  // else. Safe to remove once the "Loading" concern is resolved.
  const [lastSearchMs, setLastSearchMs] = useState<number | null>(null);
  // Bug fix, 2026-08-23 per Cyril: the results summary ("X results
  // found for '...'") was reading `initKeyword`, which is only ever
  // set ONCE from the URL when the page first loads. Every later
  // search on this same page (tabs, the search box, filters) updated
  // the actual results correctly but left this label frozen on
  // whatever the very first keyword was -- confirmed via screenshots
  // where results for "agent"/"bar" displayed correctly but the label
  // still said 'editing'. This tracks the keyword actually used in the
  // most recently completed search instead.
  const [lastSearchedKeyword, setLastSearchedKeyword] = useState(initKeyword);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAllVendors, setShowAllVendors] = useState(false);

  // Carousel refs
  const productsRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);

  const stateList = Object.keys(nigeriaData as Record<string, string[]>).sort();

  // ── Load categories ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("categories")
        .select("name")
        .order("name");
      if (data) setCategories(data.map(c => c.name));
    }
    load();
  }, []);

  // ── Category → Subcategory ───────────────────────────────
  useEffect(() => {
    if (!selectedCategory) { setSubcategories([]); setSelectedSubcategory(""); return; }
    async function load() {
      const { data: catRow } = await supabase
        .from("categories").select("id").eq("name", selectedCategory).maybeSingle();
      if (!catRow) return;
      const { data } = await supabase
        .from("subcategories").select("name").eq("category_id", catRow.id).order("name");
      if (data) setSubcategories(data.map(s => s.name));
    }
    load();
    setSelectedSubcategory("");
    setSelectedSubSubcategory("");
  }, [selectedCategory]);

  // ── State → LGA ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedState) { setLgaList([]); setSelectedLga(""); return; }
    setLgaList((nigeriaData as Record<string, string[]>)[selectedState] || []);
    setSelectedLga("");
  }, [selectedState]);

  // ── Main search function ─────────────────────────────────
  const runSearch = useCallback(async (overrides?: {
    keyword?: string;
    searchType?: string;
    verifiedOnly?: boolean;
    category?: string;
    subcategory?: string;
    subsubcategory?: string;
    state?: string;
    lga?: string;
    distanceEnabled?: boolean;
    userLat?: number | null;
    userLng?: number | null;
    radius?: number;
  }) => {
    const kw = overrides?.keyword ?? keyword;
    const type = overrides?.searchType ?? searchType;
    const verified = overrides?.verifiedOnly ?? verifiedOnly;
    const cat = overrides?.category ?? selectedCategory;
    const subcat = overrides?.subcategory ?? selectedSubcategory;
    const subsubcat = overrides?.subsubcategory ?? selectedSubSubcategory;
    const st = overrides?.state ?? selectedState;
    const lg = overrides?.lga ?? selectedLga;
    const distOn = overrides?.distanceEnabled ?? distanceEnabled;
    const lat = overrides?.userLat !== undefined ? overrides.userLat : userLat;
    const lng = overrides?.userLng !== undefined ? overrides.userLng : userLng;
    const rad = overrides?.radius ?? radius;

    setLoading(true);
    const searchStartedAt = performance.now();

    try {
      // 2026-08 perf fix, per Cyril: vendors/branches, products, and
      // services used to be fetched one `await` after another, so the
      // page's total wait time was the SUM of every query's latency.
      // None of these three actually depend on each other's results (they
      // only share the same filter inputs), so they now run concurrently
      // via Promise.all — total wait drops to roughly the SLOWEST single
      // query instead of all of them added together. Every individual
      // query, filter, and field mapping below is unchanged from before;
      // only the sequencing changed.

      const fetchVendors = async (): Promise<any[]> => {
        if (!(type === "all" || type === "vendor")) return [];

        const [vendorsRes, branches] = await Promise.all([
          supabase.rpc("search_vendors", {
            p_keyword: kw || null,
            p_category: cat || null,
            p_subcategory: subcat || null,
            p_state: st || null,
            p_lga: lg || null,
            p_verified_only: verified,
            p_subsubcategory: subsubcat || null,
            p_audience_type: audienceType || null,
            p_goods_subgroup: goodsSubgroup || null,
          }),
          (async (): Promise<any[]> => {
            // Branch search — two-step query to avoid join syntax issues
            // Step 1: fetch all active branches
            let branchQuery = supabase
              .from("branches")
              .select("id, branch_name, address, state, lga, latitude, longitude, vendor_id, phone, whatsapp, open_time, close_time, business_days, account_status")
              .eq("account_status", "active");
            if (st) branchQuery = branchQuery.eq("state", st);
            if (lg) branchQuery = branchQuery.eq("lga", lg);
            const { data: branchData, error: branchError } = await branchQuery;
            if (branchError) console.error("Branch query error:", branchError);

            let branches: any[] = [];
            if (branchData && branchData.length > 0) {
              // Step 2: fetch parent vendors for these branches
              const vendorIds = [...new Set(branchData.map((b: any) => b.vendor_id))];
              const { data: branchVendors } = await supabase
                .from("vendors")
                .select("id, slug, name, logo_url, category, subcategory, verification_status, average_rating, reviews_count, is_sponsored, account_status")
                .in("id", vendorIds)
                .eq("account_status", "active");

              const vendorMap = new Map((branchVendors || []).map((v: any) => [v.id, v]));

              branches = branchData
                .map((b: any) => {
                  const v = vendorMap.get(b.vendor_id);
                  if (!v) return null;
                  return {
                    id: v.id,
                    branchId: b.id,
                    slug: v.slug,
                    name: v.name,
                    logo_url: v.logo_url,
                    category: v.category,
                    subcategory: v.subcategory,
                    verification_status: v.verification_status,
                    average_rating: v.average_rating,
                    reviews_count: v.reviews_count,
                    is_sponsored: v.is_sponsored,
                    state: b.state,
                    lga: b.lga,
                    latitude: b.latitude ? Number(b.latitude) : null,
                    longitude: b.longitude ? Number(b.longitude) : null,
                    branchName: b.branch_name,
                    branchAddress: b.address,
                    phone: b.phone,
                    whatsapp: b.whatsapp,
                    open_time: b.open_time,
                    close_time: b.close_time,
                    business_days: b.business_days,
                    isBranchMatch: true,
                  };
                })
                .filter(Boolean);

              // Client-side keyword/category/verified filtering
              if (kw) {
                const kwLower = kw.toLowerCase();
                branches = branches.filter((b: any) =>
                  (b.name || "").toLowerCase().includes(kwLower) ||
                  (b.category || "").toLowerCase().includes(kwLower) ||
                  (b.subcategory || "").toLowerCase().includes(kwLower) ||
                  (b.branchName || "").toLowerCase().includes(kwLower)
                );
              }
              if (cat) branches = branches.filter((b: any) => b.category === cat);
              if (subcat) branches = branches.filter((b: any) => b.subcategory === subcat);
              if (verified) branches = branches.filter((b: any) =>
                b.verification_status === "blue" || b.verification_status === "gray"
              );

              branches = applyDistance(
                branches,
                (v: any) => v.latitude,
                (v: any) => v.longitude,
                lat, lng, rad, distOn
              );
            }
            return branches;
          })(),
        ]);

        const vendorsFromRpc = applyDistance(
          (vendorsRes.data || []) as any[],
          v => v.latitude ? Number(v.latitude) : null,
          v => v.longitude ? Number(v.longitude) : null,
          lat, lng, rad, distOn
        );

        return vendorsFromRpc.concat(branches);
      };

      const fetchProducts = async (): Promise<any[]> => {
        if (!(type === "all" || type === "product")) return [];
        const { data } = await supabase.rpc("search_products", {
          p_keyword: kw || null,
          p_category: cat || null,
          p_subcategory: subcat || null,
          p_state: st || null,
          p_lga: lg || null,
          p_verified_only: verified,
          p_subsubcategory: subsubcat || null,
          p_audience_type: audienceType || null,
          p_goods_subgroup: goodsSubgroup || null,
        });
        return applyDistance(
          data || [], p => p.vendor_latitude, p => p.vendor_longitude,
          lat, lng, rad, distOn
        );
      };

      const fetchServices = async (): Promise<any[]> => {
        if (!(type === "all" || type === "service")) return [];
        const { data } = await supabase.rpc("search_services", {
          p_keyword: kw || null,
          p_category: cat || null,
          p_subcategory: subcat || null,
          p_state: st || null,
          p_lga: lg || null,
          p_verified_only: verified,
          p_subsubcategory: subsubcat || null,
          p_audience_type: audienceType || null,
          p_goods_subgroup: goodsSubgroup || null,
        });
        return applyDistance(
          data || [],
          s => s.vendor_latitude ? Number(s.vendor_latitude) : null,
          s => s.vendor_longitude ? Number(s.vendor_longitude) : null,
          lat, lng, rad, distOn
        );
      };

      const [rawVendors, rawProducts, rawServices] = await Promise.all([
        fetchVendors(),
        fetchProducts(),
        fetchServices(),
      ]);

      // Normalize
      const normVendors: Vendor[] = rawVendors.map((v: any) => ({
        id: v.id,
        slug: v.slug || "",
        name: v.name || "",
        logo: v.logo_url || "",
        category: v.category || "",
        subcategory: v.subcategory || "",
        state: v.state || "",
        lga: v.lga || "",
        verificationStatus: v.verification_status || "none",
        rating: Number(v.average_rating) || 0,
        reviews: Number(v.reviews_count) || 0,
        sponsored: !!v.is_sponsored,
        distanceKm: v.distanceKm,
        branchId: v.branchId || null,
        branchName: v.branchName || null,
        branchAddress: v.branchAddress || null,
        isBranchMatch: !!v.isBranchMatch,
      }));

      const normProducts: Product[] = rawProducts.map((p: any) => ({
        id: p.id,
        slug: p.slug || "",
        vendorId: p.vendor_id,
        productName: p.product_name || "",
        price: p.price || 0,
        image: p.primary_image_url || "",
        vendorName: p.vendor_name || "",
        vendorVerification: p.vendor_verification_status || "none",
        vendorRating: Number(p.vendor_average_rating) || 0,
        vendorReviews: Number(p.vendor_reviews_count) || 0,
        vendorSlug: p.vendor_slug || "",
        vendorLogo: p.vendor_logo_url || "",
        sponsored: !!p.vendor_is_sponsored,
        distanceKm: p.distanceKm,
      }));

      const normServices: Service[] = rawServices.map((s: any) => ({
        id: s.id,
        slug: s.slug || "",
        vendorId: s.vendor_id,
        serviceName: s.service_name || "",
        description: s.short_description || "",
        vendorName: s.vendor_name || "",
        vendorCategory: s.vendor_category || "",
        vendorSubcategory: s.vendor_subcategory || "",
        vendorState: s.vendor_state || "",
        vendorLga: s.vendor_lga || "",
        vendorRating: Number(s.vendor_average_rating) || 0,
        vendorReviews: Number(s.vendor_reviews_count) || 0,
        vendorVerification: s.vendor_verification_status || "none",
        vendorSlug: s.vendor_slug || "",
        vendorLogo: s.vendor_logo_url || "",
        startingPrice: s.starting_price,
        sponsored: !!s.vendor_is_sponsored,
        distanceKm: s.distanceKm,
      }));

      // Apply verified filter
      const filterVerified = <T extends { verificationStatus?: string; vendorVerification?: string }>(arr: T[]) =>
        verified ? arr.filter(i => {
          const v = i.verificationStatus || i.vendorVerification || "none";
          return v === "blue" || v === "gray";
        }) : arr;

      const filteredVendors = filterVerified(normVendors);
      const filteredProducts = filterVerified(normProducts);
      const filteredServices = filterVerified(normServices);

      // Build sponsored feed
      const sponsoredFeed = [
        ...filteredProducts.filter(p => p.sponsored),
        ...filteredServices.filter(s => s.sponsored),
        ...filteredVendors.filter(v => v.sponsored),
      ];

      // 2026-08 fix, per Cyril: Business Insights' "Search Keywords" panel
      // reads analytics_events rows with event_type "search_impression",
      // but nothing in the Next.js rebuild was ever writing them -- the
      // DB column and the reader (insight/page.tsx's loadKeywords) both
      // existed, the writer never got ported. Ported faithfully from
      // production's discover-results.js: log one impression per vendor,
      // product, and service actually shown in the results, tagged with
      // the keyword searched. Fire-and-forget so a logging failure can
      // never slow down or block a real user from seeing their results.
      (async () => {
        try {
          const customerId = await getViewingCustomerId();
          const impressions = [
            ...filteredVendors.map(v => ({
              vendor_id: v.id,
              event_type: "search_impression",
              search_keyword: kw || "",
              customer_id: customerId,
            })),
            ...filteredProducts.map(p => ({
              vendor_id: p.vendorId,
              product_id: p.id,
              event_type: "search_impression",
              search_keyword: kw || "",
              customer_id: customerId,
            })),
            ...filteredServices.map(s => ({
              vendor_id: s.vendorId,
              service_id: s.id,
              event_type: "search_impression",
              search_keyword: kw || "",
              customer_id: customerId,
            })),
          ];
          if (impressions.length) {
            await supabase.from("analytics_events").insert(impressions);
          }
        } catch { /* non-fatal */ }
      })();

      setVendors(filteredVendors);
      setProducts(filteredProducts);
      setServices(filteredServices);
      setSponsored(sponsoredFeed);
      setTotalCount(filteredVendors.length + filteredProducts.length + filteredServices.length);

    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLastSearchMs(Math.round(performance.now() - searchStartedAt));
      setLastSearchedKeyword(kw || "");
      setLoading(false);
    }
  }, [keyword, searchType, verifiedOnly, selectedCategory, selectedSubcategory, selectedSubSubcategory,
      selectedState, selectedLga, distanceEnabled, userLat, userLng, radius, audienceType, goodsSubgroup]);

  // Run search on mount with URL params
  useEffect(() => {
    if (initKeyword || initCategory || initState || initDistanceEnabled || initAudience) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Geolocation ──────────────────────────────────────────
  function fetchLocation(onDone?: (lat: number, lng: number) => void) {
    if (!navigator.geolocation) return;
    setLocationLabel("Detecting...");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        setLocationLabel("Location Ready ✓");
        if (onDone) onDone(lat, lng);
      },
      () => {
        setDistanceEnabled(false);
        setLocationLabel("Use Current");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  // ── Search from this page ────────────────────────────────
  function handleSearch() {
    const kw = keyword.trim();
    if (!kw) { alert("Please enter a keyword."); return; }
    runSearch({ keyword: kw });
  }

  // ── Apply filters ────────────────────────────────────────
  function applyFilters() {
    setDrawerOpen(false);
    runSearch({
      category: selectedCategory,
      subcategory: selectedSubcategory,
      subsubcategory: selectedSubSubcategory,
      state: selectedState,
      lga: selectedLga,
    });
  }

  function resetFilters() {
    setSelectedCategory("");
    setSelectedSubcategory("");
    setSelectedSubSubcategory("");
    setSelectedState("");
    setSelectedLga("");
  }

  // ── Render helpers ───────────────────────────────────────
  function badge(status: string) {
    if (status === "blue") return <img src="/images/bluebadge.png" alt="Verified" className={styles.vendorBadge} />;
    if (status === "gray") return <img src="/images/graybadge.png" alt="Verified" className={styles.vendorBadge} />;
    return null;
  }

  const showVendors = searchType === "all" || searchType === "vendor";
  const showProducts = searchType === "all" || searchType === "product";
  const showServices = searchType === "all" || searchType === "service";
  const isEmpty = totalCount === 0 && !loading;

  const visibleVendors = showAllVendors ? vendors : vendors.slice(0, 6);
  const visibleProducts = showAllProducts ? products : products.slice(0, 9);
  const visibleServices = showAllServices ? services : services.slice(0, 9);

  return (
    <main className={styles.page}>

      {/* HEADER */}
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={() => router.push("/discover")}>
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <a href="/" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/spotlightlogo-512.png" alt="Spotlight" className={styles.logo} />
          <span className={styles.brandText}>Spotlight</span>
        </a>
      </header>

      {/* SEARCH */}
      <section className={styles.searchSection}>
        <div className={styles.searchWrap}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search Spotlight"
            autoComplete="off"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
          <button type="button" className={styles.searchBtn} onClick={handleSearch}>
            Search
          </button>
        </div>
      </section>

      {/* TABS */}
      <section className={styles.tabs}>
        {(["all", "product", "service", "vendor"] as const).map(type => (
          <button
            key={type}
            type="button"
            className={`${styles.tab} ${searchType === type ? styles.active : ""}`}
            onClick={() => {
              setSearchType(type);
              runSearch({ searchType: type });
            }}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </section>

      {/* FILTER BAR */}
      <section className={styles.filterBar}>
        <label className={styles.toggleWrap}>
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={e => {
              setVerifiedOnly(e.target.checked);
              runSearch({ verifiedOnly: e.target.checked });
            }}
          />
          <span className={styles.toggleSlider}></span>
          <span className={styles.toggleLabel}>Verified Only</span>
        </label>
        <button type="button" className={styles.filtersBtn} onClick={() => setDrawerOpen(true)}
          style={{ marginLeft: "auto" }}>
          More Filters <i className="fa-solid fa-sliders"></i>
        </button>
      </section>

      {/* DISTANCE CARD */}
      <div className={`${styles.distanceCard} ${distanceEnabled ? styles.distanceEnabled : ""}`}>
        <div className={styles.distanceTop}>
          <label className={styles.distanceToggle}>
            <input
              type="checkbox"
              checked={distanceEnabled}
              onChange={e => {
                const on = e.target.checked;
                setDistanceEnabled(on);
                if (on && navigator.geolocation) {
                  fetchLocation((lat, lng) => runSearch({ distanceEnabled: true, userLat: lat, userLng: lng }));
                } else {
                  runSearch({ distanceEnabled: false });
                }
              }}
            />
            <span className={styles.distanceCheckbox}></span>
            <span className={styles.distanceText}>Enable Distance Search</span>
          </label>
          <button
            type="button"
            className={styles.locationBtn}
            onClick={() => fetchLocation((lat, lng) => { if (distanceEnabled) runSearch({ userLat: lat, userLng: lng }); })}
          >
            <i className="fa-solid fa-location-crosshairs"></i>
            {locationLabel}
          </button>
        </div>
        <div className={styles.distanceSliderWrap}>
          <input
            type="range"
            className={styles.distanceSlider}
            min="1" max="20"
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            onMouseUp={() => { if (distanceEnabled) runSearch(); }}
            onTouchEnd={() => { if (distanceEnabled) runSearch(); }}
          />
          <div className={styles.distanceScale}>
            <span>0km</span>
            <span>{radius}km</span>
            <span>20km</span>
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <section className={styles.summarySection}>
        <p className={styles.summaryText}>
          {loading ? "Searching..." : `${totalCount} result${totalCount !== 1 ? "s" : ""} found`}
          {lastSearchedKeyword ? ` for "${lastSearchedKeyword}"` : ""}
          {/* Bug fix, 2026-08-23 per Cyril: browsing by category/
              subcategory (tapping a category on mobile, or applying
              the filter drawer, with no typed keyword) updated the
              actual results correctly but showed NOTHING on screen to
              confirm what was actually being filtered -- the search
              box stayed on its empty "Search Spotlight" placeholder,
              making it look like no filter was applied at all even
              when one genuinely was. This shows the active category/
              subcategory/sub-subcategory whenever one is set. */}
          {(selectedCategory || selectedSubcategory || selectedSubSubcategory) && (
            <span>
              {" "}in {selectedCategory}
              {selectedSubcategory ? ` \u203a ${selectedSubcategory}` : ""}
              {selectedSubSubcategory ? ` \u203a ${selectedSubSubcategory}` : ""}
            </span>
          )}
          {/* Step 8, 2026-08-23 per Cyril: same reasoning as the
              category confirmation above -- someone arriving via the
              Artisan/Goods/Professional navbar pills should see
              confirmation of what's actually filtering their results. */}
          {audienceType && (
            <span>
              {" "}in {audienceType}
              {goodsSubgroup ? ` \u203a ${goodsSubgroup}` : ""}
            </span>
          )}
          {/* Temporary diagnostic, added 2026-08-23 -- see lastSearchMs state above */}
          {!loading && lastSearchMs != null && (
            <span style={{ opacity: 0.6, fontWeight: 400 }}> ({lastSearchMs}ms)</span>
          )}
        </p>
      </section>

      {/* SPONSORED */}
      {sponsored.length > 0 && (
        <section>
          <div className={styles.sectionHeading}><h2>Sponsored</h2></div>
          <div className={styles.sponsoredScroll}>
            {sponsored.map((item: any, i) => {
              const isProduct = "productName" in item;
              const isService = "serviceName" in item;
              const name = isProduct ? item.productName : isService ? item.serviceName : item.name;
              const image = isProduct ? item.image : (item.vendorLogo || item.logo || "/images/spotlightlogo-512.png");
              const price = isProduct ? item.price : isService ? item.startingPrice : null;
              const vendorName = isProduct || isService ? item.vendorName : item.name;
              const rating = isProduct || isService ? item.vendorRating : item.rating;
              const reviews = isProduct || isService ? item.vendorReviews : item.reviews;
              const verification = isProduct || isService ? item.vendorVerification : item.verificationStatus;
              const href = isProduct
                ? `/vendor/${item.vendorSlug}/product/${item.slug}`
                : isService
                  ? `/vendor/${item.vendorSlug}/service/${item.slug}`
                  : `/vendor/${item.slug}`;
              return (
                <article key={`sp-${i}`} className={styles.sponsoredCard} onClick={() => router.push(href)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={name} className={styles.productImage} />
                  <h3 className={styles.productTitle}>{name}</h3>
                  {price && (
                    <p className={styles.productPrice}>
                      {isService && <span className={styles.startingFromLabel}>From </span>}
                      ₦{Number(price).toLocaleString()}
                    </p>
                  )}
                  <div className={styles.productVendor}>
                    <span>By {vendorName}</span>
                    {badge(verification)}
                  </div>
                  <div className={styles.productRating}>
                    <i className="fa-solid fa-star"></i>
                    <span>{Number(rating || 0).toFixed(1)}</span>
                    <small>({reviews || 0})</small>
                  </div>
                  <p className={styles.sponsoredLabel}>Sponsored</p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* PRODUCTS */}
      {showProducts && products.length > 0 && (
        <section>
          <div className={styles.sectionHeading}>
            <h2>Products</h2>
            <button type="button" className={styles.moreBtn}
              onClick={() => setShowAllProducts(p => !p)}>
              {showAllProducts ? "Show Less" : "See All"}
            </button>
          </div>
          <div className={styles.productsCarousel}>
            <button type="button" className={`${styles.carouselArrow} ${styles.prev}`}
              onClick={() => productsRef.current?.scrollBy({ left: -180, behavior: "smooth" })}>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <div
              ref={productsRef}
              className={`${styles.productsGrid} ${showAllProducts ? styles.showAll : ""}`}
            >
              {visibleProducts.map(p => (
                <article
                  key={p.id}
                  className={styles.productCard}
                  onClick={() => router.push(`/vendor/${p.vendorSlug}/product/${p.slug}`)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image || "/images/spotlightlogo-512.png"} alt={p.productName} className={styles.productImage} />
                  <h3 className={styles.productTitle}>{p.productName}</h3>
                  <p className={styles.productPrice}>₦{Number(p.price || 0).toLocaleString()}</p>
                  <div className={styles.productVendor}>
                    <span>By {p.vendorName}</span>
                    {badge(p.vendorVerification)}
                  </div>
                  {p.distanceKm != null && (
                    <div className={styles.distanceLabel}>
                      <i className="fa-solid fa-location-dot"></i>
                      {p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)}m` : `${p.distanceKm.toFixed(1)}km`} away
                    </div>
                  )}
                  <div className={styles.productRating}>
                    <i className="fa-solid fa-star"></i>
                    <span>{Number(p.vendorRating || 0).toFixed(1)}</span>
                    <small>({p.vendorReviews || 0})</small>
                  </div>
                  {p.sponsored && <p className={styles.sponsoredLabel}>Sponsored</p>}
                </article>
              ))}
            </div>
            <button type="button" className={`${styles.carouselArrow} ${styles.next}`}
              onClick={() => productsRef.current?.scrollBy({ left: 180, behavior: "smooth" })}>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </section>
      )}

      {/* SERVICES */}
      {showServices && services.length > 0 && (
        <section>
          <div className={styles.sectionHeading}>
            <h2>Services</h2>
            <button type="button" className={styles.moreBtn}
              onClick={() => setShowAllServices(p => !p)}>
              {showAllServices ? "Show Less" : "See All"}
            </button>
          </div>
          <div className={styles.servicesCarousel}>
            <button type="button" className={`${styles.carouselArrow} ${styles.prev}`}
              onClick={() => servicesRef.current?.scrollBy({ left: -380, behavior: "smooth" })}>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <div
              ref={servicesRef}
              className={`${styles.servicesList} ${showAllServices ? styles.showAll : ""}`}
            >
              {visibleServices.map(s => (
                <article
                  key={s.id}
                  className={styles.serviceCard}
                  onClick={() => router.push(`/vendor/${s.vendorSlug}/service/${s.slug}`)}
                >
                  <div className={styles.vendorLeft}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.vendorLogo || "/images/spotlightlogo-512.png"}
                      alt={s.vendorName}
                      className={styles.vendorLogo}
                    />
                  </div>
                  <div className={styles.vendorCenter}>
                    <div className={styles.vendorHeading}>
                      <h3>{s.serviceName}</h3>
                    </div>
                    <div className={styles.vendorHeading}>
                      <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                        By {s.vendorName}
                      </p>
                      {badge(s.vendorVerification)}
                      <div className={styles.ratingWrap}>
                        <i className="fa-solid fa-star"></i>
                        <span>{Number(s.vendorRating || 0).toFixed(1)}</span>
                        <small>({s.vendorReviews || 0})</small>
                      </div>
                    </div>
                    {s.description && (
                      <p style={{ fontSize: 12, color: "var(--color-text-body)", margin: "8px 0 6px", lineHeight: 1.5, background: "var(--color-surface-alt)", borderRadius: 8, padding: "6px 8px" }}>
                        {s.description.length > 80 ? s.description.slice(0, 80) + "..." : s.description}
                      </p>
                    )}
                    <p className={styles.vendorAddress}>
                      {s.vendorLga}{s.vendorState ? `, ${s.vendorState}` : ""}
                      <DistanceInline km={s.distanceKm} />
                    </p>
                    {/* No separate category/subcategory label here (unlike the
                        Vendor and Product cards) — a service's name IS its
                        subcategory name by design (one slot, not two — see
                        ServicesTab.tsx), so this would always just repeat the
                        heading above verbatim (Cyril, 2026-08). */}
                    {s.sponsored && <p className={styles.sponsoredLabel}>Sponsored</p>}
                    <div className={styles.actions}>
                      <button type="button" className={styles.reviewBtn}
                        onClick={e => { e.stopPropagation(); /* review modal — Commit 3 */ }}>
                        Leave Review
                      </button>
                      <button type="button" className={styles.profileBtn}
                        onClick={e => { e.stopPropagation(); router.push(`/vendor/${s.vendorSlug}`); }}>
                        View Profile
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <button type="button" className={`${styles.carouselArrow} ${styles.next}`}
              onClick={() => servicesRef.current?.scrollBy({ left: 380, behavior: "smooth" })}>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </section>
      )}

      {/* VENDORS */}
      {showVendors && vendors.length > 0 && (
        <section>
          <div className={styles.sectionHeading}>
            <h2>Vendors</h2>
            <button type="button" className={styles.moreBtn}
              onClick={() => setShowAllVendors(p => !p)}>
              {showAllVendors ? "Show Less" : "See All"}
            </button>
          </div>
          <div className={styles.vendorsList}>
            {visibleVendors.map(v => (
              <article
                key={`${v.id}-${v.branchId || "main"}`}
                className={styles.vendorCard}
                onClick={() => router.push(`/vendor/${v.slug}${v.branchId ? `?branch=${v.branchId}` : ""}`)}
              >
                <div className={styles.vendorLeft}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.logo || "/images/spotlightlogo-512.png"}
                    alt={v.name}
                    className={styles.vendorLogo}
                  />
                </div>
                <div className={styles.vendorCenter}>
                  <div className={styles.vendorHeading}>
                    <h3>{v.isBranchMatch && v.branchName ? v.branchName : v.name}</h3>
                    {badge(v.verificationStatus)}
                    <div className={styles.ratingWrap}>
                      <i className="fa-solid fa-star"></i>
                      <span>{Number(v.rating || 0).toFixed(1)}</span>
                      <small>({v.reviews || 0})</small>
                    </div>
                  </div>
                  <p className={styles.vendorAddress}>
                    {v.isBranchMatch
                      ? (v.branchAddress || `${v.lga}, ${v.state}`)
                      : `${v.lga}, ${v.state}`}
                    <DistanceInline km={v.distanceKm} />
                  </p>
                  <span className={styles.vendorCategory}>{v.subcategory || v.category}</span>
                  {v.sponsored && <p className={styles.sponsoredLabel}>Sponsored</p>}
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.reviewBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        const params = new URLSearchParams();
                        if (v.branchId) params.set("branch", v.branchId);
                        params.set("review", "1");
                        router.push(`/vendor/${v.slug}?${params.toString()}`);
                      }}
                    >
                      Leave Review
                    </button>
                    <button
                      type="button"
                      className={styles.profileBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/vendor/${v.slug}${v.branchId ? `?branch=${v.branchId}` : ""}`);
                      }}
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* EMPTY STATE */}
      {isEmpty && !loading && (
        <section className={styles.emptyState}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <h3>No Results Found</h3>
          <p>Try another keyword or adjust your filters.</p>
        </section>
      )}

      {/* LOADING */}
      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Discovering products, services and vendors...</p>
        </div>
      )}

      {/* FILTER DRAWER */}
      <aside className={`${styles.drawer} ${drawerOpen ? styles.active : ""}`}>
        <div className={styles.drawerHeader}>
          <h3>More Filters</h3>
          <button type="button" className={styles.drawerCloseBtn} onClick={() => setDrawerOpen(false)}>×</button>
        </div>
        <div className={styles.drawerBody}>
          <div className={styles.filterGroup}>
            <label>Category</label>
            <SearchableSelect
              placeholder="Select Category"
              searchPlaceholder="Search categories..."
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categories.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div className={styles.filterGroup}>
            <label>Subcategory</label>
            <SearchableSelect
              placeholder="Select Subcategory"
              searchPlaceholder="Search subcategories..."
              value={selectedSubcategory}
              onChange={(val) => {
                // Cyril's search-logic audit, 2026-08: picking a
                // subcategory here used to leave a stale
                // selectedSubSubcategory in place from whatever the
                // user arrived with (e.g. a homepage sub-subcategory
                // click). Since the search RPCs require the
                // subcategory and sub-subcategory to belong to the
                // SAME listing row, a mismatched pair like this
                // silently returned zero results instead of showing
                // the newly picked subcategory's items. There's no
                // sub-subcategory picker in this drawer, so any
                // change here must clear it.
                setSelectedSubcategory(val);
                setSelectedSubSubcategory("");
              }}
              disabled={!selectedCategory}
              options={subcategories.map(s => ({ value: s, label: s }))}
            />
          </div>
          <div className={styles.filterGroup}>
            <label>State</label>
            <select className={styles.filterSelect} value={selectedState}
              onChange={e => setSelectedState(e.target.value)}>
              <option value="">Select State</option>
              {stateList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label>LGA</label>
            <select className={styles.filterSelect} value={selectedLga}
              onChange={e => setSelectedLga(e.target.value)}
              disabled={!selectedState}>
              <option value="">Select LGA</option>
              {lgaList.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.drawerFooter}>
          <button type="button" className={styles.resetBtn} onClick={resetFilters}>Reset</button>
          <button type="button" className={styles.applyBtn} onClick={applyFilters}>Apply Filters</button>
        </div>
      </aside>

      {/* OVERLAY */}
      <div
        className={`${styles.drawerOverlay} ${drawerOpen ? styles.active : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* BOTTOM NAV */}
      <nav className={styles.bottomNav}>
        <a href="/" className={styles.bottomItem}>
          <i className="fa-solid fa-compass"></i>
          <span>Explore</span>
        </a>
        <ProfileNav buttonClassName={styles.bottomItem} />
      </nav>

    </main>
  );
}
