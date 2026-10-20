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
  account_status?: string | null;
  scheduled_deletion_at?: string | null;
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

interface QuoteRequestRow {
  id: string;
  service_name: string;
  description: string;
  state: string;
  lga: string;
  timeline: string;
  status: "received" | "viewed" | "quoted" | "closed";
  created_at: string;
  vendors: { name: string; slug: string | null } | null;
}

const QUOTE_TIMELINE_LABELS: Record<string, string> = {
  asap: "As soon as possible",
  within_1_week: "Within 1 week",
  within_1_month: "Within 1 month",
  just_planning: "Just planning",
};

interface SearchLogRow {
  id: string;
  search_keyword: string | null;
  search_type: string | null;
  category: string | null;
  subcategory: string | null;
  state: string | null;
  lga: string | null;
  created_at: string;
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

type TabKey = "overview" | "favorites" | "viewed" | "inquiries" | "visits" | "quotes" | "reviews" | "searches";

const TAB_TITLES: Record<TabKey, string> = {
  overview: "Overview",
  favorites: "Favorite Vendors",
  viewed: "Recently Viewed",
  inquiries: "My Inquiries",
  visits: "Visit Requests",
  quotes: "My Quote Requests",
  reviews: "My Reviews",
  searches: "My Search History",
};

export default function CustomerProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [hasVendorAccount, setHasVendorAccount] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Account deletion: 14 days to change your mind, then everything is deleted.
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleCloseAccount() {
    if (!customer?.email || !deletePassword) { setDeleteError("Please enter your password."); return; }
    setDeleteBusy(true);
    setDeleteError("");
    const { error: pwError } = await supabase.auth.signInWithPassword({ email: customer.email, password: deletePassword });
    if (pwError) { setDeleteError("That password is not correct."); setDeleteBusy(false); return; }
    const { data, error } = await supabase.rpc("close_customer_account");
    if (error) { setDeleteError("We couldn't start the deletion. Please try again."); setDeleteBusy(false); return; }
    setCustomer(c => (c ? { ...c, account_status: "closing", scheduled_deletion_at: (data as string) || null } : c));
    setShowDelete(false);
    setDeletePassword("");
    setDeleteBusy(false);
  }

