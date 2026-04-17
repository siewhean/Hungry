-- Sprint 5: baseline RLS aligned with backend-migration-plan.md.

alter table dietary_flags enable row level security;
alter table buildings enable row level security;
alter table building_floors enable row level security;
alter table venues enable row level security;
alter table venue_delivery_links enable row level security;
alter table dishes enable row level security;
alter table dish_images enable row level security;
alter table dish_taste_vectors enable row level security;
alter table dish_dietary_flags enable row level security;
alter table reviews enable row level security;
alter table review_photos enable row level security;
alter table user_profiles enable row level security;
alter table user_taste_vectors enable row level security;
alter table user_favourite_dishes enable row level security;
alter table blog_posts enable row level security;
alter table stall_posts enable row level security;
alter table bites enable row level security;
alter table bite_reactions enable row level security;

drop policy if exists "public_select_dietary_flags" on dietary_flags;
create policy "public_select_dietary_flags" on dietary_flags for select using (true);

drop policy if exists "public_select_buildings" on buildings;
create policy "public_select_buildings" on buildings for select using (true);

drop policy if exists "public_select_building_floors" on building_floors;
create policy "public_select_building_floors" on building_floors for select using (true);

drop policy if exists "public_select_venues" on venues;
create policy "public_select_venues" on venues for select using (true);

drop policy if exists "public_select_venue_delivery_links" on venue_delivery_links;
create policy "public_select_venue_delivery_links" on venue_delivery_links for select using (true);

drop policy if exists "public_select_dishes" on dishes;
create policy "public_select_dishes" on dishes for select using (true);

drop policy if exists "public_select_dish_images" on dish_images;
create policy "public_select_dish_images" on dish_images for select using (true);

drop policy if exists "public_select_dish_taste_vectors" on dish_taste_vectors;
create policy "public_select_dish_taste_vectors" on dish_taste_vectors for select using (true);

drop policy if exists "public_select_dish_dietary_flags" on dish_dietary_flags;
create policy "public_select_dish_dietary_flags" on dish_dietary_flags for select using (true);

drop policy if exists "public_select_reviews" on reviews;
create policy "public_select_reviews" on reviews for select using (true);

drop policy if exists "reviews_insert_own" on reviews;
create policy "reviews_insert_own" on reviews for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on reviews;
create policy "reviews_update_own" on reviews for update to authenticated using (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on reviews;
create policy "reviews_delete_own" on reviews for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "public_select_review_photos" on review_photos;
create policy "public_select_review_photos" on review_photos for select using (true);

drop policy if exists "profile_select_own" on user_profiles;
create policy "profile_select_own" on user_profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "profile_insert_own" on user_profiles;
create policy "profile_insert_own" on user_profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profile_update_own" on user_profiles;
create policy "profile_update_own" on user_profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "taste_vector_select_own" on user_taste_vectors;
create policy "taste_vector_select_own" on user_taste_vectors for select to authenticated using (auth.uid() = user_id);

drop policy if exists "taste_vector_insert_own" on user_taste_vectors;
create policy "taste_vector_insert_own" on user_taste_vectors for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "taste_vector_update_own" on user_taste_vectors;
create policy "taste_vector_update_own" on user_taste_vectors for update to authenticated using (auth.uid() = user_id);

drop policy if exists "favourites_select_own" on user_favourite_dishes;
create policy "favourites_select_own" on user_favourite_dishes for select to authenticated using (auth.uid() = user_id);

drop policy if exists "favourites_insert_own" on user_favourite_dishes;
create policy "favourites_insert_own" on user_favourite_dishes for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "favourites_delete_own" on user_favourite_dishes;
create policy "favourites_delete_own" on user_favourite_dishes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "public_select_blog_posts" on blog_posts;
create policy "public_select_blog_posts" on blog_posts for select using (true);

drop policy if exists "public_select_stall_posts" on stall_posts;
create policy "public_select_stall_posts" on stall_posts for select using (true);

drop policy if exists "public_select_bites" on bites;
create policy "public_select_bites" on bites for select using (true);

drop policy if exists "bites_insert_own" on bites;
create policy "bites_insert_own" on bites for insert to authenticated with check (auth.uid() = author_id);

drop policy if exists "bites_update_own" on bites;
create policy "bites_update_own" on bites for update to authenticated using (auth.uid() = author_id);

drop policy if exists "bites_delete_own" on bites;
create policy "bites_delete_own" on bites for delete to authenticated using (auth.uid() = author_id);

drop policy if exists "bite_reactions_select_own" on bite_reactions;
create policy "bite_reactions_select_own" on bite_reactions for select to authenticated using (auth.uid() = user_id);

drop policy if exists "bite_reactions_insert_own" on bite_reactions;
create policy "bite_reactions_insert_own" on bite_reactions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "bite_reactions_delete_own" on bite_reactions;
create policy "bite_reactions_delete_own" on bite_reactions for delete to authenticated using (auth.uid() = user_id);
