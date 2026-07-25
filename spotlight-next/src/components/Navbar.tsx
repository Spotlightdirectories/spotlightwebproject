"use client";

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

          <li>
            <Link href="/login" className={styles.navLoginBtn} onClick={() => setMenuOpen(false)}>
              Log In
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
