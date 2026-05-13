-- Merchant live catalog metadata linkage.
-- Allows verified merchant-owned dish edits to update the same gallery,
-- taste-vector, and dietary-link tables read by consumer dish/stall detail
-- screens.

insert into dietary_flags (slug, name)
values
  ('dairy_free', 'dairy free'),
  ('egg_free', 'egg free'),
  ('peanut_free', 'peanut free'),
  ('shellfish_free', 'shellfish free'),
  ('soy_free', 'soy free'),
  ('sesame_free', 'sesame free'),
  ('pescatarian', 'pescatarian'),
  ('kosher', 'kosher'),
  ('keto', 'keto'),
  ('paleo', 'paleo'),
  ('low_carb', 'low carb'),
  ('low_sodium', 'low sodium'),
  ('low_sugar', 'low sugar'),
  ('diabetic_friendly', 'diabetic friendly'),
  ('fodmap_friendly', 'fodmap friendly'),
  ('beef_free', 'beef free'),
  ('allium_free', 'allium free'),
  ('fish_free', 'fish free'),
  ('mollusc_free', 'mollusc free'),
  ('celery_free', 'celery free'),
  ('mustard_free', 'mustard free'),
  ('lupin_free', 'lupin free'),
  ('sulphite_free', 'sulphite free')
on conflict (slug) do update
set name = excluded.name;

drop policy if exists "dish_images_insert_merchant_owner_or_manager" on dish_images;
create policy "dish_images_insert_merchant_owner_or_manager"
on dish_images for insert to authenticated
with check (
  exists (
    select 1
    from dishes d
    where d.id = dish_images.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);

drop policy if exists "dish_images_update_merchant_owner_or_manager" on dish_images;
create policy "dish_images_update_merchant_owner_or_manager"
on dish_images for update to authenticated
using (
  exists (
    select 1
    from dishes d
    where d.id = dish_images.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
)
with check (
  exists (
    select 1
    from dishes d
    where d.id = dish_images.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);

drop policy if exists "dish_images_delete_merchant_owner_or_manager" on dish_images;
create policy "dish_images_delete_merchant_owner_or_manager"
on dish_images for delete to authenticated
using (
  exists (
    select 1
    from dishes d
    where d.id = dish_images.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);

drop policy if exists "dish_taste_vectors_insert_merchant_owner_or_manager" on dish_taste_vectors;
create policy "dish_taste_vectors_insert_merchant_owner_or_manager"
on dish_taste_vectors for insert to authenticated
with check (
  exists (
    select 1
    from dishes d
    where d.id = dish_taste_vectors.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);

drop policy if exists "dish_taste_vectors_update_merchant_owner_or_manager" on dish_taste_vectors;
create policy "dish_taste_vectors_update_merchant_owner_or_manager"
on dish_taste_vectors for update to authenticated
using (
  exists (
    select 1
    from dishes d
    where d.id = dish_taste_vectors.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
)
with check (
  exists (
    select 1
    from dishes d
    where d.id = dish_taste_vectors.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);

drop policy if exists "dish_taste_vectors_delete_merchant_owner_or_manager" on dish_taste_vectors;
create policy "dish_taste_vectors_delete_merchant_owner_or_manager"
on dish_taste_vectors for delete to authenticated
using (
  exists (
    select 1
    from dishes d
    where d.id = dish_taste_vectors.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);

drop policy if exists "dish_dietary_flags_insert_merchant_owner_or_manager" on dish_dietary_flags;
create policy "dish_dietary_flags_insert_merchant_owner_or_manager"
on dish_dietary_flags for insert to authenticated
with check (
  exists (
    select 1
    from dishes d
    where d.id = dish_dietary_flags.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);

drop policy if exists "dish_dietary_flags_update_merchant_owner_or_manager" on dish_dietary_flags;
create policy "dish_dietary_flags_update_merchant_owner_or_manager"
on dish_dietary_flags for update to authenticated
using (
  exists (
    select 1
    from dishes d
    where d.id = dish_dietary_flags.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
)
with check (
  exists (
    select 1
    from dishes d
    where d.id = dish_dietary_flags.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);

drop policy if exists "dish_dietary_flags_delete_merchant_owner_or_manager" on dish_dietary_flags;
create policy "dish_dietary_flags_delete_merchant_owner_or_manager"
on dish_dietary_flags for delete to authenticated
using (
  exists (
    select 1
    from dishes d
    where d.id = dish_dietary_flags.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);
