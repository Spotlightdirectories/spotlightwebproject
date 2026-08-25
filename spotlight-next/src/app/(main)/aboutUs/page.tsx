import type { Metadata } from "next";
import Footer from "@/components/Footer";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About Us | Spotlight Directories",
  description: "Learn how Spotlight Directories helps Nigerian businesses improve digital visibility.",
};

export default function AboutPage() {
  return (
    <>
      <main>
        {/* HERO */}
        <section className={styles.hero}>
          <div className={styles.container}>
            <h1>Every Business Deserves to Be Seen.</h1>
            <p>Spotlight Directories helps Nigerian businesses improve digital visibility — simply, affordably, and professionally.</p>
            <div className={styles.heroActions}>
              <a href="/getlisted" className={styles.btnPrimary}>Get Listed</a>
              <a href="/discover" className={styles.btnOutline}>Explore Directory</a>
            </div>
            <div className={styles.heroMeta}>Location-Based Search • Structured Listings • Nationwide Reach</div>
          </div>
        </section>

        {/* PROBLEM / INSIGHT / SOLUTION */}
        <section className={styles.section}>
          <div className={`${styles.container} ${styles.grid3}`}>
            <div>
              <h2>The Problem</h2>
              <p>Many capable Nigerian businesses remain difficult to find online — not because they lack quality, but because digital visibility feels complex or expensive.</p>
            </div>
            <div>
              <h2>The Insight</h2>
              <p>Communities rely daily on salons, mechanics, pharmacies, retailers, artisans and professionals — yet discovering them digitally isn't always simple.</p>
            </div>
            <div>
              <h2>The Solution</h2>
              <p>Spotlight provides structured business listings and map-enabled search tools that connect buyers and sellers efficiently.</p>
            </div>
          </div>
        </section>

        {/* VALUES */}
        <section className={`${styles.section} ${styles.light}`}>
          <div className={styles.container}>
            <h2 className={styles.center}>Built on STEP-I</h2>
            <div className={styles.grid5}>
              {[
                { title: "Support", desc: "Guided onboarding for businesses." },
                { title: "Transparency", desc: "Clear listing structure and processes." },
                { title: "Empowerment", desc: "Affordable digital visibility tools." },
                { title: "Privacy", desc: "Controlled handling of business data — NDPC registered (Reg. No. NDPC/DCP/14269)." },
                { title: "Integrity", desc: "A neutral platform facilitating discovery." },
              ].map((v, i) => (
                <div key={i} className={styles.card}>
                  <h3>{v.title}</h3>
                  <p>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* METRICS */}
        <section className={styles.metrics}>
          <div className={`${styles.container} ${styles.grid4} ${styles.center}`}>
            {[
              { num: "Growing", label: "New Businesses Daily" },
              { num: "20km", label: "Radius-Based Matching" },
              { num: "24/7", label: "Online Discoverability" },
              { num: "Nigeria", label: "Growing Coverage" },
            ].map((m, i) => (
              <div key={i}>
                <h2>{m.num}</h2>
                <p>{m.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* LEGAL NOTE */}
        <section className={`${styles.section} ${styles.light}`}>
          <div className={`${styles.container} ${styles.narrow} ${styles.center}`}>
            <p className={styles.legal}>
              Spotlight Directories operates solely as a digital business listing platform. We provide structured business information and search tools. Spotlight is not a party to transactions between users and vendors. Users are encouraged to conduct independent verification before engagement.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className={styles.cta}>
          <div className={`${styles.container} ${styles.center}`}>
            <h2>Ready to Claim Your Spot?</h2>
            <p>Join businesses across Nigeria increasing their visibility.</p>
            <a href="/getlisted" className={`${styles.btnPrimary} ${styles.large}`}>Get Listed Now</a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
