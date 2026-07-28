"use client";

// ===============================================================
// src/app/(standalone)/vendordashboard/PortfolioTab.tsx
//
// Vendor Dashboard — MODULE: Portfolio.
//
// New module (no production equivalent). Cyril's brief: a CV-style
// history of past work for Service / Hybrid vendors, shown on the
// public profile below "About the Business". Design confirmed by
// Cyril directly:
//
//   "I think everyone should have 6 portfolio max not following any
//   plan limits. But, shows only 2 and a click to 'See More' reveals
//   the rest."
//
// So unlike Products/Services, there is NO plan-tier lookup here —
// every vendor (service/hybrid) gets a flat cap of 6 items. The
// "show 2 then See More" behavior lives on the PUBLIC profile page,
// not here — this tab just manages the underlying up-to-6 list.
//
// Modeled directly on ProductsTab.tsx's pending → batch-save pattern
// for consistency, but with a single image per item instead of three,
// and CV-style fields (client name, completed date) instead of price
// and key details.
// ===============================================================

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uploadVendorFile } from "@/lib/uploadVendorFile";
import type { Vendor } from "./page";

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  completed_on: string | null;
  image_url: string;
};

type PendingPortfolioItem = {
  title: string;
  description: string;
  client_name: string;
  completed_on: string;
  image_url: string;
};

const PORTFOLIO_LIMIT = 6;

const IMAGE_HINT = "Accepted: JPG, JPEG, PNG • Max: 2 MB • Minimum: 800 × 800 px";

function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname.split("/object/public/vendor-gallery/")[1];
    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
}

