-- Taste recommendation feedback loop.
-- Safe to run repeatedly.

alter table if exists user_taste_vectors
  add column if not exists confidence numeric(4, 3) not null default 0,
  add column if not exists signal_count integer not null default 0,
  add column if not exists last_signal_at timestamptz,
  add column if not exists source text not null default 'profile';

create index if not exists dish_taste_vectors_vector_hnsw_idx
  on dish_taste_vectors using hnsw (vector vector_cosine_ops)
  where vector is not null;

create index if not exists user_taste_vectors_vector_hnsw_idx
  on user_taste_vectors using hnsw (vector vector_cosine_ops)
  where vector is not null;

create table if not exists taste_interaction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  surface text not null,
  dish_id text references dishes(id) on delete set null,
  query text,
  chip_id text,
  button_id text,
  rating numeric(2, 1),
  user_vector_before vector(6),
  user_vector_after vector(6),
  applied boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists taste_interaction_events_user_created_idx
  on taste_interaction_events (user_id, created_at desc);

create index if not exists taste_interaction_events_dish_idx
  on taste_interaction_events (dish_id)
  where dish_id is not null;

create index if not exists taste_interaction_events_low_value_cap_idx
  on taste_interaction_events (
    user_id,
    type,
    surface,
    dish_id,
    query,
    chip_id,
    button_id,
    created_at desc
  );

create table if not exists quiz_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  quiz_version text not null default 'v1',
  responses jsonb not null,
  generated_taste_vector vector(6),
  created_at timestamptz not null default now()
);

create index if not exists quiz_responses_user_created_idx
  on quiz_responses (user_id, created_at desc);

create table if not exists dish_flavor_tags (
  id uuid primary key default gen_random_uuid(),
  dish_id text not null references dishes(id) on delete cascade,
  tag_slug text not null,
  suggested_vector vector(6),
  confidence numeric(4, 3) not null default 0,
  evidence_count integer not null default 0,
  rationale text,
  source text not null default 'llm_review_batch',
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dish_id, tag_slug, source)
);

create index if not exists dish_flavor_tags_dish_status_idx
  on dish_flavor_tags (dish_id, status);

alter table taste_interaction_events enable row level security;
alter table quiz_responses enable row level security;
alter table dish_flavor_tags enable row level security;

drop policy if exists "taste_interaction_events_select_own" on taste_interaction_events;
create policy "taste_interaction_events_select_own"
on taste_interaction_events for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "taste_interaction_events_insert_own" on taste_interaction_events;
create policy "taste_interaction_events_insert_own"
on taste_interaction_events for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "quiz_responses_select_own" on quiz_responses;
create policy "quiz_responses_select_own"
on quiz_responses for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "quiz_responses_insert_own" on quiz_responses;
create policy "quiz_responses_insert_own"
on quiz_responses for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "dish_flavor_tags_select_applied" on dish_flavor_tags;
create policy "dish_flavor_tags_select_applied"
on dish_flavor_tags for select
using (status = 'applied');

