-- CR-E02/E08: review decisions and their immutable audit event commit together.
alter table public.dishes_draft add column if not exists review_notes text;
create index if not exists dishes_draft_review_cursor_idx
  on public.dishes_draft (review_status, created_at desc, id desc);

create or replace function public.app_review_dish_draft(
  p_draft_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_notes text default null,
  p_origin text default null,
  p_ip_hash text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.app_ops_admins
    where user_id = p_actor_user_id and enabled and role in ('operator', 'admin')
  ) then
    raise exception 'forbidden ops user' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('accepted', 'rejected', 'duplicate') then
    raise exception 'invalid review decision' using errcode = '22023';
  end if;

  update public.dishes_draft
  set review_status = p_decision,
      review_notes = coalesce(left(p_notes, 4000), review_notes),
      reviewed_by = p_actor_user_id,
      reviewed_at = now(),
      updated_at = now()
  where id = p_draft_id;
  if not found then
    raise exception 'draft not found' using errcode = 'P0002';
  end if;

  insert into public.app_ops_audit_events
    (actor_user_id, action, target_type, target_id, origin, ip_hash, metadata)
  values
    (p_actor_user_id, 'dishes_draft.review', 'dishes_draft', p_draft_id::text,
     p_origin, p_ip_hash,
     jsonb_build_object('decision', p_decision, 'hasNotes', coalesce(length(p_notes), 0) > 0));
end;
$$;
revoke all on function public.app_review_dish_draft(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.app_review_dish_draft(uuid, uuid, text, text, text, text)
  to service_role;
