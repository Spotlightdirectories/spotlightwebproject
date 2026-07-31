// ===============================================================
// src/app/(standalone)/payment-status/page.tsx
//
// Faithful port of production payment-status.html — a static
// terminal-state page shown after a vendor submits a bank transfer
// receipt on /payment. No dynamic data; production's version has
// no JS logic beyond the shared navbar toggle (not present here at
// all — auth.css-style pages in production never rendered the
// navbar markup on this page in the first place).
//
// Placed under (standalone), like login/signup, since it uses the
// same centered auth-card layout with no site-wide navbar.
// ===============================================================

import styles from "./payment-status.module.css";

export default function PaymentStatusPage() {
  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h2>Payment Under Review</h2>
        <p>&#10004; Payment receipt received.</p>
        <p>We are verifying your bank transfer. This may take up to 24 working hours.</p>
        <p>You will receive an email once confirmed.</p>
        <a href="/login" className={styles.authBtn}>Back to Login</a>
      </div>
    </div>
  );
}
