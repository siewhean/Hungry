#!/usr/bin/env bash
# Reclaim Supabase Free-tier database headroom (< 500 MB cap; warning line 400 MB) — Package 1.7.
#
#   scripts/db/reclaim-free-tier-budget.sh staging|prod
#       Dry run (read-only): prints current DB/storage MB, top 15 relations, catalog_releases breakdown,
#       staging_food_businesses rows, and reclaimable non-zone zero-dish raw venue cards.
#
#   scripts/db/reclaim-free-tier-budget.sh staging|prod --apply [--all-inactive-releases] [--trim-menuless-outside-zone] [--drop-hygiene-backup]
#       1. Takes a full verified backup first via scripts/db/backup.sh.
#       2. In one transaction (refusing unless exactly 1 active catalog_release exists):
#          - deletes failed/building/expired-retired catalog_releases (cascading raw card copies),
#          - truncates staging_food_businesses if present,
#          - optionally drops venues_hygiene_grade_backup_20261112 (--drop-hygiene-backup),
#          - optionally removes zero-dish non-zone raw venue cards unreferenced by any diner/merchant
#            activity (--trim-menuless-outside-zone), keeping 100% of launch_zone_places, 100% of
#            stalls with dishes, and 100% of base public.venues rows.
#       3. Runs VACUUM (FULL, ANALYZE) with a 30s lock_timeout (in separate command requests outside any
#          transaction block) on shrunk catalog/staging tables so PostgreSQL returns freed pages to the OS.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/common.sh"

[ $# -ge 1 ] || die "usage: reclaim-free-tier-budget.sh staging|prod [--apply] [--all-inactive-releases] [--trim-menuless-outside-zone] [--drop-hygiene-backup]"
TARGET="$1"
shift

APPLY=0
ALL_INACTIVE=0
TRIM_MENULESS=0
DROP_HYGIENE_BACKUP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --all-inactive-releases) ALL_INACTIVE=1 ;;
    --trim-menuless-outside-zone) TRIM_MENULESS=1 ;;
    --drop-hygiene-backup) DROP_HYGIENE_BACKUP=1 ;;
    *) die "unknown option '$1'" ;;
  esac
  shift
done

load_env "$TARGET"
say "free-tier budget audit ($ENV_NAME, $DB_REF)"

BEFORE_BYTES="$(psql_db -At -c "select pg_database_size(current_database())")"
STORAGE_BYTES="$(psql_db -At -c "select coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0)")"
BEFORE_MB=$((BEFORE_BYTES / 1048576))
STORAGE_MB=$((STORAGE_BYTES / 1048576))
say "current size: database=${BEFORE_MB} MB (Free cap 500 MB, target <300 MB), storage=${STORAGE_MB} MB"

psql_db -c "
  select schemaname || '.' || relname as relation,
         pg_size_pretty(pg_total_relation_size(relid)) as total_size,
         pg_size_pretty(pg_relation_size(relid)) as table_size,
         pg_size_pretty(pg_indexes_size(relid)) as index_size
    from pg_catalog.pg_statio_user_tables
   order by pg_total_relation_size(relid) desc
   limit 15;
"

psql_db -c "
  select status,
         count(*) as releases,
         coalesce(sum(venue_total), 0) as venue_cards_recorded,
         coalesce(sum(dish_total), 0) as dish_cards_recorded,
         count(*) filter (where expires_at is not null and expires_at > now()) as unexpired
    from public.catalog_releases
   group by status
   order by status;
"

count_optional_table() {
  local rel="$1"
  if [ "$(psql_db -At -c "select to_regclass('$rel') is not null")" = t ]; then
    psql_db -At -c "select count(*) from $rel"
  else
    echo 0
  fi
}

