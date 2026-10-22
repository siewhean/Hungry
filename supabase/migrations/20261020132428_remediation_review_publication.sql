-- Private immutable review media; publication is one validated manifest transaction.
begin;
alter table public.reviews add column if not exists publication_attempt_version text,add column if not exists publication_payload jsonb,add column if not exists published_at timestamptz;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('review-media-v2','review-media-v2',false,10485760,array['image/jpeg','image/png','image/webp','image/heic']) on conflict(id) do update set public=false;
create table public.review_publication_receipts_v2(review_id uuid not null references public.reviews(id) on delete cascade,attempt_version text not null,payload jsonb not null,receipt jsonb not null,created_at timestamptz not null default now(),primary key(review_id,attempt_version));
alter table public.review_publication_receipts_v2 enable row level security;
revoke all on public.review_publication_receipts_v2 from public,anon,authenticated;
grant all on public.review_publication_receipts_v2 to service_role;
-- Restrictive policies ensure pre-existing broad bucket policies cannot grant access.
create policy review_v2_bucket_insert_boundary on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'review-media-v2' or (split_part(name,'/',1)=auth.uid()::text and array_length(string_to_array(name,'/'),1)=4 and name !~ '(^|/)\.\.?(/|$)'));
create policy review_v2_bucket_insert on storage.objects for insert to authenticated with check(bucket_id='review-media-v2' and split_part(name,'/',1)=auth.uid()::text);
create policy review_v2_bucket_select_boundary on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'review-media-v2' or exists(select 1 from public.review_photos p join public.reviews r on r.id=p.review_id where p.storage_bucket='review-media-v2' and p.storage_path=name and public.can_read_author_content(r.user_id)));
create policy review_v2_bucket_select on storage.objects for select to anon,authenticated using(bucket_id='review-media-v2' and exists(select 1 from public.review_photos p join public.reviews r on r.id=p.review_id where p.storage_bucket='review-media-v2' and p.storage_path=name and public.can_read_author_content(r.user_id)));
create policy review_v2_bucket_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'review-media-v2') with check(bucket_id<>'review-media-v2');
create policy review_v2_bucket_delete_boundary on storage.objects as restrictive for delete to authenticated using(bucket_id<>'review-media-v2' or (split_part(name,'/',1)=auth.uid()::text and not exists(select 1 from public.review_photos p where p.storage_bucket='review-media-v2' and p.storage_path=name) and not exists(select 1 from public.review_publication_receipts_v2 rc where rc.payload->'photos' @> jsonb_build_array(jsonb_build_object('path',name)))));
-- Receipt check is security-definer: clients cannot read receipt payloads.
create or replace function app_private.review_media_referenced_v2(p_path text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.review_photos where storage_bucket='review-media-v2' and storage_path=p_path) or exists(select 1 from public.review_publication_receipts_v2 where payload->'photos' @> jsonb_build_array(jsonb_build_object('path',p_path))) $$;
revoke all on function app_private.review_media_referenced_v2(text) from public,anon;grant execute on function app_private.review_media_referenced_v2(text) to authenticated;
drop policy review_v2_bucket_delete_boundary on storage.objects;
create policy review_v2_bucket_delete_boundary on storage.objects as restrictive for delete to authenticated using(bucket_id<>'review-media-v2' or (split_part(name,'/',1)=auth.uid()::text and not app_private.review_media_referenced_v2(name)));
create policy review_v2_bucket_delete on storage.objects for delete to authenticated using(bucket_id='review-media-v2' and split_part(name,'/',1)=auth.uid()::text and not app_private.review_media_referenced_v2(name));
create or replace function public.publish_review_v2(p_review_id uuid,p_dish_id text,p_venue_id text,p_rating numeric,p_text text,p_tags text[],p_would_recommend boolean,p_attempt_version text,p_photos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing public.reviews%rowtype; canonical_venue text; payload jsonb; prior public.review_publication_receipts_v2%rowtype; result jsonb; photo jsonb; ordinal bigint; author text;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_review_id is null or p_attempt_version is null or p_attempt_version !~ '^[A-Za-z0-9_-]{8,100}$' or p_rating is null or p_rating<1 or p_rating>5 or p_rating<>round(p_rating,1) or length(coalesce(p_text,''))>10000 or p_would_recommend is null or p_photos is null or jsonb_typeof(p_photos)<>'array' or jsonb_array_length(p_photos)>10 then raise exception 'Invalid review publication' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('review:'||p_review_id::text,0));
 select * into existing from public.reviews where id=p_review_id for update;
 if existing.id is not null and existing.user_id<>actor then raise exception 'Not authorized' using errcode='42501'; end if;
 select venue_id into canonical_venue from public.dishes where id=p_dish_id;
 if canonical_venue is null or canonical_venue is distinct from p_venue_id or (existing.id is not null and (existing.dish_id<>p_dish_id or existing.venue_id is distinct from p_venue_id)) then raise exception 'Dish and venue mismatch' using errcode='22023'; end if;
 payload:=jsonb_build_object('dishId',p_dish_id,'venueId',p_venue_id,'rating',p_rating,'text',coalesce(p_text,''),'tags',coalesce(p_tags,'{}'::text[]),'wouldRecommend',p_would_recommend,'photos',p_photos);
 select * into prior from public.review_publication_receipts_v2 where review_id=p_review_id and attempt_version=p_attempt_version;
 if found then if prior.payload<>payload then raise exception 'Attempt identity cannot be reused with different content' using errcode='40001';end if;return prior.receipt;end if;
 for photo,ordinal in select value,ordinality from jsonb_array_elements(p_photos) with ordinality loop
  if photo->>'bucket' is distinct from 'review-media-v2' or photo->>'sortOrder' is distinct from (ordinal-1)::text or photo->>'path' is null or left(photo->>'path',length(actor::text||'/'||p_review_id::text||'/'||p_attempt_version||'/'))<>actor::text||'/'||p_review_id::text||'/'||p_attempt_version||'/' or array_length(string_to_array(photo->>'path','/'),1)<>4 or photo->>'path' ~ '(^|/)\.\.?(/|$)' then raise exception 'Invalid media manifest' using errcode='22023';end if;
  perform 1 from storage.objects o where o.bucket_id='review-media-v2' and o.name=photo->>'path' and (o.metadata->>'size')::bigint between 1 and 10485760 and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp','image/heic') for key share;
  if not found then raise exception 'Media upload missing or invalid' using errcode='22023';end if;
 end loop;
 if (select count(distinct x->>'path') from jsonb_array_elements(p_photos) x)<>jsonb_array_length(p_photos) then raise exception 'Duplicate media' using errcode='22023';end if;
 select display_name into author from public.user_profiles where id=actor;
 insert into public.reviews(id,user_id,dish_id,venue_id,author_name,rating,text,tags,would_recommend,publication_attempt_version,publication_payload,published_at)
 values(p_review_id,actor,p_dish_id,p_venue_id,coalesce(author,'Hungry member'),p_rating,coalesce(p_text,''),coalesce(p_tags,'{}'),p_would_recommend,p_attempt_version,payload,now())
 on conflict(id) do update set rating=excluded.rating,text=excluded.text,tags=excluded.tags,would_recommend=excluded.would_recommend,publication_attempt_version=excluded.publication_attempt_version,publication_payload=excluded.publication_payload,published_at=excluded.published_at;
 -- Only manifest rows change. Previous immutable objects and receipts stay intact.
 delete from public.review_photos where review_id=p_review_id;
 insert into public.review_photos(review_id,url,sort_order,storage_bucket,storage_path) select p_review_id,'supabase://review-media-v2/'||(x->>'path'),(x->>'sortOrder')::integer,'review-media-v2',x->>'path' from jsonb_array_elements(p_photos) x;
 result:=jsonb_build_object('reviewId',p_review_id,'publishedAt',now(),'attemptVersion',p_attempt_version,'photoCount',jsonb_array_length(p_photos));
 insert into public.review_publication_receipts_v2(review_id,attempt_version,payload,receipt) values(p_review_id,p_attempt_version,payload,result);
 return result;
