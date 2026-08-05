"use client";

// ===============================================================
// src/app/(standalone)/discover/page.tsx
//
// COMMIT 2: Fully interactive discover page.
// Ported faithfully from discover.html + discover.js.
//
// What's wired:
// - Search type tabs (All/Product/Service/Vendor)
// - Verified Only toggle
// - Filter drawer (open/close, category→subcategory cascade,
//   state→LGA cascade from the nigeria-data module)
// - Distance toggle + "Use Current" geolocation
// - Radius slider with live km display
// - Trending searches (real RPC: get_trending_searches)
// - Sponsored vendors (real query from vendor_sponsorships)
// - Recent searches (localStorage, same key as production)
// - Search → navigate to /discover-results with URL params
//   (Commit 3 wires the results page itself)
// ===============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nigeriaData } from "@/lib/nigeria-data.js";
import ProfileNav from "@/components/ProfileNav";
import SearchableSelect from "@/components/SearchableSelect";
import styles from "./discover.module.css";

// ── Types ────────────────────────────────────────────────────
interface SponsoredVendor {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  category: string;
  subcategory: string;
  lga: string | null;
  state: string | null;
  verification_status: string;
  average_rating: number | null;
  reviews_count: number | null;
}

interface TrendingItem {
  keyword: string;
  search_count: number;
}

// ── Constants ─────────────────────────────────────────────────
const DEFAULT_RADIUS_KM = 5;
const RECENT_SEARCHES_KEY = "spotlight_recent_searches";
const MAX_RECENT = 5;

// ── Helpers ───────────────────────────────────────────────────
function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function VendorBadge({ status }: { status: string }) {
  if (status === "blue") return <img src="/images/bluebadge.png" alt="Verified Business" className={styles.discoverSponsoredBadge} />;
  if (status === "gray") return <img src="/images/graybadge.png" alt="Verified Identity" className={styles.discoverSponsoredBadge} />;
  return null;
}

