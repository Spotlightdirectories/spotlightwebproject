import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <a href="/safety">Safety Center</a>
        <a href="/resources">Resources</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/disclaimer">Disclaimer</a>
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
