"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Footer from "@/components/Footer";
import styles from "./feedback.module.css";

// Feedback categories that make sense for each kind of person.
// Picking who you are first shows only the choices that apply to you.
const COMMON_END = ["Suggestion for improvement", "Compliment / praise", "Others"];
const CATEGORIES_BY_ROLE: Record<string, string[]> = {
  Customer: [
    "Can't find what I'm looking for",
    "Wrong or outdated business information",
    "Report a Vendor",
    "Review or rating problem",
    "Quote or visit request problem",
    "Account or login problem",
    "Location or map accuracy",
    ...COMMON_END,
  ],
  Vendor: [
    "Difficulty with listing",
    "Payment / subscription issues",
    "Verification badge",
    "Sponsorship",
    "Insight dashboard or reports",
    "Quote or visit requests I received",
    "A review on my business",
    "Location or map accuracy",
    "Report a Partner",
    "Account or login problem",
    ...COMMON_END,
  ],
  Partner: [
    "Commission or payout question",
    "Referral link or code problem",
    "Partner dashboard problem",
    "Marketing materials or training",
    "Report a Vendor",
    "Account or login problem",
    ...COMMON_END,
  ],
  Other: [
    "General question",
    "Partnership or collaboration",
    "Media or press",
    "Report a problem on the website or app",
    ...COMMON_END,
  ],
};

export default function FeedbackPage() {
  const [form, setForm] = useState({
    contact: "", role: "", category: "", message: "", rating: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    // Changing who you are clears the category, since its choices change.
    setForm(f => (name === "role" ? { ...f, role: value, category: "" } : { ...f, [name]: value }));
  }

  function handleClear() {
    setForm({ contact: "", role: "", category: "", message: "", rating: "" });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contact.trim() || !form.message.trim()) {
      setError("Please fill in your contact and feedback message.");
      return;
    }
    setSubmitting(true);
    setError("");
    const { error: dbError } = await supabase.from("feedback").insert({
      contact: form.contact,
      role: form.role || null,
      category: form.category || null,
      message: form.message,
      rating: form.rating ? Number(form.rating) : null,
    });
    setSubmitting(false);
    if (dbError) { setError("Something went wrong. Please try again."); return; }
    setSuccess(true);
    handleClear();
  }

  return (
    <>
      <main>
        <section className={styles.pageContainer}>
          <div className={styles.pageHeader}>
            <h1>Share Your Feedback</h1>
            <p>Your thoughts help us build a better platform for every Nigerian business. Whether it's a suggestion, a report, or a compliment — we genuinely want to hear from you.</p>
            <p className={styles.directContact}>
              Prefer to reach us directly?{" "}
              <a href="https://wa.me/2349012085744">WhatsApp us</a> or email{" "}
              <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a>
            </p>
          </div>

          {success ? (
            <div className={styles.successMsg}>✅ Thank you! Your feedback has been received.</div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.feedbackForm}>
              {error && <p className={styles.errorMsg}>{error}</p>}

              <div>
                <label htmlFor="contact">Email or WhatsApp</label>
                <input type="text" id="contact" name="contact" placeholder="email@example.com or +2348012345678" required value={form.contact} onChange={handleChange} />
              </div>

              <div className={styles.row}>
                <div>
                  <label htmlFor="role">Who are you?</label>
                  <select id="role" name="role" value={form.role} onChange={handleChange}>
                    <option value="">-- Choose --</option>
                    <option value="Customer">Customer</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Partner">Partner</option>
                    <option value="Other">Others</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="category">Category of Feedback</label>
                  <select id="category" name="category" value={form.category} onChange={handleChange} disabled={!form.role}>
                    <option value="">{form.role ? "-- Choose --" : "-- Choose who you are first --"}</option>
                    {(CATEGORIES_BY_ROLE[form.role] || []).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="message">Your Feedback</label>
                <textarea id="message" name="message" placeholder="Type your feedback here…" required value={form.message} onChange={handleChange} />
              </div>

              <div className={styles.row}>
                <div>
                  <label htmlFor="rating">Rating (optional)</label>
                  <select id="rating" name="rating" value={form.rating} onChange={handleChange}>
                    <option value="">-- Choose --</option>
                    <option value="1">1 - Very Poor</option>
                    <option value="2">2 - Poor</option>
                    <option value="3">3 - Okay</option>
                    <option value="4">4 - Good</option>
                    <option value="5">5 - Excellent</option>
                  </select>
                </div>
              </div>

              <p className={styles.consentNote}>By submitting you agree we may contact you to follow up.</p>

              <div className={styles.actions}>
                <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                  {submitting ? "Sending..." : "Send Feedback"}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={handleClear}>Clear</button>
              </div>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
