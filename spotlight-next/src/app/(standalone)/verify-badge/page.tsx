"use client";

// ===============================================================
// src/app/(standalone)/verify-badge/page.tsx
//
// Faithful port of production's verify-badge.html + verify-badge.js.
// Reached from VerificationTab's "Apply for Gray/Blue Badge"
// buttons, which set localStorage("pendingBadgeType") before
// redirecting here.
//
// Gray Badge requirements (corrected this session): 3 documents —
// Government ID (NIN), Utility Bill (business or residential
// address), and a Passport Photograph (Recent - within last 6
// months). "Passport Photograph" here is the standard Nigerian term
// for a formal ID-style headshot (as used on CVs, ID cards, forms),
// not a copy of an international travel passport — it is not
// redundant with the Government ID requirement. Blue Badge
// requirements: Government ID (NIN), CAC Certificate, Utility Bill
// (business address as per registration), MEMART, and CAC Status
// Report.
//
// Ported differences from the vanilla version:
// - DOM text-swapping (badgeTitle/badgeRequirements/hints/placeholder
//   per badge type) is replaced with a single BADGE_COPY lookup.
// - markRequired()'s imperative style-injection is replaced with a
//   fieldErrors state object; each field renders its own error
//   message when present.
// - File inputs stay uncontrolled (via refs) since React cannot
//   set input[type=file] values programmatically anyway — this
//   matches how file fields are handled everywhere else file
//   uploads occur in this codebase.
// - The confirmation email uses the same simplified inline-HTML
//   fetch() call already established in signup/page.tsx, rather
//   than porting the full email-templates.js template system.
// ===============================================================

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uploadVendorFile } from "@/lib/uploadVendorFile";
import { EmailTemplates } from "@/lib/emailTemplates";
import styles from "./verify-badge.module.css";

type BadgeType = "gray" | "blue";

const BADGE_COPY: Record<BadgeType, { title: string; requirements: string; namePlaceholder: string; utilityHint: string }> = {
  gray: {
    title: "Gray Badge Verification",
    requirements:
      "Gray badge builds trust. Requires Government ID (NIN), a Utility Bill (business or residential address), and a Passport Photograph (Recent - within the last 6 months).",
    namePlaceholder: "Name must match the Government ID (NIN)",
    utilityHint:
      "Upload a utility bill issued within the last 6 months, for either your business address or your residential address.",
  },
  blue: {
    title: "Blue Badge Verification",
    requirements:
      "Blue badge verifies registered businesses. Requires Government ID (NIN), CAC Certificate, Utility Bill (business address as per registration), MEMART and CAC Status Report.",
    namePlaceholder: "Name (must be a Director or Shareholder in the CAC registration)",
    utilityHint:
      "Upload a utility bill issued within the last 6 months. The address must match the operating (business) address used in your vendor listing.",
  },
};

// Matches the validate-upload Edge Function's "verification" category
// rule exactly (allowedTypes + maxBytes) — shown next to every file
// field so a vendor knows the constraint before picking a file,
// rather than finding out only after a failed upload.
const FILE_HINT = "Accepted formats: JPG, PNG or PDF. Just upload the photo as-is — it's resized automatically. PDF files: max 2MB.";

type FieldErrors = Partial<Record<
  "applicantName" | "phone" | "idFile" | "cacFile" | "utilityFile" | "memartFile" | "statusReportFile" | "passportFile",
  string
>>;

