"use client";

// ===============================================================
// src/app/(main)/vendor/[slug]/page.tsx
//
// Vendor Profile dynamic route — ported faithfully from
// vendor-profile.html + vendor-profile.js.
//
// Two modes:
//   - Public view: what a customer sees
//   - Owner view: the logged-in vendor who owns this profile
//     (editable about, cover/logo upload, social links, etc.)
//
// Per Cyril's instruction: branches section NOT included here —
// that belongs in vendordashboard only.
// ===============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./vendor-profile.module.css";

// ── Plan limits (ported exactly from vendor-profile.js) ───────
const SOCIAL_LIMITS: Record<string, number> = {
  free: 0, standard: 2, enterprise: 3, elite: 5, custom: Infinity
};

const VIDEO_LIMITS: Record<string, { allowed: boolean; maxDuration: number; maxSize: number }> = {
  free:       { allowed: false, maxDuration: 0,   maxSize: 0 },
  standard:   { allowed: true,  maxDuration: 30,  maxSize: 8  * 1024 * 1024 },
  enterprise: { allowed: true,  maxDuration: 60,  maxSize: 12 * 1024 * 1024 },
  elite:      { allowed: true,  maxDuration: 90,  maxSize: 18 * 1024 * 1024 },
  custom:     { allowed: true,  maxDuration: 120, maxSize: 24 * 1024 * 1024 },
};

const DESCRIPTION_WORD_LIMITS: Record<string, number> = {
  free: 50, standard: 100, enterprise: 150, elite: 200, custom: 250
};

const SOCIAL_ICONS: Record<string, string> = {
  instagram: `<svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.8A4.2 4.2 0 1 0 16.2 12 4.2 4.2 0 0 0 12 7.8zm0 6.9A2.7 2.7 0 1 1 14.7 12 2.7 2.7 0 0 1 12 14.7zm4.4-7.8a1 1 0 1 1-1-1 1 1 0 0 1 1 1z"/></svg>`,
  facebook:  `<svg viewBox="0 0 24 24"><path d="M13 22v-9h3l1-4h-4V7a2 2 0 0 1 2-2h2V1h-3a5 5 0 0 0-5 5v3H6v4h3v9z"/></svg>`,
  tiktok:    `<svg viewBox="0 0 24 24"><path d="M16 3a6 6 0 0 0 4 4v3a9 9 0 0 1-4-1.1V15a5 5 0 1 1-5-5 4.7 4.7 0 0 1 1 .1v3a2 2 0 1 0 2 2V3z"/></svg>`,
  youtube:   `<svg viewBox="0 0 24 24"><path d="M23 7s-.2-1.7-.8-2.5a3.1 3.1 0 0 0-2.2-1.1C17.2 3 12 3 12 3s-5.2 0-8 .4a3.1 3.1 0 0 0-2.2 1.1C1.2 5.3 1 7 1 7S1 9 1 11v2c0 2 .2 4 .2 4s.2 1.7.8 2.5a3.1 3.1 0 0 0 2.2 1.1C6.8 21 12 21 12 21s5.2 0 8-.4a3.1 3.1 0 0 0 2.2-1.1c.6-.8.8-2.5.8-2.5S23 15 23 13v-2c0-2 0-4 0-4zM9.7 14.5V9.5l5.2 2.5z"/></svg>`,
  website:   `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm6.9 9h-3.2a15 15 0 0 0-1.1-5A8.1 8.1 0 0 1 18.9 11zM12 4c.9 1.3 1.6 3.3 1.8 5H10.2c.2-1.7.9-3.7 1.8-5zM4.3 13h3.2a15 15 0 0 0 1.1 5A8.1 8.1 0 0 1 4.3 13zm3.2-2H4.3a8.1 8.1 0 0 1 4.3-5 15 15 0 0 0-1.1 5zM12 20c-.9-1.3-1.6-3.3-1.8-5h3.6c-.2 1.7-.9 3.7-1.8 5zm2.4-2a15 15 0 0 0 1.1-5h3.2a8.1 8.1 0 0 1-4.3 5z"/></svg>`,
};

