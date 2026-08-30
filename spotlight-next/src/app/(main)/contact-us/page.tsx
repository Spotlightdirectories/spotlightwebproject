"use client";

import type { Metadata } from "next";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Footer from "@/components/Footer";
import styles from "./contact.module.css";

const NIGERIAN_STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", state: "", message: "", consent: false });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consent) { setError("Please agree to the Privacy Policy."); return; }
    setSubmitting(true);
    setError("");
    const { error: dbError } = await supabase.from("contact_messages").insert({
      name: form.name, email: form.email, phone: form.phone,
      state: form.state, message: form.message,
    });
    setSubmitting(false);
    if (dbError) { setError("Something went wrong. Please try again."); return; }
    setSuccess(true);
    setForm({ name: "", email: "", phone: "", state: "", message: "", consent: false });
  }

  return (
    <>
      <main>
        {/* HERO */}
        <section className={styles.hero}>
          <h1>Contact Spotlight</h1>
          <p>Need help or have a question? Our team is happy to assist you. Send us a message or reach us faster via WhatsApp.</p>
          <a href="https://wa.me/2349012085744" className={styles.whatsappBtn}>Chat with us on WhatsApp</a>
        </section>

        {/* MAIN */}
        <section className={styles.contactMain}>
          <div className={styles.contactImage}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Contactus.png" alt="Contact Spotlight Directories" />
          </div>

          <div className={styles.formArea}>
            <h2>Send us a message</h2>
            {success ? (
              <div className={styles.successMsg}>✅ Message sent! We'll respond within a few hours.</div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && <p className={styles.errorMsg}>{error}</p>}
                <label htmlFor="name">Your Name</label>
                <input id="name" name="name" type="text" placeholder="Your name" required value={form.name} onChange={handleChange} />

                <label htmlFor="email">Your email address</label>
                <input id="email" name="email" type="email" placeholder="Your email address" required value={form.email} onChange={handleChange} />

                <label htmlFor="phone">WhatsApp Number (preferred contact)</label>
                <input id="phone" name="phone" type="tel" placeholder="e.g. 08012345678" required value={form.phone} onChange={handleChange} />

                <label htmlFor="state">Your State</label>
                <select id="state" name="state" required value={form.state} onChange={handleChange}>
                  <option value="">Select State</option>
                  {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
                </select>

                <label htmlFor="message">Message</label>
                <textarea id="message" name="message" rows={4} required value={form.message} onChange={handleChange} />

                <label className={styles.privacyConsent}>
                  <input type="checkbox" name="consent" checked={form.consent} onChange={handleChange} required />
                  I agree to the <a href="/privacy">Privacy Policy</a> and understand my information will only be used to respond to my enquiry.
                </label>

                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? "Sending..." : "Send Message"}
                </button>

                <p className={styles.responseNote}>We usually respond within a few hours.</p>
                <p className={styles.warningNote}>⚠️ We will never request sensitive details such as your password, bank details, NIN, or BVN.</p>
              </form>
            )}
          </div>
        </section>

        {/* DEAR SPOTLIGHTERS */}
        <section className={styles.spotlighters}>
          <div className={styles.spotLeft}>
            <h2>Dear Spotlighters</h2>
            <p>Whether you're ready to get listed or still have a few questions, we'd love to hear from you. Our team is here to help you shine online — <strong>no tech skills or website needed.</strong></p>
            <h3>We are online Monday–Saturday, 9am–6pm</h3>
            <p>Not sure what to do or which package to choose? Let's review your business together so you can make an informed decision.</p>
          </div>
          <div className={styles.spotRight}>
            <p><i className="fa-solid fa-envelope"></i> <a href="mailto:support@spotlightdirectories.com">support@spotlightdirectories.com</a></p>
            <p><i className="fa-brands fa-whatsapp"></i> <a href="https://wa.me/2349012085744">WhatsApp Only: 0901-208-5744</a></p>
            <p><i className="fa-solid fa-globe"></i> <a href="https://www.spotlightdirectories.com">www.spotlightdirectories.com</a></p>
            <p><i className="fa-solid fa-location-dot"></i> 3 Alafia Lane, Shomolu, Lagos</p>
            <div className={styles.socialIcons}>
              <a href="https://web.facebook.com/profile.php?id=61588123081014" target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-facebook-f"></i></a>
              <a href="https://www.instagram.com/spotlight_directories" target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-instagram"></i></a>
              <a href="https://www.linkedin.com/in/spotlightdirectories-5518813b0/" target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-linkedin-in"></i></a>
              <a href="https://www.tiktok.com/@spotlight_directories" target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-tiktok"></i></a>
              <a href="https://www.youtube.com/@spotlightdirectories" target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-youtube"></i></a>
            </div>
          </div>

          {/* Step 5 sketch 2, 2026-08-23 per Cyril: a third column,
              to the right of contact details, linking to Why
              Spotlight/FAQ/Feedback. "Contact Us" is deliberately not
              included here -- a page never needs to link to itself. */}
          <div className={styles.spotExtra}>
            <h3>You might also need</h3>
            <a href="/aboutUs"><i className="fa-solid fa-circle-info"></i> Why Spotlight?</a>
            <a href="/FAQ"><i className="fa-solid fa-circle-question"></i> FAQ</a>
            <a href="/feedback"><i className="fa-solid fa-comment-dots"></i> Feedback</a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
