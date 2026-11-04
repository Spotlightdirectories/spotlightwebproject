"use client";

// ===============================================================
// src/app/(standalone)/signup/page.tsx
//
// Vendor signup — ported faithfully from signup.html + signup.js
//
// Flow (matches production exactly):
// 1. Vendor fills form (businessName, email, telephone, whatsapp,
//    password, confirmPassword, agreeTerms)
// 2. Supabase auth.signUp creates auth user
// 3. Vendor row inserted into vendors table with:
//    - plan from localStorage (selectedPlan)
//    - billing from localStorage (billingType)
//    - referral partner resolved from referral_code in localStorage
//    - no trial: free signups start on the free On the Map plan (trial_started_at stays null)
//    - terms_accepted = true
// 4. Welcome email sent via Edge Function
// 5. Success message shown → vendor clicks "Log in" to continue
// ===============================================================

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createVendorRow, sendVendorWelcomeEmail, clearSignupStorage, PENDING_VENDOR_KEY } from "@/lib/createVendorRecord";
import { useIsMobile } from "@/lib/useIsMobile";
import { useIsLoggedInVendor } from "@/lib/useIsLoggedInVendor";
import { ONBOARDING_VIDEOS } from "@/lib/onboardingVideos";
import styles from "./signup.module.css";

