"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/ProductsTab.tsx
//
// Vendor Dashboard — MODULE: Products.
//
// Faithful port of the #products section in production
// vendordashboard.html + the "PRODUCTS" blocks in vendordashboard.js,
// with three deliberate improvements over production (Cyril asked
// to pay close attention to product images specifically):
//
// 1. LIVE IMAGE PREVIEWS. Production only shows the chosen file's
//    name as text next to each of the 3 image inputs. This port
//    shows an actual thumbnail — an instant local preview the
//    moment a file is picked, then the real hosted image once
//    upload finishes — so a vendor can see the image is right
//    before saving, not just its filename.
//
// 2. FIXED: image state leaking between pending products. In
//    production, primaryProductImageUrl/secondary/tertiary are
//    plain module-level variables that only get overwritten when a
//    NEW file is chosen — clicking "Add" to stage a product never
//    resets them. Add a product with images, then add a second
//    product WITHOUT choosing new images, and production silently
//    reuses the first product's image URLs for the second. Fixed
//    here by resetting all three image slots (state + file input +
//    preview) every time a product is pushed to the pending list.
//
// 3. FIXED: the pending list's "×" remove button. In production,
//    `.vd-remove-product-btn` is rendered with a `data-index`
//    attribute but no click listener anywhere in vendordashboard.js
//    ever reads it — the button is completely dead. Wired up here.
//
// Everything else (plan-based product limits, the trial-active
// override, required-field validation, edit/update-in-place,
// delete-with-storage-cleanup, and the pending → batch-save flow)
// is a faithful port of production's exact behavior.
// ===============================================================

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import { supabase } from "@/lib/supabase";
import { uploadVendorFile } from "@/lib/uploadVendorFile";
import AiDescribeModal, { useAiDescribeToast } from "@/components/AiDescribeModal";
import SearchableSelect from "@/components/SearchableSelect";
import type { Vendor } from "./page";

type Option = { id: string; name: string };

// Category-specific spec fields (Jiji-style — RAM/Storage for phones,
// Make/Model/Year for vehicles, etc.), 2026-08 per Cyril. Defined per
// product category in product_attributes; the form below renders
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

type VendorProduct = {
  id: string;
  product_name: string;
  short_description: string | null;
  price: number;
  primary_image_url: string;
  secondary_image_url: string | null;
  tertiary_image_url: string | null;
  gallery_image_urls: string[] | null;
  key_details: string | null;
  attributes: AttributeValues | null;
  category_id: string | null;
  subcategory_id: string | null;
  brand: string | null;
  variant: string | null;
  moderation_status?: string | null;
  moderation_flag_reason?: string | null;
};

type PendingProduct = {
  product_name: string;
  short_description: string;
  price: number;
  primary_image_url: string;
  secondary_image_url: string | null;
  tertiary_image_url: string | null;
  gallery_image_urls: string[];
  key_details: string;
  attributes: AttributeValues;
  category_id: string;
  subcategory_id: string;
  brand: string;
  variant: string;
};

// Composes the product's display name from Brand + Model/Variant +
// Subcategory (e.g. "Samsung 15-inch Television"), skipping any part
// the vendor left blank. Subcategory is the only mandatory piece —
// unlike Services, Products aren't locked to a single name per
// subcategory, since brand/variant naturally differentiate multiple
// products in the same subcategory (e.g. two different TV models).
function composeProductName(brand: string, variant: string, subcategoryName: string): string {
  return [brand.trim(), variant.trim(), subcategoryName.trim()].filter(Boolean).join(" ");
}

// Matches production's PRODUCT_LIMITS exactly.
const PRODUCT_LIMITS: Record<string, number> = {
  trial: 5,
  free: 2,
  standard: 25,
  enterprise: 50,
  elite: 100,
  custom: Infinity,
};

function getProductLimit(planTier: string): number {
  return PRODUCT_LIMITS[planTier] ?? 1;
}

