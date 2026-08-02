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
//
// "Recently Viewed" and "My Inquiries" are a genuine new feature
// added per Cyril's request (2026-07-31) — production never tied
// product/service views or WhatsApp/Call clicks to a customer
// account at all. Product/service detail pages now tag those
// analytics_events rows with customer_id when the viewer is logged
// in (see getViewingCustomerId.ts); this page reads them back.
// analytics_events has no FK to vendor_products/vendor_services, so
// PostgREST can't auto-embed — events are fetched first, then their
// product/service rows are looked up separately and joined in JS.
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

interface RawActivityEvent {
  product_id: string | null;
  service_id: string | null;
  event_type: string;
  created_at: string;
}

interface ProductRow {
  id: string;
  slug: string;
  product_name: string;
  price: number | null;
  primary_image_url: string | null;
  vendors: { name: string; slug: string } | null;
}

interface ServiceRow {
  id: string;
  slug: string;
  service_name: string;
  starting_price: number | null;
  representative_image_url: string | null;
  vendors: { name: string; slug: string } | null;
}

interface VisitRequestRow {
  id: string;
  location_note: string;
  message: string | null;
  status: "pending" | "acknowledged" | "declined" | "cancelled";
  created_at: string;
  acknowledged_at: string | null;
  customer_viewed_at: string | null;
  vendors: { name: string; slug: string | null } | null;
}

interface ActivityItem {
  kind: "product" | "service";
  slug: string;
  name: string;
  image: string | null;
  price: number | null;
  vendorName: string;
  vendorSlug: string;
  eventType: string;
  occurredAt: string;
}

// Dedupes events by product/service (keeping the first — the caller
// already sorts newest-first), then resolves each one against
// vendor_products/vendor_services since there's no FK for PostgREST
// to auto-embed through.
async function resolveActivityItems(events: RawActivityEvent[]): Promise<ActivityItem[]> {
  const seen = new Set<string>();
  const deduped: RawActivityEvent[] = [];
  for (const ev of events) {
    const key = ev.product_id ? `p:${ev.product_id}` : ev.service_id ? `s:${ev.service_id}` : null;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(ev);
  }

  const productIds = deduped.filter(e => e.product_id).map(e => e.product_id as string);
  const serviceIds = deduped.filter(e => e.service_id).map(e => e.service_id as string);

  const [{ data: products }, { data: services }] = await Promise.all([
    productIds.length
      ? supabase
          .from("vendor_products")
          .select("id, slug, product_name, price, primary_image_url, vendors(name, slug)")
          .in("id", productIds)
          .eq("moderation_status", "approved")
          .returns<ProductRow[]>()
      : Promise.resolve({ data: [] as ProductRow[] }),
    serviceIds.length
      ? supabase
          .from("vendor_services")
          .select("id, slug, service_name, starting_price, representative_image_url, vendors(name, slug)")
          .in("id", serviceIds)
          .eq("moderation_status", "approved")
          .returns<ServiceRow[]>()
      : Promise.resolve({ data: [] as ServiceRow[] }),
  ]);

  const productMap = new Map((products || []).map(p => [p.id, p]));
  const serviceMap = new Map((services || []).map(s => [s.id, s]));

  const items: ActivityItem[] = [];
  for (const ev of deduped) {
    if (ev.product_id) {
      const p = productMap.get(ev.product_id);
      if (!p || !p.vendors) continue;
      items.push({
        kind: "product",
        slug: p.slug,
        name: p.product_name,
        image: p.primary_image_url,
        price: p.price,
        vendorName: p.vendors.name,
        vendorSlug: p.vendors.slug,
        eventType: ev.event_type,
        occurredAt: ev.created_at,
      });
    } else if (ev.service_id) {
      const s = serviceMap.get(ev.service_id);
      if (!s || !s.vendors) continue;
      items.push({
        kind: "service",
        slug: s.slug,
        name: s.service_name,
        image: s.representative_image_url,
        price: s.starting_price,
        vendorName: s.vendors.name,
        vendorSlug: s.vendors.slug,
        eventType: ev.event_type,
        occurredAt: ev.created_at,
      });
    }
  }
  return items;
}

type TabKey = "overview" | "favorites" | "viewed" | "inquiries" | "visits" | "reviews";

const TAB_TITLES: Record<TabKey, string> = {
  overview: "Overview",
  favorites: "Favorite Vendors",
  viewed: "Recently Viewed",
  inquiries: "My Inquiries",
  visits: "Visit Requests",
  reviews: "My Reviews",
};

