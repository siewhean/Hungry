-- Phase 3 first slice: social post governance plus Home feed read model foundation.
-- Additive and backward-compatible. No partitioning, background jobs, commerce,
-- merchant/menu changes, media asset migration, or canonical ID conversion.

create table if not exists hidden_posts (
  viewer_id uuid not null references user_profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (viewer_id, post_id)
);

create index if not exists idx_hidden_posts_post_id
  on hidden_posts(post_id);

create table if not exists post_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references user_profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  reason_code text not null check (char_length(trim(reason_code)) between 1 and 80),
  details text,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references user_profiles(id) on delete set null,
  unique (reporter_id, post_id, reason_code)
);

create index if not exists idx_post_reports_post_status
  on post_reports(post_id, status, created_at desc);
create index if not exists idx_post_reports_reporter_status
  on post_reports(reporter_id, status, created_at desc);

create table if not exists moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'post_comment')),
  target_id uuid not null,
  actor_id uuid references user_profiles(id) on delete set null,
  action text not null check (
    action in ('set_state', 'hide', 'remove', 'restore', 'resolve_report', 'dismiss_report', 'annotate')
  ),
  reason_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_moderation_actions_target
  on moderation_actions(target_type, target_id, created_at desc);
create index if not exists idx_moderation_actions_actor
  on moderation_actions(actor_id, created_at desc) where actor_id is not null;

