// ===============================================================
// src/lib/logSearch.ts
//
// Phase 0.5, 2026-09-07 per Cyril: writes one row per real search
// action to search_logs, tagged with the viewing customer's id when
// logged in (null otherwise -- most searches are anonymous, and
// that's fine). This benefits both the website and the mobile app,
// since both will eventually read from the same "My Search History"
// data.
//
// This is a genuinely new feature, not a porting-gap fix like
// getViewingCustomerId's analytics_events work: search_logs existed
// with a well-designed schema, but had ZERO writers anywhere in the
// current Next.js rebuild (confirmed directly -- the table had 0
// rows before this). Fire-and-forget, same reasoning as the existing
// analytics_events impression logging right next to where this gets
// called: a logging failure should never slow down or block a real
// user's actual search results.
// ===============================================================

import { supabase } from "@/lib/supabase";
import { getViewingCustomerId } from "@/lib/getViewingCustomerId";

type SearchLogParams = {
  keyword?: string;
  searchType?: string;
  category?: string;
  subcategory?: string;
  state?: string;
  lga?: string;
  verifiedOnly?: boolean;
  distanceEnabled?: boolean;
  radiusKm?: number;
};

export async function logSearch(params: SearchLogParams): Promise<void> {
  try {
    const customerId = await getViewingCustomerId();

    await supabase.from("search_logs").insert([
      {
        customer_id: customerId,
        search_keyword: params.keyword || null,
        search_type: params.searchType || null,
        category: params.category || null,
        subcategory: params.subcategory || null,
        state: params.state || null,
        lga: params.lga || null,
        verified_only: params.verifiedOnly ?? null,
        distance_enabled: params.distanceEnabled ?? null,
        radius_km: params.radiusKm ?? null,
      },
    ]);
  } catch {
    /* non-fatal — a logging failure must never affect the user's actual search */
  }
}
