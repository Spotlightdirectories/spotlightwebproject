"use client";

// ===============================================================
// src/app/(main)/resources/page.tsx
//
// Resources page — hosts the full vendor onboarding walkthrough
// video (YouTube, unlisted) for anyone who wants to watch the
// complete process before or after signing up.
// ===============================================================

import Footer from "@/components/Footer";
import { useIsMobile } from "@/lib/useIsMobile";
import { ONBOARDING_VIDEOS, toEmbedUrl } from "@/lib/onboardingVideos";
import styles from "./resources.module.css";

export default function ResourcesPage() {
  const isMobile = useIsMobile();
  const videoUrl = isMobile ? ONBOARDING_VIDEOS.fullWalkthrough.mobile : ONBOARDING_VIDEOS.fullWalkthrough.desktop;
  const embedUrl = toEmbedUrl(videoUrl);

  return (
    <>
      <main className={styles.resPage}>

        <section className={styles.resHero}>
          <p className={styles.resEyebrow}>Learn Spotlight</p>
          <h1>Resources</h1>
          <p className={styles.resHeroSub}>
            A complete walkthrough of Spotlight Directories — from creating your vendor
            account to managing your full dashboard. Watch it before you sign up, or
            anytime you need a refresher.
          </p>
        </section>

        <section className={styles.resVideoSection}>

          <div className={styles.resVideoWrap}>
            <iframe
              src={embedUrl}
              title="Spotlight Directories — Full Vendor Onboarding Walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>

          <div className={styles.resVideoInfo}>
            <h2>Full Vendor Onboarding Walkthrough</h2>
            <p>
              This video covers everything from start to finish: creating your vendor
              account, setting up your business profile, adding products and services,
              building your portfolio, getting verified, and understanding your dashboard
              and insights.
            </p>

            <a href="/getlisted" className={styles.resBtnPrimary}>Get Listed Free</a>
          </div>

        </section>

      </main>
      <Footer />
    </>
  );
}
