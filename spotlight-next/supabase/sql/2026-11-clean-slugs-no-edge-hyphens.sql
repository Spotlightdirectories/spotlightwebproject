-- New vendor/product slugs never start or end with a dash; existing vendor slugs cleaned.
create or replace function public.set_vendor_slug() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.slug is null then
    new.slug := trim(both '-' from lower(regexp_replace(new.name, '[^a-zA-Z0-9]+', '-', 'g')));
  end if;
  return new;
end;
$$;
create or replace function public.generate_product_slug(p_product_name text, p_vendor_name text) returns text language sql immutable set search_path to 'public' as $$
select trim(both '-' from lower(regexp_replace(p_product_name || '-' || p_vendor_name, '[^a-zA-Z0-9]+', '-', 'g')));
$$;
create or replace function public.create_product_slug() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    select trim(both '-' from lower(regexp_replace(new.product_name || '-' || v.name, '[^a-zA-Z0-9]+', '-', 'g')))
    into new.slug from vendors v where v.id = new.vendor_id;
  end if;
  return new;
end;
$$;
update vendors set slug = trim(both '-' from slug) where slug like '%-' or slug like '-%';
