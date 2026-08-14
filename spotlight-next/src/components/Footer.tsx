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
      </div>
    </footer>
  );
}
