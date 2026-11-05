-- Applied live 2026-11-05. "Request a Visit" shows only for home-service categories.
-- Switch a category on/off:  update categories set allows_visit_request = true/false where name = '...';
alter table public.categories add column if not exists allows_visit_request boolean not null default false;
update public.categories set allows_visit_request = true where kind = 'service' and name in (
 'Electrical Services','Plumbing Services','Laundry & Dry Cleaning','Carpentry & Woodwork','Painting & Decoration',
 'Repair & Maintenance','HVAC Services','Cleaning Services','Pest Control','Landscaping & Gardening',
 'Welding & Fabrication','Tailoring & Fashion Designer','Construction Services','Interior Design','Water Services',
 'Renewable Energy','Waste Management','Internet & Telecommunications','Security Services',
 'Fire Safety Services','Metering Services','Childcare Services','Senior Care Services',
 'Beauty & Personal Care (Services)','Fitness & Wellness','Veterinary Services');
