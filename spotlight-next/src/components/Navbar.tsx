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

  useEffect(() => {
    // Check session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
    });

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
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
        <button className={styles.menuOpen} aria-label="Open menu" onClick={() => setMenuOpen(true)}>☰</button>

        <ul className={`${styles.navLinks} ${menuOpen ? styles.open : ""}`}>
          <button className={styles.menuClose} aria-label="Close menu" onClick={() => setMenuOpen(false)}>✕</button>

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
              to go to. */}
          {loggedIn && (
            <li className={styles.dashboardMobileOnly}>
              <Link href="/vendordashboard" onClick={() => setMenuOpen(false)}>
                <i className="fa-solid fa-gauge"></i> Dashboard
              </Link>
            </li>
          )}

          <li className={loggedIn ? styles.accountMenu : undefined}>
            {loggedIn ? (
              <>
                <button className={styles.navLoginBtn} onClick={handleLogout}>
                  Log Out
                </button>
                {/* DESKTOP ONLY (≥1024px) — hover reveals this
                    "Dashboard" shortcut instead of the always-visible
                    mobile item above. Clicking "Log Out" itself is
                    unchanged — it still logs out immediately. */}
                <div className={styles.accountDropdown}>
                  <Link href="/vendordashboard" onClick={() => setMenuOpen(false)}>
                    <i className="fa-solid fa-gauge"></i> Dashboard
                  </Link>
                </div>
              </>
            ) : (
              <Link href="/login" className={styles.navLoginBtn} onClick={() => setMenuOpen(false)}>
                Log In
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </header>
  );
}
