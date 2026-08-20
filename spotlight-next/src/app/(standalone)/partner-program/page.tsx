"use client";

// ===============================================================
// src/app/(standalone)/partner-program/page.tsx
//
// Partner Programme — faithful port of production's partner-program.html
// (Cyril's explicit request, 2026-08: "this is the most beautiful page,
// port faithfully — it's for partners, not vendors"). Full structure:
// Hero (with inline Apply form) -> Rewards (3 cards) -> Resources
// (4 cards) -> Login (separate section, not a tab). Production simply
// puts both forms on the same long page, linked by #signup / #login
// anchors — NOT a tab-switched single card, which is what an earlier
// pass of this page mistakenly built instead.
//
// IMPORTANT — the DATA logic here is the CORRECT logic, not a port of
// the current live partner-program.js. Research (2026-08) confirmed
// the current live version writes to columns that don't exist on the
// real `partners` table (`lga`, `referred_by_code`) — meaning it
// cannot successfully insert a row at all against the live schema. An
// older archived file, partner-program-legacy.js, has the correct
// logic (local_government, referred_by, uppercase referral-code
// matching, checking both email AND phone for duplicates) — that's
// what this page's handlers follow.
//
// Referral-code resolution uses a new SECURITY DEFINER RPC,
// get_partner_id_by_referral_code, instead of a raw
// `.from("partners").select(...)` — the live `partners` table is
// fully public-readable (a separate, pre-existing gap flagged to
// Cyril, not fixed here since it also affects the already-working
// vendor-signup referral flow and needs its own dedicated pass), so
// new code written today deliberately avoids relying on that broad
// read rather than adding to what depends on it.
//
// Uses the isolated partnerSupabase client (its own storageKey) so a
// partner's login never collides with a vendor/customer session in
// the same browser — including in the page's own navbar (see
// PartnerNavbar.tsx), which production's version got wrong by reading
// the shared vendor session.
// ===============================================================

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { partnerSupabase, setPartnerSession } from "@/lib/partnerSupabase";
import { nigeriaData } from "@/lib/nigeria-data";
import { EmailTemplates } from "@/lib/emailTemplates";
import PartnerNavbar from "@/components/PartnerNavbar";
import styles from "./partner-program.module.css";

const PARTNER_PROGRAM_NAV_LINKS = [
  { label: "Why Spotlight?", href: "/aboutUs" },
  { label: "Get Listed", href: "/getlisted" },
  { label: "Partner Rewards", href: "#rewards", external: true },
  { label: "Contact Us", href: "/contact-us" },
];

function isAtLeast18(dob: string): boolean {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 18;
}

// Next.js requires useSearchParams() to sit inside a Suspense boundary
// so the page shell can still be prerendered — without this, `npm run
// build` fails outright ("should be wrapped in a suspense boundary").
export default function PartnerProgramPage() {
  return (
    <Suspense fallback={null}>
      <PartnerProgramInner />
    </Suspense>
  );
}

function PartnerProgramInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [submitted, setSubmitted] = useState(false);

  // ---------------------------------------------------------------
  // APPLY FORM STATE
  // ---------------------------------------------------------------
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [lga, setLga] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  const lgaOptions: string[] = stateVal ? nigeriaData[stateVal as keyof typeof nigeriaData] || [] : [];

  function handleStateChange(next: string) {
    setStateVal(next);
    setLga("");
  }

  async function handleApply() {
    setApplyError("");

    if (!name.trim() || !email.trim() || !phone.trim() || !stateVal || !lga || !dob) {
      setApplyError("Please fill in every field.");
      return;
    }
    if (!consent) {
      setApplyError("Please agree to the terms to continue.");
      return;
    }
    if (!isAtLeast18(dob)) {
      setApplyError("You must be at least 18 years old to join the Partner Programme.");
      return;
    }

    setApplying(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    // Matches both unique constraints that actually exist on the
    // table (unique_partner_email, unique_partner_phone) — the
    // current live page only ever checked email.
    //
    // 2026-08 fix: this used to be a raw `.select("id")` against the
    // partners table, which relied on the table's now-removed public
    // read policy. Now uses a narrow RPC that returns true/false only
    // — no row data — so the check works without exposing every
    // partner's details to anonymous visitors again.
    const { data: alreadyExists } = await partnerSupabase.rpc("partner_email_or_phone_exists", {
      p_email: trimmedEmail,
      p_phone: trimmedPhone,
    });

    if (alreadyExists) {
      setApplyError("An application already exists with this email or phone number.");
      setApplying(false);
      return;
    }

    // Referral capture — a partner sharing their own link with a
    // prospective sub-partner. Codes are always generated uppercase
    // (see PartnerApprovalsTab.tsx), so the lookup normalizes case on
    // both ends regardless of how the link was shared/typed.
    let referredBy: string | null = null;
    const refParam = searchParams.get("ref");
    if (refParam) {
      const { data: resolvedId } = await partnerSupabase
        .rpc("get_partner_id_by_referral_code", { p_code: refParam })
        .maybeSingle();
      if (resolvedId) referredBy = resolvedId as unknown as string;
    }

    // 2026-08 fix: no longer chains .select().single() after the
    // insert. Supabase's insert().select() asks Postgres to RETURN
    // the new row, which (with RLS enabled) requires a SELECT policy
    // that permits reading it back — the removed public read policy
    // used to cover that; without it, this exact call started
    // failing with "new row violates row-level security policy" even
    // though the insert itself was fine. Not needed anyway: every
    // value used below (name, email) is already sitting in this
    // component's own state, entered by the applicant a moment ago.
    const { error } = await partnerSupabase.from("partners").insert({
      name: name.trim(),
      email: trimmedEmail,
      phone: trimmedPhone,
      state: stateVal,
      local_government: lga,
      date_of_birth: dob,
      status: "pending",
      referred_by: referredBy,
    });

    if (error) {
      setApplyError(error.message || "Could not submit your application. Please try again.");
      setApplying(false);
      return;
    }

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: trimmedEmail,
          subject: "Application Received — Spotlight Partner Programme",
          html: EmailTemplates.partnerApplicationReceived({ partnerName: name.trim() }),
        }),
      });
    } catch (err) {
      console.error("Application acknowledgment email failed:", err);
    }

    setApplying(false);
    setSubmitted(true);
  }

  // ---------------------------------------------------------------
  // LOGIN FORM STATE
  // ---------------------------------------------------------------
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  async function handleLogin() {
    setLoginError("");
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Enter your email and password.");
      return;
    }
    setLoggingIn(true);

    const { data: signInData, error: signInError } = await partnerSupabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });

    if (signInError || !signInData.user) {
      setLoginError("Incorrect email or password.");
      setLoggingIn(false);
      return;
    }

    // Defensive re-link on every login (mirrors production's intent)
    // — bootstraps the very first link right after account creation,
    // and is a safe no-op on every login after that. Surfaces a clear
    // message if this login has no matching partner application at
    // all, rather than dropping the visitor into a broken dashboard.
    const { data: partnerId, error: linkError } = await partnerSupabase.rpc("link_partner_account");

    if (linkError || !partnerId) {
      setLoginError(
        linkError?.message ||
          "We couldn't find a partner account for this login. If you just applied, please wait for approval and use the account setup link from your approval email."
      );
      await partnerSupabase.auth.signOut();
      setLoggingIn(false);
      return;
    }

    const { data: partnerRow } = await partnerSupabase
      .from("partners")
      .select("id, name, email, referral_code")
      .eq("id", partnerId)
      .single();

    setPartnerSession({
      user_id: signInData.user.id,
      partner_id: partnerId as unknown as string,
      name: partnerRow?.name || "",
      email: partnerRow?.email || loginEmail.trim(),
      referral_code: partnerRow?.referral_code || null,
    });

    router.push("/partner-dashboard");
  }

  if (submitted) {
    return (
      <>
        <PartnerNavbar links={PARTNER_PROGRAM_NAV_LINKS} />
        <main className={styles.page}>
          <section className={styles.ppHero}>
            <div className={styles.ppContainer} style={{ maxWidth: 520 }}>
              <div className={styles.ppCard}>
                <div className={styles.ppSuccessCard}>
                  <h2>Application Received</h2>
                  <p>
                    Thank you for applying to the Spotlight Partner Programme. We&apos;ve sent a confirmation to
                    your email — our team typically reviews applications within 2–5 business days. You&apos;ll
                    receive an email with next steps once a decision has been made.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
        <PartnerFooter />
      </>
    );
  }

  return (
    <>
      <PartnerNavbar links={PARTNER_PROGRAM_NAV_LINKS} />
      <main className={styles.page}>

        {/* HERO / SIGNUP */}
        <section id="signup" className={styles.ppHero}>
          <div className={`${styles.ppContainer} ${styles.ppHeroGrid}`}>

            <div className={styles.ppHeroLeft}>
              <span className={styles.ppBadge}>New Partnership Intake Open</span>
              <h1>
                Become a <span className={styles.ldSpotlightGlow}>Spotlight</span> Partner
              </h1>
              <p className={styles.ppHeroSub}>
                Help Nigerian businesses get discovered, and earn real commission for every one you bring on board.
              </p>
              <div className={styles.ppHeroImage}></div>
            </div>

            <div className={styles.ppCard}>
              <h2 className={styles.ppTextCenter}>Get Started</h2>

              <div className={styles.ppForm}>
                <label htmlFor="partner-name">Full Name</label>
                <input id="partner-name" type="text" placeholder="Enter your name" className={styles.ppInput} value={name} onChange={(e) => setName(e.target.value)} />

                <label htmlFor="partner-email">Email Address</label>
                <input id="partner-email" type="email" placeholder="name@email.com" className={styles.ppInput} value={email} onChange={(e) => setEmail(e.target.value)} />

                <label htmlFor="partner-phone">Phone Number</label>
                <input id="partner-phone" type="tel" placeholder="+234-802-345-6789" className={styles.ppInput} value={phone} onChange={(e) => setPhone(e.target.value)} />

                <label htmlFor="partner-state">State</label>
                <select id="partner-state" className={styles.ppInput} value={stateVal} onChange={(e) => handleStateChange(e.target.value)}>
                  <option value="" disabled>Select State</option>
                  {Object.keys(nigeriaData).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <label htmlFor="partner-lga">LGA</label>
                <select id="partner-lga" className={styles.ppInput} value={lga} onChange={(e) => setLga(e.target.value)} disabled={!stateVal}>
                  <option value="" disabled>Select LGA</option>
                  {lgaOptions.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>

                <label htmlFor="partner-dob">Date of Birth</label>
                <input id="partner-dob" type="date" className={styles.ppInput} value={dob} onChange={(e) => setDob(e.target.value)} />

                <button type="button" className={styles.ppBtnPrimary} onClick={handleApply} disabled={applying}>
                  {applying ? "Submitting..." : "Apply to Join"}
                </button>

                <label className={styles.ppConsent}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  By signing up, you agree to our{" "}
                  <a href="/partner-legal#terms" target="_blank" rel="noopener noreferrer">Terms</a> and{" "}
                  <a href="/partner-legal#privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                </label>

                {applyError && <p className={styles.ppError}>{applyError}</p>}
              </div>
            </div>

          </div>
        </section>

        {/* REWARDS */}
        <section id="rewards" className={`${styles.ppSection} ${styles.ppRewards}`}>
          <div className={styles.ppContainer}>

            <div className={styles.ppTextCenter}>
              <h2>Partner Rewards &amp; Bonuses</h2>
              <p className={styles.ppRewardsSubtext}>We reward performance. As you grow, your earnings grow with you.</p>
            </div>

            <div className={styles.ppGrid}>
              <div className={styles.ppRewardCard}>
                <div className={styles.ppCardIcon}><i className="fa-solid fa-sack-dollar"></i></div>
                <h3>High Commission</h3>
                <p>Earn 20% commission on every paid vendor you bring, plus 10% on renewals.</p>
                <h2 className={styles.ppCardValue}>20%</h2>
                <small>ON FIRST PAYMENT</small>
              </div>

              <div className={`${styles.ppRewardCard} ${styles.ppRewardFeatured}`}>
                <div className={styles.ppBadgeTop}>Monthly Target</div>
                <div className={styles.ppCardIcon}><i className="fa-solid fa-medal"></i></div>
                <h3>Monthly Performance Bonus</h3>
                <p>Hit 50 yearly-paid vendors in a month and earn a ₦30,000 cash bonus.</p>
                <h2 className={styles.ppCardValue}>₦30,000</h2>
                <small>PER 50 YEARLY VENDORS</small>
              </div>

              <div className={styles.ppRewardCard}>
                <div className={styles.ppCardIcon}><i className="fa-solid fa-users"></i></div>
                <h3>Growth Rewards</h3>
                <p>Refer other partners and earn a 5% override on their commissions — paid separately by Spotlight, never deducted from what they earn.</p>
                <h2 className={styles.ppCardValue}>5%</h2>
                <small>OVERRIDE ON THEIR COMMISSION</small>
              </div>
            </div>

            <p className={styles.ppRewardsNote}>
              <i className="fa-solid fa-clock"></i>
              Commissions become available 7 days after a payment is confirmed. Full terms on the{" "}
              <a href="/partner-legal#terms">Partner Terms page</a>.
            </p>

          </div>
        </section>

        {/* RESOURCES */}
        <section className={styles.ppSection}>
          <div className={`${styles.ppContainer} ${styles.ppTextCenter}`}>
            <h2>Everything You Need to Succeed</h2>
            <p className={styles.ppRewardsSubtext}>Real tools, not just a referral link.</p>

            <div className={styles.ppResourceGrid}>
              <a href="/partner-legal#assets" className={styles.ppResourceCard}>
                <i className="fa-solid fa-bullhorn"></i>
                <h3>Referral Toolkit</h3>
                <p>Ready-to-use WhatsApp templates and a simple sales script.</p>
              </a>

              <a href="/partner-legal#brand" className={styles.ppResourceCard}>
                <i className="fa-solid fa-swatchbook"></i>
                <h3>Brand Guide</h3>
                <p>How to represent Spotlight correctly when you promote it.</p>
              </a>

              <a href="/partner-legal#calculator" className={styles.ppResourceCard}>
                <i className="fa-solid fa-calculator"></i>
                <h3>Earning Calculator</h3>
                <p>See what your real, honest monthly earnings could look like.</p>
              </a>

              <a href="/partner-legal#assets" className={styles.ppResourceCard}>
                <i className="fa-solid fa-route"></i>
                <h3>Onboarding Guide</h3>
                <p>Step-by-step guidance for getting a new vendor listed.</p>
              </a>
            </div>
          </div>
        </section>

        {/* LOGIN */}
        <section id="login" className={styles.ppSection}>
          <div className={styles.ppContainer}>
            <div className={styles.ppLogin}>

              <div className={styles.ppLoginLeft}></div>

              <div className={styles.ppLoginRight}>
                <h2>Already a Partner?</h2>
                <p className={styles.ppLoginSubtext}>Access your dashboard to track earnings and performance.</p>

                <div className={styles.ppForm}>
                  <label htmlFor="login-email">Email Address</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="Enter your email address"
                    className={styles.ppInput}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />

                  <label htmlFor="login-password">Password</label>
                  <div className={styles.ppPasswordField}>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className={styles.ppInput}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.ppPasswordToggle}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <i className={showPassword ? "fa-regular fa-eye-slash" : "fa-regular fa-eye"}></i>
                    </button>
                  </div>

                  <button type="button" className={styles.ppBtnPrimary} onClick={handleLogin} disabled={loggingIn}>
                    {loggingIn ? "Logging in..." : "Login to Dashboard"}
                  </button>

                  <div className={styles.ppRememberRow}>
                    <label className={styles.ppRemember}>
                      <input type="checkbox" /> Remember me
                    </label>
                    <a href="/forgot-password?type=partner" className={styles.ppForgotPassword}>Forgot Password?</a>
                  </div>

                  {loginError && <p className={styles.ppError}>{loginError}</p>}
                </div>

                <div className={styles.ppLoginFooter}>
                  <small>New here?</small><br />
                  <a href="#signup">Apply for an account</a>
                </div>
              </div>

            </div>
          </div>
        </section>

      </main>

      <PartnerFooter />
    </>
  );
}

