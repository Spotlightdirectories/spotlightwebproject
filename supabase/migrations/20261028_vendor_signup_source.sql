-- Baseline signup source tracking (STAGING FIRST).
-- Adds columns only. Nothing is changed or deleted. Safe to run twice.

alter table public.vendors
  add column if not exists heard_about_us text,
  add column if not exists heard_about_detail text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists first_visit_at timestamptz;

-- Only known answers are allowed for "How did you hear about us?"
-- (existing vendors keep NULL, which is allowed).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendors_heard_about_us_check'
  ) then
    alter table public.vendors
      add constraint vendors_heard_about_us_check
      check (heard_about_us is null or heard_about_us in (
        'facebook', 'instagram', 'tiktok', 'youtube', 'linkedin',
        'google_search', 'whatsapp', 'friend_or_referral', 'event_or_offline', 'other'
      ));
  end if;
end $$;
