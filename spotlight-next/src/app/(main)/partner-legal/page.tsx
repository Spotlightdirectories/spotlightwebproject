"use client";

// ===============================================================
// src/app/(main)/partner-legal/page.tsx
//
// Public, no-auth marketing + terms page for the Partner Programme.
// Six hash-deep-linkable tabs: terms, privacy, assets, brand,
// calculator, faq. Linked from partner-program/page.tsx's consent
// checkbox (#terms, #privacy) and meant to be shared with prospects.
//
// Content notes (flagged, not silently invented):
// - The commission numbers, refund window, hold period, and payout
//   schedule below are the REAL, currently-enforced rules (confirmed
//   directly against handle_commission_on_payment(), unlock_commissions(),
//   and the getlisted/payment audit done earlier in this project).
// - This page intentionally does NOT promise collection of bank
//   account details or a NIN for payout/identity verification —
//   production's old copy mentioned both, but neither field exists
//   anywhere in the schema and nothing collects them today. Promising
//   it here would be a real commitment with nothing behind it, so
//   payouts are described only as "bank transfer to the account you
//   provide when payout is due" without implying a stored field.
// ===============================================================

import { useEffect, useState } from "react";
import Footer from "@/components/Footer";
import styles from "./partner-legal.module.css";

type Tab = "terms" | "privacy" | "assets" | "brand" | "calculator" | "faq";

const TABS: { id: Tab; label: string }[] = [
  { id: "terms", label: "Terms" },
  { id: "privacy", label: "Privacy" },
  { id: "assets", label: "Assets" },
  { id: "brand", label: "Brand" },
  { id: "calculator", label: "Calculator" },
  { id: "faq", label: "FAQ" },
];

// Matches PLAN_PRICES_KOBO in the verify-paystack-payment / paystack-webhook
// edge functions and PRICES_KOBO in (main)/payment/page.tsx exactly.
const YEARLY_PRICES_NAIRA: Record<string, number> = {
  standard: 26982,
  enterprise: 113400,
  elite: 201600,
};
const MONTHLY_PRICES_NAIRA: Record<string, number> = {
  standard: 2998,
  enterprise: 12600,
  elite: 22400,
};

const FAQS = [
  { q: "1. Who can join the Spotlight Partner Programme?", a: "Anyone 18 or older with a valid email, phone number, and Nigerian state/LGA of residence can apply. There's no cost to apply, and no minimum sales quota to maintain your account." },
  { q: "2. How do I get paid?", a: "You earn 20% of a vendor's first payment and 10% of every renewal payment they make, for as long as they stay subscribed and you remain their referring partner. If someone you referred becomes a partner too, you earn an additional 5% override on their vendor commissions (one level only — this is not a multi-level structure)." },
  { q: "3. When does a commission become available to withdraw?", a: "Commissions start as 'pending' and move to 'available' automatically 7 days after the vendor's payment is confirmed. This hold protects against refunds and payment disputes. You'll see the exact unlock date next to each commission in your dashboard." },
  { q: "4. When and how are payouts processed?", a: "Payouts are processed between the 1st and 5th of each month, by bank transfer to the account you provide when your payout is due. The minimum payout amount is ₦10,000 — balances below that roll over to the next month." },
  { q: "5. What is the monthly bonus?", a: "You earn a flat ₦30,000 bonus for every 50 yearly-plan vendor commissions you generate within the same calendar month. This is tracked automatically and shown as a progress bar on your dashboard." },
  { q: "6. What happens if a vendor refunds or cancels?", a: "Spotlight's refund window for vendors is 7 days from payment. If a vendor refunds within that window, any related pending commission is reversed before it becomes available. Commissions that have already been marked available and paid are not clawed back." },
  { q: "7. Can I close my partner account, and what happens to my commissions?", a: "Yes, anytime, from your dashboard's Account section. Closing schedules your account for deletion in 14 days (giving you a window to change your mind) but does not forfeit commissions already earned — available and paid commissions remain yours regardless of account status." },
];

