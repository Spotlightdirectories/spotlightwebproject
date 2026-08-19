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
import SearchableSelect from "@/components/SearchableSelect";
import type { Vendor } from "./page";

type Option = { id: string; name: string };

// Category-specific spec fields (Jiji-style), 2026-08 per Cyril —
// same pattern as ProductsTab, mirrored here for services. Defined
// per service category in service_attributes; the form below renders
// whichever set applies to the chosen category. Categories without
// any defined attributes yet just skip this block — no error, no gap.
type AttributeDef = {
  id: string;
  key: string;
  label: string;
  field_type: "text" | "number" | "select" | "multiselect";
  options: string[] | null;
  display_order: number;
};

type AttributeValues = Record<string, string>;

type VendorService = {
  id: string;
  service_name: string;
  short_description: string | null;
  starting_price: number | null;
  representative_image_url: string | null;
  secondary_image_url: string | null;
  gallery_image_urls: string[] | null;
  attributes: AttributeValues | null;
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
  gallery_image_urls: string[];
  attributes: AttributeValues;
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

// Supabase/Postgrest errors are plain objects with a `.message`
// string — NOT instances of the native Error class — so a bare
// `err instanceof Error` check always fell through to the generic
// fallback text, silently hiding the real reason a save failed (e.g.
// a restricted-item trigger rejection). See matching fix in
// ProductsTab.tsx.
function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
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

  // GALLERY — 2 extra, optional photo slots (2026-08 per Cyril: services
  // get a smaller bump than products — max 4 photos total per listing,
  // vs. products' 8). Representative + Additional above stay as images
  // 1-2; these 2 extra slots are stored in vendor_services.gallery_image_urls.
  const GALLERY_SLOTS = 2;
  const [galleryUrls, setGalleryUrls] = useState<string[]>(Array(GALLERY_SLOTS).fill(""));
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>(Array(GALLERY_SLOTS).fill(""));
  const [galleryUploading, setGalleryUploading] = useState<boolean[]>(Array(GALLERY_SLOTS).fill(false));
  const [galleryLabels, setGalleryLabels] = useState<string[]>(Array(GALLERY_SLOTS).fill("No file chosen"));
  const galleryInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const { showToast, toastNode } = useAiDescribeToast();

  // CATEGORY + SUBCATEGORY (services taxonomy only — kind = 'service')
  const [categories, setCategories] = useState<Option[]>([]);
  const [subcategories, setSubcategories] = useState<Option[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  // SPEC FIELDS — category-specific attribute definitions + the
  // vendor's entered values for whichever category is selected.
  const [attributeDefs, setAttributeDefs] = useState<AttributeDef[]>([]);
  const [attributeValues, setAttributeValues] = useState<AttributeValues>({});

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

  // Set by handleEditSaved right before switching categoryId, so
  // previously-saved spec values can be restored once the definitions
  // for that category finish loading.
  const pendingEditAttributeValues = useRef<AttributeValues | null>(null);

  useEffect(() => {
    (async () => {
      if (!categoryId) {
        setAttributeDefs([]);
        setAttributeValues({});
        return;
      }
      const { data, error } = await supabase
        .from("service_attributes")
        .select("id,key,label,field_type,options,display_order")
        .eq("category_id", categoryId)
        .order("display_order", { ascending: true });
      if (!error) {
        setAttributeDefs((data as AttributeDef[]) || []);
        if (pendingEditAttributeValues.current) {
          setAttributeValues(pendingEditAttributeValues.current);
          pendingEditAttributeValues.current = null;
        } else {
          setAttributeValues({});
        }
      }
    })();
  }, [categoryId]);

  function handleAttributeChange(key: string, value: string) {
    setAttributeValues((prev) => ({ ...prev, [key]: value }));
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

  function resetGallerySlot(index: number) {
    setGalleryUrls((prev) => prev.map((v, i) => (i === index ? "" : v)));
    setGalleryPreviews((prev) => prev.map((v, i) => (i === index ? "" : v)));
    setGalleryLabels((prev) => prev.map((v, i) => (i === index ? "No file chosen" : v)));
    if (galleryInputRefs.current[index]) galleryInputRefs.current[index]!.value = "";
  }

  function resetForm() {
    setCategoryId("");
    setSubcategoryId("");
    setAttributeValues({});
    if (descriptionRef.current) descriptionRef.current.value = "";
    if (priceRef.current) priceRef.current.value = "";
    setPrimaryUrl("");
    setSecondaryUrl("");
    setPrimaryLabel("No file chosen");
    setSecondaryLabel("No file chosen");
    if (primaryInputRef.current) primaryInputRef.current.value = "";
    if (secondaryInputRef.current) secondaryInputRef.current.value = "";
    for (let i = 0; i < GALLERY_SLOTS; i++) resetGallerySlot(i);
    setEditingId(null);
  }

  async function handleGalleryImageChange(e: ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0];
    if (!file) return;

    setGalleryPreviews((prev) => prev.map((v, i) => (i === index ? URL.createObjectURL(file) : v)));
    setGalleryLabels((prev) => prev.map((v, i) => (i === index ? "Uploading..." : v)));
    setGalleryUploading((prev) => prev.map((v, i) => (i === index ? true : v)));

    try {
      const result = await uploadVendorFile(file, "service");
      setGalleryUrls((prev) => prev.map((v, i) => (i === index ? result.publicUrl || "" : v)));
      setGalleryPreviews((prev) => prev.map((v, i) => (i === index ? result.publicUrl || "" : v)));
      setGalleryLabels((prev) => prev.map((v, i) => (i === index ? file.name : v)));
    } catch (err) {
      console.error(`Gallery service image ${index + 3} upload error:`, err);
      alert(err instanceof Error ? err.message : "Image upload failed.");
      setGalleryLabels((prev) => prev.map((v, i) => (i === index ? "No file chosen" : v)));
      setGalleryPreviews((prev) => prev.map((v, i) => (i === index ? "" : v)));
      if (galleryInputRefs.current[index]) galleryInputRefs.current[index]!.value = "";
    } finally {
      setGalleryUploading((prev) => prev.map((v, i) => (i === index ? false : v)));
    }
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
        gallery_image_urls: galleryUrls.filter(Boolean),
        attributes: attributeValues,
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
    pendingEditAttributeValues.current = service.attributes || {};
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

    const gallery = service.gallery_image_urls || [];
    setGalleryUrls(Array.from({ length: GALLERY_SLOTS }, (_, i) => gallery[i] || ""));
    setGalleryPreviews(Array.from({ length: GALLERY_SLOTS }, (_, i) => gallery[i] || ""));
    setGalleryLabels(
      Array.from({ length: GALLERY_SLOTS }, (_, i) => (gallery[i] ? `Current: ${gallery[i].split("/").pop()}` : "No file chosen"))
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

        // Gate: block switching this service to a subcategory another
        // saved service already uses (2026-08, per Cyril — closes the
        // duplicate-listing gap the "Drone Videography" incident exposed).
        const duplicateExists = savedServices.some(
          (s) => s.id !== editingId && s.subcategory_id === subcategoryId
        );
        if (duplicateExists) {
          alert("You already have a service listed under this subcategory. Please edit that existing listing instead of creating a duplicate.");
          setSaving(false);
          return;
        }

        const description = descriptionRef.current?.value.trim() || "";
        const priceRaw = priceRef.current?.value || "";
        const name = subcategories.find((s) => s.id === subcategoryId)?.name || "";
        const galleryToSave = galleryUrls.filter(Boolean);

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
            gallery_image_urls: galleryToSave,
            attributes: attributeValues,
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
                  gallery_image_urls: galleryToSave,
                  attributes: attributeValues,
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
        gallery_image_urls: s.gallery_image_urls,
        attributes: s.attributes,
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
      // 23505 = Postgres unique-violation. A DB-level constraint backs up
      // the client-side checks above in case of races (e.g. two rapid
      // submits before state refreshes) — this turns that into a clear
      // message instead of a raw DB error.
      const code = (err as { code?: string } | null)?.code;
      alert(
        code === "23505"
          ? "You already have a service listed under this subcategory. Please edit the existing one instead of adding a duplicate."
          : getErrorMessage(err, "Unable to save services.")
      );
    } finally {
      setSaving(false);
    }
  }

  function renderGallerySlot(index: number) {
    const inputId = `galleryServiceImage${index}`;
    return (
      <div key={index}>
        <div className="vd-product-image-row">
          <div className="vd-product-image-label">{`Additional Image ${index + 3} (optional)`}</div>

          <label htmlFor={inputId} className="vd-product-image-btn">
            Choose Image
          </label>

          <input
            type="file"
            id={inputId}
            accept="image/*"
            ref={(el) => {
              galleryInputRefs.current[index] = el;
            }}
            onChange={(e) => handleGalleryImageChange(e, index)}
          />

          <span className="vd-product-image-name">{galleryLabels[index]}</span>

          {galleryPreviews[index] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={galleryPreviews[index]}
              alt={`Additional image ${index + 3} preview`}
              style={{
                width: 56,
                height: 56,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                marginLeft: 10,
                opacity: galleryUploading[index] ? 0.5 : 1,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // Renders one input per attribute definition for the selected
  // category — text/number as a plain input, select/multiselect as a
  // dropdown. Categories with no definitions yet simply render nothing.
  function renderAttributeField(def: AttributeDef) {
    const value = attributeValues[def.key] || "";

    if (def.field_type === "select") {
      return (
        <select
          key={def.id}
          className="vd-input"
          value={value}
          onChange={(e) => handleAttributeChange(def.key, e.target.value)}
        >
          <option value="">{def.label}</option>
          {(def.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (def.field_type === "multiselect") {
      const selected = value ? value.split(",") : [];
      const toggle = (opt: string) => {
        const next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt];
        handleAttributeChange(def.key, next.join(","));
      };
      return (
        <div key={def.id} className="vd-multiselect-field">
          <div className="vd-product-image-label">{def.label}</div>
          <div className="vd-multiselect-options">
            {(def.options || []).map((opt) => (
              <label key={opt} className="vd-multiselect-option">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
                {opt}
              </label>
            ))}
          </div>
        </div>
      );
    }

    return (
      <input
        key={def.id}
        type={def.field_type === "number" ? "number" : "text"}
        className="vd-input"
        placeholder={def.label}
        value={value}
        onChange={(e) => handleAttributeChange(def.key, e.target.value)}
      />
    );
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
          <SearchableSelect
            placeholder="Select Category"
            searchPlaceholder="Search categories..."
            value={categoryId}
            onChange={handleCategoryChange}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />

          <SearchableSelect
            placeholder="Select Subcategory"
            searchPlaceholder="Search subcategories..."
            value={subcategoryId}
            onChange={setSubcategoryId}
            disabled={!categoryId}
            options={subcategories.map((s) => {
              const alreadyAdded = s.id !== subcategoryId && usedSubcategoryIds.has(s.id);
              return {
                value: s.id,
                label: alreadyAdded ? `${s.name} (already added)` : s.name,
                disabled: alreadyAdded,
              };
            })}
          />
        </div>

        {isDifferentField && (
          <p className="vd-field-tip">
            💡 This is a different field from your other services. That&apos;s okay if it&apos;s a real part of your
            business — just keep each listing genuine and accurate, so customers know exactly what to expect
            from you.
          </p>
        )}

        {attributeDefs.length > 0 && (
          <>
            <p className="vd-helper-text">
              Add the specs customers look for in this category (all optional, but the more you fill in, the
              more confident a customer can be before contacting you).
            </p>
            <div className="vd-service-add-row vd-attribute-grid">
              {attributeDefs.map((def) => renderAttributeField(def))}
            </div>
          </>
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

        {Array.from({ length: GALLERY_SLOTS }, (_, i) => renderGallerySlot(i))}
        <p className="vd-product-image-hint">{IMAGE_HINT} • Up to 4 photos total per listing.</p>

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
                  {service.gallery_image_urls?.length ? ` 📷 +${service.gallery_image_urls.length} more` : ""}
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
