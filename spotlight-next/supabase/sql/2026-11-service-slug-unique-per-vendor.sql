-- Applied live 2026-11-05. One vendor cannot have two services with the same web address (slug).
-- Different vendors may share a slug; pages match vendor slug + service slug together.
create unique index if not exists vendor_services_vendor_slug_key on public.vendor_services (vendor_id, slug);
