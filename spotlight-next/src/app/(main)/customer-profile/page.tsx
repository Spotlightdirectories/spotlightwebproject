"use client";

// ===============================================================
// src/app/(main)/customer-profile/page.tsx
//
// Customer profile — ported faithfully from customer-profile.html +
// customer-profile.js.
//
// Dual customer/vendor account model: the same auth_user_id can have
// both a `vendors` row and a `customers` row (a vendor who also
// shops as a customer). If a `vendors` row exists for this identity,
// a banner offers a shortcut to the vendor dashboard — it doesn't
// change anything about this page's own data.
//
// "My Reviews" is matched by the email on the customer's account
// (not customer_id) — production's own honest caveat, kept here
// unchanged: vendor_reviews.customer_id exists and gets populated by
// the review modal now, but this lookup hasn't been switched over to
// it yet in production either, so this stays a faithful match.
// ===============================================================

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./customer-profile.module.css";

interface Customer {
  id: string;
  name: string | null;
  email: string | null;
}

interface FavoriteRow {
  id: string;
  vendors: {
    id: string;
    slug: string | null;
    name: string;
    logo_url: string | null;
    category: string | null;
    subcategory: string | null;
    average_rating: number | null;
    reviews_count: number | null;
  } | null;
}

interface ReviewRow {
  id: string;
  rating: number;
  review_text: string;
  created_at: string;
  vendors: { name: string; slug: string } | null;
}

export default function CustomerProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [hasVendorAccount, setHasVendorAccount] = useState(false);

  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [favoritesError, setFavoritesError] = useState(false);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsError, setReviewsError] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/customer-login");
        return;
      }

      const { data: customerRow } = await supabase
        .from("customers")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!customerRow) {
        // Logged in, but no customer profile — likely a vendor-only
        // account that ended up here by mistake.
        router.replace("/customer-login");
        return;
      }

      setCustomer(customerRow);

      // Vendor switch — same auth_user_id might also have a vendor row
      const { data: vendorRow } = await supabase
        .from("vendors")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      setHasVendorAccount(!!vendorRow);

      // Favorite vendors
      const { data: favData, error: favError } = await supabase
        .from("customer_favorites")
        .select(`
          id,
          vendors (
            id, slug, name, logo_url, category, subcategory, average_rating, reviews_count
          )
        `)
        .eq("customer_id", customerRow.id)
        .returns<FavoriteRow[]>();

      if (favError) {
        console.error("Favorites load error:", favError);
        setFavoritesError(true);
      } else {
        setFavorites(favData || []);
      }

      // My reviews — matched by email
      if (customerRow.email) {
        const { data: reviewData, error: reviewError } = await supabase
          .from("vendor_reviews")
          .select(`
            id, rating, review_text, created_at,
            vendors ( name, slug )
          `)
          .eq("reviewer_email", customerRow.email)
          .order("created_at", { ascending: false })
          .returns<ReviewRow[]>();

        if (reviewError) {
          console.error("Reviews load error:", reviewError);
          setReviewsError(true);
        } else {
          setReviews(reviewData || []);
        }
      }

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className={styles.cpPage}>
        <p className={styles.cpEmpty}>Loading...</p>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className={styles.cpPage}>

      <div className={styles.cpHeader}>
        <h1>{customer.name || "My Account"}</h1>
        <p className={styles.cpEmail}>{customer.email || ""}</p>
      </div>

      {hasVendorAccount && (
        <div className={styles.cpVendorSwitch}>
          <i className="fa-solid fa-store"></i>
          <span>You also have a vendor account on Spotlight.</span>
          <a href="/vendordashboard">Go to Vendor Dashboard</a>
        </div>
      )}

      <section className={styles.cpSection}>
        <h2>My Favorite Vendors</h2>
        <div className={styles.cpFavoritesList}>
          {favoritesError ? (
            <p className={styles.cpEmpty}>Couldn't load favorites right now.</p>
          ) : favorites.length === 0 ? (
            <p className={styles.cpEmpty}>
              No favorite vendors yet — browse Discover and tap the heart on a vendor's profile to save them here.
            </p>
          ) : (
            favorites.map(fav => {
              const v = fav.vendors;
              if (!v) return null;
              return (
                <a
                  key={fav.id}
                  href={`/vendor/${encodeURIComponent(v.slug || "")}`}
                  className={styles.cpFavoriteCard}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.name)}&background=e6c200&color=000000&size=128`}
                    alt={v.name}
                  />
                  <div className={styles.cpFavoriteInfo}>
                    <strong>{v.name}</strong>
                    <span>{v.subcategory || v.category || ""}</span>
                    <span className={styles.cpFavoriteRating}>
                      <i className="fa-solid fa-star"></i> {Number(v.average_rating || 0).toFixed(1)} ({v.reviews_count || 0})
                    </span>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </section>

      <section className={styles.cpSection}>
        <h2>My Reviews</h2>
        <p className={styles.cpNote}>
          Matched by the email on your account. Once reviews are directly linked to customer accounts, this will always show your exact review history.
        </p>
        <div className={styles.cpReviewsList}>
          {reviewsError ? (
            <p className={styles.cpEmpty}>Couldn't load reviews right now.</p>
          ) : reviews.length === 0 ? (
            <p className={styles.cpEmpty}>No reviews yet.</p>
          ) : (
            reviews.map(r => (
              <div key={r.id} className={styles.cpReviewRow}>
                <div className={styles.cpReviewTop}>
                  <strong>{r.vendors?.name || "Vendor"}</strong>
                  <span className={styles.cpReviewStars}>
                    {"★".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}
                  </span>
                </div>
                <p>{r.review_text}</p>
                <span className={styles.cpReviewDate}>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <button type="button" className={styles.cpLogoutBtn} onClick={handleLogout}>Log Out</button>

    </div>
  );
}
