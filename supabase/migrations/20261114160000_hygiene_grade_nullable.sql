-- smoke: supabase/smoke/hygiene_grade_nullable.sql
-- Schema half of removing the hygiene grade from the catalog (owner decision 2026-11-12).
-- 1. venues.hygiene_grade becomes nullable and loses its 'A' default (the importer writes NULL).
--    The CHECK (hygiene_grade in ('A','B','C','D')) stays: NULL passes a CHECK.
-- 2. Creates the (empty) backup table that the data step, 20261114170000_clear_hygiene_grade, fills
--    before it clears any value. The two steps are separate so the schema change can ship, and be
--    undone, without touching any grade.
-- Replaces the unversioned draft 20261112090000_clear_hygiene_grade.sql, whose version collided
-- with 20261112090000_audit_batch_fixes.sql on main.
-- Backout: supabase/rollbacks/20261114160000_hygiene_grade_nullable.down.sql
-- Idempotent: every statement can run twice.

create table if not exists public.venues_hygiene_grade_backup_20261112 (
  venue_id text primary key,
  hygiene_grade text not null,
  backed_up_at timestamptz not null default now()
);

-- Internal table: RLS on with no policies means no anon/authenticated access (service role and postgres only).
alter table public.venues_hygiene_grade_backup_20261112 enable row level security;
revoke all on public.venues_hygiene_grade_backup_20261112 from anon, authenticated;

alter table public.venues
  alter column hygiene_grade drop not null,
  alter column hygiene_grade drop default;
