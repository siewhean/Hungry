-- AI dish taste tagging (taste engine plan, phase 1).
-- The tag-dishes Edge Function asks Claude for each dish's taste vector, flavour tags and
-- dietary flags, stores the suggestion in dish_flavor_tags, and applies taste suggestions
-- with confidence >= 0.7. Dietary flags are stored as suggestions only and never applied here.

alter table public.dish_taste_vectors
  add column if not exists confidence numeric(4, 3) not null default 0
    check (confidence between 0 and 1),
  add column if not exists source text not null default 'default';

alter table public.dish_flavor_tags
  add column if not exists suggested_flavor_tags text[] not null default '{}',
  add column if not exists suggested_dietary_flags text[] not null default '{}',
  add column if not exists model text,
  add column if not exists reviewed_by uuid references public.user_profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists dish_flavor_tags_review_queue_idx
  on public.dish_flavor_tags (confidence)
  where status = 'pending';

-- Dishes whose taste vector has never been tagged and have no suggestion from this source yet.
create or replace function public.dishes_needing_taste_tags(
  p_limit integer default 25,
  p_source text default 'claude_tagging_v1'
)
returns table (
  dish_id text,
  dish_name text,
  description text,
  venue_name text,
  taste_tags text[],
  price numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.id, d.name, d.description, v.name, d.taste_tags, d.price
  from dishes d
  join venues v on v.id = d.venue_id
  left join dish_taste_vectors dtv on dtv.dish_id = d.id
  where coalesce(dtv.confidence, 0) = 0
    and not exists (
      select 1
      from dish_flavor_tags t
      where t.dish_id = d.id
        and t.tag_slug = 'taste_profile'
        and t.source = p_source
    )
  order by d.id
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

-- Copies a taste suggestion onto the dish: vector + confidence, and merges its flavour tags.
-- p_reviewer is set when a person approves a low-confidence suggestion.
create or replace function public.apply_dish_flavor_tag(
  p_tag_id uuid,
  p_reviewer uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tag dish_flavor_tags%rowtype;
  v_scores real[];
begin
  select * into v_tag from dish_flavor_tags where id = p_tag_id for update;
  if not found then
    raise exception 'dish_flavor_tag % not found', p_tag_id;
  end if;
  if v_tag.suggested_vector is null then
    raise exception 'dish_flavor_tag % has no suggested vector', p_tag_id;
  end if;

  v_scores := v_tag.suggested_vector::real[];

  insert into dish_taste_vectors (
    dish_id, sweet, spicy, sour, salty, rich, aromatic, vector, confidence, source, updated_at
  )
  values (
    v_tag.dish_id,
    v_scores[1], v_scores[2], v_scores[3], v_scores[4], v_scores[5], v_scores[6],
    v_tag.suggested_vector,
    v_tag.confidence,
    v_tag.source,
    now()
  )
  on conflict (dish_id) do update set
    sweet = excluded.sweet,
    spicy = excluded.spicy,
    sour = excluded.sour,
    salty = excluded.salty,
    rich = excluded.rich,
    aromatic = excluded.aromatic,
    vector = excluded.vector,
    confidence = excluded.confidence,
    source = excluded.source,
    updated_at = now();

  update dishes
  set taste_tags = (
    select coalesce(array_agg(distinct tag order by tag), '{}')
    from unnest(dishes.taste_tags || v_tag.suggested_flavor_tags) as tag
  )
  where id = v_tag.dish_id;

  update dish_flavor_tags
  set status = 'applied',
      reviewed_by = p_reviewer,
      reviewed_at = case when p_reviewer is null then null else now() end,
      updated_at = now()
  where id = p_tag_id;
end;
$$;

revoke all on function public.dishes_needing_taste_tags(integer, text) from public, anon, authenticated;
revoke all on function public.apply_dish_flavor_tag(uuid, uuid) from public, anon, authenticated;
grant execute on function public.dishes_needing_taste_tags(integer, text) to service_role;
grant execute on function public.apply_dish_flavor_tag(uuid, uuid) to service_role;
