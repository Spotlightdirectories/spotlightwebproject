import type { Metadata } from "next";
import Footer from "@/components/Footer";
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
          <p className={styles.effectiveDate}>Effective Date: March 1, 2026</p>

          <h2>1. Introduction</h2>
          <p>Welcome to <strong>Spotlight Directories</strong> ("we," "our," or "us"). We are committed to protecting your personal data in accordance with applicable laws, including the Nigeria Data Protection Act (NDPA).</p>

          <h2>2. Data Controller</h2>
          <p>Spotlight Digital Services Ltd is the Data Controller responsible for your personal data.</p>
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
          </ul>
          <h3>c. Cookies and Tracking</h3>
          <p>We use cookies and similar technologies to improve user experience and analyze usage. You can control cookies via your browser settings.</p>

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

          <h2>9. Your Rights</h2>
          <ul>
            <li>Access your data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion</li>
            <li>Withdraw consent</li>
          </ul>
          <p>You can do this via your dashboard or by emailing us. Requests are handled within 14 days.</p>

          <h2>10. Data Security</h2>
          <p>We implement appropriate security measures to protect your data. However, no system is completely secure.</p>

          <h2>11. Data Breach</h2>
          <p>In the event of a data breach, we will notify affected users and relevant authorities as required by law.</p>

          <h2>12. Children</h2>
          <p>Our services are not intended for children under 13.</p>

          <h2>13. Updates</h2>
          <p>We may update this policy from time to time. Continued use means acceptance.</p>

          <h2>14. Contact</h2>
          <p>📧 <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a><br />
          🌐 <a href="https://spotlightdirectories.com">spotlightdirectories.com</a></p>
        </div>
      </main>
      <Footer />
    </>
  );
}
