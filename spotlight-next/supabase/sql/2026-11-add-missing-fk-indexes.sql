-- Speed: indexes on 13 foreign-key columns that had none (already applied live 2026-11-10).
create index if not exists idx_branch_social_links_branch_id on public.branch_social_links (branch_id);
create index if not exists idx_branches_vendor_id on public.branches (vendor_id);
create index if not exists idx_customer_favorites_vendor_id on public.customer_favorites (vendor_id);
create index if not exists idx_email_change_requests_vendor_id on public.email_change_requests (vendor_id);
create index if not exists idx_product_attributes_subcategory_id on public.product_attributes (subcategory_id);
create index if not exists idx_quote_category_families_family_id on public.quote_category_families (family_id);
create index if not exists idx_quote_requests_service_id on public.quote_requests (service_id);
create index if not exists idx_vendor_portfolio_items_vendor_id on public.vendor_portfolio_items (vendor_id);
create index if not exists idx_vendor_rec_requests_portfolio_item_id on public.vendor_recommendation_requests (portfolio_item_id);
create index if not exists idx_vendor_rec_requests_vendor_id on public.vendor_recommendation_requests (vendor_id);
create index if not exists idx_vendor_reviews_customer_id on public.vendor_reviews (customer_id);
create index if not exists idx_vendor_reviews_vendor_id on public.vendor_reviews (vendor_id);
create index if not exists idx_vendor_social_links_vendor_id on public.vendor_social_links (vendor_id);
