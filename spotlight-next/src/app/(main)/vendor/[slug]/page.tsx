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
// Branch CRUD (add/edit/delete) lives only in dashboard-branches —
// this page just shows the faithful read-only list of active
// branches under Reviews, matching production's vendor-profile.js.
// ===============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import type { KeyboardEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uploadVendorFile } from "@/lib/uploadVendorFile";
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

const BRANCH_LIMITS: Record<string, number> = {
  free: 0, standard: 0, enterprise: 10, elite: 30, custom: Infinity
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
  business_type: string | null;
}

interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  completed_on: string | null;
  image_url: string | null;
}

interface PortfolioRecommendation {
  recommender_name: string;
  recommender_company: string | null;
  message: string;
}

// Formats a "YYYY-MM-DD" value (from the dashboard's date picker) into
// "28 July 2026". Older test entries typed before this was a real date
// field won't match that shape — those just render as typed, so
// nothing already saved silently disappears or breaks.
function formatCompletedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
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

interface Branch {
  id: string;
  branch_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
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
  const [similarBusinessesLoaded, setSimilarBusinessesLoaded] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [videoRecord, setVideoRecord] = useState<VideoRecord | null>(null);
  // Faithful port fix (2026-07-31): production dims the video player to
  // 50% opacity while the browser buffers it, then restores full opacity
  // on the "loadeddata" event, so the loading state reads as "loading"
  // rather than "possibly broken." Staging's <video> element had no
  // equivalent — Cyril saw an indefinitely grayed-out player and asked
  // us to check it (the video itself was fine; only the loading feedback
  // was missing). Reset to false whenever a new/different video loads.
  const [videoLoaded, setVideoLoaded] = useState(false);
  // Cyril's ask (2026-07-31): make the video "Choose File" control a
  // real styled button instead of the native gray one — this state
  // tracks the picked filename since the native input is now hidden.
  const [videoFileName, setVideoFileName] = useState("No file chosen");