end $$;
revoke all on function public.publish_review_v2(uuid,text,text,numeric,text,text[],boolean,text,jsonb) from public,anon;
grant execute on function public.publish_review_v2(uuid,text,text,numeric,text,text[],boolean,text,jsonb) to authenticated;
create or replace function public.protect_review_manifest_v2() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('postgres','supabase_admin','service_role') then return new;end if;
 if tg_table_name='review_photos' then
  if new.storage_bucket='review-media-v2' or exists(select 1 from public.reviews where id=new.review_id and publication_attempt_version is not null) or (tg_op='UPDATE' and (old.storage_bucket='review-media-v2' or exists(select 1 from public.reviews where id=old.review_id and publication_attempt_version is not null))) then raise exception 'Use transactional publication' using errcode='42501';end if;
 else
  if tg_op='INSERT' then if new.publication_attempt_version is not null or new.publication_payload is not null or new.published_at is not null then raise exception 'Use transactional publication' using errcode='42501';end if;
  elsif (old.publication_attempt_version is not null and (to_jsonb(new)-array['merchant_reply_text','merchant_replied_at','updated_at']) is distinct from (to_jsonb(old)-array['merchant_reply_text','merchant_replied_at','updated_at'])) or new.publication_attempt_version is distinct from old.publication_attempt_version or new.publication_payload is distinct from old.publication_payload or new.published_at is distinct from old.published_at then raise exception 'Use transactional publication' using errcode='42501';end if;
 end if;
 return new;
