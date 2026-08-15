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

          <li><Link href="/aboutUs" onClick={() => setMenuOpen(false)}>Why Spotlight?</Link></li>
          <li><Link href="/getlisted" onClick={() => setMenuOpen(false)}>Get Listed</Link></li>
          <li><Link href="/contact-us" onClick={() => setMenuOpen(false)}>Contact Us</Link></li>
          <li><Link href="/FAQ" onClick={() => setMenuOpen(false)}>FAQ</Link></li>
          <li><Link href="/feedback" onClick={() => setMenuOpen(false)}>Feedback</Link></li>

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
