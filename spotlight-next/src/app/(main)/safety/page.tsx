import type { Metadata } from "next";
import Footer from "@/components/Footer";
import styles from "./safety.module.css";

export const metadata: Metadata = {
  title: "Safety Center | Spotlight Directories",
  description: "How Spotlight Directories helps service seekers and providers in Nigeria stay safe — verification, restricted-item enforcement, and practical safety guidance.",
};

const REALITY = [
  {
    icon: "fa-solid fa-user-slash",
    title: "A vendor takes a deposit, then disappears",
    desc: "You pay upfront, and suddenly calls go unanswered and numbers are switched off. No accountability, no way back.",
  },
  {
    icon: "fa-solid fa-user-secret",
    title: "You don't know who's really coming",
    desc: "A stranger you found online is about to enter your home or shop. You have no way to confirm who they really are.",
  },
  {
    icon: "fa-solid fa-comment-slash",
    title: "\"Let's not do this on the platform\"",
    desc: "A buyer or seller pushes to move off Spotlight immediately, before any record of the agreement exists.",
  },
  {
    icon: "fa-solid fa-key",
    title: "\"Just send me the OTP to confirm\"",
    desc: "A message that looks official asks for a one-time password or PIN. No legitimate business ever needs this.",
  },
];

const HOW_WE_HELP = [
  {
    icon: "fa-solid fa-shield-heart",
    title: "Verification badges",
    desc: "Vendors can apply for a verification badge by submitting real identity and business documentation for review. Look for the badge before you engage.",
  },
  {
    icon: "fa-solid fa-ban",
    title: "Restricted items are actively blocked",
    desc: "Listings are automatically screened against a list of illegal and restricted items — firearms, narcotics, counterfeit goods, and more — with admin review on flagged listings before they go live.",
  },
  {
    icon: "fa-solid fa-star",
    title: "Recommendations tied to real work",
    desc: "Customers can only leave a verified recommendation after a genuine, completed interaction with a vendor's actual listed work — not an anonymous star rating.",
  },
  {
    icon: "fa-solid fa-envelope-open-text",
    title: "A real person reviews every report",
    desc: "If something feels wrong, one email gets it in front of our team. We can review, warn, or remove a listing or account.",
  },
];

const FOR_SEEKERS = [
  "Look for the verification badge, and read reviews before you commit to a vendor.",
  "Meet in a safe, public, or well-known business location for a first-time engagement — never an isolated address you can't verify.",
  "Never pay the full amount upfront before work has started or goods have been inspected. A reasonable deposit is normal; demanding 100% upfront is a warning sign.",
  "Get the price, scope, and timeline in writing — even a WhatsApp message is enough — before work begins.",
  "If a vendor pressures you to move off-platform immediately or pushes an unusual payment method, stop and report it.",
];

const FOR_PROVIDERS = [
  "Confirm a customer's name and a working phone number before travelling for a large or high-value job.",
  "Never share your bank PIN, One-Time Password (OTP), or full card details with anyone, for any reason. No customer, and no one from Spotlight, will ever ask you for this.",
  "Agree on scope and price in writing before you start work — it protects you as much as the customer.",
  "Be cautious of customers who rush you, insist on unusual meeting locations, or pressure you to skip your normal process.",
  "Apply for a verification badge. It's the single biggest trust signal you can show a hesitant customer.",
];

const RED_FLAGS = [
  "Payment requested via crypto, gift cards, or several small transfers to different accounts",
  "Urgency or pressure — \"pay now or I give it to someone else,\" \"decide before you even see it\"",
  "Refusal to share a real, working phone number or verify identity",
  "A price that sounds too good to be true for the work or item described",
  "Any request for your OTP, PIN, or full card number",
];

