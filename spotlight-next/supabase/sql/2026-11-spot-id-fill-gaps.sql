-- Applied live 2026-11-08. Spot-ID = 'SP' + 2-digit registration year + 7-digit number.
-- The number keeps counting across years (never restarts) and always takes the LOWEST unused number,
-- so numbers freed by deleted accounts are reused first. Closed accounts keep their number until deleted.
-- Founders 1000 badge = number 1..1000.
create or replace function public.generate_spot_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yy text := to_char(now(), 'YY');
  n bigint;
begin
  perform pg_advisory_xact_lock(hashtext('spotlight_spot_id'));
  select g into n
  from generate_series(
         1,
         coalesce((select max(substring(spot_id from 5)::bigint) from public.vendors where spot_id ~ '^SP[0-9]{9}$'), 0) + 1
       ) as g
  where not exists (
    select 1 from public.vendors v
    where v.spot_id ~ '^SP[0-9]{9}$' and substring(v.spot_id from 5)::bigint = g
  )
  order by g
  limit 1;
  return 'SP' || yy || lpad(n::text, 7, '0');
end;
$$;

create unique index if not exists vendors_spot_number_key
  on public.vendors ((substring(spot_id from 5)::bigint))
  where spot_id ~ '^SP[0-9]{9}$';
