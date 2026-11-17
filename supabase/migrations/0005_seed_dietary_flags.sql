-- Phase 7 baseline seed for canonical dietary flags.
-- Idempotent: safe to rerun.

insert into dietary_flags (slug, name)
values
  ('halal', 'halal'),
  ('vegetarian', 'vegetarian'),
  ('vegan', 'vegan'),
  ('pork_free', 'pork free'),
  ('nut_free', 'nut free'),
  ('gluten_free', 'gluten free')
on conflict (slug) do update
set name = excluded.name;
