-- Release-snapshotted Discover section membership. Every raw dish receives the
-- `nearby` tag; stricter tags retain their source semantics and never proxy
-- editorial or late-night status from unrelated quality/open-now fields.
create table if not exists public.catalog_raw_dish_section_tags (
  release_id uuid not null references public.catalog_releases(id) on delete cascade,
  dish_id text not null,
  section_id text not null check (section_id in ('nearby', 'budget', 'late_night', 'editors_choice')),
  rank numeric(12, 4) not null default 0,
  rotation_bucket smallint not null check (rotation_bucket between 0 and 96),
  primary key (release_id, dish_id, section_id)
);

alter table public.catalog_raw_dish_section_tags enable row level security;
revoke all on public.catalog_raw_dish_section_tags from public, anon, authenticated;
create index if not exists catalog_raw_dish_section_tags_rotation_idx
  on public.catalog_raw_dish_section_tags (release_id, section_id, rotation_bucket, rank desc, dish_id);

create or replace function public.catalog_raw_rebuild_dish_section_tags(p_release_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.catalog_raw_dish_section_tags where release_id = p_release_id;

  with eligible as materialized (
    select c.*, v.operating_hours, source.is_featured,
      mod(abs(hashtext(c.id)::bigint), 97)::smallint as rotation_bucket
    from public.catalog_raw_dish_cards c
    join public.catalog_raw_venue_cards v on v.release_id = c.release_id and v.id = c.venue_id
    join public.dishes source on source.id = c.id
    where c.release_id = p_release_id
      and not exists (
        select 1 from public.catalog_raw_excluded_venues excluded where excluded.venue_id = c.venue_id
      )
  )
  insert into public.catalog_raw_dish_section_tags (release_id, dish_id, section_id, rank, rotation_bucket)
  select release_id, id, 'nearby', rating * 100000 + review_count, rotation_bucket from eligible
  union all
  select release_id, id, 'budget', (800 - price) * 100000 + rating * 100 + review_count, rotation_bucket
  from eligible where price is not null and price <= 8
  union all
  select release_id, id, 'late_night', rating * 100000 + review_count, rotation_bucket
  from eligible
  where operating_hours ~* '(24[[:space:]]*hours?|midnight|[-–][[:space:]]*((2[2-3]|0[0-5]):[0-5][0-9]|(0?[1-9]|1[0-1]|12)(:[0-5][0-9])?[[:space:]]*(am|pm)))'
  union all
  select release_id, id, 'editors_choice', rating * 100000 + review_count, rotation_bucket
  from eligible where is_featured;
end;
$$;

-- Populate the currently active release immediately; future releases call the
-- same helper before they become active.
select public.catalog_raw_rebuild_dish_section_tags(id)
from public.catalog_releases where status = 'active';

do $$
declare v_definition text; v_original text;
begin
  select pg_get_functiondef('public.catalog_raw_publish_release(integer,integer)'::regprocedure) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    'select count(*)::integer into v_venue_total from public.catalog_raw_venue_cards where release_id = v_release_id;',
    E'perform public.catalog_raw_rebuild_dish_section_tags(v_release_id);\n\n  select count(*)::integer into v_venue_total from public.catalog_raw_venue_cards where release_id = v_release_id;'
  );
  if v_definition = v_original then
    raise exception 'catalog_raw_publish_release section-tag patch did not apply';
  end if;
  execute v_definition;
end;
$$;

create or replace function public.catalog_raw_discover_sections(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default 3000,
  p_rotation_seed text default '',
  p_release_id uuid default null,
  p_limit_per_section integer default 8
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_release uuid;
  v_limit integer := least(greatest(coalesce(p_limit_per_section, 8), 1), 12);
  v_bucket integer := mod(abs(hashtext(coalesce(p_rotation_seed, ''))::bigint), 97);
  v_sections jsonb;
begin
  perform public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);

  with requested(section_id) as (
    values ('nearby'::text), ('budget'::text), ('late_night'::text), ('editors_choice'::text)
  )
  select jsonb_object_agg(requested.section_id, section_rows.items) into v_sections
  from requested
  cross join lateral (
    select coalesce(jsonb_agg(row.card order by row.bucket_distance, row.rank desc, row.id), '[]'::jsonb) as items
    from (
      select c.id, tags.rank,
        mod(tags.rotation_bucket - v_bucket + 97, 97) as bucket_distance,
        to_jsonb(c) - 'listing_location' || jsonb_build_object(
          'section_tags', coalesce((
            select jsonb_agg(all_tags.section_id order by all_tags.section_id)
            from public.catalog_raw_dish_section_tags all_tags
            where all_tags.release_id = c.release_id and all_tags.dish_id = c.id
          ), '[]'::jsonb)
        ) as card
      from public.catalog_raw_dish_section_tags tags
      join public.catalog_raw_dish_cards c on c.release_id = tags.release_id and c.id = tags.dish_id
      where tags.release_id = v_release and tags.section_id = requested.section_id
        and not exists (
          select 1 from public.catalog_raw_excluded_venues excluded where excluded.venue_id = c.venue_id
        )
        and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(
          c.listing_location,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_radius_meters
        ))
      order by bucket_distance, tags.rank desc, c.id
      limit v_limit
    ) row
  ) section_rows;

  return jsonb_build_object('release_id', v_release, 'sections', coalesce(v_sections, '{}'::jsonb));
end;
$$;

revoke all on function public.catalog_raw_discover_sections(double precision, double precision, integer, text, uuid, integer) from public, anon;
grant execute on function public.catalog_raw_discover_sections(double precision, double precision, integer, text, uuid, integer) to authenticated;
