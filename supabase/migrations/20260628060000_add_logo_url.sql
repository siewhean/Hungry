-- Add logo_url to staging_food_businesses
alter table staging_food_businesses
  add column if not exists logo_url text;

comment on column staging_food_businesses.logo_url is
  'Official brand or chain logo URL extracted via Clearbit or similar API. Used as a high-fidelity visual identifier in UI.';

-- Add logo_url to venues
alter table venues
  add column if not exists logo_url text;

comment on column venues.logo_url is
  'Official brand or chain logo URL extracted via Clearbit or similar API. Used as a high-fidelity visual identifier in UI.';
