-- Forward-only audited identity and audience boundaries.
begin;
alter table public.user_profiles add column if not exists onboarding_cuisine_ids text[] not null default '{}',add column if not exists max_dish_budget numeric,add column if not exists onboarding_selected_dish_ids text[] not null default '{}';
alter table public.user_profiles add constraint profile_budget_bounds_v2 check(max_dish_budget is null or max_dish_budget between 0 and 10000);
create schema if not exists app_private;
revoke all on schema app_private from public, anon;

create or replace function public.request_follow_v2(p_target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); state text;
begin
 if actor is null or actor = p_target_user_id then raise exception 'Invalid follow target' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(actor::text,p_target_user_id::text)||greatest(actor::text,p_target_user_id::text),0));
 if exists(select 1 from public.follows where follower_id=actor and followee_id=p_target_user_id and status='blocked') or not exists(select 1 from public.user_profiles where id=p_target_user_id) or public.app_user_block_exists(actor,p_target_user_id) then raise exception 'Follow unavailable' using errcode='42501'; end if;
 select case when coalesce(ps.account_visibility,'public')='private' then 'pending' else 'approved' end into state
 from public.user_profiles u left join public.privacy_settings ps on ps.user_id=u.id where u.id=p_target_user_id;
 insert into public.follows(follower_id,followee_id,status,approved_at)
 values(actor,p_target_user_id,state,case when state='approved' then now() end)
 on conflict(follower_id,followee_id) do update set status=case when follows.status='approved' then 'approved' else excluded.status end,
 approved_at=case when follows.status='approved' then follows.approved_at else excluded.approved_at end,updated_at=now()
 returning status into state;
 return jsonb_build_object('status',state);
end $$;
create or replace function public.decide_follow_request_v2(p_follower_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); state text;
begin
 if actor is null or p_accept is null then raise exception 'Authentication and decision required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(actor::text,p_follower_id::text)||greatest(actor::text,p_follower_id::text),0));
 if public.app_user_block_exists(actor,p_follower_id) then raise exception 'Follow unavailable' using errcode='42501'; end if;
 update public.follows set status=case when p_accept then 'approved' else 'rejected' end,
 approved_at=case when p_accept then now() end,updated_at=now()
 where followee_id=actor and follower_id=p_follower_id and status='pending' returning status into state;
 if state is null then select status into state from public.follows where followee_id=actor and follower_id=p_follower_id; end if;
 return jsonb_build_object('status',coalesce(state,'none'));
end $$;
-- All relationship state changes use locked transitions; unfollow remains owner/recipient DELETE.
revoke insert,update on public.follows from authenticated;
create or replace function public.enforce_canonical_block_target_v2()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
 begin target:=new.blocked_user_key::uuid; exception when invalid_text_representation then raise exception 'Canonical user ID required' using errcode='22023'; end;
 if target=new.blocker_id or not exists(select 1 from public.user_profiles where id=target) then raise exception 'Invalid block target' using errcode='22023'; end if;
 new.blocked_user_key:=target::text; return new;
end $$;
create trigger enforce_canonical_block_target_v2 before insert or update of blocked_user_key,blocker_id on public.user_blocks for each row execute function public.enforce_canonical_block_target_v2();

create or replace function public.get_account_deletion_status_v2()
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id',id,'status',status,'requestedAt',created_at,'scheduledFor',scheduled_for,'cancelledAt',cancelled_at)
 from public.account_deletion_requests where user_id=auth.uid() and status in ('requested','processing') order by created_at desc limit 1
$$;
create or replace function public.request_account_deletion_v2(p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('deletion:'||auth.uid()::text,0));
 insert into public.account_deletion_requests(user_id,reason) values(auth.uid(),left(p_reason,2000))
 on conflict(user_id) where status in ('requested','processing') do nothing;
 return public.get_account_deletion_status_v2();
