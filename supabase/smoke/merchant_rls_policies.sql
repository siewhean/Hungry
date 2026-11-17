-- Merchant Centre RLS smoke checks.
-- Run after applying merchant migrations to a linked or local Supabase DB.

select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'merchant_accounts',
    'merchant_roles',
    'merchant_outlets',
    'merchant_verifications',
    'merchant_verification_evidence',
    'merchant_promotions',
    'customer_interaction_reports',
    'merchant_notification_preferences'
  )
order by tablename;

select
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'merchant_accounts',
    'merchant_roles',
    'merchant_outlets',
    'merchant_verifications',
    'merchant_verification_evidence',
    'merchant_promotions',
    'customer_interaction_reports',
    'merchant_notification_preferences',
    'venues',
    'dishes',
    'dish_images',
    'dish_taste_vectors',
    'dish_dietary_flags',
    'reviews'
  )
  and (
    policyname like 'merchant_%'
    or policyname like 'venues_update_merchant%'
    or policyname like 'dishes_write_merchant%'
    or policyname like 'dish_images_%_merchant%'
    or policyname like 'dish_taste_vectors_%_merchant%'
    or policyname like 'dish_dietary_flags_%_merchant%'
    or policyname like 'reviews_update_merchant%'
    or policyname like 'interaction_reports_%'
    or policyname like 'notification_prefs_%'
  )
order by tablename, policyname;

select
  tgname,
  tgrelid::regclass::text as table_name
from pg_trigger
where tgname = 'trg_enforce_merchant_review_reply_update';

select
  tgname,
  tgrelid::regclass::text as table_name
from pg_trigger
where tgname in (
  'trg_enforce_merchant_venue_update_guard',
  'trg_enforce_merchant_dish_write_guard'
)
order by tgname;

select
  proname,
  prosecdef as security_definer
from pg_proc
where proname in (
  'merchant_can_manage_venue',
  'merchant_outlet_matches_catalog_link',
  'enforce_merchant_review_reply_update',
  'enforce_merchant_venue_update_guard',
  'enforce_merchant_dish_write_guard'
)
order by proname;
