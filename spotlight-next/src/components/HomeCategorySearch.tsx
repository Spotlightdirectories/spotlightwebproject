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
type Category = { id: string; name: string; kind: CategoryKind };
type Subcategory = { id: string; name: string };
type FlatSubcategory = { id: string; name: string; category_id: string };

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

  // Desktop: which category is currently hovered (drives the right
  // pane). Mobile: which category is currently expanded (accordion) —
  // same piece of state serves both, since only one applies at a time.
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [subcategoriesCache, setSubcategoriesCache] = useState<Record<string, Subcategory[]>>({});
  const [loadingSubcatId, setLoadingSubcatId] = useState<string | null>(null);

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
    const [categoriesRes, allSubcats] = await Promise.all([
      supabase.from("categories").select("id,name,kind").in("kind", ["product", "service"]).order("name", { ascending: true }),
      subcategoriesAllLoadedRef.current ? Promise.resolve(null) : fetchAllSubcategories(),
    ]);
    if (!categoriesRes.error) setCategories((categoriesRes.data || []) as Category[]);
    if (!subcategoriesAllLoadedRef.current && allSubcats) {
      subcategoriesAllLoadedRef.current = true;
      setAllSubcategories(allSubcats);
    }
    setLoadingCategories(false);
  }, []);

  function openPanel() {
    setOpen(true);
    ensureCategoriesLoaded();
  }

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

  function handleCategoryHover(categoryId: string) {
    if (isMobile) return; // hover doesn't apply on mobile
    setActiveCategoryId(categoryId);
    ensureSubcategoriesLoaded(categoryId);
  }

  // Mobile-only: tapping the chevron toggles this category's
  // accordion open/closed without navigating.
  function handleToggleExpand(e: React.MouseEvent, categoryId: string) {
    e.stopPropagation();
    const next = activeCategoryId === categoryId ? null : categoryId;
    setActiveCategoryId(next);
    if (next) ensureSubcategoriesLoaded(categoryId);
  }

  // type is now passed in explicitly per category, since the panel
  // mixes Products and Services categories — each result should be
  // scoped to whichever taxonomy the clicked category belongs to,
  // not hardcoded to "product".
  function goToCategory(categoryId: string, kind: CategoryKind) {
    closePanel();
    router.push(`/discover-results?category=${categoryId}&type=${kind}`);
  }

  function goToSubcategory(categoryId: string, subcategoryId: string, kind: CategoryKind) {
    closePanel();
    router.push(`/discover-results?category=${categoryId}&subcategory=${subcategoryId}&type=${kind}`);
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
  useEffect(() => {
    categoryColumnRef.current?.scrollTo({ top: 0 });
    subcategoryColumnRef.current?.scrollTo({ top: 0 });
    panelRef.current?.scrollTo({ top: 0 });
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
          {cat.name}
          <span className={`${styles.kindTag} ${cat.kind === "service" ? styles.kindTagService : styles.kindTagProduct}`}>
            {cat.kind === "service" ? "Service" : "Product"}
          </span>
        </button>
        <button
          type="button"
          className={styles.categoryChevron}
          onClick={(e) => (isMobile ? handleToggleExpand(e, cat.id) : e.preventDefault())}
          aria-label={`Show ${cat.name} subcategories`}
        >
          <i className={`fa-solid ${isMobile ? "fa-chevron-down" : "fa-chevron-right"}`}></i>
        </button>

        {/* MOBILE ACCORDION — subcategories render inline, directly
            under this row, when expanded. */}
        {isMobile && isActive && (
          <div className={styles.mobileSubcatList}>
            {isLoadingSubs ? (
              <div className={styles.panelLoading}>Loading...</div>
            ) : subs && subs.length > 0 ? (
              subs.map((sub) => (
                <button
                  type="button"
                  key={sub.id}
                  className={styles.subcatBtn}
                  onClick={() => goToSubcategory(cat.id, sub.id, cat.kind)}
                >
                  {sub.name}
                </button>
              ))
            ) : (
              <div className={styles.panelLoading}>No subcategories yet — browse all {cat.name}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  const hoveredSubs = activeCategoryId ? subcategoriesCache[activeCategoryId] : undefined;
  const hoveredCategory = categories.find((c) => c.id === activeCategoryId);
  const isLoadingHoveredSubs = loadingSubcatId === activeCategoryId;

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
              <div className={styles.panelBody}>
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
                      <p className={styles.sectionLabel}>{hoveredCategory.name}</p>
                      {isLoadingHoveredSubs ? (
                        <div className={styles.panelLoading}>Loading...</div>
                      ) : hoveredSubs && hoveredSubs.length > 0 ? (
                        <div className={styles.subcatGrid}>
                          {hoveredSubs.map((sub) => (
                            <button
                              type="button"
                              key={sub.id}
                              className={styles.subcatBtn}
                              onClick={() => goToSubcategory(hoveredCategory.id, sub.id, hoveredCategory.kind)}
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.subcategoryHint}>No subcategories listed yet — browse all {hoveredCategory.name}.</p>
                      )}
                    </>
                  ) : normalizedQuery && matchedSubcatEntries.length > 0 ? (
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
                          </button>
                        ))}
                      </div>
                    </>
                  ) : normalizedQuery ? (
                    <p className={styles.subcategoryHint}>No subcategories match &ldquo;{query.trim()}&rdquo;.</p>
                  ) : (
                    <p className={styles.subcategoryHint}>
                      <i className="fa-solid fa-arrow-left"></i> Hover a category to see its subcategories
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
      )}
    </div>
  );
}