STAGING_FB_ROWS="$(count_optional_table "public.staging_food_businesses")"
HYGIENE_BACKUP_ROWS="$(count_optional_table "public.venues_hygiene_grade_backup_20261112")"
if [ "$(psql_db -At -c "select to_regclass('public.launch_zone_places') is not null")" = t ]; then
  NON_ZONE_MENULESS_CARDS="$(psql_db -At -c "
    select count(*)
      from public.catalog_raw_venue_cards c
      join public.catalog_releases r on r.id = c.release_id and r.status = 'active'
     where c.menu_count = 0
       and c.building_id not in (select lp.building_id from public.launch_zone_places lp)
       and not exists (select 1 from public.dishes d where d.venue_id = c.id)
  ")"
else
  NON_ZONE_MENULESS_CARDS="$(psql_db -At -c "
    select count(*)
      from public.catalog_raw_venue_cards c
      join public.catalog_releases r on r.id = c.release_id and r.status = 'active'
     where c.menu_count = 0
       and not exists (select 1 from public.dishes d where d.venue_id = c.id)
  ")"
fi

psql_db \
  -v staging_fb_rows="$STAGING_FB_ROWS" \
  -v hygiene_backup_rows="$HYGIENE_BACKUP_ROWS" \
  -v non_zone_menuless_cards="$NON_ZONE_MENULESS_CARDS" <<'SQL'
select :'staging_fb_rows'::bigint as staging_food_businesses_rows,
       :'hygiene_backup_rows'::bigint as hygiene_backup_rows,
       :'non_zone_menuless_cards'::bigint as non_zone_menuless_raw_venue_cards;
SQL

if [ "$APPLY" -ne 1 ]; then
  say "dry run: nothing changed. Add --apply to back up and reclaim space."
  exit 0
fi

if [ "$ENV_NAME" = prod ]; then
  CONFIRM="${CONFIRM_RECLAIM:-}"
  if [ -z "$CONFIRM" ]; then
    [ -t 0 ] || die "not interactive: set CONFIRM_RECLAIM=reclaim-prod"
    read -r -p "Type reclaim-prod to back up and reclaim Free-tier space on PRODUCTION ($DB_REF): " CONFIRM
  fi
  [ "$CONFIRM" = "reclaim-prod" ] || die "confirmation did not match"
fi

say "1/3 taking verified backup before reclaiming space"
BACKUP_DIR="$("$DB_DIR/backup.sh" "$TARGET" "pre-free-tier-reclaim" | tail -1)"
say "backup saved at $BACKUP_DIR"

say "2/3 pruning inactive/staging bloat inside one transaction"
psql_db -1 \
  -v all_inactive="$ALL_INACTIVE" \
  -v trim_menuless="$TRIM_MENULESS" \
  -v drop_hygiene="$DROP_HYGIENE_BACKUP" <<'SQL'
set local statement_timeout = 0;

create temp table _reclaim_opts (
  all_inactive boolean not null,
  trim_menuless boolean not null,
  drop_hygiene boolean not null
) on commit drop;

insert into _reclaim_opts (all_inactive, trim_menuless, drop_hygiene)
values (:'all_inactive' = '1', :'trim_menuless' = '1', :'drop_hygiene' = '1');

do $$
declare
  v_opts record;
  v_active_count integer;
  v_active_id uuid;
  v_deleted_releases integer := 0;
  v_trimmed_cards integer := 0;
  v_trim_sql text;
