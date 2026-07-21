// ===============================================================
// src/components/Footer.tsx
//
// A minimal shared footer shell. Real footer content/links get
// ported when we rebuild the individual pages; this establishes
// the app-wide structure so every page has consistent footing.
// ===============================================================

import styles from "./Footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <p className={styles.brandLine}>
        <span className={styles.gold}>Spotlight</span>
        <span>Directories</span>
      </p>
      <p className={styles.tagline}>
        Helping Nigerian businesses get found.
      </p>
      <p className={styles.copyright}>
        © {year} Spotlight Digital Services Ltd. All rights reserved.
      </p>
    </footer>
  );
}
