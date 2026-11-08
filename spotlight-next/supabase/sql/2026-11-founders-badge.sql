-- Founders 1000 (1KF) badge: derived from the Spot-ID number. 1-1000 = founder.
alter table vendors add column if not exists is_founder boolean generated always as (
  case when spot_id ~ '^SP[0-9]{9}$' then substring(spot_id from 5)::bigint <= 1000 else false end
) stored;
