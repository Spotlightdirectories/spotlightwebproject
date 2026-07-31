"use client";

// ===============================================================
// src/app/(standalone)/partner-legal/page.tsx
//
// Faithful port of production's partner-legal.html + partner-legal.js
// (Cyril's request, 2026-08: port the Marketing Assets tab and the
// Brand Guide's logo exactly as production has them, and use
// production's actual tab label "Marketing Assets" rather than the
// shortened "Assets" an earlier pass used). Six tabs, hash
// deep-linking (#terms, #privacy, #assets, #brand, #calculator,
// #faq), FAQ accordion, and a click-to-calculate Earning Calculator —
// all matching production's exact content, wording, and interaction
// model (a single vendor-count + plan dropdown + Calculate button,
// not a live-updating multi-field version).
//
// One deliberate change: the calculator's total result is styled
// larger, bolder, and in the solid brand gold (not the softer
// primary-hover shade production used) — Cyril's explicit request to
// make it "prominent, gold, bold" once he saw the page live.
//
// Uses the same bespoke PartnerNavbar as /partner-program (own link
// set: Partner Program / Contact Us / Log in — no Why Spotlight?/Get
// Listed, unlike partner-program's navbar) and a much simpler
// bottom-bar-only footer, matching production's actual page (NOT the
// rich 3-column footer partner-program has).
// ===============================================================

import { useEffect, useState } from "react";
import PartnerNavbar from "@/components/PartnerNavbar";
import styles from "./partner-legal.module.css";

type Tab = "terms" | "privacy" | "assets" | "brand" | "calculator" | "faq";

const TABS: { id: Tab; label: string }[] = [
  { id: "terms", label: "Terms" },
  { id: "privacy", label: "Privacy" },
  { id: "assets", label: "Marketing Assets" },
  { id: "brand", label: "Brand Guide" },
  { id: "calculator", label: "Earning Calculator" },
  { id: "faq", label: "FAQ" },
];

const NAV_LINKS = [
  { label: "Partner Program", href: "/partner-program" },
  { label: "Contact Us", href: "/contact-us" },
];

