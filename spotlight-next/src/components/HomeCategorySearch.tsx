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
//   obscured while this is open (per Cyril's spec).
// - Typing filters the category list — matches bubble to the top
//   under "Best Matches", the rest of the category list stays
//   visible below under "All Categories" so browsing is still
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
// Categories (Products only, per Cyril's phase-1 scope) are fetched
// once, the first time the panel opens, and cached in state.
// Subcategories are fetched lazily per category the first time it's
// hovered/tapped, and cached per category id — same lazy-cascade
// pattern already used in ProductsTab.tsx / the /discover filter
// drawer, just reused here instead of rebuilt.
// ===============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./home-category-search.module.css";

type Category = { id: string; name: string };
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
      .select("id,name")
      .eq("kind", "product")
      .order("name", { ascending: true });
    if (!error) setCategories(data || []);
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

  // type=product is set explicitly here — the category/subcategory ids
  // in this panel are drawn from the Products taxonomy only (phase 1
  // scope, per Cyril), so results should be scoped to Products rather
  // than defaulting to the "All" search type on the results page.
  function goToCategory(categoryId: string) {
    closePanel();
    router.push(`/discover-results?category=${categoryId}&type=product`);
  }

  function goToSubcategory(categoryId: string, subcategoryId: string) {
    closePanel();
    router.push(`/discover-results?category=${categoryId}&subcategory=${subcategoryId}&type=product`);
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
        <button type="button" className={styles.categoryBtn} onClick={() => goToCategory(cat.id)}>
          {cat.name}
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
                  onClick={() => goToSubcategory(cat.id, sub.id)}
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
                  <p className={styles.sectionLabel}>{matched.length > 0 ? "All Categories" : "Browse Categories"}</p>
                  <div className={styles.categoryList}>{rest.map((cat) => renderCategoryRow(cat, false))}</div>
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
                              onClick={() => goToSubcategory(hoveredCategory.id, sub.id)}
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
