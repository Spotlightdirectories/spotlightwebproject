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

          <h2>7. Safety &amp; Security Guidelines</h2>
          <p>Spotlight Directories is a discovery platform that helps customers find vendors — we are not present for, and do not oversee, any meeting, service delivery, or payment that happens between a customer and a vendor. Please take the following precautions:</p>
          <p><strong>For customers:</strong></p>
          <ul>
            <li>Prefer vendors with a verification badge, and check reviews before engaging</li>
            <li>Meet in a safe, public, or well-known business location where possible, especially for a first engagement</li>
            <li>Avoid paying the full amount upfront before any work has started or goods have been inspected</li>
            <li>Keep a record of your agreement (what was promised, price, timeline) in writing</li>
            <li>Report any vendor behaving suspiciously, requesting unsafe meeting locations, or pressuring you into unusual payment methods</li>
          </ul>
          <p><strong>For vendors:</strong></p>
          <ul>
            <li>Verify a customer's identity and contact details before large or high-value engagements</li>
            <li>Never share your bank PIN, One-Time-Passwords (OTP), or full card details with anyone, including a customer, under any circumstance</li>
            <li>Be cautious of customers who insist on moving communication or payment off-platform immediately, or who pressure you to skip your normal process</li>
            <li>Document the scope of work and price agreed before starting a job</li>
          </ul>
          <p>Spotlight Directories does not guarantee the identity, intentions, or conduct of any user, and is not liable for any loss, harm, or dispute arising from an interaction between a customer and a vendor. If you feel unsafe or suspect fraud, stop the engagement and contact <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a>.</p>

          <h2>8. Restricted &amp; Prohibited Products and Services</h2>
          <p>Vendors may only list products and services that are lawful to sell, advertise, and provide in Nigeria. By creating an account, every vendor agrees not to list anything below. This list is illustrative, not exhaustive — vendors remain responsible for complying with all applicable Nigerian laws and regulations, even where a specific item is not named here.</p>
          <p><strong>Never allowed on Spotlight Directories:</strong></p>
          <ul>
            <li>Illegal drugs, narcotics, and drug paraphernalia</li>
            <li>Firearms, ammunition, explosives, or weapons without valid government authorization</li>
            <li>Counterfeit, pirated, or otherwise intellectual-property-infringing goods</li>
            <li>Wildlife, animal parts, or trophies from protected/endangered species (e.g. ivory, pangolin scales)</li>
            <li>Human body parts, blood, or organs</li>
            <li>Stolen goods, or goods without lawful title</li>
            <li>Counterfeit currency, or tools/services designed to produce it</li>
            <li>Prescription medicines or medical treatments offered without a valid pharmacy/medical license</li>
            <li>Any content or service that sexually exploits or endangers a minor</li>
          </ul>
          <p><strong>Allowed only with valid, verifiable licensing/certification (subject to review):</strong></p>
          <ul>
            <li>Pharmaceuticals, cosmetics, food supplements, and medical devices — requires NAFDAC registration</li>
            <li>Banking, lending, insurance, investment, or other regulated financial services — requires CBN/SEC/NAICOM licensing</li>
            <li>Private security or surveillance services — requires NSCDC licensing</li>
            <li>Fuel, gas, or petroleum product distribution — requires NMDPRA/DPR licensing</li>
            <li>Alcohol and tobacco products — age-restricted, subject to advertising rules</li>
            <li>Real estate/land sales — must have verifiable title documentation</li>
            <li>Betting, lottery, or gambling services — requires National Lottery Regulatory Commission licensing</li>
            <li>Bulk SMS, SIM registration, or telecom resale services — requires NCC licensing</li>
          </ul>
          <p>Spotlight Directories may remove any listing, and suspend or terminate any account, that violates this section, without prior notice.</p>

          <h2>9. Mid-Cycle Plan Upgrades</h2>
          <p>Vendors are encouraged to upgrade their subscription plan at the end of their current billing cycle. If a vendor chooses to upgrade while a paid subscription is still active, the new plan takes effect immediately and any unused time on the previous plan is forfeited. All such payments are final.</p>

          <h2>10. Changes to This Disclaimer</h2>
          <p>We may update this Disclaimer at any time. Continued use of the platform means acceptance of the updated version.</p>

          <h2>11. Contact</h2>
          <p>📧 <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a></p>
        </div>
      </main>
      <Footer />
    </>
  );
}