create table if not exists post_moderation_states (
  post_id uuid primary key references posts(id) on delete cascade,
  state text not null default 'visible'
    check (state in ('visible', 'under_review', 'hidden', 'removed')),
  reason_code text,
  latest_action_id uuid references moderation_actions(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_post_moderation_states_state_updated
  on post_moderation_states(state, updated_at desc);

create table if not exists home_feed_items (
  viewer_id uuid references user_profiles(id) on delete cascade,
  viewer_key text generated always as (coalesce(viewer_id::text, 'global')) stored,
  post_id uuid not null references posts(id) on delete cascade,
  rank_score double precision not null default 0,
  bucket text not null default 'global',
  feed_created_at timestamptz not null default now(),
  post_published_at timestamptz not null,
  source text not null default 'backfill',
  created_at timestamptz not null default now(),
  primary key (feed_created_at, post_id, viewer_key)
);

create index if not exists idx_home_feed_items_viewer_cursor
  on home_feed_items(viewer_key, feed_created_at desc, post_id desc);
create index if not exists idx_home_feed_items_post_id
  on home_feed_items(post_id);
create index if not exists idx_home_feed_items_bucket_cursor
  on home_feed_items(bucket, feed_created_at desc, post_id desc);

alter table hidden_posts enable row level security;
alter table post_reports enable row level security;
alter table moderation_actions enable row level security;
alter table post_moderation_states enable row level security;
alter table home_feed_items enable row level security;

drop policy if exists "hidden_posts_service_role_all" on hidden_posts;
create policy "hidden_posts_service_role_all"
on hidden_posts for all to service_role
using (true)
with check (true);

drop policy if exists "post_reports_service_role_all" on post_reports;
create policy "post_reports_service_role_all"
on post_reports for all to service_role
using (true)
with check (true);

drop policy if exists "moderation_actions_service_role_all" on moderation_actions;
create policy "moderation_actions_service_role_all"
on moderation_actions for all to service_role
using (true)
with check (true);

drop policy if exists "post_moderation_states_service_role_all" on post_moderation_states;
create policy "post_moderation_states_service_role_all"
on post_moderation_states for all to service_role
using (true)
with check (true);

drop policy if exists "home_feed_items_service_role_all" on home_feed_items;
create policy "home_feed_items_service_role_all"
on home_feed_items for all to service_role
using (true)
with check (true);

drop policy if exists "hidden_posts_select_own" on hidden_posts;
create policy "hidden_posts_select_own"
on hidden_posts for select to authenticated
using (auth.uid() = viewer_id);

drop policy if exists "hidden_posts_insert_own" on hidden_posts;
create policy "hidden_posts_insert_own"
on hidden_posts for insert to authenticated
with check (auth.uid() = viewer_id and public.can_read_post(post_id));

drop policy if exists "hidden_posts_delete_own" on hidden_posts;
create policy "hidden_posts_delete_own"
on hidden_posts for delete to authenticated
using (auth.uid() = viewer_id);

drop policy if exists "post_reports_select_own" on post_reports;
create policy "post_reports_select_own"
on post_reports for select to authenticated
using (auth.uid() = reporter_id);

drop policy if exists "post_reports_insert_own_visible_post" on post_reports;
create policy "post_reports_insert_own_visible_post"
on post_reports for insert to authenticated
with check (auth.uid() = reporter_id and public.can_read_post(post_id));

drop policy if exists "post_moderation_states_select_visible_post" on post_moderation_states;
create policy "post_moderation_states_select_visible_post"
on post_moderation_states for select to authenticated
using (public.can_read_post(post_id));

drop policy if exists "home_feed_items_select_scoped" on home_feed_items;
create policy "home_feed_items_select_scoped"
on home_feed_items for select to authenticated
using (viewer_id is null or auth.uid() = viewer_id);

create or replace function public.can_read_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from posts p
    where p.id = p_post_id
      and p.deleted_at is null
      and not exists (
        select 1
        from post_moderation_states pms
        where pms.post_id = p.id
          and pms.state in ('hidden', 'removed')
      )
      and (
        p.author_id = auth.uid()
        or (
          p.status = 'published'
          and (
            p.visibility = 'public'
            or (
              p.visibility = 'followers'
              and exists (
                select 1
                from follows f
                where f.followee_id = p.author_id
                  and f.follower_id = auth.uid()
                  and f.status = 'approved'
              )
            )
          )
          and public.can_read_author_content(p.author_id)
        )
      )
  );
$$;

create or replace function public.sync_home_feed_item_for_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from home_feed_items
  where post_id = new.id
    and viewer_id is null;

  if new.status = 'published'
    and new.deleted_at is null
    and not exists (
      select 1
      from post_moderation_states pms
      where pms.post_id = new.id
        and pms.state in ('hidden', 'removed')
    )
  then
    insert into home_feed_items (
      viewer_id,
      post_id,
      rank_score,
      bucket,
      feed_created_at,
      post_published_at,
      source
    )
    values (
      null,
      new.id,
      0,
      'global',
      coalesce(new.published_at, new.created_at),
      coalesce(new.published_at, new.created_at),
      'post_trigger'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_posts_sync_home_feed_item on posts;
create trigger trg_posts_sync_home_feed_item
after insert or update of status, deleted_at, published_at, created_at
on posts
for each row
execute function public.sync_home_feed_item_for_post();

insert into home_feed_items (
  viewer_id,
  post_id,
  rank_score,
  bucket,
  feed_created_at,
  post_published_at,
  source
)
select
  null,
  p.id,
  0,
  'global',
  coalesce(p.published_at, p.created_at),
  coalesce(p.published_at, p.created_at),
  'migration_backfill'
from posts p
where p.status = 'published'
  and p.deleted_at is null
  and not exists (
    select 1
    from post_moderation_states pms
    where pms.post_id = p.id
      and pms.state in ('hidden', 'removed')
  )
on conflict do nothing;

create or replace function public.hide_post(
  p_post_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required to hide posts.';
  end if;

  if not public.can_read_post(p_post_id) then
    raise exception 'Post is not visible to the current user.';
  end if;

  insert into hidden_posts (viewer_id, post_id, reason, created_at)
  values (auth.uid(), p_post_id, nullif(trim(coalesce(p_reason, '')), ''), now())
  on conflict (viewer_id, post_id) do update
  set
    reason = excluded.reason,
    created_at = now();
end;
$$;

create or replace function public.unhide_post(p_post_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required to unhide posts.';
  end if;

  delete from hidden_posts
  where viewer_id = auth.uid()
    and post_id = p_post_id;
end;
$$;

create or replace function public.report_post(
  p_post_id uuid,
  p_reason_code text,
  p_details text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  report_id uuid;
  normalized_reason text := lower(nullif(trim(coalesce(p_reason_code, '')), ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required to report posts.';
  end if;

  if not public.can_read_post(p_post_id) then
    raise exception 'Post is not visible to the current user.';
  end if;

  if normalized_reason is null then
    normalized_reason := 'other';
  end if;

  insert into post_reports (reporter_id, post_id, reason_code, details, status, created_at)
  values (auth.uid(), p_post_id, normalized_reason, nullif(trim(coalesce(p_details, '')), ''), 'open', now())
  on conflict (reporter_id, post_id, reason_code) do update
  set
    details = coalesce(excluded.details, post_reports.details),
    status = 'open',
    created_at = now(),
    resolved_at = null,
    resolved_by = null
  returning id into report_id;

  return report_id;
end;
$$;

create or replace function public.set_post_moderation_state(
  p_post_id uuid,
  p_state text,
  p_reason_code text default null,
  p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  action_id uuid;
  normalized_state text := lower(nullif(trim(coalesce(p_state, '')), ''));
begin
  if normalized_state not in ('visible', 'under_review', 'hidden', 'removed') then
    raise exception 'Unsupported post moderation state: %', p_state;
  end if;

  insert into moderation_actions (
    target_type,
    target_id,
    actor_id,
    action,
    reason_code,
    metadata
  )
  values (
    'post',
    p_post_id,
    p_actor_id,
    'set_state',
    nullif(trim(coalesce(p_reason_code, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into action_id;

  insert into post_moderation_states (
    post_id,
    state,
    reason_code,
    latest_action_id,
    updated_at
  )
  values (
    p_post_id,
    normalized_state,
    nullif(trim(coalesce(p_reason_code, '')), ''),
    action_id,
    now()
  )
  on conflict (post_id) do update
  set
    state = excluded.state,
    reason_code = excluded.reason_code,
    latest_action_id = excluded.latest_action_id,
    updated_at = now();

  if normalized_state in ('hidden', 'removed') then
    delete from home_feed_items
    where post_id = p_post_id;
  elsif normalized_state = 'visible' then
    insert into home_feed_items (
      viewer_id,
      post_id,
      rank_score,
      bucket,
      feed_created_at,
      post_published_at,
      source
    )
    select
      null,
      p.id,
      0,
      'global',
      coalesce(p.published_at, p.created_at),
      coalesce(p.published_at, p.created_at),
      'moderation_restore'
    from posts p
    where p.id = p_post_id
      and p.status = 'published'
      and p.deleted_at is null
    on conflict do nothing;
  end if;

  return action_id;
end;
$$;

create or replace function public.get_home_social_feed_v2(
  p_limit integer default 20,
  p_cursor_feed_created_at timestamptz default null,
  p_cursor_post_id uuid default null
)
returns table (
  id uuid,
  author_id uuid,
  venue_id text,
  building_id text,
  dish_id text,
  visibility text,
  caption text,
  generated_content jsonb,
  like_count integer,
  comment_count integer,
  save_count integer,
  share_count integer,
  published_at timestamptz,
  created_at timestamptz,
  media jsonb,
  author_display_name text,
  author_avatar_url text,
  venue_name text,
  venue_unit_number text,
  venue_building_id text,
  building_name text,
  dish_name text,
  dish_price numeric,
  dish_rating numeric,
  dish_image_url text,
  feed_created_at timestamptz,
  cursor_feed_created_at timestamptz,
  cursor_post_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit,
      p_cursor_feed_created_at as cursor_feed_created_at,
      p_cursor_post_id as cursor_post_id
  ),
  visible_feed_items as (
    select
      hfi.feed_created_at,
      hfi.rank_score,
      p.*
    from home_feed_items hfi
    join posts p on p.id = hfi.post_id
    cross join params
    where (hfi.viewer_id is null or hfi.viewer_id = auth.uid())
      and p.status = 'published'
      and p.deleted_at is null
      and public.can_read_post(p.id)
      and not exists (
        select 1
        from hidden_posts hp
        where hp.viewer_id = auth.uid()
          and hp.post_id = p.id
      )
      and not exists (
        select 1
        from post_moderation_states pms
        where pms.post_id = p.id
          and pms.state in ('hidden', 'removed')
      )
      and (
        params.cursor_feed_created_at is null
        or hfi.feed_created_at < params.cursor_feed_created_at
        or (
          hfi.feed_created_at = params.cursor_feed_created_at
          and params.cursor_post_id is not null
          and p.id < params.cursor_post_id
        )
      )
    order by hfi.feed_created_at desc, hfi.rank_score desc, p.id desc
    limit (select result_limit from params)
  )
  select
    p.id,
    p.author_id,
    p.venue_id,
    coalesce(p.building_id, v.building_id, d.building_id) as building_id,
    p.dish_id,
    p.visibility,
    p.caption,
    p.generated_content,
    p.like_count,
    p.comment_count,
    p.save_count,
    p.share_count,
    p.published_at,
    p.created_at,
    coalesce(media_items.media, '[]'::jsonb) as media,
    up.display_name as author_display_name,
    up.avatar_url as author_avatar_url,
    v.name as venue_name,
    v.unit_number as venue_unit_number,
    v.building_id as venue_building_id,
    b.name as building_name,
    d.name as dish_name,
    d.price as dish_price,
    d.rating_avg as dish_rating,
    d.image_url as dish_image_url,
    p.feed_created_at,
    p.feed_created_at as cursor_feed_created_at,
    p.id as cursor_post_id
  from visible_feed_items p
  left join user_profiles up on up.id = p.author_id
  left join venues v on v.id = p.venue_id
  left join dishes d on d.id = p.dish_id
  left join buildings b on b.id = coalesce(p.building_id, v.building_id, d.building_id)
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', pm.id,
        'post_id', pm.post_id,
        'media_type', pm.media_type,
        'storage_bucket', pm.storage_bucket,
        'storage_path', pm.storage_path,
        'public_url', pm.public_url,
        'sort_order', pm.sort_order
      )
      order by pm.sort_order, pm.id
    ) as media
    from post_media pm
    where pm.post_id = p.id
  ) media_items on true
  order by p.feed_created_at desc, p.rank_score desc, p.id desc;
$$;

revoke execute on function public.hide_post(uuid, text) from public;
revoke execute on function public.unhide_post(uuid) from public;
revoke execute on function public.report_post(uuid, text, text) from public;
revoke execute on function public.set_post_moderation_state(uuid, text, text, uuid, jsonb) from public;
revoke execute on function public.get_home_social_feed_v2(integer, timestamptz, uuid) from public;

grant execute on function public.hide_post(uuid, text) to authenticated;
grant execute on function public.unhide_post(uuid) to authenticated;
grant execute on function public.report_post(uuid, text, text) to authenticated;
grant execute on function public.set_post_moderation_state(uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.get_home_social_feed_v2(integer, timestamptz, uuid) to authenticated;

comment on table hidden_posts is
  'Per-user hidden post state used to remove posts from Home feed without deleting canonical content.';
comment on table post_reports is
  'Structured social post reports. Existing content_reports remains for legacy review/bite/profile reports.';
comment on table moderation_actions is
  'Service-role moderation audit log for social content state changes.';
comment on table post_moderation_states is
  'Current moderation state for posts; hidden and removed posts are excluded by can_read_post and Home feed reads.';
comment on table home_feed_items is
  'Home feed read model foundation. Currently global-first, with viewer-specific rows reserved for later ranking.';
comment on function public.get_home_social_feed_v2(integer, timestamptz, uuid) is
  'Bounded Home social feed read model with hidden-post and moderation-state exclusions.';
