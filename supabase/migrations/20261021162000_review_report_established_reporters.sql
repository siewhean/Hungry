-- H34: three throwaway or stall-owned accounts could hide any review.
--
-- report_content still records every review report and still hides a review
-- at 3 distinct reporters, but a reporter now counts only when:
--   - their account (auth.users.created_at) is at least 7 days old;
--   - they are not the review's author;
--   - they hold no merchant account or merchant role at the reviewed stall.
-- A review with fewer qualifying reporters is marked 'under_review' (still
-- visible) for ops. Hiding stays reversible: set_review_moderation_state
-- (service role or ops admin) restores it and dismisses the open reports.
--
-- Function redefined: app_private.report_content(text, text, text, text),
-- based on 20261019080000_review_report_auto_hide.sql with the search_path
-- from 20261019090000_review_auto_hide_merchant_followup.sql. Post and
-- comment reports are unchanged. The public wrapper is unchanged.

create schema if not exists app_private;

create or replace function app_private.report_content(
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_target_author_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  report_id uuid;
  action_id uuid;
  current_user_id uuid := auth.uid();
  normalized_target_type text := lower(nullif(trim(coalesce(p_target_type, '')), ''));
  normalized_reason text := lower(nullif(trim(coalesce(p_reason, '')), ''));
  target_uuid uuid;
  report_count integer;
  review_dish_id text;
  review_author_id uuid;
  review_venue_id text;
  review_state text;
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

  -- Review ids are uuids; anything else is recorded without moderation.
  if normalized_target_type = 'review'
    and btrim(coalesce(p_target_id, ''))
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select r.id, r.dish_id, r.user_id, r.venue_id
      into target_uuid, review_dish_id, review_author_id, review_venue_id
    from reviews r
    where r.id = btrim(p_target_id)::uuid;
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

  if normalized_target_type = 'review' and target_uuid is not null then
    -- Only established, independent reporters count towards auto-hide:
    -- accounts at least 7 days old that are not the review's author and hold
    -- no merchant account or role at the reviewed stall. Every report is
    -- still recorded for ops.
    select count(distinct cr.reporter_id)
    into report_count
    from content_reports cr
    join auth.users au on au.id = cr.reporter_id
    where cr.target_type = 'review'
      and lower(btrim(cr.target_id)) = target_uuid::text
      and cr.status in ('open', 'reviewing')
      and au.created_at <= now() - interval '7 days'
      and cr.reporter_id is distinct from review_author_id
      and not exists (
        select 1
        from merchant_outlets mo
        left join merchant_accounts ma
          on ma.id = mo.merchant_account_id
        left join merchant_roles mr
          on mr.merchant_account_id = mo.merchant_account_id
        where mo.venue_id = review_venue_id
          and (ma.user_id = cr.reporter_id or mr.user_id = cr.reporter_id)
      );

    select rms.state
    into review_state
    from review_moderation_states rms
    where rms.review_id = target_uuid;

    if report_count >= 3 and coalesce(review_state, 'visible') not in ('hidden', 'removed') then
      insert into moderation_actions (
        target_type,
        target_id,
        actor_id,
        action,
        reason_code,
        metadata
      )
      values (
        'review',
        target_uuid,
        current_user_id,
        'hide',
        normalized_reason,
        jsonb_build_object('source', 'auto_report_threshold', 'report_count', report_count)
      )
      returning id into action_id;

      insert into review_moderation_states (
        review_id,
        state,
        reason_code,
        latest_action_id,
        updated_at
      )
      values (target_uuid, 'hidden', normalized_reason, action_id, now())
      on conflict (review_id) do update
      set
        state = 'hidden',
        reason_code = excluded.reason_code,
        latest_action_id = excluded.latest_action_id,
        updated_at = now();

      perform app_private.refresh_dish_review_stats(review_dish_id);
    elsif coalesce(review_state, 'visible') not in ('hidden', 'removed') then
      insert into review_moderation_states (review_id, state, reason_code, updated_at)
      values (target_uuid, 'under_review', normalized_reason, now())
      on conflict (review_id) do update
      set
        state = 'under_review',
        reason_code = coalesce(review_moderation_states.reason_code, excluded.reason_code),
        updated_at = now();
    end if;
  end if;

  return report_id;
end;
$$;

revoke all on function app_private.report_content(text, text, text, text)
  from public, anon, authenticated;
grant execute on function app_private.report_content(text, text, text, text)
  to authenticated, service_role;
