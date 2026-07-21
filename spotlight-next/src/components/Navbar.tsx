"use client";

// ===============================================================
// src/components/Navbar.tsx
//
// Ported from the original navbar markup + navbar.css. Same black
// fixed header, real white logo image, "Home" link beside it, nav
// links, white pill login button, theme toggle, and mobile
// hamburger menu. Styling uses the ported design tokens
// (globals.css) and a co-located CSS module.
// ===============================================================

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className={styles.navbar}>
      <div className={styles.logoLeft}>
        <Link href="/" className={styles.homeLink}>
          {/* Real white logo, ported from the original site's
              images/whitelogo3.png. Stays white in both themes
              since the navbar is always black. Plain <img> is used
              here (not next/image) to load the file directly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/whitelogo3.png"
            alt="Spotlight Directories Logo"
            className={styles.logoImg}
          />
        </Link>
        <Link href="/" className={styles.homeText}>
          Home
        </Link>
      </div>

      <nav className={styles.nav}>
        {/* Hamburger (mobile only) */}
        <button
          className={styles.menuOpen}
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>

        <ul className={`${styles.navLinks} ${menuOpen ? styles.open : ""}`}>
          <button
            className={styles.menuClose}
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            ✕
          </button>

          <li>
            <Link href="/discover" onClick={() => setMenuOpen(false)}>
              Discover
            </Link>
          </li>
          <li>
            <Link href="/getlisted" onClick={() => setMenuOpen(false)}>
              Get Listed
            </Link>
          </li>

          <li>
            <button
              className={styles.themeToggle}
              data-theme-dark={theme === "dark" ? "true" : undefined}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              onClick={toggleTheme}
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
          </li>

          <li>
            <Link
              href="/login"
              className={styles.navLoginBtn}
              onClick={() => setMenuOpen(false)}
            >
              Log In
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
