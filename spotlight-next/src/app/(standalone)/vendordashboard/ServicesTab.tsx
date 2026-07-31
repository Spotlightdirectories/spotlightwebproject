"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/ServicesTab.tsx
//
// Vendor Dashboard — MODULE: Services.
//
// Faithful port of the #services section in production
// vendordashboard.html + the "SERVICE" blocks in vendordashboard.js.
// Per Cyril's instruction (2026-07-31): everything ported exactly as
// production behaves; nothing changed silently. Two pre-existing
// production behaviors are called out below rather than "fixed" —
// flagging them to Cyril in chat instead of building around them.
//
// NOTED BUT NOT CHANGED (production behavior, kept as-is):
// 1. Deleting a saved service does NOT remove its images from
//    storage (unlike Products' delete, which does clean up
//    "vendor-gallery"). Ported faithfully — orphaned files stay in
//    the bucket after a service is deleted, same as production.
// 2. The duplicate-name check only compares against services already
//    staged in THIS pending batch, not against services already
//    saved to the database. So the same service name can be added
//    twice across two separate "Save" actions. Ported faithfully.
// ===============================================================

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uploadVendorFile } from "@/lib/uploadVendorFile";
import AiDescribeModal, { useAiDescribeToast } from "@/components/AiDescribeModal";
import type { Vendor } from "./page";

type VendorService = {
  id: string;
  service_name: string;
  short_description: string | null;
  starting_price: number | null;
  representative_image_url: string | null;
  secondary_image_url: string | null;
  slug?: string | null;
};

type PendingService = {
  service_name: string;
  short_description: string;
  starting_price: number | null;
  representative_image_url: string;
  secondary_image_url: string;
};

// Matches production's SERVICE_LIMITS exactly (no "trial" key inside
// the object itself — the 90-day trial override is applied via the
// same ternary production uses, matching Products' pattern).
const SERVICE_LIMITS: Record<string, number> = {
  free: 1,
  standard: 6,
  enterprise: 12,
  elite: 24,
  custom: Infinity,
};

function getServiceLimit(planTier: string): number {
  return SERVICE_LIMITS[planTier] ?? 3;
}

// Matches production's 90-day free-trial override exactly.
function isTrialActive(vendor: Vendor): boolean {
  if ((vendor.plan_tier || "free") !== "free" || !vendor.trial_started_at) return false;
  const start = new Date(vendor.trial_started_at);
  const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 90;
}

// Same slug generation production runs in the SAVE handler.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

const IMAGE_HINT = "Accepted: JPG, JPEG, PNG • Max: 2 MB • Minimum: 800 × 800 px";

