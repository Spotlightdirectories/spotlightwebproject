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
//    - trial_started_at set for free plans
//    - terms_accepted = true
// 4. Welcome email sent via Edge Function
// 5. Success message shown → vendor clicks "Log in" to continue
// ===============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./signup.module.css";

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    businessName: "",
    email: "",
    telephone: "",
    whatsapp: "+234",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
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

    const { businessName, email, telephone, whatsapp, password, confirmPassword, agreeTerms } = form;

    if (!agreeTerms) { setError("You must agree to the Terms, Privacy Policy, and Disclaimer."); return; }
    if (!businessName || !email || !telephone || !whatsapp || !password || !confirmPassword) {
      setError("All fields are required."); return;
    }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    const validWhatsapp = /^\+234\d{10}$/.test(whatsapp);
    if (!validWhatsapp) { setError("WhatsApp number must use valid Nigerian format (+234XXXXXXXXXX)."); return; }

    const selectedPlan = localStorage.getItem("selectedPlan");
    if (!selectedPlan) { setError("Please select a plan first."); router.push("/getlisted"); return; }

    setSubmitting(true);

    // 1. Create auth user
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: businessName },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (authError) { setError(authError.message); setSubmitting(false); return; }

    const billingType = localStorage.getItem("billingType") || "monthly";

    // 2. Resolve referral code → partner ID
    let partnerId: string | null = null;
    const storedReferral = localStorage.getItem("referral_code")?.trim().toUpperCase();
    if (storedReferral) {
      const { data: partners } = await supabase.from("partners").select("id, referral_code");
      if (partners) {
        const match = partners.find(p => p.referral_code?.trim().toUpperCase() === storedReferral);
        if (match) partnerId = match.id;
      }
    }

    // 3. Insert vendor row
    const { error: vendorError } = await supabase.from("vendors").insert([{
      auth_user_id: data.user!.id,
      name: businessName,
      email,
      telephone,
      whatsapp,
      referred_by_partner_id: partnerId,
      plan_tier: selectedPlan,
      billing_cycle: billingType,
      subscription_status: selectedPlan === "free" ? "free" : "pending",
      trial_started_at: selectedPlan === "free" ? new Date().toISOString() : null,
      is_premium: selectedPlan !== "free",
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
    }]);

    if (vendorError) { setError(vendorError.message); setSubmitting(false); return; }

    // 4. Send welcome email (non-fatal)
    try {
      await fetch(
        "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: "Welcome to Spotlight Directories",
            html: `<p>Hi ${businessName}, welcome to Spotlight Directories! Your account is ready.</p>`,
          }),
        }
      );
    } catch { /* non-fatal */ }

    // 5. Clear localStorage
    localStorage.removeItem("selectedPlan");
    localStorage.removeItem("billingType");
    localStorage.removeItem("referral_code");

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

        {error && <div className={styles.authError}>{error}</div>}

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <div>
            <label htmlFor="businessName">Business name</label>
            <input type="text" id="businessName" name="businessName" placeholder="Your business name" required value={form.businessName} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="email">Email address</label>
            <input type="email" id="email" name="email" placeholder="you@business.com" required value={form.email} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="telephone">Telephone number</label>
            <input type="tel" id="telephone" name="telephone" placeholder="+2348021234567" required value={form.telephone} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="whatsapp">WhatsApp number</label>
            <input type="tel" id="whatsapp" name="whatsapp" placeholder="+2348021234567" required value={form.whatsapp} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordWrap}>
              <input type={showPassword ? "text" : "password"} id="password" name="password" placeholder="Create a password" required value={form.password} onChange={handleChange} />
              <button type="button" className={styles.togglePassword} onClick={() => setShowPassword(v => !v)}>👁</button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword">Confirm password</label>
            <div className={styles.passwordWrap}>
              <input type={showConfirm ? "text" : "password"} id="confirmPassword" name="confirmPassword" placeholder="Repeat your password" required value={form.confirmPassword} onChange={handleChange} />
              <button type="button" className={styles.togglePassword} onClick={() => setShowConfirm(v => !v)}>👁</button>
            </div>
          </div>

          <label className={styles.checkboxWrap}>
            <input type="checkbox" name="agreeTerms" checked={form.agreeTerms} onChange={handleChange} required />
            I agree to the <a href="/terms">Terms of Service</a>, <a href="/privacy">Privacy Policy</a>, and <a href="/disclaimer">Disclaimer</a>
          </label>

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
