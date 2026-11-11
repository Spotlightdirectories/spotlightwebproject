-- Free plan has NO links (website or social), 2026-11-11.
-- PART 1 (already applied live): migrations free_plan_no_social_links,
--   free_plan_no_social_links_trigger, get_vendor_social_links_rpc:
--   get_vendor_plan_limits() trial branch -> 0 links; check_social_limit() free -> 0;
--   get_vendor_social_links(uuid) hides the url of free vendors.
-- PART 2 (run ONLY after the website + app that read through the function are live):
drop policy if exists "Public can read vendor social links" on public.vendor_social_links;
-- The owner can still read their own rows ("Allow owner read social links").
-- Everyone else reads through get_vendor_social_links(), which hides free vendors' addresses.
