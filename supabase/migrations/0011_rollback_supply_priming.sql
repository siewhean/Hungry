-- Sprint 10: rollback for 0010_supply_priming.sql.
-- Run only when a staging issue requires reverting the Supply Priming tables.
-- `set_updated_at()` is intentionally left in place — it's a generic utility
-- that downstream migrations may already depend on.
--
-- Safe to re-run (idempotent).

-- =========================================================================
-- 1. DROP RPCs
-- =========================================================================
drop function if exists submit_menu_photo(text, text, text, integer);
drop function if exists submit_merchant_claim_interest(text, text, text, text, text, text);

-- =========================================================================
-- 2. DROP TRIGGERS (dropped automatically with tables, but explicit for clarity)
-- =========================================================================
drop trigger if exists trg_menu_photo_submissions_updated_at   on menu_photo_submissions;
drop trigger if exists trg_dishes_draft_updated_at             on dishes_draft;
drop trigger if exists trg_merchant_claim_interests_updated_at on merchant_claim_interests;

-- =========================================================================
-- 3. DROP TABLES (cascade drops indexes + FKs pointing inbound)
--    Order: drop children first to avoid FK complaints.
--    dishes_draft references menu_photo_submissions, so drop dishes_draft first.
-- =========================================================================
drop table if exists dishes_draft              cascade;
drop table if exists menu_photo_submissions    cascade;
drop table if exists merchant_claim_interests  cascade;

-- set_updated_at() intentionally retained.
