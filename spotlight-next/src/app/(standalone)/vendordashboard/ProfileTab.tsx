"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/ProfileTab.tsx
//
// Vendor Dashboard — MODULE 2: Profile editing.
//
// Faithful port of the #profile section in production
// vendordashboard.html + the matching logic in vendordashboard.js
// (the "PROFILE DISPLAY VALUES" / "INLINE EDIT TOGGLES" /
// "CATEGORY + SUBCATEGORY" / "DETECT BUSINESS LOCATION" /
// "SAVE PROFILE CHANGES" blocks). Field IDs are kept as data
// attributes / element purpose only (React has no global DOM ids
// to collide with), but every validation message, save order, and
// the exact hasChanges / onboarding_completed logic is preserved.
//
// Notable production quirks intentionally KEPT (not "fixed"),
// because the brief is to mirror production exactly:
// - The public listing consent checkbox is NOT pre-checked from any
//   saved value — it must be re-ticked on every save.
// - The Description editor has no read-only preview; it's invisible
//   until "Edit" is clicked (unlike every other field here).
// - Read-only display values only update after a *successful* save,
//   not live while editing.
// - Description formatting toolbar uses document.execCommand, same
//   as production (contenteditable + execCommand is deprecated but
//   this is a faithful port, not a rewrite).
// ===============================================================

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { nigeriaData } from "@/lib/nigeria-data";
import AiDescribeModal, { useAiDescribeToast } from "@/components/AiDescribeModal";
import type { Vendor } from "./page";

const DESCRIPTION_WORD_LIMITS: Record<string, number> = {
  free: 50,
  standard: 100,
  enterprise: 150,
  elite: 200,
  custom: 250,
};

function countWords(html: string): number {
  const text = (html || "").replace(/<[^>]*>/g, " ").trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  vendor: Vendor;
  onVendorUpdate: (patch: Partial<Vendor>) => void;
};

