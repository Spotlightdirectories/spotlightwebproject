"use client";

// ===============================================================
// src/components/HomeCategorySearch.tsx
//
// Homepage smart search + category browser (2026-08, per Cyril —
// Jiji-style). Replaces the old "Search Nearby" hero button, which
// was just a static link to /discover with no real functionality.
//
// Behavior:
// - The search bar lives in its own full-width strip at the very top
//   of the homepage (above the hero heading — per Cyril, 2026-08),
//   and stays visible at all times. Focusing the input opens a
//   dropdown panel docked directly BELOW it (pure CSS: position:
//   absolute, top:100% of the wrap) — not a full-screen takeover.
//   There's no dimming backdrop and nothing ever renders on top of
//   the input, so the bar itself is never obscured or blurred while
//   typing; the category list simply appears underneath it, the way
//   SearchableSelect's own dropdown works elsewhere on the site.
//   (Earlier versions used a full-page dimmed backdrop per Cyril's
//   original spec, then a JS-measured "docked" position to work
//   around it; both are gone now in favor of this simpler, more
//   reliable CSS-only anchor.)
// - Typing filters the category list — matches (tagged Product or
//   Service, since a search can match both) bubble to the top under
//   "Best Matches". The rest of the list stays visible below, split
//   into "Products" and "Services" sections, so browsing is still
//   possible without a perfect-match query.
// - Desktop: hovering a category reveals its subcategories in a
//   second pane alongside the category list (two-pane layout).
// - Mobile (<=768px, matched via matchMedia so it reflows live on
//   resize/rotation): no hover, so tapping a category's chevron
//   expands its subcategories inline (accordion), tapping the
//   category name itself navigates straight to that category.
// - Clicking a category or subcategory, or submitting free-text
//   keyword search, navigates straight to /discover-results with
//   that filter applied — no intermediate /discover step. /discover
//   itself is untouched and still exists as the "advanced search"
//   entry point (state/LGA/distance/verified-only).
//
// Categories — BOTH Products and Services (2026-08 expansion, per
// Cyril — a search for e.g. "Accountant" needs to surface a service
// category, not just products) — are fetched once, the first time
// the panel opens, and cached in state, each tagged with its
// `kind` so navigation and grouping stay correct. Subcategories are
// fetched lazily per category the first time it's hovered/tapped,
// cached per category id — same lazy-cascade pattern already used in
// ProductsTab.tsx / the /discover filter drawer, just reused here
// instead of rebuilt. Subcategory ids are not guaranteed unique
// across kinds, so the cache and active-category state are keyed by
// category id only (fine, since a given category id only ever maps
// to one kind).
// ===============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./home-category-search.module.css";

type CategoryKind = "product" | "service";
type Category = { id: string; name: string; kind: CategoryKind; image_url: string | null };
type Subcategory = { id: string; name: string };
type FlatSubcategory = { id: string; name: string; category_id: string };
// Third taxonomy level — Fashion (products) / Tailoring & Fashion
// Designer (services), 2026-08 per Cyril: "let fashion be exactly as
// is in jiji". A subcategory with no rows here simply has no third
// level, so every other category keeps working exactly as before.
type SubSubcategory = { id: string; name: string };
type FlatSubSubcategory = { id: string; name: string; subcategory_id: string };

// Search-only singular/plural tolerance (per Cyril, 2026-08): the
// site's category/subcategory NAMES are kept singular sitewide (e.g.
// "Vehicle", not "Vehicles" — matches the vendor onboarding dropdowns
// and avoids near-duplicate entries), so typing the plural form a
// customer would naturally use ("vehicles") needs to still find it.
// This is a light, dictionary-free heuristic covering the common
// English patterns (-s, -es, -y/-ies) in both directions — it never
// touches the database or the onboarding pickers, it only widens
// what counts as a match in this search box.
function wordVariants(word: string): string[] {
  const variants = new Set([word]);
  if (word.endsWith("ies") && word.length > 3) variants.add(word.slice(0, -3) + "y"); // categories -> category
  if (word.endsWith("es") && word.length > 2) variants.add(word.slice(0, -2)); // boxes -> box
  if (word.endsWith("s") && word.length > 1) variants.add(word.slice(0, -1)); // vehicles -> vehicle
  if (word.endsWith("y") && word.length > 1) variants.add(word.slice(0, -1) + "ies"); // category -> categories
  variants.add(word + "s"); // vehicle -> vehicles
  variants.add(word + "es"); // box -> boxes
  return Array.from(variants);
}