export default function SignupPage() {
  const router = useRouter();
  // Someone already logged in with a vendor account does not need to sign up again.
  // (Checked once on arrival, so it never interrupts a signup in progress.)
  const alreadyVendor = useIsLoggedInVendor();
  useEffect(() => {
    if (alreadyVendor) router.replace("/vendordashboard");
  }, [alreadyVendor, router]);
  const isMobile = useIsMobile();
  const videoUrl = isMobile ? ONBOARDING_VIDEOS.fullWalkthrough.mobile : ONBOARDING_VIDEOS.fullWalkthrough.desktop;

  const [form, setForm] = useState({
    businessName: "",
    email: "",
    telephone: "",
    whatsapp: "+234",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
    heardAboutUs: "",
    heardAboutDetail: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<ReactNode>("");
  const errorRef = useRef<HTMLDivElement | null>(null);

  // Show the message right where the person just tapped "Create account",
  // so it is never hidden off-screen at the top on a phone.
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  // Exact wording for "already used" cases.
  function usedMessage(emailVendor: boolean, nameVendor: boolean, emailCustomer: boolean): ReactNode {
    const parts: ReactNode[] = [];
    if (emailVendor && nameVendor) {
      parts.push("This email address and this business name have both already been used to register a vendor account. Please log in instead, or use a different email address and business name.");
    } else if (emailVendor) {
      parts.push("This email address has already been used to register a vendor account. Please log in instead, or use a different email address.");
    } else if (nameVendor) {
      parts.push("This business name has already been used to register a vendor account. If it is your business, please log in. If not, please choose a different business name.");
    }
    if (emailCustomer && !emailVendor) {
      parts.push(
        nameVendor
          ? " This email address has also been used to register a customer account."
          : <span key="cust">
              This email address has already been used to register a customer account. To add your business to that account, log in with your customer password. Your details are saved, so you will not need to type them again.
              <a
                href="/login?setup=vendor"
                style={{ display: "block", marginTop: 8, fontWeight: 700 }}
                onClick={savePendingDetails}
              >
                Log in to add your business
              </a>
            </span>
      );
    }
    return parts.length === 0 ? null : <>{parts}</>;
  }

  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Keeps what the person typed so the login page can finish the registration.
  function savePendingDetails() {
    const { businessName, email, telephone, whatsapp, heardAboutUs, heardAboutDetail } = form;
    try {
      localStorage.setItem(PENDING_VENDOR_KEY, JSON.stringify({ businessName, email, telephone, whatsapp, heardAboutUs, heardAboutDetail }));
    } catch { /* ignore */ }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    if (name === "whatsapp") {
      // Normalize WhatsApp input to +234 format
      let v = value.replace(/[^\d+]/g, "");
      v = v.replace(/^\+2340+/, "+234");
      if (!v.startsWith("+234")) {
        v = v.replace(/^0+/, "").replace(/^234/, "");
        v = "+234" + v;
      }
      setForm(f => ({ ...f, whatsapp: v }));
      return;
    }
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { businessName, email, telephone, whatsapp, password, confirmPassword, agreeTerms, heardAboutUs, heardAboutDetail } = form;

    if (!agreeTerms) { setError("You must agree to the Terms, Privacy Policy, and Disclaimer."); return; }
    if (!businessName || !email || !telephone || !whatsapp || !password || !confirmPassword) {
      setError("All fields are required."); return;
    }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!heardAboutUs) { setError("Please tell us how you heard about Spotlight."); return; }

    const validWhatsapp = /^\+234\d{10}$/.test(whatsapp);
    if (!validWhatsapp) { setError("WhatsApp number must use valid Nigerian format (+234XXXXXXXXXX)."); return; }

    const selectedPlan = localStorage.getItem("selectedPlan");
    if (!selectedPlan) { setError("Please select a plan first."); router.push("/getlisted"); return; }

    setSubmitting(true);

    // 0. Check, before creating anything, whether the email or business name is already used.
    try {
      const { data: avail } = await supabase.rpc("check_signup_availability", { p_email: email, p_name: businessName });
      const a = (avail || {}) as { email_vendor?: boolean; name_vendor?: boolean; email_customer?: boolean };
      const anythingUsed = !!a.email_vendor || !!a.name_vendor || !!a.email_customer;
      if (anythingUsed) {
        setError(usedMessage(!!a.email_vendor, !!a.name_vendor, !!a.email_customer));
        setSubmitting(false);
        return;
      }
    } catch { /* if the check itself fails, the normal sign-up below still protects against duplicates */ }

    // 1. Create auth user
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: businessName },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (authError) {
      const used = /already registered/i.test(authError.message || "");
      setError(used ? usedMessage(true, false, false) : authError.message);
      setSubmitting(false);
      return;
    }

    const billingType = localStorage.getItem("billingType") || "monthly";
    const details = { businessName, email, telephone, whatsapp, heardAboutUs, heardAboutDetail };

    // 2. Create the vendor row (referral partner + source are resolved inside)
    const createErr = await createVendorRow(data.user!.id, details, selectedPlan, billingType);
    if (createErr) {
      const dup = /duplicate key|unique/i.test(createErr);
      const nameDup = dup && /name/i.test(createErr);
      const emailDup = dup && /email/i.test(createErr);
      setError(dup ? usedMessage(emailDup, nameDup || !emailDup, false) : createErr);
      setSubmitting(false);
      return;
    }

    // 3. Welcome email (non-fatal) and clean-up
    await sendVendorWelcomeEmail(details, selectedPlan);
    clearSignupStorage();

    setSubmitting(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className={styles.authWrapper}>
        <div className={styles.authCard}>
          <div className={styles.successBox}>
            <h2>Account Created!</h2>
            <p>Your vendor account has been created successfully. You can now log in to continue.</p>
            <a href="/login" className={styles.authBtn} style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              Log In Now
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>Create Vendor Account</h1>
        <p className={styles.authSubtitle}>Start managing your business on Spotlight</p>

        <div className={styles.safetyNotice}>
          <i className="fa-solid fa-shield-heart"></i>
          <div>
            <strong>Read this before you list</strong>
            Spotlight is a discovery platform — we don&apos;t oversee meetings, deliveries, or payments between
            you and customers. Meet safely, avoid taking full payment upfront, and never share your bank PIN or
            OTP with anyone. You may only list what&apos;s legal to sell and advertise in Nigeria. See our{" "}
            <a href="/safety" target="_blank" rel="noopener">full Safety Center</a> and{" "}
            <a href="/disclaimer" target="_blank" rel="noopener">restricted items list</a> for details.
          </div>
        </div>

        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.videoPrompt}
        >
          <span className={styles.videoIcon}><i className="fa-solid fa-circle-play"></i></span>
          <span className={styles.videoText}>
            <strong>New here? Watch how signup works</strong>
            <small>Full walkthrough on YouTube &middot; opens in a new tab</small>
          </span>
        </a>

        <p className={styles.requiredNote}><span className={styles.required}>*</span> Required</p>

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <div>
            <label htmlFor="businessName">Business name<span className={styles.required}>*</span></label>
            <input type="text" id="businessName" name="businessName" placeholder="Your business name" required value={form.businessName} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="email">Email address<span className={styles.required}>*</span></label>
            <input type="email" id="email" name="email" placeholder="you@business.com" required value={form.email} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="telephone">Telephone number<span className={styles.required}>*</span></label>
            <input type="tel" id="telephone" name="telephone" placeholder="+2348021234567" required value={form.telephone} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="whatsapp">WhatsApp number<span className={styles.required}>*</span></label>
            <input type="tel" id="whatsapp" name="whatsapp" placeholder="+2348021234567" required value={form.whatsapp} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="password">Password<span className={styles.required}>*</span></label>
            <div className={styles.passwordWrap}>
              <input type={showPassword ? "text" : "password"} id="password" name="password" placeholder="Create a password" required value={form.password} onChange={handleChange} />
              <button type="button" className={styles.togglePassword} onClick={() => setShowPassword(v => !v)}>👁</button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword">Confirm password<span className={styles.required}>*</span></label>
            <div className={styles.passwordWrap}>
              <input type={showConfirm ? "text" : "password"} id="confirmPassword" name="confirmPassword" placeholder="Repeat your password" required value={form.confirmPassword} onChange={handleChange} />
              <button type="button" className={styles.togglePassword} onClick={() => setShowConfirm(v => !v)}>👁</button>
            </div>
          </div>

          <div>
            <label htmlFor="heardAboutUs">How did you hear about Spotlight?<span className={styles.required}>*</span></label>
            <select id="heardAboutUs" name="heardAboutUs" required value={form.heardAboutUs} onChange={handleChange}>
              <option value="">Select one</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="linkedin">LinkedIn</option>
              <option value="google_search">Google search</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="friend_or_referral">A friend or referral</option>
              <option value="event_or_offline">Event, flyer or in person</option>
              <option value="other">Other</option>
            </select>
          </div>

          {(form.heardAboutUs === "friend_or_referral" || form.heardAboutUs === "event_or_offline" || form.heardAboutUs === "other") && (
            <div>
              <label htmlFor="heardAboutDetail">Referral code or name (optional)</label>
              <input type="text" id="heardAboutDetail" name="heardAboutDetail" placeholder="Who told you, or the code you were given" maxLength={100} value={form.heardAboutDetail} onChange={handleChange} />
            </div>
          )}

          <label className={styles.checkboxWrap}>
            <input type="checkbox" name="agreeTerms" checked={form.agreeTerms} onChange={handleChange} required />
            I agree to the <a href="/terms">Terms of Service</a>, <a href="/privacy">Privacy Policy</a>, and <a href="/disclaimer">Disclaimer</a> (including the Safety Guidelines and Restricted Items sections)
          </label>

          {error && <div ref={errorRef} className={styles.authError} role="alert" style={{ marginTop: 12, marginBottom: 12 }}>{error}</div>}

          <button type="submit" className={styles.authBtn} disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className={styles.authFooter}>
          Already have an account? <a href="/login">Log in</a>
        </div>
      </div>
    </div>
  );
}
