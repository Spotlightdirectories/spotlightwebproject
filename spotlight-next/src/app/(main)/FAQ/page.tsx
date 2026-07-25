"use client";

import { useState } from "react";
import Footer from "@/components/Footer";
import styles from "./faq.module.css";

const FAQS = [
  { q: "1. How do I list my business on Spotlight?", a: "Simple — click Get Listed on any page, fill in your business name, category, location, and contact details, then submit. The whole process takes about 5 minutes, and you don't need a website or any technical knowledge. Your listing goes live once reviewed." },
  { q: "2. Do I need a physical shop or office to be listed?", a: "Not at all. Home-based businesses, freelancers, mobile service providers, and online sellers are all welcome. What matters is that you offer real value — not that you have a physical address." },
  { q: "3. What is the 90-day free trial and how does it work?", a: "Every new vendor on Spotlight gets a free 90-day trial — no credit card required, no hidden charges. Your listing is fully live from day one. You can add up to 3 products, 3 services, and 1 gallery image. After 90 days, your listing moves to the Free plan — it stays live but with reduced limits. Nothing is charged automatically." },
  { q: "4. What does it cost to stay on Spotlight after the trial?", a: "After your 90-day trial, your listing continues on the Free plan at no charge. Paid plans give you more product/service listings, gallery images, branch management, and sponsored visibility. Visit the Get Listed page to see full plan details and pricing." },
  { q: "5. Can I add my products and services to my listing?", a: "Yes — from your vendor dashboard, you can add individual products (with photos, prices, and descriptions) and services. Customers can search for what you sell directly, not just your business name. The number you can add depends on your plan." },
  { q: "6. Can I update my business information later?", a: "Yes, anytime. Log into your vendor dashboard and you can update your description, photos, contact details, hours, location, products, and services whenever you need to. Changes reflect almost immediately." },
  { q: "7. Can I list more than one business?", a: "Yes. Each business needs its own separate listing. You can manage them from the same account or separate accounts — whichever works better for you." },
  { q: "8. How does vendor verification work?", a: "Spotlight offers two types of verification badges: a Blue Badge (Verified Business — for vendors who submit official business documents) and a Gray Badge (Verified Identity — for vendors who verify their personal identity). Verified vendors rank higher in search results. Verification is optional but strongly recommended." },
  { q: "9. What is a Sponsored listing?", a: "Sponsored listings appear at the top of relevant search results, ahead of non-sponsored vendors. It's an affordable way to get more visibility. Sponsorship is available for your business profile, individual products, or individual services." },
  { q: "10. Can I manage multiple branch locations?", a: "Yes — Enterprise and Elite plan vendors can add multiple branch locations to a single listing. Each branch can have its own address, phone number, and opening hours. Customers searching nearby will find the branch closest to them automatically." },
  { q: "11. How do customers find businesses on Spotlight?", a: "Customers can search by keyword, browse by category, filter by location (state and LGA), or enable distance search to find businesses within a certain number of kilometres from their current location. No account needed to search." },
  { q: "12. Can customers contact vendors directly?", a: "Yes — directly, with no middleman. Every listing shows approved contact details including a WhatsApp button, phone number, and directions. Customers reach you the way that works best for them." },
  { q: "13. Does Spotlight handle payments or deliveries?", a: "No. Spotlight is a discovery platform — we connect customers with businesses, but all transactions, pricing, and delivery arrangements happen directly between you and your customer." },
  { q: "14. What if I have an issue with a vendor?", a: "You can report concerns through our Contact page or use the feedback form. While Spotlight is not a party to transactions, we take reports seriously and will review them." },
  { q: "15. How secure is my information on Spotlight?", a: "We only collect information necessary to display your listing and operate the platform. Payment card numbers are never stored on Spotlight — payments are processed securely through Paystack. Spotlight will never ask for your password, BVN, or NIN." },
  { q: "16. Still have a question?", a: "We're happy to help. Reach us via WhatsApp at 0901-208-5744, email us at support@spotlightdirectories.com, or use the Contact page. We're online Monday–Saturday, 9am–6pm." },
];

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <main className={styles.faqPage}>
        <section className={styles.faqSection}>
          <h1>Frequently Asked Questions</h1>
          <p className={styles.faqIntro}>
            Everything you need to know about Spotlight Directories. Can't find your answer?{" "}
            <a href="/contact-us">Contact us</a> — we're happy to help.
          </p>

          <div className={styles.accordion}>
            {FAQS.map((faq, i) => (
              <div key={i} className={styles.accordionItem}>
                <button
                  type="button"
                  className={styles.accordionHeader}
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  {faq.q}
                  <span className={styles.accordionIcon}>{open === i ? "−" : "+"}</span>
                </button>
                {open === i && (
                  <div className={styles.accordionPanel}>
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
