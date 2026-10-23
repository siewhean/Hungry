-- Release 0.1 catalog quality gate. Source rows remain auditable in the
-- canonical tables, but an unsafe source snapshot must never become active.

alter table public.catalog_releases
  add column if not exists quality_findings jsonb not null default '[]'::jsonb;

-- Keep failed-release diagnostics compact on the release row. The full,
-- row-level evidence is retained in catalog_raw_release_quarantines instead.
alter table public.catalog_releases
  add column if not exists quality_summary jsonb not null default '{}'::jsonb,
  add column if not exists source_manifest_version text,
  add column if not exists source_manifest_checksum text;

-- The publisher reads source totals from this immutable, versioned manifest;
-- callers cannot supply ad-hoc counts. A new source snapshot gets a new
-- manifest version rather than mutating a previously published expectation.
create table if not exists public.catalog_raw_release_manifests (
  manifest_version text primary key,
  source_kind text not null,
  source_checksum text not null check (source_checksum ~ '^[0-9a-f]{64}$'),
  expected_venue_total integer not null check (expected_venue_total >= 0),
  expected_dish_total integer not null check (expected_dish_total >= 0),
  created_at timestamptz not null default now()
);

alter table public.catalog_raw_release_manifests enable row level security;
revoke all on table public.catalog_raw_release_manifests from public, anon, authenticated;

alter table public.catalog_raw_venue_cards
  add column if not exists media_approved_for_display boolean;

alter table public.catalog_raw_dish_cards
  add column if not exists media_approved_for_display boolean;

-- Do not blank known-safe media on the currently active release during this
-- additive schema change. This migration is one transaction, so clients see
-- either the old projection or the fully backfilled flags. New releases below
-- remain stricter: their cards only receive explicitly approved source media.
update public.catalog_raw_venue_cards
set media_approved_for_display = public.catalog_display_image_url(
  image_url, true, media_rights_status, media_source_url
) is not null
where media_approved_for_display is null;

update public.catalog_raw_dish_cards
set media_approved_for_display = public.catalog_display_image_url(
  image_url, true, media_rights_status, media_source_url
) is not null
where media_approved_for_display is null;

update public.catalog_raw_venue_cards
set representative_dish = jsonb_set(
  representative_dish,
  '{media_approved_for_display}',
  to_jsonb(public.catalog_display_image_url(
    representative_dish->>'image_url',
    true,
    representative_dish->>'media_rights_status',
    null
  ) is not null),
  true
)
where representative_dish is not null
  and not (representative_dish ? 'media_approved_for_display');

alter table public.catalog_raw_venue_cards
  alter column media_approved_for_display set default false,
  alter column media_approved_for_display set not null;

alter table public.catalog_raw_dish_cards
  alter column media_approved_for_display set default false,
  alter column media_approved_for_display set not null;

create table if not exists public.catalog_raw_release_quarantines (
  release_id uuid not null references public.catalog_releases(id) on delete cascade,
  entity_type text not null check (entity_type in ('building', 'venue', 'dish', 'media')),
  entity_id text not null,
  reason text not null check (reason in (
    'mock_id', 'blank_name', 'non_consumer', 'semantic_duplicate', 'manual_exclusion', 'unsafe_media'
  )),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (release_id, entity_type, entity_id, reason)
);

alter table public.catalog_raw_release_quarantines enable row level security;
revoke all on table public.catalog_raw_release_quarantines from public, anon, authenticated;