function getSafePlanTier(plan: string | null | undefined): string {
  const valid = ["free", "standard", "enterprise", "elite", "custom"];
  return valid.includes(plan || "") ? plan! : "free";
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [hour, minute] = time.split(":");
  const h = Number(hour);
  const suffix = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

// ── Types ─────────────────────────────────────────────────────
interface Vendor {
  id: string;
  slug: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  address: string;
  phone: string;
  telephone: string;
  whatsapp: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  open_time: string;
  close_time: string;
  business_days: string;
  logo_url: string | null;
  cover_url: string | null;
  verification_status: string;
  average_rating: number;
  reviews_count: number;
  plan_tier: string;
  subscription_status: string;
  trial_started_at: string | null;
  auth_user_id: string;
  is_sponsored: boolean;
}

interface Product {
  id: string;
  slug: string;
  product_name: string;
  price: number;
  primary_image_url: string | null;
  display_order: number;
}

interface Service {
  id: string;
  slug: string;
  service_name: string;
  starting_price: number;
  short_description: string;
  representative_image_url: string | null;
  vendors: {
    slug: string; name: string; category: string; subcategory: string;
    state: string; lga: string; verification_status: string;
    average_rating: number; reviews_count: number;
  };
}

interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

interface Review {
  reviewer_name: string;
  review_text: string;
  created_at: string;
  customer_id: string | null;
}

interface SimilarBusiness {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  verification_status: string;
  average_rating: number;
  reviews_count: number;
}

interface VideoRecord {
  id: string;
  file_url: string;
}

// ── Badge helper ──────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  if (status === "blue") return <img src="/images/bluebadge.png" alt="Verified Business" style={{ width: 30, height: 30 }} />;
  if (status === "gray") return <img src="/images/graybadge.png" alt="Verified Identity" style={{ width: 30, height: 30 }} />;
  return null;
}

function SmallBadge({ status }: { status: string }) {
  if (status === "blue") return <img src="/images/bluebadge.png" alt="Verified" style={{ width: 18, height: 18 }} />;
  if (status === "gray") return <img src="/images/graybadge.png" alt="Verified" style={{ width: 18, height: 18 }} />;
  return null;
}

// ── Star renderer ─────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  return (
    <span className={styles.reviewsStars}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) return <span key={i} className={styles.starFull}>★</span>;
        if (i === full && partial > 0) {
          return (
            <span key={i} className={styles.starPartial}>
              <span className={styles.starEmpty}>★</span>
              <span className={styles.starPartialFill} style={{ width: `${Math.round(partial * 100)}%` }}>★</span>
            </span>
          );
        }
        return <span key={i} className={styles.starEmpty}>★</span>;
      })}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────