  async function handleRestoreAccount() {
    setDeleteBusy(true);
    const { error } = await supabase.rpc("restore_customer_account");
    setDeleteBusy(false);
    if (error) { alert("We couldn't restore your account. Please contact support."); return; }
    setCustomer(c => (c ? { ...c, account_status: "active", scheduled_deletion_at: null } : c));
  }

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
  }

  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [favoritesError, setFavoritesError] = useState(false);
  const [favoriteCategories, setFavoriteCategories] = useState<Record<string, string>>({});

  // Ask first, so an accidental click never silently removes a vendor.
  async function removeFavorite(favoriteId: string, vendorName: string) {
    if (!window.confirm(`Remove ${vendorName} from your favorites?\n\nYou can save it again from the vendor's profile.`)) return;
    setFavorites(prev => prev.filter(f => f.id !== favoriteId));
    await supabase.from("customer_favorites").delete().eq("id", favoriteId);
  }

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsError, setReviewsError] = useState(false);

  const [recentlyViewed, setRecentlyViewed] = useState<ActivityItem[]>([]);
  const [recentlyViewedError, setRecentlyViewedError] = useState(false);

  const [inquiries, setInquiries] = useState<ActivityItem[]>([]);
  const [inquiriesError, setInquiriesError] = useState(false);

  const [visitRequests, setVisitRequests] = useState<VisitRequestRow[]>([]);
  const [visitRequestsError, setVisitRequestsError] = useState(false);
  const [unreadVisitReplies, setUnreadVisitReplies] = useState(0);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequestRow[]>([]);
  const [quoteRequestsError, setQuoteRequestsError] = useState(false);

  // Phase 0.5 addition, 2026-09-07 per Cyril: "My Search History" --
  // reads back the search_logs rows now being written (with
  // customer_id) from DiscoverResults.tsx's runSearch. Same tab
  // pattern as everything else on this page.
  const [searchHistory, setSearchHistory] = useState<SearchLogRow[]>([]);
  const [searchHistoryError, setSearchHistoryError] = useState(false);
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
        .order("created_at", { ascending: false })
        .returns<FavoriteRow[]>();

      if (favError) {
        console.error("Favorites load error:", favError);
        setFavoritesError(true);
      } else {
        const favList = favData || [];
        // Categories come from what each vendor actually lists (same logic as the app).
        const vendorIds = favList.map(f => f.vendors?.id).filter(Boolean) as string[];
        if (vendorIds.length > 0) {
          const { data: catRows } = await supabase.rpc("get_vendor_display_categories", { p_vendor_ids: vendorIds });
          const catMap: Record<string, string> = {};
          (catRows || []).forEach((r: { vendor_id: string; categories: string[] | null; total_count: number | null }) => {
            if (!r.categories || r.categories.length === 0) return;
            const shown = r.categories.slice(0, 2).join(" • ");
            const more = (r.total_count || r.categories.length) - 2;
            catMap[r.vendor_id] = more > 0 ? `${shown} • +${more} more` : shown;
          });
          setFavoriteCategories(catMap);
        }
        setFavorites(favList);
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

      // Quote requests this customer has sent (Task U, Request a Quote)
      const { data: quoteData, error: quoteError } = await supabase
        .from("quote_requests")
        .select(`
          id, service_name, description, state, lga, timeline, status, created_at,
          vendors ( name, slug )
        `)
        .eq("customer_id", customerRow.id)
        .order("created_at", { ascending: false })
        .returns<QuoteRequestRow[]>();
      if (quoteError) {
        console.error("Quote requests load error:", quoteError);
        setQuoteRequestsError(true);
      } else {
        setQuoteRequests(quoteData || []);
      }

      // My search history -- Phase 0.5, 2026-09-07 per Cyril
      const { data: searchData, error: searchError } = await supabase
        .from("search_logs")
        .select("id, search_keyword, search_type, category, subcategory, state, lga, created_at")
        .eq("customer_id", customerRow.id)
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<SearchLogRow[]>();

      if (searchError) {
        console.error("Search history load error:", searchError);
        setSearchHistoryError(true);
      } else {
        setSearchHistory(searchData || []);
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

  async function closeQuoteRequest(id: string) {
    if (!window.confirm("Close this quote request? The vendor will see it as closed.")) return;
    const { error } = await supabase.from("quote_requests").update({ status: "closed" }).eq("id", id);
    if (error) { alert("Unable to close this request. Please try again."); return; }
    setQuoteRequests(qs => qs.map(q => (q.id === id ? { ...q, status: "closed" } : q)));
  }

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
            <button className={navItemClass("quotes")} onClick={() => switchTab("quotes")}>
              <i className="fa-solid fa-file-invoice-dollar"></i>
              <span>My Quote Requests</span>
            </button>
            <button className={navItemClass("reviews")} onClick={() => switchTab("reviews")}>
              <i className="fa-regular fa-star"></i><span>My Reviews</span>
            </button>
            <button className={navItemClass("searches")} onClick={() => switchTab("searches")}>
              <i className="fa-solid fa-clock-rotate-left"></i><span>My Search History</span>
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

        {customer.account_status === "closing" && (
          <div style={{ background: "#fff4e5", border: "1px solid #f0b86e", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <strong>Your account is scheduled for deletion.</strong>
            <p style={{ margin: "6px 0 10px" }}>
              On {customer.scheduled_deletion_at ? new Date(customer.scheduled_deletion_at).toLocaleDateString("en-NG", { dateStyle: "long" }) : "the scheduled date"} everything will be permanently deleted. Until then you can change your mind.
            </p>
            <button type="button" disabled={deleteBusy} onClick={handleRestoreAccount}
              style={{ background: "#2d6a4f", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>
              {deleteBusy ? "Please wait..." : "Keep my account"}
            </button>
          </div>
        )}

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
            <button type="button" className={styles.cpOverviewCard} onClick={() => switchTab("quotes")}>
              <i className="fa-solid fa-file-invoice-dollar"></i>
              <strong>{quoteRequests.length}</strong>
              <span>Quote Requests</span>
            </button>
            <button type="button" className={styles.cpOverviewCard} onClick={() => switchTab("reviews")}>
              <i className="fa-regular fa-star"></i>
              <strong>{reviews.length}</strong>
              <span>Reviews Written</span>
            </button>
            <button type="button" className={styles.cpOverviewCard} onClick={() => switchTab("searches")}>
              <i className="fa-solid fa-clock-rotate-left"></i>
              <strong>{searchHistory.length}</strong>
              <span>Recent Searches</span>
            </button>
          </div>
        )}


        {activeTab === "overview" && customer.account_status !== "closing" && (
          <section className={styles.cpSection} style={{ marginTop: 24 }}>
            <h2>Delete my account</h2>
            <p className={styles.cpNote}>
              You have 14 days to change your mind. After that, your account and everything in it is permanently deleted: your name, email, phone number, favourites, reviews, visit and quote requests, photos and search history. We keep nothing that identifies you.
            </p>
            {!showDelete ? (
              <button type="button" onClick={() => setShowDelete(true)}
                style={{ background: "#fff", color: "#b42318", border: "1px solid #b42318", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>
                Delete my account
              </button>
            ) : (
              <div style={{ maxWidth: 360 }}>
                <label style={{ display: "block", marginBottom: 6 }}>Enter your password to confirm</label>
                <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                  style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8, marginBottom: 8 }} autoComplete="current-password" />
                {deleteError && <p style={{ color: "#b42318", margin: "0 0 8px" }}>{deleteError}</p>}
                <button type="button" disabled={deleteBusy} onClick={handleCloseAccount}
                  style={{ background: "#b42318", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", cursor: "pointer", marginRight: 8 }}>
                  {deleteBusy ? "Please wait..." : "Yes, delete my account"}
                </button>
                <button type="button" disabled={deleteBusy} onClick={() => { setShowDelete(false); setDeletePassword(""); setDeleteError(""); }}
                  style={{ background: "transparent", border: 0, cursor: "pointer" }}>Cancel</button>
              </div>
            )}
          </section>
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
                    src={v.logo_url || "/images/default-vendor-logo.png"}
                    alt={v.name}
                  />
                  <div className={styles.cpFavoriteInfo}>
                    <strong>{v.name}</strong>
                    {favoriteCategories[v.id] && <span>{favoriteCategories[v.id]}</span>}
                    <span className={styles.cpFavoriteRating}>
                      <i className="fa-solid fa-star"></i> {Number(v.average_rating || 0).toFixed(1)} ({v.reviews_count || 0})
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.cpFavoriteRemove}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFavorite(fav.id, v.name); }}
                  >
                    <i className="fa-solid fa-heart-crack"></i> Remove
                  </button>
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
          Vendors you&apos;ve contacted via WhatsApp or call
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

      {activeTab === "quotes" && (
      <section>
        <h2>My Quote Requests</h2>
        <p className={styles.cpNote}>
          Requests you&apos;ve sent through &quot;Request a Quote&quot; on a service page. The vendor will contact you with a quote.
        </p>
        <div className={styles.cpVisitList}>
          {quoteRequestsError ? (
            <p className={styles.cpEmpty}>Couldn&apos;t load your quote requests right now.</p>
          ) : quoteRequests.length === 0 ? (
            <p className={styles.cpEmpty}>No quote requests yet — use &quot;Request a Quote&quot; on a service page to send one.</p>
          ) : (
            quoteRequests.map(qr => (
              <div key={qr.id} className={styles.cpVisitCard}>
                <div className={styles.cpVisitTop}>
                  {qr.vendors?.slug ? (
                    <a href={`/vendor/${encodeURIComponent(qr.vendors.slug)}`}><strong>{qr.vendors.name}</strong></a>
                  ) : (
                    <strong>{qr.vendors?.name || "Vendor"}</strong>
                  )}
                  {qr.status === "received" && <span className={`${styles.cpVisitStatus} ${styles.cpVisitStatusPending}`}>Sent</span>}
                  {qr.status === "viewed" && <span className={`${styles.cpVisitStatus} ${styles.cpVisitStatusPending}`}>Viewed by vendor</span>}
                  {qr.status === "quoted" && <span className={`${styles.cpVisitStatus} ${styles.cpVisitStatusAck}`}>Quoted</span>}
                  {qr.status === "closed" && <span className={`${styles.cpVisitStatus} ${styles.cpVisitStatusDeclined}`}>Closed</span>}
                </div>
                <p className={styles.cpVisitDetail}><i className="fa-solid fa-briefcase"></i> {qr.service_name}</p>
                <p className={styles.cpVisitDetail}><i className="fa-solid fa-location-dot"></i> {qr.lga}, {qr.state}</p>
                <p className={styles.cpVisitDetail}><i className="fa-solid fa-clock"></i> {QUOTE_TIMELINE_LABELS[qr.timeline] || qr.timeline}</p>
                <p className={styles.cpVisitDetail}><i className="fa-solid fa-comment"></i> {qr.description}</p>
                <p className={styles.cpVisitDate}>
                  Requested {new Date(qr.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {qr.status !== "closed" && (
                  <button type="button" className={styles.cpFavoriteRemove} style={{ marginTop: 10 }} onClick={() => closeQuoteRequest(qr.id)}>
                    Close request
                  </button>
                )}
              </div>
            ))
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
                <span className={styles.cpReviewDate}>{new Date(r.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</span>
              </div>
            ))
          )}
        </div>
      </section>
      )}

      {activeTab === "searches" && (
      <section className={styles.cpSection}>
        <h2>My Search History</h2>
        <p className={styles.cpNote}>
          Your last 50 searches on Spotlight. Tap any of them to search again.
        </p>
        <div className={styles.cpVisitList}>
          {searchHistoryError ? (
            <p className={styles.cpEmpty}>Couldn't load your search history right now.</p>
          ) : searchHistory.length === 0 ? (
            <p className={styles.cpEmpty}>No searches yet — your past searches will show up here.</p>
          ) : (
            searchHistory.map(log => {
              const params = new URLSearchParams();
              if (log.search_keyword) params.set("keyword", log.search_keyword);
              if (log.search_type && log.search_type !== "all") params.set("type", log.search_type);
              if (log.category) params.set("category", log.category);
              if (log.subcategory) params.set("subcategory", log.subcategory);
              if (log.state) params.set("state", log.state);
              if (log.lga) params.set("lga", log.lga);

              const filterParts = [
                log.category,
                log.subcategory,
                [log.lga, log.state].filter(Boolean).join(", "),
              ].filter(Boolean);

              return (
                <a
                  key={log.id}
                  href={`/discover-results?${params.toString()}`}
                  className={styles.cpVisitCard}
                >
                  <div className={styles.cpVisitTop}>
                    <strong>{log.search_keyword ? `"${log.search_keyword}"` : "Browsed with filters"}</strong>
                  </div>
                  {filterParts.length > 0 && (
                    <p className={styles.cpVisitDetail}>
                      <i className="fa-solid fa-filter"></i> {filterParts.join(" \u203a ")}
                    </p>
                  )}
                  <p className={styles.cpVisitDate}>
                    {new Date(log.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </a>
              );
            })
          )}
        </div>
      </section>
      )}

      </main>
    </div>
  );
}
