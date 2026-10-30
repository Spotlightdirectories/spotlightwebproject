-- ============================================================================
-- Spotlight Directories: plan rules, launch bonus, expiry and payments (Oct 2026)
-- ----------------------------------------------------------------------------
-- A saved COPY of what is already applied to the live Supabase project
-- (gyvzmktavyrevfxnwsay). These were applied through the Supabase tools, not
-- from this folder, so this file is the written record. Safe to re-run:
-- every statement is "create or replace" / "if not exists".
-- Order matters only where noted. Money is in KOBO (N1 = 100 kobo).
-- ============================================================================

-- 1) Launch bonus rule ------------------------------------------------------
-- ANY yearly plan (first purchase or renewal) whose PAYMENT DATE is up to the end of
-- 31 Dec 2026 (Lagos time) gets +3 months. For bank transfers the payment date is the date
-- the vendor submitted the transfer (p_eligible_at). Monthly plans never get the bonus.
create or replace function public.plan_bonus_applies(p_billing text, p_paid_at timestamptz, p_eligible_at timestamptz default null)
returns boolean
language sql
immutable
set search_path to 'public'
as $f$
  select p_billing is distinct from 'monthly'
     and coalesce(p_eligible_at, p_paid_at) < timestamptz '2027-01-01 00:00:00+01';
$f$;
grant execute on function public.plan_bonus_applies(text, timestamptz, timestamptz) to authenticated, service_role;

-- 2) Expiry date rule -------------------------------------------------------
-- Renewal of the SAME plan while it still has time left starts when the current term ends
-- (no paid days lost). A different plan (upgrade) starts from the payment date.
create or replace function public.compute_plan_expiry(
  p_vendor_id uuid, p_billing text, p_paid_at timestamptz,
  p_payment_id uuid default null, p_eligible_at timestamptz default null)
returns timestamptz
language plpgsql
stable
security definer
set search_path to 'public'
as $f$
declare
  base timestamptz := p_paid_at;
  v_cur_exp timestamptz;
  v_cur_plan text;
  v_cur_status text;
  v_pay_plan text;
begin
  if p_payment_id is not null then
    select plan into v_pay_plan from public.vendor_payments where id = p_payment_id;
    select expires_at, plan_tier, subscription_status
      into v_cur_exp, v_cur_plan, v_cur_status
      from public.vendors where id = p_vendor_id;
    if v_pay_plan is not null
       and lower(v_pay_plan) = lower(coalesce(v_cur_plan, ''))
       and v_cur_status in ('active', 'pending')
       and v_cur_exp is not null
       and v_cur_exp > p_paid_at then
      base := v_cur_exp;
    end if;
  end if;

  if p_billing = 'monthly' then
    return base + interval '1 month';
  end if;
  if public.plan_bonus_applies(p_billing, p_paid_at, p_eligible_at) then
    return base + interval '1 year' + interval '3 months';
  end if;
  return base + interval '1 year';
end;
$f$;
grant execute on function public.compute_plan_expiry(uuid, text, timestamptz, uuid, timestamptz) to authenticated, service_role;

-- 3) Plan limits (used by the insert policies on vendor_products / vendor_services) -----
-- Free (not in trial): 2 products, 2 services, 0 social, 1 gallery image.
-- Existing 90-day trial vendors: 5/5. A vendor with paid time still running keeps paid
-- limits while a renewal/upgrade payment is pending or failed.
create or replace function public.get_vendor_plan_limits(vendor_uuid uuid)
returns table(max_products integer, max_services integer, max_social_links integer, max_branches integer, max_gallery_images integer, video_allowed boolean)
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_plan_tier text;
  v_subscription_status text;
  v_trial_started_at timestamp;
  v_expires_at timestamptz;
  v_is_trial boolean;
  v_paid_effective boolean;
