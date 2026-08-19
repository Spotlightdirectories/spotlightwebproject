"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Footer from "@/components/Footer";
import HomeCategorySearch from "@/components/HomeCategorySearch";
import styles from "./homepage.module.css";

const SLIDES = [
  { img: "/images/tailorwoman.webp", alt: "Tailoring and fashion business owner", tag: "Fashion & Tailoring", caption: "Get found by customers looking for your craft nearby" },
  { img: "/images/mechanic3.webp", alt: "Auto mechanic and repair business owner", tag: "Auto & Technical Services", caption: "Trusted by the customers already searching for you" },
  { img: "/images/hairdresser.webp", alt: "Hairdresser and salon business owner", tag: "Beauty & Hairdressing", caption: "Your next client is already searching nearby" },
  { img: "/images/consultant3.webp", alt: "Consultant and professional services provider", tag: "Professional & Consulting", caption: "Reach clients who need exactly what you offer" },
  { img: "/images/caterer.webp", alt: "Caterer and event food business owner", tag: "Catering & Events", caption: "From small chops to full events — get booked faster" },
  { img: "/images/carpenter.webp", alt: "Carpenter and woodwork business owner", tag: "Carpentry & Woodwork", caption: "Show off your craftsmanship to customers nearby" },
  { img: "/images/accountant.webp", alt: "Accountant and financial services provider", tag: "Accounting & Finance", caption: "Trusted professionals, found by the clients who need them" },
];

const BENEFITS = [
  { icon: "fa-solid fa-location-dot", title: "Found By Location", desc: "Customers searching near your area find you first — not buried in a generic list." },
  { icon: "fa-solid fa-comment-dots", title: "Direct Contact, No Middleman", desc: "WhatsApp, call, or get directions straight to you — no commission, no waiting on a platform." },
  { icon: "fa-solid fa-chart-line", title: "See Who's Finding You", desc: "Every plan includes a real analytics dashboard — where your visitors search from, what they're looking for." },
  { icon: "fa-solid fa-sack-dollar", title: "Free To Start", desc: "A genuine 90-day trial with real features — not a locked-down demo. No card required." },
  { icon: "fa-solid fa-earth-africa", title: "Reach Customers Beyond Your Area", desc: "Search on Spotlight isn't limited to nearby only — customers anywhere in Nigeria can find and reach you." },
  { icon: "fa-solid fa-magnifying-glass", title: "Search Without Signing Up", desc: "Customers can browse and search Spotlight freely — no account needed to find you." },
];

const HOW_STEPS = [
  { img: "/images/slide-community2.webp", alt: "Business owner listing their business", num: "1", title: "List Your Business", desc: "Add your name, category, location, and photos. Takes about 5 minutes." },
  { img: "/images/slide-service_nearby.webp", alt: "Customer searching for a nearby business", num: "2", title: "Get Discovered", desc: "Customers find you by location, category, or by searching what they need." },
  { img: "/images/slide-empowering-small-businesses2.webp", alt: "Business owner connecting with a customer", num: "3", title: "Connect Directly", desc: "They reach you by WhatsApp, phone call, or directions — straight to your door." },
];

const SAFETY = [
  { icon: "fa-solid fa-shield-heart", title: "Verified Badges", desc: "Vendors can apply for identity and business verification. Look for the badge before you engage." },
  { icon: "fa-solid fa-ban", title: "Restricted Items Blocked", desc: "Illegal and unsafe listings — firearms, counterfeit goods, and more — never make it onto Spotlight." },
  { icon: "fa-solid fa-star", title: "Recommendations Tied To Real Work", desc: "Only customers with a genuine, completed interaction can leave a review. No fake ratings." },
  { icon: "fa-solid fa-envelope-open-text", title: "A Real Person Reviews Reports", desc: "See something wrong? One email gets it in front of our team — support@spotlightdirectories.com." },
];

