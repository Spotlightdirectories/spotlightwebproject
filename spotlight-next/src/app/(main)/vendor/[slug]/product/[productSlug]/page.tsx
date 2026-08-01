"use client";

// ===============================================================
// src/app/(main)/vendor/[slug]/product/[productSlug]/page.tsx
//
// Product detail dynamic route — ported faithfully from
// vendor-product.html + vendor-product.js.
//
// Features:
// - Primary/secondary/tertiary images with thumbnail swap
// - Product title, price (formatted), description, key details
// - Vendor meta (name, badge, rating)
// - WhatsApp, Call, Share actions
// - More products from same vendor
// - Similar products from other vendors (get_similar_products RPC)
// - Analytics: product_view event, plus whatsapp_click/phone_click
//   on the contact buttons. Every one of these is tagged with the
//   viewing customer's customer_id when they're logged in, so their
//   customer-profile page can show "Recently Viewed" / "My
//   Inquiries" — added per Cyril's request (2026-07-31), a genuine
//   new feature, not something production already tracked.
// ===============================================================

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getViewingCustomerId } from "@/lib/getViewingCustomerId";
import styles from "./vendor-product.module.css";

interface Product {
  id: string;
  slug: string;
  vendor_id: string;
  product_name: string;
  price: number;
  short_description: string;
  key_details: string;
  primary_image_url: string | null;
  secondary_image_url: string | null;
  tertiary_image_url: string | null;
  display_order: number;
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

interface RelatedProduct {
  id?: string;
  slug: string;
  product_name: string;
  price: number;
  primary_image_url: string | null;
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
  if (status === "blue") return <img src="/images/bluebadge.png" alt="Verified" className={styles.vpBadge} />;
  if (status === "gray") return <img src="/images/graybadge.png" alt="Verified" className={styles.vpBadge} />;
  return null;
}

function ProductCard({ product, onClick }: { product: RelatedProduct; onClick: () => void }) {
  const name = product.vendors?.name || product.vendorName || "";
  const verification = product.vendors?.verification_status || product.vendorVerification || "none";
  const rating = product.vendors?.average_rating ?? product.vendorRating ?? 0;
  const reviews = product.vendors?.reviews_count ?? product.vendorReviews ?? 0;

  return (
    <div className={styles.vpProductCard} onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.primary_image_url || "/images/spotlightlogo-512.png"}
        alt={product.product_name}
        className={styles.vpCardImage}
      />
      <h3 className={styles.vpCardTitle}>{product.product_name}</h3>
      <p className={styles.vpCardPrice}>₦{Number(product.price || 0).toLocaleString()}</p>
      <div className={styles.vpCardVendor}>
        <span>By {name}</span>
        <SmallBadge status={verification} />
      </div>
      <div className={styles.vpCardRating}>
        <i className="fa-solid fa-star"></i>
        <span>{Number(rating).toFixed(1)}</span>
        <small>({reviews})</small>
      </div>
    </div>
  );
}

