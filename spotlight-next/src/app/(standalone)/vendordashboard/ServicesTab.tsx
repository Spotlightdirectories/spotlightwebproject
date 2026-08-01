"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/ServicesTab.tsx
//
// Vendor Dashboard — MODULE: Services.
//
// Standardized taxonomy pass (2026-08-01, per Cyril): category and
// subcategory selection used to live on the vendor Profile tab.
// That's removed now — category/subcategory only exist inside the
// Products and Services modules going forward, scoped to the
// taxonomy that matches each (Services uses categories/subcategories
// where kind = 'service').
//
// Also per Cyril's earlier decision: service listings are NOT
// freely named by vendors. A service's name IS its subcategory name
// — there is no freeform "service name" text field anymore. Vendors
// pick Category -> Subcategory and that becomes the service.
//
// NOTED, KEPT (pre-existing production behavior, unrelated to this pass):
// Deleting a saved service does NOT remove its images from storage
// (unlike Products' delete, which does clean up "vendor-gallery").
// Orphaned files stay in the bucket after a service is deleted, same
// as production.
// ===============================================================

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uploadVendorFile } from "@/lib/uploadVendorFile";
import AiDescribeModal, { useAiDescribeToast } from "@/components/AiDescribeModal";
import type { Vendor } from "./page";

type Option = { id: string; name: string };

type VendorService = {
  id: string;
  service_name: string;
  short_description: string | null;
  starting_price: number | null;
  representative_image_url: string | null;
  secondary_image_url: string | null;
  slug?: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  moderation_status?: string | null;
  moderation_flag_reason?: string | null;
};

type PendingService = {
  service_name: string;
  category_id: string;
  subcategory_id: string;
  short_description: string;
  starting_price: number | null;
  representative_image_url: string;
  secondary_image_url: string;
};