const GROWTH = [
  { icon: "fa-solid fa-magnifying-glass-location", title: "Stand Out Locally", desc: "Show up when nearby customers search your category." },
  { icon: "fa-solid fa-chart-line", title: "Business Insight Dashboard", desc: "See where your visitors come from and what they search for — included on every plan." },
  { icon: "fa-solid fa-shield-heart", title: "Build Trust With Verification", desc: "Apply for a verification badge so customers know you're real." },
];

export default function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveSlide(s => (s + 1) % SLIDES.length);
    }, 6000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  // Manual navigation (arrows/dots) jumps straight to a slide, then resets
  // the auto-advance clock so it doesn't immediately jump again right after
  // someone has just clicked — auto-scroll keeps running either way.
  const goToSlide = useCallback((i: number) => {
    setActiveSlide(i);
    startTimer();
  }, [startTimer]);

  const nextSlide = useCallback(() => {
    setActiveSlide(s => (s + 1) % SLIDES.length);
    startTimer();
  }, [startTimer]);

  const prevSlide = useCallback(() => {
    setActiveSlide(s => (s - 1 + SLIDES.length) % SLIDES.length);
    startTimer();
  }, [startTimer]);

  return (
    <>
      {/* TOP SEARCH — deliberately its own full-width strip above
          everything else on the page (per Cyril, 2026-08), rather
          than embedded partway down inside the hero text column.
          Sits directly under the fixed Navbar; HomeCategorySearch's
          own dropdown panel opens below it without covering it. */}
      <section className={styles.ldTopSearch}>
        <div className={styles.ldTopSearchInner}>
          <HomeCategorySearch />
        </div>
      </section>

      {/* HERO */}
      <section className={styles.ldHero}>
        <div className={styles.ldHeroText}>
          <p className={styles.ldEyebrow}>Nigeria's discovery platform for real businesses</p>
          <h1>Put Your Business On The <span className={styles.ldSpotlightGlow}>Spotlight</span></h1>
          <p className={styles.ldHeroSub}>
            Whatever you sell or fix or build — Spotlight helps nearby customers find you, contact you, and choose you.
          </p>
          <div className={styles.ldHeroCtas}>
            <a href="/getlisted" className={`${styles.ldBtn} ${styles.ldBtnPrimary}`}>Get Listed Free</a>
            <a href="/discover" className={`${styles.ldBtn} ${styles.ldBtnOutline}`}>Advanced Search</a>
          </div>
          <p className={styles.ldHeroMicro}>
            <i className="fa-solid fa-bolt"></i>
            {" "}90-day free trial · No card required
          </p>
        </div>

        <div className={styles.ldHeroSlideshow}>
          {SLIDES.map((slide, i) => (
            <div key={i} className={`${styles.ldSlide} ${activeSlide === i ? styles.ldSlideActive : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.img} alt={slide.alt} className={activeSlide === i ? styles.ldSlideActiveImg : ""} />
              <div className={styles.ldSlideCaption}>
                <span className={styles.ldSlideTag}>{slide.tag}</span>
                <p>{slide.caption}</p>
              </div>
            </div>
          ))}

          <button type="button"
            className={`${styles.ldSlideArrow} ${styles.ldSlideArrowPrev}`}
            onClick={prevSlide}
            aria-label="Previous slide"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button type="button"
            className={`${styles.ldSlideArrow} ${styles.ldSlideArrowNext}`}
            onClick={nextSlide}
            aria-label="Next slide"
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>

          <div className={styles.ldSlideDots}>
            {SLIDES.map((_, i) => (
              <button key={i} type="button"
                className={`${styles.ldDot} ${activeSlide === i ? styles.ldDotActive : ""}`}
                onClick={() => goToSlide(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className={styles.ldBenefits}>
        <h2>Why Businesses Choose Spotlight</h2>
        <div className={styles.ldBenefitsGrid}>
          {BENEFITS.map((b, i) => (
            <div key={i} className={styles.ldBenefitCard}>
              <i className={b.icon}></i>
              <h3>{b.title}</h3>
              <p>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MOBILE APP */}
      <section className={styles.ldApp}>
        <div className={styles.ldAppText}>
          <span className={styles.ldAppBadge}>Coming Soon</span>
          <h2>The Spotlight App Is On Its Way</h2>
          <p>We're building native Android and iOS apps so you can manage your listing and find businesses on the go. Not available yet — no download links to click here, just an honest heads-up.</p>
        </div>
        <div className={styles.ldAppPhone}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/app-preview.webp" alt="Spotlight mobile app preview" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.ldHow}>
        <h2>How It Works</h2>
        <div className={styles.ldHowGrid}>
          {HOW_STEPS.map((step, i) => (
            <div key={i} className={styles.ldHowStep}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={step.img} alt={step.alt} />
              <span className={styles.ldHowNumber}>{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SAFETY — for both service seekers and providers */}
      <section className={styles.ldSafety}>
        <div className={styles.ldSafetyContainer}>
          <p className={styles.ldEyebrow}>
            <i className="fa-solid fa-shield-heart"></i> Your safety comes first
          </p>
          <h2>Built With Nigerian Realities In Mind</h2>
          <p className={styles.ldSafetySub}>
            Whether you&apos;re searching for a service or listing your business, here&apos;s how Spotlight
            helps keep it safe.
          </p>
          <div className={styles.ldSafetyGrid}>
            {SAFETY.map((s, i) => (
              <div key={i} className={styles.ldSafetyCard}>
                <i className={s.icon}></i>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
          <a href="/safety" className={`${styles.ldBtn} ${styles.ldBtnOutline}`}>Read Our Full Safety Guide</a>
        </div>
      </section>

      {/* VENDOR GROWTH */}
      <section className={styles.ldGrowth}>
        <div>
          <p className={styles.ldEyebrow}>For business owners</p>
          <h2>Join Spotlight Directory Today</h2>
          <p className={styles.ldGrowthSub}>Every listing — on every plan — gets these real tools to grow.</p>
          <div className={styles.ldGrowthFeatures}>
            {GROWTH.map((f, i) => (
              <div key={i} className={styles.ldGrowthFeature}>
                <i className={f.icon}></i>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <a href="/getlisted" className={`${styles.ldBtn} ${styles.ldBtnPrimary}`}>List Your Business Free</a>
        </div>
      </section>

      {/* BRANDED FOOTER — 4-column, homepage only */}
      <footer className={styles.hfooter}>
        <div className={`${styles.hcontainer} ${styles.hfooterGrid}`}>
          <div className={styles.hfooterBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/whitelogo3.png" alt="Spotlight Directories" />
            <p>Dedicated to digitalizing local businesses and making services accessible to everyone, everywhere.</p>
          </div>
          <div className={styles.hfooterLinks}>
            <h4>Quick Links</h4>
            <a href="/">Home</a>
            <a href="/aboutUs">Why Spotlight</a>
            <a href="/getlisted">Get Listed</a>
            <a href="/discover">Search Vendors</a>
          </div>
          <div className={styles.hfooterSupport}>
            <h4>Support</h4>
            <a href="/safety">Safety Center</a>
            <a href="/FAQ">FAQ</a>
            <a href="/contact-us">Contact Us</a>
            <a href="/feedback">Feedback</a>
            <a href="/resources">Resources</a>
            <a href="/partner-program" className={styles.hfooterPartnerBtn}>Partner Program</a>
          </div>
          <div className={styles.hfooterNewsletter}>
            <h4>Newsletter</h4>
            <p>Get the latest business tips and deals.</p>
            <div className={styles.newsletterForm}>
              <input type="email" placeholder="Email address (Coming Soon)" disabled />
              <button type="button" disabled>Go</button>
            </div>
          </div>
        </div>
      </footer>

      {/* SHARED FOOTER — matches all other pages */}
      <Footer />
    </>
  );
}
