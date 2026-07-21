// ===============================================================
// src/app/(standalone)/discover/page.tsx
//
// The Discover search page — ported faithfully from the original
// discover.html. COMMIT 1: static visual shell only (no data or
// interactivity yet — that's Commit 2). This lets us confirm the
// visual match to production, in both light and dark mode, before
// wiring logic.
//
// Standalone page: its own header + bottom nav, no site navbar.
// ===============================================================

import styles from "./discover.module.css";

export default function DiscoverPage() {
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
          />
          <button type="button" className={styles.discoverSearchBtn}>
            Search
          </button>
        </div>

        <p className={styles.discoverSearchError}>
          Enter a keyword or use at least one filter.
        </p>

        {/* SEARCH TYPE TABS */}
        <div className={styles.discoverSearchTabs}>
          <button type="button" className={`${styles.discoverTab} ${styles.active}`}>
            All
          </button>
          <button type="button" className={styles.discoverTab}>
            Product
          </button>
          <button type="button" className={styles.discoverTab}>
            Service
          </button>
          <button type="button" className={styles.discoverTab}>
            Vendor
          </button>
        </div>

        {/* QUICK FILTERS */}
        <div className={styles.discoverQuickFilters}>
          <label className={styles.discoverToggleWrap}>
            <input type="checkbox" />
            <span className={styles.discoverToggleSlider}></span>
            <span className={styles.discoverToggleLabel}>Verified Only</span>
          </label>

          <button type="button" className={styles.discoverMoreFiltersBtn}>
            More Filters
            <i className="fa-solid fa-sliders"></i>
          </button>
        </div>

        {/* DISTANCE SEARCH */}
        <div className={styles.discoverDistanceCard}>
          <div className={styles.discoverDistanceTop}>
            <label className={styles.discoverDistanceToggle}>
              <input type="checkbox" />
              <span className={styles.discoverDistanceCheckbox}></span>
              <span className={styles.discoverDistanceText}>
                Enable Distance Search
              </span>
            </label>

            <button type="button" className={styles.discoverLocationBtn}>
              <i className="fa-solid fa-location-crosshairs"></i>
              Use Current
            </button>
          </div>

          <div className={styles.discoverDistanceSliderWrap}>
            <input
              type="range"
              className={styles.discoverDistanceSlider}
              min="1"
              max="20"
              defaultValue="5"
            />
            <div className={styles.discoverDistanceScale}>
              <span>0km</span>
              <span className={styles.distanceRadiusValue}>5km</span>
              <span>20km</span>
            </div>
          </div>
        </div>
      </section>

      {/* SPONSORED VENDORS */}
      <section className={styles.discoverSection}>
        <div className={styles.discoverSectionHeading}>
          <h2>Sponsored Vendors Near You</h2>
        </div>
        <div className={styles.discoverSponsoredScroll}>
          {/* Sponsored vendor cards load here (Commit 2) */}
        </div>
      </section>

      {/* TRENDING SEARCHES */}
      <section className={styles.discoverSection}>
        <div className={styles.discoverSectionHeading}>
          <h2>Trending Searches</h2>
        </div>
        <div className={styles.discoverTrendingTags}>
          {/* Trending tags load here (Commit 2) */}
        </div>
      </section>

      {/* RECENT SEARCHES */}
      <section className={styles.discoverSection}>
        <div className={styles.discoverSectionHeading}>
          <h2>Recent Searches</h2>
        </div>
        <div className={styles.discoverRecentList}>
          {/* Recent searches load here (Commit 2) */}
        </div>
      </section>

      {/* MOBILE BOTTOM NAV */}
      <nav className={styles.discoverBottomNav}>
        <a href="/" className={styles.discoverBottomItem}>
          <i className="fa-solid fa-compass"></i>
          <span>Explore</span>
        </a>
        <button type="button" className={styles.discoverBottomItem}>
          <i className="fa-regular fa-user"></i>
          <span>Profile</span>
        </button>
      </nav>

      {/* FILTER DRAWER */}
      <aside className={styles.discoverFiltersDrawer}>
        <div className={styles.discoverFiltersHeader}>
          <h3>More Filters</h3>
          <button type="button" className={styles.closeFiltersDrawerBtn}>
            ×
          </button>
        </div>

        <div className={styles.discoverFiltersBody}>
          <div className={styles.discoverFilterGroup}>
            <label>Category</label>
            <select className={styles.discoverFilterSelect}>
              <option value="">Select Category</option>
            </select>
          </div>

          <div className={styles.discoverFilterGroup}>
            <label>Subcategory</label>
            <select className={styles.discoverFilterSelect}>
              <option value="">Select Subcategory</option>
            </select>
          </div>

          <div className={styles.discoverFilterGroup}>
            <label>State</label>
            <select className={styles.discoverFilterSelect}>
              <option value="">Select State</option>
            </select>
          </div>

          <div className={styles.discoverFilterGroup}>
            <label>LGA</label>
            <select className={styles.discoverFilterSelect}>
              <option value="">Select LGA</option>
            </select>
          </div>
        </div>

        <div className={styles.discoverFiltersFooter}>
          <button type="button" className={styles.discoverResetBtn}>
            Reset
          </button>
          <button type="button" className={styles.discoverApplyBtn}>
            Apply Filters
          </button>
        </div>
      </aside>

      {/* OVERLAY */}
      <div className={styles.discoverDrawerOverlay}></div>
    </main>
  );
}