export default function ServicesTab({ vendor }: { vendor: Vendor }) {
  const [savedServices, setSavedServices] = useState<VendorService[]>([]);
  const [pendingServices, setPendingServices] = useState<PendingService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [primaryUrl, setPrimaryUrl] = useState("");
  const [secondaryUrl, setSecondaryUrl] = useState("");
  const [primaryLabel, setPrimaryLabel] = useState("No file chosen");
  const [secondaryLabel, setSecondaryLabel] = useState("No file chosen");
  const [primaryUploading, setPrimaryUploading] = useState(false);
  const [secondaryUploading, setSecondaryUploading] = useState(false);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const { showToast, toastNode } = useAiDescribeToast();

  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  const trialActive = isTrialActive(vendor);
  const currentLimit = trialActive ? 3 : getServiceLimit(vendor.plan_tier || "free");
  const totalCount = savedServices.length + pendingServices.length;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("vendor_services")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Fetch services error:", error);
      } else {
        setSavedServices((data as VendorService[]) || []);
      }
      setLoadingServices(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [vendor.id]);

  function resetForm() {
    if (nameRef.current) nameRef.current.value = "";
    if (descriptionRef.current) descriptionRef.current.value = "";
    if (priceRef.current) priceRef.current.value = "";
    setPrimaryUrl("");
    setSecondaryUrl("");
    setPrimaryLabel("No file chosen");
    setSecondaryLabel("No file chosen");
    if (primaryInputRef.current) primaryInputRef.current.value = "";
    if (secondaryInputRef.current) secondaryInputRef.current.value = "";
    setEditingId(null);
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>, slot: "primary" | "secondary") {
    const file = e.target.files?.[0];
    if (!file) return;

    const setUploading = slot === "primary" ? setPrimaryUploading : setSecondaryUploading;
    const setUrl = slot === "primary" ? setPrimaryUrl : setSecondaryUrl;
    const setLabel = slot === "primary" ? setPrimaryLabel : setSecondaryLabel;
    const inputRef = slot === "primary" ? primaryInputRef : secondaryInputRef;

    setLabel("Uploading...");
    setUploading(true);

    try {
      const result = await uploadVendorFile(file, "service");
      setUrl(result.publicUrl || "");
      setLabel(file.name);
    } catch (err) {
      console.error(`${slot} service image upload error:`, err);
      alert(err instanceof Error ? err.message : `${slot === "primary" ? "Representative" : "Additional"} image upload failed.`);
      setLabel("No file chosen");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  function handleAddToPending() {
    const name = nameRef.current?.value.trim() || "";
    const description = descriptionRef.current?.value.trim() || "";
    const priceRaw = priceRef.current?.value.trim() || "";

    // Same validation order and copy as production's ADD SERVICE ITEM handler.
    if (description.length < 280) {
      alert("Service description must contain at least 280 characters including spaces.");
      return;
    }
    if (description.length > 500) {
      alert("Service description must not exceed 500 characters including spaces.");
      return;
    }
    if (!name) {
      alert("Enter a service name.");
      return;
    }
    if (name.includes(",")) {
      alert("Add one service at a time.");
      return;
    }
    if (name.length > 60) {
      alert("Service name must not exceed 60 characters.");
      return;
    }
    if (name.split(/\s+/).length > 6) {
      alert("Service name is too long.");
      return;
    }
    if (totalCount >= currentLimit) {
      alert("You have reached your current plan limit.");
      return;
    }
    if (pendingServices.some((s) => s.service_name.toLowerCase() === name.toLowerCase())) {
      alert("Service already added.");
      return;
    }

    setPendingServices((prev) => [
      ...prev,
      {
        service_name: name,
        short_description: description,
        starting_price: Number(priceRaw) || null,
        representative_image_url: primaryUrl,
        secondary_image_url: secondaryUrl,
      },
    ]);

    resetForm();
  }

  function handleRemovePending(index: number) {
    setPendingServices((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditSaved(service: VendorService) {
    setEditingId(service.id);
    setFormOpen(true);

    if (nameRef.current) nameRef.current.value = service.service_name || "";
    if (descriptionRef.current) descriptionRef.current.value = service.short_description || "";
    if (priceRef.current) priceRef.current.value = service.starting_price != null ? String(service.starting_price) : "";

    setPrimaryUrl(service.representative_image_url || "");
    setPrimaryLabel(
      service.representative_image_url ? `Current: ${service.representative_image_url.split("/").pop()}` : "No file chosen"
    );

    setSecondaryUrl(service.secondary_image_url || "");
    setSecondaryLabel(
      service.secondary_image_url ? `Current: ${service.secondary_image_url.split("/").pop()}` : "No file chosen"
    );
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm("Delete this service?")) return;

    // Faithful port: production does not clean up storage on service
    // delete (unlike Products). See module comment above.
    const { error } = await supabase.from("vendor_services").delete().eq("id", id);

    if (error) {
      alert("Unable to delete service.");
      console.error(error);
      return;
    }

    setSavedServices((prev) => prev.filter((s) => s.id !== id));

    if (editingId === id) {
      resetForm();
    }
  }

  async function handleSave() {
    if (!editingId && !pendingServices.length) {
      alert("Add at least one service.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const name = nameRef.current?.value.trim() || "";
        const description = descriptionRef.current?.value.trim() || "";
        const priceRaw = priceRef.current?.value || "";

        const { error } = await supabase
          .from("vendor_services")
          .update({
            service_name: name,
            slug: slugify(name),
            short_description: description,
            starting_price: Number(priceRaw) || null,
            representative_image_url: primaryUrl,
            secondary_image_url: secondaryUrl,
          })
          .eq("id", editingId);

        if (error) throw error;

        setSavedServices((prev) =>
          prev.map((s) =>
            s.id === editingId
              ? {
                  ...s,
                  service_name: name,
                  short_description: description,
                  starting_price: Number(priceRaw) || null,
                  representative_image_url: primaryUrl,
                  secondary_image_url: secondaryUrl,
                }
              : s
          )
        );

        resetForm();
        alert("Service updated successfully.");
        return;
      }

      const payload = pendingServices.map((s) => ({
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        service_name: s.service_name,
        slug: slugify(s.service_name),
        short_description: s.short_description,
        starting_price: s.starting_price,
        representative_image_url: s.representative_image_url || null,
        secondary_image_url: s.secondary_image_url || null,
      }));

      const { data, error } = await supabase.from("vendor_services").insert(payload).select();

      if (error) throw error;

      setSavedServices((prev) => [...prev, ...((data as VendorService[]) || [])]);
      setPendingServices([]);
      alert("Services saved successfully.");
    } catch (err) {
      console.error("Save service error:", err);
      alert("Unable to save services.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="vd-card vd-profile-card">
      <div className="vd-profile-header">
        <div>
          <h3>Service Offerings</h3>
          <p className="vd-profile-subtext">Add and manage the services your business provides.</p>
        </div>

        <button type="button" className="vd-service-btn" onClick={() => setFormOpen((v) => !v)}>
          <i className="fa-solid fa-plus"></i> Add Service
        </button>
      </div>

      <div className={`vd-inline-editor${formOpen ? " active" : ""}`}>
        <div className="vd-service-add-row">
          <input type="text" ref={nameRef} className="vd-input" placeholder="Enter service name" />
        </div>

        <div className="vd-service-description-row">
          <button type="button" className="vd-ai-generate-btn" onClick={() => setAiModalOpen(true)}>
            <i className="fa-solid fa-wand-magic-sparkles"></i> Generate with AI
          </button>

          <textarea
            ref={descriptionRef}
            className="vd-textarea"
            rows={8}
            maxLength={500}
            placeholder="Describe your service (280–500 characters). You may use bullet points (•) to list features or deliverables."
          />
        </div>

        <div className="vd-service-add-row">
          <input type="number" ref={priceRef} className="vd-input" placeholder="Starting price (optional)" />
        </div>

        <div className="vd-product-image-row">
          <div className="vd-product-image-label">Representative Image</div>

          <label htmlFor="servicePrimaryImage" className="vd-product-image-btn">
            Choose Image
          </label>

          <input
            type="file"
            id="servicePrimaryImage"
            accept="image/*"
            ref={primaryInputRef}
            onChange={(e) => handleImageChange(e, "primary")}
          />

          <span className="vd-product-image-name">{primaryUploading ? "Uploading..." : primaryLabel}</span>
        </div>
        <p className="vd-product-image-hint">{IMAGE_HINT}</p>

        <div className="vd-product-image-row">
          <div className="vd-product-image-label">Additional Image</div>

          <label htmlFor="serviceSecondaryImage" className="vd-product-image-btn">
            Choose Image
          </label>

          <input
            type="file"
            id="serviceSecondaryImage"
            accept="image/*"
            ref={secondaryInputRef}
            onChange={(e) => handleImageChange(e, "secondary")}
          />

          <span className="vd-product-image-name">{secondaryUploading ? "Uploading..." : secondaryLabel}</span>
        </div>
        <p className="vd-product-image-hint">{IMAGE_HINT}</p>

        <div className="vd-service-add-actions">
          <button type="button" className="vd-service-btn" disabled={!!editingId} onClick={handleAddToPending}>
            {editingId ? "Editing..." : "Add"}
          </button>
        </div>

        <p className="vd-service-limit-text">{`Your current plan allows up to ${currentLimit} services.`}</p>

        {/* PENDING SERVICES */}
        <div className="vd-pending-services">
          {pendingServices.map((service, index) => (
            <div className="vd-service-pill" key={index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="vd-service-image"
                src={service.representative_image_url || "/images/placeholder.png"}
                alt={service.service_name}
              />

              <div className="vd-service-content">
                <div className="vd-service-name">{service.service_name}</div>
                {service.short_description && (
                  <div className="vd-service-description">{service.short_description}</div>
                )}
                {service.starting_price ? (
                  <div className="vd-service-price">From ₦{Number(service.starting_price).toLocaleString()}</div>
                ) : null}
                <div className="vd-service-assets">
                  {service.representative_image_url ? "📷 Representative Image" : ""}
                  {service.secondary_image_url ? " 📷 Additional Image" : ""}
                </div>
              </div>

              <button type="button" className="vd-remove-service-btn" onClick={() => handleRemovePending(index)}>
                ×
              </button>
            </div>
          ))}
        </div>

        {/* SAVED SERVICES */}
        <div className="vd-saved-services">
          {loadingServices ? (
            <div className="vd-empty-services">Loading services...</div>
          ) : savedServices.length === 0 ? (
            <div className="vd-empty-services">No saved services yet.</div>
          ) : (
            savedServices.map((service) => (
              <div className="vd-service-pill saved" key={service.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="vd-service-image"
                  src={service.representative_image_url || "/images/placeholder.png"}
                  alt={service.service_name}
                />

                <div className="vd-service-content">
                  <div className="vd-service-name">{service.service_name}</div>
                  <div className="vd-service-description">
                    {(service.short_description || "").length > 280
                      ? `${(service.short_description || "").slice(0, 280)}...`
                      : service.short_description || ""}
                  </div>
                  {service.starting_price ? (
                    <div className="vd-service-price">From ₦{Number(service.starting_price).toLocaleString()}</div>
                  ) : null}
                  <div className="vd-service-assets">
                    {service.representative_image_url ? "📷 Representative Image" : ""}
                    {service.secondary_image_url ? " 📷 Additional Image" : ""}
                  </div>
                </div>

                <button type="button" className="vd-edit-service-btn" onClick={() => handleEditSaved(service)}>
                  Edit
                </button>

                <button type="button" className="vd-delete-service-btn" onClick={() => handleDeleteSaved(service.id)}>
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div className="vd-profile-actions">
          <button type="button" className="vd-service-btn" disabled={saving} onClick={handleSave}>
            {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update Service" : "Save Services"}
          </button>
        </div>
      </div>

      <AiDescribeModal
        open={aiModalOpen}
        type="service"
        itemName={nameRef.current?.value}
        onClose={() => setAiModalOpen(false)}
        onGenerated={(text, meta) => {
          if (descriptionRef.current) descriptionRef.current.value = text;
          const plan = (meta.planTier || "").charAt(0).toUpperCase() + (meta.planTier || "").slice(1);
          if (meta.planTier && meta.limit) {
            showToast(`Generated within your ${plan} plan's ${meta.limit}-word limit`);
          }
        }}
      />
      {toastNode}
    </div>
  );
}