end $$;
create trigger protect_review_manifest_v2 before insert or update on public.review_photos for each row execute function public.protect_review_manifest_v2();
create trigger protect_review_manifest_v2 before insert or update on public.reviews for each row execute function public.protect_review_manifest_v2();
-- Serialize client cleanup with publication by canonical review identity.
create or replace function app_private.guard_review_object_delete_v2() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.bucket_id='review-media-v2' then
  perform pg_advisory_xact_lock(hashtextextended('review:'||split_part(old.name,'/',2),0));
  if app_private.review_media_referenced_v2(old.name) then raise exception 'Published review media cannot be removed' using errcode='42501';end if;
 end if;
 return old;
end $$;
create trigger guard_review_object_delete_v2 before delete on storage.objects for each row execute function app_private.guard_review_object_delete_v2();
create policy review_v2_anon_no_insert on storage.objects as restrictive for insert to anon with check(bucket_id<>'review-media-v2');
create policy review_v2_anon_no_delete on storage.objects as restrictive for delete to anon using(bucket_id<>'review-media-v2');
create or replace function public.guard_review_photo_delete_v2() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('postgres','supabase_admin','service_role') and exists(select 1 from public.reviews where id=old.review_id and (old.storage_bucket='review-media-v2' or publication_attempt_version is not null)) then raise exception 'Use transactional publication' using errcode='42501';end if;
 return old;
end $$;
create trigger guard_review_photo_delete_v2 before delete on public.review_photos for each row execute function public.guard_review_photo_delete_v2();

create or replace function public.list_review_attempt_media_v2(p_review_id uuid,p_attempt_version text)
returns table(path text,metadata jsonb) language plpgsql stable security definer set search_path='' as $$
declare prefix text;
begin
 if auth.uid() is null or p_review_id is null or p_attempt_version is null or p_attempt_version !~ '^[A-Za-z0-9_-]{8,100}$' then raise exception 'Invalid attempt' using errcode='22023';end if;
 if exists(select 1 from public.reviews where id=p_review_id and user_id<>auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 prefix:=auth.uid()::text||'/'||p_review_id::text||'/'||p_attempt_version||'/';
 return query select o.name,o.metadata from storage.objects o where o.bucket_id='review-media-v2' and left(o.name,length(prefix))=prefix order by o.name;
end $$;
revoke all on function public.list_review_attempt_media_v2(uuid,text) from public,anon;
grant execute on function public.list_review_attempt_media_v2(uuid,text) to authenticated;
create or replace function public.list_recent_reviews_v2(p_limit integer default 20,p_query text default null,p_sort text default 'recent',p_cursor_created_at timestamptz default null,p_cursor_id uuid default null,p_cursor_rating numeric default null,p_venue_id text default null,p_before timestamptz default null)
returns setof public.reviews language plpgsql stable security invoker set search_path='' as $$
begin
 if p_sort is null or p_sort not in ('recent','top_rated','rating') then raise exception 'Invalid review sort' using errcode='22023';end if;
 if (p_cursor_created_at is null)<>(p_cursor_id is null) then raise exception 'Composite cursor required' using errcode='22023';end if;
 if (p_cursor_rating is not null and (p_cursor_created_at is null or p_cursor_rating not between 0 and 5)) or (p_sort in ('top_rated','rating') and p_cursor_created_at is not null and p_cursor_rating is null) then raise exception 'Rating cursor required' using errcode='22023';end if;
 return query select r.* from public.reviews r join public.dishes d on d.id=r.dish_id join public.venues v on v.id=r.venue_id
 where public.can_read_author_content(r.user_id) and (p_venue_id is null or r.venue_id=p_venue_id) and (p_before is null or r.created_at<p_before)
 and (nullif(trim(p_query),'') is null or strpos(lower(concat_ws(' ',r.text,array_to_string(r.tags,' '),d.name,v.name)),lower(trim(p_query)))>0)
 and (p_cursor_created_at is null or (p_sort='recent' and (r.created_at,r.id)<(p_cursor_created_at,p_cursor_id)) or (p_sort in ('top_rated','rating') and (r.rating,r.created_at,r.id)<(p_cursor_rating,p_cursor_created_at,p_cursor_id)))
 order by case when p_sort in ('top_rated','rating') then r.rating end desc,r.created_at desc,r.id desc limit least(greatest(coalesce(p_limit,20),1),100);
end $$;
revoke all on function public.list_recent_reviews_v2(integer,text,text,timestamptz,uuid,numeric,text,timestamptz) from public;
grant execute on function public.list_recent_reviews_v2(integer,text,text,timestamptz,uuid,numeric,text,timestamptz) to anon,authenticated;

commit;
