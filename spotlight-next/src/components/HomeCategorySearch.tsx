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
  // Small enough to fetch in one shot rather than lazily per-category.
  const [allSubcategories, setAllSubcategories] = useState<FlatSubcategory[]>([]);
  const subcategoriesAllLoadedRef = useRef(false);

  // Desktop: which category is currently hovered (drives the right
  // pane). Mobile: which category is currently expanded (accordion) —
  // same piece of state serves both, since only one applies at a time.
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [subcategoriesCache, setSubcategoriesCache] = useState<Record<string, Subcategory[]>>({});
  const [loadingSubcatId, setLoadingSubcatId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    const [categoriesRes, subcatsRes] = await Promise.all([
      supabase.from("categories").select("id,name,kind").in("kind", ["product", "service"]).order("name", { ascending: true }),
      subcategoriesAllLoadedRef.current
        ? Promise.resolve({ data: null, error: null })
        : supabase.from("subcategories").select("id,name,category_id").order("name", { ascending: true }),
    ]);
    if (!categoriesRes.error) setCategories((categoriesRes.data || []) as Category[]);
    if (!subcategoriesAllLoadedRef.current && !subcatsRes.error) {
      subcategoriesAllLoadedRef.current = true;
      setAllSubcategories((subcatsRes.data || []) as FlatSubcategory[]);
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
  const matched = normalizedQuery ? categories.filter((c) => c.name.toLowerCase().includes(normalizedQuery)) : [];
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
        .filter((s) => s.name.toLowerCase().includes(normalizedQuery))
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
        <div className={styles.panel} role="dialog" aria-label="Category search">
            <button type="button" className={styles.panelClose} onClick={closePanel} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>

            {loadingCategories ? (
              <div className={styles.panelLoading}>Loading categories...</div>
            ) : (
              <div className={styles.panelBody}>
                <div className={styles.categoryColumn}>
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
                    Priority: while typing, a matching SUBCATEGORY
                    (e.g. "mat" -> "Mattress") takes over this pane
                    first — that's the more specific, more useful
                    match, each one labeled with its parent category
                    to the left so the result has context. Otherwise
                    falls back to whichever category is hovered, then
                    the idle hint. */}
                <div className={styles.subcategoryColumn}>
                  {normalizedQuery && matchedSubcatEntries.length > 0 ? (
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
                  ) : hoveredCategory ? (
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