export default function PartnerLegalPage() {
  const [tab, setTab] = useState<Tab>("terms");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // Calculator state
  const [calcPlan, setCalcPlan] = useState<"standard" | "enterprise" | "elite">("standard");
  const [calcCycle, setCalcCycle] = useState<"monthly" | "yearly">("yearly");
  const [newVendors, setNewVendors] = useState(5);
  const [renewals, setRenewals] = useState(5);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (TABS.some((t) => t.id === hash)) setTab(hash as Tab);
  }, []);

  function switchTab(id: Tab) {
    setTab(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  }

  const price = calcCycle === "yearly" ? YEARLY_PRICES_NAIRA[calcPlan] : MONTHLY_PRICES_NAIRA[calcPlan];
  const firstPaymentCommission = Math.round(price * 0.2 * newVendors);
  const renewalCommission = Math.round(price * 0.1 * renewals);
  const totalCommission = firstPaymentCommission + renewalCommission;
  const yearlyCommissionCount = calcCycle === "yearly" ? newVendors + renewals : 0;
  const bonusesEarned = Math.floor(yearlyCommissionCount / 50);
  const bonusProgress = yearlyCommissionCount % 50;

  return (
    <>
      <main className={styles.page}>
        <section className={styles.section}>
          <h1>Spotlight Partner Programme</h1>
          <p className={styles.intro}>
            Terms, privacy, marketing assets, brand guidelines, an earnings calculator, and answers to common
            questions — everything a Spotlight Partner needs in one place.
          </p>

          <div className={styles.tabRow}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.tabBtn} ${tab === t.id ? styles.active : ""}`}
                onClick={() => switchTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "terms" && (
            <div className={styles.panel}>
              <h2>Partner Programme Terms</h2>
              <p>
                By applying to and participating in the Spotlight Partner Programme, you agree to the terms below.
                These terms describe how commissions are earned, held, and paid, and what conduct is expected of a
                Spotlight Partner.
              </p>

              <h2>Commission Structure</h2>
              <ul>
                <li><strong>20%</strong> of a referred vendor&apos;s first (initial) payment.</li>
                <li><strong>10%</strong> of every subsequent renewal payment from that same vendor, for as long as they remain subscribed and you remain their referring partner.</li>
                <li><strong>5% override</strong> on the vendor commissions earned by a partner you personally referred into the programme. This override is <strong>one level only</strong> — it is not a multi-level or pyramid structure, and does not extend to a second level of referrals.</li>
                <li><strong>₦30,000 monthly bonus</strong> for every 50 yearly-plan vendor commissions generated within the same calendar month.</li>
              </ul>

              <div className={styles.highlightBox}>
                <strong>Commission hold period:</strong> A new commission is marked &quot;pending&quot; and becomes
                &quot;available&quot; for payout automatically 7 days after the vendor&apos;s payment is confirmed.
                This window exists to cover refunds and payment disputes.
              </div>

              <h2>Refunds &amp; Cancellations</h2>
              <p>
                Vendors may request a refund within 7 days of payment. If a vendor refunds within that window, any
                related pending commission is reversed. Commissions already marked available or paid are not
                clawed back.
              </p>

              <h2>Payouts</h2>
              <p>
                Payouts are processed between the 1st and 5th of each month, by bank transfer to the account you
                provide at the time payout is due. The minimum payout threshold is ₦10,000; smaller balances carry
                over to the following month.
              </p>

              <h2>Fraud &amp; Abuse</h2>
              <p>
                Self-referrals, fake vendor sign-ups, misrepresenting Spotlight to prospects, or any attempt to
                manipulate the commission or bonus structure will result in forfeiture of the related commissions
                and may result in permanent removal from the Programme.
              </p>

              <h2>Identity &amp; Compliance</h2>
              <p>
                Spotlight may request additional information to confirm your identity before processing a payout,
                consistent with standard anti-fraud practice. You are responsible for providing accurate bank
                details when a payout is due and for any tax obligations arising from your earnings.
              </p>

              <h2>Changes to These Terms</h2>
              <p>
                Spotlight may update these terms from time to time. Material changes will be communicated to
                active partners by email. Continued participation after a change constitutes acceptance of the
                updated terms.
              </p>
            </div>
          )}

          {tab === "privacy" && (
            <div className={styles.panel}>
              <h2>Partner Privacy Policy</h2>
              <p>
                This policy covers the information Spotlight collects specifically as part of the Partner
                Programme, in addition to Spotlight&apos;s general Privacy Policy.
              </p>

              <h2>What We Collect</h2>
              <ul>
                <li>Full name, email address, and phone number, provided when you apply.</li>
                <li>State and Local Government Area of residence.</li>
                <li>Date of birth, used only to confirm you meet the 18+ age requirement.</li>
                <li>Your unique referral code and referral activity (which vendors and partners you referred).</li>
                <li>Commission and payout records tied to your account.</li>
              </ul>
              <p>
                Bank account details are collected only at the point a payout is due, and only for the purpose of
                completing that transfer — Spotlight does not store payment card numbers.
              </p>

              <h2>How We Use It</h2>
              <p>
                Your information is used to evaluate your application, operate your partner dashboard, calculate
                and pay commissions, communicate programme updates, and prevent fraud.
              </p>

              <h2>Who Can See It</h2>
              <p>
                Your referral activity is visible to Spotlight&apos;s admin team for commission verification. A
                partner who referred you can see that you joined through their link, but not your personal contact
                details beyond what&apos;s needed to identify your account.
              </p>

              <h2>Your Rights</h2>
              <p>
                You can request a copy of your data, ask us to correct inaccuracies, or close your partner account
                at any time from your dashboard. Closing your account schedules it for deletion after 14 days.
                Contact support@spotlightdirectories.com for any data request.
              </p>
            </div>
          )}

          {tab === "assets" && (
            <div className={styles.panel}>
              <h2>Your Referral Link</h2>
              <p>
                Every partner has a unique referral code, shown on your dashboard. Share it as a link in the
                format <code>spotlightdirectories.com/getlisted?ref=YOURCODE</code> for vendors, or
                <code> spotlightdirectories.com/partner-program?ref=YOURCODE</code> to invite someone as a
                sub-partner under you. Any sign-up through your link is automatically credited to your account.
              </p>

              <h2>WhatsApp Templates</h2>
              <p>Copy, personalize, and send these to business owners in your network.</p>

              <div className={styles.whatsappTemplate}>
                {`Hi [Name], I wanted to share something that's helped small businesses like yours get found by more customers online — it's called Spotlight Directories. You can list your business for free and get discovered by people searching in your area. Here's my link: [your referral link]`}
              </div>
              <div className={styles.whatsappTemplate}>
                {`Hey [Name] 👋 Quick one — are you currently listed anywhere online where customers can find your business by location? Spotlight Directories lets you do that in about 5 minutes, free to start. Take a look: [your referral link]`}
              </div>
              <div className={styles.whatsappTemplate}>
                {`[Name], I know you've been looking to get more customers for your business. I partner with Spotlight Directories and I think it could genuinely help — you get a free listing, customers can find you by search or location, and you can add your products/services. No cost to try it: [your referral link]`}
              </div>

              <h2>Sales Script (Phone/In-Person)</h2>
              <p>
                Open by asking how the business currently gets new customers. Listen first. Then introduce
                Spotlight as a discovery platform — not a marketplace, not a website builder — that helps
                customers who are already searching find them by category and location. Mention the free 90-day
                trial, no card required. Close by offering to walk them through sign-up on the spot if they&apos;re
                interested, since it takes about 5 minutes.
              </p>

              <h2>Onboarding Guide (New Sub-Partners)</h2>
              <ol>
                <li>Apply at partner-program with the sub-partner&apos;s referral link (or have them apply directly and enter your code).</li>
                <li>Wait for admin approval — typically 2–5 business days.</li>
                <li>Once approved, they&apos;ll receive an account-creation email to set their password.</li>
                <li>Encourage them to read this page&apos;s Terms and Calculator tabs before their first referral.</li>
                <li>Their vendor referrals earn them the standard 20%/10%; you earn a 5% override automatically — no extra setup needed.</li>
              </ol>
            </div>
          )}

          {tab === "brand" && (
            <div className={styles.panel}>
              <h2>Brand Colors</h2>
              <div className={styles.swatchRow}>
                <div className={styles.swatch}>
                  <div className={styles.swatchColor} style={{ background: "#000000" }} />
                  #000000
                </div>
                <div className={styles.swatch}>
                  <div className={styles.swatchColor} style={{ background: "#e6c200" }} />
                  #e6c200
                </div>
              </div>

              <h2>Tone of Voice</h2>
              <p>
                Confident but not pushy. Spotlight helps small businesses and artisans get discovered — lead with
                that value, not with hype. Speak plainly, avoid jargon, and let the free trial and real results do
                the convincing.
              </p>

              <h2>Do&apos;s</h2>
              <ul>
                <li>Use the official name &quot;Spotlight Directories&quot; on first mention.</li>
                <li>Use your own referral link in every share so credit is tracked correctly.</li>
                <li>Be honest about what the platform does — a discovery tool, not a guarantee of sales.</li>
              </ul>

              <h2>Don&apos;ts</h2>
              <ul>
                <li>Don&apos;t promise guaranteed income, guaranteed customers, or specific sales results.</li>
                <li>Don&apos;t alter the Spotlight name, logo colors, or claim to be an official Spotlight employee unless you are one.</li>
                <li>Don&apos;t spam unrelated groups or individuals who haven&apos;t shown interest in growing their business.</li>
              </ul>
            </div>
          )}

          {tab === "calculator" && (
            <div className={styles.panel}>
              <h2>Earnings Calculator</h2>
              <p>Estimate your monthly commissions based on how many vendors you refer or renew.</p>

              <div className={styles.calcGrid}>
                <div className={styles.calcInputs}>
                  <div>
                    <label htmlFor="calcPlan">Vendor Plan</label>
                    <select id="calcPlan" value={calcPlan} onChange={(e) => setCalcPlan(e.target.value as typeof calcPlan)}>
                      <option value="standard">Standard</option>
                      <option value="enterprise">Enterprise</option>
                      <option value="elite">Elite</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="calcCycle">Billing Cycle</label>
                    <select id="calcCycle" value={calcCycle} onChange={(e) => setCalcCycle(e.target.value as typeof calcCycle)}>
                      <option value="yearly">Yearly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="newVendors">New vendors referred this month</label>
                    <input
                      id="newVendors"
                      type="number"
                      min={0}
                      value={newVendors}
                      onChange={(e) => setNewVendors(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <div>
                    <label htmlFor="renewals">Renewals this month</label>
                    <input
                      id="renewals"
                      type="number"
                      min={0}
                      value={renewals}
                      onChange={(e) => setRenewals(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                </div>

                <div className={styles.calcResults}>
                  <div className={styles.calcRow}>
                    <span>Plan price ({calcCycle})</span>
                    <span>₦{price.toLocaleString()}</span>
                  </div>
                  <div className={styles.calcRow}>
                    <span>First-payment commissions (20%)</span>
                    <span>₦{firstPaymentCommission.toLocaleString()}</span>
                  </div>
                  <div className={styles.calcRow}>
                    <span>Renewal commissions (10%)</span>
                    <span>₦{renewalCommission.toLocaleString()}</span>
                  </div>
                  {calcCycle === "yearly" && (
                    <div className={styles.calcRow}>
                      <span>Monthly bonuses earned (₦30,000 / 50 yearly commissions)</span>
                      <span>{bonusesEarned} (₦{(bonusesEarned * 30000).toLocaleString()}) — {bonusProgress}/50 toward next</span>
                    </div>
                  )}
                  <div className={styles.calcRow}>
                    <span>Estimated total this month</span>
                    <span>₦{(totalCommission + bonusesEarned * 30000).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                Estimate only — actual commissions depend on real vendor payments and the 7-day availability hold.
                Doesn&apos;t include 5% override earnings from any sub-partners you&apos;ve referred.
              </p>
            </div>
          )}

          {tab === "faq" && (
            <div className={styles.panel}>
              <h2>Frequently Asked Questions</h2>
              <div className={styles.accordion}>
                {FAQS.map((faq, i) => (
                  <div key={i} className={styles.accordionItem}>
                    <button
                      type="button"
                      className={styles.accordionHeader}
                      onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    >
                      {faq.q}
                      <span className={styles.accordionIcon}>{faqOpen === i ? "−" : "+"}</span>
                    </button>
                    {faqOpen === i && (
                      <div className={styles.accordionPanel}>
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