// Matches PLAN_PRICES_KOBO in the verify-paystack-payment /
// paystack-webhook edge functions and PRICES_KOBO in
// (main)/payment/page.tsx — same real prices used everywhere else.
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

  const [calcPlan, setCalcPlan] = useState<"standard" | "enterprise" | "elite">("standard");
  const [calcCycle, setCalcCycle] = useState<"monthly" | "yearly">("yearly");
  const [newVendors, setNewVendors] = useState(5);
  const [renewals, setRenewals] = useState(5);

  const calcPrice = calcCycle === "yearly" ? YEARLY_PRICES_NAIRA[calcPlan] : MONTHLY_PRICES_NAIRA[calcPlan];
  const firstPaymentCommission = Math.round(calcPrice * 0.2 * newVendors);
  const renewalCommission = Math.round(calcPrice * 0.1 * renewals);
  const yearlyCommissionCount = calcCycle === "yearly" ? newVendors + renewals : 0;
  const bonusesEarned = Math.floor(yearlyCommissionCount / 50);
  const bonusProgress = yearlyCommissionCount % 50;
  const estimatedTotal = firstPaymentCommission + renewalCommission + bonusesEarned * 30000;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (TABS.some((t) => t.id === hash)) setTab(hash as Tab);
  }, []);

  function switchTab(id: Tab) {
    setTab(id);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <>
      <PartnerNavbar links={NAV_LINKS} />
      <main className={styles.page}>
        <section className={styles.plSection}>
          <div className={styles.plContainer}>

            <div className={styles.plTabs}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.plTab} ${tab === t.id ? styles.active : ""}`}
                  onClick={() => switchTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TERMS */}
            {tab === "terms" && (
              <div className={`${styles.plTabContent} ${styles.active}`}>
                <h2>Program Terms &amp; Conditions</h2>

                <div className={styles.plBlock}>
                  <h3>1. Commission Structure</h3>
                  <ul>
                    <li>20% commission on every successful paid vendor registration</li>
                    <li>10% commission on renewals</li>
                    <li>₦30,000 bonus upon reaching 50 yearly-paid vendors in a month</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>2. Refund Policy</h3>
                  <ul>
                    <li>Refunds allowed within 7 days</li>
                    <li>No refunds after 7 days</li>
                    <li>Vendor consent is captured during onboarding</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>3. Commission Eligibility</h3>
                  <ul>
                    <li>Commissions become available 7 days after a payment is confirmed</li>
                    <li>Refunded transactions cancel commissions</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>4. Partner Responsibility</h3>
                  <ul>
                    <li>Partners must communicate the refund policy clearly</li>
                    <li>Misrepresentation may lead to suspension</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>5. Growth Reward (Referred Partners)</h3>
                  <ul>
                    <li>5% override on the commission a partner you refer earns — not 5% of the vendor&apos;s payment</li>
                    <li>Paid separately by Spotlight — never deducted from the referred partner&apos;s own earnings</li>
                    <li>Applies only to active partners</li>
                    <li>Limited to one level, not a multi-level structure</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>6. Payout Policy</h3>
                  <ul>
                    <li>Payouts processed between the 1st and 5th of each month</li>
                    <li>Minimum payout is ₦10,000</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>7. Fraud &amp; Abuse</h3>
                  <ul>
                    <li>No fake or duplicate vendors</li>
                    <li>No self-referrals</li>
                    <li>Violations may lead to suspension and loss of earnings</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>8. Identity &amp; Payment Compliance</h3>
                  <ul>
                    <li>Valid ID (e.g. NIN) may be required before payout</li>
                    <li>Account name must match payment details</li>
                    <li>Spotlight may suspend accounts with inconsistencies</li>
                  </ul>
                </div>
              </div>
            )}

            {/* PRIVACY */}
            {tab === "privacy" && (
              <div className={`${styles.plTabContent} ${styles.active}`}>
                <h2>Privacy Policy (Partners)</h2>

                <div className={styles.plBlock}>
                  <h3>1. Introduction</h3>
                  <p>Spotlight Digital Services Ltd respects your privacy and is committed to protecting your personal information. This policy applies only to partners using the platform.</p>
                </div>

                <div className={styles.plBlock}>
                  <h3>2. Information We Collect</h3>
                  <ul>
                    <li>Full name, email address, and phone number</li>
                    <li>Referral activity and earnings data</li>
                    <li>Partner ID and account information</li>
                    <li>Government-issued ID (e.g. NIN) for verification</li>
                    <li>Bank account details for payouts</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>3. How We Use Your Information</h3>
                  <ul>
                    <li>Manage your partner account</li>
                    <li>Track referrals and calculate commissions</li>
                    <li>Process payouts</li>
                    <li>Prevent fraud and verify identity</li>
                    <li>Improve platform performance</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>4. Verification &amp; Fraud Prevention</h3>
                  <p>We may use your data to verify your identity, detect fraudulent activity, and enforce compliance with our terms.</p>
                </div>

                <div className={styles.plBlock}>
                  <h3>5. Data Sharing</h3>
                  <ul>
                    <li>Financial institutions for partner payouts</li>
                    <li>Service providers supporting platform operations</li>
                    <li>Authorities when required by law</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>6. Data Security</h3>
                  <p>We implement appropriate measures to protect your data from unauthorized access or misuse.</p>
                </div>

                <div className={styles.plBlock}>
                  <h3>7. Data Retention</h3>
                  <p>We retain data only as long as necessary to operate the partner program and comply with legal obligations.</p>
                </div>

                <div className={styles.plBlock}>
                  <h3>8. Your Rights</h3>
                  <ul>
                    <li>Access your personal data</li>
                    <li>Request corrections</li>
                    <li>Request deletion (subject to limitations)</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>9. Updates</h3>
                  <p>We may update this policy from time to time. Continued use of the platform means acceptance of updates.</p>
                </div>

                <div className={styles.plBlock}>
                  <h3>10. Contact</h3>
                  <p>Contact us through our official support channels for any privacy-related concerns.</p>
                </div>
              </div>
            )}

            {/* MARKETING ASSETS */}
            {tab === "assets" && (
              <div className={`${styles.plTabContent} ${styles.active}`}>
                <h2>Marketing Assets</h2>

                <div className={styles.plBlock}>
                  <h3>1. Referral Link</h3>
                  <p>Each partner is assigned a unique referral link used to track all vendor registrations. Commissions are only recorded when vendors sign up through your link.</p>
                </div>

                <div className={styles.plBlock}>
                  <h3>2. WhatsApp Message Templates</h3>

                  <p><strong>Template 1 — Direct Offer</strong></p>
                  <p>Hello 👋<br />I help businesses get listed on Spotlight — a platform that connects customers to trusted service providers.<br />You can register here:<br />[PASTE YOUR REFERRAL LINK]</p>

                  <p><strong>Template 2 — Casual Outreach</strong></p>
                  <p>Hi, I came across your business and wanted to share an opportunity to get more customers.<br />Spotlight helps promote businesses like yours.<br />Register here:<br />[PASTE YOUR REFERRAL LINK]</p>

                  <p><strong>Template 3 — Follow-Up</strong></p>
                  <p>Just checking in 😊<br />Have you had a chance to register your business on Spotlight?<br />Let me know if you need help getting started.</p>
                </div>

                <div className={styles.plBlock}>
                  <h3>3. Simple Sales Script</h3>
                  <ul>
                    <li>Introduce yourself: &quot;I help businesses get more visibility on Spotlight.&quot;</li>
                    <li>Explain value: &quot;Customers can find and contact your business easily.&quot;</li>
                    <li>Create urgency: &quot;Early listings get better visibility.&quot;</li>
                    <li>Close: &quot;Let me help you register now.&quot;</li>
                  </ul>
                </div>

                <div className={styles.plBlock}>
                  <h3>4. Vendor Onboarding Guide</h3>
                  <ul>
                    <li>Share your referral link</li>
                    <li>Guide the vendor through registration</li>
                    <li>Explain the 7-day refund policy for paid vendors</li>
                    <li>Stay available to assist</li>
                  </ul>
                </div>
              </div>
            )}

            {/* BRAND GUIDE */}
            {tab === "brand" && (
              <div className={`${styles.plTabContent} ${styles.active}`}>
                <h2>Brand Guide</h2>

                <div className={styles.plBlock}>
                  <h3>1. Logo</h3>
                  <p>Always use the official Spotlight Directories logo below. Don&apos;t recolor, stretch, distort, or add effects to it.</p>
                  <div className={styles.plLogoPreview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/whitelogo3.png" alt="Spotlight Directories Logo" />
                  </div>
                </div>

                <div className={styles.plBlock}>
                  <h3>2. Brand Colors</h3>
                  <div className={styles.plSwatchRow}>
                    <div className={styles.plSwatch}>
                      <div className={styles.plSwatchColor} style={{ background: "#000000" }} />
                      <span>Black — #000000</span>
                    </div>
                    <div className={styles.plSwatch}>
                      <div className={styles.plSwatchColor} style={{ background: "#e6c200" }} />
                      <span>Gold — #e6c200</span>
                    </div>
                  </div>
                </div>

                <div className={styles.plBlock}>
                  <h3>3. How to Talk About Spotlight</h3>
                  <p>Be honest and helpful, not pushy. Spotlight helps real businesses get discovered by real customers — lead with that, not hype.</p>
                </div>

                <div className={styles.plBlock}>
                  <h3>4. Do&apos;s and Don&apos;ts</h3>
                  <ul>
                    <li><strong>Do</strong> mention only features that are actually live today</li>
                    <li><strong>Do</strong> quote the real commission structure from the Terms tab</li>
                    <li><strong>Don&apos;t</strong> promise features that don&apos;t exist yet (e.g. delivery arrangement, scheduling tools)</li>
                    <li><strong>Don&apos;t</strong> spam vendors with repeated messages</li>
                    <li><strong>Don&apos;t</strong> misrepresent how commissions or the monthly bonus are calculated</li>
                  </ul>
                </div>
              </div>
            )}

            {/* EARNING CALCULATOR */}
            {tab === "calculator" && (
              <div className={`${styles.plTabContent} ${styles.active}`}>
                <h2>Earning Calculator</h2>
                <p className={styles.plCalcIntro}>See what your monthly earnings could realistically look like, based on the real commission structure — nothing invented. Updates automatically as you change the numbers below.</p>

                <div className={styles.plCalcGrid}>
                  <div className={styles.plCalcInputs}>
                    <label htmlFor="calc-plan">Vendor Plan</label>
                    <select id="calc-plan" className={styles.plInput} value={calcPlan} onChange={(e) => setCalcPlan(e.target.value as typeof calcPlan)}>
                      <option value="standard">Standard</option>
                      <option value="enterprise">Enterprise</option>
                      <option value="elite">Elite</option>
                    </select>

                    <label htmlFor="calc-cycle">Billing Cycle</label>
                    <select id="calc-cycle" className={styles.plInput} value={calcCycle} onChange={(e) => setCalcCycle(e.target.value as typeof calcCycle)}>
                      <option value="yearly">Yearly</option>
                      <option value="monthly">Monthly</option>
                    </select>

                    <label htmlFor="calc-new">New vendors referred this month</label>
                    <input
                      id="calc-new"
                      type="number"
                      min={0}
                      className={styles.plInput}
                      value={newVendors}
                      onChange={(e) => setNewVendors(Math.max(0, Number(e.target.value)))}
                    />

                    <label htmlFor="calc-renewals">Renewals this month</label>
                    <input
                      id="calc-renewals"
                      type="number"
                      min={0}
                      className={styles.plInput}
                      value={renewals}
                      onChange={(e) => setRenewals(Math.max(0, Number(e.target.value)))}
                    />
                  </div>

                  <div className={styles.plCalcResultsBox}>
                    <div className={styles.plCalcRow}>
                      <span>Plan price ({calcCycle})</span>
                      <strong>₦{calcPrice.toLocaleString()}</strong>
                    </div>
                    <div className={styles.plCalcRow}>
                      <span>First-payment commissions (20%)</span>
                      <strong>₦{firstPaymentCommission.toLocaleString()}</strong>
                    </div>
                    <div className={styles.plCalcRow}>
                      <span>Renewal commissions (10%)</span>
                      <strong>₦{renewalCommission.toLocaleString()}</strong>
                    </div>
                    {calcCycle === "yearly" && (
                      <div className={styles.plCalcRow}>
                        <span>Monthly bonuses earned (₦30,000 / 50 yearly commissions)</span>
                        <strong>{bonusesEarned} (₦{(bonusesEarned * 30000).toLocaleString()}) — {bonusProgress}/50 toward next</strong>
                      </div>
                    )}
                    <div className={`${styles.plCalcRow} ${styles.plCalcTotal}`}>
                      <span>Estimated total this month</span>
                      <strong>₦{estimatedTotal.toLocaleString()}</strong>
                    </div>
                    <p className={styles.plCalcNote}>
                      <i className="fa-solid fa-clock"></i>
                      All commissions become available 7 days after each payment is confirmed. Doesn&apos;t include 5% override earnings from any sub-partners you&apos;ve referred.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* FAQ */}
            {tab === "faq" && (
              <div className={`${styles.plTabContent} ${styles.active}`}>
                <h2>Partner FAQ</h2>
                <div className={styles.plFaq}>
                  {FAQS.map((faq, i) => (
                    <div key={i} className={`${styles.plFaqItem} ${faqOpen === i ? styles.active : ""}`}>
                      <button type="button" className={styles.plFaqQuestion} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                        {faq.q}
                        <span className={styles.plFaqIcon}>{faqOpen === i ? "−" : "+"}</span>
                      </button>
                      <div className={styles.plFaqAnswer}><p>{faq.a}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </section>
      </main>

      <footer className={styles.hfooter}>
        <div className={`${styles.hcontainer} ${styles.hfooterBottom}`}>
          <p>&copy; 2026 Spotlight Digital Services Ltd. All Rights Reserved.</p>
          <div className={styles.hfooterLegal}>
            <a href="/partner-program">Partner Page</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
          </div>
        </div>
      </footer>
    </>
  );
}
