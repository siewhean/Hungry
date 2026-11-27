#!/usr/bin/env bash
# Promote verified Jurong West launch-zone rows from STAGING to PRODUCTION — Package 1.7.
#
#   scripts/db/promote-launch-zone.sh
#       Dry run (read-only on both staging and prod): checks prod Free-tier size budget (< 450 MB),
#       exports the launch zone's buildings, venues, non-archived dishes, dish_images, and dietary
#       flags from staging, and reports exact counts without writing to prod.
#
#   scripts/db/promote-launch-zone.sh --apply
#       1. Refuses unless STAGING_DB_URL and PROD_DB_URL point to distinct projects and prod is < 450 MB.
#       2. Takes a verified backup of prod via scripts/db/backup.sh.
#       3. Upserts the zone's buildings, venues, and non-merchant non-archived dishes (preserving prod
#          diner rating_avg/review_count and excluding production merchant-owned stalls across dishes,
#          dish_images, and dish_dietary_flags) in one atomic transaction on prod, runs
#          app_private.apply_launch_zone(), and refreshes active catalog_raw_* venue cards, dish cards,
#          and dish media galleries for the zone via public.catalog_raw_refresh_venue.
#       4. Prints launch_zone_report() on both staging and prod plus the prod size check.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/common.sh"

APPLY=0
MAX_PROD_MB="${MAX_PROD_DB_MB_BEFORE_PROMOTE:-450}"
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    *) die "usage: promote-launch-zone.sh [--apply]" ;;
  esac
  shift
done

[[ "$MAX_PROD_MB" =~ ^[0-9]+$ ]] || die "MAX_PROD_DB_MB_BEFORE_PROMOTE must be a whole number of MB"

# Validate both environments up front without leaking credentials across calls.
load_env staging
STAGING_URL="$DB_URL"
STAGING_PW="${PGPASSWORD:-}"
STAGING_PROJECT_REF="$DB_REF"

load_env prod
PROD_URL="$DB_URL"
PROD_PW="${PGPASSWORD:-}"
PROD_PROJECT_REF="$DB_REF"

[ "$STAGING_PROJECT_REF" != "$PROD_PROJECT_REF" ] \
  || die "staging and prod resolve to the same project ($PROD_PROJECT_REF)"

psql_staging() { PGPASSWORD="$STAGING_PW" psql "$STAGING_URL" -X -v ON_ERROR_STOP=1 "$@"; }
psql_prod() { PGPASSWORD="$PROD_PW" psql "$PROD_URL" -X -v ON_ERROR_STOP=1 "$@"; }

[ "$(psql_staging -At -c "select to_regclass('public.launch_zone_places') is not null")" = t ] \
  || die "20261116130000_launch_zone is not applied on staging ($STAGING_PROJECT_REF)"
[ "$(psql_prod -At -c "select to_regclass('public.launch_zone_places') is not null")" = t ] \
  || die "20261116130000_launch_zone is not applied on prod ($PROD_PROJECT_REF); ship 20261116130000 first"

STAGE_PLACES="$(psql_staging -At -c "select count(*) from public.launch_zone_places")"
[ "$STAGE_PLACES" -gt 0 ] || die "public.launch_zone_places is empty on staging; run app_private.apply_launch_zone() there first"

PROD_BYTES="$(psql_prod -At -c "select pg_database_size(current_database())")"
PROD_MB=$((PROD_BYTES / 1048576))
say "prod size before promote: ${PROD_MB} MB (safety ceiling: ${MAX_PROD_MB} MB, Free cap: 500 MB)"
if [ "$PROD_MB" -ge "$MAX_PROD_MB" ]; then
  die "prod database is ${PROD_MB} MB (>= ${MAX_PROD_MB} MB). Run 'scripts/db/reclaim-free-tier-budget.sh prod --apply' first."
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