export default function ProfileTab({ vendor, onVendorUpdate }: Props) {
  const formRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------
  // EDITOR TOGGLES (data-toggle -> vd-inline-editor.active)
  // ---------------------------------------------------------------
  const [openEditors, setOpenEditors] = useState<Record<string, boolean>>({});
  function toggleEditor(key: string) {
    setOpenEditors((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function editorClass(key: string) {
    return `vd-inline-editor${openEditors[key] ? " active" : ""}`;
  }

  // ---------------------------------------------------------------
  // READ-ONLY DISPLAY VALUES (only change after a successful save)
  // ---------------------------------------------------------------
  const [whatsappPreview, setWhatsappPreview] = useState(vendor.whatsapp || "—");
  const [telephonePreview, setTelephonePreview] = useState(vendor.telephone || "—");
  const [addressPreview, setAddressPreview] = useState(vendor.address || "—");
  const [statePreview, setStatePreview] = useState(vendor.state || "—");
  const [lgaPreview, setLgaPreview] = useState(vendor.lga || "—");
  const [coordsPreview, setCoordsPreview] = useState(
    vendor.latitude && vendor.longitude
      ? `${Number(vendor.latitude).toFixed(5)}, ${Number(vendor.longitude).toFixed(5)}`
      : "—"
  );
  const [hoursPreview, setHoursPreview] = useState(
    vendor.open_time && vendor.close_time
      ? `${vendor.open_time} - ${vendor.close_time} (${vendor.business_days || ""})`
      : "—"
  );

  // ---------------------------------------------------------------
  // CONTACT (uncontrolled — read at save time, like production)
  // ---------------------------------------------------------------
  const whatsappRef = useRef<HTMLInputElement>(null);
  const telephoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const openTimeRef = useRef<HTMLInputElement>(null);
  const closeTimeRef = useRef<HTMLInputElement>(null);
  const latitudeRef = useRef<HTMLInputElement>(null);
  const longitudeRef = useRef<HTMLInputElement>(null);
  const confirmLocationRef = useRef<HTMLInputElement>(null);
  const publicConsentRef = useRef<HTMLInputElement>(null);

  function handleWhatsappInput(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/\D/g, "");
    if (v.startsWith("0")) v = v.substring(1);
    v = v.slice(0, 10);
    e.target.value = v;
  }

  // ---------------------------------------------------------------
  // STATE + LGA (from nigeria-data.js, no async fetch needed)
  // ---------------------------------------------------------------
  const [stateVal, setStateVal] = useState(vendor.state || "");
  const [lgaVal, setLgaVal] = useState(vendor.lga || "");
  const lgaOptions: string[] = stateVal ? nigeriaData[stateVal as keyof typeof nigeriaData] || [] : [];

  function handleStateChange(next: string) {
    setStateVal(next);
    setLgaVal("");
  }

  // ---------------------------------------------------------------
  // LOCATION DETECT
  // ---------------------------------------------------------------
  const [locationStatus, setLocationStatus] = useState("");

  function handleDetectLocation() {
    if (!confirmLocationRef.current?.checked) {
      setLocationStatus("Please confirm you are at your business location before detecting.");
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported by your browser.");
      return;
    }
    setLocationStatus("Detecting location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (latitudeRef.current) latitudeRef.current.value = lat.toFixed(6);
        if (longitudeRef.current) longitudeRef.current.value = lng.toFixed(6);
        setCoordsPreview(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setLocationStatus("Location detected successfully.");
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationStatus(
          "Unable to retrieve location. Please allow location permission or enter coordinates manually."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // ---------------------------------------------------------------
  // DESCRIPTION (contenteditable + toolbar + AI generate)
  // ---------------------------------------------------------------
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const { showToast, toastNode } = useAiDescribeToast();

  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.innerHTML = vendor.description || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function execToolbarCommand(cmd: string) {
    descriptionRef.current?.focus();
    document.execCommand(cmd, false);
  }

  // ---------------------------------------------------------------
  // SAVE
  // ---------------------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  async function handleSave() {
    setSaving(true);
    setStatusMsg("Saving changes...");

    if (!publicConsentRef.current?.checked) {
      setStatusMsg("You must agree to the public listing consent before saving.");
      setSaving(false);
      return;
    }

    const whatsappValue = whatsappRef.current?.value.trim() || "";
    const telephoneValue = telephoneRef.current?.value.trim() || "";
    const addressValue = addressRef.current?.value.trim() || "";

    const requiredChecks: Array<{ value: string; label: string }> = [
      { value: whatsappValue, label: "WhatsApp number" },
      { value: telephoneValue, label: "Telephone number" },
      { value: addressValue, label: "Business address" },
      { value: stateVal, label: "State" },
      { value: lgaVal, label: "LGA" },
    ];

    for (const item of requiredChecks) {
      if (!item.value || !item.value.trim()) {
        setStatusMsg(`${item.label} is required.`);
        setSaving(false);
        return;
      }
    }

    const descriptionHtml = descriptionRef.current?.innerHTML || "";
    const descriptionWordLimit = DESCRIPTION_WORD_LIMITS[vendor.plan_tier || "free"] ?? 100;
    const descriptionWordCount = countWords(descriptionHtml);

    if (descriptionWordCount > descriptionWordLimit) {
      setStatusMsg(
        `Your business description exceeds the ${descriptionWordLimit}-word limit for your plan. Please shorten it.`
      );
      setSaving(false);
      return;
    }

    const nextLatitude = latitudeRef.current?.value
      ? parseFloat(latitudeRef.current.value)
      : vendor.latitude;
    const nextLongitude = longitudeRef.current?.value
      ? parseFloat(longitudeRef.current.value)
      : vendor.longitude;
    const nextOpenTime = openTimeRef.current?.value || "";
    const nextCloseTime = closeTimeRef.current?.value || "";
    const nextBusinessDays = formRef.current
      ? [...formRef.current.querySelectorAll<HTMLInputElement>(".business-day")]
          .filter((cb) => cb.checked)
          .map((cb) => cb.value)
          .join(",")
      : "";
    const nextDescription = descriptionHtml.trim();

    const hasChanges =
      whatsappValue !== (vendor.whatsapp || "") ||
      telephoneValue !== (vendor.telephone || "") ||
      addressValue !== (vendor.address || "") ||
      nextDescription !== (vendor.description || "") ||
      stateVal !== (vendor.state || "") ||
      lgaVal !== (vendor.lga || "") ||
      nextLatitude !== vendor.latitude ||
      nextLongitude !== vendor.longitude ||
      nextOpenTime !== (vendor.open_time || "") ||
      nextCloseTime !== (vendor.close_time || "") ||
      nextBusinessDays !== (vendor.business_days || "");

    if (!hasChanges) {
      setStatusMsg("No new changes to save.");
      setSaving(false);
      return;
    }

    const payload = {
      whatsapp: whatsappValue,
      telephone: telephoneValue,
      address: addressValue,
      description: nextDescription,
      latitude: nextLatitude,
      longitude: nextLongitude,
      state: stateVal,
      lga: lgaVal,
      open_time: nextOpenTime || null,
      close_time: nextCloseTime || null,
      business_days: nextBusinessDays,
    };

    const updatedPayload = {
      ...payload,
      onboarding_completed: !!(
        (vendor.name || "").trim() &&
        (vendor.email || "").trim() &&
        (payload.address || "").trim() &&
        (payload.description || "").trim() &&
        (payload.whatsapp || "").trim() &&
        (payload.telephone || "").trim() &&
        payload.latitude &&
        payload.longitude
      ),
    };

    try {
      const { error } = await supabase.from("vendors").update(updatedPayload).eq("id", vendor.id);
      if (error) throw error;

      setWhatsappPreview(payload.whatsapp || "—");
      setTelephonePreview(payload.telephone || "—");
      setAddressPreview(payload.address || "—");
      setHoursPreview(
        payload.open_time && payload.close_time
          ? `${payload.open_time} - ${payload.close_time} (${payload.business_days || ""})`
          : "—"
      );
      setStatePreview(payload.state || "—");
      setLgaPreview(payload.lga || "—");
      if (payload.latitude && payload.longitude) {
        setCoordsPreview(`${Number(payload.latitude).toFixed(5)}, ${Number(payload.longitude).toFixed(5)}`);
      }

      onVendorUpdate({ ...updatedPayload });

      // Collapse every open inline editor back to its closed, read-only
      // state — the visible cue to the vendor that the save went through,
      // on top of the status message below.
      setOpenEditors({});

      setStatusMsg("Profile updated successfully.");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unable to save profile changes.";
      alert(message);
      setStatusMsg("Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="vd-card vd-profile-card" ref={formRef}>
      <div className="vd-profile-header">
        <div>
          <h3>Edit Business Profile</h3>
          <p className="vd-profile-subtext">Update your public information and location details.</p>
        </div>
      </div>

      {/* BUSINESS NAME + EMAIL (read-only, no editor) */}
      <div className="vd-profile-grid">
        <div className="vd-profile-row">
          <div className="vd-profile-row-top">
            <label>Business Display Name</label>
          </div>
          <div className="vd-profile-value">
            <span>{vendor.name || "—"}</span>
          </div>
        </div>

        <div className="vd-profile-row">
          <div className="vd-profile-row-top">
            <label>Email Address</label>
          </div>
          <div className="vd-profile-value">
            <span>{vendor.email || "—"}</span>
          </div>
        </div>
      </div>

      {/* CONTACT */}
      <div className="vd-profile-grid vd-editable-group">
        <div className="vd-profile-row">
          <div className="vd-profile-row-top">
            <label>WhatsApp</label>
          </div>
          <div className="vd-profile-value">
            <span>{whatsappPreview}</span>
          </div>
        </div>

        <div className="vd-profile-row">
          <div className="vd-profile-row-top vd-group-edit-header">
            <label>Telephone</label>
            <button type="button" className="vd-edit-btn" onClick={() => toggleEditor("contact")}>
              <i className="fa-solid fa-pen"></i>
              Edit
            </button>
          </div>
          <div className="vd-profile-value">
            <span>{telephonePreview}</span>
          </div>

          <div className={editorClass("contact")}>
            <div className="vd-coordinates-row">
              <div className="vd-phone-group">
                <span className="vd-phone-prefix">+234</span>
                <input
                  type="text"
                  ref={whatsappRef}
                  className="vd-input vd-phone-input"
                  placeholder="8021234567"
                  maxLength={10}
                  inputMode="numeric"
                  pattern="[1-9][0-9]{9}"
                  defaultValue={vendor.whatsapp || ""}
                  onChange={handleWhatsappInput}
                />
              </div>

              <input
                type="text"
                ref={telephoneRef}
                className="vd-input"
                placeholder="Telephone Number"
                defaultValue={vendor.telephone || ""}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BUSINESS HOURS */}
      <div className="vd-profile-row vd-editable-row">
        <div className="vd-profile-row-top">
          <label>Business Hours</label>
          <button type="button" className="vd-edit-btn" onClick={() => toggleEditor("hours")}>
            <i className="fa-solid fa-pen"></i>
            Edit
          </button>
        </div>

        <div className="vd-profile-value">
          <span>{hoursPreview}</span>
        </div>

        <div className={editorClass("hours")}>
          <div className="vd-coordinates-row">
            <input type="time" ref={openTimeRef} className="vd-input" defaultValue={vendor.open_time || ""} />
            <input type="time" ref={closeTimeRef} className="vd-input" defaultValue={vendor.close_time || ""} />
          </div>

          <div className="vd-business-days">
            {DAYS.map((day) => (
              <label key={day}>
                <input
                  type="checkbox"
                  value={day}
                  className="business-day"
                  defaultChecked={(vendor.business_days || "").split(",").filter(Boolean).includes(day)}
                />{" "}
                {day}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ADDRESS */}
      <div className="vd-profile-row vd-editable-row">
        <div className="vd-profile-row-top">
          <label>Address</label>
          <button type="button" className="vd-edit-btn" onClick={() => toggleEditor("address")}>
            <i className="fa-solid fa-pen"></i>
            Edit
          </button>
        </div>

        <div className="vd-profile-value">
          <span>{addressPreview}</span>
        </div>

        <div className={editorClass("address")}>
          <textarea ref={addressRef} className="vd-textarea" rows={4} defaultValue={vendor.address || ""} />
        </div>
      </div>

      {/* STATE + LGA */}
      <div className="vd-profile-grid vd-editable-group">
        <div className="vd-profile-row">
          <div className="vd-profile-row-top">
            <label>State</label>
          </div>
          <div className="vd-profile-value">
            <span>{statePreview}</span>
          </div>
        </div>

        <div className="vd-profile-row">
          <div className="vd-profile-row-top vd-group-edit-header">
            <label>LGA</label>
            <button type="button" className="vd-edit-btn" onClick={() => toggleEditor("region")}>
              <i className="fa-solid fa-pen"></i>
              Edit
            </button>
          </div>
          <div className="vd-profile-value">
            <span>{lgaPreview}</span>
          </div>

          <div className={editorClass("region")}>
            <div className="vd-coordinates-row">
              <select className="vd-input" value={stateVal} onChange={(e) => handleStateChange(e.target.value)}>
                <option value="">Select State</option>
                {Object.keys(nigeriaData).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select className="vd-input" value={lgaVal} onChange={(e) => setLgaVal(e.target.value)}>
                <option value="">Select LGA</option>
                {lgaOptions.map((lga) => (
                  <option key={lga} value={lga}>
                    {lga}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* LOCATION */}
      <div className="vd-profile-row vd-editable-row">
        <div className="vd-profile-row-top">
          <label>Business Coordinates</label>
          <button type="button" className="vd-edit-btn" onClick={() => toggleEditor("location")}>
            <i className="fa-solid fa-pen"></i>
            Edit
          </button>
        </div>

        <div className="vd-profile-value">
          <span>{coordsPreview}</span>
        </div>

        <div className={editorClass("location")}>
          <p className="vd-helper-text">
            Click &quot;Detect My Business Location&quot; while at your office or shop. If you are not there, you
            may manually enter coordinates. Visit{" "}
            <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">
              maps.google.com
            </a>{" "}
            and search your address. Right-click the map pin to reveal your coordinates.
          </p>

          <div className="vd-coordinates-row">
            <input
              type="text"
              ref={latitudeRef}
              className="vd-input"
              placeholder="Latitude"
              defaultValue={vendor.latitude ?? ""}
            />
            <input
              type="text"
              ref={longitudeRef}
              className="vd-input"
              placeholder="Longitude"
              defaultValue={vendor.longitude ?? ""}
            />
          </div>

          <button type="button" className="vd-secondary-btn" onClick={handleDetectLocation}>
            Detect My Business Location
          </button>

          <div className="vd-location-confirm">
            <input type="checkbox" id="confirmLocationCheckbox" ref={confirmLocationRef} />
            <label htmlFor="confirmLocationCheckbox">I confirm this is my business location</label>
          </div>

          <div className="vd-location-status">{locationStatus}</div>
        </div>
      </div>

      {/* DESCRIPTION — no read-only preview, matches production */}
      <div className="vd-profile-row vd-editable-row">
        <div className="vd-profile-row-top">
          <label>Description</label>
          <button type="button" className="vd-edit-btn" onClick={() => toggleEditor("description")}>
            <i className="fa-solid fa-pen"></i>
            Edit
          </button>
        </div>

        <div className={editorClass("description")}>
          <button type="button" className="vd-ai-generate-btn" onClick={() => setAiModalOpen(true)}>
            <i className="fa-solid fa-wand-magic-sparkles"></i> Generate with AI
          </button>

          <div className="about-toolbar">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execToolbarCommand("bold")}>
              B
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execToolbarCommand("italic")}
            >
              I
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execToolbarCommand("underline")}
            >
              U
            </button>
          </div>

          <div id="descriptionInput" className="about-editor" contentEditable ref={descriptionRef} />
        </div>
      </div>

      {/* PUBLIC LISTING CONSENT — not pre-checked, matches production */}
      <div className="vd-profile-row">
        <label className="vd-checkbox-wrap">
          <input type="checkbox" ref={publicConsentRef} />
          <span>
            I understand that my business information (including phone number and location) will be publicly
            displayed on Spotlight Directories.
          </span>
        </label>
      </div>

      {/* SAVE */}
      <div className="vd-profile-actions">
        <button type="button" className="vd-primary-btn" disabled={saving} onClick={handleSave}>
          Save Changes
        </button>
      </div>

      <div className="vd-profile-status">{statusMsg}</div>

      <AiDescribeModal
        open={aiModalOpen}
        type="business"
        onClose={() => setAiModalOpen(false)}
        onGenerated={(text, meta) => {
          if (descriptionRef.current) descriptionRef.current.textContent = text;
          if (meta.type === "business") {
            const plan = (meta.planTier || "").charAt(0).toUpperCase() + (meta.planTier || "").slice(1);
            showToast(`Generated within your ${plan} plan's ${meta.limit}-word limit`);
          }
        }}
      />
      {toastNode}
    </div>
  );
}