function saveRecentSearch(keyword: string) {
  try {
    const existing = getRecentSearches().filter(
      (k) => k.toLowerCase() !== keyword.toLowerCase()
    );
    const updated = [keyword, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    /* localStorage unavailable */
  }
}

// ── Component ─────────────────────────────────────────────────
export default function DiscoverPage() {
  const router = useRouter();

  // Search state
  const [searchType, setSearchType] = useState<"all" | "product" | "service" | "vendor">("all");
  const [keyword, setKeyword] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searching, setSearching] = useState(false);

  // Filter drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedLga, setSelectedLga] = useState("");
  const [lgaList, setLgaList] = useState<string[]>([]);

  // Distance search
  const [distanceEnabled, setDistanceEnabled] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("Use Current");

  // Data
  const [sponsoredVendors, setSponsoredVendors] = useState<SponsoredVendor[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // ── Load categories from Supabase ──────────────────────────
  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase
        .from("categories")
        .select("name")
        .order("name");
      if (data) setCategories(data.map((c) => c.name));
    }
    loadCategories();
  }, []);

  // ── Load subcategories when category changes ───────────────
  useEffect(() => {
    if (!selectedCategory) {
      setSubcategories([]);
      setSelectedSubcategory("");
      return;
    }
    async function loadSubs() {
      // subcategories links to categories via category_id, not name
      const { data: catRow } = await supabase
        .from("categories")
        .select("id")
        .eq("name", selectedCategory)
        .maybeSingle();
      if (!catRow) return;
      const { data } = await supabase
        .from("subcategories")
        .select("name")
        .eq("category_id", catRow.id)
        .order("name");
      if (data) setSubcategories(data.map((s) => s.name));
    }
    loadSubs();
    setSelectedSubcategory("");
  }, [selectedCategory]);

  // ── Load LGAs when state changes ──────────────────────────
  useEffect(() => {
    if (!selectedState) {
      setLgaList([]);
      setSelectedLga("");
      return;
    }
    const lgas = (nigeriaData as Record<string, string[]>)[selectedState] || [];
    setLgaList(lgas);
    setSelectedLga("");
  }, [selectedState]);

  // ── Load trending searches (real RPC) ─────────────────────
  useEffect(() => {
    async function loadTrending() {
      const { data } = await supabase.rpc("get_trending_searches", {
        p_limit: 15,
      });
      if (data && data.length >= 5) {
        setTrending(data);
      } else {
        // Fallback starter list (same as production discover.js)
        setTrending([
          { keyword: "Tailor", search_count: 0 },
          { keyword: "Mechanic", search_count: 0 },
          { keyword: "Electrician", search_count: 0 },
          { keyword: "Hair Salon", search_count: 0 },
          { keyword: "Plumber", search_count: 0 },
          { keyword: "Caterer", search_count: 0 },
          { keyword: "Photographer", search_count: 0 },
          { keyword: "Fashion Designer", search_count: 0 },
        ]);
      }
    }
    loadTrending();
  }, []);

  // ── Load sponsored vendors ─────────────────────────────────
  useEffect(() => {
    async function loadSponsored() {
      const { data } = await supabase
        .from("vendors")
        .select(
          "id, slug, name, logo_url, category, subcategory, lga, state, verification_status, average_rating, reviews_count"
        )
        .eq("account_status", "active")
        .in(
          "id",
          (
            await supabase
              .from("vendor_sponsorships")
              .select("vendor_id")
              .eq("sponsorship_type", "business")
              .eq("payment_status", "active")
              .gt("expires_at", new Date().toISOString())
          ).data?.map((s) => s.vendor_id) || []
        )
        .order("average_rating", { ascending: false })
        .limit(10);
      if (data) setSponsoredVendors(data);
    }
    loadSponsored();
  }, []);

  // ── Load recent searches from localStorage ─────────────────
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // ── Geolocation ───────────────────────────────────────────
  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocationLabel("Getting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setDistanceEnabled(true);
        setLocationLabel("Location set ✓");
      },
      () => {
        setLocationLabel("Use Current");
        alert(
          "Could not get your location. Please enable location access and try again."
        );
      },
      { timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Search handler ────────────────────────────────────────
  function handleSearch() {
    const hasKeyword = keyword.trim().length > 0;
    const hasFilter =
      selectedCategory ||
      selectedSubcategory ||
      selectedState ||
      distanceEnabled;

    if (!hasKeyword && !hasFilter) {
      setSearchError(true);
      return;
    }

    setSearchError(false);
    setSearching(true);

    if (hasKeyword) saveRecentSearch(keyword.trim());

    // Build URL params — same pattern as the original discover.js
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (searchType !== "all") params.set("type", searchType);
    if (verifiedOnly) params.set("verified", "true");
    if (selectedCategory) params.set("category", selectedCategory);
    if (selectedSubcategory) params.set("subcategory", selectedSubcategory);
    if (selectedState) params.set("state", selectedState);
    if (selectedLga) params.set("lga", selectedLga);
    if (distanceEnabled && userLat !== null && userLng !== null) {
      params.set("lat", String(userLat));
      params.set("lng", String(userLng));
      params.set("radius", String(radiusKm));
    }

    // Navigate to /discover-results (Commit 3 builds that page)
    router.push(`/discover-results?${params.toString()}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function handleTrendingClick(kw: string) {
    setKeyword(kw);
    // Auto-search immediately, same as production
    const params = new URLSearchParams({ keyword: kw });
    if (searchType !== "all") params.set("type", searchType);
    saveRecentSearch(kw);
    router.push(`/discover-results?${params.toString()}`);
  }

  function handleRecentClick(kw: string) {
    setKeyword(kw);
    handleTrendingClick(kw);
  }

  function clearRecentSearches() {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      /* ignore */
    }
    setRecentSearches([]);
  }

  function resetFilters() {
    setSelectedCategory("");
    setSelectedSubcategory("");
    setSelectedState("");
    setSelectedLga("");
  }

  const stateList = Object.keys(
    nigeriaData as Record<string, string[]>
  ).sort();

  // ── Render ────────────────────────────────────────────────
  return (
    <main className={styles.discoverPage}>

      {/* HEADER */}
      <header className={styles.discoverHeader}>
        <a href="/" className={styles.discoverBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/spotlightlogo-512.png"
            alt="Spotlight"
            className={styles.discoverLogo}
          />
          <span className={styles.discoverBrandText}>Spotlight</span>
        </a>
      </header>

      {/* SEARCH SECTION */}
      <section className={styles.discoverSearchSection}>

        {/* SEARCH BOX */}
        <div className={styles.discoverSearchWrap}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            className={styles.discoverSearchInput}
            placeholder="Search products, services, vendors or categories"
            autoComplete="off"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setSearchError(false);
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className={styles.discoverSearchBtn}
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? "..." : "Search"}
          </button>
        </div>

        {searchError && (
          <p className={`${styles.discoverSearchError} ${styles.active}`}>
            Enter a keyword or use at least one filter.
          </p>
        )}

        {/* SEARCH TYPE TABS */}
        <div className={styles.discoverSearchTabs}>
          {(["all", "product", "service", "vendor"] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={`${styles.discoverTab} ${searchType === type ? styles.active : ""}`}
              onClick={() => setSearchType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* QUICK FILTERS */}
        <div className={styles.discoverQuickFilters}>
          <label className={styles.discoverToggleWrap}>
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
            />
            <span className={styles.discoverToggleSlider}></span>
            <span className={styles.discoverToggleLabel}>Verified Only</span>
          </label>

          <button
            type="button"
            className={styles.discoverMoreFiltersBtn}
            onClick={() => setDrawerOpen(true)}
          >
            More Filters
            <i className="fa-solid fa-sliders"></i>
          </button>
        </div>

        {/* DISTANCE SEARCH */}
        <div
          className={`${styles.discoverDistanceCard} ${distanceEnabled ? styles.distanceEnabled : ""}`}
        >
          <div className={styles.discoverDistanceTop}>
            <label className={styles.discoverDistanceToggle}>
              <input
                type="checkbox"
                checked={distanceEnabled}
                onChange={(e) => setDistanceEnabled(e.target.checked)}
              />
              <span className={styles.discoverDistanceCheckbox}></span>
              <span className={styles.discoverDistanceText}>
                Enable Distance Search
              </span>
            </label>

            <button
              type="button"
              className={styles.discoverLocationBtn}
              onClick={handleUseLocation}
            >
              <i className="fa-solid fa-location-crosshairs"></i>
              {locationLabel}
            </button>
          </div>

          <div className={styles.discoverDistanceSliderWrap}>
            <input
              type="range"
              className={styles.discoverDistanceSlider}
              min="1"
              max="20"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
            />
            <div className={styles.discoverDistanceScale}>
              <span>0km</span>
              <span className={styles.distanceRadiusValue}>{radiusKm}km</span>
              <span>20km</span>
            </div>
          </div>
        </div>
      </section>

      {/* SPONSORED VENDORS */}
      {sponsoredVendors.length > 0 && (
        <section className={styles.discoverSection}>
          <div className={styles.discoverSectionHeading}>
            <h2>Sponsored Vendors Near You</h2>
          </div>
          <div className={styles.discoverSponsoredScroll}>
            {sponsoredVendors.map((v) => (
              <article
                key={v.id}
                className={styles.discoverSponsoredCard}
                onClick={() => router.push(`/vendor/${v.slug}`)}
              >
                <div className={styles.discoverSponsoredTop}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.name)}&background=e6c200&color=000000&size=128`}
                    alt={v.name}
                    className={styles.discoverSponsoredLogo}
                  />
                  <div className={styles.discoverSponsoredInfo}>
                    <div className={styles.discoverSponsoredTitleRow}>
                      <p className={styles.discoverSponsoredName}>{v.name}</p>
                      <VendorBadge status={v.verification_status} />
                    </div>
                    <p className={styles.discoverSponsoredCat}>{v.subcategory || "Vendor"}</p>
                    <div className={styles.discoverSponsoredRatingWrap}>
                      <i className="fa-solid fa-star"></i>
                      <span>{Number(v.average_rating || 0).toFixed(1)}</span>
                      <small>({v.reviews_count || 0})</small>
                    </div>
                  </div>
                </div>

                <div className={styles.discoverSponsoredBottom}>
                  <span className={styles.discoverSponsoredLocation}>
                    <i className="fa-solid fa-location-dot"></i>
                    <span className={styles.discoverSponsoredLocationText}>
                      {v.lga && <span className={styles.discoverSponsoredLocationLine}>{v.lga}</span>}
                      {v.state && <span className={styles.discoverSponsoredLocationLine}>{v.state}</span>}
                    </span>
                  </span>
                  <div className={styles.discoverSponsoredActions}>
                    <button
                      type="button"
                      className={styles.reviewTriggerBtn}
                      onClick={(e) => { e.stopPropagation(); router.push(`/vendor/${v.slug}?review=1`); }}
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      className={styles.viewProfileBtn}
                      onClick={(e) => { e.stopPropagation(); router.push(`/vendor/${v.slug}`); }}
                    >
                      Profile
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* TRENDING SEARCHES */}
      {trending.length > 0 && (
        <section className={styles.discoverSection}>
          <div className={styles.discoverSectionHeading}>
            <h2>Trending Searches</h2>
          </div>
          <div className={styles.discoverTrendingTags}>
            {trending.map((t) => (
              <button
                key={t.keyword}
                type="button"
                onClick={() => handleTrendingClick(t.keyword)}
              >
                {t.keyword}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* RECENT SEARCHES */}
      {recentSearches.length > 0 && (
        <section className={styles.discoverSection}>
          <div className={styles.discoverSectionHeading}>
            <h2>Recent Searches</h2>
          </div>
          <div className={styles.discoverRecentList}>
            {recentSearches.map((kw) => (
              <button
                key={kw}
                type="button"
                className={styles.discoverRecentItem}
                onClick={() => handleRecentClick(kw)}
              >
                <i className="fa-solid fa-clock-rotate-left"></i>
                {kw}
              </button>
            ))}
            <button
              type="button"
              className={styles.discoverClearRecent}
              onClick={clearRecentSearches}
            >
              Clear recent searches
            </button>
          </div>
        </section>
      )}

      {/* MOBILE BOTTOM NAV */}
      <nav className={styles.discoverBottomNav}>
        <a href="/" className={styles.discoverBottomItem}>
          <i className="fa-solid fa-compass"></i>
          <span>Explore</span>
        </a>
        <ProfileNav buttonClassName={styles.discoverBottomItem} />
      </nav>

      {/* FILTER DRAWER */}
      <aside className={`${styles.discoverFiltersDrawer} ${drawerOpen ? styles.active : ""}`}>
        <div className={styles.discoverFiltersHeader}>
          <h3>More Filters</h3>
          <button
            type="button"
            className={styles.closeFiltersDrawerBtn}
            onClick={() => setDrawerOpen(false)}
          >
            ×
          </button>
        </div>

        <div className={styles.discoverFiltersBody}>
          <div className={styles.discoverFilterGroup}>
            <label>Category</label>
            <SearchableSelect
              placeholder="Select Category"
              searchPlaceholder="Search categories..."
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className={styles.discoverFilterGroup}>
            <label>Subcategory</label>
            <SearchableSelect
              placeholder="Select Subcategory"
              searchPlaceholder="Search subcategories..."
              value={selectedSubcategory}
              onChange={setSelectedSubcategory}
              disabled={!selectedCategory}
              options={subcategories.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <div className={styles.discoverFilterGroup}>
            <label>State</label>
            <select
              className={styles.discoverFilterSelect}
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
            >
              <option value="">Select State</option>
              {stateList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className={styles.discoverFilterGroup}>
            <label>LGA</label>
            <select
              className={styles.discoverFilterSelect}
              value={selectedLga}
              onChange={(e) => setSelectedLga(e.target.value)}
              disabled={!selectedState}
            >
              <option value="">Select LGA</option>
              {lgaList.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.discoverFiltersFooter}>
          <button
            type="button"
            className={styles.discoverResetBtn}
            onClick={resetFilters}
          >
            Reset
          </button>
          <button
            type="button"
            className={styles.discoverApplyBtn}
            onClick={() => setDrawerOpen(false)}
          >
            Apply Filters
          </button>
        </div>
      </aside>

      {/* OVERLAY */}
      <div
        className={`${styles.discoverDrawerOverlay} ${drawerOpen ? styles.active : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* SEARCH LOADING OVERLAY */}
      {searching && (
        <div className={`${styles.discoverSearchLoading} ${styles.active}`}>
          <div className={styles.discoverSearchSpinner}></div>
          <p>Searching...</p>
        </div>
      )}
    </main>
  );
}