begin
  perform pg_advisory_xact_lock(hashtextextended('reclaim_free_tier_budget', 0));

  select * into v_opts from _reclaim_opts limit 1;

  select count(*), max(id::text)::uuid
    into v_active_count, v_active_id
    from public.catalog_releases
   where status = 'active';

  if v_active_count <> 1 then
    raise exception 'Expected exactly 1 active catalog_release, found %; aborting reclaim', v_active_count;
  end if;

  if v_opts.all_inactive then
    delete from public.catalog_releases where status <> 'active';
  else
    delete from public.catalog_releases
     where status in ('failed', 'building')
        or (status = 'retired' and (expires_at is null or expires_at <= now()));
  end if;
  get diagnostics v_deleted_releases = row_count;
  raise notice 'deleted inactive catalog_releases: %', v_deleted_releases;

  if to_regclass('public.staging_food_businesses') is not null then
    execute 'truncate table public.staging_food_businesses';
    raise notice 'truncated public.staging_food_businesses';
  end if;

  if v_opts.drop_hygiene and to_regclass('public.venues_hygiene_grade_backup_20261112') is not null then
    execute 'drop table public.venues_hygiene_grade_backup_20261112';
    raise notice 'dropped public.venues_hygiene_grade_backup_20261112 (preserved in pre-reclaim backup)';
  end if;

  if v_opts.trim_menuless then
    if to_regclass('public.launch_zone_places') is null then
      raise exception '--trim-menuless-outside-zone requires 20261116130000_launch_zone applied first';
    end if;
    if (select count(*) from public.launch_zone_places) = 0 then
      raise exception 'public.launch_zone_places is empty; run apply_launch_zone() or promote the zone before trimming';
    end if;

    v_trim_sql :=
      'delete from public.catalog_raw_venue_cards c '
      || 'where c.release_id = $1 '
      || 'and c.menu_count = 0 '
      || 'and c.building_id not in (select lp.building_id from public.launch_zone_places lp) '
      || 'and not exists (select 1 from public.dishes d where d.venue_id = c.id) '
      || 'and not exists (select 1 from public.reviews r where r.venue_id = c.id) '
      || 'and not exists (select 1 from public.posts p where p.venue_id = c.id)';

    if to_regclass('public.user_stall_affinities') is not null then
      v_trim_sql := v_trim_sql || ' and not exists (select 1 from public.user_stall_affinities s where s.venue_id = c.id)';
    end if;
    if to_regclass('public.merchant_outlets') is not null then
      v_trim_sql := v_trim_sql || ' and not exists (select 1 from public.merchant_outlets m where m.venue_id = c.id)';
    end if;
    if to_regclass('public.dishes_draft') is not null then
      v_trim_sql := v_trim_sql || ' and not exists (select 1 from public.dishes_draft dd where dd.venue_id = c.id)';
    end if;

    execute v_trim_sql using v_active_id;
    get diagnostics v_trimmed_cards = row_count;

    update public.catalog_releases
       set venue_total = (select count(*)::integer from public.catalog_raw_venue_cards where release_id = v_active_id)
     where id = v_active_id;
    raise notice 'trimmed zero-dish non-zone raw venue cards: %', v_trimmed_cards;
  end if;
end
$$;
SQL

say "3/3 running VACUUM (FULL, ANALYZE) on shrunk catalog/staging tables to return disk pages"
for tbl in public.catalog_releases public.catalog_raw_dish_media public.catalog_raw_dish_cards public.catalog_raw_venue_cards public.staging_food_businesses; do
  if [ "$(psql_db -At -c "select to_regclass('$tbl') is not null")" = t ]; then
    say "   vacuuming $tbl"
    psql_db -c "set lock_timeout = '30s'" -c "vacuum (full, analyze) $tbl"
  fi
done

AFTER_BYTES="$(psql_db -At -c "select pg_database_size(current_database())")"
AFTER_MB=$((AFTER_BYTES / 1048576))
SAVED_MB=$((BEFORE_MB - AFTER_MB))
say "reclaim complete: before=${BEFORE_MB} MB, after=${AFTER_MB} MB, reclaimed=${SAVED_MB} MB (backup: $BACKUP_DIR)"
if [ "$AFTER_MB" -ge 400 ]; then
  say "NOTE: database is still ${AFTER_MB} MB (>= 400 MB warning line). Re-run with --all-inactive-releases --trim-menuless-outside-zone if needed."
else
  say "OK: database (${AFTER_MB} MB) is safely below the 400 MB warning line (Free cap: 500 MB)."
fi
