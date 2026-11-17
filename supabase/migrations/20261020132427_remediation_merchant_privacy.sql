-- Verified capabilities, provenance, resumable verification and atomic OCR acceptance.
begin;
alter table public.merchant_outlets add column if not exists cuisine_categories text[] not null default '{}',add column if not exists gallery_urls text[] not null default '{}',add column if not exists dietary_labels text[] not null default '{}',add column if not exists taste_tags text[] not null default '{}',add column if not exists social_links jsonb not null default '[]',add column if not exists delivery_links jsonb not null default '[]';
create or replace function app_private.merchant_owns_outlet_v2(p_outlet_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.merchant_outlets o join public.merchant_accounts a on a.id=o.merchant_account_id where o.id=p_outlet_id and (a.user_id=auth.uid() or exists(select 1 from public.merchant_roles r where r.merchant_account_id=a.id and r.user_id=auth.uid() and r.role in ('owner','manager'))))
$$;
create or replace function public.merchant_can_manage_venue(p_venue_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.merchant_outlets o join public.merchant_verifications v on v.outlet_id=o.id where o.venue_id=p_venue_id and v.status='verified' and (v.expires_at is null or v.expires_at>now()) and app_private.merchant_owns_outlet_v2(o.id))
$$;
revoke all on function app_private.merchant_owns_outlet_v2(uuid) from public,anon;
grant execute on function app_private.merchant_owns_outlet_v2(uuid) to authenticated;
revoke all on function public.merchant_can_manage_venue(text) from public,anon;
grant execute on function public.merchant_can_manage_venue(text) to anon,authenticated;
create or replace function enforce_merchant_venue_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres','supabase_admin','service_role') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not merchant_can_manage_venue(old.id) then
    raise exception 'not authorized to update venue' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.hygiene_grade is distinct from old.hygiene_grade
    or new.is_open is distinct from old.is_open
    or new.top_dish_id is distinct from old.top_dish_id
    or new.closure_notice is distinct from old.closure_notice
    or new.live_crowd is distinct from old.live_crowd
    or new.media_approved_for_display is distinct from old.media_approved_for_display
    or new.media_rights_status is distinct from old.media_rights_status
    or new.media_source_url is distinct from old.media_source_url
    or new.media_verified_at is distinct from old.media_verified_at
    or new.media_verified_by is distinct from old.media_verified_by
    or new.menu_approved_for_display is distinct from old.menu_approved_for_display
    or new.menu_rights_status is distinct from old.menu_rights_status
    or new.menu_source_url is distinct from old.menu_source_url
    or new.menu_verified_at is distinct from old.menu_verified_at
    or new.menu_verified_by is distinct from old.menu_verified_by
    or new.created_at is distinct from old.created_at then
    raise exception 'merchant venue updates are limited to profile fields' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function enforce_merchant_dish_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres','supabase_admin','service_role') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not merchant_can_manage_venue(new.venue_id) then raise exception 'Verified merchant required' using errcode='42501'; end if;

  if tg_op = 'INSERT' then
    if not merchant_outlet_matches_catalog_link(new.venue_id, new.building_id) then
      raise exception 'dish insert must match a managed merchant outlet' using errcode = '42501';
    end if;

    if new.distance_meters is distinct from 0
      or new.rating_avg is distinct from 0
      or new.review_count is distinct from 0
      or new.live_crowd is not null
      or new.media_approved_for_display is distinct from false
      or new.media_rights_status is distinct from 'unverified'
      or new.media_source_url is not null
      or new.media_verified_at is not null
      or new.media_verified_by is not null
      or new.menu_approved_for_display is distinct from false
      or new.menu_rights_status is distinct from 'unverified'
      or new.menu_source_url is not null
      or new.menu_verified_at is not null
      or new.menu_verified_by is not null then
      raise exception 'merchant dish inserts cannot set aggregate, live, or provenance fields' using errcode = '42501';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not merchant_can_manage_venue(old.venue_id) then
      raise exception 'not authorized to update dish' using errcode = '42501';
    end if;

    if new.id is distinct from old.id
      or new.venue_id is distinct from old.venue_id
      or new.distance_meters is distinct from old.distance_meters
      or new.rating_avg is distinct from old.rating_avg
      or new.review_count is distinct from old.review_count
      or new.live_crowd is distinct from old.live_crowd
      or new.media_approved_for_display is distinct from old.media_approved_for_display
      or new.media_rights_status is distinct from old.media_rights_status
      or new.media_source_url is distinct from old.media_source_url
      or new.media_verified_at is distinct from old.media_verified_at
      or new.media_verified_by is distinct from old.media_verified_by
      or new.menu_approved_for_display is distinct from old.menu_approved_for_display
      or new.menu_rights_status is distinct from old.menu_rights_status
      or new.menu_source_url is distinct from old.menu_source_url
      or new.menu_verified_at is distinct from old.menu_verified_at
      or new.menu_verified_by is distinct from old.menu_verified_by
      or new.created_at is distinct from old.created_at then
      raise exception 'merchant dish updates cannot change identity, aggregate, live, or provenance fields' using errcode = '42501';
    end if;

    if not merchant_outlet_matches_catalog_link(new.venue_id, new.building_id) then
      raise exception 'dish building must match a managed merchant outlet' using errcode = '42501';
    end if;

    return new;
  end if;

  return new;
