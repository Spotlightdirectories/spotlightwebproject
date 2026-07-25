"use client";

// ===============================================================
// src/app/(main)/vendor/[slug]/service/[serviceSlug]/page.tsx
//
// Service detail dynamic route — ported faithfully from
// vendor-service.html + vendor-service.js.
//
// Key differences from the product page:
// - No-image state: when service has no photo, the layout
//   shifts to centered single-column (vs two-column with image)
// - Expandable description: intro paragraph + bullet list with
//   Read More/Less toggle when image is present
// - Uses get_similar_services RPC (not get_similar_products)
// - Price label is "Starting From ₦X" not just "₦X"
// - Analytics: service_view event
// ===============================================================

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./vendor-service.module.css";

interface Service {
  id: string;
  slug: string;
  vendor_id: string;
  service_name: string;
  starting_price: number | null;
  short_description: string;
  representative_image_url: string | null;
  secondary_image_url: string | null;
  vendors: {
    slug: string;
    name: string;
    whatsapp: string;
    telephone: string;
    category: string;
    subcategory: string;
    verification_status: string;
    average_rating: number;
    reviews_count: number;
    is_sponsored: boolean;
  };
}

interface RelatedService {
  slug: string;
  service_name: string;
  starting_price: number | null;
  representative_image_url: string | null;
  vendorName?: string;
  vendorVerification?: string;
  vendorRating?: number;
  vendorReviews?: number;
  sponsored?: boolean;
  vendors?: {
    name: string;
    verification_status: string;
    average_rating: number;
    reviews_count: number;
    is_sponsored: boolean;
  };
}

function SmallBadge({ status }: { status: string }) {
  if (status === "blue") return <img src="/images/bluebadge.png" alt="Verified" className={styles.vsBadge} />;
  if (status === "gray") return <img src="/images/graybadge.png" alt="Verified" className={styles.vsBadge} />;
  return null;
}

function ServiceCard({ service, onClick }: { service: RelatedService; onClick: () => void }) {
  const name = service.vendors?.name || service.vendorName || "";
  const verification = service.vendors?.verification_status || service.vendorVerification || "none";
  const rating = service.vendors?.average_rating ?? service.vendorRating ?? 0;
  const reviews = service.vendors?.reviews_count ?? service.vendorReviews ?? 0;

  return (
    <div className={styles.vsServiceCard} onClick={onClick}>
      {service.representative_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={service.representative_image_url}
          alt={service.service_name}
          className={styles.vsCardImage}
        />
      )}
      <h3 className={styles.vsCardTitle}>{service.service_name}</h3>
      {service.starting_price && (
        <p className={styles.vsCardPrice}>
          Starting From <span>₦{Number(service.starting_price).toLocaleString()}</span>
        </p>
      )}
      <div className={styles.vsCardVendor}>
        <span>By {name}</span>
        <SmallBadge status={verification} />
      </div>
      <div className={styles.vsCardRating}>
        <i className="fa-solid fa-star"></i>
        <span>{Number(rating).toFixed(1)}</span>
        <small>({reviews})</small>
      </div>
    </div>
  );
}