create or replace function public.get_taste_recommendations(
  p_surface text,
  p_user_vector double precision[],
  p_dietary_flags text[] default '{}'::text[],
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default null,
  p_exclude_dish_ids text[] default '{}'::text[],
  p_limit integer default 20
)
returns table (
  dish_id text,
  match_score double precision,
  match_percent integer,
  match_reason text,
  is_serendipitous boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      (
        '[' ||
        array_to_string(coalesce(p_user_vector, array[5, 5, 5, 5, 5, 5]::double precision[]), ',') ||
        ']'
      )::vector(6) as user_vector,
      coalesce(p_dietary_flags, '{}'::text[]) as dietary_flags,
      nullif(trim(coalesce(p_query, '')), '') as query,
      p_lat as lat,
      p_lng as lng,
      nullif(p_radius_meters, 0) as radius_filter_meters,
      greatest(coalesce(p_radius_meters, 2500), 1) as score_radius_meters,
      coalesce(p_exclude_dish_ids, '{}'::text[]) as exclude_dish_ids,
      greatest(coalesce(p_limit, 20), 1) as result_limit
  ),
  vector_candidates as (
    select
      d.id as dish_id,
      d.name,
      d.distance_meters,
      d.rating_avg,
      d.taste_tags,
      dtv.sweet,
      dtv.spicy,
      dtv.sour,
      dtv.salty,
      dtv.rich,
      dtv.aromatic,
      greatest(0, 1 - (dtv.vector <=> params.user_vector)) as taste_score,
      case
        when params.lat is not null and params.lng is not null then
          greatest(
            0,
            1 - (
              st_distance(
                b.location,
                st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
              ) / params.score_radius_meters
            )
          )
        else greatest(0, 1 - (d.distance_meters::double precision / params.score_radius_meters))
      end as distance_score,
      least(greatest(d.rating_avg::double precision / 5, 0), 1) as rating_score
    from dishes d
    join dish_taste_vectors dtv on dtv.dish_id = d.id
    join venues v on v.id = d.venue_id
    join buildings b on b.id = d.building_id
    cross join params
    where dtv.vector is not null
      and not (d.id = any(params.exclude_dish_ids))
      and (
        cardinality(params.dietary_flags) = 0
        or not exists (
          select 1
          from unnest(params.dietary_flags) as requested(flag)
          where not exists (
            select 1
            from dish_dietary_flags ddf
            join dietary_flags df on df.id = ddf.dietary_flag_id
            where ddf.dish_id = d.id
              and df.slug::text = requested.flag
          )
        )
      )
      and (
        params.query is null
        or concat_ws(' ', d.name, v.name, array_to_string(d.taste_tags, ' ')) ilike '%' || params.query || '%'
      )
      and (
        params.radius_filter_meters is null
        or (
          params.lat is not null
          and params.lng is not null
          and st_dwithin(
            b.location,
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
            params.radius_filter_meters
          )
        )
        or (
          (params.lat is null or params.lng is null)
          and d.distance_meters <= params.radius_filter_meters
        )
      )
    order by dtv.vector <=> params.user_vector
    limit (select greatest(result_limit * 5, 50) from params)
  ),
  scored as (
    select
      vc.dish_id,
      (
        0.50 * vc.taste_score +
        0.15 * 0.5 +
        0.15 * vc.distance_score +
        0.10 * vc.rating_score +
        0.10 * 0.5
      ) as match_score,
      case
        when greatest(vc.sweet, vc.spicy, vc.sour, vc.salty, vc.rich, vc.aromatic) = vc.spicy then 'Spicy profile match'
        when greatest(vc.sweet, vc.spicy, vc.sour, vc.salty, vc.rich, vc.aromatic) = vc.rich then 'Rich profile match'
        when greatest(vc.sweet, vc.spicy, vc.sour, vc.salty, vc.rich, vc.aromatic) = vc.aromatic then 'Aromatic profile match'
        when greatest(vc.sweet, vc.spicy, vc.sour, vc.salty, vc.rich, vc.aromatic) = vc.salty then 'Savory profile match'
        when greatest(vc.sweet, vc.spicy, vc.sour, vc.salty, vc.rich, vc.aromatic) = vc.sour then 'Tangy profile match'
        else 'Taste profile match'
      end as match_reason
    from vector_candidates vc
  )
  select
    scored.dish_id,
    scored.match_score,
    greatest(0, least(100, round(scored.match_score * 100)::integer)) as match_percent,
    scored.match_reason,
    false as is_serendipitous
  from scored
  order by scored.match_score desc, scored.dish_id
  limit (select result_limit from params);
$$;

grant execute on function public.get_taste_recommendations(
  text,
  double precision[],
  text[],
  text,
  double precision,
  double precision,
  integer,
  text[],
  integer
) to anon, authenticated;