  // Cyril's ask (2026-07-31): cover and logo uploaders gave no feedback
  // between picking a file and the new image appearing — they just sat
  // static. These drive a spinner overlay for the duration of each upload.
  const [coverUploading, setCoverUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  // Cyril's ask (2026-07-31): the video "spinner" (loading-dim) only
  // appeared once the whole upload pipeline (client-side duration/
  // resolution checks, old-file cleanup, storage upload, DB insert) had
  // already finished — several seconds of silence first. This fires the
  // instant a file is picked, before any of that work starts.
  const [videoUploading, setVideoUploading] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [showAllPortfolio, setShowAllPortfolio] = useState(false);
  const [portfolioRecommendations, setPortfolioRecommendations] = useState<Record<string, PortfolioRecommendation>>({});

  // Owner edit state
  const [description, setDescription] = useState("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [newSocialPlatform, setNewSocialPlatform] = useState("instagram");
  const [newSocialUrl, setNewSocialUrl] = useState("");

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);
  // Faithful port of reviews-utils.js's cachedReviewingCustomer: checked
  // once per page load (undefined = not yet checked, null = anonymous),
  // then re-applied every time the modal opens.
  const [reviewingCustomer, setReviewingCustomer] = useState<
    { id: string; name: string; email: string } | null | undefined
  >(undefined);
  const [reviewFieldsLocked, setReviewFieldsLocked] = useState(false);

  // Favorite/"Save" button — visible only to a logged-in customer
  // viewing someone else's profile (never the owner, never anonymous).
  const [favoriteVisible, setFavoriteVisible] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCustomerId, setFavoriteCustomerId] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  // Visit Request modal (2026-08 safety feature) — unlike reviews,
  // this requires a logged-in customer identity, since the entire
  // point is giving the vendor a confirmed name + phone to check
  // before they travel to a customer's location. Cached the same way
  // as reviewingCustomer, undefined = not yet checked.
  const [visitCustomer, setVisitCustomer] = useState<
    { id: string; name: string; email: string; phone: string | null } | null | undefined
  >(undefined);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitPhone, setVisitPhone] = useState("");
  const [visitLocation, setVisitLocation] = useState("");
  const [visitMessage, setVisitMessage] = useState("");
  const [submittingVisit, setSubmittingVisit] = useState(false);
  const [visitSubmitted, setVisitSubmitted] = useState(false);

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
      loadBranches(vendorData);
      loadVideo(vendorData.id, vendorData.plan_tier);
      loadPortfolio(vendorData.id, vendorData.business_type);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ── Favorite/"Save" button init (faithful port of production's
  // initFavoriteButton, item 54) — only shown to a logged-in customer,
  // never the vendor viewing their own profile, never an anonymous
  // visitor. Depends on vendor.id (not the whole vendor object) so it
  // doesn't re-run every time vendor gets a minor field update. ────
  useEffect(() => {
    if (!vendor?.id || isOwner) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (!customer || cancelled) return; // logged in as a vendor only
      const { data: existingFavorite } = await supabase
        .from("customer_favorites")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("vendor_id", vendor.id)
        .maybeSingle();
      if (cancelled) return;
      setFavoriteCustomerId(customer.id);
      setIsFavorited(!!existingFavorite);
      setFavoriteVisible(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor?.id, isOwner]);

  // Deep-link support for the Discover page's "Review" button
  // (?review=1) — opens the review modal automatically once the
  // vendor has loaded, matching what tapping "Rate" here does.
  const reviewParamHandled = useRef(false);
  useEffect(() => {
    if (reviewParamHandled.current) return;
    if (!vendor) return;
    if (searchParams.get("review") === "1") {
      reviewParamHandled.current = true;
      openReviewModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor]);

  // Deep-link support for "Request a Visit" (?requestVisit=1) — an
  // anonymous visitor gets sent to /customer-login first (see
  // openVisitModal), then lands back here with this param, which
  // reopens the same modal automatically once they're logged in.
  const visitParamHandled = useRef(false);
  useEffect(() => {
    if (visitParamHandled.current) return;
    if (!vendor) return;
    if (searchParams.get("requestVisit") === "1") {
      visitParamHandled.current = true;
      openVisitModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor]);

  async function toggleFavorite() {
    if (!vendor || !favoriteCustomerId || favoriteBusy) return;
    setFavoriteBusy(true);
    if (isFavorited) {
      const { error } = await supabase
        .from("customer_favorites")
        .delete()
        .eq("customer_id", favoriteCustomerId)
        .eq("vendor_id", vendor.id);
      if (!error) setIsFavorited(false);
    } else {
      const { error } = await supabase
        .from("customer_favorites")
        .insert({ customer_id: favoriteCustomerId, vendor_id: vendor.id });
      if (!error) setIsFavorited(true);
    }
    setFavoriteBusy(false);
  }

  // ── Load products ────────────────────────────────────────────
  async function loadProducts(vendorId: string) {
    const { data } = await supabase
      .from("vendor_products")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("moderation_status", "approved")
      .order("display_order", { ascending: true });
    setProducts(data || []);
  }

  // ── Load portfolio (Service / Hybrid vendors only) ────────────
  async function loadPortfolio(vendorId: string, businessType: string | null | undefined) {
    if (businessType !== "service" && businessType !== "hybrid") return;
    const { data } = await supabase
      .from("vendor_portfolio_items")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("display_order", { ascending: true });
    const items: PortfolioItem[] = data || [];
    setPortfolioItems(items);

    // Verified recommendations, one lookup per item via a
    // SECURITY DEFINER function — never queries the underlying
    // vendor_recommendation_requests table directly, since that table
    // also holds the client's email and must stay private. Silently
    // skipped (Record stays empty) if the migration hasn't been run
    // yet, so Portfolio still works before Recommendations exists.
    const entries = await Promise.all(
      items.map(async (item) => {
        const { data: rec } = await supabase
          .rpc("get_portfolio_recommendation", { p_portfolio_item_id: item.id })
          .maybeSingle();
        return [item.id, rec] as const;
      })
    );
    const byItem: Record<string, PortfolioRecommendation> = {};
    for (const [id, rec] of entries) {
      if (rec) byItem[id] = rec as PortfolioRecommendation;
    }
    setPortfolioRecommendations(byItem);
  }

  // ── Load services ────────────────────────────────────────────
  async function loadServices(vendorId: string) {
    const { data } = await supabase
      .from("vendor_services")
      .select(`*, vendors(slug, name, category, subcategory, state, lga, verification_status, average_rating, reviews_count)`)
      .eq("vendor_id", vendorId)
      .eq("moderation_status", "approved");
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
    const { data, error } = await supabase.rpc("get_similar_businesses", {
      p_exclude_vendor_id: v.id,
      p_target_category: v.category,
      p_limit: 6,
    });
    if (error) {
      console.error("Similar businesses error:", error.message);
      return;
    }
    setSimilarBusinesses(data || []);
    setSimilarBusinessesLoaded(true);
  }

  // ── Load branches (read-only list, faithful port of loadBranches
  // in vendor-profile.js) ───────────────────────────────────────
  async function loadBranches(v: Vendor) {
    const { data } = await supabase
      .from("branches")
      .select("id, branch_name, address, latitude, longitude")
      .eq("vendor_id", v.id)
      .eq("account_status", "active");

    const limit = BRANCH_LIMITS[v.plan_tier] ?? 0;
    if (!data || data.length === 0 || limit === 0) {
      setBranches([]);
      return;
    }
    setBranches(data.slice(0, limit));
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
    setVideoLoaded(false);
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

  // Cyril's report (2026-07-28): "About the Business" reads as one
  // dense, unformatted block — not encouraging to read. Root cause:
  // this editor is a plain contentEditable div with no paragraph
  // handling at all. Pressing Enter in a contentEditable is notoriously
  // inconsistent across browsers (Chrome wraps lines in <div>s with no
  // margin, Firefox may use <br> or <p> depending on settings) — with
  // no CSS spacing rule for any of those, multiple "paragraphs" render
  // back to back with zero visual gap, i.e. exactly the clustered look
  // reported. Rather than relying on execCommand (deprecated, and the
  // rest of this editor already avoids it — see applyFormat above,
  // which manually wraps a DOM node instead), Enter is intercepted here
  // and reliably inserts two real <br> elements — a genuine blank line
  // — regardless of browser. Shift+Enter inserts a single line break
  // (same line spacing convention as Word/Google Docs: Enter = new
  // paragraph, Shift+Enter = line break within one paragraph).
  // NOTE: this only fixes paragraph breaks going forward — existing
  // descriptions already saved as one dense block won't automatically
  // gain breaks retroactively (there's no reliable way to guess where
  // they should go); re-typing Enter once in the existing text fixes it.
  function handleAboutKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();

    const fragment = document.createDocumentFragment();
    const breakCount = e.shiftKey ? 1 : 2;
    let lastBreak: HTMLBRElement | null = null;
    for (let i = 0; i < breakCount; i++) {
      lastBreak = document.createElement("br");
      fragment.appendChild(lastBreak);
    }
    range.insertNode(fragment);

    if (lastBreak) {
      range.setStartAfter(lastBreak);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
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
  // The "vendor-branding" storage bucket had SELECT/DELETE policies
  // but NO insert (or update, for upsert:true) policy at all — every
  // upload was silently rejected by storage RLS. The existing
  // policies also compared auth.uid() directly to the path's first
  // folder segment, which is vendor.id (the vendors table's own
  // primary key) — never equal to auth_user_id, so even delete would
  // have failed. Needs a migration (see chat) adding correct
  // insert/update/delete policies that join through vendors.
  // Below: the upload calls now check `error` and surface it instead
  // of silently continuing to write a public URL for a file that was
  // never actually saved.
  async function handleCoverUpload(file: File) {
    if (!vendor || coverUploading) return;
    setCoverUploading(true);
    try {
      let uploadResult;
      try {
        // Goes through the validate-upload Edge Function (service-role,
        // server-side type/dimension/size checks + resize), same as
        // production and every other upload in this codebase — NOT a
        // direct client-side supabase.storage.upload() call. That direct
        // call was the actual bug: the vendor-branding bucket has no
        // INSERT policy in storage RLS, so every upload was silently
        // rejected while the code still went on to save a public URL for
        // a file that was never written. Edge Function bypasses that
        // client-side RLS entirely (it uses the service role key), which
        // is exactly why production's equivalent flow already works.
        uploadResult = await uploadVendorFile(file, "cover");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Cover upload failed.");
        return;
      }
      if (vendor.cover_url) {
        const oldPath = vendor.cover_url.split("/vendor-branding/")[1];
        if (oldPath) {
          const { error } = await supabase.storage.from("vendor-branding").remove([oldPath]);
          if (error) console.error("Cover delete (storage) error:", error);
        }
      }
      const { error: updateError } = await supabase.from("vendors").update({ cover_url: uploadResult.publicUrl }).eq("id", vendor.id);
      if (updateError) { alert(`Uploaded, but could not save cover image: ${updateError.message}`); return; }
      setVendor(v => v ? { ...v, cover_url: uploadResult.publicUrl } : v);
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleLogoUpload(file: File) {
    if (!vendor || logoUploading) return;
    setLogoUploading(true);
    try {
      let uploadResult;
      try {
        uploadResult = await uploadVendorFile(file, "logo");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Logo upload failed.");
        return;
      }
      if (vendor.logo_url) {
        const oldPath = vendor.logo_url.split("/vendor-branding/")[1];
        if (oldPath) {
          const { error } = await supabase.storage.from("vendor-branding").remove([oldPath]);
          if (error) console.error("Logo delete (storage) error:", error);
        }
      }
      const { error: updateError } = await supabase.from("vendors").update({ logo_url: uploadResult.publicUrl }).eq("id", vendor.id);
      if (updateError) { alert(`Uploaded, but could not save logo: ${updateError.message}`); return; }
      setVendor(v => v ? { ...v, logo_url: uploadResult.publicUrl } : v);
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleDeleteCover() {
    if (!vendor || !confirm("Delete cover image?")) return;
    if (vendor.cover_url) {
      const oldPath = vendor.cover_url.split("/vendor-branding/")[1];
      if (oldPath) {
        const { error } = await supabase.storage.from("vendor-branding").remove([oldPath]);
        if (error) console.error("Cover delete (storage) error:", error);
      }
    }
    const { error } = await supabase.from("vendors").update({ cover_url: null }).eq("id", vendor.id);
    if (error) { alert(`Could not remove cover image: ${error.message}`); return; }
    setVendor(v => v ? { ...v, cover_url: null } : v);
  }

  async function handleDeleteLogo() {
    if (!vendor || !confirm("Delete logo image?")) return;
    if (vendor.logo_url) {
      const oldPath = vendor.logo_url.split("/vendor-branding/")[1];
      if (oldPath) {
        const { error } = await supabase.storage.from("vendor-branding").remove([oldPath]);
        if (error) console.error("Logo delete (storage) error:", error);
      }
    }
    const { error } = await supabase.from("vendors").update({ logo_url: null }).eq("id", vendor.id);
    if (error) { alert(`Could not remove logo: ${error.message}`); return; }
    setVendor(v => v ? { ...v, logo_url: null } : v);
  }

  // ── Video upload ─────────────────────────────────────────────
  async function handleVideoUpload(file: File) {
    if (!vendor || videoUploading) return;
    setVideoUploading(true);
    try {
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
      const { error: uploadError } = await supabase.storage.from("vendor-videos").upload(videoPath, file);
      if (uploadError) { alert(`Could not upload video: ${uploadError.message}`); return; }
      const { data: urlData } = supabase.storage.from("vendor-videos").getPublicUrl(videoPath);
      const { error: insertError } = await supabase.from("vendor_media").insert({
        vendor_id: vendor.id,
        media_type: "video",
        file_url: urlData.publicUrl,
        display_order: Math.floor(Date.now() / 1000),
      });
      if (insertError) { alert(`Uploaded, but could not save video: ${insertError.message}`); return; }
      await loadVideo(vendor.id, vendor.plan_tier);
    } finally {
      setVideoUploading(false);
    }
  }

  async function handleDeleteVideo() {
    if (!vendor || !videoRecord || !confirm("Delete this video?")) return;
    const oldPath = videoRecord.file_url.split("/vendor-videos/")[1];
    if (oldPath) {
      const { error: removeError } = await supabase.storage.from("vendor-videos").remove([oldPath]);
      if (removeError) console.error("Video delete (storage) error:", removeError);
    }
    const { error } = await supabase.from("vendor_media").delete().eq("id", videoRecord.id);
    if (error) { alert(`Could not remove video: ${error.message}`); return; }
    // Faithful port fix (2026-07-31): production explicitly clears the
    // player (src = "", removeAttribute("src"), player.load()) after a
    // delete, because just dropping the src via a state update doesn't
    // reliably clear the last-rendered frame in every browser — the old
    // video kept visibly "standing there" until a full page refresh,
    // which is what Cyril reported. setVideoRecord(null) below removes
    // it from the DB, and the <video> element's `key` (set from
    // videoRecord?.id) forces React to fully unmount and recreate the
    // element instead of patching the existing one, which is the React
    // equivalent of production's manual .load() reset.
    setVideoLoaded(false);
    setVideoRecord(null);
  }

  // ── Reviewing-customer lookup (faithful port of reviews-utils.js's
  // getReviewingCustomer — cached across modal opens per page load) ──
  async function getReviewingCustomer() {
    if (reviewingCustomer !== undefined) return reviewingCustomer;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setReviewingCustomer(null); return null; }
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();
    const result = customer || null;
    setReviewingCustomer(result);
    return result;
  }

  // Applies on every "Rate" click (not just first check) — auto-fills
  // and locks name/email for a signed-in customer, or clears the lock
  // for an anonymous submitter. Matches applyReviewerIdentity().
  async function openReviewModal() {
    const customer = await getReviewingCustomer();
    if (customer) {
      setReviewerName(customer.name || "");
      setReviewerEmail(customer.email || "");
      setReviewFieldsLocked(true);
    } else {
      setReviewFieldsLocked(false);
    }
    setReviewModalOpen(true);
  }

  // ── Visit Request modal (2026-08 safety feature) ──────────────
  // Requires a real, logged-in customer identity — unlike reviews,
  // there's no anonymous path here, since the whole point is giving
  // the vendor a confirmed name + phone to check before they travel.
  async function getVisitCustomer() {
    if (visitCustomer !== undefined) return visitCustomer;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setVisitCustomer(null); return null; }
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email, phone")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();
    const result = customer || null;
    setVisitCustomer(result);
    return result;
  }

  async function openVisitModal() {
    const customer = await getVisitCustomer();
    if (!customer) {
      // Not logged in as a customer — send them to log in first, then
      // straight back to this profile with ?requestVisit=1 so the
      // deep-link effect below reopens this exact modal automatically
      // (mirrors the existing ?review=1 pattern), instead of dropping
      // them on their profile with no idea why they logged in.
      router.push(`/customer-login?next=${encodeURIComponent(`/vendor/${slug}?requestVisit=1`)}`);
      return;
    }
    setVisitPhone(customer.phone || "");
    setVisitLocation("");
    setVisitMessage("");
    setVisitSubmitted(false);
    setVisitModalOpen(true);
  }

  async function handleSubmitVisit() {
    if (!vendor) return;
    const customer = await getVisitCustomer();
    if (!customer) return;
    if (!visitPhone.trim()) { alert("Please add a phone number so the vendor can confirm it's really you."); return; }
    if (!visitLocation.trim()) { alert("Please add the location or address for the visit."); return; }

    setSubmittingVisit(true);

    // Keep the customer's phone on file up to date for next time.
    if (visitPhone.trim() !== (customer.phone || "")) {
      await supabase.from("customers").update({ phone: visitPhone.trim() }).eq("id", customer.id);
      setVisitCustomer({ ...customer, phone: visitPhone.trim() });
    }

    const { data: created, error } = await supabase.from("visit_requests").insert({
      vendor_id: vendor.id,
      customer_id: customer.id,
      customer_name: customer.name || "",
      customer_phone: visitPhone.trim(),
      customer_email: customer.email || null,
      location_note: visitLocation.trim(),
      message: visitMessage.trim() || null,
    }).select("id").single();

    setSubmittingVisit(false);

    if (error) {
      console.error(error);
      alert("Unable to send the visit request. Please try again.");
      return;
    }

    try {
      await supabase.functions.invoke("notify-visit-request", { body: { visit_request_id: created?.id } });
    } catch { /* non-fatal */ }

    setVisitSubmitted(true);
  }

  // ── Review submit ────────────────────────────────────────────
  async function handleSubmitReview() {
    if (!vendor || !reviewRating || !reviewerName.trim() || !reviewerEmail.trim() || !reviewText.trim()) {
      alert("Please fill in your name, email, rating, and review.");
      return;
    }
    setSubmittingReview(true);
    const currentReviewingCustomer = await getReviewingCustomer();
    const { error } = await supabase.from("vendor_reviews").insert({
      vendor_id: vendor.id,
      reviewer_name: reviewerName.trim(),
      reviewer_email: reviewerEmail.trim(),
      review_text: reviewText.trim(),
      rating: reviewRating,
      customer_id: currentReviewingCustomer?.id || null,
    });
    setSubmittingReview(false);
    if (error) {
      console.error(error);
      // Postgres 42501 here is the self-review RLS guard — the
      // customer_id sent is always the reviewer's own real one, so
      // this only ever fires for a genuine self-review attempt.
      if (error.code === "42501") {
        alert("You cannot submit a review for yourself.");
      } else {
        alert("Unable to submit review.");
      }
      return;
    }
    // Only logged after the review itself is confirmed saved.
    await logEvent("review_submitted");
    setReviewModalOpen(false);
    setReviewerName(""); setReviewerEmail(""); setReviewText(""); setReviewRating(0);
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
              Recommended size: 920 × 300px<br />Max size: 1MB<br />Formats: JPG, PNG
            </div>
          )}
          {coverUploading && (
            <div className={styles.uploadOverlay}>
              <div className={styles.uploadSpinner}></div>
              Uploading...
            </div>
          )}
          {isOwner && (
            <label className={styles.cameraOverlay}>
              📷
              <input type="file" accept="image/*" hidden disabled={coverUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ""; }} />
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
                    112 × 112px<br />Max: 1MB<br />JPG, PNG
                  </div>
                )}
                {logoUploading && (
                  <div className={styles.uploadOverlay}>
                    <div className={styles.uploadSpinner}></div>
                  </div>
                )}
                {isOwner && (
                  <>
                    <label className={`${styles.cameraOverlay} ${styles.cameraOverlaySmall}`}>
                      📷
                      <input type="file" accept="image/*" hidden disabled={logoUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }} />
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
            {favoriteVisible && (
              <button
                type="button"
                className={styles.quickAction}
                onClick={toggleFavorite}
                disabled={favoriteBusy}
              >
                <i className={isFavorited ? "fa-solid fa-heart" : "fa-regular fa-heart"}></i>
                <span>{isFavorited ? "Saved" : "Save"}</span>
              </button>
            )}
            {!isOwner && (
              <button
                type="button"
                className={`${styles.quickAction} ${styles.quickActionVisit}`}
                onClick={openVisitModal}
              >
                <i className="fa-solid fa-shield-heart"></i>
                <span>Request a Visit</span>
              </button>
            )}
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
            onKeyDown={handleAboutKeyDown}
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

      {/* PORTFOLIO — CV of past work, Service/Hybrid vendors only.
          Row-based, like Reviews below — no product-style card, no
          photo. Cyril's call (2026-07-28): a stock/placeholder image
          "does not look professional," so identity here comes from an
          initials avatar (same pattern as the Reviews avatar) rather
          than a photo. */}
      {(vendor.business_type === "service" || vendor.business_type === "hybrid") && portfolioItems.length > 0 && (
        <section className={styles.profileCard}>
          <h2>Portfolio</h2>
          <p className={styles.mediaHint}>A look at past work — completed projects for previous clients.</p>

          <div className={styles.portfolioList}>
            {(showAllPortfolio ? portfolioItems : portfolioItems.slice(0, 2)).map(item => {
              const rec = portfolioRecommendations[item.id];
              // A verified recommendation (submitted by the actual
              // client via the emailed link) always takes priority
              // over the vendor's own typed "Client / company" text —
              // Cyril's call: this is the whole point of the feature,
              // self-reported info shouldn't outrank a client's own
              // confirmation once one exists.
              const displayName = rec ? rec.recommender_name : item.client_name;
              const initialsSource = displayName || item.title || "";
              const initials = initialsSource
                .split(" ").map(p => p.charAt(0)).join("").substring(0, 2).toUpperCase();
              return (
                <div key={item.id} className={styles.portfolioRow}>
                  <div className={styles.portfolioRowHeader}>
                    <div className={styles.portfolioAvatar}>{initials}</div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.portfolioRowTop}>
                        <div className={styles.portfolioTitle}>{item.title}</div>
                        {item.completed_on && (
                          <div className={styles.portfolioDate}>Completed: {formatCompletedDate(item.completed_on)}</div>
                        )}
                      </div>
                      {displayName && (
                        <div className={styles.portfolioDate}>
                          {displayName}
                          {rec?.recommender_company ? ` · ${rec.recommender_company}` : ""}
                          {rec && (
                            <span className={styles.verifiedBadge} style={{ marginLeft: 6 }}>
                              <i className="fa-solid fa-circle-check"></i> Verified
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.description && <div className={styles.portfolioDescription}>{item.description}</div>}
                  {rec && (
                    <div className={styles.portfolioQuote}>
                      <div className={styles.portfolioQuoteLabel}>
                        <i className="fa-solid fa-quote-left"></i> Client recommendation
                      </div>
                      <div className={styles.portfolioQuoteText}>&ldquo;{rec.message}&rdquo;</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {portfolioItems.length > 2 && (
            <button
              type="button"
              className={styles.viewAllBtn}
              onClick={() => setShowAllPortfolio(v => !v)}
            >
              {showAllPortfolio ? "Show less" : `See More (${portfolioItems.length - 2} more)`}
            </button>
          )}
        </section>
      )}

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
              {/* Faithful port fix (2026-07-31): production's #vendorVideo
                  element is always present in the DOM once this wrap is
                  visible — an empty player box shows before any video is
                  uploaded, same as the static hint text above it, which
                  is never conditional on owner/public. Staging had wrongly
                  omitted the <video> element entirely (and the hint text
                  for owners) until a video existed, so an owner with no
                  video yet saw nothing here instead of production's
                  always-present empty player. Matched exactly: hint text
                  always shown, <video> always rendered, src only set (and
                  the loading dim only applied) once a video exists. */}
              <p className={styles.mediaHint}>MP4 only • Maximum duration and file size depend on your subscription plan.</p>
              <div className={styles.videoPlayerWrap}>
                {/* key forces React to fully unmount/recreate this element
                    whenever the underlying video changes (new upload or
                    delete back to empty) — see handleDeleteVideo comment
                    above for why this matters. */}
                <video
                  key={videoRecord?.id ?? "empty"}
                  className={styles.vendorVideoPlayer}
                  controls
                  src={videoRecord?.file_url || undefined}
                  style={videoRecord ? { opacity: videoLoaded ? 1 : 0.5, transition: "opacity 0.2s" } : undefined}
                  onLoadedData={() => setVideoLoaded(true)}
                />
                {videoUploading && (
                  <div className={styles.uploadOverlay}>
                    <div className={styles.uploadSpinner}></div>
                    Uploading...
                  </div>
                )}
              </div>
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
                  <div className={styles.videoChooseRow}>
                    <label htmlFor="videoInput" className={styles.videoChooseBtn}>
                      Choose File
                    </label>
                    <span className={styles.videoFileName}>{videoFileName}</span>
                    <input
                      id="videoInput"
                      type="file"
                      accept="video/mp4"
                      hidden
                      disabled={videoUploading}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setVideoFileName(f.name);
                        setVideoUploading(true);
                        handleVideoUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
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
          {/* Faithful port fix (2026-07-31): production's rateVendorBtn has
              no owner check at all — it's always rendered and clickable
              regardless of who's viewing, gated only by whether
              window.ReviewsUtils exists. Staging had wrongly hidden this
              for the owner, which is what Cyril reported ("no button to
              do the review") — he was viewing his own profile. Matched
              production exactly: always show it. */}
          <button type="button" className={styles.rateBtn} onClick={openReviewModal}>
            Rate
          </button>
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

      {/* SIMILAR BUSINESSES — section itself is always shown, matching
          production (which never hides it, even with zero matches);
          only the placeholder/grid content changes on load. */}
      <section className={styles.profileCard}>
        <h2>Explore Similar Businesses</h2>
        {!similarBusinessesLoaded ? (
          <div className={styles.similarPlaceholder}>Similar businesses will appear here.</div>
        ) : similarBusinesses.length > 0 ? (
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
        ) : null}
      </section>{/* No "no matches" message — matches production, which
          leaves the container empty when the query returns nothing. */}

      {/* BRANCHES (read-only list; management lives in dashboard-branches) */}
      {branches.length > 0 && (
        <section className={styles.profileCard}>
          <h2>Branches</h2>
          <div className={styles.branchesList}>
            {branches.map(branch => (
              <div key={branch.id} className={styles.branchItem}>
                <div className={styles.branchName}>{branch.branch_name || ""}</div>
                <div className={styles.branchAddress}>{branch.address || ""}</div>
                <a
                  href={
                    branch.latitude && branch.longitude
                      ? `https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`
                      : "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.branchMapLink}
                >
                  View on Map
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* REVIEW MODAL */}
      {reviewModalOpen && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setReviewModalOpen(false); }}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Leave a Review</h3>
            {reviewingCustomer === null && (
              <div className={styles.reviewAnonNotice}>
                Reviews from signed-in Spotlight customers are marked <strong>Verified Customer</strong> and
                carry more weight with other shoppers. You can still submit without signing in, or{" "}
                <a href="/customer-login">log in</a> / <a href="/customer-signup">sign up</a> first.
              </div>
            )}
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
              readOnly={reviewFieldsLocked}
            />
            <input
              className={styles.modalInput}
              type="email"
              placeholder="Your email"
              value={reviewerEmail}
              onChange={e => setReviewerEmail(e.target.value)}
              readOnly={reviewFieldsLocked}
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

      {/* VISIT REQUEST MODAL — 2026-08 safety feature. Requires a
          logged-in customer (gated in openVisitModal), so name is
          always locked to the real account; phone is editable in
          case it wasn't collected at signup, and gets saved back to
          the customer's profile for next time. */}
      {visitModalOpen && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setVisitModalOpen(false); }}>
          <div className={styles.modal}>
            {visitSubmitted ? (
              <>
                <h3 className={styles.modalTitle}>Request Sent</h3>
                <p className={styles.visitSubmittedText}>
                  <i className="fa-solid fa-circle-check"></i>{" "}
                  {vendor?.name || "The vendor"} will confirm your name and phone number before coming. You can
                  expect a call or WhatsApp message to arrange the visit.
                </p>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.modalSubmitBtn} onClick={() => setVisitModalOpen(false)}>Done</button>
                </div>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>Request a Visit</h3>
                <p className={styles.visitModalIntro}>
                  <i className="fa-solid fa-shield-heart"></i>{" "}
                  For your safety and the vendor&apos;s, {vendor?.name || "this vendor"} will confirm your name
                  and phone number here on Spotlight before travelling to your location.
                </p>
                <label className={styles.visitLabel}>Your name</label>
                <input className={styles.modalInput} value={visitCustomer?.name || ""} readOnly />
                <label className={styles.visitLabel}>Your phone number</label>
                <input
                  className={styles.modalInput}
                  type="tel"
                  placeholder="+2348021234567"
                  value={visitPhone}
                  onChange={e => setVisitPhone(e.target.value)}
                />
                <label className={styles.visitLabel}>Location / address for the visit</label>
                <input
                  className={styles.modalInput}
                  placeholder="e.g. Off Admiralty Way, Lekki Phase 1"
                  value={visitLocation}
                  onChange={e => setVisitLocation(e.target.value)}
                />
                <label className={styles.visitLabel}>What do you need? (optional)</label>
                <textarea
                  className={styles.modalTextarea}
                  placeholder="Briefly describe the job..."
                  value={visitMessage}
                  onChange={e => setVisitMessage(e.target.value)}
                />
                <div className={styles.modalActions}>
                  <button type="button" className={styles.modalCancelBtn} onClick={() => setVisitModalOpen(false)}>Cancel</button>
                  <button type="button" className={styles.modalSubmitBtn} onClick={handleSubmitVisit} disabled={submittingVisit}>
                    {submittingVisit ? "Sending..." : "Send Visit Request"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
