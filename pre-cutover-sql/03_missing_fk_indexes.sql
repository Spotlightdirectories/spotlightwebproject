-- ===============================================================
-- Pre-cutover performance fix, batch 3: missing foreign-key indexes
-- ===============================================================
-- What this does: adds indexes on foreign-key columns that Supabase's
-- performance scan flagged as missing. These back every browse-by-
-- category and filtered-search query on the site (vendors, products,
-- services) plus every write to analytics_events (fires on every
-- WhatsApp click, call click, and page view).
--
-- Safety: this is purely additive. CREATE INDEX IF NOT EXISTS cannot
-- remove data, cannot change query results, and cannot break any
-- existing logic -- worst case if a name collides, it's a no-op. Given
-- the database doesn't have real production traffic yet, a plain
-- CREATE INDEX (not CONCURRENTLY) is fine here; there's no meaningful
-- table lock contention risk at this stage. If you'd rather be extra
-- cautious and this is ever run again on a much larger live table, use
-- CREATE INDEX CONCURRENTLY instead (that one can't run inside a
-- transaction block, so it'd need to be run as separate statements, one
-- at a time, outside the BEGIN/COMMIT below).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_vendors_category_id ON public.vendors (category_id);
CREATE INDEX IF NOT EXISTS idx_vendors_subcategory_id ON public.vendors (subcategory_id);

CREATE INDEX IF NOT EXISTS idx_vendor_products_category_id ON public.vendor_products (category_id);
CREATE INDEX IF NOT EXISTS idx_vendor_products_subcategory_id ON public.vendor_products (subcategory_id);

CREATE INDEX IF NOT EXISTS idx_vendor_services_category_id ON public.vendor_services (category_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_subcategory_id ON public.vendor_services (subcategory_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_customer_id ON public.analytics_events (customer_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_product_id ON public.analytics_events (product_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_service_id ON public.analytics_events (service_id);

COMMIT;
