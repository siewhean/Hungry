-- Remove hygiene grade from the catalog (owner decision 2026-11-12).
-- Reversible: every non-null grade is first copied to a backup table, then venues.hygiene_grade
-- is made nullable (NOT NULL and the 'A' default are dropped) and set to NULL.
-- The CHECK (hygiene_grade in ('A','B','C','D')) is kept: NULL passes a CHECK.
-- NOT applied automatically: review, then apply to STAGING ONLY (project uuylnktiipkmcweyqnpd).
-- Backout: supabase/manual/20261112090000_clear_hygiene_grade_down.sql (restores from the backup table).
-- Idempotent: a re-run never overwrites an existing backup row (the first copy is the original value).

create table if not exists public.venues_hygiene_grade_backup_20261112 (
  venue_id text primary key,
  hygiene_grade text not null,
  backed_up_at timestamptz not null default now()
);

-- Backup table is internal: RLS on with no policies = no anon/authenticated access (service role/postgres only).
alter table public.venues_hygiene_grade_backup_20261112 enable row level security;
revoke all on public.venues_hygiene_grade_backup_20261112 from anon, authenticated;

insert into public.venues_hygiene_grade_backup_20261112 (venue_id, hygiene_grade)
select id, hygiene_grade from public.venues where hygiene_grade is not null
on conflict (venue_id) do nothing;

alter table public.venues
  alter column hygiene_grade drop not null,
  alter column hygiene_grade drop default;

update public.venues set hygiene_grade = null where hygiene_grade is not null;

comment on column public.venues.hygiene_grade is 'DEPRECATED 2026-11-12: always NULL. Original values: public.venues_hygiene_grade_backup_20261112.';