say "reading launch-zone snapshot from staging ($STAGING_PROJECT_REF)"
psql_staging -At -c "
  with zone_buildings as (
    select b.*
      from public.buildings b
     where b.id in (select lp.building_id from public.launch_zone_places lp)
  ),
  zone_venues as (
    select v.*
      from public.venues v
     where v.building_id in (select id from zone_buildings)
  ),
  zone_dishes as (
    select d.*
      from public.dishes d
     where d.venue_id in (select id from zone_venues)
       and d.archived_at is null
  ),
  zone_dish_images as (
    select di.*
      from public.dish_images di
     where di.dish_id in (select id from zone_dishes)
  ),
  zone_dietary_links as (
    select ddf.dish_id, df.slug, df.name
      from public.dish_dietary_flags ddf
      join public.dietary_flags df on df.id = ddf.dietary_flag_id
     where ddf.dish_id in (select id from zone_dishes)
  )
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'places', (select count(*) from public.launch_zone_places),
      'buildings', (select count(*) from zone_buildings),
      'venues', (select count(*) from zone_venues),
      'venues_with_schedule', (select count(*) from zone_venues where opening_schedule is not null),
      'dishes', (select count(*) from zone_dishes),
      'priced_dishes', (select count(*) from zone_dishes where price > 0),
      'dish_images', (select count(*) from zone_dish_images)
    ),
    'buildings', coalesce((select jsonb_agg(to_jsonb(zb) - 'location' order by zb.id) from zone_buildings zb), '[]'::jsonb),
    'venues', coalesce((select jsonb_agg(to_jsonb(zv) - 'location' order by zv.id) from zone_venues zv), '[]'::jsonb),
    'dishes', coalesce((select jsonb_agg(to_jsonb(zd) order by zd.id) from zone_dishes zd), '[]'::jsonb),
    'dish_images', coalesce((select jsonb_agg(to_jsonb(zdi) order by zdi.dish_id, zdi.sort_order) from zone_dish_images zdi), '[]'::jsonb),
    'dietary_links', coalesce((select jsonb_agg(to_jsonb(zdl) order by zdl.dish_id, zdl.slug) from zone_dietary_links zdl), '[]'::jsonb)
  );
" >"$WORK/zone.json"

node -e '
  const data = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log("staging zone payload:", JSON.stringify(data.counts));
  if (!data.counts || data.counts.buildings === 0 || data.counts.venues === 0) {
    console.error("ERROR: staging launch zone has 0 buildings or 0 venues");
    process.exit(1);
  }
' "$WORK/zone.json"

say "staging launch_zone_report:"
psql_staging -c "select * from app_private.launch_zone_report()"

if [ "$APPLY" -ne 1 ]; then
  say "dry run: nothing written to prod. Add --apply to back up prod and promote the launch zone."
  exit 0
fi

CONFIRM="${CONFIRM_PROMOTE:-}"
if [ -z "$CONFIRM" ]; then
  [ -t 0 ] || die "not interactive: set CONFIRM_PROMOTE=promote-zone"
  read -r -p "Type promote-zone to promote the Jurong West launch zone onto PRODUCTION ($PROD_PROJECT_REF): " CONFIRM
fi
[ "$CONFIRM" = "promote-zone" ] || die "confirmation did not match"

say "1/3 backing up production ($PROD_PROJECT_REF)"
BACKUP_DIR="$("$DB_DIR/backup.sh" prod "pre-launch-zone-promote" | tail -1)"
say "backup saved at $BACKUP_DIR"

say "2/3 applying launch-zone rows to production in one transaction"
psql_prod -1 -v payload_file="$WORK/zone.json" <<'SQL'
\set payload `cat :'payload_file'`
set local statement_timeout = 0;

create temp table _zone_payload (doc jsonb not null) on commit drop;
insert into _zone_payload (doc) values (:'payload'::jsonb);

create temp table _merchant_venue_ids (venue_id text primary key) on commit drop;
create temp table _eligible_dish_ids (dish_id text primary key) on commit drop;