// ===============================================================
// PartnerFooter — production's exact 3-column branded footer for
// this page (brand / quick links / partner support), same visual
// language as the homepage's footer but with partner-relevant links
// in the middle column instead of the homepage's generic Support set.
// ===============================================================
function PartnerFooter() {
  return (
    <footer className={styles.hfooter}>
      <div className={`${styles.hcontainer} ${styles.hfooterGrid}`}>
        <div className={styles.hfooterBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/whitelogo3.png" alt="Spotlight Directories Logo" className={styles.hfooterLogo} />
          <p>Dedicated to digitalizing local businesses and making services accessible to everyone, everywhere.</p>
        </div>

        <div className={styles.hfooterLinks}>
          <h4>Quick Links</h4>
          <a href="/">Home</a>
          <a href="/getlisted">Get Listed</a>
          <a href="/discover">Search Vendors</a>
        </div>

        <div className={styles.hfooterSupport}>
          <h4>Partner Support</h4>
          <a href="/partner-legal#terms">Program Terms</a>
          <a href="/partner-legal#privacy">Privacy Policy</a>
          <a href="/partner-legal#faq">FAQ</a>
          <a href="/contact-us">Contact Support</a>
        </div>
      </div>

      <div className={`${styles.hcontainer} ${styles.hfooterBottom}`}>
        <p>&copy; 2026 Spotlight Digital Services Ltd. All Rights Reserved.</p>
        <div className={styles.hfooterLegal}>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/disclaimer">Disclaimer</a>
        </div>
      </div>
    </footer>
  );
}
