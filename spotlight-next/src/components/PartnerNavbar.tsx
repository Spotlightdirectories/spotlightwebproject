"use client";

// ===============================================================
// PartnerNavbar.tsx
//
// Shared bespoke navbar for the partner-facing marketing pages
// (/partner-program, /partner-legal). Production has a DIFFERENT
// navbar link set on each of these two pages (partner-program.html:
// Why Spotlight?/Get Listed/Partner Rewards/Contact Us/Log in;
// partner-legal.html: Partner Program/Contact Us/Log in only) — both
// different from the shared site Navbar used everywhere else. Rather
// than duplicating the whole component per page, this takes the
// middle link list as a prop and reuses the exact same
// Navbar.module.css classes so it's visually identical to every
// other page's header.
//
// One deliberate change from production: the login-state check reads
// the isolated partnerSupabase session, not the shared vendor/customer
// client — production's pages checked the same shared session used by
// vendors, which is exactly the cross-role session collision Cyril
// asked to fix (see src/lib/partnerSupabase.ts).
// ===============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { partnerSupabase, clearPartnerSession } from "@/lib/partnerSupabase";
import styles from "./Navbar.module.css";

export type PartnerNavLink = { label: string; href: string; external?: boolean };

export default function PartnerNavbar({ links }: { links: PartnerNavLink[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    partnerSupabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session));
    const { data: { subscription } } = partnerSupabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleAuthClick(e: React.MouseEvent) {
    if (loggedIn) {
      e.preventDefault();
      await partnerSupabase.auth.signOut();
      clearPartnerSession();
      window.location.reload();
    }
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.logoLeft}>
        <Link href="/" className={styles.homeLink}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/whitelogo3.png" alt="Spotlight Directories Logo" className={styles.logoImg} />
        </Link>
        <Link href="/" className={styles.homeText}>Home</Link>
      </div>

      <nav className={styles.nav}>
        <button className={styles.menuOpen} aria-label="Open menu" onClick={() => setMenuOpen(true)}>☰</button>

        <ul className={`${styles.navLinks} ${menuOpen ? styles.open : ""}`}>
          <button className={styles.menuClose} aria-label="Close menu" onClick={() => setMenuOpen(false)}>✕</button>

          {links.map((l) =>
            l.external ? (
              <li key={l.href}><a href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</a></li>
            ) : (
              <li key={l.href}><Link href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</Link></li>
            )
          )}

          <li>
            <a href={loggedIn ? "#" : "#login"} className={styles.navLoginBtn} onClick={(e) => { handleAuthClick(e); setMenuOpen(false); }}>
              {loggedIn ? "Log out" : "Log in"}
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