end $$;
create or replace function public.cancel_account_deletion_v2()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare request public.account_deletion_requests%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('deletion:'||auth.uid()::text,0));
 select * into request from public.account_deletion_requests where user_id=auth.uid() and status in ('requested','processing') order by created_at desc limit 1 for update;
 if not found then return jsonb_build_object('outcome','not_pending'); end if;
 if request.status='processing' then return jsonb_build_object('outcome','processing'); end if;
 update public.account_deletion_requests set status='cancelled',cancelled_at=now() where id=request.id;
 insert into public.account_deletion_processing_events(request_id,user_id,event_type,actor) values(request.id,auth.uid(),'cancelled','account-owner');
 return jsonb_build_object('outcome','cancelled');
end $$;
create or replace function public.cancel_my_account_deletion() returns boolean language sql security invoker set search_path='' as $$ select public.cancel_account_deletion_v2()->>'outcome'='cancelled' $$;
-- The RPC supplies status and schedule; direct INSERT must not bypass them.
revoke insert on public.account_deletion_requests from authenticated;

create table public.user_collection_saves(user_id uuid not null references public.user_profiles(id) on delete cascade,collection_id text not null check(length(collection_id)>0),created_at timestamptz not null default now(),primary key(user_id,collection_id));
alter table public.user_collection_saves enable row level security;
revoke all on public.user_collection_saves from public,anon,authenticated;
grant select,insert,delete on public.user_collection_saves to authenticated;
grant all on public.user_collection_saves to service_role;
create policy collection_saves_owner on public.user_collection_saves for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Narrow security-definer lookups break recursive policies without granting notes.
create or replace function app_private.portfolio_access_v2(p_id uuid,p_edit boolean default false,p_explicit boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.portfolios p where p.id=p_id and (p_edit or p_explicit or not exists(select 1 from public.portfolio_flags moderated where moderated.portfolio_id=p.id and moderated.status='removed')) and (
 p.owner_id=auth.uid() or exists(select 1 from public.portfolio_collaborators c where c.portfolio_id=p.id and c.user_id=auth.uid() and (not p_edit or c.role='editor'))
 or (not p_edit and not p_explicit and not exists(select 1 from public.portfolio_flags f where f.portfolio_id=p.id and f.status='removed') and not public.app_user_block_exists(auth.uid(),p.owner_id) and
 (p.visibility='public' or (p.visibility='followers_only' and exists(select 1 from public.follows where follower_id=auth.uid() and followee_id=p.owner_id and status='approved'))))))
$$;
create or replace function app_private.portfolio_owner_v2(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.portfolios where id=p_id and owner_id=auth.uid()) $$;
grant usage on schema app_private to authenticated;
revoke all on function app_private.portfolio_access_v2(uuid,boolean,boolean),app_private.portfolio_owner_v2(uuid) from public,anon;
grant execute on function app_private.portfolio_access_v2(uuid,boolean,boolean),app_private.portfolio_owner_v2(uuid) to authenticated;
do $$ declare r record; begin for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('portfolios','portfolio_items','portfolio_collaborators','portfolio_follows') loop execute format('drop policy %I on public.%I',r.policyname,r.tablename); end loop; end $$;
create policy portfolio_read_v2 on public.portfolios for select to authenticated using(app_private.portfolio_access_v2(id));
create policy portfolio_insert_v2 on public.portfolios for insert to authenticated with check(owner_id=auth.uid());
create policy portfolio_update_v2 on public.portfolios for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy portfolio_delete_v2 on public.portfolios for delete to authenticated using(owner_id=auth.uid());
create policy portfolio_items_read_v2 on public.portfolio_items for select to authenticated using(app_private.portfolio_access_v2(portfolio_id));
create policy portfolio_items_insert_v2 on public.portfolio_items for insert to authenticated with check(app_private.portfolio_access_v2(portfolio_id,true));
create policy portfolio_items_update_v2 on public.portfolio_items for update to authenticated using(app_private.portfolio_access_v2(portfolio_id,true)) with check(app_private.portfolio_access_v2(portfolio_id,true));
create policy portfolio_items_delete_v2 on public.portfolio_items for delete to authenticated using(app_private.portfolio_access_v2(portfolio_id,true));
create policy portfolio_collaborators_read_v2 on public.portfolio_collaborators for select to authenticated using(app_private.portfolio_access_v2(portfolio_id));
create policy portfolio_collaborators_write_v2 on public.portfolio_collaborators for all to authenticated using(app_private.portfolio_owner_v2(portfolio_id)) with check(app_private.portfolio_owner_v2(portfolio_id));
create policy portfolio_follows_read_v2 on public.portfolio_follows for select to authenticated using(app_private.portfolio_access_v2(portfolio_id));
create policy portfolio_follows_insert_v2 on public.portfolio_follows for insert to authenticated with check(user_id=auth.uid() and app_private.portfolio_access_v2(portfolio_id));
create policy portfolio_follows_delete_v2 on public.portfolio_follows for delete to authenticated using(user_id=auth.uid());

