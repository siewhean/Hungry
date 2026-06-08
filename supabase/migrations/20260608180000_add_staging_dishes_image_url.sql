-- Migration to add dishes_image_url to staging_food_businesses.
-- Safe to re-run.
alter table staging_food_businesses
  add column if not exists dishes_image_url text;

comment on column staging_food_businesses.dishes_image_url is
  'Unsplash dish image URL mapped to the signature dish/cuisine.';