export default function VendorProductPage() {
  const params = useParams();
  const router = useRouter();
  const vendorSlug = params.slug as string;
  const productSlug = params.productSlug as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState<string>("");
  const [moreProducts, setMoreProducts] = useState<RelatedProduct[]>([]);
  const [similarProducts, setSimilarProducts] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!productSlug) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("vendor_products")
        .select(`
          *,
          vendors(
            slug, name, whatsapp, telephone, category, subcategory,
            verification_status, average_rating, reviews_count, is_sponsored
          )
        `)
        .eq("slug", productSlug)
        .eq("moderation_status", "approved")
        .single();

      if (error || !data) { setLoading(false); return; }

      setProduct(data);
      setActiveImage(data.primary_image_url || "/images/spotlightlogo-512.png");
      setLoading(false);

      // Analytics
      try {
        const customerId = await getViewingCustomerId();
        await supabase.from("analytics_events").insert({
          vendor_id: data.vendor_id,
          product_id: data.id,
          event_type: "product_view",
          customer_id: customerId,
        });
      } catch { /* non-fatal */ }

      // More products from same vendor
      const { data: more } = await supabase
        .from("vendor_products")
        .select(`slug, product_name, price, primary_image_url, vendor_id,
          vendors(name, verification_status, average_rating, reviews_count, is_sponsored)`)
        .eq("vendor_id", data.vendor_id)
        .eq("moderation_status", "approved")
        .neq("id", data.id)
        .order("display_order", { ascending: true });
      // Supabase's untyped query builder can't tell this is a
      // many-to-one embed (each product has exactly one vendor), so
      // it infers `vendors` as an array at the type level even
      // though PostgREST returns a single object at runtime. Reshape
      // into the same flat vendorName/vendorVerification/etc. fields
      // the "similar products" query below already uses, instead of
      // fighting the mistyped nested shape.
      setMoreProducts((more || []).map((p: any) => ({
        slug: p.slug,
        product_name: p.product_name,
        price: p.price,
        primary_image_url: p.primary_image_url,
        vendorName: p.vendors?.name,
        vendorVerification: p.vendors?.verification_status,
        vendorRating: p.vendors?.average_rating,
        vendorReviews: p.vendors?.reviews_count,
        sponsored: p.vendors?.is_sponsored,
      })));

      // Similar products from other vendors
      // Fixed 2026-08-01: similar products are now matched on the
      // product's OWN category/subcategory (looked up server-side
      // inside the RPC from p_exclude_product_id), not the vendor's
      // overall business category — so this no longer needs to pass
      // p_target_category/p_target_subcategory at all.
      const { data: similar } = await supabase.rpc("get_similar_products", {
        p_exclude_vendor_id: data.vendor_id,
        p_exclude_product_id: data.id,
        p_limit: 12,
      });
      setSimilarProducts((similar || []).map((p: any) => ({
        slug: p.slug,
        product_name: p.product_name,
        price: p.price,
        primary_image_url: p.primary_image_url,
        vendorName: p.vendor_name,
        vendorVerification: p.vendor_verification_status,
        vendorRating: p.vendor_average_rating,
        vendorReviews: p.vendor_reviews_count,
        sponsored: p.vendor_is_sponsored,
      })));
    }
    load();
  }, [productSlug]);

  // Fires on WhatsApp/Call tap — production never logged these at
  // all (plain links, no handler). Fire-and-forget, doesn't block the
  // actual wa.me/tel: navigation.
  async function logContactClick(eventType: "whatsapp_click" | "phone_click") {
    if (!product) return;
    try {
      const customerId = await getViewingCustomerId();
      await supabase.from("analytics_events").insert({
        vendor_id: product.vendor_id,
        product_id: product.id,
        event_type: eventType,
        customer_id: customerId,
      });
    } catch { /* non-fatal */ }
  }

  async function handleShare() {
    const shareData = {
      title: product?.product_name || "",
      text: `Check out ${product?.product_name} on Spotlight Directories.`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert("Product link copied to clipboard.");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading product...
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>
        Product not found.
      </div>
    );
  }

  const vendor = product.vendors;
  const keyDetails = product.key_details
    ? product.key_details.split("\n").map(l => l.trim()).filter(Boolean)
    : [];

  const thumbnails = [
    product.secondary_image_url,
    product.tertiary_image_url,
  ].filter(Boolean) as string[];

  return (
    <div className={styles.vpPage}>

      {/* BACK TO VENDOR PROFILE */}
      <button
        type="button"
        className={styles.vpVendorLink}
        onClick={() => router.push(`/vendor/${vendorSlug}`)}
      >
        <i className="fa-solid fa-store"></i>
        View Vendor Profile
      </button>

      {/* MAIN PRODUCT CARD */}
      <div className={styles.vpContainer}>

        {/* MEDIA */}
        <div className={styles.vpMedia}>
          <div className={styles.vpImageWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt={product.product_name}
              className={styles.vpMainImage}
            />
          </div>

          {thumbnails.length > 0 && (
            <div className={styles.vpThumbnails}>
              {thumbnails.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={`Product image ${i + 2}`}
                  className={`${styles.vpThumbnail} ${activeImage === src ? styles.vpThumbnailActive : ""}`}
                  onClick={() => setActiveImage(src)}
                />
              ))}
            </div>
          )}
        </div>

        {/* INFO */}
        <div className={styles.vpInfo}>
          <h1>{product.product_name}</h1>

          <p className={styles.vpPrice}>
            ₦ {Number(product.price || 0).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>

          {/* VENDOR META */}
          <div className={styles.vpVendorMeta}>
            <div className={styles.vpVendorRow}>
              <span>By {vendor?.name || ""}</span>
              <SmallBadge status={vendor?.verification_status || "none"} />
            </div>
            <div className={styles.vpRatingRow}>
              <i className="fa-solid fa-star"></i>
              <span>{Number(vendor?.average_rating || 0).toFixed(1)}</span>
              <small>({vendor?.reviews_count || 0})</small>
            </div>
            {vendor?.is_sponsored && (
              <p className={styles.vpSponsored}>Sponsored</p>
            )}
          </div>

          {/* KEY DETAILS */}
          {keyDetails.length > 0 && (
            <div className={styles.vpKeyDetails}>
              <h3>Key Details</h3>
              <ul>
                {keyDetails.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* DESCRIPTION */}
          {product.short_description && (
            <p className={styles.vpDescription}>{product.short_description}</p>
          )}

          {/* ACTIONS */}
          <div className={styles.vpActions}>
            {vendor?.whatsapp ? (
              <a
                href={`https://wa.me/${vendor.whatsapp}`}
                className={`${styles.vpActionBtn} ${styles.vpWhatsappBtn}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logContactClick("whatsapp_click")}
              >
                <i className="fab fa-whatsapp"></i>
                Chat Vendor
              </a>
            ) : (
              <span />
            )}

            {(vendor?.telephone || vendor?.whatsapp) ? (
              <a
                href={`tel:${vendor?.telephone || vendor?.whatsapp}`}
                className={`${styles.vpActionBtn} ${styles.vpCallBtn}`}
                onClick={() => logContactClick("phone_click")}
              >
                <i className="fas fa-phone"></i>
                Call Vendor
              </a>
            ) : (
              <span />
            )}

            <button
              type="button"
              className={`${styles.vpActionBtn} ${styles.vpShareBtn}`}
              onClick={handleShare}
            >
              <i className="fas fa-share-nodes"></i>
              Share Product
            </button>
          </div>
        </div>
      </div>

      {/* MORE PRODUCTS FROM THIS VENDOR */}
      {moreProducts.length > 0 && (
        <section className={styles.vpMoreSection}>
          <h2>More Products From This Vendor</h2>
          <div className={styles.vpCardGrid}>
            {moreProducts.map(p => (
              <ProductCard
                key={p.slug}
                product={p}
                onClick={() => router.push(`/vendor/${vendorSlug}/product/${p.slug}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* SIMILAR PRODUCTS FROM OTHER VENDORS */}
      {similarProducts.length > 0 && (
        <section className={styles.vpSimilarSection}>
          <h2>Similar Products From Other Vendors</h2>
          <div className={styles.vpCardGrid}>
            {similarProducts.map(p => (
              <ProductCard
                key={p.slug}
                product={p}
                onClick={() => router.push(`/vendor/${p.slug ? vendorSlug : vendorSlug}/product/${p.slug}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