alter table public.portfolio_items alter column score type numeric using score::numeric;
alter table public.portfolio_items add constraint portfolio_score_precision_v2 check(score is null or (score between 1 and 10 and score=round(score,1)));
create table public.portfolio_item_private_notes(item_id uuid primary key references public.portfolio_items(id) on delete cascade,private_notes text,updated_at timestamptz not null default now());
alter table public.portfolio_item_private_notes enable row level security;
revoke all on public.portfolio_item_private_notes from public,anon,authenticated;
grant select,insert,update,delete on public.portfolio_item_private_notes to authenticated;
grant all on public.portfolio_item_private_notes to service_role;
insert into public.portfolio_item_private_notes(item_id,private_notes) select id,private_notes from public.portfolio_items where private_notes is not null;
update public.portfolio_items set private_notes=null where private_notes is not null;
create policy portfolio_notes_read_v2 on public.portfolio_item_private_notes for select to authenticated using(exists(select 1 from public.portfolio_items i where i.id=item_id and app_private.portfolio_access_v2(i.portfolio_id,false,true)));
create policy portfolio_notes_write_v2 on public.portfolio_item_private_notes for all to authenticated using(exists(select 1 from public.portfolio_items i where i.id=item_id and app_private.portfolio_access_v2(i.portfolio_id,true,true))) with check(exists(select 1 from public.portfolio_items i where i.id=item_id and app_private.portfolio_access_v2(i.portfolio_id,true,true)));
create or replace function public.reject_exposed_private_notes_v2() returns trigger language plpgsql set search_path='' as $$ begin if new.private_notes is not null then raise exception 'Use protected private notes' using errcode='42501'; end if; return new; end $$;
create trigger reject_exposed_private_notes_v2 before insert or update on public.portfolio_items for each row execute function public.reject_exposed_private_notes_v2();
create or replace function public.get_portfolio_private_notes_v2(p_portfolio_id uuid) returns table(item_id uuid,private_notes text) language sql stable security invoker set search_path='' as $$ select n.item_id,n.private_notes from public.portfolio_item_private_notes n join public.portfolio_items i on i.id=n.item_id where i.portfolio_id=p_portfolio_id $$;
create or replace function public.add_portfolio_item_v2(p_portfolio_id uuid,p_item_type text,p_dish_id text,p_stall_id text,p_score numeric,p_public_notes text,p_private_notes text,p_expected_portfolio_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not app_private.portfolio_access_v2(p_portfolio_id,true,true) then raise exception 'Not authorized' using errcode='42501'; end if;
 perform 1 from public.portfolios where id=p_portfolio_id for update;
 perform public.assert_portfolio_expected_updated_at(p_portfolio_id,p_expected_portfolio_updated_at);
 insert into public.portfolio_items(portfolio_id,item_type,dish_id,stall_id,score,public_notes,position) values(p_portfolio_id,p_item_type,p_dish_id,p_stall_id,p_score,p_public_notes,coalesce((select max(position)+1 from public.portfolio_items where portfolio_id=p_portfolio_id),0)) returning id into result;
 if p_private_notes is not null then insert into public.portfolio_item_private_notes(item_id,private_notes) values(result,p_private_notes); end if;
 update public.portfolios set updated_at=clock_timestamp() where id=p_portfolio_id;
 perform public.record_passport_progress('contributor','portfolio_item_added',result::text);
 return result;
end $$;
create or replace function public.update_portfolio_item_v2(p_item_id uuid,p_patch jsonb,p_expected_portfolio_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare parent_id uuid;
begin
 select portfolio_id into parent_id from public.portfolio_items where id=p_item_id;
 if auth.uid() is null or not app_private.portfolio_access_v2(parent_id,true,true) then raise exception 'Not authorized' using errcode='42501'; end if;
 if jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('score','publicNotes','privateNotes')) then raise exception 'Invalid patch' using errcode='22023'; end if;
 perform 1 from public.portfolios where id=parent_id for update;
 perform public.assert_portfolio_expected_updated_at(parent_id,p_expected_portfolio_updated_at);
 update public.portfolio_items set score=case when p_patch?'score' then (p_patch->>'score')::numeric else score end,public_notes=case when p_patch?'publicNotes' then p_patch->>'publicNotes' else public_notes end where id=p_item_id;
 if p_patch?'privateNotes' then insert into public.portfolio_item_private_notes(item_id,private_notes) values(p_item_id,p_patch->>'privateNotes') on conflict(item_id) do update set private_notes=excluded.private_notes,updated_at=now(); end if;
 update public.portfolios set updated_at=clock_timestamp() where id=parent_id;
end $$;
-- Safe integer compatibility wrappers, without overload ambiguity or exposed notes.
create or replace function public.add_portfolio_item_with_passport(p_portfolio_id uuid,p_item_type text,p_dish_id text default null,p_stall_id text default null,p_score integer default null,p_public_notes text default null,p_private_notes text default null,p_expected_portfolio_updated_at timestamptz default null) returns uuid language sql security invoker set search_path='' as $$ select public.add_portfolio_item_v2(p_portfolio_id,p_item_type,p_dish_id,p_stall_id,p_score::numeric,p_public_notes,p_private_notes,p_expected_portfolio_updated_at) $$;
create or replace function public.update_portfolio_item_with_version(p_item_id uuid,p_score integer default null,p_public_notes text default null,p_private_notes text default null,p_expected_portfolio_updated_at timestamptz default null) returns void language sql security invoker set search_path='' as $$ select public.update_portfolio_item_v2(p_item_id,jsonb_strip_nulls(jsonb_build_object('score',p_score,'publicNotes',p_public_notes,'privateNotes',p_private_notes)),p_expected_portfolio_updated_at) $$;
create or replace function public.search_portfolios(
  p_query text,
  p_type text default null,
  p_visibility text default 'public'
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  type text,
  visibility text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  item_count bigint,
  follower_count bigint
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  return query
  select
    p.id,
    p.owner_id,
    p.name,
    p.description,
    p.type,
    p.visibility,
    p.published_at,
    p.created_at,
    p.updated_at,
    (select count(*) from public.portfolio_items where portfolio_id = p.id) as item_count,
    (select count(*) from public.portfolio_follows where portfolio_id = p.id) as follower_count
  from public.portfolios p
  where
    (p_visibility is null or p.visibility = p_visibility)
    and (p_type is null or p.type = p_type)
    and (
      lower(p.name || ' ' || coalesce(p.description, '')) like '%' || lower(coalesce(p_query, '')) || '%'
    )
    and (
      p.visibility = 'public'
      or p.owner_id = auth.uid()
      or (
        p.visibility = 'followers_only' and
        exists (
          select 1 from public.follows
          where follows.follower_id = auth.uid()
          and follows.followee_id = p.owner_id
          and follows.status = 'approved'
        )
      )
      or exists (
        select 1 from public.portfolio_collaborators
        where portfolio_collaborators.portfolio_id = p.id
        and portfolio_collaborators.user_id = auth.uid()
      )
    )
  order by
    case
      when nullif(trim(coalesce(p_query, '')), '') is null then 0
      else similarity(lower(p.name || ' ' || coalesce(p.description, '')), lower(p_query))
    end desc,
    p.created_at desc;
end;
$$;


create or replace function app_private.search_portfolios(
  p_query text,
  p_type text default null,
  p_visibility text default 'public'
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  type text,
  visibility text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  item_count bigint,
  follower_count bigint
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  return query
  select
    p.id,
    p.owner_id,
    p.name,
    p.description,
    p.type,
    p.visibility,
    p.published_at,
    p.created_at,
    p.updated_at,
    (select count(*) from public.portfolio_items where portfolio_id = p.id) as item_count,
    (select count(*) from public.portfolio_follows where portfolio_id = p.id) as follower_count
  from public.portfolios p
  where
    (p_visibility is null or p.visibility = p_visibility)
    and (p_type is null or p.type = p_type)
    and (
      lower(p.name || ' ' || coalesce(p.description, '')) like '%' || lower(coalesce(p_query, '')) || '%'
    )
    and (
      p.visibility = 'public'
      or p.owner_id = auth.uid()
      or (
        p.visibility = 'followers_only' and
        exists (
          select 1 from public.follows
          where follows.follower_id = auth.uid()
          and follows.followee_id = p.owner_id
          and follows.status = 'approved'
        )
      )
      or exists (
        select 1 from public.portfolio_collaborators
        where portfolio_collaborators.portfolio_id = p.id
        and portfolio_collaborators.user_id = auth.uid()
      )
    )
  order by
    case
      when nullif(trim(coalesce(p_query, '')), '') is null then 0
      else similarity(lower(p.name || ' ' || coalesce(p.description, '')), lower(p_query))
    end desc,
    p.created_at desc;
end;
$$;


-- Explicit grants for every new API; SECURITY DEFINER never inherits PUBLIC execution.
do $$ declare r record; begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('request_follow_v2','decide_follow_request_v2','get_account_deletion_status_v2','request_account_deletion_v2','cancel_account_deletion_v2','get_portfolio_private_notes_v2','add_portfolio_item_v2','update_portfolio_item_v2') loop execute format('revoke all on function %s from public,anon',r.sig); execute format('grant execute on function %s to authenticated',r.sig); end loop; end $$;
-- Old private RPC bodies remain callable by compatibility grants: replace them too.
create or replace function app_private.add_portfolio_item_with_passport(p_portfolio_id uuid,p_item_type text,p_dish_id text default null,p_stall_id text default null,p_score integer default null,p_public_notes text default null,p_private_notes text default null,p_expected_portfolio_updated_at timestamptz default null) returns uuid language sql security invoker set search_path='' as $$ select public.add_portfolio_item_v2(p_portfolio_id,p_item_type,p_dish_id,p_stall_id,p_score,p_public_notes,p_private_notes,p_expected_portfolio_updated_at) $$;
create or replace function app_private.update_portfolio_item_with_version(p_item_id uuid,p_score integer default null,p_public_notes text default null,p_private_notes text default null,p_expected_portfolio_updated_at timestamptz default null) returns void language sql security invoker set search_path='' as $$ select public.update_portfolio_item_with_version(p_item_id,p_score,p_public_notes,p_private_notes,p_expected_portfolio_updated_at) $$;
-- Request recipients may resolve the requester's safe identity projection.
drop policy if exists public_profiles_pending_request_v2 on public.public_profiles;
create policy public_profiles_pending_request_v2 on public.public_profiles for select to authenticated using(not public.app_user_block_exists(auth.uid(),id) and exists(select 1 from public.follows f where f.follower_id=id and f.followee_id=auth.uid() and f.status='pending'));

create or replace function public.get_user_relationships_v2(p_user_id uuid,p_direction text)
returns table(user_id uuid,display_name text,avatar_url text) language plpgsql stable security definer set search_path='' as $$
begin
 if p_direction not in ('followers','following') then raise exception 'Invalid direction' using errcode='22023';end if;
 if not public.can_read_author_content(p_user_id) then return;end if;
 return query select u.id,u.display_name,u.avatar_url from public.follows f join public.user_profiles u on u.id=case when p_direction='followers' then f.follower_id else f.followee_id end
 where f.status='approved' and case when p_direction='followers' then f.followee_id=p_user_id else f.follower_id=p_user_id end and not public.app_user_block_exists(auth.uid(),u.id) order by u.display_name,u.id;
end $$;
revoke all on function public.get_user_relationships_v2(uuid,text) from public;
grant execute on function public.get_user_relationships_v2(uuid,text) to anon,authenticated;

commit;
