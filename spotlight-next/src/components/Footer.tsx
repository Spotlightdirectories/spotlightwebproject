"use client";

// ===============================================================
// src/components/Footer.tsx
//
// Step 5, 2026-08-23 per Cyril: the site-wide footer, rebuilt from
// what used to be a homepage-only "branded footer" (4 columns:
// Brand, Quick Links, Support, Newsletter) that was ALSO followed by
// this same plain component on the homepage specifically -- meaning
// the homepage showed "Safety Center" and "Resources" twice, back to
// back. That richer footer is now promoted to be the ONE shared
// footer everywhere, and the homepage's separate copy is removed
// (see page.tsx) so there's exactly one footer per page again.
//
// Changes from the original homepage-only version:
// - Newsletter column removed entirely (non-functional, disabled
//   inputs) -- Cyril's explicit call, not carried forward.
// - A new "Legal" column (Terms, Privacy, Disclaimer) replaces it,
//   carrying over what the old plain Footer.tsx had.
// - Real social links added (Facebook, Instagram, LinkedIn, TikTok,
//   YouTube -- confirmed real URLs, already live on the Contact Us
//   page). X/Twitter deliberately excluded per Cyril ("Nigerians are
//   not used to X site").
// - SELF-LINK GRAYING: whichever page a visitor is currently on, that
//   page's own link in this footer renders as plain, unclickable text
//   instead of a link -- a page never needs to link to itself. This
//   is a general rule applied automatically via usePathname(), not a
//   one-off fix for a single page.
// ===============================================================

import { usePathname } from "next/navigation";
import styles from "./Footer.module.css";

type LinkItem = { href: string; label: string };

function FooterLink({ href, label, pathname, className }: LinkItem & { pathname: string; className?: string }) {
  if (pathname === href) {
    return <span className={`${className || ""} ${styles.footerLinkCurrent}`.trim()}>{label}</span>;
  }
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}

const QUICK_LINKS: LinkItem[] = [
  { href: "/", label: "Home" },
  { href: "/aboutUs", label: "Why Spotlight" },
  { href: "/getlisted", label: "Get Listed" },
  { href: "/discover", label: "Search Vendors" },
];

const SUPPORT_LINKS: LinkItem[] = [
  { href: "/safety", label: "Safety Center" },
  { href: "/FAQ", label: "FAQ" },
  { href: "/contact-us", label: "Contact Us" },
  { href: "/feedback", label: "Feedback" },
  { href: "/resources", label: "Resources" },
];

const LEGAL_LINKS: LinkItem[] = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export default function Footer() {
  const pathname = usePathname();

  return (
    <footer className={styles.hfooter}>
      <div className={`${styles.hcontainer} ${styles.hfooterGrid}`}>
        <div className={styles.hfooterBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/whitelogo3.png" alt="Spotlight Directories" />
          <p>Dedicated to digitalizing local businesses and making services accessible to everyone, everywhere.</p>
          <div className={styles.hfooterSocial}>
            <a
              href="https://web.facebook.com/spotlightdirectories/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <i className="fa-brands fa-facebook-f"></i>
            </a>
            <a
              href="https://www.instagram.com/spotlight_directories"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <i className="fa-brands fa-instagram"></i>
            </a>
            <a
              href="https://www.linkedin.com/company/spotlight-directories/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
            >
              <i className="fa-brands fa-linkedin-in"></i>
            </a>
            <a
              href="https://www.tiktok.com/@spotlight_directories"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
            >
              <i className="fa-brands fa-tiktok"></i>
            </a>
            <a
              href="https://www.youtube.com/@spotlightdirectories"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
            >
              <i className="fa-brands fa-youtube"></i>
            </a>
          </div>
        </div>

        <div className={styles.hfooterLinks}>
          <h4>Quick Links</h4>
          {QUICK_LINKS.map((l) => (
            <FooterLink key={l.href} {...l} pathname={pathname} />
          ))}
        </div>

        <div className={styles.hfooterSupport}>
          <h4>Support</h4>
          {SUPPORT_LINKS.map((l) => (
            <FooterLink key={l.href} {...l} pathname={pathname} />
          ))}
          <FooterLink
            href="/partner-program"
            label="Partner Program"
            pathname={pathname}
            className={styles.hfooterPartnerBtn}
          />
        </div>

        <div className={styles.hfooterLegalCol}>
          <h4>Legal</h4>
          {LEGAL_LINKS.map((l) => (
            <FooterLink key={l.href} {...l} pathname={pathname} />
          ))}
        </div>
      </div>

      <div className={`${styles.hcontainer} ${styles.hfooterBottom}`}>
        <p>&copy; 2026 Spotlight Digital Services Ltd. All Rights Reserved</p>
        <p className={styles.complianceLine}>
          NDPC Registered (Reg. No. NDPC/DCP/14269) &middot;{" "}
          <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer">
            Verify with NDPC
          </a>
        </p>
      </div>
    </footer>
  );
}