create or replace function public.catalog_raw_normalize_identity(p_value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select regexp_replace(lower(trim(coalesce(p_value, ''))), '[[:space:][:punct:]]+', '', 'g')
$$;

create or replace function public.catalog_raw_is_mock_id(p_id text)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select coalesce(p_id, '') ~* '(^|[-_:])(mock|test|fixture|demo|sample)([-_:]|$)'
$$;

create or replace function public.catalog_raw_non_consumer_reason(p_name text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when lower(coalesce(p_name, '')) ~ '(^|[^a-z0-9])(7[- ]?eleven|cheers|fairprice xpress|shell select|caltex star mart|spc.?go)([^a-z0-9]|$)' then 'convenience_store'
    when lower(coalesce(p_name, '')) ~ '(school|primary school|secondary school|junior college|polytechnic|university|kindergarten|child.?care|student care)' then 'education_site'
    when lower(coalesce(p_name, '')) ~ '(staff canteen|employee canteen|workers? canteen|army camp|military camp|air base|naval base|police station|prison)' then 'private_or_restricted_site'
    when lower(coalesce(p_name, '')) ~ '(food processing|manufactur|warehouse|cold store|distribution centre|distribution center|factory|industrial)' then 'non_consumer_business'
    else null
  end
$$;

-- A finding is emitted per deterministic offending ID or duplicate group. The
-- publisher records these findings on its failed release so remediation can be
-- reviewed without activating a partial catalog.
create or replace function public.catalog_raw_publish_quality_findings()
returns table (
  code text,
  entity_type text,
  entity_ids text[],
  detail text
)
language sql
stable
set search_path = public, extensions
as $$
  with venue_rows as (
    select
      v.id,
      v.building_id,
      v.name,
      v.unit_number,
      public.catalog_raw_non_consumer_reason(concat_ws(' ', v.name, b.name)) as non_consumer_reason
    from public.venues v
    join public.buildings b on b.id = v.building_id
  ),
  venue_duplicates as (
    select
      array_agg(id order by id) as ids,
      count(*)::text || ' venues share normalized name/location' as detail
    from venue_rows
    where nullif(trim(name), '') is not null
      and nullif(trim(unit_number), '') is not null
    group by
      building_id,
      public.catalog_raw_normalize_identity(name),
      public.catalog_raw_normalize_identity(unit_number)
    having count(*) > 1
  ),
  dish_duplicates as (
    select
      array_agg(d.id order by d.id) as ids,
      'venue=' || d.venue_id || '; duplicate normalized dish name' as detail
    from public.dishes d
    where nullif(trim(d.name), '') is not null
    group by d.venue_id, public.catalog_raw_normalize_identity(d.name), d.price
    having count(*) > 1
  )
  select 'mock_venue_id', 'venue', array[v.id], 'mock/test venue IDs cannot be released'
  from venue_rows v
  where public.catalog_raw_is_mock_id(v.id)

  union all
  select 'mock_dish_id', 'dish', array[d.id], 'mock/test dish IDs cannot be released'
  from public.dishes d
  where public.catalog_raw_is_mock_id(d.id)

  union all
  select 'mock_building_id', 'building', array[b.id], 'mock/test building IDs cannot be released'
  from public.buildings b
  where public.catalog_raw_is_mock_id(b.id)

  union all
  select 'blank_venue_name', 'venue', array[v.id], 'venue name is blank'
  from venue_rows v
  where nullif(trim(v.name), '') is null

  union all
  select 'blank_dish_name', 'dish', array[d.id], 'dish name is blank'
  from public.dishes d
  where nullif(trim(d.name), '') is null

  union all
  select 'non_consumer_venue', 'venue', array[v.id], v.non_consumer_reason
  from venue_rows v
  where v.non_consumer_reason is not null

  union all
  select 'manual_exclusion', 'venue', array[v.id], e.reason
  from venue_rows v
  join public.catalog_raw_excluded_venues e on e.venue_id = v.id

  union all
  select 'semantic_duplicate_venue', 'venue', ids, detail
  from venue_duplicates

  union all
  select 'semantic_duplicate_dish', 'dish', ids, detail
  from dish_duplicates
$$;

-- Replace the original publisher only after the provenance helper is present.
-- It fails the whole candidate before the active-pointer switch: a partial
-- catalog must never silently replace a complete active release. Detailed
-- quarantines remain available for remediation; the release row is compact.
drop function if exists public.catalog_raw_publish_release(integer, integer);

create or replace function public.catalog_raw_publish_release(
  p_manifest_version text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_release_id uuid := gen_random_uuid();
  v_manifest public.catalog_raw_release_manifests%rowtype;
  v_venue_total integer;
  v_dish_total integer;
  v_quality_findings jsonb := '[]'::jsonb;
  v_quality_summary jsonb := '{}'::jsonb;
  v_projection_findings jsonb := '[]'::jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('hungry.catalog_raw_publish_release')) then
    raise exception 'catalog publisher is already running' using errcode = '55P03';
  end if;

  select *
  into v_manifest
  from public.catalog_raw_release_manifests
  where manifest_version = nullif(trim(p_manifest_version), '');

  if not found then
    raise exception 'catalog source manifest is unavailable' using errcode = 'P0001';
  end if;

  insert into public.catalog_releases (
    id, status, source_manifest_version, source_manifest_checksum
  ) values (
    v_release_id, 'building', v_manifest.manifest_version, v_manifest.source_checksum
  );

  insert into public.catalog_raw_release_quarantines (
    release_id, entity_type, entity_id, reason, details
  )
  select
    v_release_id,
    finding.entity_type,
    entity_id,
    case finding.code
      when 'mock_venue_id' then 'mock_id'
      when 'mock_dish_id' then 'mock_id'
      when 'mock_building_id' then 'mock_id'
      when 'blank_venue_name' then 'blank_name'
      when 'blank_dish_name' then 'blank_name'
      when 'non_consumer_venue' then 'non_consumer'
      when 'semantic_duplicate_venue' then 'semantic_duplicate'
      when 'semantic_duplicate_dish' then 'semantic_duplicate'
      when 'manual_exclusion' then 'manual_exclusion'
    end,
    jsonb_build_object('code', finding.code, 'detail', finding.detail, 'entity_ids', finding.entity_ids)
  from public.catalog_raw_publish_quality_findings() finding
  cross join lateral unnest(finding.entity_ids) entity_id;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'code', code,
      'entity_type', entity_type,
      'count', finding_count,
      'sample_entity_ids', sample_entity_ids,
      'detail', detail
    ) order by code, entity_type), '[]'::jsonb),
    jsonb_build_object(
      'finding_groups', count(*),
      'quarantined_rows', coalesce(sum(finding_count), 0)
    )
  into v_quality_findings, v_quality_summary
  from (
    select
      details->>'code' as code,
      entity_type,
      count(*)::integer as finding_count,
      (array_agg(entity_id order by entity_id))[1:20] as sample_entity_ids,
      min(details->>'detail') as detail
    from public.catalog_raw_release_quarantines
    where release_id = v_release_id
    group by details->>'code', entity_type
  ) compact_findings;

  if jsonb_array_length(v_quality_findings) > 0 then
    update public.catalog_releases
    set status = 'failed', quality_findings = v_quality_findings, quality_summary = v_quality_summary
    where id = v_release_id;
    return v_release_id;
  end if;

  insert into public.catalog_raw_venue_cards (
    release_id, id, building_id, name, building_name, building_type, unit_number, floor, address, postal_code,
    operating_hours, image_url, media_approved_for_display, latitude, longitude, listing_location, is_open, menu_count,
    cuisine_tags, dietary_flags, min_price, quality_rating, quality_review_count, representative_dish,
    verification_status, menu_rights_status, media_rights_status, menu_source_url, media_source_url, updated_at
  )
  select
    v_release_id, v.id, v.building_id, v.name, b.name, b.building_type, v.unit_number, v.floor,
    coalesce(v.address, b.address), coalesce(v.postal_code, b.postal_code), v.operating_hours,
    venue_media.url, venue_media.url is not null, coalesce(v.latitude, b.latitude), coalesce(v.longitude, b.longitude),
    coalesce(v.location, b.location), v.is_open,
    coalesce(menu_counts.menu_count, 0), coalesce(menu_counts.cuisine_tags, '{}'),
    coalesce(menu_counts.dietary_flags, '{}'), menu_counts.min_price,
    coalesce(top_dish.rating, 0), coalesce(top_dish.review_count, 0), top_dish.card,
    case when v.menu_approved_for_display and venue_media.url is not null then 'approved'
         when v.source_confidence >= 0.85 then 'verified' else 'raw' end,
    v.menu_rights_status, v.media_rights_status, v.menu_source_url, v.media_source_url, v.updated_at
  from public.venues v
  join public.buildings b on b.id = v.building_id
  cross join lateral (
    select public.catalog_display_image_url(
      v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url
    ) as url
  ) venue_media
  left join lateral (
    select count(distinct d.id)::integer as menu_count,
      array_remove(array_agg(distinct tag), null) as cuisine_tags,
      array_remove(array_agg(distinct dietary.slug), null) as dietary_flags,
      min(d.price) as min_price
    from public.dishes d
    left join lateral unnest(d.cuisine_tags) tag on true
    left join public.dish_dietary_flags ddf on ddf.dish_id = d.id
    left join public.dietary_flags dietary on dietary.id = ddf.dietary_flag_id
    where d.venue_id = v.id
  ) menu_counts on true
  left join lateral (
    select jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'image_url', dish_media.url,
      'media_rights_status', d.media_rights_status,
      'media_approved_for_display', dish_media.url is not null,
      'price', d.price,
      'verification_status', case when d.menu_approved_for_display and dish_media.url is not null then 'approved'
        when d.source_confidence >= 0.85 then 'verified' else 'raw' end
    ) as card, d.rating_avg as rating, d.review_count
    from public.dishes d
    cross join lateral (
      select public.catalog_display_image_url(
        d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url
      ) as url
    ) dish_media
    where d.venue_id = v.id
    order by d.rating_avg desc, d.review_count desc, d.id
    limit 1
  ) top_dish on true;

  insert into public.catalog_raw_dish_cards (
    release_id, id, venue_id, building_id, name, venue_name, building_name, building_type, description, price,
    price_range, image_url, media_approved_for_display, distance_meters, rating, review_count, cuisine_tags,
    dietary_flags, is_open, listing_location, verification_status, menu_rights_status, media_rights_status,
    menu_source_url, media_source_url, updated_at
  )
  select
    v_release_id, d.id, d.venue_id, d.building_id, d.name, v.name, b.name, b.building_type, d.description,
    d.price, d.price_range, card_media.url, card_media.url is not null,
    d.distance_meters, d.rating_avg, d.review_count,
    coalesce(nullif(d.cuisine_tags, '{}'), v.cuisine_tags, '{}'), coalesce(flags.slugs, '{}'),
    v.is_open, coalesce(v.location, b.location),
    case when d.menu_approved_for_display and card_media.url is not null then 'approved'
         when d.source_confidence >= 0.85 then 'verified' else 'raw' end,
    d.menu_rights_status, coalesce(card_media.rights_status, d.media_rights_status), d.menu_source_url,
    coalesce(card_media.source_url, d.media_source_url), d.updated_at
  from public.dishes d
  join public.venues v on v.id = d.venue_id
  join public.buildings b on b.id = d.building_id
  left join lateral (
    select candidate.url, candidate.rights_status, candidate.source_url
    from (
      select
        public.catalog_display_image_url(
          d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url
        ) as url,
        d.media_rights_status as rights_status,
        d.media_source_url as source_url,
        -1 as sort_order
      union all
      select
        public.catalog_display_image_url(
          di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url
        ) as url,
        di.media_rights_status,
        di.media_source_url,
        di.sort_order
      from public.dish_images di
      where di.dish_id = d.id
    ) candidate
    where candidate.url is not null
    order by candidate.sort_order
    limit 1
  ) card_media on true
  left join lateral (
    select array_agg(df.slug order by df.slug) as slugs
    from public.dish_dietary_flags ddf join public.dietary_flags df on df.id = ddf.dietary_flag_id
    where ddf.dish_id = d.id
  ) flags on true;

  insert into public.catalog_raw_dish_media (
    release_id, dish_id, media_key, url, source_url, rights_status, approved_for_display, sort_order
  )
  select v_release_id, d.id, 'inline:' || d.id, safe_media.url, d.media_source_url,
         d.media_rights_status, true, -1
  from public.dishes d
  cross join lateral (
    select public.catalog_display_image_url(
      d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url
    ) as url
  ) safe_media
  where safe_media.url is not null
  union all
  select v_release_id, di.dish_id, di.id::text, safe_media.url, di.media_source_url,
         di.media_rights_status, true, di.sort_order
  from public.dish_images di
  cross join lateral (
    select public.catalog_display_image_url(
      di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url
    ) as url
  ) safe_media
  where safe_media.url is not null;

  select count(*)::integer into v_venue_total from public.catalog_raw_venue_cards where release_id = v_release_id;
  select count(*)::integer into v_dish_total from public.catalog_raw_dish_cards where release_id = v_release_id;
  if v_venue_total <> v_manifest.expected_venue_total
     or v_dish_total <> v_manifest.expected_dish_total then
    update public.catalog_releases
    set status = 'failed', venue_total = v_venue_total, dish_total = v_dish_total,
      quality_findings = jsonb_build_array(jsonb_build_object(
        'code', 'source_count_mismatch',
        'entity_type', 'release',
        'count', 1,
        'sample_entity_ids', array[]::text[],
        'detail', format('manifest=%s expected venues=%s dishes=%s; projected venues=%s dishes=%s',
          v_manifest.manifest_version,
          v_manifest.expected_venue_total,
          v_manifest.expected_dish_total,
          v_venue_total,
          v_dish_total)
      )),
      quality_summary = jsonb_build_object(
        'finding_groups', 1,
        'quarantined_rows', 0,
        'manifest_version', v_manifest.manifest_version
      )
    where id = v_release_id;
    return v_release_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', compact_findings.code,
    'entity_type', compact_findings.entity_type,
    'count', compact_findings.finding_count,
    'sample_entity_ids', compact_findings.sample_entity_ids,
    'detail', compact_findings.detail
  ) order by compact_findings.code, compact_findings.entity_type), '[]'::jsonb)
  into v_projection_findings
  from (
    select
      code,
      entity_type,
      count(*)::integer as finding_count,
      (array_agg(entity_id order by entity_id))[1:20] as sample_entity_ids,
      min(detail) as detail
    from (
      select 'unsafe_card_media'::text as code, 'venue'::text as entity_type, id as entity_id,
      'venue image is not explicitly approved for display'::text as detail
      from public.catalog_raw_venue_cards
      where release_id = v_release_id
        and image_url is not null
        and (media_approved_for_display = false
          or public.catalog_display_image_url(image_url, true, media_rights_status, media_source_url) is null)
      union all
      select 'unsafe_card_media', 'dish', id, 'dish image is not explicitly approved for display'
      from public.catalog_raw_dish_cards
      where release_id = v_release_id
        and image_url is not null
        and (media_approved_for_display = false
          or public.catalog_display_image_url(image_url, true, media_rights_status, media_source_url) is null)
      union all
      select 'unsafe_detail_media', 'dish', dish_id, 'dish detail media is not explicitly approved for display'
      from public.catalog_raw_dish_media
      where release_id = v_release_id
        and (approved_for_display = false
          or public.catalog_display_image_url(url, true, rights_status, source_url) is null)
    ) finding
    group by code, entity_type
  ) compact_findings;

  if jsonb_array_length(v_projection_findings) > 0 then
    update public.catalog_releases
    set status = 'failed', venue_total = v_venue_total, dish_total = v_dish_total,
      quality_findings = v_projection_findings,
      quality_summary = jsonb_build_object(
        'finding_groups', jsonb_array_length(v_projection_findings),
        'quarantined_rows', 0,
        'manifest_version', v_manifest.manifest_version
      )
    where id = v_release_id;
    return v_release_id;
  end if;

  update public.catalog_releases
  set status = 'retired', expires_at = now() + interval '24 hours'
  where status = 'active';
  update public.catalog_releases
  set status = 'active', venue_total = v_venue_total, dish_total = v_dish_total,
    quality_findings = '[]'::jsonb,
    quality_summary = jsonb_build_object(
      'finding_groups', 0,
      'quarantined_rows', 0,
      'manifest_version', v_manifest.manifest_version
    ),
    activated_at = now()
  where id = v_release_id;
  return v_release_id;
end;
$$;

-- Quality helpers are implementation details of the controlled publisher.
-- Keep them out of the PostgREST function surface; the outer publisher is
-- already revoked from public client roles in the versioned-read migration.
revoke all on function public.catalog_raw_normalize_identity(text) from public, anon, authenticated;
revoke all on function public.catalog_raw_is_mock_id(text) from public, anon, authenticated;
revoke all on function public.catalog_raw_non_consumer_reason(text) from public, anon, authenticated;
revoke all on function public.catalog_raw_publish_quality_findings() from public, anon, authenticated;
revoke all on function public.catalog_raw_publish_release(text) from public, anon, authenticated;
grant execute on function public.catalog_raw_normalize_identity(text) to service_role;
grant execute on function public.catalog_raw_is_mock_id(text) to service_role;
grant execute on function public.catalog_raw_non_consumer_reason(text) to service_role;
grant execute on function public.catalog_raw_publish_quality_findings() to service_role;
grant execute on function public.catalog_raw_publish_release(text) to service_role;