do $$
declare
  v_doc jsonb := (select doc from _zone_payload limit 1);
  v_cols text;
  v_updates text;
  v_img_cols text;
  v_img_updates text;
  v_venue_id text;
  v_active_release uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('promote_launch_zone', 0));
  set constraints all immediate;

  if to_regclass('public.merchant_outlets') is not null then
    execute 'insert into _merchant_venue_ids (venue_id) select distinct mo.venue_id from public.merchant_outlets mo where mo.venue_id is not null on conflict do nothing';
  end if;

  -- 1. Upsert zone buildings (skipping generated columns like location).
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg(format('%I = excluded.%I', column_name, column_name), ', ' order by ordinal_position)
           filter (where column_name not in ('id', 'created_at'))
    into v_cols, v_updates
    from information_schema.columns
   where table_schema = 'public' and table_name = 'buildings' and is_generated = 'NEVER';

  execute format(
    'insert into public.buildings (%s) select %s from jsonb_populate_recordset(null::public.buildings, $1->''buildings'') on conflict (id) do update set %s',
    v_cols, v_cols, v_updates
  ) using v_doc;

  -- 2. Upsert zone venues (preserving any existing prod opening_schedule if staging''s is null).
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg(
           case
             when column_name = 'opening_schedule'
               then 'opening_schedule = coalesce(excluded.opening_schedule, public.venues.opening_schedule)'
             else format('%I = excluded.%I', column_name, column_name)
           end,
           ', ' order by ordinal_position
         ) filter (where column_name not in ('id', 'created_at'))
    into v_cols, v_updates
    from information_schema.columns
   where table_schema = 'public' and table_name = 'venues' and is_generated = 'NEVER';

  execute format(
    'insert into public.venues (%s) select %s from jsonb_populate_recordset(null::public.venues, $1->''venues'') on conflict (id) do update set %s',
    v_cols, v_cols, v_updates
  ) using v_doc;

  -- 3. Upsert zone dishes: preserve prod rating_avg/review_count and never write to merchant-claimed stalls.
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg(format('%I = excluded.%I', column_name, column_name), ', ' order by ordinal_position)
           filter (where column_name not in ('id', 'created_at', 'rating_avg', 'review_count'))
    into v_cols, v_updates
    from information_schema.columns
   where table_schema = 'public' and table_name = 'dishes' and is_generated = 'NEVER';

  execute format(
    'insert into public.dishes (%s) '
    || 'select %s from jsonb_populate_recordset(null::public.dishes, $1->''dishes'') src '
    || 'where not exists (select 1 from _merchant_venue_ids mv where mv.venue_id = src.venue_id) '
    || 'on conflict (id) do update set %s '
    || 'where not exists (select 1 from _merchant_venue_ids mv where mv.venue_id = public.dishes.venue_id)',
    v_cols, v_cols, v_updates
  ) using v_doc;

  -- Record the exact eligible non-merchant dish set so child tables (dish_images, dish_dietary_flags)
  -- share the identical exclusion and never modify a production merchant-owned dish.
  insert into _eligible_dish_ids (dish_id)
  select d.id
    from public.dishes d
   where d.id in (select (elem->>'id') from jsonb_array_elements(v_doc->'dishes') elem)
     and not exists (select 1 from _merchant_venue_ids mv where mv.venue_id = d.venue_id)
  on conflict do nothing;

  -- 4. Sync dish_images (including provenance/rights columns) and dietary_flags for eligible non-merchant dishes only.
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg(format('%I = excluded.%I', column_name, column_name), ', ' order by ordinal_position)
           filter (where column_name not in ('id', 'dish_id', 'sort_order', 'created_at'))
    into v_img_cols, v_img_updates
    from information_schema.columns
   where table_schema = 'public' and table_name = 'dish_images' and is_generated = 'NEVER';

  execute format(
    'insert into public.dish_images (%s) '
    || 'select %s from jsonb_populate_recordset(null::public.dish_images, $1->''dish_images'') x '
    || 'where exists (select 1 from _eligible_dish_ids ed where ed.dish_id = x.dish_id) '
    || 'on conflict (dish_id, sort_order) do update set %s',
    v_img_cols, v_img_cols, v_img_updates
  ) using v_doc;

  insert into public.dietary_flags (slug, name)
  select distinct x.slug, x.name
    from jsonb_to_recordset(v_doc->'dietary_links') as x(dish_id text, slug text, name text)
   where exists (select 1 from _eligible_dish_ids ed where ed.dish_id = x.dish_id)
  on conflict (slug) do nothing;

  delete from public.dish_dietary_flags ddf
   where exists (select 1 from _eligible_dish_ids ed where ed.dish_id = ddf.dish_id)
     and not exists (
       select 1
         from jsonb_to_recordset(v_doc->'dietary_links') as x(dish_id text, slug text, name text)
         join public.dietary_flags df on df.slug = x.slug
        where x.dish_id = ddf.dish_id
          and df.id = ddf.dietary_flag_id
     );

  insert into public.dish_dietary_flags (dish_id, dietary_flag_id)
  select x.dish_id, df.id
    from jsonb_to_recordset(v_doc->'dietary_links') as x(dish_id text, slug text, name text)
    join public.dietary_flags df on df.slug = x.slug
   where exists (select 1 from _eligible_dish_ids ed where ed.dish_id = x.dish_id)
  on conflict (dish_id, dietary_flag_id) do nothing;

  -- 5. Register/merge launch-zone places and refresh active catalog_raw_* venue cards, dish cards,
  -- and dish media galleries in-place within this transaction.
  perform app_private.apply_launch_zone();

  select id into v_active_release from public.catalog_releases where status = 'active' limit 1;
  if v_active_release is not null then
    if to_regprocedure('public.catalog_raw_refresh_venue(text)') is not null then
      for v_venue_id in
        select v.id
          from public.venues v
         where v.building_id in (select lp.building_id from public.launch_zone_places lp)
         order by v.id
      loop
        perform public.catalog_raw_refresh_venue(v_venue_id);
      end loop;
    else
      delete from public.catalog_raw_dish_media m
       where m.release_id = v_active_release
         and m.dish_id in (
           select d.id from public.dishes d
            where d.building_id in (select lp.building_id from public.launch_zone_places lp)
         );

      insert into public.catalog_raw_dish_media (
        release_id, dish_id, media_key, url, source_url, rights_status, approved_for_display, sort_order
      )
      select v_active_release, media.dish_id, media.media_key, media.url, media.source_url,
             media.rights_status, media.approved_for_display, media.sort_order
        from (
          select d.id as dish_id,
                 'inline:' || d.id as media_key,
                 d.image_url as url,
                 d.media_source_url as source_url,
                 d.media_rights_status as rights_status,
                 d.media_approved_for_display as approved_for_display,
                 -1 as sort_order
            from public.dishes d
           where d.building_id in (select lp.building_id from public.launch_zone_places lp)
             and d.archived_at is null
             and nullif(trim(coalesce(d.image_url, '')), '') is not null
          union all
          select di.dish_id,
                 di.id::text as media_key,
                 di.url,
                 di.media_source_url as source_url,
                 di.media_rights_status as rights_status,
                 di.media_approved_for_display as approved_for_display,
                 di.sort_order
            from public.dish_images di
            join public.dishes d on d.id = di.dish_id
           where d.building_id in (select lp.building_id from public.launch_zone_places lp)
             and d.archived_at is null
             and nullif(trim(coalesce(di.url, '')), '') is not null
        ) media;
    end if;
  end if;
end
$$;
SQL

say "3/3 verifying prod launch_zone_report and Free-tier DB size"
psql_prod -c "select * from app_private.launch_zone_report()"
AFTER_BYTES="$(psql_prod -At -c "select pg_database_size(current_database())")"
AFTER_MB=$((AFTER_BYTES / 1048576))
say "prod size after promote: ${AFTER_MB} MB (backup: $BACKUP_DIR)"
[ "$AFTER_MB" -lt 400 ] || say "WARNING: prod DB is ${AFTER_MB} MB (>= 400 MB warning line); run reclaim-free-tier-budget.sh prod --apply"
