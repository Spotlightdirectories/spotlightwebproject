// ===============================================================
// src/app/(standalone)/payment-failed/page.tsx
//
// Faithful port of production payment-failed.html — a static
// terminal-state page. No dynamic data.
//
// Placed under (standalone), same reasoning as payment-status.
// ===============================================================

import styles from "./payment-failed.module.css";

export default function PaymentFailedPage() {
  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h2>Payment Not Confirmed</h2>
        <p>We could not verify your bank transfer.</p>
        <p>Please upload a valid receipt or contact support.</p>
        <a href="/payment" className={styles.authBtn}>Retry Payment</a>
      </div>
    </div>
  );
}