// Matches production's 90-day free-trial override exactly.
function isTrialActive(vendor: Vendor): boolean {
  if ((vendor.plan_tier || "free") !== "free" || !vendor.trial_started_at) return false;
  const start = new Date(vendor.trial_started_at);
  const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 90;
}

// Supabase/Postgrest errors are plain objects with a `.message`
// string — they are NOT instances of the native Error class, so a
// bare `err instanceof Error` check (as this file used to have)
// always falls through to the generic fallback text, silently
// hiding the real reason a save failed (e.g. a restricted-item
// trigger rejection, or a DB constraint violation). This checks for
// a usable message on either shape before giving up and showing the
// generic fallback.
function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

// Extracts the storage path from a public URL so it can be removed
// from the "vendor-gallery" bucket on delete — same regex approach
// production uses.
function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname.split("/object/public/vendor-gallery/")[1];
    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
}

type ImageSlot = "primary" | "secondary" | "tertiary";

const IMAGE_HINT = "Accepted: JPG, JPEG, PNG • Max: 2 MB • Minimum: 800 × 800 px";

export default function ProductsTab({ vendor }: { vendor: Vendor }) {
  const [savedProducts, setSavedProducts] = useState<VendorProduct[]>([]);
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [primaryUrl, setPrimaryUrl] = useState("");
  const [secondaryUrl, setSecondaryUrl] = useState("");
  const [tertiaryUrl, setTertiaryUrl] = useState("");
  const [primaryPreview, setPrimaryPreview] = useState("");
  const [secondaryPreview, setSecondaryPreview] = useState("");
  const [tertiaryPreview, setTertiaryPreview] = useState("");
  const [primaryUploading, setPrimaryUploading] = useState(false);
  const [secondaryUploading, setSecondaryUploading] = useState(false);
  const [tertiaryUploading, setTertiaryUploading] = useState(false);
  const [primaryLabel, setPrimaryLabel] = useState("No file chosen");
  const [secondaryLabel, setSecondaryLabel] = useState("No file chosen");
  const [tertiaryLabel, setTertiaryLabel] = useState("No file chosen");

  // GALLERY — images 4-8, all optional (2026-08 per Cyril: "more room
  // for images", matching Jiji's fuller photo gallery). Primary/
  // secondary/tertiary above stay as images 1-3; these 5 extra slots
  // are stored in vendor_products.gallery_image_urls.
  const GALLERY_SLOTS = 5;
  const [galleryUrls, setGalleryUrls] = useState<string[]>(Array(GALLERY_SLOTS).fill(""));
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>(Array(GALLERY_SLOTS).fill(""));
  const [galleryUploading, setGalleryUploading] = useState<boolean[]>(Array(GALLERY_SLOTS).fill(false));
  const [galleryLabels, setGalleryLabels] = useState<string[]>(Array(GALLERY_SLOTS).fill("No file chosen"));
  const galleryInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const { showToast, toastNode } = useAiDescribeToast();

  // CATEGORY + SUBCATEGORY (products taxonomy only — kind = 'product')
  const [categories, setCategories] = useState<Option[]>([]);
  const [subcategories, setSubcategories] = useState<Option[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  // SPEC FIELDS — category-specific attribute definitions + the
  // vendor's entered values for whichever category is selected.
  const [attributeDefs, setAttributeDefs] = useState<AttributeDef[]>([]);
  const [attributeValues, setAttributeValues] = useState<AttributeValues>({});

  const brandRef = useRef<HTMLInputElement>(null);
  const variantRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const keyDetailsRef = useRef<HTMLTextAreaElement>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const tertiaryInputRef = useRef<HTMLInputElement>(null);

  const trialActive = isTrialActive(vendor);
  const currentLimit = trialActive ? 5 : getProductLimit(vendor.plan_tier || "free");
  const totalCount = savedProducts.length + pendingProducts.length;

  // Categories already in use (saved or pending) — informational nudge
  // only, never a block. See ServicesTab for the same pattern/rationale.
  const usedCategoryIds = new Set([
    ...savedProducts.map((p) => p.category_id).filter(Boolean),
    ...pendingProducts.map((p) => p.category_id).filter(Boolean),
  ]);
  const isDifferentField = !!categoryId && usedCategoryIds.size > 0 && !usedCategoryIds.has(categoryId);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name")
        .eq("kind", "product")
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
        .from("product_attributes")
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
        .from("vendor_products")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("display_order", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Fetch products error:", error);
      } else {
        setSavedProducts((data as VendorProduct[]) || []);
      }
      setLoadingProducts(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [vendor.id]);

  function resetImageSlot(slot: ImageSlot) {
    if (slot === "primary") {
      setPrimaryUrl("");
      setPrimaryPreview("");
      setPrimaryLabel("No file chosen");
      if (primaryInputRef.current) primaryInputRef.current.value = "";
    } else if (slot === "secondary") {
      setSecondaryUrl("");
      setSecondaryPreview("");
      setSecondaryLabel("No file chosen");
      if (secondaryInputRef.current) secondaryInputRef.current.value = "";
    } else {
      setTertiaryUrl("");
      setTertiaryPreview("");
      setTertiaryLabel("No file chosen");
      if (tertiaryInputRef.current) tertiaryInputRef.current.value = "";
    }
  }

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
    if (brandRef.current) brandRef.current.value = "";
    if (variantRef.current) variantRef.current.value = "";
    if (descriptionRef.current) descriptionRef.current.value = "";
    if (priceRef.current) priceRef.current.value = "";
    if (keyDetailsRef.current) keyDetailsRef.current.value = "";
    resetImageSlot("primary");
    resetImageSlot("secondary");
    resetImageSlot("tertiary");
    for (let i = 0; i < GALLERY_SLOTS; i++) resetGallerySlot(i);
    setEditingId(null);
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>, slot: ImageSlot) {
    const file = e.target.files?.[0];
    if (!file) return;

    const setUploading =
      slot === "primary" ? setPrimaryUploading : slot === "secondary" ? setSecondaryUploading : setTertiaryUploading;
    const setUrl = slot === "primary" ? setPrimaryUrl : slot === "secondary" ? setSecondaryUrl : setTertiaryUrl;
    const setPreview =
      slot === "primary" ? setPrimaryPreview : slot === "secondary" ? setSecondaryPreview : setTertiaryPreview;
    const setLabel = slot === "primary" ? setPrimaryLabel : slot === "secondary" ? setSecondaryLabel : setTertiaryLabel;
    const inputRef = slot === "primary" ? primaryInputRef : slot === "secondary" ? secondaryInputRef : tertiaryInputRef;

    // Instant local preview while the real upload runs in the background —
    // the improvement over production, which only shows the filename.
    setPreview(URL.createObjectURL(file));
    setLabel("Uploading...");
    setUploading(true);

    try {
      const result = await uploadVendorFile(file, "product");
      setUrl(result.publicUrl || "");
      setPreview(result.publicUrl || "");
      setLabel(file.name);
    } catch (err) {
      console.error(`${slot} product image upload error:`, err);
      alert(err instanceof Error ? err.message : "Image upload failed.");
      setLabel("No file chosen");
      setPreview("");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  async function handleGalleryImageChange(e: ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0];
    if (!file) return;

    setGalleryPreviews((prev) => prev.map((v, i) => (i === index ? URL.createObjectURL(file) : v)));
    setGalleryLabels((prev) => prev.map((v, i) => (i === index ? "Uploading..." : v)));
    setGalleryUploading((prev) => prev.map((v, i) => (i === index ? true : v)));

    try {
      const result = await uploadVendorFile(file, "product");
      setGalleryUrls((prev) => prev.map((v, i) => (i === index ? result.publicUrl || "" : v)));
      setGalleryPreviews((prev) => prev.map((v, i) => (i === index ? result.publicUrl || "" : v)));
      setGalleryLabels((prev) => prev.map((v, i) => (i === index ? file.name : v)));
    } catch (err) {
      console.error(`Gallery image ${index + 4} upload error:`, err);
      alert(err instanceof Error ? err.message : "Image upload failed.");
      setGalleryLabels((prev) => prev.map((v, i) => (i === index ? "No file chosen" : v)));
      setGalleryPreviews((prev) => prev.map((v, i) => (i === index ? "" : v)));
      if (galleryInputRefs.current[index]) galleryInputRefs.current[index]!.value = "";
    } finally {
      setGalleryUploading((prev) => prev.map((v, i) => (i === index ? false : v)));
    }
  }

  function handleAddToPending() {
    const brand = brandRef.current?.value.trim() || "";
    const variant = variantRef.current?.value.trim() || "";
    const description = descriptionRef.current?.value.trim() || "";
    const price = priceRef.current?.value.trim() || "";
    const keyDetails = keyDetailsRef.current?.value.trim() || "";

    if (!categoryId || !subcategoryId) {
      alert("Select a category and subcategory for this product.");
      return;
    }

    const subcategoryName = subcategories.find((s) => s.id === subcategoryId)?.name || "";
    const name = composeProductName(brand, variant, subcategoryName);

    if (!description || !price) {
      alert("Product description and price are required.");
      return;
    }

    if (!primaryUrl) {
      alert("Primary product image is required.");
      return;
    }

    if (totalCount >= currentLimit) {
      alert(`Your plan allows only ${currentLimit} products.`);
      return;
    }

    setPendingProducts((prev) => [
      ...prev,
      {
        product_name: name,
        short_description: description,
        price: Number(price),
        primary_image_url: primaryUrl,
        secondary_image_url: secondaryUrl || null,
        tertiary_image_url: tertiaryUrl || null,
        gallery_image_urls: galleryUrls.filter(Boolean),
        key_details: keyDetails,
        attributes: attributeValues,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        brand,
        variant,
      },
    ]);

    resetForm();
  }

  function handleRemovePending(index: number) {
    setPendingProducts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditSaved(product: VendorProduct) {
    setEditingId(product.id);
    setFormOpen(true);

    pendingEditSubcategoryId.current = product.subcategory_id;
    pendingEditAttributeValues.current = product.attributes || {};
    setCategoryId(product.category_id || "");
    if (!product.category_id) setSubcategoryId(product.subcategory_id || "");

    if (brandRef.current) brandRef.current.value = product.brand || "";
    if (variantRef.current) variantRef.current.value = product.variant || "";
    if (descriptionRef.current) descriptionRef.current.value = product.short_description || "";
    if (priceRef.current) priceRef.current.value = product.price != null ? String(product.price) : "";
    if (keyDetailsRef.current) keyDetailsRef.current.value = product.key_details || "";

    setPrimaryUrl(product.primary_image_url || "");
    setPrimaryPreview(product.primary_image_url || "");
    setPrimaryLabel(product.primary_image_url ? `Current: ${product.primary_image_url.split("/").pop()}` : "No file chosen");

    setSecondaryUrl(product.secondary_image_url || "");
    setSecondaryPreview(product.secondary_image_url || "");
    setSecondaryLabel(
      product.secondary_image_url ? `Current: ${product.secondary_image_url.split("/").pop()}` : "No file chosen"
    );

    setTertiaryUrl(product.tertiary_image_url || "");
    setTertiaryPreview(product.tertiary_image_url || "");
    setTertiaryLabel(
      product.tertiary_image_url ? `Current: ${product.tertiary_image_url.split("/").pop()}` : "No file chosen"
    );

    const gallery = product.gallery_image_urls || [];
    setGalleryUrls(Array.from({ length: GALLERY_SLOTS }, (_, i) => gallery[i] || ""));
    setGalleryPreviews(Array.from({ length: GALLERY_SLOTS }, (_, i) => gallery[i] || ""));
    setGalleryLabels(
      Array.from({ length: GALLERY_SLOTS }, (_, i) => (gallery[i] ? `Current: ${gallery[i].split("/").pop()}` : "No file chosen"))
    );
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm("Delete this product?")) return;

    const product = savedProducts.find((p) => p.id === id);
    const storagePaths = [
      product?.primary_image_url,
      product?.secondary_image_url,
      product?.tertiary_image_url,
      ...(product?.gallery_image_urls || []),
    ]
      .map(storagePathFromUrl)
      .filter((p): p is string => Boolean(p));

    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage.from("vendor-gallery").remove(storagePaths);
      if (storageError) console.error(storageError);
    }

    const { error } = await supabase.from("vendor_products").delete().eq("id", id);

    if (error) {
      alert("Unable to delete product.");
      console.error(error);
      return;
    }

    setSavedProducts((prev) => prev.filter((p) => p.id !== id));

    if (editingId === id) {
      resetForm();
    }
  }

  async function handleSave() {
    if (!editingId && !pendingProducts.length) {
      alert("No products to save.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        if (!categoryId || !subcategoryId) {
          alert("Select a category and subcategory for this product.");
          setSaving(false);
          return;
        }

        const brand = brandRef.current?.value.trim() || "";
        const variant = variantRef.current?.value.trim() || "";
        const subcategoryName = subcategories.find((s) => s.id === subcategoryId)?.name || "";
        const name = composeProductName(brand, variant, subcategoryName);
        const description = descriptionRef.current?.value.trim() || "";
        const price = Number(priceRef.current?.value || 0);
        const keyDetails = keyDetailsRef.current?.value.trim() || "";

        const galleryToSave = galleryUrls.filter(Boolean);

        const { error } = await supabase
          .from("vendor_products")
          .update({
            product_name: name,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            brand,
            variant,
            short_description: description,
            price,
            key_details: keyDetails,
            attributes: attributeValues,
            primary_image_url: primaryUrl,
            secondary_image_url: secondaryUrl || null,
            tertiary_image_url: tertiaryUrl || null,
            gallery_image_urls: galleryToSave,
          })
          .eq("id", editingId);

        if (error) throw error;

        const { data: refreshed } = await supabase
          .from("vendor_products")
          .select("moderation_status, moderation_flag_reason")
          .eq("id", editingId)
          .single();

        setSavedProducts((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? {
                  ...p,
                  product_name: name,
                  category_id: categoryId,
                  subcategory_id: subcategoryId,
                  brand,
                  variant,
                  short_description: description,
                  price,
                  key_details: keyDetails,
                  attributes: attributeValues,
                  primary_image_url: primaryUrl,
                  secondary_image_url: secondaryUrl || null,
                  tertiary_image_url: tertiaryUrl || null,
                  gallery_image_urls: galleryToSave,
                  moderation_status: refreshed?.moderation_status ?? p.moderation_status,
                  moderation_flag_reason: refreshed?.moderation_flag_reason ?? p.moderation_flag_reason,
                }
              : p
          )
        );

        resetForm();
        alert(
          refreshed?.moderation_status === "pending_review"
            ? "Product updated. It's now pending review because it falls under a regulated category, and will go live once approved."
            : "Product updated successfully."
        );
        return;
      }

      const payload = pendingProducts.map((p) => ({
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        product_name: p.product_name,
        category_id: p.category_id,
        subcategory_id: p.subcategory_id,
        brand: p.brand,
        variant: p.variant,
        short_description: p.short_description,
        price: p.price,
        primary_image_url: p.primary_image_url,
        secondary_image_url: p.secondary_image_url,
        tertiary_image_url: p.tertiary_image_url,
        gallery_image_urls: p.gallery_image_urls,
        key_details: p.key_details,
        attributes: p.attributes,
      }));

      const { data, error } = await supabase.from("vendor_products").insert(payload).select();

      if (error) throw error;

      setSavedProducts((prev) => [...prev, ...((data as VendorProduct[]) || [])]);
      setPendingProducts([]);

      const anyPending = ((data as VendorProduct[]) || []).some((p) => p.moderation_status === "pending_review");
      alert(
        anyPending
          ? "Products saved. One or more fall under a regulated category and are pending review — they'll go live once approved."
          : "Products saved successfully."
      );
    } catch (err) {
      console.error("Save product error:", err);
      alert(getErrorMessage(err, "Unable to save products."));
    } finally {
      setSaving(false);
    }
  }

  function renderImageSlot(
    slot: ImageSlot,
    label: string,
    inputId: string,
    preview: string,
    fileLabel: string,
    uploading: boolean,
    inputRef: RefObject<HTMLInputElement | null>
  ) {
    return (
      <>
        <div className="vd-product-image-row">
          <div className="vd-product-image-label">{label}</div>

          <label htmlFor={inputId} className="vd-product-image-btn">
            Choose Image
          </label>

          <input
            type="file"
            id={inputId}
            accept="image/*"
            ref={inputRef}
            onChange={(e) => handleImageChange(e, slot)}
          />

          <span className="vd-product-image-name">{fileLabel}</span>

          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={`${label} preview`}
              style={{
                width: 56,
                height: 56,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                marginLeft: 10,
                opacity: uploading ? 0.5 : 1,
              }}
            />
          )}
        </div>

        <p className="vd-product-image-hint">{IMAGE_HINT}</p>
      </>
    );
  }

  function renderGallerySlot(index: number) {
    const inputId = `galleryProductImage${index}`;
    return (
      <div key={index}>
        <div className="vd-product-image-row">
          <div className="vd-product-image-label">{`Additional Image ${index + 4} (optional)`}</div>

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
              alt={`Additional image ${index + 4} preview`}
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
  // dropdown. Categories with no definitions yet (most, for now — see
  // Cyril 2026-08 rollout) simply render nothing here.
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
          <h3>Product Catalogue</h3>
          <p className="vd-profile-subtext">Add and manage the products your business sells.</p>
        </div>

        <button type="button" className="vd-service-btn" onClick={() => setFormOpen((v) => !v)}>
          <i className="fa-solid fa-plus"></i> Add Product
        </button>
      </div>

      <div className={`vd-inline-editor${formOpen ? " active" : ""}`}>
        <p className="vd-helper-text">
          Choose a category and subcategory, then add the brand and model/variant if this product has one (e.g.
          Brand: &quot;Samsung&quot;, Model/Variant: &quot;15-inch&quot;, Subcategory: &quot;Television&quot; →
          &quot;Samsung 15-inch Television&quot;). Brand and model/variant are optional — leave them blank and
          the subcategory name alone becomes the product name.
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
            options={subcategories.map((s) => ({ value: s.id, label: s.name }))}
            disabled={!categoryId}
          />
        </div>

        {isDifferentField && (
          <p className="vd-field-tip">
            💡 This is a different field from your other products. That&apos;s okay if it&apos;s a real part of
            your business — just keep each listing genuine and accurate, so customers know exactly what to
            expect from you.
          </p>
        )}

        <div className="vd-service-add-row">
          <input type="text" ref={brandRef} className="vd-input" placeholder="Brand (optional)" />
          <input type="text" ref={variantRef} className="vd-input" placeholder="Model / Variant (optional)" />
        </div>

        {attributeDefs.length > 0 && (
          <>
            <p className="vd-helper-text">
              Add the specs buyers look for in this category (all optional, but the more you fill in, the more
              confident a buyer can be before contacting you).
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

          <textarea ref={descriptionRef} className="vd-textarea" rows={3} placeholder="Enter short product description" />
        </div>

        <div className="vd-service-add-row">
          <input type="number" ref={priceRef} className="vd-input" placeholder="Enter fixed selling price" />
        </div>

        {renderImageSlot(
          "primary",
          "Primary Product Image",
          "primaryProductImage",
          primaryPreview,
          primaryLabel,
          primaryUploading,
          primaryInputRef
        )}
        {renderImageSlot(
          "secondary",
          "Secondary Product Image",
          "secondaryProductImage",
          secondaryPreview,
          secondaryLabel,
          secondaryUploading,
          secondaryInputRef
        )}
        {renderImageSlot(
          "tertiary",
          "Third Product Image",
          "tertiaryProductImage",
          tertiaryPreview,
          tertiaryLabel,
          tertiaryUploading,
          tertiaryInputRef
        )}

        {Array.from({ length: GALLERY_SLOTS }, (_, i) => renderGallerySlot(i))}
        <p className="vd-product-image-hint">{IMAGE_HINT} • Up to 8 photos total per listing.</p>

        <div className="vd-service-description-row">
          <textarea
            ref={keyDetailsRef}
            className="vd-textarea"
            rows={5}
            placeholder={"Material: Leather\nColour: Black\nSize: 42"}
          />
        </div>

        <div className="vd-service-add-actions">
          <button type="button" className="vd-service-btn" disabled={!!editingId} onClick={handleAddToPending}>
            {editingId ? "Editing..." : "Add"}
          </button>
        </div>

        <p className="vd-service-limit-text">{`Your current plan allows up to ${currentLimit} products.`}</p>

        {/* PENDING PRODUCTS */}
        <div className="vd-pending-services">
          {pendingProducts.map((product, index) => (
            <div className="vd-service-pill" key={index}>
              {product.primary_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="vd-service-image" src={product.primary_image_url} alt={product.product_name} />
              ) : (
                <div className="vd-service-image-placeholder" aria-hidden="true">🖼️</div>
              )}

              <div className="vd-service-content">
                <div className="vd-service-name">{product.product_name}</div>
                {product.short_description && (
                  <div className="vd-service-description">{product.short_description}</div>
                )}
                <div className="vd-product-price">₦{Number(product.price).toLocaleString()}</div>
              </div>

              <button type="button" className="vd-remove-product-btn" onClick={() => handleRemovePending(index)}>
                ×
              </button>
            </div>
          ))}
        </div>

        {/* SAVED PRODUCTS */}
        <div className="vd-saved-services">
          {loadingProducts ? (
            <div className="vd-empty-services">Loading products...</div>
          ) : savedProducts.length === 0 ? (
            <div className="vd-empty-services">No saved products yet.</div>
          ) : (
            savedProducts.map((product) => (
              <div className="vd-service-pill saved" key={product.id}>
                {product.primary_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="vd-product-thumb" src={product.primary_image_url} alt={product.product_name} />
                ) : (
                  <div className="vd-product-thumb-placeholder" aria-hidden="true">🖼️</div>
                )}

                <div className="vd-service-content">
                  <div className="vd-service-name">
                    {product.product_name}
                    {product.moderation_status === "pending_review" && (
                      <span className="vd-pending-review-badge" title={product.moderation_flag_reason || ""}>
                        Pending Review
                      </span>
                    )}
                    {product.moderation_status === "rejected" && (
                      <span className="vd-rejected-badge" title={product.moderation_flag_reason || ""}>
                        Not Approved
                      </span>
                    )}
                  </div>
                  <div className="vd-service-description">
                    {(product.short_description || "").length > 200
                      ? `${(product.short_description || "").slice(0, 200)}...`
                      : product.short_description || ""}
                  </div>
                  <div className="vd-product-price">₦{Number(product.price).toLocaleString()}</div>
                </div>

                <button type="button" className="vd-edit-product-btn" onClick={() => handleEditSaved(product)}>
                  Edit
                </button>

                <button type="button" className="vd-delete-product-btn" onClick={() => handleDeleteSaved(product.id)}>
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div className="vd-profile-actions">
          <button type="button" className="vd-service-btn" disabled={saving} onClick={handleSave}>
            {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update Product" : "Save Products"}
          </button>
        </div>
      </div>

      <AiDescribeModal
        open={aiModalOpen}
        type="product"
        itemName={composeProductName(
          brandRef.current?.value || "",
          variantRef.current?.value || "",
          subcategories.find((s) => s.id === subcategoryId)?.name || ""
        )}
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