export default function PortfolioTab({ vendor }: { vendor: Vendor }) {
  const [savedItems, setSavedItems] = useState<PortfolioItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingPortfolioItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageLabel, setImageLabel] = useState("No file chosen");

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const clientRef = useRef<HTMLInputElement>(null);
  const completedRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const totalCount = savedItems.length + pendingItems.length;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("vendor_portfolio_items")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("display_order", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Fetch portfolio items error:", error);
      } else {
        setSavedItems((data as PortfolioItem[]) || []);
      }
      setLoadingItems(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [vendor.id]);

  function resetImage() {
    setImageUrl("");
    setImagePreview("");
    setImageLabel("No file chosen");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function resetForm() {
    if (titleRef.current) titleRef.current.value = "";
    if (descriptionRef.current) descriptionRef.current.value = "";
    if (clientRef.current) clientRef.current.value = "";
    if (completedRef.current) completedRef.current.value = "";
    resetImage();
    setEditingId(null);
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setImageLabel("Uploading...");
    setImageUploading(true);

    try {
      const result = await uploadVendorFile(file, "portfolio");
      setImageUrl(result.publicUrl || "");
      setImagePreview(result.publicUrl || "");
      setImageLabel(file.name);
    } catch (err) {
      console.error("Portfolio image upload error:", err);
      alert(err instanceof Error ? err.message : "Image upload failed.");
      setImageLabel("No file chosen");
      setImagePreview("");
      if (imageInputRef.current) imageInputRef.current.value = "";
    } finally {
      setImageUploading(false);
    }
  }

  function handleAddToPending() {
    const title = titleRef.current?.value.trim() || "";
    const description = descriptionRef.current?.value.trim() || "";
    const client = clientRef.current?.value.trim() || "";
    const completed = completedRef.current?.value.trim() || "";

    if (!title) {
      alert("A title for this work is required.");
      return;
    }

    if (!imageUrl) {
      alert("A representative image is required.");
      return;
    }

    if (totalCount >= PORTFOLIO_LIMIT) {
      alert(`You can add up to ${PORTFOLIO_LIMIT} portfolio items.`);
      return;
    }

    setPendingItems((prev) => [
      ...prev,
      {
        title,
        description,
        client_name: client,
        completed_on: completed,
        image_url: imageUrl,
      },
    ]);

    resetForm();
  }

  function handleRemovePending(index: number) {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditSaved(item: PortfolioItem) {
    setEditingId(item.id);
    setFormOpen(true);

    if (titleRef.current) titleRef.current.value = item.title || "";
    if (descriptionRef.current) descriptionRef.current.value = item.description || "";
    if (clientRef.current) clientRef.current.value = item.client_name || "";
    if (completedRef.current) completedRef.current.value = item.completed_on || "";

    setImageUrl(item.image_url || "");
    setImagePreview(item.image_url || "");
    setImageLabel(item.image_url ? `Current: ${item.image_url.split("/").pop()}` : "No file chosen");
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm("Delete this portfolio item?")) return;

    const item = savedItems.find((p) => p.id === id);
    const storagePath = storagePathFromUrl(item?.image_url);

    if (storagePath) {
      const { error: storageError } = await supabase.storage.from("vendor-gallery").remove([storagePath]);
      if (storageError) console.error(storageError);
    }

    const { error } = await supabase.from("vendor_portfolio_items").delete().eq("id", id);

    if (error) {
      alert("Unable to delete portfolio item.");
      console.error(error);
      return;
    }

    setSavedItems((prev) => prev.filter((p) => p.id !== id));

    if (editingId === id) {
      resetForm();
    }
  }

  async function handleSave() {
    if (!editingId && !pendingItems.length) {
      alert("No portfolio items to save.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const title = titleRef.current?.value.trim() || "";
        const description = descriptionRef.current?.value.trim() || "";
        const client = clientRef.current?.value.trim() || "";
        const completed = completedRef.current?.value.trim() || "";

        const { error } = await supabase
          .from("vendor_portfolio_items")
          .update({
            title,
            description,
            client_name: client || null,
            completed_on: completed || null,
            image_url: imageUrl,
          })
          .eq("id", editingId);

        if (error) throw error;

        setSavedItems((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? {
                  ...p,
                  title,
                  description,
                  client_name: client || null,
                  completed_on: completed || null,
                  image_url: imageUrl,
                }
              : p
          )
        );

        resetForm();
        alert("Portfolio item updated successfully.");
        return;
      }

      const payload = pendingItems.map((p, index) => ({
        vendor_id: vendor.id,
        title: p.title,
        description: p.description || null,
        client_name: p.client_name || null,
        completed_on: p.completed_on || null,
        image_url: p.image_url,
        display_order: savedItems.length + index,
      }));

      const { data, error } = await supabase.from("vendor_portfolio_items").insert(payload).select();

      if (error) throw error;

      setSavedItems((prev) => [...prev, ...((data as PortfolioItem[]) || [])]);
      setPendingItems([]);
      alert("Portfolio saved successfully.");
    } catch (err) {
      console.error("Save portfolio error:", err);
      alert("Unable to save portfolio items.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="vd-card vd-profile-card">
      <div className="vd-profile-header">
        <div>
          <h3>Portfolio</h3>
          <p className="vd-profile-subtext">
            Showcase past work for prospects — a CV for your business. Up to {PORTFOLIO_LIMIT} items, shown 2 at a
            time on your public profile with a &quot;See More&quot; to reveal the rest.
          </p>
        </div>

        <button type="button" className="vd-service-btn" onClick={() => setFormOpen((v) => !v)}>
          <i className="fa-solid fa-plus"></i> Add Portfolio Item
        </button>
      </div>

      <div className={`vd-inline-editor${formOpen ? " active" : ""}`}>
        <div className="vd-service-add-row">
          <input type="text" ref={titleRef} className="vd-input" placeholder="e.g. Office rebrand for Acme Ltd" />
        </div>

        <div className="vd-service-description-row">
          <textarea
            ref={descriptionRef}
            className="vd-textarea"
            rows={3}
            placeholder="Briefly describe the work you did"
          />
        </div>

        <div className="vd-service-add-row">
          <input type="text" ref={clientRef} className="vd-input" placeholder="Client name (optional)" />
        </div>

        <div className="vd-service-add-row">
          <input
            type="text"
            ref={completedRef}
            className="vd-input"
            placeholder="Completed (e.g. March 2026, optional)"
          />
        </div>

        <div className="vd-product-image-row">
          <div className="vd-product-image-label">Representative Image</div>

          <label htmlFor="portfolioImage" className="vd-product-image-btn">
            Choose Image
          </label>

          <input
            type="file"
            id="portfolioImage"
            accept="image/*"
            ref={imageInputRef}
            onChange={handleImageChange}
          />

          <span className="vd-product-image-name">{imageLabel}</span>

          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt="Portfolio item preview"
              style={{
                width: 56,
                height: 56,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                marginLeft: 10,
                opacity: imageUploading ? 0.5 : 1,
              }}
            />
          )}
        </div>

        <p className="vd-product-image-hint">{IMAGE_HINT}</p>

        <div className="vd-service-add-actions">
          <button type="button" className="vd-service-btn" disabled={!!editingId} onClick={handleAddToPending}>
            {editingId ? "Editing..." : "Add"}
          </button>
        </div>

        <p className="vd-service-limit-text">{`You can add up to ${PORTFOLIO_LIMIT} portfolio items.`}</p>

        {/* PENDING ITEMS */}
        <div className="vd-pending-services">
          {pendingItems.map((item, index) => (
            <div className="vd-service-pill" key={index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="vd-service-image" src={item.image_url} alt={item.title} />

              <div className="vd-service-content">
                <div className="vd-service-name">{item.title}</div>
                {item.description && <div className="vd-service-description">{item.description}</div>}
                {item.client_name && <div className="vd-product-price">{item.client_name}</div>}
              </div>

              <button type="button" className="vd-remove-product-btn" onClick={() => handleRemovePending(index)}>
                ×
              </button>
            </div>
          ))}
        </div>

        {/* SAVED ITEMS */}
        <div className="vd-saved-services">
          {loadingItems ? (
            <div className="vd-empty-services">Loading portfolio...</div>
          ) : savedItems.length === 0 ? (
            <div className="vd-empty-services">No saved portfolio items yet.</div>
          ) : (
            savedItems.map((item) => (
              <div className="vd-service-pill saved" key={item.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="vd-product-thumb" src={item.image_url} alt={item.title} />

                <div className="vd-service-content">
                  <div className="vd-service-name">{item.title}</div>
                  <div className="vd-service-description">
                    {(item.description || "").length > 200
                      ? `${(item.description || "").slice(0, 200)}...`
                      : item.description || ""}
                  </div>
                  {(item.client_name || item.completed_on) && (
                    <div className="vd-product-price">
                      {[item.client_name, item.completed_on].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>

                <button type="button" className="vd-edit-product-btn" onClick={() => handleEditSaved(item)}>
                  Edit
                </button>

                <button type="button" className="vd-delete-product-btn" onClick={() => handleDeleteSaved(item.id)}>
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div className="vd-profile-actions">
          <button type="button" className="vd-service-btn" disabled={saving} onClick={handleSave}>
            {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update Item" : "Save Portfolio"}
          </button>
        </div>
      </div>
    </div>
  );
}
