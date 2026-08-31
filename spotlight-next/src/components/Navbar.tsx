"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { supabase } from "@/lib/supabase";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [loggedIn, setLoggedIn] = useState(false);

  // Step 8 rework, 2026-08-23 per Cyril: Artisan/Professional felt
  // "dormant" next to Goods' hover dropdown, and on mobile, tapping
  // them jumped straight to a broad, unfiltered wall of results
  // instead of letting someone pick a specific category first. All
  // three now behave the same way: desktop hover reveals the real
  // category list (scrollable -- Professional alone has 58); on
  // mobile, tapping the whole pill expands that same list inline
  // (matching the tap-to-expand pattern already proven on the
  // homepage's own category search) instead of navigating anywhere
  // by itself.
  const [isMobile, setIsMobile] = useState(false);
  const [expandedPill, setExpandedPill] = useState<string | null>(null);
  const [artisanCats, setArtisanCats] = useState<string[]>([]);
  const [professionalCats, setProfessionalCats] = useState<string[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    async function loadCats() {
      const { data } = await supabase
        .from("categories")
        .select("name, audience_type")
        .in("audience_type", ["Artisan", "Professional"])
        .order("name");
      if (data) {
        setArtisanCats(data.filter((c) => c.audience_type === "Artisan").map((c) => c.name));
        setProfessionalCats(data.filter((c) => c.audience_type === "Professional").map((c) => c.name));
      }
    }
    loadCats();
  }, []);

  // Step 8 fix, 2026-08-23 per Cyril: exactly 2 of the 179 categories
  // (confirmed by querying the DB directly, not guessed) actually go
  // a third level deep -- "Tailoring & Fashion Designer" (Artisan)
  // and "Clothing & Fashion" (Goods). Everything else stops at a
  // plain category link. Fetched once on mount as a nested lookup:
  // { categoryName: { subcategoryName: [subsubcategoryName, ...] } }.
  const [nestedCats, setNestedCats] = useState<Record<string, Record<string, string[]>>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedSubcat, setExpandedSubcat] = useState<string | null>(null);

  useEffect(() => {
    async function loadNested() {
      const { data } = await supabase
        .from("categories")
        .select("name, subcategories(name, sub_subcategories(name))")
        .in("name", ["Tailoring & Fashion Designer", "Clothing & Fashion"]);
      if (!data) return;
      const nested: Record<string, Record<string, string[]>> = {};
      for (const cat of data as any[]) {
        nested[cat.name] = {};
        for (const sub of cat.subcategories || []) {
          nested[cat.name][sub.name] = (sub.sub_subcategories || []).map((ss: any) => ss.name);
        }
      }
      setNestedCats(nested);
    }
    loadNested();
  }, []);

  // Step 8, 2026-08-23 per Cyril: the exact 10 Goods sub-groups
  // locked in the approved spreadsheet -- must match goods_subgroup
  // values in the categories table exactly, or the dropdown links
  // would silently return zero results.
  const GOODS_SUBGROUPS = [
    "Fashion & Accessories",
    "Electronics & Gadgets",
    "Food, Groceries & Beverages",
    "Home, Furniture & Kitchen",
    "Health, Beauty & Safety",
    "Building, Hardware & Industrial",
    "Agriculture & Animals",
    "Office, Print & Stationery",
    "Gifts, Events & Leisure",
    "Other Goods",
  ];

  // Spotlight's dual-account model means a session alone doesn't say
  // whether this person is a vendor, a customer, or both (same
  // email/password can hold both). Checked once per session change
  // so the account dropdown / mobile menu can point at the right
  // dashboard instead of always assuming vendor.
  const [isVendor, setIsVendor] = useState(false);
  const [isCustomer, setIsCustomer] = useState(false);

  useEffect(() => {
    async function resolveIdentity(userId: string | undefined) {
      if (!userId) { setIsVendor(false); setIsCustomer(false); return; }
      const [{ data: vendor }, { data: customer }] = await Promise.all([
        supabase.from("vendors").select("id").eq("auth_user_id", userId).maybeSingle(),
        supabase.from("customers").select("id").eq("auth_user_id", userId).maybeSingle(),
      ]);
      setIsVendor(!!vendor);
      setIsCustomer(!!customer);
    }

    // Check session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
      resolveIdentity(session?.user.id);
    });

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
      resolveIdentity(session?.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setMenuOpen(false);
    window.location.href = "/";
  }

  // Step 8 rework, 2026-08-23 per Cyril: one shared renderer for all
  // three pills so their behavior stays identical, not three
  // near-duplicate blocks that could quietly drift apart later.
  // isSubgroup=true (Goods only) links each item via
  // ?audience=Goods&subgroup=X, since a Goods sub-group spans many
  // categories at once. isSubgroup=false (Artisan/Professional) links
  // each item via the EXISTING, already-working ?category=X filter --
  // a single specific category doesn't need the new audience_type
  // logic at all, only the broad "see everything tagged Artisan"
  // pill click does.
  function renderCategoryPill(
    audienceKey: "Artisan" | "Goods" | "Professional",
    label: string,
    icon: string,
    items: string[],
    isSubgroup: boolean
  ) {
    const isExpanded = expandedPill === audienceKey;

    const closeAll = () => {
      setMenuOpen(false);
      setExpandedPill(null);
      setExpandedCategory(null);
      setExpandedSubcat(null);
    };

    const itemHref = (item: string) =>
      isSubgroup
        ? `/discover-results?audience=Goods&subgroup=${encodeURIComponent(item)}`
        : `/discover-results?category=${encodeURIComponent(item)}`;

    // Step 8 fix, 2026-08-23 per Cyril: renders one item in either
    // list (desktop dropdown or mobile inline list) identically.
    // Plain items (177 of 179 categories) are just a link, unchanged.
    // The 2 categories with a real third level (see nestedCats above)
    // instead render as a click-to-expand drill-down -- works the
    // same way via click or tap on both desktop and mobile, rather
    // than building two separate deep-nesting mechanisms.
    function renderItem(item: string) {
      const nested = nestedCats[item];
      if (!nested) {
        return (
          <Link key={item} href={itemHref(item)} onClick={closeAll}>
            {item}
          </Link>
        );
      }

      const catOpen = expandedCategory === item;
      return (
        <div key={item} className={styles.nestedBlock}>
          <button
            type="button"
            className={styles.nestedToggle}
            onClick={() => setExpandedCategory(catOpen ? null : item)}
          >
            {item}
            <i className={`fa-solid ${catOpen ? "fa-chevron-down" : "fa-chevron-right"}`}></i>
          </button>
          {catOpen && (
            <div className={styles.nestedSubList}>
              {Object.entries(nested).map(([subName, subsubs]) => {
                const subOpen = expandedSubcat === subName;
                return (
                  <div key={subName}>
                    <button
                      type="button"
                      className={styles.nestedToggle}
                      onClick={() => setExpandedSubcat(subOpen ? null : subName)}
                    >
                      {subName}
                      <i className={`fa-solid ${subOpen ? "fa-chevron-down" : "fa-chevron-right"}`}></i>
                    </button>
                    {subOpen && (
                      <div className={styles.nestedSubList}>
                        {subsubs.map((ss) => (
                          <Link
                            key={ss}
                            href={`/discover-results?category=${encodeURIComponent(item)}&subcategory=${encodeURIComponent(subName)}&subsubcategory=${encodeURIComponent(ss)}`}
                            onClick={closeAll}
                          >
                            {ss}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <li className={styles.categoryMenu} key={audienceKey}>
        <Link
          href={`/discover-results?audience=${audienceKey}`}
          className={styles.categoryPill}
          onClick={(e) => {
            if (isMobile) {
              e.preventDefault();
              setExpandedPill(isExpanded ? null : audienceKey);
            } else {
              setMenuOpen(false);
            }
          }}
        >
          <i className={icon}></i> {label}
          <i className={`fa-solid ${isMobile && isExpanded ? "fa-chevron-down" : "fa-chevron-right"} ${styles.pillArrow}`}></i>
        </Link>

        <div className={styles.categoryDropdown}>
          {items.map((item) => renderItem(item))}
        </div>

        {isMobile && isExpanded && (
          <div className={styles.categoryMobileList}>
            {items.map((item) => renderItem(item))}
          </div>
        )}
      </li>
    );
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.logoLeft}>
        <Link href="/" className={styles.homeLink}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/whitelogo3.png"
            alt="Spotlight Directories Logo"
            className={styles.logoImg}
          />
        </Link>
        <Link href="/" className={styles.homeText}>Home</Link>
      </div>

      <nav className={styles.nav}>
        {/* Was the raw "☰"/"✕" Unicode characters — rendered using
            whatever font the device falls back to for that glyph,
            which on some Android system fonts comes out thin/faint
            and hard to spot (Cyril, 2026-08: "hamburger... can hardly
            be seen" on mobile). Font Awesome is already loaded
            site-wide and used for this exact button in the vendor
            dashboard's mobile topbar — swapping to it here gives a
            crisp, consistent icon on every device instead of relying
            on font fallback. */}
        <button className={styles.menuOpen} aria-label="Open menu" onClick={() => setMenuOpen(true)}><i className="fa-solid fa-bars"></i></button>

        <ul className={`${styles.navLinks} ${menuOpen ? styles.open : ""}`}>
          <button className={styles.menuClose} aria-label="Close menu" onClick={() => setMenuOpen(false)}><i className="fa-solid fa-xmark"></i></button>

          {/* Step 7/8, 2026-08-23 per Cyril: Why Spotlight?/Get
              Listed/Contact Us/FAQ/Feedback removed from here --
              the first four now live in the footer (Step 5), and
              Get Listed moved to its own dedicated row alongside
              search on the homepage. Replaced with three category
              browse pills -- see renderCategoryPill below for the
              full desktop-hover / mobile-tap-to-expand behavior. */}
          {renderCategoryPill("Artisan", "Artisans", "fa-solid fa-hammer", artisanCats, false)}
          {renderCategoryPill("Goods", "Goods", "fa-solid fa-bag-shopping", GOODS_SUBGROUPS, true)}
          {renderCategoryPill("Professional", "Professionals", "fa-solid fa-briefcase", professionalCats, false)}

          <li>
            <button
              className={styles.themeToggle}
              data-theme-dark={theme === "dark" ? "true" : undefined}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
          </li>

          {/* MOBILE ONLY — hidden at the ≥1024px desktop breakpoint
              (see .dashboardMobileOnly in Navbar.module.css), since
              there's no hover on touch to reveal the desktop dropdown
              below. Cyril's ask (2026-07-28): show it as its own
              always-visible item, right before Log Out. Only rendered
              when logged in — a logged-out visitor has no dashboard
              to go to. Points at whichever dashboard(s) this identity
              actually has (2026-08 fix — previously always pointed at
              /vendordashboard even for a customer-only account). */}
          {loggedIn && isVendor && (
            <li className={styles.dashboardMobileOnly}>
              <Link href="/vendordashboard" onClick={() => setMenuOpen(false)}>
                <i className="fa-solid fa-gauge"></i> Vendor Dashboard
              </Link>
            </li>
          )}
          {loggedIn && isCustomer && (
            <li className={styles.dashboardMobileOnly}>
              <Link href="/customer-profile" onClick={() => setMenuOpen(false)}>
                <i className="fa-solid fa-user"></i> My Account
              </Link>
            </li>
          )}

          {/* MOBILE ONLY — logged-out equivalent of the two links
              above. There's no hover on touch, so both login routes
              need to be directly tappable rather than hidden behind
              the desktop dropdown below (2026-08, per Cyril: customer
              login was previously only reachable via an icon buried
              on the Discover page). */}
          {!loggedIn && (
            <>
              <li className={styles.dashboardMobileOnly}>
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-store"></i> Vendor Login
                </Link>
              </li>
              <li className={styles.dashboardMobileOnly}>
                <Link href="/customer-login" onClick={() => setMenuOpen(false)}>
                  <i className="fa-solid fa-user"></i> Customer Login
                </Link>
              </li>
            </>
          )}

          <li className={styles.accountMenu}>
            {loggedIn ? (
              <>
                <button className={styles.navLoginBtn} onClick={handleLogout}>
                  Log Out
                </button>
                {/* DESKTOP ONLY (≥1024px) — hover reveals whichever
                    dashboard(s) this identity has. Clicking "Log Out"
                    itself is unchanged — it still logs out immediately. */}
                <div className={styles.accountDropdown}>
                  {isVendor && (
                    <Link href="/vendordashboard" onClick={() => setMenuOpen(false)}>
                      <i className="fa-solid fa-gauge"></i> Vendor Dashboard
                    </Link>
                  )}
                  {isCustomer && (
                    <Link href="/customer-profile" onClick={() => setMenuOpen(false)}>
                      <i className="fa-solid fa-user"></i> My Account
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className={styles.navLoginBtn} onClick={() => setMenuOpen(false)}>
                  Log In
                </Link>
                {/* DESKTOP ONLY (≥1024px) — hover reveals both login
                    routes, since clicking the button itself still goes
                    straight to vendor login (unchanged default). */}
                <div className={styles.accountDropdown}>
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    <i className="fa-solid fa-store"></i> Vendor Login
                  </Link>
                  <Link href="/customer-login" onClick={() => setMenuOpen(false)}>
                    <i className="fa-solid fa-user"></i> Customer Login
                  </Link>
                </div>
              </>
            )}
          </li>
        </ul>
      </nav>
    </header>
  );
}
