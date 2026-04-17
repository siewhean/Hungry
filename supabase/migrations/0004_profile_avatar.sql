-- Sprint 5: profile media support for avatar storage URLs.

alter table if exists user_profiles
  add column if not exists avatar_url text;