begin
  select plan_tier, subscription_status, trial_started_at, expires_at
    into v_plan_tier, v_subscription_status, v_trial_started_at, v_expires_at
    from public.vendors where id = vendor_uuid;

  v_is_trial := (
    v_plan_tier = 'free'
    and v_trial_started_at is not null
    and v_trial_started_at > now() - interval '90 days'
  );

  v_paid_effective := (
    v_subscription_status = 'active'
    or (v_subscription_status in ('pending', 'failed')
        and v_plan_tier in ('standard', 'enterprise', 'elite')
        and v_expires_at is not null and v_expires_at > now())
  );

  if v_plan_tier = 'custom' then
    return query select 999999::int, 999999::int, 999999::int, 999999::int, 999999::int, true::boolean;
  elsif v_paid_effective then
    return query select
      (case v_plan_tier when 'standard' then 25 when 'enterprise' then 50 when 'elite' then 100 else 2 end)::int,
      (case v_plan_tier when 'standard' then 25 when 'enterprise' then 50 when 'elite' then 100 else 2 end)::int,
      (case v_plan_tier when 'standard' then 2 when 'enterprise' then 3 when 'elite' then 5 else 0 end)::int,
      (case v_plan_tier when 'enterprise' then 10 when 'elite' then 30 else 0 end)::int,
      (case v_plan_tier when 'standard' then 6 when 'enterprise' then 12 when 'elite' then 24 else 1 end)::int,
      true::boolean;
  elsif v_is_trial then
    return query select 5::int, 5::int, 1::int, 0::int, 3::int, false::boolean;
  else
    return query select 2::int, 2::int, 0::int, 0::int, 1::int, false::boolean;
  end if;
end;
$f$;

-- 4) Hiding items beyond the plan limit (expired vendors, ended trials) ----------------
alter table public.vendor_products add column if not exists hidden_by_plan boolean not null default false;
alter table public.vendor_services add column if not exists hidden_by_plan boolean not null default false;

drop policy if exists "Public can view vendor products" on public.vendor_products;
create policy "Public can view vendor products" on public.vendor_products
  for select to public using (hidden_by_plan = false);
drop policy if exists "Public can view active services" on public.vendor_services;
create policy "Public can view active services" on public.vendor_services
  for select to public using (is_active = true and hidden_by_plan = false);

create or replace function public.apply_plan_visibility(p_vendor_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare mp integer; ms integer;
begin
  select l.max_products, l.max_services into mp, ms from public.get_vendor_plan_limits(p_vendor_id) l;
  if mp is null then return; end if;
  update public.vendor_products p set hidden_by_plan = r.should_hide
    from (select id, (moderation_status = 'approved'
            and row_number() over (partition by (moderation_status = 'approved') order by display_order, created_at, id) > mp) as should_hide
            from public.vendor_products where vendor_id = p_vendor_id) r
   where p.id = r.id and p.hidden_by_plan is distinct from r.should_hide;
  update public.vendor_services s set hidden_by_plan = r.should_hide
    from (select id, (moderation_status = 'approved'
            and row_number() over (partition by (moderation_status = 'approved') order by created_at, id) > ms) as should_hide
            from public.vendor_services where vendor_id = p_vendor_id) r
   where s.id = r.id and s.hidden_by_plan is distinct from r.should_hide;
end;
$f$;
revoke all on function public.apply_plan_visibility(uuid) from public, anon, authenticated;
grant execute on function public.apply_plan_visibility(uuid) to service_role;

create or replace function public.trg_apply_plan_visibility()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin perform public.apply_plan_visibility(NEW.id); return NEW; end;
$f$;
drop trigger if exists vendors_apply_plan_visibility on public.vendors;
create trigger vendors_apply_plan_visibility
  after update of plan_tier, subscription_status on public.vendors
  for each row
  when (old.plan_tier is distinct from new.plan_tier or old.subscription_status is distinct from new.subscription_status)
  execute function public.trg_apply_plan_visibility();

create or replace function public.sweep_plan_visibility()
returns integer language plpgsql security definer set search_path to 'public' as $f$
declare v record; n integer := 0;
begin
  for v in select id from public.vendors loop
    perform public.apply_plan_visibility(v.id); n := n + 1;
  end loop;
  return n;
end;
$f$;
revoke all on function public.sweep_plan_visibility() from public, anon, authenticated;
grant execute on function public.sweep_plan_visibility() to service_role;

-- 5) Expiring overdue paid subscriptions (called daily by edge function send-expiry-warnings) ----
create or replace function public.expire_overdue_subscriptions()
returns table (vendor_id uuid, vendor_name text, email text, telephone text, whatsapp text,
               old_plan text, old_billing text, expired_at timestamptz)
