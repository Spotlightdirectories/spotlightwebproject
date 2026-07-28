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
import type { Vendor } from "./page";

type VendorProduct = {
  id: string;
  product_name: string;
  short_description: string | null;
  price: number;
  primary_image_url: string;
  secondary_image_url: string | null;
  tertiary_image_url: string | null;
  key_details: string | null;
};

type PendingProduct = {
  product_name: string;
  short_description: string;
  price: number;
  primary_image_url: string;
  secondary_image_url: string | null;
  tertiary_image_url: string | null;
  key_details: string;
};

// Matches production's PRODUCT_LIMITS exactly.
const PRODUCT_LIMITS: Record<string, number> = {
  trial: 3,
  free: 1,
  standard: 6,
  enterprise: 12,
  elite: 24,
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

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const { showToast, toastNode } = useAiDescribeToast();

  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const keyDetailsRef = useRef<HTMLTextAreaElement>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const tertiaryInputRef = useRef<HTMLInputElement>(null);

  const trialActive = isTrialActive(vendor);
  const currentLimit = trialActive ? 3 : getProductLimit(vendor.plan_tier || "free");
  const totalCount = savedProducts.length + pendingProducts.length;

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

  function resetForm() {
    if (nameRef.current) nameRef.current.value = "";
    if (descriptionRef.current) descriptionRef.current.value = "";
    if (priceRef.current) priceRef.current.value = "";
    if (keyDetailsRef.current) keyDetailsRef.current.value = "";
    resetImageSlot("primary");
    resetImageSlot("secondary");
    resetImageSlot("tertiary");
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

  function handleAddToPending() {
    const name = nameRef.current?.value.trim() || "";
    const description = descriptionRef.current?.value.trim() || "";
    const price = priceRef.current?.value.trim() || "";
    const keyDetails = keyDetailsRef.current?.value.trim() || "";

    if (!name || !description || !price) {
      alert("Product name, description and price are required.");
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
        key_details: keyDetails,
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

    if (nameRef.current) nameRef.current.value = product.product_name || "";
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
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm("Delete this product?")) return;

    const product = savedProducts.find((p) => p.id === id);
    const storagePaths = [product?.primary_image_url, product?.secondary_image_url, product?.tertiary_image_url]
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
        const name = nameRef.current?.value.trim() || "";
        const description = descriptionRef.current?.value.trim() || "";
        const price = Number(priceRef.current?.value || 0);
        const keyDetails = keyDetailsRef.current?.value.trim() || "";

        const { error } = await supabase
          .from("vendor_products")
          .update({
            product_name: name,
            short_description: description,
            price,
            key_details: keyDetails,
            primary_image_url: primaryUrl,
            secondary_image_url: secondaryUrl || null,
            tertiary_image_url: tertiaryUrl || null,
          })
          .eq("id", editingId);

        if (error) throw error;

        setSavedProducts((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? {
                  ...p,
                  product_name: name,
                  short_description: description,
                  price,
                  key_details: keyDetails,
                  primary_image_url: primaryUrl,
                  secondary_image_url: secondaryUrl || null,
                  tertiary_image_url: tertiaryUrl || null,
                }
              : p
          )
        );

        resetForm();
        alert("Product updated successfully.");
        return;
      }

      const payload = pendingProducts.map((p) => ({
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        product_name: p.product_name,
        short_description: p.short_description,
        price: p.price,
        primary_image_url: p.primary_image_url,
        secondary_image_url: p.secondary_image_url,
        tertiary_image_url: p.tertiary_image_url,
        key_details: p.key_details,
      }));

      const { data, error } = await supabase.from("vendor_products").insert(payload).select();

      if (error) throw error;

      setSavedProducts((prev) => [...prev, ...((data as VendorProduct[]) || [])]);
      setPendingProducts([]);
      alert("Products saved successfully.");
    } catch (err) {
      console.error("Save product error:", err);
      alert("Unable to save products.");
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
        <div className="vd-service-add-row">
          <input type="text" ref={nameRef} className="vd-input" placeholder="Enter product name" />
        </div>

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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="vd-service-image" src={product.primary_image_url} alt={product.product_name} />

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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="vd-product-thumb" src={product.primary_image_url} alt={product.product_name} />

                <div className="vd-service-content">
                  <div className="vd-service-name">{product.product_name}</div>
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
