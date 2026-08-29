"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Footer from "@/components/Footer";
import HomeCategorySearch from "@/components/HomeCategorySearch";
import styles from "./homepage.module.css";

// Scroll-reveal hook, added 2026-08-23 per Cyril: watches one section
// and flips `visible` to true the first time it scrolls into the
// viewport, then stops watching -- the reveal only ever plays once
// per page load, not every time someone scrolls past it again.
function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return [ref, visible] as const;
}

const SLIDES = [
  { img: "/images/mechanic-portrait.webp", video: "/videos/mechanic-clip.mp4", alt: "Auto mechanic and repair business owner", tag: "Auto & Technical Services", caption: "Trusted by the customers already searching for you" },
  { img: "/images/tailoring-portrait.webp", video: "/videos/tailoring-clip.mp4", alt: "Tailoring and fashion business owner", tag: "Fashion & Tailoring", caption: "Get found by customers looking for your craft nearby" },
  { img: "/images/provision-seller--portrait.webp", video: "/videos/provision-seller-clip.mp4", alt: "Provision store and grocery business owner", tag: "Provisions & Groceries", caption: "From daily essentials to bulk orders — be their first stop" },
  { img: "/images/accountant-portrait.webp", video: "/videos/accountant-clip.mp4", alt: "Accountant and financial services provider", tag: "Accounting & Finance", caption: "Trusted professionals, found by the clients who need them" },
  { img: "/images/electrician-portrait.webp", video: "/videos/electrician-clip.mp4", alt: "Electrician and electrical services provider", tag: "Electrical Services", caption: "The customer with a blown fuse is searching right now" },
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
  // Dual-video-slot technique, 2026-08-23 per Cyril, replacing two
  // earlier attempts that didn't fully remove the flash (a hidden
  // preload <video>, then a background fetch()). Both only got the
  // BYTES there sooner -- neither warmed up the browser's actual video
  // decode pipeline, which is what still caused a visible startup
  // delay even with the file already downloaded.
  //
  // This keeps exactly two permanent <video> elements ("slots") for
  // the whole slideshow's lifetime -- never more, so the "only ever
  // ~2 videos loading" data promise from earlier today still holds.
  // Whichever slot isn't currently on screen is always quietly
  // playing its assigned clip muted and invisible in the background;
  // the moment it reports it has actually started playing
  // (onPlaying), it's immediately paused and rewound to frame zero --
  // so it sits fully decoded and ready, not just downloaded. When the
  // visible slot's video naturally ends, the slots swap: the
  // already-warmed one becomes visible and resumes instantly, while
  // the one that just finished is reassigned the slide after next and
  // starts silently warming up again for its future turn.
  const [state, setState] = useState<{ slots: [number, number]; visibleSlot: 0 | 1 }>({
    slots: [0, 1 % SLIDES.length],
    visibleSlot: 0,
  });
  const activeSlide = state.slots[state.visibleSlot];
  const videoRefs = [useRef<HTMLVideoElement | null>(null), useRef<HTMLVideoElement | null>(null)] as const;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Accessibility fix, 2026-08-23: an auto-advancing slideshow with no
  // way to stop it fails WCAG 2.2.2 (Pause, Stop, Hide) -- required
  // for any content that changes on its own. isPausedRef exists
  // alongside isPaused (state) because the setInterval callback below
  // is created once and would otherwise see a stale, always-false
  // value of isPaused if it read the state variable directly.
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  const togglePause = useCallback(() => {
    const next = !isPausedRef.current;
    isPausedRef.current = next;
    setIsPaused(next);
    const visibleVideo = videoRefs[state.visibleSlot].current;
    if (visibleVideo) {
      if (next) visibleVideo.pause();
      else visibleVideo.play().catch(() => {});
    }
  }, [state.visibleSlot]);

  // Tracks which slides' video files failed to load (e.g. not added
  // yet) so those specific slides fall back to their still photo
  // instead of showing a broken/blank video box. Added 2026-08-23 per
  // Cyril: slides are being upgraded from photos to short looping
  // video clips of each artisan actually at work, one trade at a time
  // as real footage becomes available -- this lets that happen
  // gradually without anything breaking in the meantime.
  const [videoErrors, setVideoErrors] = useState<Record<number, boolean>>({});

  // One reveal hook per animated section -- see useRevealOnScroll above.
  const [benefitsRef, benefitsVisible] = useRevealOnScroll<HTMLDivElement>();
  const [howRef, howVisible] = useRevealOnScroll<HTMLDivElement>();
  const [safetyRef, safetyVisible] = useRevealOnScroll<HTMLDivElement>();
  const [growthRef, growthVisible] = useRevealOnScroll<HTMLDivElement>();

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    // Extended 6s -> 10s, 2026-08-23 per Cyril: slides now play real
    // 10-second video clips of each artisan at work. This fixed timer
    // is now only a SAFETY NET (in case a video's onEnded somehow
    // never fires) -- normal advancement is driven by advanceSlot()
    // below, triggered by the video actually finishing.
    timerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      advanceSlot();
    }, 10000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The core swap described above. Always advances forward by exactly
  // one slide, reusing the two existing slot elements rather than
  // creating new ones.
  const advanceSlot = useCallback(() => {
    setState(prev => {
      const newVisible: 0 | 1 = prev.visibleSlot === 0 ? 1 : 0;
      const newVisibleSlideIndex = prev.slots[newVisible];
      const slideAfterThat = (newVisibleSlideIndex + 1) % SLIDES.length;
      const newSlots: [number, number] = [...prev.slots];
      newSlots[prev.visibleSlot] = slideAfterThat;

      const becomingVisible = videoRefs[newVisible].current;
      if (becomingVisible) {
        becomingVisible.currentTime = 0;
        becomingVisible.play().catch(() => {});
      }

      return { slots: newSlots, visibleSlot: newVisible };
    });
    startTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTimer]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const nextSlide = useCallback(() => {
    advanceSlot();
  }, [advanceSlot]);

  // Manual navigation (arrows/dots) jumps to an arbitrary slide, which
  // the two-slot preload can't have already warmed up in every case --
  // so these two, unlike natural forward auto-advancing, may still
  // show a brief flash. That's an acceptable, honest trade-off: only
  // ever preloading one slide ahead is what keeps this from re-opening
  // the "loading all 5 videos at once" mobile-data problem from
  // earlier today.
  const goToSlide = useCallback((i: number) => {
    setState(prev => {
      const otherSlot: 0 | 1 = prev.visibleSlot === 0 ? 1 : 0;
      const newSlots: [number, number] = [...prev.slots];
      newSlots[prev.visibleSlot] = i;
      newSlots[otherSlot] = (i + 1) % SLIDES.length;
      return { slots: newSlots, visibleSlot: prev.visibleSlot };
    });
    startTimer();
  }, [startTimer]);

  const prevSlide = useCallback(() => {
    setState(prev => {
      const activeIdx = prev.slots[prev.visibleSlot];
      const target = (activeIdx - 1 + SLIDES.length) % SLIDES.length;
      const otherSlot: 0 | 1 = prev.visibleSlot === 0 ? 1 : 0;
      const newSlots: [number, number] = [...prev.slots];
      newSlots[prev.visibleSlot] = target;
      newSlots[otherSlot] = (target + 1) % SLIDES.length;
      return { slots: newSlots, visibleSlot: prev.visibleSlot };
    });
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
          {SLIDES.map((slide, i) => {
            const isActive = activeSlide === i;
            return (
              <div key={i} className={`${styles.ldSlide} ${isActive ? styles.ldSlideActive : ""}`}>
                {/* Simplified 2026-08-23: this layer is now purely the
                    still-photo backdrop for every slide -- the actual
                    playing video is a separate overlay (two persistent
                    slots, rendered just below) sitting on top of it.
                    Guarantees a correct photo is always shown
                    immediately, with zero dependency on whether any
                    video has loaded yet. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slide.img} alt={slide.alt} className={isActive ? styles.ldSlideActiveImg : ""} />
              </div>
            );
          })}

          {/* Dual video-slot overlay, 2026-08-23 -- see the big comment
              on `state` above for the full explanation. Exactly two
              <video> elements exist for the slideshow's entire
              lifetime; which one is visible/on top is controlled by
              opacity + zIndex, not by mounting/unmounting -- that's
              what lets the hidden one stay fully warmed up and ready
              rather than starting fresh every time. */}
          {([0, 1] as const).map((slot) => {
            const slideIdx = state.slots[slot];
            const slideData = SLIDES[slideIdx];
            const isVisible = state.visibleSlot === slot;
            if (!slideData.video || videoErrors[slideIdx]) return null;
            return (
              <video
                key={`slot-${slot}`}
                ref={videoRefs[slot]}
                src={slideData.video}
                autoPlay
                muted
                playsInline
                preload="auto"
                // @ts-expect-error -- fetchPriority isn't yet in React's video element typings
                fetchPriority={isVisible ? "high" : "low"}
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: isVisible ? 1 : 0,
                  zIndex: isVisible ? 2 : 1,
                  pointerEvents: "none",
                }}
                onPlaying={(e) => {
                  // This slot just started playing. If it's the HIDDEN
                  // one, that means it was only meant to be silently
                  // warming up for its future turn -- freeze it at
                  // frame zero immediately, fully decoded and ready,
                  // rather than letting it keep playing unseen.
                  if (!isVisible) {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }
                }}
                onEnded={() => { if (isVisible) advanceSlot(); }}
                onError={() => setVideoErrors((prev) => ({ ...prev, [slideIdx]: true }))}
              />
            );
          })}

          {/* Bug fix, 2026-08-23 per Cyril: the caption used to live
              inside each .ldSlide div, whose stacking order (z-index)
              got pushed below the new video overlay during the
              dual-slot rewrite -- so it was silently hidden behind the
              playing video, even though the code itself was untouched.
              It's now its own top-level layer with a higher z-index
              than both the photo and video layers, so it always shows
              regardless of which of those two is currently on top. */}
          <div className={styles.ldSlideCaption} key={activeSlide}>
            <span className={styles.ldSlideTag}>{SLIDES[activeSlide].tag}</span>
            <p>{SLIDES[activeSlide].caption}</p>
          </div>

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

          {/* Accessibility fix, 2026-08-23: see isPaused/togglePause
              above -- WCAG 2.2.2 requires a way to stop auto-changing
              content. Also genuinely useful for anyone on limited
              mobile data who'd rather stop the video downloads. */}
          <button
            type="button"
            className={styles.ldSlidePause}
            onClick={togglePause}
            aria-label={isPaused ? "Resume slideshow" : "Pause slideshow"}
          >
            <i className={`fa-solid ${isPaused ? "fa-play" : "fa-pause"}`}></i>
          </button>
        </div>
      </section>

      {/* BENEFITS */}
      <section className={styles.ldBenefits}>
        <h2>Why Businesses Choose Spotlight</h2>
        <div className={`${styles.ldBenefitsGrid} ${styles.ldRevealGrid} ${benefitsVisible ? styles.ldRevealVisible : ""}`} ref={benefitsRef}>
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
        <div className={`${styles.ldHowGrid} ${styles.ldRevealGrid} ${howVisible ? styles.ldRevealVisible : ""}`} ref={howRef}>
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
          <div className={`${styles.ldSafetyGrid} ${styles.ldRevealGrid} ${safetyVisible ? styles.ldRevealVisible : ""}`} ref={safetyRef}>
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
          <div className={`${styles.ldGrowthFeatures} ${styles.ldRevealGrid} ${growthVisible ? styles.ldRevealVisible : ""}`} ref={growthRef}>
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