export default function VendorServicePage() {
  const params = useParams();
  const router = useRouter();
  const vendorSlug = params.slug as string;
  const serviceSlug = params.serviceSlug as string;

  const [service, setService] = useState<Service | null>(null);
  const [activeImage, setActiveImage] = useState<string>("");
  const [moreServices, setMoreServices] = useState<RelatedService[]>([]);
  const [similarServices, setSimilarServices] = useState<RelatedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!serviceSlug) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("vendor_services")
        .select(`
          *,
          vendors(
            slug, name, whatsapp, telephone, category, subcategory,
            verification_status, average_rating, reviews_count, is_sponsored
          )
        `)
        .eq("slug", serviceSlug)
        .single();

      if (error || !data) { setLoading(false); return; }

      setService(data);

      // Main image: representative first, then secondary
      const mainImg = data.representative_image_url || data.secondary_image_url || "";
      setActiveImage(mainImg);
      setLoading(false);

      // Analytics
      try {
        await supabase.from("analytics_events").insert({
          vendor_id: data.vendor_id,
          service_id: data.id,
          event_type: "service_view",
        });
      } catch { /* non-fatal */ }

      // More services from same vendor
      const { data: more } = await supabase
        .from("vendor_services")
        .select(`slug, service_name, starting_price, representative_image_url,
          vendors(name, verification_status, average_rating, reviews_count, is_sponsored)`)
        .eq("vendor_id", data.vendor_id)
        .neq("slug", data.slug);
      setMoreServices(more || []);

      // Similar services from other vendors
      const { data: similar } = await supabase.rpc("get_similar_services", {
        p_exclude_vendor_id: data.vendor_id,
        p_exclude_service_id: data.id,
        p_target_subcategory: data.vendors?.subcategory || null,
        p_target_category: data.vendors?.category || null,
        p_limit: 12,
      });
      setSimilarServices((similar || []).map((s: any) => ({
        slug: s.slug,
        service_name: s.service_name,
        starting_price: s.starting_price,
        representative_image_url: s.representative_image_url,
        vendorName: s.vendor_name,
        vendorVerification: s.vendor_verification_status,
        vendorRating: s.vendor_average_rating,
        vendorReviews: s.vendor_reviews_count,
        sponsored: s.vendor_is_sponsored,
      })));
    }
    load();
  }, [serviceSlug]);

  async function handleShare() {
    const shareData = {
      title: service?.service_name || "",
      text: `Check out ${service?.service_name} on Spotlight Directories.`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert("Service link copied to clipboard.");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading service...
      </div>
    );
  }

  if (!service) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>
        Service not found.
      </div>
    );
  }

  const vendor = service.vendors;
  const hasImage = !!(service.representative_image_url || service.secondary_image_url);
  const hasSecondary = !!(service.secondary_image_url && service.representative_image_url);

  // Description: first line is intro, rest are bullet points
  const rawDesc = service.short_description || "";
  const descLines = rawDesc.split("\n").map(l => l.trim()).filter(Boolean);
  const intro = descLines[0] || "";
  const bullets = descLines.slice(1);
  const showToggle = hasImage && bullets.length > 2;
  const visibleBullets = hasImage && !descExpanded ? bullets.slice(0, 2) : bullets;

  return (
    <div className={styles.vsPage}>

      {/* BACK TO VENDOR PROFILE */}
      <button
        type="button"
        className={styles.vsVendorLink}
        onClick={() => router.push(`/vendor/${vendorSlug}`)}
      >
        <i className="fa-solid fa-store"></i>
        View Vendor Profile
      </button>

      {/* MAIN CARD */}
      <div className={`${styles.vsContainer} ${!hasImage ? styles.vsContainerNoImage : ""}`}>

        {/* MEDIA */}
        {hasImage && (
          <div className={styles.vsMedia}>
            <div className={styles.vsImageWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeImage}
                alt={service.service_name}
                className={styles.vsMainImage}
              />
            </div>
            {hasSecondary && (
              <div className={styles.vsThumbnails}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={service.secondary_image_url!}
                  alt="Secondary service image"
                  className={`${styles.vsThumbnail} ${activeImage === service.secondary_image_url ? styles.vsThumbnailActive : ""}`}
                  onClick={() => setActiveImage(service.secondary_image_url!)}
                />
              </div>
            )}
          </div>
        )}

        {/* INFO */}
        <div className={styles.vsInfo}>
          <h1>{service.service_name}</h1>

          {service.starting_price && (
            <p className={styles.vsPrice}>
              Starting From <span>₦{Number(service.starting_price).toLocaleString("en-NG", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</span>
            </p>
          )}

          {/* VENDOR META */}
          <div className={styles.vsVendorMeta}>
            <div className={styles.vsVendorRow}>
              <span>By {vendor?.name || ""}</span>
              <SmallBadge status={vendor?.verification_status || "none"} />
            </div>
            <div className={styles.vsRatingRow}>
              <i className="fa-solid fa-star"></i>
              <span>{Number(vendor?.average_rating || 0).toFixed(1)}</span>
              <small>({vendor?.reviews_count || 0})</small>
            </div>
            {vendor?.is_sponsored && (
              <p className={styles.vsSponsored}>Sponsored</p>
            )}
          </div>

          {/* DESCRIPTION */}
          {rawDesc && (
            <div className={styles.vsDescription}>
              {intro && <p>{intro}</p>}
              {visibleBullets.length > 0 && (
                <ul>
                  {visibleBullets.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
              {showToggle && (
                <button
                  type="button"
                  className={styles.vsReadMoreBtn}
                  onClick={() => setDescExpanded(e => !e)}
                >
                  {descExpanded ? "Read Less" : "Read More"}
                </button>
              )}
            </div>
          )}

          {/* ACTIONS */}
          <div className={styles.vsActions}>
            {vendor?.whatsapp ? (
              <a
                href={`https://wa.me/${vendor.whatsapp}`}
                className={`${styles.vsActionBtn} ${styles.vsWhatsappBtn}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="fab fa-whatsapp"></i>
                Chat Vendor
              </a>
            ) : <span />}

            {(vendor?.telephone || vendor?.whatsapp) ? (
              <a
                href={`tel:${vendor?.telephone || vendor?.whatsapp}`}
                className={`${styles.vsActionBtn} ${styles.vsCallBtn}`}
              >
                <i className="fas fa-phone"></i>
                Call Vendor
              </a>
            ) : <span />}

            <button
              type="button"
              className={`${styles.vsActionBtn} ${styles.vsShareBtn}`}
              onClick={handleShare}
            >
              <i className="fas fa-share-nodes"></i>
              Share Service
            </button>
          </div>
        </div>
      </div>

      {/* MORE SERVICES FROM THIS VENDOR */}
      {moreServices.length > 0 && (
        <section className={styles.vsMoreSection}>
          <h2>More Services From This Vendor</h2>
          <div className={styles.vsCardGrid}>
            {moreServices.map(s => (
              <ServiceCard
                key={s.slug}
                service={s}
                onClick={() => router.push(`/vendor/${vendorSlug}/service/${s.slug}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* SIMILAR SERVICES FROM OTHER VENDORS */}
      {similarServices.length > 0 && (
        <section className={styles.vsSimilarSection}>
          <h2>Similar Services From Other Vendors</h2>
          <div className={styles.vsCardGrid}>
            {similarServices.map(s => (
              <ServiceCard
                key={s.slug}
                service={s}
                onClick={() => router.push(`/vendor/${vendorSlug}/service/${s.slug}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
