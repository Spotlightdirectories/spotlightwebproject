-- Applied live 2026-11-04 (migration "add_food_restaurant_categories").
-- New sub-types in "Food & Catering" and the new product category "Prepared Meals & Takeaway".
insert into public.subcategories (category_id, name, slug)
select c.id, v.name, v.slug from public.categories c
cross join (values ('Restaurant','restaurant'),('Fast Food & Takeaway','fast-food-takeaway'),('Bar & Lounge','bar-lounge'),('Food Truck & Street Food','food-truck-street-food')) as v(name, slug)
where c.name = 'Food & Catering' and c.kind = 'service'
on conflict (category_id, name) do nothing;

insert into public.categories (name, slug, kind, image_url, audience_type, goods_subgroup)
values ('Prepared Meals & Takeaway','prepared-meals-takeaway','product','https://spotlightdirectories.com/category-icons/prepared-meals-takeaway.svg','Goods','Food, Groceries & Beverages')
on conflict (name) do nothing;

insert into public.subcategories (category_id, name, slug)
select c.id, v.name, v.slug from public.categories c
cross join (values ('Rice Dishes','rice-dishes'),('Soups & Swallow','soups-swallow'),('Pepper Soup & Stews','pepper-soup-stews'),('Grills & Barbecue','grills-barbecue'),('Snacks & Small Chops','snacks-small-chops'),('Packed Meals & Lunch Boxes','packed-meals-lunch-boxes')) as v(name, slug)
where c.name = 'Prepared Meals & Takeaway'
on conflict (category_id, name) do nothing;
