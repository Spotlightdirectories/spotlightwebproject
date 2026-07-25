import type { Metadata } from "next";
import Footer from "@/components/Footer";
import styles from "../terms/legal.module.css";

export const metadata: Metadata = {
  title: "Disclaimer | Spotlight Directories",
};

export default function DisclaimerPage() {
  return (
    <>
      <main className={styles.legalPage}>
        <div className={styles.legalContainer}>
          <h1>Disclaimer</h1>
          <p><strong>"Spotlight Directories"</strong> is a brand of <strong>SPOTLIGHT DIGITAL SERVICES LTD</strong>, a company duly registered in Nigeria with the Corporate Affairs Commission (CAC).</p>

          <h2>1. No Guarantee of Results</h2>
          <p>Spotlight Directories provides a business listing platform designed to improve visibility for vendors. However, we do not guarantee any increase in sales, customer engagement, or business performance. Results depend on factors beyond our control.</p>

          <h2>2. Platform Nature (IMPORTANT)</h2>
          <p>Spotlight Directories operates solely as an online directory and discovery platform.</p>
          <ul>
            <li>We are <strong>not a party to any transaction</strong> between users and vendors</li>
            <li>We do not verify or guarantee the accuracy of vendor information</li>
            <li>We do not guarantee the quality, safety, or legality of products or services</li>
          </ul>

          <h2>3. Use at Your Own Risk</h2>
          <p>All listings, content, and services are provided "as is" and "as available." You are responsible for verifying any information before relying on it or engaging with any vendor.</p>

          <h2>4. Vendor Responsibility</h2>
          <p>Vendors are solely responsible for the accuracy of their listings, the quality of their services, and all interactions with users.</p>

          <h2>5. External Links and Third-Party Services</h2>
          <p>Our platform may contain links to third-party websites or services. We do not control or take responsibility for their content, policies, or practices.</p>

          <h2>6. Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, Spotlight Directories shall not be liable for any loss, damage, or disputes arising from:</p>
          <ul>
            <li>Use of the platform</li>
            <li>Transactions between users and vendors</li>
            <li>Reliance on any listing or information</li>
          </ul>
          <p>Our total liability, if any, shall not exceed the amount paid by you for the specific service giving rise to the claim.</p>

          <h2>7. Mid-Cycle Plan Upgrades</h2>
          <p>Vendors are encouraged to upgrade their subscription plan at the end of their current billing cycle. If a vendor chooses to upgrade while a paid subscription is still active, the new plan takes effect immediately and any unused time on the previous plan is forfeited. All such payments are final.</p>

          <h2>8. Changes to This Disclaimer</h2>
          <p>We may update this Disclaimer at any time. Continued use of the platform means acceptance of the updated version.</p>

          <h2>9. Contact</h2>
          <p>📧 <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a></p>
        </div>
      </main>
      <Footer />
    </>
  );
}