// Matches production's SERVICE_LIMITS exactly (no "trial" key inside
// the object itself — the 90-day trial override is applied via the
// same ternary production uses, matching Products' pattern).
const SERVICE_LIMITS: Record<string, number> = {
  free: 2,
  standard: 25,
  enterprise: 50,
  elite: 100,
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

  // CATEGORY + SUBCATEGORY (services taxonomy only — kind = 'service')
  const [categories, setCategories] = useState<Option[]>([]);
  const [subcategories, setSubcategories] = useState<Option[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  const trialActive = isTrialActive(vendor);
  const currentLimit = trialActive ? 5 : getServiceLimit(vendor.plan_tier || "free");
  const totalCount = savedServices.length + pendingServices.length;

  // Subcategories already in use (saved or pending) — a vendor can't add
  // the same service (i.e. the same subcategory) twice, since the service
  // name IS the subcategory name now.
  const usedSubcategoryIds = new Set([
    ...savedServices.map((s) => s.subcategory_id).filter(Boolean),
    ...pendingServices.map((s) => s.subcategory_id).filter(Boolean),
  ]);

  // Categories already in use (saved or pending) — used only for the
  // soft "different field" nudge below. This is informational only,
  // never a block: vendors can list across as many categories as they
  // genuinely operate in (this matches how Jumia/Konga/Alibaba/Amazon
  // seller accounts work — categorization is per-listing, not per-vendor).
  const usedCategoryIds = new Set([
    ...savedServices.map((s) => s.category_id).filter(Boolean),
    ...pendingServices.map((s) => s.category_id).filter(Boolean),
  ]);
  const isDifferentField = !!categoryId && usedCategoryIds.size > 0 && !usedCategoryIds.has(categoryId);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name")
        .eq("kind", "service")
        .order("name", { ascending: true });
      if (!error) setCategories(data || []);
    })();
  }, []);

  // Set by handleEditSaved right before switching categoryId, so the
  // subcategory can be re-selected once its list loads for that category.
  const pendingEditSubcategoryId = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!categoryId) {
        setSubcategories([]);
        return;
      }
      const { data, error } = await supabase
        .from("subcategories")
        .select("id,name")
        .eq("category_id", categoryId)
        .order("name", { ascending: true });
      if (!error) {
        setSubcategories(data || []);
        if (pendingEditSubcategoryId.current) {
          setSubcategoryId(pendingEditSubcategoryId.current);
          pendingEditSubcategoryId.current = null;
        }
      }
    })();
  }, [categoryId]);

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setSubcategoryId("");
  }

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
    setCategoryId("");
    setSubcategoryId("");
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
    const description = descriptionRef.current?.value.trim() || "";
    const priceRaw = priceRef.current?.value.trim() || "";

    if (!categoryId || !subcategoryId) {
      alert("Select a category and subcategory — this is what your service will be listed as.");
      return;
    }
    // Same description validation production has always had.
    if (description.length < 280) {
      alert("Service description must contain at least 280 characters including spaces.");
      return;
    }
    if (description.length > 500) {
      alert("Service description must not exceed 500 characters including spaces.");
      return;
    }
    if (totalCount >= currentLimit) {
      alert("You have reached your current plan limit.");
      return;
    }
    if (!editingId && usedSubcategoryIds.has(subcategoryId)) {
      alert("You've already added a service under this subcategory.");
      return;
    }

    const name = subcategories.find((s) => s.id === subcategoryId)?.name || "";

    setPendingServices((prev) => [
      ...prev,
      {
        service_name: name,
        category_id: categoryId,
        subcategory_id: subcategoryId,
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

    if (descriptionRef.current) descriptionRef.current.value = service.short_description || "";
    if (priceRef.current) priceRef.current.value = service.starting_price != null ? String(service.starting_price) : "";

    pendingEditSubcategoryId.current = service.subcategory_id;
    setCategoryId(service.category_id || "");
    if (!service.category_id) setSubcategoryId(service.subcategory_id || "");

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
        if (!categoryId || !subcategoryId) {
          alert("Select a category and subcategory — this is what your service will be listed as.");
          setSaving(false);
          return;
        }

        const description = descriptionRef.current?.value.trim() || "";
        const priceRaw = priceRef.current?.value || "";
        const name = subcategories.find((s) => s.id === subcategoryId)?.name || "";

        const { error } = await supabase
          .from("vendor_services")
          .update({
            service_name: name,
            slug: slugify(name),
            category_id: categoryId,
            subcategory_id: subcategoryId,
            short_description: description,
            starting_price: Number(priceRaw) || null,
            representative_image_url: primaryUrl,
            secondary_image_url: secondaryUrl,
          })
          .eq("id", editingId);

        if (error) throw error;

        const { data: refreshed } = await supabase
          .from("vendor_services")
          .select("moderation_status, moderation_flag_reason")
          .eq("id", editingId)
          .single();

        setSavedServices((prev) =>
          prev.map((s) =>
            s.id === editingId
              ? {
                  ...s,
                  service_name: name,
                  category_id: categoryId,
                  subcategory_id: subcategoryId,
                  short_description: description,
                  starting_price: Number(priceRaw) || null,
                  representative_image_url: primaryUrl,
                  secondary_image_url: secondaryUrl,
                  moderation_status: refreshed?.moderation_status ?? s.moderation_status,
                  moderation_flag_reason: refreshed?.moderation_flag_reason ?? s.moderation_flag_reason,
                }
              : s
          )
        );

        resetForm();
        alert(
          refreshed?.moderation_status === "pending_review"
            ? "Service updated. It's now pending review because it falls under a regulated category, and will go live once approved."
            : "Service updated successfully."
        );
        return;
      }

      const payload = pendingServices.map((s) => ({
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        service_name: s.service_name,
        slug: slugify(s.service_name),
        category_id: s.category_id,
        subcategory_id: s.subcategory_id,
        short_description: s.short_description,
        starting_price: s.starting_price,
        representative_image_url: s.representative_image_url || null,
        secondary_image_url: s.secondary_image_url || null,
      }));

      const { data, error } = await supabase.from("vendor_services").insert(payload).select();

      if (error) throw error;

      setSavedServices((prev) => [...prev, ...((data as VendorService[]) || [])]);
      setPendingServices([]);

      const anyPending = ((data as VendorService[]) || []).some((s) => s.moderation_status === "pending_review");
      alert(
        anyPending
          ? "Services saved. One or more fall under a regulated category and are pending review — they'll go live once approved."
          : "Services saved successfully."
      );
    } catch (err) {
      console.error("Save service error:", err);
      alert(err instanceof Error ? err.message : "Unable to save services.");
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
        <p className="vd-helper-text">
          Choose a category and subcategory — the subcategory name becomes your service&apos;s name. Custom
          service names aren&apos;t used anymore, so listings stay consistent and easy to search across the
          platform.
        </p>

        <div className="vd-coordinates-row">
          <select className="vd-input" value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select className="vd-input" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
            <option value="">Select Subcategory</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id !== subcategoryId && usedSubcategoryIds.has(s.id)}>
                {s.name}
                {s.id !== subcategoryId && usedSubcategoryIds.has(s.id) ? " (already added)" : ""}
              </option>
            ))}
          </select>
        </div>

        {isDifferentField && (
          <p className="vd-field-tip">
            💡 This is a different field from your other services. That&apos;s okay if it&apos;s a real part of your
            business — just keep each listing genuine and accurate, so customers know exactly what to expect
            from you.
          </p>
        )}

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
              {service.representative_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="vd-service-image"
                  src={service.representative_image_url}
                  alt={service.service_name}
                />
              ) : (
                <div className="vd-service-image-placeholder" aria-hidden="true">🖼️</div>
              )}

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
                {service.representative_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="vd-service-image"
                    src={service.representative_image_url}
                    alt={service.service_name}
                  />
                ) : (
                  <div className="vd-service-image-placeholder" aria-hidden="true">🖼️</div>
                )}

                <div className="vd-service-content">
                  <div className="vd-service-name">
                    {service.service_name}
                    {service.moderation_status === "pending_review" && (
                      <span className="vd-pending-review-badge" title={service.moderation_flag_reason || ""}>
                        Pending Review
                      </span>
                    )}
                    {service.moderation_status === "rejected" && (
                      <span className="vd-rejected-badge" title={service.moderation_flag_reason || ""}>
                        Not Approved
                      </span>
                    )}
                  </div>
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
        itemName={subcategories.find((s) => s.id === subcategoryId)?.name}
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