end;
$$;

create or replace function enforce_merchant_dish_image_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id text;
begin
  if current_user in ('postgres','supabase_admin','service_role') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select d.venue_id
  into v_venue_id
  from dishes d
  where d.id = coalesce(new.dish_id, old.dish_id);

  if v_venue_id is null or not merchant_can_manage_venue(v_venue_id) then
    raise exception 'not authorized to update dish image' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.media_approved_for_display is distinct from false
      or new.media_rights_status is distinct from 'unverified'
      or new.media_source_url is not null
      or new.media_verified_at is not null
      or new.media_verified_by is not null then
      raise exception 'merchant dish image inserts cannot set provenance fields' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.media_approved_for_display is distinct from old.media_approved_for_display
      or new.media_rights_status is distinct from old.media_rights_status
      or new.media_source_url is distinct from old.media_source_url
      or new.media_verified_at is distinct from old.media_verified_at
      or new.media_verified_by is distinct from old.media_verified_by then
      raise exception 'merchant dish image updates cannot change provenance fields' using errcode = '42501';
    end if;
    return new;
  end if;

  return new;
end;
$$;
create table public.merchant_verification_history_v2(id uuid primary key default gen_random_uuid(),verification_id uuid not null references public.merchant_verifications(id) on delete cascade,outlet_id uuid not null references public.merchant_outlets(id) on delete cascade,decision jsonb not null,recorded_at timestamptz not null default now());
alter table public.merchant_verification_history_v2 enable row level security;
revoke all on public.merchant_verification_history_v2 from public,anon,authenticated;
grant select on public.merchant_verification_history_v2 to authenticated;
grant all on public.merchant_verification_history_v2 to service_role;
create policy verification_history_owner_v2 on public.merchant_verification_history_v2 for select to authenticated using(app_private.merchant_owns_outlet_v2(outlet_id));
create or replace function public.merchant_submit_verification_v2(p_outlet_id uuid,p_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.merchant_verifications%rowtype;
begin
 if not app_private.merchant_owns_outlet_v2(p_outlet_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 perform 1 from public.merchant_outlets where id=p_outlet_id for update;
 select * into v from public.merchant_verifications where outlet_id=p_outlet_id for update;
 if v.id is null then raise exception 'Save evidence before submitting' using errcode='22023'; end if;
 if p_method not in ('video_walkaround','licence_upload','singpass_myinfo','home_based_declaration') then raise exception 'Unsupported method' using errcode='22023'; end if;
 if v.status in ('submitted','in_review','verified') then return to_jsonb(v); end if;
 if not exists(select 1 from public.merchant_verification_evidence e where e.verification_id=v.id and e.method=p_method and e.uploaded_by=auth.uid() and e.storage_bucket='merchant-verification-evidence' and e.storage_path is not null and exists(select 1 from storage.objects ob where ob.bucket_id=e.storage_bucket and ob.name=e.storage_path)) then raise exception 'Uploaded evidence required' using errcode='22023'; end if;
 if p_method='home_based_declaration' and ((select count(*) from public.merchant_verification_evidence e where e.verification_id=v.id and e.method=p_method and e.storage_bucket='merchant-verification-evidence' and exists(select 1 from storage.objects ob where ob.bucket_id=e.storage_bucket and ob.name=e.storage_path))<3 or not exists(select 1 from public.merchant_verification_evidence e where e.verification_id=v.id and e.method=p_method and length(trim(coalesce(e.review_note,'')))>=10)) then raise exception 'Three uploaded home-business photos and a declaration required' using errcode='22023'; end if;
 insert into public.merchant_verification_history_v2(verification_id,outlet_id,decision) values(v.id,p_outlet_id,to_jsonb(v));
 -- Preserve decision dates/reasons; history never disappears on resubmission.
 update public.merchant_verifications set status='submitted',method=p_method,submitted_at=now(),updated_at=now() where id=v.id returning * into v;
 return to_jsonb(v);
end $$;
create or replace function public.merchant_get_ocr_drafts_v2(p_outlet_id uuid)
returns setof public.dishes_draft language plpgsql stable security definer set search_path='' as $$
declare venue text;
begin
 if not app_private.merchant_owns_outlet_v2(p_outlet_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 select venue_id into venue from public.merchant_outlets where id=p_outlet_id;
 return query select d.* from public.dishes_draft d where d.venue_id=venue order by d.created_at,d.id;
end $$;
create or replace function public.merchant_accept_ocr_draft_v2(p_draft_id uuid,p_corrections jsonb default '{}',p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare draft public.dishes_draft%rowtype; result public.dishes%rowtype; dish_name text; amount numeric;
begin
 select * into draft from public.dishes_draft where id=p_draft_id for update;
 if not found or not public.merchant_can_manage_venue(draft.venue_id) then raise exception 'Verified merchant required' using errcode='42501'; end if;
 if draft.promoted_dish_id is not null then select * into result from public.dishes where id=draft.promoted_dish_id; return to_jsonb(result); end if;
 if draft.review_status not in ('pending','edited') then raise exception 'Draft is not pending' using errcode='40001'; end if;
 if p_expected_updated_at is not null and draft.updated_at<>p_expected_updated_at then raise exception 'Draft changed; reload' using errcode='40001'; end if;
 if jsonb_typeof(p_corrections)<>'object' or exists(select 1 from jsonb_object_keys(p_corrections) k where k not in ('name','price','description','tasteTags')) then raise exception 'Invalid corrections' using errcode='22023'; end if;
 dish_name:=trim(coalesce(p_corrections->>'name',draft.name)); amount:=case when p_corrections?'price' then (p_corrections->>'price')::numeric else draft.price_cents::numeric/100 end;
 if length(dish_name) not between 1 and 200 or amount is null or amount<0 or amount>999999.99 or amount<>round(amount,2) then raise exception 'Valid name and price required' using errcode='22023'; end if;
 insert into public.dishes(id,venue_id,building_id,name,description,price,price_range,taste_tags)
 values('dish-from-'||draft.id,draft.venue_id,draft.building_id,dish_name,coalesce(p_corrections->>'description',''),amount,'$',case when p_corrections?'tasteTags' then array(select jsonb_array_elements_text(p_corrections->'tasteTags')) else '{}'::text[] end) returning * into result;
 update public.dishes_draft set name=dish_name,name_normalized=lower(dish_name),price_cents=(amount*100)::integer,review_status='accepted',promoted_dish_id=result.id,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=draft.id;
 return to_jsonb(result);
end $$;
create or replace function public.merchant_reject_ocr_draft_v2(p_draft_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare draft public.dishes_draft%rowtype;
begin
 select * into draft from public.dishes_draft where id=p_draft_id for update;
 if not found or not public.merchant_can_manage_venue(draft.venue_id) then raise exception 'Verified merchant required' using errcode='42501'; end if;
 if draft.review_status='rejected' then return; end if;
 if draft.promoted_dish_id is not null then raise exception 'Already accepted' using errcode='40001'; end if;
 update public.dishes_draft set review_status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=draft.id;
end $$;
-- Exact residential data is retained privately before public projections are scrubbed.
create table app_private.residential_locations_v2(entity_type text not null,entity_id text not null,exact_fields jsonb not null,updated_at timestamptz not null default now(),primary key(entity_type,entity_id));
alter table app_private.residential_locations_v2 enable row level security;
revoke all on app_private.residential_locations_v2 from public,anon,authenticated;
grant all on app_private.residential_locations_v2 to service_role;
alter table public.buildings alter column latitude drop not null,alter column longitude drop not null;
-- Residential classification survives editable business-category changes.
create table app_private.residential_venues_v2(venue_id text primary key references public.venues(id) on delete cascade,location_privacy text not null default 'approximate',recorded_at timestamptz not null default now());
alter table app_private.residential_venues_v2 enable row level security;
revoke all on app_private.residential_venues_v2 from public,anon,authenticated;
grant all on app_private.residential_venues_v2 to service_role;
insert into app_private.residential_venues_v2(venue_id,location_privacy) select venue_id,case when bool_or(location_privacy='hidden') then 'hidden' when bool_or(location_privacy='approximate') then 'approximate' else 'exact' end from public.merchant_outlets where business_type='home_based' and venue_id is not null group by venue_id on conflict do nothing;
create or replace function app_private.residential_privacy_v2(p_venue_id text) returns text language sql stable security definer set search_path='' as $$
 select case when bool_or(location_privacy='hidden') then 'hidden' when bool_or(location_privacy='approximate') then 'approximate' else 'exact' end from (
 select location_privacy from public.merchant_outlets where venue_id=p_venue_id and (business_type='home_based' or exists(select 1 from app_private.residential_venues_v2 rv where rv.venue_id=p_venue_id))
 union all select location_privacy from app_private.residential_venues_v2 where venue_id=p_venue_id) states
$$;
create or replace function app_private.scrub_residential_location_v2() returns trigger language plpgsql security definer set search_path='' as $$
declare privacy text; fields jsonb; coarse_lat double precision; coarse_lng double precision; patch jsonb;
begin
 if tg_table_name='venues' then privacy:=app_private.residential_privacy_v2(new.id);
 else
  if not exists(select 1 from public.venues v join app_private.residential_venues_v2 rv on rv.venue_id=v.id where v.building_id=new.id) or exists(select 1 from public.venues v where v.building_id=new.id and not exists(select 1 from app_private.residential_venues_v2 rv where rv.venue_id=v.id)) then return new;end if;
  select case when bool_or(app_private.residential_privacy_v2(v.id)='approximate') then 'approximate' when bool_or(app_private.residential_privacy_v2(v.id)='hidden') then 'hidden' else 'exact' end into privacy from public.venues v join app_private.residential_venues_v2 rv on rv.venue_id=v.id where v.building_id=new.id;
 end if;
 if privacy is null or privacy='exact' then
  select exact_fields into fields from app_private.residential_locations_v2 where entity_type=tg_table_name and entity_id=new.id;
  if fields is not null and new.address is null then new:=jsonb_populate_record(new,fields);end if;
  return new;
 end if;
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into fields from jsonb_each(to_jsonb(new)) where key in ('latitude','longitude','address','postal_code','google_formatted_address','google_latitude','google_longitude','google_place_id');
 if tg_table_name='venues' then fields:=fields||jsonb_build_object('unit_number',to_jsonb(new)->'unit_number','floor',to_jsonb(new)->'floor');else fields:=fields||jsonb_build_object('name',new.name);end if;
 -- Keep the first exact snapshot; later public no-op writes must not replace it with coarse data.
 insert into app_private.residential_locations_v2(entity_type,entity_id,exact_fields) values(tg_table_name,new.id,fields) on conflict(entity_type,entity_id) do nothing;
 if tg_op='UPDATE' then
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into patch from jsonb_each(fields) where value is distinct from to_jsonb(old)->key;
  if patch<>'{}'::jsonb then update app_private.residential_locations_v2 set exact_fields=exact_fields||patch,updated_at=now() where entity_type=tg_table_name and entity_id=new.id;end if;
 end if;
 select exact_fields into fields from app_private.residential_locations_v2 where entity_type=tg_table_name and entity_id=new.id;
 if privacy='approximate' then coarse_lat:=floor((fields->>'latitude')::double precision*100)/100+0.005; coarse_lng:=floor((fields->>'longitude')::double precision*100)/100+0.005; end if;
 new.latitude:=coarse_lat;new.longitude:=coarse_lng;new.address:=null;new.postal_code:=null;
 new:=jsonb_populate_record(new,jsonb_build_object('google_formatted_address',null,'google_latitude',null,'google_longitude',null,'google_place_id',null));
 if tg_table_name='venues' then new:=jsonb_populate_record(new,jsonb_build_object('unit_number','','floor',''));else new.name:='Approximate home-business area';end if;
 return new;
end $$;
create trigger zz_residential_privacy_v2 before insert or update on public.venues for each row execute function app_private.scrub_residential_location_v2();
create trigger zz_residential_privacy_v2 before insert or update on public.buildings for each row execute function app_private.scrub_residential_location_v2();
create or replace function app_private.refresh_residential_privacy_v2() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.venue_id is not null then
  if new.business_type='home_based' or exists(select 1 from app_private.residential_venues_v2 where venue_id=new.venue_id) then insert into app_private.residential_venues_v2(venue_id,location_privacy) values(new.venue_id,new.location_privacy) on conflict(venue_id) do update set location_privacy=excluded.location_privacy;end if;
  update public.venues set latitude=latitude where id=new.venue_id;
  update public.buildings set latitude=latitude where id=(select building_id from public.venues where id=new.venue_id);
  -- Existing versioned snapshots are also public projections, never an exception.
  if exists(select 1 from app_private.residential_venues_v2 rv where rv.venue_id=new.venue_id) and new.location_privacy='hidden' then delete from public.catalog_raw_dish_cards where venue_id=new.venue_id;delete from public.catalog_raw_venue_cards where id=new.venue_id; end if;
  update public.catalog_raw_venue_cards c set building_name=case when exists(select 1 from app_private.residential_venues_v2 rv where rv.venue_id=new.venue_id) and new.location_privacy<>'exact' then null else c.building_name end,unit_number=v.unit_number,floor=v.floor,address=v.address,postal_code=v.postal_code,latitude=v.latitude,longitude=v.longitude,listing_location=v.location from public.venues v where c.id=v.id and v.id=new.venue_id;
  update public.catalog_raw_dish_cards c set building_name=case when exists(select 1 from app_private.residential_venues_v2 rv where rv.venue_id=new.venue_id) and new.location_privacy<>'exact' then null else c.building_name end,listing_location=v.location from public.venues v where c.venue_id=v.id and v.id=new.venue_id;
 end if;
 return new;
end $$;
create trigger refresh_residential_privacy_v2 after insert or update of location_privacy,business_type,venue_id on public.merchant_outlets for each row execute function app_private.refresh_residential_privacy_v2();
-- Re-materialize all existing residential projections under the new boundary.
update public.merchant_outlets set location_privacy=location_privacy where business_type='home_based';
-- Future publisher snapshots cannot reintroduce exact residential fields.
create or replace function app_private.scrub_raw_residential_v2() returns trigger language plpgsql security definer set search_path='' as $$
declare venue text; v public.venues%rowtype;
begin
 venue:=case when tg_table_name='catalog_raw_venue_cards' then new.id else to_jsonb(new)->>'venue_id' end;
 if app_private.residential_privacy_v2(venue)='hidden' then return null; end if;
 if app_private.residential_privacy_v2(venue)='approximate' then
  select * into v from public.venues where id=venue;
  new.listing_location:=v.location;new:=jsonb_populate_record(new,jsonb_build_object('building_name',null));
  if tg_table_name='catalog_raw_venue_cards' then new:=jsonb_populate_record(new,jsonb_build_object('unit_number','','floor','','address',null,'postal_code',null,'building_name',null,'latitude',v.latitude,'longitude',v.longitude)); end if;
 end if;
 return new;
end $$;
create trigger scrub_raw_residential_v2 before insert or update on public.catalog_raw_venue_cards for each row execute function app_private.scrub_raw_residential_v2();
create trigger scrub_raw_residential_v2 before insert or update on public.catalog_raw_dish_cards for each row execute function app_private.scrub_raw_residential_v2();
-- No exact-location read RPC for ordinary consumers; owner recovery is separately scoped.
create or replace function public.merchant_get_exact_location_v2(p_outlet_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare venue text; result jsonb;
begin
 if not app_private.merchant_owns_outlet_v2(p_outlet_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 select venue_id into venue from public.merchant_outlets where id=p_outlet_id;
 select exact_fields into result from app_private.residential_locations_v2 where entity_type='venues' and entity_id=venue;
 return result;
end $$;

do $$ declare r record; begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('merchant_submit_verification_v2','merchant_get_ocr_drafts_v2','merchant_accept_ocr_draft_v2','merchant_reject_ocr_draft_v2','merchant_get_exact_location_v2') loop execute format('revoke all on function %s from public,anon',r.sig);execute format('grant execute on function %s to authenticated',r.sig);end loop;end $$;
-- Hidden listings have no map/search/share public projection.
delete from public.catalog_raw_dish_cards c where app_private.residential_privacy_v2(c.venue_id)='hidden';
delete from public.catalog_raw_venue_cards c where app_private.residential_privacy_v2(c.id)='hidden';
grant usage on schema app_private to anon;
revoke all on function app_private.residential_privacy_v2(text) from public;
grant execute on function app_private.residential_privacy_v2(text) to anon,authenticated;
create policy residential_venue_read_boundary_v2 on public.venues as restrictive for select to anon,authenticated using(coalesce(app_private.residential_privacy_v2(id),'exact')<>'hidden' or public.merchant_can_manage_venue(id));
create policy residential_dish_read_boundary_v2 on public.dishes as restrictive for select to anon,authenticated using(coalesce(app_private.residential_privacy_v2(venue_id),'exact')<>'hidden' or public.merchant_can_manage_venue(venue_id));
create or replace function public.guard_merchant_live_capability_v2() returns trigger language plpgsql set search_path='' as $$
declare venue text;
begin
 if current_user in ('postgres','supabase_admin','service_role') then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_table_name='merchant_outlets' then
  if new.is_live and (tg_op='INSERT' or old.is_live is distinct from new.is_live) and not public.merchant_can_manage_venue(new.venue_id) then raise exception 'Verified merchant required to go live' using errcode='42501';end if;
 else
  select venue_id into venue from public.merchant_outlets where id=case when tg_op='DELETE' then old.outlet_id else new.outlet_id end;
  if not public.merchant_can_manage_venue(venue) then raise exception 'Verified merchant required for promotions' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger merchant_live_capability_v2 before insert or update on public.merchant_outlets for each row execute function public.guard_merchant_live_capability_v2();
create trigger merchant_promotion_capability_v2 before insert or update or delete on public.merchant_promotions for each row execute function public.guard_merchant_live_capability_v2();

create or replace function public.merchant_update_exact_location_v2(p_outlet_id uuid,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare venue text; saved jsonb; privacy text;
begin
 select venue_id,location_privacy into venue,privacy from public.merchant_outlets where id=p_outlet_id for update;
 if not app_private.merchant_owns_outlet_v2(p_outlet_id) or not public.merchant_can_manage_venue(venue) then raise exception 'Verified owner required' using errcode='42501';end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('latitude','longitude','address','postal_code','unit_number','floor')) then raise exception 'Invalid location patch' using errcode='22023';end if;
 if (p_patch?'latitude' and ((p_patch->>'latitude')::double precision not between -90 and 90)) or (p_patch?'longitude' and ((p_patch->>'longitude')::double precision not between -180 and 180)) then raise exception 'Invalid coordinates' using errcode='22023';end if;
 insert into app_private.residential_locations_v2(entity_type,entity_id,exact_fields) select 'venues',v.id,jsonb_build_object('latitude',v.latitude,'longitude',v.longitude,'address',v.address,'postal_code',v.postal_code,'unit_number',v.unit_number,'floor',v.floor) from public.venues v where v.id=venue on conflict(entity_type,entity_id) do nothing;
 update app_private.residential_locations_v2 set exact_fields=exact_fields||p_patch,updated_at=now() where entity_type='venues' and entity_id=venue returning exact_fields into saved;
 -- Apply saved exact fields; sanitizer immediately reprojects hidden/approximate values.
 update public.venues set latitude=(saved->>'latitude')::double precision,longitude=(saved->>'longitude')::double precision,address=saved->>'address',postal_code=saved->>'postal_code',unit_number=coalesce(saved->>'unit_number',''),floor=coalesce(saved->>'floor','') where id=venue;
 return saved;
end $$;
revoke all on function public.merchant_update_exact_location_v2(uuid,jsonb) from public,anon;
grant execute on function public.merchant_update_exact_location_v2(uuid,jsonb) to authenticated;

commit;