export default function CustomerProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [hasVendorAccount, setHasVendorAccount] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
  }

  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [favoritesError, setFavoritesError] = useState(false);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsError, setReviewsError] = useState(false);

  const [recentlyViewed, setRecentlyViewed] = useState<ActivityItem[]>([]);
  const [recentlyViewedError, setRecentlyViewedError] = useState(false);

  const [inquiries, setInquiries] = useState<ActivityItem[]>([]);
  const [inquiriesError, setInquiriesError] = useState(false);

  const [visitRequests, setVisitRequests] = useState<VisitRequestRow[]>([]);
  const [visitRequestsError, setVisitRequestsError] = useState(false);
  const [unreadVisitReplies, setUnreadVisitReplies] = useState(0);
  // IDs of replies that were unread at page-load — captured once so the
  // "New" highlight in the Visit Requests tab sticks around for this
  // visit even after mark_visit_requests_viewed_by_customer clears the
  // unread flag in the database. Naturally resets on next page load.
  const [newlyRepliedIds, setNewlyRepliedIds] = useState<Set<string>>(new Set());

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

      // Recently viewed products/services + inquiries (WhatsApp/Call
      // clicks), both tagged with this customer's id at the point of
      // interaction on the product/service detail pages.
      const [
        { data: viewEvents, error: viewEventsError },
        { data: contactEvents, error: contactEventsError },
      ] = await Promise.all([
        supabase
          .from("analytics_events")
          .select("product_id, service_id, event_type, created_at")
          .eq("customer_id", customerRow.id)
          .in("event_type", ["product_view", "service_view"])
          .order("created_at", { ascending: false })
          .limit(50)
          .returns<RawActivityEvent[]>(),
        supabase
          .from("analytics_events")
          .select("product_id, service_id, event_type, created_at")
          .eq("customer_id", customerRow.id)
          .in("event_type", ["whatsapp_click", "phone_click"])
          .order("created_at", { ascending: false })
          .limit(50)
          .returns<RawActivityEvent[]>(),
      ]);

      if (viewEventsError) {
        console.error("Recently viewed load error:", viewEventsError);
        setRecentlyViewedError(true);
      } else {
        setRecentlyViewed(await resolveActivityItems(viewEvents || []));
      }

      if (contactEventsError) {
        console.error("Inquiries load error:", contactEventsError);
        setInquiriesError(true);
      } else {
        setInquiries(await resolveActivityItems(contactEvents || []));
      }

      // Visit requests this customer has sent — 2026-08 safety
      // feature. Shows the vendor, when it was requested, and whether
      // the vendor has confirmed/declined it yet, so the customer
      // isn't left wondering what happened after tapping "Request a
      // Visit" on a vendor/product/service page.
      const { data: visitData, error: visitError } = await supabase
        .from("visit_requests")
        .select(`
          id, location_note, message, status, created_at, acknowledged_at, customer_viewed_at,
          vendors ( name, slug )
        `)
        .eq("customer_id", customerRow.id)
        .order("created_at", { ascending: false })
        .returns<VisitRequestRow[]>();

      if (visitError) {
        console.error("Visit requests load error:", visitError);
        setVisitRequestsError(true);
      } else {
        setVisitRequests(visitData || []);
        // Unread = a vendor reply (acknowledged/declined) the customer
        // hasn't opened the Visit Requests tab to see yet — mirrors the
        // vendor-side inbox-style badge.
        const unreadRows = (visitData || []).filter(
          v => (v.status === "acknowledged" || v.status === "declined") && !v.customer_viewed_at
        );
        setUnreadVisitReplies(unreadRows.length);
        setNewlyRepliedIds(new Set(unreadRows.map(v => v.id)));
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

  // Clear the "Visit Requests" badge once the customer actually opens
  // that tab — same pattern as the vendor dashboard's unread badge.
  useEffect(() => {
    const customerId = customer?.id;
    if (activeTab !== "visits" || !customerId || unreadVisitReplies === 0) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase.rpc("mark_visit_requests_viewed_by_customer", {
        p_customer_id: customerId,
      });
      if (!cancelled && !error) setUnreadVisitReplies(0);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, customer?.id]);

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

  const navItemClass = (tab: TabKey) => `${styles.cpNavItem}${activeTab === tab ? " " + styles.cpNavItemActive : ""}`;

  return (
    <div className={styles.cpDashboardRoot}>

      {/* SIDEBAR */}
      <aside className={`${styles.cpSidebar}${mobileSidebarOpen ? " " + styles.cpSidebarOpen : ""}`}>
        <div className={styles.cpSidebarInner}>
          <div className={styles.cpSidebarHeader}>
            <h2>{customer.name || "My Account"}</h2>
            <p>{customer.email || ""}</p>
          </div>

          <nav className={styles.cpNav}>
            <button className={navItemClass("overview")} onClick={() => switchTab("overview")}>
              <i className="fa-regular fa-square"></i><span>Overview</span>
            </button>
            <button className={navItemClass("favorites")} onClick={() => switchTab("favorites")}>
              <i className="fa-regular fa-heart"></i><span>Favorite Vendors</span>
            </button>
            <button className={navItemClass("viewed")} onClick={() => switchTab("viewed")}>
              <i className="fa-regular fa-eye"></i><span>Recently Viewed</span>
            </button>
            <button className={navItemClass("inquiries")} onClick={() => switchTab("inquiries")}>
              <i className="fa-solid fa-comments"></i><span>My Inquiries</span>
            </button>
            <button className={navItemClass("visits")} onClick={() => switchTab("visits")}>
              <i className="fa-solid fa-shield-heart"></i>
              <span>Visit Requests{unreadVisitReplies > 0 ? ` (${unreadVisitReplies})` : ""}</span>
            </button>
            <button className={navItemClass("reviews")} onClick={() => switchTab("reviews")}>
              <i className="fa-regular fa-star"></i><span>My Reviews</span>
            </button>
            {hasVendorAccount && (
              <a href="/vendordashboard" className={styles.cpNavItem}>
                <i className="fa-solid fa-store"></i><span>Vendor Dashboard</span>
              </a>
            )}
          </nav>

          <button type="button" className={styles.cpLogoutBtn} onClick={handleLogout}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i> Log Out
          </button>
        </div>
      </aside>

      {/* MOBILE TOPBAR */}
      <header className={styles.cpMobileTopbar}>
        <span className={styles.cpMobileBrand}>{TAB_TITLES[activeTab]}</span>
        <button className={styles.cpMobileMenuBtn} onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
          <i className="fa-solid fa-bars"></i>
        </button>
      </header>

      {mobileSidebarOpen && (
        <div className={styles.cpMobileOverlay} onClick={() => setMobileSidebarOpen(false)}></div>
      )}

      {/* MAIN */}
      <main className={styles.cpMain}>
        <h1 className={styles.cpMainTitle}>{TAB_TITLES[activeTab]}</h1>

        {hasVendorAccount && activeTab === "overview" && (
          <div className={styles.cpVendorSwitch}>
            <i className="fa-solid fa-store"></i>
            <span>You also have a vendor account on Spotlight.</span>
            <a href="/vendordashboard">Go to Vendor Dashboard</a>
          </div>
        )}

        {activeTab === "overview" && (
          <div className={styles.cpOverviewGrid}>
            <button type="button" className={styles.cpOverviewCard} onClick={() => switchTab("favorites")}>
              <i className="fa-regular fa-heart"></i>
              <strong>{favorites.length}</strong>
              <span>Favorite Vendors</span>
            </button>
            <button type="button" className={styles.cpOverviewCard} onClick={() => switchTab("viewed")}>
              <i className="fa-regular fa-eye"></i>
              <strong>{recentlyViewed.length}</strong>
              <span>Recently Viewed</span>
            </button>
            <button type="button" className={styles.cpOverviewCard} onClick={() => switchTab("inquiries")}>
              <i className="fa-solid fa-comments"></i>
              <strong>{inquiries.length}</strong>
              <span>Inquiries</span>
            </button>
            <button type="button" className={styles.cpOverviewCard} onClick={() => switchTab("visits")}>
              <i className="fa-solid fa-shield-heart"></i>
              <strong>{visitRequests.length}</strong>
              <span>Visit Requests</span>
            </button>
            <button type="button" className={styles.cpOverviewCard} onClick={() => switchTab("reviews")}>
              <i className="fa-regular fa-star"></i>
              <strong>{reviews.length}</strong>
              <span>Reviews Written</span>
            </button>
          </div>
        )}

      {activeTab === "favorites" && (
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
      )}

      {activeTab === "viewed" && (
      <section className={styles.cpSection}>
        <h2>Recently Viewed</h2>
        <div className={styles.cpActivityList}>
          {recentlyViewedError ? (
            <p className={styles.cpEmpty}>Couldn't load your recent activity right now.</p>
          ) : recentlyViewed.length === 0 ? (
            <p className={styles.cpEmpty}>No products or services viewed yet — items you look at will show up here.</p>
          ) : (
            recentlyViewed.map(item => (
              <a
                key={`${item.kind}-${item.slug}`}
                href={`/vendor/${encodeURIComponent(item.vendorSlug)}/${item.kind}/${encodeURIComponent(item.slug)}`}
                className={styles.cpActivityCard}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image || "/images/spotlightlogo-512.png"} alt={item.name} />
                <div className={styles.cpFavoriteInfo}>
                  <strong>{item.name}</strong>
                  <span>By {item.vendorName}</span>
                  {item.price != null && (
                    <span className={styles.cpActivityPrice}>₦{Number(item.price).toLocaleString()}</span>
                  )}
                </div>
              </a>
            ))
          )}
        </div>
      </section>
      )}

      {activeTab === "inquiries" && (
      <section className={styles.cpSection}>
        <h2>My Inquiries</h2>
        <p className={styles.cpNote}>
          Products and services you've reached out to a vendor about via WhatsApp or Call.
        </p>
        <div className={styles.cpActivityList}>
          {inquiriesError ? (
            <p className={styles.cpEmpty}>Couldn't load your inquiries right now.</p>
          ) : inquiries.length === 0 ? (
            <p className={styles.cpEmpty}>No inquiries yet — tap WhatsApp or Call on a product or service to reach out to a vendor.</p>
          ) : (
            inquiries.map(item => (
              <a
                key={`${item.kind}-${item.slug}`}
                href={`/vendor/${encodeURIComponent(item.vendorSlug)}/${item.kind}/${encodeURIComponent(item.slug)}`}
                className={styles.cpActivityCard}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image || "/images/spotlightlogo-512.png"} alt={item.name} />
                <div className={styles.cpFavoriteInfo}>
                  <strong>{item.name}</strong>
                  <span>By {item.vendorName}</span>
                  <span className={styles.cpActivityBadge}>
                    <i className={item.eventType === "whatsapp_click" ? "fab fa-whatsapp" : "fas fa-phone"}></i>
                    {item.eventType === "whatsapp_click" ? "WhatsApp" : "Call"}
                  </span>
                </div>
              </a>
            ))
          )}
        </div>
      </section>
      )}

      {activeTab === "visits" && (
      <section className={styles.cpSection}>
        <h2>My Visit Requests</h2>
        <p className={styles.cpNote}>
          Requests you&apos;ve sent through &quot;Request a Visit&quot; on a vendor, product, or service page.
        </p>
        <div className={styles.cpVisitList}>
          {visitRequestsError ? (
            <p className={styles.cpEmpty}>Couldn't load your visit requests right now.</p>
          ) : visitRequests.length === 0 ? (
            <p className={styles.cpEmpty}>No visit requests yet — use &quot;Request a Visit&quot; on a vendor's page to send one.</p>
          ) : (
            visitRequests.map(vr => {
              const isNew = newlyRepliedIds.has(vr.id);
              return (
              <div key={vr.id} className={`${styles.cpVisitCard}${isNew ? " " + styles.cpVisitCardNew : ""}`}>
                <div className={styles.cpVisitTop}>
                  {vr.vendors?.slug ? (
                    <a href={`/vendor/${encodeURIComponent(vr.vendors.slug)}`}><strong>{vr.vendors.name}</strong></a>
                  ) : (
                    <strong>{vr.vendors?.name || "Vendor"}</strong>
                  )}
                  {isNew && <span className={styles.cpVisitNewBadge}>New</span>}
                  {vr.status === "pending" && <span className={`${styles.cpVisitStatus} ${styles.cpVisitStatusPending}`}>Awaiting vendor confirmation</span>}
                  {vr.status === "acknowledged" && <span className={`${styles.cpVisitStatus} ${styles.cpVisitStatusAck}`}>Confirmed by vendor</span>}
                  {vr.status === "declined" && <span className={`${styles.cpVisitStatus} ${styles.cpVisitStatusDeclined}`}>Declined</span>}
                  {vr.status === "cancelled" && <span className={`${styles.cpVisitStatus} ${styles.cpVisitStatusDeclined}`}>Cancelled</span>}
                </div>
                <p className={styles.cpVisitDetail}><i className="fa-solid fa-location-dot"></i> {vr.location_note}</p>
                {vr.message && <p className={styles.cpVisitDetail}><i className="fa-solid fa-comment"></i> {vr.message}</p>}
                <p className={styles.cpVisitDate}>
                  Requested {new Date(vr.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  {vr.status === "acknowledged" && vr.acknowledged_at && (
                    <> · Confirmed {new Date(vr.acknowledged_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</>
                  )}
                </p>
              </div>
              );
            })
          )}
        </div>
      </section>
      )}

      {activeTab === "reviews" && (
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
      )}

      </main>
    </div>
  );
}
