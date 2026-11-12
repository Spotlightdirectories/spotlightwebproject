// ===============================================================
// src/lib/vendorProfileData.ts  (server side only)
//
// 2026-11 speed fix: the vendor profile used to start empty in the
// visitor's browser and then make about 8 separate trips to the
// database. This gathers the same public information on the server
// (which sits close to the database) so the page arrives already
// filled in. It uses the same public (anon) key, so a visitor sees
// exactly what they could already see before -- nothing extra.
//
// If anything goes wrong it returns null and the page falls back to
// loading everything in the browser, exactly as it did before.
// ===============================================================

import { createClient } from "@supabase/supabase-js";

// Same limits as the profile page (kept in step with
// VendorProfileClient.tsx).
const BRANCH_LIMITS: Record<string, number> = {
  free: 0, standard: 0, enterprise: 10, elite: 30, custom: Infinity,
};
const VIDEO_ALLOWED: Record<string, boolean> = {
  free: false, standard: true, enterprise: true, elite: true, custom: true,
};

function safeTier(plan: string | null | undefined): string {
  const valid = ["free", "standard", "enterprise", "elite", "custom"];
  return valid.includes(plan || "") ? plan! : "free";
}

export async function loadVendorProfileData(slug: string) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !slug) return null;

    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: vendor } = await sb.from("vendors").select("*").eq("slug", slug).maybeSingle();
    if (!vendor) return null;

    const tier = safeTier(vendor.plan_tier);
    const vendorId: string = vendor.id;

    // Free vendor with no product/service: return only the bare minimum.
    const { data: listedData } = await sb.rpc("vendor_is_listed", { p_vendor_id: vendorId });
    if (listedData === false) {
      return { listed: false as const, vendor: { id: vendorId, slug: vendor.slug, auth_user_id: vendor.auth_user_id } } as any;
    }
    const isServiceLike = vendor.business_type === "service" || vendor.business_type === "hybrid";

    const [productsR, servicesR, socialR, reviewsR, similarR, branchesR, videoR, portfolioR] = await Promise.all([
      sb.from("vendor_products").select("*").eq("vendor_id", vendorId)
        .eq("moderation_status", "approved").order("display_order", { ascending: true }),
      sb.from("vendor_services")
        .select(`*, vendors(slug, name, category, subcategory, state, lga, verification_status, is_founder, average_rating, reviews_count)`)
        .eq("vendor_id", vendorId).eq("moderation_status", "approved"),
      sb.rpc("get_vendor_social_links", { p_vendor_id: vendorId }),
      sb.from("vendor_reviews").select("reviewer_name, review_text, created_at, customer_id")
        .eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(3),
      sb.rpc("get_similar_businesses", {
        p_exclude_vendor_id: vendorId, p_target_category: vendor.category, p_limit: 6,
      }),
      sb.from("branches").select("id, branch_name, address, latitude, longitude")
        .eq("vendor_id", vendorId).eq("account_status", "active"),
      VIDEO_ALLOWED[tier]
        ? sb.from("vendor_media").select("*").eq("vendor_id", vendorId).eq("media_type", "video").limit(1)
        : Promise.resolve({ data: null }),
      isServiceLike
        ? sb.from("vendor_portfolio_items").select("*").eq("vendor_id", vendorId)
            .order("display_order", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const services: any[] = servicesR.data || [];

    // "Request a Visit" is only offered for home-service categories.
    const catIds = new Set<string>(
      services.map((s) => s.category_id).filter(Boolean) as string[]
    );
    if (vendor.category_id) catIds.add(vendor.category_id);
    let visitAllowed = false;
    if (catIds.size > 0) {
      const { data: okCats } = await sb.from("categories").select("id")
        .eq("allows_visit_request", true).in("id", Array.from(catIds));
      visitAllowed = (okCats || []).length > 0;
    }

    // Verified recommendations on portfolio items.
    const portfolioItems: any[] = portfolioR.data || [];
    const portfolioRecommendations: Record<string, any> = {};
    if (portfolioItems.length > 0) {
      const entries = await Promise.all(
        portfolioItems.map(async (item) => {
          const { data: rec } = await sb
            .rpc("get_portfolio_recommendation", { p_portfolio_item_id: item.id })
            .maybeSingle();
          return [item.id, rec] as const;
        })
      );
      for (const [id, rec] of entries) if (rec) portfolioRecommendations[id] = rec;
    }

    const branchLimit = BRANCH_LIMITS[tier] ?? 0;
    const allBranches: any[] = branchesR.data || [];
    const branches = branchLimit === 0 ? [] : allBranches.slice(0, branchLimit);

    return {
      listed: true as const,
      vendor,
      products: productsR.data || [],
      services,
      visitAllowed,
      socialLinks: socialR.data || [],
      reviews: reviewsR.data || [],
      similarBusinesses: similarR.error ? [] : similarR.data || [],
      similarLoaded: !similarR.error,
      branches,
      videoRecord: (videoR.data && videoR.data[0]) || null,
      portfolioItems,
      portfolioRecommendations,
    };
  } catch (err) {
    console.error("vendor profile server load failed:", err);
    return null;
  }
}
