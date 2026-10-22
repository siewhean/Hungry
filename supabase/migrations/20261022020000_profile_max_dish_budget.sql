-- Onboarding budget answer (r2 onboarding-M4): the "Usual budget per dish" the quiz asks for
-- was only kept on the device and lost at sign-in. It now lives on the account.
-- user_profiles.max_dish_budget is the usual maximum price per dish in SGD; null means
-- "Any price". The owner writes it through the existing profile_update_own /
-- users_update_own policies, like dietary_preferences. No new grants, and it is not copied
-- to public_profiles: a budget is private.

alter table public.user_profiles
  add column if not exists max_dish_budget numeric(6, 2);

alter table public.user_profiles
  drop constraint if exists user_profiles_max_dish_budget_range;
alter table public.user_profiles
  add constraint user_profiles_max_dish_budget_range
  check (max_dish_budget is null or (max_dish_budget > 0 and max_dish_budget <= 1000));
