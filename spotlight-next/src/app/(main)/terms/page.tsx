import type { Metadata } from "next";
import Footer from "@/components/Footer";
import styles from "./legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service | Spotlight Directories",
};

export default function TermsPage() {
  return (
    <>
      <main className={styles.legalPage}>
        <div className={styles.legalContainer}>
          <h1>Terms of Service</h1>
          <p className={styles.effectiveDate}>Effective Date: March 1, 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using <strong>spotlightdirectories.com</strong>, you agree to these Terms. If you do not agree, do not use our services.</p>

          <h2>2. Scope of Services</h2>
          <p>Spotlight Directories provides a platform for vendors to create listings and for users to discover and interact with those listings.</p>

          <h2>3. Account Registration</h2>
          <p>You agree to provide accurate information and keep your account secure. You are responsible for all activity under your account.</p>

          <h2>4. Vendor Responsibilities</h2>
          <p>Vendors must ensure that all information, content, and services offered are accurate, lawful, and do not infringe on any rights. Vendors are solely responsible for their listings.</p>

          <h2>5. Platform Role (IMPORTANT)</h2>
          <p>Spotlight Directories acts only as a platform and is <strong>not a party to any transaction</strong> between users and vendors.</p>
          <ul>
            <li>We do not guarantee product quality or service delivery</li>
            <li>We do not control pricing or vendor behavior</li>
            <li>We are not responsible for disputes between users and vendors</li>
          </ul>

          <h2>6. Prohibited Content</h2>
          <p>You must not upload or share content that is unlawful, fraudulent, offensive, or related to illegal goods or services. We may remove such content without notice.</p>

          <h2>7. Use of Services</h2>
          <p>You agree not to misuse the platform, attempt unauthorized access, or interfere with system operations.</p>

          <h2>8. Deliveries and Logistics</h2>
          <p>We are not responsible for delivery, loss, damage, or delays related to goods or services provided by vendors or third parties.</p>

          <h2>9. Fees and Payments</h2>
          <p>Some services may require payment. Payments are non-refundable except in cases of duplicate charges or verified service failure.</p>

          <h2>10. Intellectual Property</h2>
          <p>All platform content belongs to Spotlight Digital Services Ltd. Vendor content remains owned by vendors but is licensed to us for display and promotion.</p>

          <h2>11. Disclaimer of Warranties</h2>
          <p>Our services are provided "as is" without warranties of any kind.</p>

          <h2>12. Limitation of Liability</h2>
          <p>We are not liable for indirect, incidental, or consequential damages arising from use of the platform.</p>

          <h2>13. Suspension and Termination</h2>
          <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>

          <h2>14. Changes to Terms</h2>
          <p>We may update these Terms from time to time. Continued use means acceptance of the updated Terms.</p>

          <h2>15. Governing Law</h2>
          <p>These Terms are governed by the laws of the Federal Republic of Nigeria.</p>

          <h2>16. Dispute Resolution</h2>
          <p>Any disputes shall be resolved in the courts of Nigeria.</p>

          <h2>17. Contact</h2>
          <p>📧 <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a></p>
        </div>
      </main>
      <Footer />
    </>
  );
}
