"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/SettingsTab.tsx
//
// Vendor Dashboard — MODULE 5: Settings.
//
// Faithful port of the #settings section in production
// vendordashboard.html + the "SETTINGS" blocks in vendordashboard.js
// (Account Settings email-change flow, Danger Zone close/restore
// account) — both already fully functional in production.
//
// The Notification Preferences card is NOT a port: in production
// it's decorative dead UI (hardcoded `checked`, no id, zero JS
// touching it). This build wires it to two real columns added to
// `vendors` this session (email_notifications_enabled,
// lead_alerts_enabled, both defaulting to true — matching the
// previous hardcoded state) so the toggles actually persist and
// actually gate the notify-lead Edge Function + the weekly
// send-weekly-performance-reports cron job.
// ===============================================================

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Vendor } from "./page";

type Props = {
  vendor: Vendor;
  onVendorUpdate: (patch: Partial<Vendor>) => void;
};

export default function SettingsTab({ vendor, onVendorUpdate }: Props) {
  // ---------------------------------------------------------------
  // ACCOUNT SETTINGS — change email (2-step OTP flow)
  // ---------------------------------------------------------------
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [emailStep, setEmailStep] = useState<1 | 2>(1);
  const [emailStatus, setEmailStatus] = useState<{ text: string; color: "error" | "success" } | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);

  const newEmailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  function resetEmailChangeForm() {
    setShowChangeEmail(false);
    setEmailStep(1);
    setEmailStatus(null);
    if (newEmailRef.current) newEmailRef.current.value = "";
    if (otpRef.current) otpRef.current.value = "";
  }

  async function handleSendCode() {
    const newEmail = (newEmailRef.current?.value || "").trim();

    if (!newEmail) {
      setEmailStatus({ text: "Please enter a new email address.", color: "error" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailStatus({ text: "Please enter a valid email address.", color: "error" });
      return;
    }

    if (newEmail.toLowerCase() === (vendor.email || "").toLowerCase()) {
      setEmailStatus({ text: "This is already your current email address.", color: "error" });
      return;
    }

    setSendingCode(true);
    setEmailStatus(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("You must be logged in to change your email.");
      }

      // Deliberately a raw fetch() here, not supabase.functions.invoke() —
      // invoke() swallows the Edge Function's actual JSON body on a
      // non-2xx status (e.g. "This email is already in use by another
      // account"), only surfacing a generic "Edge Function returned a
      // non-2xx status code". Same fix already applied to
      // uploadVendorFile.ts for the same reason.
      const response = await fetch(
        "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/request-email-change",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ newEmail }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to send verification codes.");
      }

      setEmailStatus({ text: `✓ Code sent to ${newEmail}. Enter it below to confirm.`, color: "success" });
      setEmailStep(2);
    } catch (err) {
      console.error("Email change request error:", err);
      setEmailStatus({
        text: err instanceof Error ? err.message : "Unable to send verification codes. Please try again.",
        color: "error",
      });
    } finally {
      setSendingCode(false);
    }
  }

  async function handleConfirmCode() {
    const otp = (otpRef.current?.value || "").trim();

    if (!otp) {
      setEmailStatus({ text: "Please enter the code.", color: "error" });
      return;
    }

    setConfirmingCode(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("You must be logged in to change your email.");
      }

      // Same reason as handleSendCode: raw fetch() to see the real error
      // body (wrong/expired code, etc.) instead of invoke()'s generic
      // non-2xx message.
      const response = await fetch(
        "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/confirm-email-change",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ otp }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to confirm email change.");
      }

      setEmailStatus({ text: `✓ Your email has been changed to ${data.newEmail}.`, color: "success" });
      onVendorUpdate({ email: data.newEmail });

      setTimeout(resetEmailChangeForm, 2500);
    } catch (err) {
      console.error("Email change confirm error:", err);
      setEmailStatus({
        text: err instanceof Error ? err.message : "Unable to confirm email change. Please try again.",
        color: "error",
      });
    } finally {
      setConfirmingCode(false);
    }
  }

  // ---------------------------------------------------------------
  // NOTIFICATION PREFERENCES — real toggles
  // ---------------------------------------------------------------
  const [emailNotifSaving, setEmailNotifSaving] = useState(false);
  const [leadAlertsSaving, setLeadAlertsSaving] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  function describeError(error: { message?: string; details?: string; hint?: string; code?: string } | null): string {
    if (!error) return "Unknown error.";
    const parts = [error.message, error.details, error.hint, error.code ? `(code ${error.code})` : null].filter(Boolean);
    return parts.length ? parts.join(" — ") : JSON.stringify(error);
  }

  async function toggleEmailNotifications(checked: boolean) {
    setEmailNotifSaving(true);
    setNotifError(null);
    const { error } = await supabase
      .from("vendors")
      .update({ email_notifications_enabled: checked })
      .eq("id", vendor.id);
    setEmailNotifSaving(false);

    if (error) {
      const message = describeError(error);
      console.error("Unable to update email notifications preference:", message, error);
      setNotifError(message);
      return;
    }
    onVendorUpdate({ email_notifications_enabled: checked });
  }

  async function toggleLeadAlerts(checked: boolean) {
    setLeadAlertsSaving(true);
    setNotifError(null);
    const { error } = await supabase
      .from("vendors")
      .update({ lead_alerts_enabled: checked })
      .eq("id", vendor.id);
    setLeadAlertsSaving(false);

    if (error) {
      const message = describeError(error);
      console.error("Unable to update lead alerts preference:", message, error);
      setNotifError(message);
      return;
    }
    onVendorUpdate({ lead_alerts_enabled: checked });
  }

  // ---------------------------------------------------------------
  // DANGER ZONE — close / restore account
  // ---------------------------------------------------------------
  const [closing, setClosing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const isClosing = vendor.account_status === "closing";
  const deletionDate = vendor.scheduled_deletion_at ? new Date(vendor.scheduled_deletion_at) : null;

  async function handleCloseAccount() {
    const confirmed = window.confirm(
      `Are you sure you want to close your account?\n\nYour profile will be removed immediately and permanently deleted after 14 days.\n\nClosing your account does NOT cancel or refund any active subscription. All payments are final.`
    );
    if (!confirmed) return;

    setClosing(true);

    const scheduledDeletionAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("vendors")
      .update({ account_status: "closing", scheduled_deletion_at: scheduledDeletionAt })
      .eq("id", vendor.id);

    setClosing(false);

    if (error) {
      window.alert("Unable to schedule account closure.");
      console.error(error);
      return;
    }

    window.alert("Your account closure has been scheduled. You may restore your account within 14 days.");
    onVendorUpdate({ account_status: "closing", scheduled_deletion_at: scheduledDeletionAt });
  }

  async function handleRestoreAccount() {
    const confirmed = window.confirm("Restore your vendor account?");
    if (!confirmed) return;

    setRestoring(true);

    const { error } = await supabase
      .from("vendors")
      .update({ account_status: "active", scheduled_deletion_at: null })
      .eq("id", vendor.id);

    setRestoring(false);

    if (error) {
      window.alert("Unable to restore account.");
      console.error(error);
      return;
    }

    window.alert("Your account has been restored.");
    onVendorUpdate({ account_status: "active", scheduled_deletion_at: null });
  }

  return (
    <div className="vd-settings-layout">
      {/* ACCOUNT SETTINGS */}
      <div className="vd-card vd-settings-card">
        <div className="vd-settings-card-header">
          <h3>Account Settings</h3>
        </div>

        <div className="vd-settings-content">
          <div className="vd-setting-row vd-setting-row-col">
            <div>
              <h4>Email Address</h4>
              <p className="vd-settings-email-display">{vendor.email || "—"}</p>
              <p className="vd-settings-email-note">
                We&apos;ll send a verification code to your new email address. Enter the code to confirm the change.
              </p>
            </div>

            <button
              type="button"
              className="vd-secondary-outline-btn"
              style={{ marginTop: 8, alignSelf: "flex-start" }}
              onClick={() => {
                setShowChangeEmail((v) => !v);
                setEmailStatus(null);
              }}
            >
              Change Email
            </button>

            {showChangeEmail && (
              <div className="vd-inline-editor active" style={{ width: "100%", marginTop: 12 }}>
                {emailStep === 1 && (
                  <div>
                    <input
                      type="email"
                      ref={newEmailRef}
                      className="vd-input"
                      placeholder="Enter new email address"
                      style={{ marginBottom: 10 }}
                    />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        className="vd-primary-btn"
                        disabled={sendingCode}
                        onClick={handleSendCode}
                      >
                        {sendingCode ? "Sending..." : "Send Verification Codes"}
                      </button>
                      <button type="button" className="vd-secondary-outline-btn" onClick={resetEmailChangeForm}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {emailStep === 2 && (
                  <div style={{ marginTop: 14 }}>
                    <p className="vd-settings-email-note">
                      Enter the code sent to your new email address. It expires in 15 minutes.
                    </p>
                    <input
                      type="text"
                      ref={otpRef}
                      className="vd-input"
                      placeholder="Enter verification code"
                      maxLength={6}
                      inputMode="numeric"
                      style={{ marginBottom: 10 }}
                    />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        className="vd-primary-btn"
                        disabled={confirmingCode}
                        onClick={handleConfirmCode}
                      >
                        {confirmingCode ? "Confirming..." : "Confirm Email Change"}
                      </button>
                      <button type="button" className="vd-secondary-outline-btn" onClick={resetEmailChangeForm}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {emailStatus && (
                  <p
                    className="vd-profile-status"
                    style={{ marginTop: 10, color: emailStatus.color === "error" ? "#c0392b" : "#1a6b3a" }}
                  >
                    {emailStatus.text}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div className="vd-card vd-settings-card">
        <div className="vd-settings-card-header">
          <h3>Notification Preferences</h3>
        </div>

        <div className="vd-settings-content">
          {notifError && (
            <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{notifError}</p>
          )}

          <div className="vd-setting-row">
            <div>
              <h4>Email Notifications</h4>
              <p>Receive weekly performance reports.</p>
            </div>

            <label className="vd-switch">
              <input
                type="checkbox"
                checked={vendor.email_notifications_enabled !== false}
                disabled={emailNotifSaving}
                onChange={(e) => toggleEmailNotifications(e.target.checked)}
              />
              <span className="vd-slider"></span>
            </label>
          </div>

          <div className="vd-setting-row">
            <div>
              <h4>Lead Alerts</h4>
              <p>Instant notification when a customer clicks &quot;Call&quot; or &quot;WhatsApp&quot;.</p>
            </div>

            <label className="vd-switch">
              <input
                type="checkbox"
                checked={vendor.lead_alerts_enabled !== false}
                disabled={leadAlertsSaving}
                onChange={(e) => toggleLeadAlerts(e.target.checked)}
              />
              <span className="vd-slider"></span>
            </label>
          </div>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="vd-card vd-danger-card">
        <div className="vd-danger-header">
          <h3>Danger Zone</h3>
        </div>

        <div className="vd-danger-content">
          <p className="vd-danger-text">Permanently disable your business listing and vendor access on Spotlight.</p>

          <div className="vd-danger-warning">
            <span>
              Closing your account will immediately disable your vendor access and remove your public profile from
              Spotlight. Your subscription remains non-refundable and all payments are final.
              <br />
              <br />
              You will have a 14-day restoration period before the closure becomes permanent and your vendor
              associations are permanently severed.
            </span>
          </div>

          <button
            type="button"
            className="vd-close-account-btn"
            disabled={isClosing || closing}
            style={isClosing ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            onClick={handleCloseAccount}
          >
            {isClosing ? "Closure Scheduled" : closing ? "Scheduling..." : "Close Account"}
          </button>

          {isClosing && (
            <div className="vd-danger-warning">
              <span>
                Your account is scheduled for permanent closure on{" "}
                {deletionDate ? deletionDate.toLocaleDateString() : "—"}. Restore your account before this date
                to regain access.
              </span>

              <button type="button" className="vd-restore-btn" disabled={restoring} onClick={handleRestoreAccount}>
                {restoring ? "Restoring..." : "Restore Account"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