function matchesQuery(name: string, normalizedQuery: string): boolean {
  const lowerName = name.toLowerCase();
  if (lowerName.includes(normalizedQuery)) return true;
  return wordVariants(normalizedQuery).some((v) => v !== normalizedQuery && lowerName.includes(v));
}

export default function HomeCategorySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const categoriesLoadedRef = useRef(false);

  // Flat list of every subcategory (~2,300 rows, product + service
  // combined), loaded once up front so typing can match against
  // subcategory names too — e.g. "mat" should surface the "Mattress"
  // subcategory, not just categories whose own name contains "mat".
  const [allSubcategories, setAllSubcategories] = useState<FlatSubcategory[]>([]);
  const subcategoriesAllLoadedRef = useRef(false);

  // Flat list of every sub-subcategory (third level — small for now,
  // just the Fashion/Tailoring pilot), loaded once up front alongside
  // allSubcategories so typing can match against these names too.
  const [allSubSubcategories, setAllSubSubcategories] = useState<FlatSubSubcategory[]>([]);
  const subSubcategoriesAllLoadedRef = useRef(false);

  // Live "X listings" counts per category/subcategory (Cyril, 2026-08:
  // "the moment vendors start onboarding, the number of products and
  // services for each category and subcat should also show"). Backed
  // by two DB views (category_listing_counts / subcategory_listing_
  // counts) that already match the same public-visibility rules the
  // rest of the site uses, so a count shown here always lines up with
  // what a customer actually finds by clicking through. A category/
  // subcategory with no listings simply has no entry in these maps —
  // the UI hides the badge rather than showing "0".
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [subcategoryCounts, setSubcategoryCounts] = useState<Record<string, number>>({});
  const countsLoadedRef = useRef(false);

  async function fetchAllCounts(
    table: "category_listing_counts" | "subcategory_listing_counts",
    idColumn: "category_id" | "subcategory_id"
  ): Promise<Record<string, number>> {
    const pageSize = 1000;
    let from = 0;
    const map: Record<string, number> = {};
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select(`${idColumn},listing_count`)
        .range(from, from + pageSize - 1);
      if (error || !data) break;
      for (const row of data as Record<string, number | string>[]) {
        map[String(row[idColumn])] = Number(row.listing_count);
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return map;
  }

  // Supabase/PostgREST caps an unpaginated select() at 1,000 rows by
  // default — with ~2,339 subcategories total, a plain .select() was
  // silently truncating the list around the letter K, so anything
  // alphabetically after that (e.g. "Mama Put") never made it into
  // allSubcategories and could never match a search, even though the
  // row existed. Fetching in 1,000-row pages fixes it (found 2026-08,
  // after Cyril reported "Mama Put" specifically missing from search
  // while earlier-alphabet subcategories like "Canteen"/"Eatery"
  // worked fine).
  async function fetchAllSubcategories(): Promise<FlatSubcategory[]> {
    const pageSize = 1000;
    let from = 0;
    const all: FlatSubcategory[] = [];
    for (;;) {
      const { data, error } = await supabase
        .from("subcategories")
        .select("id,name,category_id")
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error || !data) break;
      all.push(...(data as FlatSubcategory[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  // Sub-subcategories are few for now (just the Fashion/Tailoring
  // pilot), so a single plain select is plenty — no pagination needed
  // like fetchAllSubcategories above.
  async function fetchAllSubSubcategories(): Promise<FlatSubSubcategory[]> {
    const { data, error } = await supabase
      .from("sub_subcategories")
      .select("id,name,subcategory_id")
      .order("name", { ascending: true });
    if (error || !data) return [];
    return data as FlatSubSubcategory[];
  }

  // Desktop: which category is currently hovered (drives the right
  // pane). Mobile: which category is currently expanded (accordion) —
  // same piece of state serves both, since only one applies at a time.
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [subcategoriesCache, setSubcategoriesCache] = useState<Record<string, Subcategory[]>>({});
  const [loadingSubcatId, setLoadingSubcatId] = useState<string | null>(null);

  // THIRD LEVEL — same pattern one level deeper. Desktop: which
  // subcategory (within the currently-hovered category) is itself
  // hovered, revealing a third pane. Mobile: which subcategory is
  // expanded inline as a nested accordion. Only ever populated for a
  // subcategory that actually has sub-subcategories (Fashion/Tailoring
  // pilot) — every other subcategory just has nothing here.
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null);
  const [subSubcategoriesCache, setSubSubcategoriesCache] = useState<Record<string, SubSubcategory[]>>({});
  const [loadingSubSubcatId, setLoadingSubSubcatId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scrollable containers — reset to the top whenever the query
  // changes (below), so a fresh search always opens on its own
  // results instead of leaving the view scrolled to wherever the
  // PREVIOUS search happened to leave it (Cyril, 2026-08: typing
  // "house", scrolling down, then retyping "Real Estate" left the
  // new matches sitting off-screen above the still-scrolled view).
  const categoryColumnRef = useRef<HTMLDivElement>(null);
  const subcategoryColumnRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null); // mobile: single shared scroll

  // Track mobile vs desktop live, so rotating a tablet or resizing a
  // browser window switches behavior without needing a reload.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const ensureCategoriesLoaded = useCallback(async () => {
    if (categoriesLoadedRef.current) return;
    categoriesLoadedRef.current = true;
    setLoadingCategories(true);
    const [categoriesRes, allSubcats, allSubSubcats, catCounts, subcatCounts] = await Promise.all([
      supabase.from("categories").select("id,name,kind,image_url").in("kind", ["product", "service"]).order("name", { ascending: true }),
      subcategoriesAllLoadedRef.current ? Promise.resolve(null) : fetchAllSubcategories(),
      subSubcategoriesAllLoadedRef.current ? Promise.resolve(null) : fetchAllSubSubcategories(),
      countsLoadedRef.current ? Promise.resolve(null) : fetchAllCounts("category_listing_counts", "category_id"),
      countsLoadedRef.current ? Promise.resolve(null) : fetchAllCounts("subcategory_listing_counts", "subcategory_id"),
    ]);
    if (!categoriesRes.error) {
      const loadedCategories = (categoriesRes.data || []) as Category[];
      setCategories(loadedCategories);
      // Warm the browser's image cache for every category thumbnail
      // right away, so by the time the panel actually opens the
      // pictures are already downloaded and just pop straight in
      // instead of streaming in one-by-one as each <img> scrolls
      // into view (Cyril, 2026-08 — the "go slow" fade-in effect).
      for (const cat of loadedCategories) {
        if (cat.image_url) {
          const preload = new window.Image();
          preload.src = cat.image_url;
        }
      }
    }
    if (!subcategoriesAllLoadedRef.current && allSubcats) {
      subcategoriesAllLoadedRef.current = true;
      setAllSubcategories(allSubcats);
    }
    if (!subSubcategoriesAllLoadedRef.current && allSubSubcats) {
      subSubcategoriesAllLoadedRef.current = true;
      setAllSubSubcategories(allSubSubcats);
    }
    if (!countsLoadedRef.current && catCounts && subcatCounts) {
      countsLoadedRef.current = true;
      setCategoryCounts(catCounts);
      setSubcategoryCounts(subcatCounts);
    }
    setLoadingCategories(false);
  }, []);

  function openPanel() {
    setOpen(true);
    ensureCategoriesLoaded();
  }

  // Prefetch categories (+ subcategories + counts + thumbnail images)
  // as soon as the homepage loads, in the background, instead of
  // waiting for the user to click/focus the search bar. Cyril,
  // 2026-08: "Loading categories..." was visibly showing for a few
  // seconds on click, and category thumbnails were popping in one by
  // one — both because this ~2,300-row fetch + ~180 image downloads
  // only started the moment the bar was clicked. By kicking it off on
  // mount, the data (and images) are almost always already sitting in
  // the browser's cache by the time someone actually taps the bar, so
  // the panel opens instantly with images already in place. Wrapped
  // in a short delay so it doesn't compete with the hero/above-the-
  // fold content for bandwidth on first paint.
  useEffect(() => {
    const timer = setTimeout(() => {
      ensureCategoriesLoaded();
    }, 400);
    return () => clearTimeout(timer);
  }, [ensureCategoriesLoaded]);

  function closePanel() {
    setOpen(false);
    setActiveCategoryId(null);
  }

  // Close on outside click / Escape — standard takeover-panel behavior.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function ensureSubcategoriesLoaded(categoryId: string) {
    if (subcategoriesCache[categoryId] || loadingSubcatId === categoryId) return;
    setLoadingSubcatId(categoryId);
    const { data, error } = await supabase
      .from("subcategories")
      .select("id,name")
      .eq("category_id", categoryId)
      .order("name", { ascending: true });
    if (!error) {
      setSubcategoriesCache((prev) => ({ ...prev, [categoryId]: data || [] }));
    }
    setLoadingSubcatId(null);
  }

  async function ensureSubSubcategoriesLoaded(subcategoryId: string) {
    if (subSubcategoriesCache[subcategoryId] || loadingSubSubcatId === subcategoryId) return;
    setLoadingSubSubcatId(subcategoryId);
    const { data, error } = await supabase
      .from("sub_subcategories")
      .select("id,name")
      .eq("subcategory_id", subcategoryId)
      .order("display_order", { ascending: true });
    if (!error) {
      setSubSubcategoriesCache((prev) => ({ ...prev, [subcategoryId]: data || [] }));
    }
    setLoadingSubSubcatId(null);
  }

  function handleCategoryHover(categoryId: string) {
    if (isMobile) return; // hover doesn't apply on mobile
    setActiveCategoryId(categoryId);
    setActiveSubcategoryId(null);
    ensureSubcategoriesLoaded(categoryId);
  }

  // Mobile-only: tapping the chevron toggles this category's
  // accordion open/closed without navigating.
  function handleToggleExpand(e: React.MouseEvent, categoryId: string) {
    e.stopPropagation();
    const next = activeCategoryId === categoryId ? null : categoryId;
    setActiveCategoryId(next);
    setActiveSubcategoryId(null);
    if (next) ensureSubcategoriesLoaded(categoryId);
  }

  // Desktop: hovering a subcategory row (within the already-hovered
  // category's list) reveals its sub-subcategories in a third pane —
  // only actually has an effect for a subcategory that has any (see
  // subSubcategoriesCache/allSubSubcategories, Fashion/Tailoring
  // pilot, 2026-08 per Cyril).
  function handleSubcategoryHover(subcategoryId: string) {
    if (isMobile) return;
    setActiveSubcategoryId(subcategoryId);
    ensureSubSubcategoriesLoaded(subcategoryId);
  }

  // Mobile-only: tapping a subcategory row that has a third level
  // expands it inline (nested accordion) instead of navigating
  // straight there — matches handleToggleExpand one level down.
  function handleSubcategoryToggleExpand(e: React.MouseEvent, subcategoryId: string) {
    e.stopPropagation();
    const next = activeSubcategoryId === subcategoryId ? null : subcategoryId;
    setActiveSubcategoryId(next);
    if (next) ensureSubSubcategoriesLoaded(subcategoryId);
  }

  // type is now passed in explicitly per category, since the panel
  // mixes Products and Services categories — each result should be
  // scoped to whichever taxonomy the clicked category belongs to,
  // not hardcoded to "product".
  //
  // NOTE: discover-results reads category/subcategory/subsubcategory
  // as NAMES, not ids — the search_vendors/search_products/
  // search_services RPCs all match on the category/subcategory/
  // sub_subcategory NAME text column, not any id. These three
  // functions take the id only to look its name up here, so the
  // actual URL always carries the name (matches how the filter
  // drawer on discover-results already works).
  function goToCategory(categoryId: string, kind: CategoryKind) {
    closePanel();
    const name = categories.find((c) => c.id === categoryId)?.name || "";
    const trimmed = query.trim();
    const params = new URLSearchParams();
    params.set("category", name);
    params.set("type", kind);
    if (trimmed) params.set("keyword", trimmed);
    router.push(`/discover-results?${params.toString()}`);
  }

  function goToSubcategory(categoryId: string, subcategoryId: string, kind: CategoryKind) {
    closePanel();
    const categoryName = categories.find((c) => c.id === categoryId)?.name || "";
    const subcategoryName =
      subcategoriesCache[categoryId]?.find((s) => s.id === subcategoryId)?.name ||
      allSubcategories.find((s) => s.id === subcategoryId)?.name ||
      "";
    const trimmed = query.trim();
    const params = new URLSearchParams();
    params.set("category", categoryName);
    params.set("subcategory", subcategoryName);
    params.set("type", kind);
    if (trimmed) params.set("keyword", trimmed);
    router.push(`/discover-results?${params.toString()}`);
  }

  function goToSubSubcategory(
    categoryId: string,
    subcategoryId: string,
    subSubcategoryId: string,
    kind: CategoryKind
  ) {
    closePanel();
    const categoryName = categories.find((c) => c.id === categoryId)?.name || "";
    const subcategoryName =
      subcategoriesCache[categoryId]?.find((s) => s.id === subcategoryId)?.name ||
      allSubcategories.find((s) => s.id === subcategoryId)?.name ||
      "";
    const subSubcategoryName =
      subSubcategoriesCache[subcategoryId]?.find((s) => s.id === subSubcategoryId)?.name ||
      allSubSubcategories.find((s) => s.id === subSubcategoryId)?.name ||
      "";
    const trimmed = query.trim();
    const params = new URLSearchParams();
    params.set("category", categoryName);
    params.set("subcategory", subcategoryName);
    params.set("subsubcategory", subSubcategoryName);
    params.set("type", kind);
    if (trimmed) params.set("keyword", trimmed);
    router.push(`/discover-results?${params.toString()}`);
  }

  function handleKeywordSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    closePanel();
    router.push(`/discover-results?keyword=${encodeURIComponent(trimmed)}`);
  }

  const normalizedQuery = query.trim().toLowerCase();

  // See categoryColumnRef/subcategoryColumnRef/panelRef above — jump
  // every scrollable pane back to the top whenever the query text
  // actually changes, so new results are always immediately visible
  // rather than hidden above wherever the previous search left the
  // scroll position.
  //
  // Also clear activeCategoryId here (Cyril, 2026-08: typed
  // "refrigerator" but the right pane kept showing "Fashion &
  // Tailoring" — a category he'd hovered earlier and then stopped
  // touching). Hovering a category is meant to win over search
  // results only while it's the CURRENT deliberate action; once the
  // user goes back to typing a new query, that old hover is stale
  // and should no longer dominate the pane. If they genuinely hover
  // a category again, handleCategoryHover sets this right back.
  useEffect(() => {
    categoryColumnRef.current?.scrollTo({ top: 0 });
    subcategoryColumnRef.current?.scrollTo({ top: 0 });
    panelRef.current?.scrollTo({ top: 0 });
    setActiveCategoryId(null);
    setActiveSubcategoryId(null);
  }, [normalizedQuery]);

  const matched = normalizedQuery ? categories.filter((c) => matchesQuery(c.name, normalizedQuery)) : [];
  const matchedIds = new Set(matched.map((c) => c.id));
  const rest = categories.filter((c) => !matchedIds.has(c.id));
  // Products and Services are kept in visibly separate groups when
  // browsing (unfiltered) — with 98 + 82 categories combined, mixing
  // them without labels would be confusing. While typing, "Best
  // Matches" stays mixed (with a per-row kind tag) since the user is
  // hunting for a specific word, e.g. "Accountant", not browsing a
  // taxonomy.
  const restProducts = rest.filter((c) => c.kind === "product");
  const restServices = rest.filter((c) => c.kind === "service");

  // Subcategory matches — e.g. typing "mat" should surface the
  // "Mattress" subcategory even though no CATEGORY name contains
  // "mat". Each match is paired with its parent category (for the
  // "Category > Subcategory" label and for navigation/kind-tagging),
  // dropping any orphaned rows where the parent category hasn't
  // loaded for some reason.
  const matchedSubcatEntries = normalizedQuery
    ? allSubcategories
        .filter((s) => matchesQuery(s.name, normalizedQuery))
        .map((s) => ({ sub: s, category: categories.find((c) => c.id === s.category_id) }))
        .filter((entry): entry is { sub: FlatSubcategory; category: Category } => !!entry.category)
    : [];

  // Sub-subcategory matches — e.g. typing "watches" should surface
  // "Men's Watches" even though neither "Clothing & Fashion" nor
  // "Men's Fashion" contain that word. Each match carries its full
  // breadcrumb (category > subcategory > sub-subcategory) for the
  // label and for navigation.
  const matchedSubSubcatEntries = normalizedQuery
    ? allSubSubcategories
        .filter((ss) => matchesQuery(ss.name, normalizedQuery))
        .map((ss) => {
          const sub = allSubcategories.find((s) => s.id === ss.subcategory_id);
          const category = sub ? categories.find((c) => c.id === sub.category_id) : undefined;
          return { subSub: ss, sub, category };
        })
        .filter(
          (entry): entry is { subSub: FlatSubSubcategory; sub: FlatSubcategory; category: Category } =>
            !!entry.sub && !!entry.category
        )
    : [];

  function renderCategoryRow(cat: Category, highlighted: boolean) {
    const isActive = activeCategoryId === cat.id;
    const subs = subcategoriesCache[cat.id];
    const isLoadingSubs = loadingSubcatId === cat.id;

    return (
      <div
        key={cat.id}
        className={`${styles.categoryRow} ${highlighted ? styles.categoryRowHighlighted : ""} ${
          isActive ? styles.categoryRowActive : ""
        }`}
        onMouseEnter={() => handleCategoryHover(cat.id)}
      >
        <button type="button" className={styles.categoryBtn} onClick={() => goToCategory(cat.id, cat.kind)}>
          {/* Category photo (Cyril, 2026-08: "like Jiji" — pilot batch of
              ~15 categories only for now, sourced from Wikimedia Commons.
              Categories without a photo yet just render without one —
              no placeholder — so the pilot doesn't look broken next to
              the ~165 still pending. */}
          {cat.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cat.image_url} alt="" className={styles.categoryThumb} loading="lazy" />
          )}
          <span className={styles.categoryName}>{cat.name}</span>
          <span className={`${styles.kindTag} ${cat.kind === "service" ? styles.kindTagService : styles.kindTagProduct}`}>
            {cat.kind === "service" ? "Service" : "Product"}
          </span>
          {!!categoryCounts[cat.id] && <span className={styles.listingCount}>{categoryCounts[cat.id]}</span>}
        </button>
        <button
          type="button"
          className={styles.categoryChevron}
          onClick={(e) => handleToggleExpand(e, cat.id)}
          aria-label={`Show ${cat.name} subcategories`}
        >
          {/* Updated 2026-08-23 per Cyril: this now works the same way
              on desktop as it already did on mobile -- click/tap the
              arrow, subcategories appear directly below this row,
              arrow flips from › to ⌄ to confirm which category
              they belong to. Desktop's existing hover-to-reveal side
              panel (subcategoryColumn, further down) is untouched and
              still works too -- this is an additional, explicit way
              to get the same result, not a replacement. */}
          <span className={styles.chevronChar}>{isActive ? "\u2304" : "\u203a"}</span>
        </button>

        {/* Updated 2026-08-23 per Cyril: no longer mobile-only -- see
            categoryChevron comment above. Renders inline under this
            row on any screen size once expanded via the arrow. */}
        {isActive && (
          <div className={styles.mobileSubcatList}>
            {isLoadingSubs ? (
              <div className={styles.panelLoading}>Loading...</div>
            ) : subs && subs.length > 0 ? (
              subs.map((sub) => renderSubcatRow(sub, cat))
            ) : (
              <div className={styles.panelLoading}>No subcategories yet — browse all {cat.name}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Mobile-only row for a single subcategory inside the first-level
  // accordion. If it has a third level, tapping it expands a nested
  // accordion (like the category row above, one level down) instead
  // of navigating; otherwise it behaves exactly as before.
  function renderSubcatRow(sub: Subcategory, cat: Category) {
    const isSubActive = activeSubcategoryId === sub.id;
    const subSubs = subSubcategoriesCache[sub.id];
    const isLoadingSubSubs = loadingSubSubcatId === sub.id;
    const knownHasChildren = allSubSubcategories.some((ss) => ss.subcategory_id === sub.id);

    return (
      <div key={sub.id}>
        <button
          type="button"
          className={styles.subcatBtn}
          onClick={(e) =>
            knownHasChildren ? handleSubcategoryToggleExpand(e, sub.id) : goToSubcategory(cat.id, sub.id, cat.kind)
          }
        >
          <span>{sub.name}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!!subcategoryCounts[sub.id] && <span className={styles.listingCount}>{subcategoryCounts[sub.id]}</span>}
            {knownHasChildren && (
              <i className={`fa-solid ${isSubActive ? "fa-chevron-down" : "fa-chevron-right"} ${styles.subcatHasMore}`}></i>
            )}
          </span>
        </button>

        {/* Updated 2026-08-23 per Cyril: no longer mobile-only --
            same reasoning as the category level above. */}
        {isSubActive && (
          <div className={styles.subSubcatList}>
            {isLoadingSubSubs ? (
              <div className={styles.panelLoading}>Loading...</div>
            ) : subSubs && subSubs.length > 0 ? (
              subSubs.map((subSub) => (
                <button
                  type="button"
                  key={subSub.id}
                  className={styles.subcatBtn}
                  onClick={() => goToSubSubcategory(cat.id, sub.id, subSub.id, cat.kind)}
                >
                  <span>{subSub.name}</span>
                </button>
              ))
            ) : (
              <div className={styles.panelLoading}>Browse all {sub.name}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  const hoveredSubs = activeCategoryId ? subcategoriesCache[activeCategoryId] : undefined;
  const hoveredCategory = categories.find((c) => c.id === activeCategoryId);
  const isLoadingHoveredSubs = loadingSubcatId === activeCategoryId;

  // Desktop third pane — only relevant when the currently-hovered
  // subcategory actually belongs to the currently-hovered category
  // (guards against a stale activeSubcategoryId briefly surviving a
  // category switch) and has sub-subcategories.
  const hoveredSubcategory = hoveredSubs?.find((s) => s.id === activeSubcategoryId);
  const hoveredSubSubs = hoveredSubcategory ? subSubcategoriesCache[hoveredSubcategory.id] : undefined;
  const isLoadingHoveredSubSubs = hoveredSubcategory ? loadingSubSubcatId === hoveredSubcategory.id : false;
  const showThirdPane =
    !!hoveredSubcategory && allSubSubcategories.some((ss) => ss.subcategory_id === hoveredSubcategory.id);

  return (
    <div className={styles.wrap} ref={containerRef}>
      <form className={styles.searchForm} onSubmit={handleKeywordSubmit}>
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="What are you looking for? e.g. phone, generator, tailor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={openPanel}
        />
        {query && (
          <button type="button" className={styles.clearBtn} onClick={() => setQuery("")} aria-label="Clear search">
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
        <button type="submit" className={styles.submitBtn}>
          Search
        </button>
      </form>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Category search" ref={panelRef}>
            <button type="button" className={styles.panelClose} onClick={closePanel} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>

            {loadingCategories ? (
              <div className={styles.panelLoading}>Loading categories...</div>
            ) : (
              <div className={`${styles.panelBody} ${showThirdPane ? styles.panelBodyThree : ""}`}>
                <div className={styles.categoryColumn} ref={categoryColumnRef}>
                  {matched.length > 0 && (
                    <>
                      <p className={styles.sectionLabel}>Best Matches</p>
                      <div className={styles.categoryList}>{matched.map((cat) => renderCategoryRow(cat, true))}</div>
                    </>
                  )}

                  {/* MOBILE-ONLY — same "Matching Subcategories" result
                      as the desktop right pane below, but inline here
                      since mobile has no separate right pane (hidden
                      via CSS on desktop, where the right pane handles
                      this instead). */}
                  {normalizedQuery && matchedSubcatEntries.length > 0 && (
                    <div className={styles.mobileSubcatMatches}>
                      <p className={styles.sectionLabel}>Matching Subcategories ({matchedSubcatEntries.length})</p>
                      <div className={styles.subcatGrid}>
                        {matchedSubcatEntries.map(({ sub, category }) => (
                          <button
                            type="button"
                            key={sub.id}
                            className={styles.subcatMatchBtn}
                            onClick={() => goToSubcategory(category.id, sub.id, category.kind)}
                          >
                            <span className={styles.subcatParentLabel}>{category.name}</span>
                            <span className={styles.subcatMatchName}>{sub.name}</span>
                            <span className={`${styles.kindTag} ${category.kind === "service" ? styles.kindTagService : styles.kindTagProduct}`}>
                              {category.kind === "service" ? "Service" : "Product"}
                            </span>
                            {!!subcategoryCounts[sub.id] && <span className={styles.listingCount}>{subcategoryCounts[sub.id]}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MOBILE-ONLY — sub-subcategory search matches (e.g.
                      "watches" -> "Men's Watches"), same idea one level
                      deeper. Desktop's right pane covers this instead. */}
                  {normalizedQuery && matchedSubSubcatEntries.length > 0 && (
                    <div className={styles.mobileSubcatMatches}>
                      <p className={styles.sectionLabel}>More Specific Matches ({matchedSubSubcatEntries.length})</p>
                      <div className={styles.subcatGrid}>
                        {matchedSubSubcatEntries.map(({ subSub, sub, category }) => (
                          <button
                            type="button"
                            key={subSub.id}
                            className={styles.subcatMatchBtn}
                            onClick={() => goToSubSubcategory(category.id, sub.id, subSub.id, category.kind)}
                          >
                            <span className={styles.subcatParentLabel}>
                              {category.name} › {sub.name}
                            </span>
                            <span className={styles.subcatMatchName}>{subSub.name}</span>
                            <span className={`${styles.kindTag} ${category.kind === "service" ? styles.kindTagService : styles.kindTagProduct}`}>
                              {category.kind === "service" ? "Service" : "Product"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className={styles.sectionLabel}>Products ({restProducts.length})</p>
                  <div className={styles.categoryList}>{restProducts.map((cat) => renderCategoryRow(cat, false))}</div>
                  <p className={styles.sectionLabel}>Services ({restServices.length})</p>
                  <div className={styles.categoryList}>{restServices.map((cat) => renderCategoryRow(cat, false))}</div>
                </div>

                {/* DESKTOP-ONLY RIGHT PANE. Hidden on mobile via CSS
                    (the accordion above handles mobile instead).
                    Priority: hovering a category is a deliberate
                    action and always wins, showing that category's
                    own subcategories — regardless of what's typed in
                    the search bar. The "Matching Subcategories" search
                    result (e.g. "mat" -> "Mattress") only takes this
                    pane over when nothing is currently hovered, since
                    a subcategory match is itself the destination —
                    clicking it navigates straight there, no further
                    hover needed. */}
                <div className={styles.subcategoryColumn} ref={subcategoryColumnRef}>
                  {hoveredCategory ? (
                    <>
                      <p className={styles.sectionLabel}>
                        {hoveredCategory.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hoveredCategory.image_url} alt="" className={styles.categoryThumb} loading="lazy" />
                        )}
                        {hoveredCategory.name}
                      </p>
                      {isLoadingHoveredSubs ? (
                        <div className={styles.panelLoading}>Loading...</div>
                      ) : hoveredSubs && hoveredSubs.length > 0 ? (
                        <div className={styles.subcatGrid}>
                          {hoveredSubs.map((sub) => {
                            const hasChildren = allSubSubcategories.some((ss) => ss.subcategory_id === sub.id);
                            return (
                              <button
                                type="button"
                                key={sub.id}
                                className={styles.subcatBtn}
                                onMouseEnter={() => handleSubcategoryHover(sub.id)}
                                onClick={() => goToSubcategory(hoveredCategory.id, sub.id, hoveredCategory.kind)}
                              >
                                <span>{sub.name}</span>
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {!!subcategoryCounts[sub.id] && <span className={styles.listingCount}>{subcategoryCounts[sub.id]}</span>}
                                  {hasChildren && <i className={`fa-solid fa-chevron-right ${styles.subcatHasMore}`}></i>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className={styles.subcategoryHint}>No subcategories listed yet — browse all {hoveredCategory.name}.</p>
                      )}
                    </>
                  ) : normalizedQuery && (matchedSubcatEntries.length > 0 || matchedSubSubcatEntries.length > 0) ? (
                    <>
                      {matchedSubcatEntries.length > 0 && (
                        <>
                          <p className={styles.sectionLabel}>Matching Subcategories ({matchedSubcatEntries.length})</p>
                          <div className={styles.subcatGrid}>
                            {matchedSubcatEntries.map(({ sub, category }) => (
                              <button
                                type="button"
                                key={sub.id}
                                className={styles.subcatMatchBtn}
                                onClick={() => goToSubcategory(category.id, sub.id, category.kind)}
                              >
                                <span className={styles.subcatParentLabel}>{category.name}</span>
                                <span className={styles.subcatMatchName}>{sub.name}</span>
                                <span className={`${styles.kindTag} ${category.kind === "service" ? styles.kindTagService : styles.kindTagProduct}`}>
                                  {category.kind === "service" ? "Service" : "Product"}
                                </span>
                                {!!subcategoryCounts[sub.id] && <span className={styles.listingCount}>{subcategoryCounts[sub.id]}</span>}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {matchedSubSubcatEntries.length > 0 && (
                        <>
                          <p className={styles.sectionLabel}>More Specific Matches ({matchedSubSubcatEntries.length})</p>
                          <div className={styles.subcatGrid}>
                            {matchedSubSubcatEntries.map(({ subSub, sub, category }) => (
                              <button
                                type="button"
                                key={subSub.id}
                                className={styles.subcatMatchBtn}
                                onClick={() => goToSubSubcategory(category.id, sub.id, subSub.id, category.kind)}
                              >
                                <span className={styles.subcatParentLabel}>
                                  {category.name} › {sub.name}
                                </span>
                                <span className={styles.subcatMatchName}>{subSub.name}</span>
                                <span className={`${styles.kindTag} ${category.kind === "service" ? styles.kindTagService : styles.kindTagProduct}`}>
                                  {category.kind === "service" ? "Service" : "Product"}
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : normalizedQuery ? (
                    <p className={styles.subcategoryHint}>No subcategories match &ldquo;{query.trim()}&rdquo;.</p>
                  ) : (
                    <p className={styles.subcategoryHint}>
                      <i className="fa-solid fa-arrow-left"></i> Hover a category to see its subcategories
                    </p>
                  )}
                </div>

                {/* THIRD PANE — only rendered when the hovered
                    subcategory has sub-subcategories (Fashion/
                    Tailoring pilot). Hidden entirely for every other
                    category. */}
                {showThirdPane && hoveredSubcategory && (
                  <div className={styles.subSubcategoryColumn}>
                    <p className={styles.sectionLabel}>{hoveredSubcategory.name}</p>
                    {isLoadingHoveredSubSubs ? (
                      <div className={styles.panelLoading}>Loading...</div>
                    ) : hoveredSubSubs && hoveredSubSubs.length > 0 ? (
                      <div className={styles.subcatGrid}>
                        {hoveredSubSubs.map((subSub) => (
                          <button
                            type="button"
                            key={subSub.id}
                            className={styles.subcatBtn}
                            onClick={() =>
                              goToSubSubcategory(hoveredCategory!.id, hoveredSubcategory.id, subSub.id, hoveredCategory!.kind)
                            }
                          >
                            <span>{subSub.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.subcategoryHint}>Browse all {hoveredSubcategory.name}.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
      )}
    </div>
  );
}
