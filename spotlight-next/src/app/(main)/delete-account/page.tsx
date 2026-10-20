import type { Metadata } from "next";
import Footer from "@/components/Footer";
import styles from "../terms/legal.module.css";

export const metadata: Metadata = {
  title: "Delete Your Account | Spotlight Directories",
  description: "How to delete your Spotlight Directories account and what happens to your data.",
};

export default function DeleteAccountPage() {
  return (
    <>
      <main className={styles.legalPage}>
        <div className={styles.legalContainer}>
          <h1>Delete Your Account</h1>
          <p className={styles.effectiveDate}>Last updated: October 20, 2026</p>
          <p>
            You can delete your Spotlight Directories account at any time, from the website or the mobile app.
            This page explains how, and what happens to your data.
          </p>

          <h2>Customers</h2>
          <p><strong>How:</strong> log in, open your profile (Overview), and choose <em>Delete my account</em>. You will be asked for your password to confirm.</p>
          <ul>
            <li>For <strong>14 days</strong> your account is scheduled for deletion and you can change your mind by choosing <em>Keep my account</em> after logging in.</li>
            <li>After 14 days, everything is <strong>permanently deleted</strong>: your name, email, phone number, favourites, reviews, visit and quote requests, photos you attached, search history and your login.</li>
            <li>We keep nothing that identifies you. We send you an email once deletion is complete.</li>
          </ul>

          <h2>Vendors (business owners)</h2>
          <p><strong>How:</strong> log in to your vendor dashboard, open <em>Settings</em>, and choose <em>Close my account</em> in the Danger Zone.</p>
          <ul>
            <li>Your listing is hidden immediately. For <strong>14 days</strong> you can restore it.</li>
            <li>After 14 days the closure is final, and within <strong>30 further days</strong> (44 days in total) your profile, products, services, photos, videos, verification documents, contact details, enquiries, reviews and login are permanently erased.</li>
            <li>We keep only subscription invoices, payment receipts and sponsorship receipts, which we are required to retain for accounting and reporting. These contain no profile and no way to sign in.</li>
          </ul>

          <h2>Partners</h2>
          <p><strong>How:</strong> log in to your partner dashboard and choose to close your account.</p>
          <ul>
            <li>You have <strong>14 days</strong> to restore it, then within <strong>30 further days</strong> (44 days in total) your contact details, date of birth, location, identity document and login are permanently erased.</li>
            <li>We keep the record of commissions and payouts, and of which businesses and partners you registered, together with your name and referral code, for accounting and reporting.</li>
            <li>Your bank details are kept only while a commission is still owed to you, and are erased once it is paid.</li>
          </ul>

          <h2>Can&apos;t log in?</h2>
          <p>
            If you cannot access your account, email <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a> from the
            email address on the account and ask us to delete it. We will verify it is you and respond within 14 days.
          </p>
          <p>See also our <a href="/privacy">Privacy Policy</a>.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
