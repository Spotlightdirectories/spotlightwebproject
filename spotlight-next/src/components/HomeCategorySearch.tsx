"use client";

// ===============================================================
// src/components/HomeCategorySearch.tsx
//
// Homepage smart search + category browser (2026-08, per Cyril —
// Jiji-style). Replaces the old "Search Nearby" hero button, which
// was just a static link to /discover with no real functionality.
//
// Behavior:
// - Focusing the input opens a full-screen takeover: a dimmed
//   backdrop behind a centered panel, so the rest of the homepage is
//   obscured while this is open (per Cyril's spec). The search bar
//   itself sits ABOVE the backdrop's blur (z-index higher than the
//   backdrop) and the panel is docked directly beneath it — measured
//   live via getBoundingClientRect() rather than a hardcoded offset
//   — so the two read as one continuous card: input as the header,
//   category list as the body. Fixes an earlier bug where the search
//   bar had no explicit stacking position, so the blurred backdrop
//   rendered visually on top of it and blurred the text being typed.
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

export default function HomeCategorySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const categoriesLoadedRef = useRef(false);

  // Desktop: which category is currently hovered (drives the right
  // pane). Mobile: which category is currently expanded (accordion) —
  // same piece of state serves both, since only one applies at a time.
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [subcategoriesCache, setSubcategoriesCache] = useState<Record<string, Subcategory[]>>({});
  const [loadingSubcatId, setLoadingSubcatId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Panel is docked directly under the search bar, measured live
  // rather than hard-coded, so it stays attached to the input
  // wherever this component renders and however tall the hero above
  // it is. Recomputed on open and on resize while open.
  const [panelStyle, setPanelStyle] = useState<{ top: number; maxHeight: number } | null>(null);

  function computePanelStyle() {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const gap = 10;
    const top = rect.bottom + gap;
    const maxHeight = Math.max(280, window.innerHeight - top - 20);
    return { top, maxHeight };
  }

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
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,kind")
      .in("kind", ["product", "service"])
      .order("name", { ascending: true });
    if (!error) setCategories((data || []) as Category[]);
    setLoadingCategories(false);
  }, []);

  function openPanel() {
    setPanelStyle(computePanelStyle());
    setOpen(true);
    ensureCategoriesLoaded();
  }

  // Keep the panel docked to the search bar if the window resizes
  // while it's open (e.g. rotating a tablet, or the browser window
  // being resized).
  useEffect(() => {
    if (!open) return;
    function handleResize() {
      setPanelStyle(computePanelStyle());
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          {highlighted && (
            <span className={`${styles.kindTag} ${cat.kind === "service" ? styles.kindTagService : styles.kindTagProduct}`}>
              {cat.kind === "service" ? "Service" : "Product"}
            </span>
          )}
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
        <>
          <div className={styles.backdrop} onClick={closePanel} />
          <div
            className={styles.panel}
            style={panelStyle ? { top: panelStyle.top, maxHeight: panelStyle.maxHeight } : undefined}
            role="dialog"
            aria-label="Category search"
          >
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
                  <p className={styles.sectionLabel}>Products ({restProducts.length})</p>
                  <div className={styles.categoryList}>{restProducts.map((cat) => renderCategoryRow(cat, false))}</div>
                  <p className={styles.sectionLabel}>Services ({restServices.length})</p>
                  <div className={styles.categoryList}>{restServices.map((cat) => renderCategoryRow(cat, false))}</div>
                </div>

                {/* DESKTOP-ONLY RIGHT PANE — subcategories of whichever
                    category is currently hovered. Hidden on mobile via
                    CSS (the accordion above handles mobile instead). */}
                <div className={styles.subcategoryColumn}>
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
                  ) : (
                    <p className={styles.subcategoryHint}>
                      <i className="fa-solid fa-arrow-left"></i> Hover a category to see its subcategories
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