language plpgsql security definer set search_path to 'public' as $f$
begin
  return query
  with due as (
    select v.id, v.name, v.email, v.telephone, v.whatsapp, v.plan_tier, v.billing_cycle, v.expires_at
      from public.vendors v
     where v.subscription_status = 'active'
       and v.plan_tier in ('standard','enterprise','elite')
       and v.expires_at is not null and v.expires_at < now()
     for update
  ), upd as (
    update public.vendors v
       set subscription_status = 'free', plan_tier = 'free', is_premium = false, trial_started_at = null
      from due where v.id = due.id
    returning v.id
  )
  select due.id, due.name, due.email, due.telephone, due.whatsapp, due.plan_tier, due.billing_cycle, due.expires_at
    from due join upd on upd.id = due.id;
end;
$f$;
revoke all on function public.expire_overdue_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_overdue_subscriptions() to service_role;

create table if not exists public.expiry_reminders_sent (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  expires_at timestamptz not null,
  days_before integer not null,
  sent_at timestamptz not null default now(),
  primary key (vendor_id, expires_at, days_before)
);
alter table public.expiry_reminders_sent enable row level security;
revoke all on table public.expiry_reminders_sent from anon, authenticated;
grant select, insert, update, delete on table public.expiry_reminders_sent to service_role;

-- Daily cron job (07:00 UTC = 08:00 Lagos) runs: select public.send_trial_expiry_warnings();
create or replace function public.send_trial_expiry_warnings()
returns void language plpgsql security definer set search_path to 'public', 'net' as $f$
begin
  perform net.http_post(
    url := 'https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-expiry-warnings',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$f$;

-- 6) Search / similar-item functions skip hidden items --------------------------------
-- One-off rewrite: adds "hidden_by_plan = false" to every vendor_products / vendor_services
-- source in these functions. If any of them is ever rewritten from scratch, keep that filter.
-- (Applied once on 2026-10-30. Re-running is harmless: it only matches un-patched sources.)
do $do$
declare r record; newdef text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('search_products','search_services','search_vendors','get_similar_products',
                         'get_similar_services','get_similar_businesses','get_vendor_display_categories')
  loop
    newdef := regexp_replace(pg_get_functiondef(r.oid),
      '(FROM|JOIN)[ ]+vendor_(products|services)[ ]+([a-z][a-z0-9]*)',
      '\1 (SELECT * FROM public.vendor_\2 WHERE hidden_by_plan = false) \3', 'gi');
    execute newdef;
  end loop;
end
$do$;

-- 7) Admin email when a vendor uploads a bank-transfer receipt -------------------------
alter table public.vendor_payments add column if not exists admin_alerted_at timestamptz;

create or replace function public.alert_admin_transfer_submitted()
returns trigger language plpgsql security definer set search_path to 'public', 'net' as $f$
begin
  begin
    perform net.http_post(
      url := 'https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/notify-admin-transfer',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('id', NEW.id)
    );
  exception when others then
    raise warning 'alert_admin_transfer_submitted failed: %', sqlerrm;
  end;
  return NEW;
end;
$f$;
drop trigger if exists vendor_payments_transfer_alert on public.vendor_payments;
create trigger vendor_payments_transfer_alert
  after insert or update of transfer_proof_url on public.vendor_payments
  for each row
  when (new.payment_method = 'bank' and new.status = 'pending'
        and new.transfer_proof_url is not null and new.admin_alerted_at is null)
  execute function public.alert_admin_transfer_submitted();

-- 8) Commission on payment ------------------------------------------------------------
-- 20% of the first confirmed payment, 10% on renewals, 5% override to the recruiting
-- partner, N50,000 (5,000,000 kobo) bonus for every 50 yearly vendors in a month, and a
-- ONE-TIME reward (2 caps + 2 t-shirts) at 10 distinct paid yearly vendors.
-- partner_rewards table: unique(partner_id), admin-only RLS, admin_alerted_at.
-- The live function body is the source of truth; see it with:
--   select pg_get_functiondef('public.handle_commission_on_payment()'::regprocedure);