export default function VendorProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [activeBranch, setActiveBranch] = useState<any>(null);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [similarBusinesses, setSimilarBusinesses] = useState<SimilarBusiness[]>([]);
  const [videoRecord, setVideoRecord] = useState<VideoRecord | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Owner edit state
  const [description, setDescription] = useState("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [newSocialPlatform, setNewSocialPlatform] = useState("instagram");
  const [newSocialUrl, setNewSocialUrl] = useState("");

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);

  const aboutEditorRef = useRef<HTMLDivElement>(null);

  // ── Load vendor ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user || null;
      setCurrentUser(user);

      let vendorData: Vendor | null = null;

      if (slug) {
        const { data } = await supabase
          .from("vendors")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();
        vendorData = data;
      }

      if (!vendorData && user) {
        const { data } = await supabase
          .from("vendors")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        vendorData = data;
      }

      if (!vendorData) return;

      vendorData.plan_tier = getSafePlanTier(vendorData.plan_tier);

      // Branch swap: if ?branch= in URL, fetch that branch's data
      // and use it for the hero contact/address display instead of HQ.
      // Everything else (about, products, reviews) stays HQ-level.
      const branchId = searchParams.get("branch");
      if (branchId) {
        const { data: branchData } = await supabase
          .from("branches")
          .select("*")
          .eq("id", branchId)
          .eq("vendor_id", vendorData.id)
          .eq("account_status", "active")
          .maybeSingle();
        if (branchData) setActiveBranch(branchData);
      }

      // Trial check
      if (vendorData.plan_tier === "free" && vendorData.trial_started_at) {
        const start = new Date(vendorData.trial_started_at);
        const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
        setTrialActive(diffDays <= 90);
      }

      const owner = !!(user && vendorData.auth_user_id === user.id);
      setIsOwner(owner);
      setVendor(vendorData);
      setDescription(vendorData.description || "");

      // Analytics: profile_view (non-owner only)
      if (!owner) {
        try {
          await supabase.from("analytics_events").insert({
            vendor_id: vendorData.id,
            event_type: "profile_view",
          });
        } catch { /* non-fatal */ }
      }

      // Load related data
      loadProducts(vendorData.id);
      loadServices(vendorData.id);
      loadSocialLinks(vendorData.id);
      loadReviews(vendorData.id, false);
      loadSimilarBusinesses(vendorData);
      loadVideo(vendorData.id, vendorData.plan_tier);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ── Load products ────────────────────────────────────────────
  async function loadProducts(vendorId: string) {
    const { data } = await supabase
      .from("vendor_products")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("display_order", { ascending: true });
    setProducts(data || []);
  }

  // ── Load services ────────────────────────────────────────────
  async function loadServices(vendorId: string) {
    const { data } = await supabase
      .from("vendor_services")
      .select(`*, vendors(slug, name, category, subcategory, state, lga, verification_status, average_rating, reviews_count)`)
      .eq("vendor_id", vendorId);
    setServices(data || []);
  }

  // ── Load social links ────────────────────────────────────────
  async function loadSocialLinks(vendorId: string) {
    const { data } = await supabase
      .from("vendor_social_links")
      .select("*")
      .eq("vendor_id", vendorId);
    setSocialLinks(data || []);
  }

  // ── Load reviews ─────────────────────────────────────────────
  async function loadReviews(vendorId: string, all: boolean) {
    let query = supabase
      .from("vendor_reviews")
      .select("reviewer_name, review_text, created_at, customer_id")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });
    if (!all) query = query.limit(3);
    const { data } = await query;
    setReviews(data || []);
  }

  // ── Load similar businesses ──────────────────────────────────
  async function loadSimilarBusinesses(v: Vendor) {
    const { data } = await supabase.rpc("get_similar_businesses", {
      p_exclude_vendor_id: v.id,
      p_target_category: v.category,
      p_limit: 6,
    });
    setSimilarBusinesses(data || []);
  }

  // ── Load video ───────────────────────────────────────────────
  async function loadVideo(vendorId: string, planTier: string) {
    const limits = VIDEO_LIMITS[planTier];
    if (!limits?.allowed) { setVideoRecord(null); return; }
    const { data } = await supabase
      .from("vendor_media")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("media_type", "video")
      .limit(1);
    setVideoRecord(data?.[0] || null);
  }

  // ── Description save (owner) ─────────────────────────────────
  async function handleDescriptionBlur() {
    if (!vendor || !isOwner) return;
    const content = aboutEditorRef.current?.innerHTML || "";
    const plain = aboutEditorRef.current?.innerText?.trim() || "";
    const wordCount = plain ? plain.split(/\s+/).length : 0;
    const limit = DESCRIPTION_WORD_LIMITS[vendor.plan_tier] ?? 100;
    if (wordCount > limit) {
      alert(`Your description exceeds the ${limit}-word limit for your plan. Changes were not saved.`);
      return;
    }
    setIsSavingDescription(true);
    await supabase.from("vendors").update({ description: content }).eq("id", vendor.id);
    setIsSavingDescription(false);
  }

  // ── Rich text formatting ─────────────────────────────────────
  function applyFormat(cmd: "bold" | "italic" | "underline") {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const tag = cmd === "bold" ? "strong" : cmd === "italic" ? "em" : "u";
    const el = document.createElement(tag);
    el.appendChild(range.extractContents());
    range.insertNode(el);
  }

  // ── Social link add ──────────────────────────────────────────
  async function handleAddSocial() {
    if (!vendor) return;
    let url = newSocialUrl.trim();
    if (!url) { alert("Please enter a link."); return; }
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
    try { new URL(url); } catch { alert("Invalid link format."); return; }

    const effectiveLimit = vendor.plan_tier === "free"
      ? (trialActive ? 1 : 0)
      : (SOCIAL_LIMITS[vendor.plan_tier] ?? 0);

    if (socialLinks.length >= effectiveLimit) {
      alert("You have reached the maximum number of social links allowed for your plan.");
      return;
    }
    const { error } = await supabase.from("vendor_social_links")
      .insert({ vendor_id: vendor.id, platform: newSocialPlatform, url });
    if (!error) {
      setNewSocialUrl("");
      loadSocialLinks(vendor.id);
    }
  }

  // ── Social link delete ───────────────────────────────────────
  async function handleDeleteSocial(id: string) {
    const { error } = await supabase.from("vendor_social_links").delete().eq("id", id);
    if (!error && vendor) loadSocialLinks(vendor.id);
  }

  // ── Cover/logo upload ────────────────────────────────────────
  async function handleCoverUpload(file: File) {
    if (!vendor) return;
    if (file.size > 1 * 1024 * 1024) { alert("Cover image must be 1MB or smaller."); return; }
    if (vendor.cover_url) {
      const oldPath = vendor.cover_url.split("/vendor-branding/")[1];
      if (oldPath) await supabase.storage.from("vendor-branding").remove([oldPath]);
    }
    const path = `${vendor.id}/cover/cover-${Date.now()}.${file.name.split(".").pop()}`;
    await supabase.storage.from("vendor-branding").upload(path, file, { upsert: true });
    const { data: urlData } = supabase.storage.from("vendor-branding").getPublicUrl(path);
    await supabase.from("vendors").update({ cover_url: urlData.publicUrl }).eq("id", vendor.id);
    setVendor(v => v ? { ...v, cover_url: urlData.publicUrl } : v);
  }

  async function handleLogoUpload(file: File) {
    if (!vendor) return;
    if (file.size > 1 * 1024 * 1024) { alert("Logo image must be 1MB or smaller."); return; }
    if (vendor.logo_url) {
      const oldPath = vendor.logo_url.split("/vendor-branding/")[1];
      if (oldPath) await supabase.storage.from("vendor-branding").remove([oldPath]);
    }
    const path = `${vendor.id}/logo/logo-${Date.now()}.${file.name.split(".").pop()}`;
    await supabase.storage.from("vendor-branding").upload(path, file, { upsert: true });
    const { data: urlData } = supabase.storage.from("vendor-branding").getPublicUrl(path);
    await supabase.from("vendors").update({ logo_url: urlData.publicUrl }).eq("id", vendor.id);
    setVendor(v => v ? { ...v, logo_url: urlData.publicUrl } : v);
  }

  async function handleDeleteCover() {
    if (!vendor || !confirm("Delete cover image?")) return;
    if (vendor.cover_url) {
      const oldPath = vendor.cover_url.split("/vendor-branding/")[1];
      if (oldPath) await supabase.storage.from("vendor-branding").remove([oldPath]);
    }
    await supabase.from("vendors").update({ cover_url: null }).eq("id", vendor.id);
    setVendor(v => v ? { ...v, cover_url: null } : v);
  }

  async function handleDeleteLogo() {
    if (!vendor || !confirm("Delete logo image?")) return;
    if (vendor.logo_url) {
      const oldPath = vendor.logo_url.split("/vendor-branding/")[1];
      if (oldPath) await supabase.storage.from("vendor-branding").remove([oldPath]);
    }
    await supabase.from("vendors").update({ logo_url: null }).eq("id", vendor.id);
    setVendor(v => v ? { ...v, logo_url: null } : v);
  }

  // ── Video upload ─────────────────────────────────────────────
  async function handleVideoUpload(file: File) {
    if (!vendor) return;
    const limits = VIDEO_LIMITS[vendor.plan_tier];
    if (!limits.allowed) { alert("Video upload not available on this plan."); return; }
    if (file.type !== "video/mp4") { alert("Only MP4 videos are allowed."); return; }
    if (file.size > limits.maxSize) { alert("Video file exceeds the maximum size allowed for your plan."); return; }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);
    await new Promise(resolve => { video.onloadedmetadata = resolve; });

    if (video.duration > limits.maxDuration) {
      alert("Video duration exceeds the maximum allowed for your plan.");
      return;
    }
    const long = Math.max(video.videoWidth, video.videoHeight);
    const short = Math.min(video.videoWidth, video.videoHeight);
    if (long > 1280 || short > 720) {
      alert("Video resolution must be 720p or lower.");
      return;
    }

    // Remove existing video
    if (videoRecord) {
      const oldPath = videoRecord.file_url.split("/vendor-videos/")[1];
      if (oldPath) await supabase.storage.from("vendor-videos").remove([oldPath]);
      await supabase.from("vendor_media").delete().eq("id", videoRecord.id);
    }

    const videoPath = `${vendor.id}/video/video-${Date.now()}.mp4`;
    await supabase.storage.from("vendor-videos").upload(videoPath, file);
    const { data: urlData } = supabase.storage.from("vendor-videos").getPublicUrl(videoPath);
    await supabase.from("vendor_media").insert({
      vendor_id: vendor.id,
      media_type: "video",
      file_url: urlData.publicUrl,
      display_order: Math.floor(Date.now() / 1000),
    });
    loadVideo(vendor.id, vendor.plan_tier);
  }

  async function handleDeleteVideo() {
    if (!vendor || !videoRecord || !confirm("Delete this video?")) return;
    const oldPath = videoRecord.file_url.split("/vendor-videos/")[1];
    if (oldPath) await supabase.storage.from("vendor-videos").remove([oldPath]);
    await supabase.from("vendor_media").delete().eq("id", videoRecord.id);
    setVideoRecord(null);
  }

  // ── Review submit ────────────────────────────────────────────
  async function handleSubmitReview() {
    if (!vendor || !reviewRating || !reviewerName.trim() || !reviewText.trim()) {
      alert("Please fill in your name, rating, and review.");
      return;
    }
    setSubmittingReview(true);
    const { error } = await supabase.from("vendor_reviews").insert({
      vendor_id: vendor.id,
      reviewer_name: reviewerName.trim(),
      review_text: reviewText.trim(),
      rating: reviewRating,
    });
    setSubmittingReview(false);
    if (error) { alert("Could not submit review. Please try again."); return; }
    setReviewModalOpen(false);
    setReviewerName(""); setReviewText(""); setReviewRating(0);
    loadReviews(vendor.id, showAllReviews);
    // Update vendor rating display
    const { data: updatedVendor } = await supabase
      .from("vendors").select("average_rating, reviews_count").eq("id", vendor.id).maybeSingle();
    if (updatedVendor) setVendor(v => v ? { ...v, ...updatedVendor } : v);
  }

  // ── Analytics helpers ─────────────────────────────────────────
  async function logEvent(eventType: string) {
    if (!vendor) return;
    try { await supabase.from("analytics_events").insert({ vendor_id: vendor.id, event_type: eventType }); }
    catch { /* non-fatal */ }

    // Fire-and-forget: let the vendor know a customer just tried to
    // contact them, if they have Lead Alerts turned on (Settings
    // tab). Never blocks or breaks the actual tel:/wa.me link for
    // the visitor.
    if (eventType === "phone_click" || eventType === "whatsapp_click") {
      try {
        supabase.functions.invoke("notify-lead", {
          body: { vendor_id: vendor.id, action: eventType === "whatsapp_click" ? "whatsapp" : "call" },
        });
      } catch { /* non-fatal */ }
    }
  }

  // ── Compute effective social limit ────────────────────────────
  const effectiveSocialLimit = vendor
    ? (vendor.plan_tier === "free"
        ? (trialActive ? 1 : 0)
        : (SOCIAL_LIMITS[vendor.plan_tier] ?? 0))
    : 0;

  const videoLimits = vendor ? VIDEO_LIMITS[vendor.plan_tier] : null;

  // ── Review date helper ────────────────────────────────────────
  function getRelativeDate(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Today";
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
    const weeks = Math.min(3, Math.floor(days / 7));
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }

  if (!vendor) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading vendor profile...
      </div>
    );
  }

  const mapHref = (activeBranch?.latitude || vendor.latitude) && (activeBranch?.longitude || vendor.longitude)
    ? `https://www.google.com/maps/search/?api=1&query=${activeBranch?.latitude || vendor.latitude},${activeBranch?.longitude || vendor.longitude}`
    : (activeBranch?.address || vendor.address)
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeBranch?.address || vendor.address)}`
      : "#";

  // Location view — uses branch data when ?branch= active, HQ otherwise
  const locationView = activeBranch ? {
    name: activeBranch.branch_name || vendor.name,
    address: activeBranch.address || vendor.address,
    phone: activeBranch.phone || vendor.phone,
    whatsapp: activeBranch.whatsapp || vendor.whatsapp,
    open_time: activeBranch.open_time || vendor.open_time,
    close_time: activeBranch.close_time || vendor.close_time,
    business_days: activeBranch.business_days || vendor.business_days,
    email: vendor.email, // email stays HQ
  } : {
    name: vendor.name,
    address: vendor.address,
    phone: vendor.phone,
    whatsapp: vendor.whatsapp,
    open_time: vendor.open_time,
    close_time: vendor.close_time,
    business_days: vendor.business_days,
    email: vendor.email,
  };

  return (
    <>
      {/* HERO */}
      <section className={styles.profileHero}>

        {/* COVER */}
        <div className={styles.heroCover}>
          {vendor.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vendor.cover_url} alt="Vendor cover" style={{ opacity: 1 }} />
          )}
          {isOwner && !vendor.cover_url && (
            <div className={styles.coverPlaceholder} style={{ display: "flex" }}>
              Recommended size: 920 × 300px<br />Max size: 1MB<br />Formats: JPG, PNG, WEBP
            </div>
          )}
          {isOwner && (
            <label className={styles.cameraOverlay}>
              📷
              <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ""; }} />
            </label>
          )}
          {isOwner && vendor.cover_url && (
            <button type="button" className={styles.coverDelete} onClick={handleDeleteCover}>×</button>
          )}
        </div>

        {/* CONTENT */}
        <div className={styles.heroContent}>
          <div className={styles.vendorInfoCard}>

            {/* LOGO */}
            <div className={styles.heroLeft}>
              <div className={styles.logoWrap}>
                {vendor.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vendor.logo_url} alt={vendor.name} />
                ) : (
                  <div className={styles.logoPlaceholder}>
                    112 × 112px<br />Max: 1MB<br />JPG, PNG, WEBP
                  </div>
                )}
                {isOwner && (
                  <>
                    <label className={`${styles.cameraOverlay} ${styles.cameraOverlaySmall}`}>
                      📷
                      <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }} />
                    </label>
                    {vendor.logo_url && (
                      <button type="button" className={styles.logoDelete} onClick={handleDeleteLogo}>×</button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* VENDOR INFO */}
            <div className={styles.heroText}>
              <div className={styles.nameRow}>
                <h1>{locationView.name}</h1>
                <Badge status={vendor.verification_status} />
              </div>

              <div className={styles.metaRow}>
                <p className={styles.metaCategory}>
                  {vendor.category && vendor.subcategory ? (
                    <>{vendor.category} <span>•</span> <strong>{vendor.subcategory}</strong></>
                  ) : (
                    vendor.category || vendor.subcategory
                  )}
                </p>
                <div className={styles.reviewSummary}>
                  <span className={styles.reviewStar}>★</span>
                  <span>{Number(vendor.average_rating || 0).toFixed(1)} ({vendor.reviews_count || 0})</span>
                </div>
              </div>

              <p className={styles.addressLine}>{locationView.address}</p>

              {/* SOCIAL LINKS */}
              {socialLinks.length > 0 && (
                <div className={styles.socialLinksRow}>
                  {socialLinks.slice(0, effectiveSocialLimit).map(link => (
                    <div key={link.id} className={styles.socialItem}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.socialLink}
                        onClick={() => logEvent("external_visit")}
                        dangerouslySetInnerHTML={{ __html: SOCIAL_ICONS[link.platform] || "" }}
                      />
                      {isOwner && (
                        <button type="button" className={styles.socialDelete} onClick={() => handleDeleteSocial(link.id)}>×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className={styles.quickActions}>
            {locationView.whatsapp && (
              <a
                href={`https://wa.me/${locationView.whatsapp}`}
                className={`${styles.quickAction} ${styles.quickActionWhatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logEvent("whatsapp_click")}
              >
                <i className="fab fa-whatsapp"></i>
                <span>WhatsApp</span>
              </a>
            )}
            {(locationView.phone || locationView.whatsapp) && (
              <a
                href={`tel:${locationView.phone || locationView.whatsapp}`}
                className={styles.quickAction}
                onClick={() => logEvent("phone_click")}
              >
                <i className="fas fa-phone"></i>
                <span>Call Now</span>
              </a>
            )}
            <a
              href={mapHref}
              className={styles.quickAction}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logEvent("direction_click")}
            >
              <i className="fas fa-location-arrow"></i>
              <span>Directions</span>
            </a>
            <button
              type="button"
              className={styles.quickAction}
              onClick={() => {
                logEvent("catalog_visit");
                document.getElementById("mediaSection")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <i className="fas fa-book-open"></i>
              <span>Catalog</span>
            </button>
          </div>

          {/* SOCIAL EDITOR (owner only) */}
          {isOwner && (
            <div className={styles.socialEditorRow}>
              <div className={styles.socialEditor}>
                <div>
                  <label>Platform</label>
                  <select value={newSocialPlatform} onChange={e => setNewSocialPlatform(e.target.value)}>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="website">Website</option>
                  </select>
                </div>
                <div>
                  <label>Link</label>
                  <input
                    type="text"
                    value={newSocialUrl}
                    onChange={e => setNewSocialUrl(e.target.value)}
                    placeholder="Paste full link"
                    disabled={effectiveSocialLimit === 0}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddSocial}
                  disabled={effectiveSocialLimit === 0}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-dark)", color: "#fff", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  {effectiveSocialLimit === 0 ? "Upgrade to add links" : "Add"}
                </button>
              </div>
              <button type="button" className={styles.editProfileBtn} onClick={() => router.push("/vendordashboard")}>
                ✏️ Edit Profile
              </button>
            </div>
          )}
        </div>
      </section>

      {/* UPGRADE CTA (free owner only) */}
      {isOwner && vendor.plan_tier === "free" && (
        <section className={styles.upgradeCta}>
          <p>Upgrade your profile to make it fully editable — add photos, videos, gallery and boost visibility.</p>
          <a href="/getlisted" className={styles.upgradeBtn}>Upgrade</a>
        </section>
      )}

      {/* ABOUT */}
      <section className={styles.profileCard}>
        <h2>About the Business</h2>
        {isOwner && (
          <div className={styles.aboutToolbar}>
            <button type="button" onMouseDown={e => { e.preventDefault(); applyFormat("bold"); }}><b>B</b></button>
            <button type="button" onMouseDown={e => { e.preventDefault(); applyFormat("italic"); }}><i>I</i></button>
            <button type="button" onMouseDown={e => { e.preventDefault(); applyFormat("underline"); }}><u>U</u></button>
            {isSavingDescription && <span style={{ fontSize: 12, color: "var(--color-text-faint)", marginLeft: 8 }}>Saving...</span>}
          </div>
        )}
        {isOwner ? (
          <div
            ref={aboutEditorRef}
            className={styles.aboutEditor}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: description }}
            onBlur={handleDescriptionBlur}
          />
        ) : (
          <div className={styles.aboutView} dangerouslySetInnerHTML={{ __html: vendor.description || "" }} />
        )}

        {/* CONTACT INFO */}
        <div className={styles.businessContactInfo}>
          {(locationView.open_time || locationView.close_time) && (
            <div className={styles.contactRow}>
              <i className="far fa-clock"></i>
              <div>
                <div className={styles.businessHours}>
                  Opens {formatTime(locationView.open_time)} • Closes {formatTime(locationView.close_time)}
                </div>
                {locationView.business_days && (
                  <div className={styles.businessDays}>
                    {locationView.business_days.split(",").join(" • ")}
                  </div>
                )}
              </div>
            </div>
          )}
          {(locationView.phone || locationView.whatsapp || vendor.telephone) && (
            <div className={styles.contactRow}>
              <i className="fas fa-phone-alt"></i>
              <span>{locationView.phone || locationView.whatsapp || vendor.telephone}</span>
            </div>
          )}
          {locationView.email && (
            <div className={styles.contactRow}>
              <i className="far fa-envelope"></i>
              <span>{locationView.email}</span>
            </div>
          )}
        </div>
      </section>

      {/* MEDIA — Products, Services, Video */}
      {(products.length > 0 || services.length > 0 || (videoLimits?.allowed)) && (
        <section className={styles.profileCard} id="mediaSection">
          <h2>Products &amp; Services</h2>

          {/* PRODUCTS */}
          {products.length > 0 && (
            <>
              <h3 className={styles.servicesHeading}>Products</h3>
              <div className={styles.galleryGrid}>
                {products.map(p => (
                  <div
                    key={p.id}
                    className={styles.productCard}
                    onClick={() => router.push(`/vendor/${vendor.slug}/product/${p.slug}`)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.primary_image_url || "/images/spotlightlogo-512.png"}
                      alt={p.product_name}
                      className={styles.productImage}
                    />
                    <h3 className={styles.productTitle}>{p.product_name}</h3>
                    <p className={styles.productPrice}>₦{Number(p.price || 0).toLocaleString()}</p>
                    <div className={styles.productVendor}>
                      <span>By {vendor.name}</span>
                      <SmallBadge status={vendor.verification_status} />
                    </div>
                    <div className={styles.productRating}>
                      <i className="fa-solid fa-star"></i>
                      <span>{Number(vendor.average_rating || 0).toFixed(1)}</span>
                      <small>({vendor.reviews_count || 0})</small>
                    </div>
                    {vendor.is_sponsored && <p className={styles.productSponsored}>Sponsored</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* SERVICES */}
          {services.length > 0 && (
            <div className={styles.servicesWrap}>
              <h3 className={styles.servicesHeading}>Services</h3>
              <div className={styles.servicesList}>
                {services.map(s => (
                  <article
                    key={s.id}
                    className={styles.serviceCard}
                    onClick={() => router.push(`/vendor/${vendor.slug}/service/${s.slug}`)}
                  >
                    <h3>{s.service_name}</h3>
                    <div className={styles.serviceVendorRow}>
                      <span>By: {s.vendors?.name}</span>
                      <SmallBadge status={s.vendors?.verification_status} />
                    </div>
                    <div className={styles.serviceRating}>
                      <i className="fa-solid fa-star"></i>
                      <span>{Number(s.vendors?.average_rating || 0).toFixed(1)}</span>
                      <small>({s.vendors?.reviews_count || 0})</small>
                    </div>
                    {s.short_description && (
                      <p className={styles.serviceDescription}>
                        {s.short_description.length > 80
                          ? s.short_description.slice(0, 80) + "..."
                          : s.short_description}
                      </p>
                    )}
                    <p className={styles.servicePrice}>
                      Starting From <span>₦{Number(s.starting_price || 0).toLocaleString()}</span>
                    </p>
                    <p className={styles.serviceAddress}>
                      {s.vendors?.lga}{s.vendors?.state ? `, ${s.vendors.state}` : ""}
                    </p>
                    <span className={styles.serviceCategory}>
                      {s.vendors?.subcategory || s.vendors?.category || "Service"}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* VIDEO */}
          {videoLimits?.allowed && (isOwner || videoRecord) && (
            <div className={styles.videoWrap}>
              <h3>Business Video</h3>
              {!isOwner && <p className={styles.mediaHint}>MP4 only • Duration and size depend on subscription plan.</p>}
              {videoRecord && (
                <video
                  className={styles.vendorVideoPlayer}
                  controls
                  src={videoRecord.file_url}
                />
              )}
              {isOwner && videoRecord && (
                <div style={{ marginTop: 10, textAlign: "center" }}>
                  <button type="button" className={styles.deleteVideoBtn} onClick={handleDeleteVideo}>
                    Delete Video
                  </button>
                </div>
              )}
              {isOwner && (
                <div className={styles.videoUploader}>
                  <label htmlFor="videoInput" style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", color: "var(--color-text-primary)", cursor: "pointer" }}>
                    Upload Video
                  </label>
                  <input
                    id="videoInput"
                    type="file"
                    accept="video/mp4"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ""; }}
                  />
                  <p className={styles.mediaNoteText}>
                    MP4 only • Max {videoLimits.maxDuration}s • Max {videoLimits.maxSize / (1024 * 1024)}MB
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* REVIEWS */}
      <section className={styles.profileCard}>
        <div className={styles.reviewsHeader}>
          <h2>Reviews</h2>
          {!isOwner && (
            <button type="button" className={styles.rateBtn} onClick={() => setReviewModalOpen(true)}>
              Rate
            </button>
          )}
        </div>

        <div className={styles.reviewsSummary}>
          <Stars rating={Number(vendor.average_rating || 0)} />
          <span> {Number(vendor.average_rating || 0).toFixed(1)} ({vendor.reviews_count || 0} Reviews)</span>
        </div>

        <div className={styles.reviewsList}>
          {reviews.length === 0 ? (
            <div className={styles.noReviews}>
              No reviews yet.<br />Be the first to leave a review.
            </div>
          ) : (
            reviews.map((r, i) => {
              const initials = (r.reviewer_name || "")
                .split(" ").map(p => p.charAt(0)).join("").substring(0, 2).toUpperCase();
              return (
                <div key={i} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <div className={styles.reviewAvatar}>{initials}</div>
                    <div className={styles.reviewMeta}>
                      <div className={styles.reviewRow}>
                        <div className={styles.reviewerName}>
                          {r.reviewer_name || "Anonymous Reviewer"}
                          {r.customer_id && (
                            <span className={styles.verifiedBadge}>
                              <i className="fa-solid fa-circle-check"></i> Verified Customer
                            </span>
                          )}
                        </div>
                        <div className={styles.reviewDate}>{getRelativeDate(r.created_at)}</div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.reviewText}>{r.review_text}</div>
                </div>
              );
            })
          )}
        </div>

        {(vendor.reviews_count || 0) > 3 && (
          <button
            type="button"
            className={styles.viewAllBtn}
            onClick={() => {
              const next = !showAllReviews;
              setShowAllReviews(next);
              loadReviews(vendor.id, next);
            }}
          >
            {showAllReviews ? "Show Less" : "View all reviews"}
          </button>
        )}
      </section>

      {/* SIMILAR BUSINESSES */}
      {similarBusinesses.length > 0 && (
        <section className={styles.profileCard}>
          <h2>Explore Similar Businesses</h2>
          <div className={styles.similarGrid}>
            {similarBusinesses.map(b => (
              <a
                key={b.id}
                href={`/vendor/${b.slug}`}
                className={styles.similarCard}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.logo_url || "/images/spotlightlogo-512.png"}
                  alt={b.name}
                  className={styles.similarLogo}
                />
                <div className={styles.similarNameRow}>
                  <span className={styles.similarName}>{b.name}</span>
                  <SmallBadge status={b.verification_status} />
                </div>
                <div className={styles.similarRating}>
                  <span className={styles.similarStar}>★</span>
                  {Number(b.average_rating || 0).toFixed(1)} ({b.reviews_count || 0} Reviews)
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* REVIEW MODAL */}
      {reviewModalOpen && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setReviewModalOpen(false); }}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Leave a Review</h3>
            <div className={styles.starPicker}>
              {[1,2,3,4,5].map(n => (
                <span
                  key={n}
                  className={`${styles.starPickerItem} ${n <= (reviewHover || reviewRating) ? styles.active : ""}`}
                  onMouseEnter={() => setReviewHover(n)}
                  onMouseLeave={() => setReviewHover(0)}
                  onClick={() => setReviewRating(n)}
                >★</span>
              ))}
            </div>
            <input
              className={styles.modalInput}
              placeholder="Your name"
              value={reviewerName}
              onChange={e => setReviewerName(e.target.value)}
            />
            <textarea
              className={styles.modalTextarea}
              placeholder="Write your review..."
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancelBtn} onClick={() => setReviewModalOpen(false)}>Cancel</button>
              <button type="button" className={styles.modalSubmitBtn} onClick={handleSubmitReview} disabled={submittingReview}>
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