create or replace function public.record_taste_interaction_event(
  p_type text,
  p_surface text,
  p_user_vector_before double precision[],
  p_user_vector_after double precision[],
  p_dish_id text default null,
  p_query text default null,
  p_chip_id text default null,
  p_button_id text default null,
  p_rating numeric default null,
  p_applied boolean default true,
  p_confidence_delta numeric default 0,
  p_source text default 'explicit_feedback',
  p_created_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_delta numeric := greatest(0, coalesce(p_confidence_delta, 0));
  v_created_at timestamptz := coalesce(p_created_at, now());
  v_effective_applied boolean := coalesce(p_applied, true);
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_vector_before double precision[] := array[
    least(10, greatest(0, coalesce(p_user_vector_before[1], 5))),
    least(10, greatest(0, coalesce(p_user_vector_before[2], 5))),
    least(10, greatest(0, coalesce(p_user_vector_before[3], 5))),
    least(10, greatest(0, coalesce(p_user_vector_before[4], 5))),
    least(10, greatest(0, coalesce(p_user_vector_before[5], 5))),
    least(10, greatest(0, coalesce(p_user_vector_before[6], 5)))
  ];
  v_vector_after double precision[] := array[
    least(10, greatest(0, coalesce(p_user_vector_after[1], 5))),
    least(10, greatest(0, coalesce(p_user_vector_after[2], 5))),
    least(10, greatest(0, coalesce(p_user_vector_after[3], 5))),
    least(10, greatest(0, coalesce(p_user_vector_after[4], 5))),
    least(10, greatest(0, coalesce(p_user_vector_after[5], 5))),
    least(10, greatest(0, coalesce(p_user_vector_after[6], 5)))
  ];
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_effective_applied
    and p_type in ('search_query', 'dish_result_click', 'food_button_click')
    and (
      select count(*)
      from taste_interaction_events tie
      where tie.user_id = v_user_id
        and tie.type = p_type
        and tie.surface = p_surface
        and tie.applied
        and tie.dish_id is not distinct from p_dish_id
        and tie.query is not distinct from p_query
        and tie.chip_id is not distinct from p_chip_id
        and tie.button_id is not distinct from p_button_id
        and tie.created_at >= v_created_at - interval '10 minutes'
    ) >= 3
  then
    v_effective_applied := false;
    v_metadata := v_metadata || jsonb_build_object('reason', 'capped');
  end if;

  insert into taste_interaction_events (
    user_id,
    type,
    surface,
    dish_id,
    query,
    chip_id,
    button_id,
    rating,
    user_vector_before,
    user_vector_after,
    applied,
    metadata,
    created_at
  )
  values (
    v_user_id,
    p_type,
    p_surface,
    p_dish_id,
    p_query,
    p_chip_id,
    p_button_id,
    p_rating,
    ('[' || array_to_string(v_vector_before, ',') || ']')::vector(6),
    ('[' || array_to_string(v_vector_after, ',') || ']')::vector(6),
    v_effective_applied,
    v_metadata,
    v_created_at
  )
  returning id into v_event_id;

  if v_effective_applied then
    insert into user_taste_vectors (
      user_id,
      sweet,
      spicy,
      sour,
      salty,
      rich,
      aromatic,
      vector,
      confidence,
      signal_count,
      last_signal_at,
      source,
      updated_at
    )
    values (
      v_user_id,
      v_vector_after[1],
      v_vector_after[2],
      v_vector_after[3],
      v_vector_after[4],
      v_vector_after[5],
      v_vector_after[6],
      ('[' || array_to_string(v_vector_after, ',') || ']')::vector(6),
      least(1, v_delta),
      1,
      v_created_at,
      coalesce(nullif(p_source, ''), 'explicit_feedback'),
      now()
    )
    on conflict (user_id) do update set
      sweet = excluded.sweet,
      spicy = excluded.spicy,
      sour = excluded.sour,
      salty = excluded.salty,
      rich = excluded.rich,
      aromatic = excluded.aromatic,
      vector = excluded.vector,
      confidence = least(1, greatest(0, user_taste_vectors.confidence + v_delta)),
      signal_count = user_taste_vectors.signal_count + 1,
      last_signal_at = excluded.last_signal_at,
      source = excluded.source,
      updated_at = now();

    insert into user_profiles (
      id,
      sweet,
      spicy,
      sour,
      salty,
      rich,
      aromatic,
      updated_at
    )
    values (
      v_user_id,
      v_vector_after[1],
      v_vector_after[2],
      v_vector_after[3],
      v_vector_after[4],
      v_vector_after[5],
      v_vector_after[6],
      now()
    )
    on conflict (id) do update set
      sweet = excluded.sweet,
      spicy = excluded.spicy,
      sour = excluded.sour,
      salty = excluded.salty,
      rich = excluded.rich,
      aromatic = excluded.aromatic,
      updated_at = now();
  end if;

  return v_event_id;
end;
$$;

grant execute on function public.record_taste_interaction_event(
  text,
  text,
  double precision[],
  double precision[],
  text,
  text,
  text,
  text,
  numeric,
  boolean,
  numeric,
  text,
  timestamptz,
  jsonb
) to authenticated;