export default function SafetyPage() {
  return (
    <>
      <main className={styles.safetyPage}>
        {/* HERO */}
        <section className={styles.hero}>
          <div className={styles.heroContainer}>
            <p className={styles.eyebrow}>
              <i className="fa-solid fa-shield-heart"></i> Your safety matters
            </p>
            <h1>Shop And Sell With Confidence</h1>
            <p className={styles.heroSub}>
              Spotlight is a discovery platform — we connect you, but every meeting, delivery, and payment
              happens directly between you and the other party. Here&apos;s exactly how we help keep that
              safe, and what to watch for as a Nigerian buyer or seller.
            </p>
          </div>
        </section>

        {/* THE REALITY */}
        <section className={styles.section}>
          <div className={styles.sectionContainer}>
            <p className={styles.eyebrow}>The reality</p>
            <h2>We Know What Can Go Wrong</h2>
            <p className={styles.sectionSub}>
              These are real risks people face on any platform that connects strangers in Nigeria. We&apos;re
              not going to pretend they don&apos;t exist — we&apos;d rather you know what to watch for.
            </p>
            <div className={styles.realityGrid}>
              {REALITY.map((r, i) => (
                <div key={i} className={styles.realityCard}>
                  <i className={r.icon}></i>
                  <h3>{r.title}</h3>
                  <p>{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW WE HELP */}
        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <div className={styles.sectionContainer}>
            <p className={styles.eyebrow}>How Spotlight helps</p>
            <h2>Built-In Protections</h2>
            <div className={styles.helpGrid}>
              {HOW_WE_HELP.map((h, i) => (
                <div key={i} className={styles.helpCard}>
                  <i className={h.icon}></i>
                  <h3>{h.title}</h3>
                  <p>{h.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOR SEEKERS */}
        <section className={styles.section}>
          <div className={styles.sectionContainer}>
            <div className={styles.checklistBlock}>
              <div className={styles.checklistHeading}>
                <i className="fa-solid fa-magnifying-glass"></i>
                <div>
                  <p className={styles.eyebrow}>For service seekers</p>
                  <h2>Before You Book Or Buy</h2>
                </div>
              </div>
              <ul className={styles.checklist}>
                {FOR_SEEKERS.map((tip, i) => (
                  <li key={i}><i className="fa-solid fa-circle-check"></i> {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FOR PROVIDERS */}
        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <div className={styles.sectionContainer}>
            <div className={styles.checklistBlock}>
              <div className={styles.checklistHeading}>
                <i className="fa-solid fa-store"></i>
                <div>
                  <p className={styles.eyebrow}>For providers &amp; artisans</p>
                  <h2>Protect Your Business Too</h2>
                </div>
              </div>
              <ul className={styles.checklist}>
                {FOR_PROVIDERS.map((tip, i) => (
                  <li key={i}><i className="fa-solid fa-circle-check"></i> {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* RED FLAGS */}
        <section className={styles.section}>
          <div className={styles.sectionContainer}>
            <div className={styles.redFlagBox}>
              <h2><i className="fa-solid fa-triangle-exclamation"></i> Red Flags — For Everyone</h2>
              <p>Whichever side of a listing you're on, stop and think twice if you notice any of these:</p>
              <ul>
                {RED_FLAGS.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* REPORT */}
        <section className={`${styles.section} ${styles.reportSection}`}>
          <div className={styles.sectionContainer}>
            <i className="fa-solid fa-envelope-open-text"></i>
            <h2>See Something Wrong? Tell Us.</h2>
            <p>
              Spotlight cannot see or control what happens between a buyer and a seller once you&apos;re in
              contact — but we can review, warn, and remove listings or accounts that break the rules. If
              anything about a listing or interaction feels off, don&apos;t stay quiet.
            </p>
            <a href="mailto:support@spotlightdirectories.com" className={styles.reportBtn}>
              <i className="fa-solid fa-paper-plane"></i> support@spotlightdirectories.com
            </a>
            <p className={styles.reportFooter}>
              For the full legal terms, including our complete restricted &amp; prohibited items list, see the{" "}
              <a href="/disclaimer">Disclaimer</a>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