export default function VerifyBadgePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [badgeType, setBadgeType] = useState<BadgeType | null>(null);
  const [vendorId, setVendorId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [notFoundMsg, setNotFoundMsg] = useState<string>("");
  const [blocked, setBlocked] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [statusColor, setStatusColor] = useState<"neutral" | "error" | "success">("neutral");
  const [submitting, setSubmitting] = useState(false);

  const applicantNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const idNumberRef = useRef<HTMLInputElement>(null);
  const cacNumberRef = useRef<HTMLInputElement>(null);
  const idFileRef = useRef<HTMLInputElement>(null);
  const cacFileRef = useRef<HTMLInputElement>(null);
  const utilityFileRef = useRef<HTMLInputElement>(null);
  const memartFileRef = useRef<HTMLInputElement>(null);
  const statusReportFileRef = useRef<HTMLInputElement>(null);
  const passportFileRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  // Filenames shown next to each gold "Choose File" button, purely
  // cosmetic — the actual files are still read from the refs above
  // on submit, uncontrolled, exactly as before.
  const [fileNames, setFileNames] = useState<Partial<Record<keyof FieldErrors, string>>>({});

  function handleFileChosen(field: keyof FieldErrors, e: ChangeEvent<HTMLInputElement>) {
    setFileNames((prev) => ({ ...prev, [field]: e.target.files?.[0]?.name || "" }));
  }

  useEffect(() => {
    const pending = localStorage.getItem("pendingBadgeType");
    if (pending !== "gray" && pending !== "blue") {
      router.replace("/vendordashboard");
      return;
    }
    setBadgeType(pending);

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data: vendorRow, error: vendorLookupError } = await supabase
        .from("vendors")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (vendorLookupError || !vendorRow) {
        setNotFoundMsg("Vendor record not found.");
        setLoading(false);
        return;
      }

      setVendorId(vendorRow.id);

      const { data: existingPending } = await supabase
        .from("vendor_verifications")
        .select("id, badge_type")
        .eq("vendor_id", vendorRow.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingPending) {
        setBlocked(true);
        setStatusMsg(
          `You already have a pending ${existingPending.badge_type} badge verification under review. Please wait for the admin to complete the review before submitting again.`
        );
        setStatusColor("error");
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || blocked || !badgeType) return;

    if (!consentRef.current?.checked) {
      setStatusMsg("You must accept the consent terms before submitting.");
      setStatusColor("error");
      return;
    }

    const applicantName = applicantNameRef.current?.value.trim() || "";
    const phone = phoneRef.current?.value.trim() || "";
    const idNumber = badgeType === "gray" ? idNumberRef.current?.value.trim() || "" : null;
    const cacNumber = badgeType === "blue" ? cacNumberRef.current?.value.trim() || "" : null;

    const idFile = idFileRef.current?.files?.[0] ?? null;
    const cacFile = cacFileRef.current?.files?.[0] ?? null;
    const utilityFile = utilityFileRef.current?.files?.[0] ?? null;
    const memartFile = memartFileRef.current?.files?.[0] ?? null;
    const statusReportFile = statusReportFileRef.current?.files?.[0] ?? null;
    const passportFile = passportFileRef.current?.files?.[0] ?? null;

    const newErrors: FieldErrors = {};

    if (!applicantName) newErrors.applicantName = "Full name is required";
    if (!phone) newErrors.phone = "Phone number is required";
    if (!idFile) newErrors.idFile = "Government ID (NIN) is required";

    if (badgeType === "gray") {
      if (!utilityFile) newErrors.utilityFile = "Utility Bill is required";
      if (!passportFile) newErrors.passportFile = "Passport Photograph is required";
    }

    if (badgeType === "blue") {
      if (!cacFile) newErrors.cacFile = "CAC Certificate is required";
      if (!utilityFile) newErrors.utilityFile = "Utility Bill is required";
      if (!memartFile) newErrors.memartFile = "MEMART is required";
      if (!statusReportFile) newErrors.statusReportFile = "CAC Status Report is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setStatusMsg("Please fill in all required fields before submitting.");
      setStatusColor("error");
      return;
    }

    setFieldErrors({});
    setStatusMsg("Uploading documents...");
    setStatusColor("neutral");
    setSubmitting(true);

    try {
      const upload = async (file: File | null) => (file ? (await uploadVendorFile(file, "verification")).path : null);

      const idUrl = await upload(idFile);
      const cacUrl = await upload(cacFile);
      const utilityUrl = await upload(utilityFile);
      const memartUrl = await upload(memartFile);
      const statusReportUrl = await upload(statusReportFile);
      const passportUrl = await upload(passportFile);

      const { error } = await supabase.from("vendor_verifications").insert({
        vendor_id: vendorId,
        badge_type: badgeType,
        applicant_name: applicantName,
        phone,
        email,
        id_number: idNumber,
        cac_number: cacNumber,
        id_url: idUrl,
        cac_url: cacUrl,
        utility_url: utilityUrl,
        memart_url: memartUrl,
        status_report_url: statusReportUrl,
        passport_photo_url: passportUrl,
        status: "pending",
        consent_accepted: true,
        consent_accepted_at: new Date().toISOString(),
        consent_text_version: "v1",
      });

      if (error) throw error;

      try {
        await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: "Verification Documents Received",
            html: EmailTemplates.badgeSubmitted({ vendorName: applicantName, badgeType }),
          }),
        });
      } catch (err) {
        console.error("Badge submission email failed:", err);
      }

      setStatusMsg("Verification submitted successfully. Await admin review.");
      setStatusColor("success");
      localStorage.removeItem("pendingBadgeType");

      setTimeout(() => {
        router.replace("/vendordashboard");
      }, 1500);
    } catch (err) {
      console.error("Verification error:", err);
      // Show the real reason when we have one (e.g. "File exceeds the
      // 300KB limit for this upload type.") instead of a generic
      // message — a vendor can't fix what they can't see.
      const message = err instanceof Error && err.message ? err.message : "Upload failed. Please try again.";
      setStatusMsg(message);
      setStatusColor("error");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>
      </div>
    );
  }

  const copy = badgeType ? BADGE_COPY[badgeType] : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/spotlightlogo-512.png" alt="Spotlight" className={styles.logo} />
          <span className={styles.brandText}>Spotlight</span>
        </a>

        <nav className={styles.headerLinks}>
          <a href="/vendordashboard">Dashboard</a>
          <a href="/contact-us">Contact Us</a>
        </nav>
      </header>

      <main className={styles.main}>
        {notFoundMsg ? (
          <p className={`${styles.verifyMsg} ${styles.verifyMsgError}`}>{notFoundMsg}</p>
        ) : (
          <>
            <h2>{copy?.title || "Badge Verification"}</h2>
            <p className={styles.subtext}>{copy?.requirements}</p>

            <form className={`${styles.form} ${blocked ? styles.blocked : ""}`} onSubmit={handleSubmit}>
              <div className={`${styles.formGroup} ${fieldErrors.applicantName ? styles.fieldError : ""}`}>
                <label htmlFor="applicantName">Contact Person *</label>
                <input
                  type="text"
                  id="applicantName"
                  ref={applicantNameRef}
                  placeholder={copy?.namePlaceholder}
                />
                {fieldErrors.applicantName && <p className={styles.fieldErrorMsg}>{fieldErrors.applicantName}</p>}
              </div>

              <div className={`${styles.formGroup} ${fieldErrors.phone ? styles.fieldError : ""}`}>
                <label htmlFor="phone">Phone Number *</label>
                <input type="tel" id="phone" ref={phoneRef} placeholder="Enter active contact number" />
                {fieldErrors.phone && <p className={styles.fieldErrorMsg}>{fieldErrors.phone}</p>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email">Email Address *</label>
                <input type="email" id="email" value={email} readOnly placeholder="Vendor account email" />
              </div>

              {badgeType === "gray" && (
                <div className={styles.formGroup}>
                  <label htmlFor="idNumber">NIN (National Identification Number) *</label>
                  <input
                    type="text"
                    id="idNumber"
                    ref={idNumberRef}
                    placeholder="11-digit National Identification Number"
                  />
                </div>
              )}

              {badgeType === "blue" && (
                <div className={styles.formGroup}>
                  <label htmlFor="cacNumber">CAC Registration Number *</label>
                  <input
                    type="text"
                    id="cacNumber"
                    ref={cacNumberRef}
                    placeholder="Enter CAC registration number"
                  />
                </div>
              )}

              <div className={`${styles.formGroup} ${fieldErrors.idFile ? styles.fieldError : ""}`}>
                <label htmlFor="idFile">Government ID (NIN) *</label>
                <small>{FILE_HINT}</small>
                <div className={styles.fileRow}>
                  <label htmlFor="idFile" className={styles.chooseFileBtn}>
                    Choose File
                  </label>
                  <input type="file" id="idFile" ref={idFileRef} onChange={(e) => handleFileChosen("idFile", e)} />
                  <span className={styles.fileName}>{fileNames.idFile || "No file chosen"}</span>
                </div>
                {fieldErrors.idFile && <p className={styles.fieldErrorMsg}>{fieldErrors.idFile}</p>}
              </div>

              {badgeType === "blue" && (
                <div className={`${styles.formGroup} ${fieldErrors.cacFile ? styles.fieldError : ""}`}>
                  <label htmlFor="cacFile">CAC Certificate *</label>
                  <small>{FILE_HINT}</small>
                  <div className={styles.fileRow}>
                    <label htmlFor="cacFile" className={styles.chooseFileBtn}>
                      Choose File
                    </label>
                    <input type="file" id="cacFile" ref={cacFileRef} onChange={(e) => handleFileChosen("cacFile", e)} />
                    <span className={styles.fileName}>{fileNames.cacFile || "No file chosen"}</span>
                  </div>
                  {fieldErrors.cacFile && <p className={styles.fieldErrorMsg}>{fieldErrors.cacFile}</p>}
                </div>
              )}

              <div className={`${styles.formGroup} ${fieldErrors.utilityFile ? styles.fieldError : ""}`}>
                <label htmlFor="utilityFile">Utility Bill *</label>
                <small>{copy?.utilityHint}</small>
                <small>{FILE_HINT}</small>
                <div className={styles.fileRow}>
                  <label htmlFor="utilityFile" className={styles.chooseFileBtn}>
                    Choose File
                  </label>
                  <input
                    type="file"
                    id="utilityFile"
                    ref={utilityFileRef}
                    onChange={(e) => handleFileChosen("utilityFile", e)}
                  />
                  <span className={styles.fileName}>{fileNames.utilityFile || "No file chosen"}</span>
                </div>
                {fieldErrors.utilityFile && <p className={styles.fieldErrorMsg}>{fieldErrors.utilityFile}</p>}
              </div>

              {badgeType === "gray" && (
                <div className={`${styles.formGroup} ${fieldErrors.passportFile ? styles.fieldError : ""}`}>
                  <label htmlFor="passportFile">Passport Photograph (Recent - within last 6 months) *</label>
                  <small>{FILE_HINT}</small>
                  <div className={styles.fileRow}>
                    <label htmlFor="passportFile" className={styles.chooseFileBtn}>
                      Choose File
                    </label>
                    <input
                      type="file"
                      id="passportFile"
                      ref={passportFileRef}
                      onChange={(e) => handleFileChosen("passportFile", e)}
                    />
                    <span className={styles.fileName}>{fileNames.passportFile || "No file chosen"}</span>
                  </div>
                  {fieldErrors.passportFile && <p className={styles.fieldErrorMsg}>{fieldErrors.passportFile}</p>}
                </div>
              )}

              {badgeType === "blue" && (
                <div className={`${styles.formGroup} ${fieldErrors.memartFile ? styles.fieldError : ""}`}>
                  <label htmlFor="memartFile">MEMART (Memorandum &amp; Articles of Association) *</label>
                  <small>{FILE_HINT}</small>
                  <div className={styles.fileRow}>
                    <label htmlFor="memartFile" className={styles.chooseFileBtn}>
                      Choose File
                    </label>
                    <input
                      type="file"
                      id="memartFile"
                      ref={memartFileRef}
                      onChange={(e) => handleFileChosen("memartFile", e)}
                    />
                    <span className={styles.fileName}>{fileNames.memartFile || "No file chosen"}</span>
                  </div>
                  {fieldErrors.memartFile && <p className={styles.fieldErrorMsg}>{fieldErrors.memartFile}</p>}
                </div>
              )}

              {badgeType === "blue" && (
                <div className={`${styles.formGroup} ${fieldErrors.statusReportFile ? styles.fieldError : ""}`}>
                  <label htmlFor="statusReportFile">CAC Status Report *</label>
                  <small>{FILE_HINT}</small>
                  <div className={styles.fileRow}>
                    <label htmlFor="statusReportFile" className={styles.chooseFileBtn}>
                      Choose File
                    </label>
                    <input
                      type="file"
                      id="statusReportFile"
                      ref={statusReportFileRef}
                      onChange={(e) => handleFileChosen("statusReportFile", e)}
                    />
                    <span className={styles.fileName}>{fileNames.statusReportFile || "No file chosen"}</span>
                  </div>
                  {fieldErrors.statusReportFile && (
                    <p className={styles.fieldErrorMsg}>{fieldErrors.statusReportFile}</p>
                  )}
                </div>
              )}

              <label className={styles.consentWrap}>
                <input type="checkbox" ref={consentRef} required />
                I confirm that the submitted documents are valid and belong to me or my business. I consent to
                Spotlight reviewing these documents for verification, trust, fraud prevention, and compliance
                purposes. Where legally required, information may be disclosed to relevant authorities.
              </label>

              <button type="submit" className={styles.submitBtn} disabled={submitting || blocked}>
                {submitting ? "Uploading..." : "Submit Verification"}
              </button>
            </form>

            {statusMsg && (
              <p
                className={`${styles.verifyMsg} ${
                  statusColor === "error" ? styles.verifyMsgError : statusColor === "success" ? styles.verifyMsgSuccess : ""
                }`}
              >
                {statusMsg}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
