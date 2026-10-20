import type { Metadata } from "next";
import Footer from "@/components/Footer";
import AnalyticsChoice from "@/components/AnalyticsChoice";
import styles from "../terms/legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Spotlight Directories",
};

export default function PrivacyPage() {
  return (
    <>
      <main className={styles.legalPage}>
        <div className={styles.legalContainer}>
          <h1>Privacy Policy</h1>
          <p><strong>"Spotlight Directories"</strong> is a brand of <strong>SPOTLIGHT DIGITAL SERVICES LTD</strong>, a company duly registered in Nigeria with the Corporate Affairs Commission (CAC).</p>
          <p className={styles.effectiveDate}>Effective Date: March 1, 2026 &middot; Last updated: October 20, 2026</p>

          <h2>1. Introduction</h2>
          <p>Welcome to <strong>Spotlight Directories</strong> ("we," "our," or "us"). We are committed to protecting your personal data in accordance with applicable laws, including the Nigeria Data Protection Act (NDPA).</p>

          <h2>2. Data Controller</h2>
          <p>Spotlight Digital Services Ltd is the Data Controller responsible for your personal data.</p>
          <p>Spotlight Digital Services Ltd is registered with the Nigeria Data Protection Commission (NDPC) as a Data Controller under the Nigeria Data Protection Act, 2023 &mdash; Registration No. <strong>NDPC/DCP/14269</strong> (valid 21/08/2026 to 21/08/2027). You can verify this registration and lodge any data protection complaints directly with NDPC at <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer">ndpc.gov.ng</a>.</p>
          <p>📧 <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a><br />🏢 3 Alafia Lane, Shomolu, Lagos</p>

          <h2>3. Information We Collect</h2>
          <h3>a. Personal Data</h3>
          <ul>
            <li>Full name</li>
            <li>Email address</li>
            <li>Phone number or WhatsApp contact</li>
            <li>Business or shop name</li>
            <li>Category, state, LGA, and location details</li>
            <li>Links to your business website or social media (if provided)</li>
          </ul>
          <h3>b. Usage Data</h3>
          <ul>
            <li>IP address and device information</li>
            <li>Browser type and version</li>
            <li>Pages visited and interactions</li>
            <li>A random visitor code stored on your device (in your browser&apos;s local storage or the app&apos;s storage, not a cookie), used to count how many different people viewed a business. It is not linked to your name or email unless you are logged in as a customer.</li>
            <li>Your approximate state, worked out from your connection when you visit. We do not store your IP address.</li>
          </ul>
          <h3>c. Cookies and Tracking</h3>
          <p>We do not use cookies for advertising or analytics. Your theme preference (light/dark) and login session are stored locally in your browser, not as cookies. Cookies on this site come from two third-party services we rely on: Paystack, to securely process payments during checkout, and Tawk.to, to power our live chat support widget.</p>
          <p>When you first visit, a banner lets you accept or decline these cookies. Paystack&apos;s cookies are strictly necessary to complete a payment you initiate and cannot be declined. If you decline, the Tawk.to chat widget will not load; you can still reach us by email. You can change your choice at any time by clearing your browser&apos;s site data for spotlightdirectories.com.</p>

          <p>You can switch the visitor code and approximate location off at any time: on this website under &ldquo;Your Analytics Choice&rdquo; near the bottom of this page, and in the mobile app under Settings (or the customer dashboard). Switching off removes the visitor code from your device and stops location being attached; your visit still counts in anonymous totals. Business owners only ever see totals, never individual visitors. We do not use this information for advertising. Visitor codes and locations are removed from our records after 24 months.</p>

          <h2>4. Public Listing Notice ⚠️</h2>
          <p>By creating a listing on Spotlight Directories:</p>
          <ul>
            <li>Your business information (including phone/WhatsApp) will be publicly visible</li>
            <li>Users may contact you directly</li>
            <li>You accept this as part of the service</li>
          </ul>

          <h2>5. Legal Basis for Processing</h2>
          <ul>
            <li>Consent</li>
            <li>Contractual necessity</li>
            <li>Legal obligation</li>
            <li>Legitimate interest</li>
          </ul>

          <h2>6. How We Use Your Data</h2>
          <ul>
            <li>Provide and manage listings</li>
            <li>Enable user interaction</li>
            <li>Improve platform performance</li>
            <li>Communicate with users</li>
          </ul>

          <h2>7. Data Sharing</h2>
          <p>We do not sell your data. We may share it with:</p>
          <ul>
            <li>Infrastructure providers (e.g., hosting, database services)</li>
            <li>Security services (e.g., Google reCAPTCHA)</li>
            <li>Authorities where required by law</li>
          </ul>

          <h2>8. Data Retention</h2>
          <p>We retain data only as long as necessary for service delivery or legal compliance.</p>
          <p>
            <strong>Vendor accounts:</strong> when a vendor closes their account, the listing is hidden immediately and
            can be restored within 14 days. After that the closure is final, and within 30 further days we permanently
            erase the vendor&apos;s profile, products, services, photos, videos, verification documents, contact
            details, enquiries, reviews and login. We keep only subscription invoices, payment receipts and sponsorship
            receipts (and, for partner referrals, the record of which businesses were registered), because we are
            required to retain these for accounting and reporting. These records do not contain the profile or any way
            to sign in.
          </p>

          <h2>9. Your Rights</h2>
          <ul>
            <li>Access your data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion</li>
            <li>Withdraw consent</li>
          </ul>
          <p>You can do this via your dashboard or by emailing us. Requests are handled within 14 days. Vendors can also close their account at any time from Settings in the website or the app; see Data Retention above for what happens next.</p>

          <h2>10. Data Security</h2>
          <p>We implement appropriate security measures to protect your data. However, no system is completely secure.</p>

          <h2>11. Data Breach</h2>
          <p>In the event of a data breach, we will notify affected users and relevant authorities as required by law.</p>

          <h2>12. Children</h2>
          <p>Our services are not intended for children under 13.</p>

          <h2>13. Updates</h2>
          <p>We may update this policy from time to time. Continued use means acceptance.</p>

          <h2>Your Analytics Choice</h2>
          <AnalyticsChoice />

          <h2>14. Contact</h2>
          <p>📧 <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a><br />
          🌐 <a href="https://spotlightdirectories.com">spotlightdirectories.com</a></p>
        </div>
      </main>
      <Footer />
    </>
  );
}
