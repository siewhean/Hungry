-- Full Audit V1 social safety hardening.
-- Additive production-readiness layer for reports, blocks, checked chat sends,
-- and admin-gated moderation queue reads.

alter table content_reports
  drop constraint if exists content_reports_target_type_check;

alter table content_reports
  add constraint content_reports_target_type_check
  check (target_type in (
    'review',
    'bite',
    'reply',
    'profile',
    'post',
    'post_comment',
    'story',
    'message'
  ));

create table if not exists post_comment_moderation_states (
  comment_id uuid primary key references post_comments(id) on delete cascade,
  state text not null default 'visible'
    check (state in ('visible', 'under_review', 'hidden', 'removed')),
  reason_code text,
  latest_action_id uuid references moderation_actions(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_post_comment_moderation_states_state_updated
  on post_comment_moderation_states(state, updated_at desc);

alter table post_comment_moderation_states enable row level security;

drop policy if exists "post_comment_moderation_states_service_role_all"
on post_comment_moderation_states;
create policy "post_comment_moderation_states_service_role_all"
on post_comment_moderation_states for all to service_role
using (true)
with check (true);

revoke insert, update, delete on table content_reports from anon, authenticated;
grant select on table content_reports to authenticated;
grant all on table content_reports to service_role;

create or replace function public.app_user_block_exists(
  p_left_user_id uuid,
  p_right_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_left_user_id <> p_right_user_id, false)
    and exists (
      select 1
      from user_blocks ub
      where (
        ub.blocker_id = p_left_user_id
        and ub.blocked_user_key = p_right_user_id::text
      )
      or (
        ub.blocker_id = p_right_user_id
        and ub.blocked_user_key = p_left_user_id::text
      )
    );
$$;

revoke execute on function public.app_user_block_exists(uuid, uuid) from public;
grant execute on function public.app_user_block_exists(uuid, uuid)
to authenticated, service_role;

create or replace function public.app_can_make_user_request_window(
  p_actor_user_id uuid,
  p_action text,
  p_window text default 'minute',
  p_limit integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_actor_user_id is null then
    return false;
  end if;

  v_window_start := case lower(coalesce(p_window, 'minute'))
    when 'hour' then date_trunc('hour', now())
    else date_trunc('minute', now())
  end;

  insert into app_user_rate_limits (actor_user_id, action, window_start, count)
  values (p_actor_user_id, p_action, v_window_start, 1)
  on conflict (actor_user_id, action, window_start)
  do update set
    count = app_user_rate_limits.count + 1,
    updated_at = now()
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute
on function public.app_can_make_user_request_window(uuid, text, text, integer)
from public, anon, authenticated;
grant execute
on function public.app_can_make_user_request_window(uuid, text, text, integer)
to service_role;

create or replace function public.can_read_author_content(p_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_author_id is not null
    and (
      auth.uid() = p_author_id
      or (
        not public.app_user_block_exists(auth.uid(), p_author_id)
        and (
          coalesce((
            select ps.account_visibility = 'public'
            from privacy_settings ps
            where ps.user_id = p_author_id
          ), true)
          or exists (
            select 1
            from follows f
            where f.followee_id = p_author_id
              and f.follower_id = auth.uid()
              and f.status = 'approved'
          )
        )
      )
      or (
        auth.uid() is null
        and coalesce((
          select ps.account_visibility = 'public'
          from privacy_settings ps
          where ps.user_id = p_author_id
        ), true)
      )
    );
$$;

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

drop policy if exists "post_comments_select_visible_post" on post_comments;
create policy "post_comments_select_visible_post"
on post_comments for select to authenticated
using (
  public.can_read_post(post_id)
  and deleted_at is null
  and not exists (
    select 1
    from post_comment_moderation_states pcms
    where pcms.comment_id = post_comments.id
      and pcms.state in ('hidden', 'removed')
  )
);

drop policy if exists "post_comments_insert_visible_post" on post_comments;
create policy "post_comments_insert_visible_post"
on post_comments for insert to authenticated
with check (
  auth.uid() = user_id
  and public.can_read_post(post_id)
);

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_client_nonce text default null,
  p_sender_merchant_account_id uuid default null
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_user_id uuid,
  sender_merchant_account_id uuid,
  body text,
  client_nonce text,
  delivered_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_message messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required to send messages.' using errcode = '42501';
  end if;

  if v_body is null or char_length(v_body) > 4000 then
    raise exception 'Message body must be 1-4000 characters.';
  end if;

  if not public.can_access_conversation(p_conversation_id) then
    raise exception 'Conversation is unavailable to this sender.' using errcode = '42501';
  end if;

  if p_sender_merchant_account_id is not null
    and not public.is_merchant_member(p_sender_merchant_account_id) then
    raise exception 'Merchant sender is unavailable to this user.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.participant_user_id is not null
      and cp.participant_user_id <> v_user_id
      and public.app_user_block_exists(v_user_id, cp.participant_user_id)
  ) then
    raise exception 'Messaging is unavailable between these users.' using errcode = '42501';
  end if;

  if not public.app_can_make_user_request_window(v_user_id, 'chat_message_minute', 'minute', 30)
    or not public.app_can_make_user_request_window(v_user_id, 'chat_message_hour', 'hour', 120) then
    raise exception 'Message rate limit exceeded.' using errcode = '42901';
  end if;

  insert into messages (
    conversation_id,
    sender_user_id,
    sender_merchant_account_id,
    body,
    client_nonce,
    delivered_at
  )
  values (
    p_conversation_id,
    case when p_sender_merchant_account_id is null then v_user_id else null end,
    p_sender_merchant_account_id,
    v_body,
    coalesce(p_client_nonce, v_user_id::text || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::text),
    now()
  )
  returning * into v_message;

  update conversations
  set updated_at = now()
  where conversations.id = p_conversation_id;

  return query
  select
    v_message.id,
    v_message.conversation_id,
    v_message.sender_user_id,
    v_message.sender_merchant_account_id,
    v_message.body,
    v_message.client_nonce,
    v_message.delivered_at,
    v_message.created_at;
end;
$$;

revoke insert, update, delete on table messages from anon, authenticated;
grant select on table messages to authenticated;
grant all on table messages to service_role;
revoke execute
on function public.send_chat_message(uuid, text, text, uuid)
from public, anon;
grant execute
on function public.send_chat_message(uuid, text, text, uuid)
to authenticated, service_role;

create or replace function public.report_post(
  p_post_id uuid,
  p_reason_code text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report_id uuid;
  action_id uuid;
  report_count integer;
  current_user_id uuid := auth.uid();
  normalized_reason text := lower(nullif(trim(coalesce(p_reason_code, '')), ''));
begin
  if current_user_id is null then
    raise exception 'Authentication required to report posts.';
  end if;

  if not public.can_read_post(p_post_id) then
    raise exception 'Post is not visible to the current user.';
  end if;

  if normalized_reason is null then
    normalized_reason := 'other';
  end if;

  insert into post_reports (reporter_id, post_id, reason_code, details, status, created_at)
  values (
    current_user_id,
    p_post_id,
    normalized_reason,
    nullif(trim(coalesce(p_details, '')), ''),
    'open',
    now()
  )
  on conflict (reporter_id, post_id, reason_code) do update
  set
    details = coalesce(excluded.details, post_reports.details),
    status = 'open',
    created_at = now(),
    resolved_at = null,
    resolved_by = null
  returning id into report_id;

  select count(distinct reporter_id)
  into report_count
  from post_reports
  where post_id = p_post_id
    and status in ('open', 'reviewing');

  if report_count >= 3 then
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
      current_user_id,
      'hide',
      normalized_reason,
      jsonb_build_object('source', 'auto_report_threshold', 'report_count', report_count)
    )
    returning id into action_id;

    insert into post_moderation_states (
      post_id,
      state,
      reason_code,
      latest_action_id,
      updated_at
    )
    values (p_post_id, 'hidden', normalized_reason, action_id, now())
    on conflict (post_id) do update
    set
      state = 'hidden',
      reason_code = excluded.reason_code,
      latest_action_id = excluded.latest_action_id,
      updated_at = now();

    delete from home_feed_items
    where post_id = p_post_id;
  elsif report_count > 0 then
    insert into post_moderation_states (post_id, state, reason_code, updated_at)
    values (p_post_id, 'under_review', normalized_reason, now())
    on conflict (post_id) do update
    set
      state = case
        when post_moderation_states.state in ('hidden', 'removed')
          then post_moderation_states.state
        else 'under_review'
      end,
      reason_code = coalesce(post_moderation_states.reason_code, excluded.reason_code),
      updated_at = now();
  end if;

  return report_id;
end;
$$;

create or replace function public.report_content(
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_target_author_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report_id uuid;
  action_id uuid;
  current_user_id uuid := auth.uid();
  normalized_target_type text := lower(nullif(trim(coalesce(p_target_type, '')), ''));
  normalized_reason text := lower(nullif(trim(coalesce(p_reason, '')), ''));
  target_uuid uuid;
  report_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required to report content.';
  end if;

  if normalized_target_type = 'post' then
    return public.report_post(p_target_id::uuid, coalesce(normalized_reason, 'other'), null);
  end if;

  if normalized_target_type not in (
    'review',
    'bite',
    'reply',
    'profile',
    'post_comment',
    'story',
    'message'
  ) then
    raise exception 'Unsupported report target type: %', p_target_type;
  end if;

  if normalized_reason is null then
    normalized_reason := 'other';
  end if;

  if normalized_target_type = 'post_comment' then
    target_uuid := p_target_id::uuid;
    if not exists (
      select 1
      from post_comments pc
      where pc.id = target_uuid
        and pc.deleted_at is null
        and public.can_read_post(pc.post_id)
    ) then
      raise exception 'Comment is not visible to the current user.';
    end if;
  end if;

  insert into content_reports (
    reporter_id,
    target_type,
    target_id,
    target_author_key,
    reason,
    status,
    created_at
  )
  values (
    current_user_id,
    normalized_target_type,
    p_target_id,
    nullif(trim(coalesce(p_target_author_key, '')), ''),
    normalized_reason,
    'open',
    now()
  )
  returning id into report_id;

  if normalized_target_type = 'post_comment' then
    select count(distinct reporter_id)
    into report_count
    from content_reports
    where target_type = 'post_comment'
      and target_id = p_target_id
      and status in ('open', 'reviewing');

    if report_count >= 3 then
      insert into moderation_actions (
        target_type,
        target_id,
        actor_id,
        action,
        reason_code,
        metadata
      )
      values (
        'post_comment',
        target_uuid,
        current_user_id,
        'hide',
        normalized_reason,
        jsonb_build_object('source', 'auto_report_threshold', 'report_count', report_count)
      )
      returning id into action_id;

      insert into post_comment_moderation_states (
        comment_id,
        state,
        reason_code,
        latest_action_id,
        updated_at
      )
      values (target_uuid, 'hidden', normalized_reason, action_id, now())
      on conflict (comment_id) do update
      set
        state = 'hidden',
        reason_code = excluded.reason_code,
        latest_action_id = excluded.latest_action_id,
        updated_at = now();
    else
      insert into post_comment_moderation_states (comment_id, state, reason_code, updated_at)
      values (target_uuid, 'under_review', normalized_reason, now())
      on conflict (comment_id) do update
      set
        state = case
          when post_comment_moderation_states.state in ('hidden', 'removed')
            then post_comment_moderation_states.state
          else 'under_review'
        end,
        reason_code = coalesce(post_comment_moderation_states.reason_code, excluded.reason_code),
        updated_at = now();
    end if;
  end if;

  return report_id;
end;
$$;

revoke execute on function public.report_content(text, text, text, text)
from public, anon;
grant execute on function public.report_content(text, text, text, text)
to authenticated, service_role;

create or replace function public.list_content_moderation_queue(
  p_limit integer default 100
)
returns table (
  source text,
  target_type text,
  target_id text,
  report_count bigint,
  latest_reported_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.app_is_current_user_ops_admin() then
    raise exception 'Ops admin access required.' using errcode = '42501';
  end if;

  if not public.app_can_make_ops_request(current_user_id, 'content_moderation_queue', 60) then
    raise exception 'Moderation queue rate limit exceeded.' using errcode = '42901';
  end if;

  return query
  select *
  from (
    select
      'post_reports'::text as source,
      'post'::text as target_type,
      pr.post_id::text as target_id,
      count(*)::bigint as report_count,
      max(pr.created_at) as latest_reported_at
    from post_reports pr
    where pr.status in ('open', 'reviewing')
    group by pr.post_id

    union all

    select
      'content_reports'::text as source,
      cr.target_type,
      cr.target_id,
      count(*)::bigint as report_count,
      max(cr.created_at) as latest_reported_at
    from content_reports cr
    where cr.status in ('open', 'reviewing')
    group by cr.target_type, cr.target_id
  ) queue
  order by latest_reported_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

revoke execute on function public.list_content_moderation_queue(integer)
from public, anon;
grant execute on function public.list_content_moderation_queue(integer)
to authenticated, service_role;

comment on function public.send_chat_message(uuid, text, text, uuid) is
  'Checked chat message writer with participant, block, merchant, and rate-limit enforcement.';

comment on function public.report_content(text, text, text, text) is
  'Checked generic report writer for reviews, bites, replies, profiles, comments, stories, and messages.';

comment on function public.list_content_moderation_queue(integer) is
  'Ops-admin moderation queue view over post_reports and generic content_reports.';
