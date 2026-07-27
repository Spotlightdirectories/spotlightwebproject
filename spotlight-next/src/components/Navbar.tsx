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

          <li>
            {loggedIn ? (
              <button className={styles.navLoginBtn} onClick={handleLogout}>
                Log Out
              </button>
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
