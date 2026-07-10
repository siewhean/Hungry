-- Corrective follow-up for DB-P0-05 after QA.
-- Keep post report queue integrity by routing report writes through the checked RPC.

drop policy if exists "post_reports_insert_own_visible_post" on post_reports;
drop policy if exists "post_reports_update_own_visible_post" on post_reports;

revoke insert, update, delete on table post_reports from anon, authenticated;
revoke select on table post_reports from anon;
grant select on table post_reports to authenticated;
grant all on table post_reports to service_role;

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

  return report_id;
end;
$$;

revoke execute on function public.report_post(uuid, text, text) from public;
grant execute on function public.report_post(uuid, text, text) to authenticated;

comment on function public.report_post(uuid, text, text) is
  'Checked social post report writer. Authenticated callers cannot update post_reports directly.';
