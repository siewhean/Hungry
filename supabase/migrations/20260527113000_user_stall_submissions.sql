-- User-submitted stall discovery queue.
-- Stores user-owned leads for stalls found online without mutating canonical venues.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-stall-submission-images',
  'user-stall-submission-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.user_stall_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  stall_name text not null check (length(trim(stall_name)) > 0),
  image_url text not null check (length(trim(image_url)) > 0),
  image_storage_bucket text,
  image_storage_path text,
  image_mime_type text,
  source_url text,
  building_name text,
  area text,
  address text,
  unit_number text,
  floor text,
  operating_hours text,
  menu_items jsonb not null default '[]'::jsonb check (jsonb_typeof(menu_items) = 'array'),
  delivery_links jsonb not null default '[]'::jsonb check (jsonb_typeof(delivery_links) = 'array'),
  notes text,
  status text not null default 'pending' check (
    status in ('pending', 'under_review', 'accepted', 'rejected', 'duplicate')
  ),
  ops_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (image_storage_bucket is null and image_storage_path is null)
    or (length(trim(coalesce(image_storage_bucket, ''))) > 0 and length(trim(coalesce(image_storage_path, ''))) > 0)
  )
);

create index if not exists idx_user_stall_submissions_user_created
  on public.user_stall_submissions(user_id, created_at desc, id desc);
create index if not exists idx_user_stall_submissions_status_created
  on public.user_stall_submissions(status, created_at desc, id desc);
create index if not exists idx_user_stall_submissions_name_trgm
  on public.user_stall_submissions using gin (stall_name gin_trgm_ops);

drop trigger if exists trg_user_stall_submissions_updated_at on public.user_stall_submissions;
create trigger trg_user_stall_submissions_updated_at
  before update on public.user_stall_submissions
  for each row execute function public.set_updated_at();

alter table public.user_stall_submissions enable row level security;

drop policy if exists "user_stall_submissions_select_own" on public.user_stall_submissions;
create policy "user_stall_submissions_select_own"
on public.user_stall_submissions for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_stall_submissions_service_role_all" on public.user_stall_submissions;
create policy "user_stall_submissions_service_role_all"
on public.user_stall_submissions for all to service_role
using (true)
with check (true);

revoke all on table public.user_stall_submissions from anon, authenticated;
grant select on table public.user_stall_submissions to authenticated;
grant all on table public.user_stall_submissions to service_role;

drop policy if exists "user_stall_submission_images_insert_own_prefix" on storage.objects;
create policy "user_stall_submission_images_insert_own_prefix"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'user-stall-submission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "user_stall_submission_images_select_own_prefix" on storage.objects;
create policy "user_stall_submission_images_select_own_prefix"
on storage.objects for select to authenticated
using (
  bucket_id = 'user-stall-submission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "user_stall_submission_images_update_own_prefix" on storage.objects;
create policy "user_stall_submission_images_update_own_prefix"
on storage.objects for update to authenticated
using (
  bucket_id = 'user-stall-submission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'user-stall-submission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "user_stall_submission_images_delete_own_prefix" on storage.objects;
create policy "user_stall_submission_images_delete_own_prefix"
on storage.objects for delete to authenticated
using (
  bucket_id = 'user-stall-submission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "user_stall_submission_images_service_select" on storage.objects;
create policy "user_stall_submission_images_service_select"
on storage.objects for select to service_role
using (bucket_id = 'user-stall-submission-images');

create or replace function public.submit_user_stall_submission(
  p_stall_name text,
  p_image_url text,
  p_image_storage_bucket text default null,
  p_image_storage_path text default null,
  p_image_mime_type text default null,
  p_source_url text default null,
  p_building_name text default null,
  p_area text default null,
  p_address text default null,
  p_unit_number text default null,
  p_floor text default null,
  p_operating_hours text default null,
  p_menu_items jsonb default '[]'::jsonb,
  p_delivery_links jsonb default '[]'::jsonb,
  p_notes text default null
)
returns public.user_stall_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_submission public.user_stall_submissions;
  v_menu_items jsonb := coalesce(p_menu_items, '[]'::jsonb);
  v_delivery_links jsonb := coalesce(p_delivery_links, '[]'::jsonb);
begin
  if current_user_id is null then
    raise exception 'Authentication required to submit a stall.' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_stall_name, ''))) = 0 then
    raise exception 'Stall name is required.' using errcode = '23514';
  end if;

  if length(trim(coalesce(p_image_url, ''))) = 0 then
    raise exception 'Stall image is required.' using errcode = '23514';
  end if;

  if jsonb_typeof(v_menu_items) <> 'array' then
    raise exception 'Menu items must be an array.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_delivery_links) <> 'array' then
    raise exception 'Delivery links must be an array.' using errcode = '22023';
  end if;

  insert into public.user_stall_submissions (
    user_id,
    stall_name,
    image_url,
    image_storage_bucket,
    image_storage_path,
    image_mime_type,
    source_url,
    building_name,
    area,
    address,
    unit_number,
    floor,
    operating_hours,
    menu_items,
    delivery_links,
    notes
  )
  values (
    current_user_id,
    trim(p_stall_name),
    trim(p_image_url),
    nullif(trim(coalesce(p_image_storage_bucket, '')), ''),
    nullif(trim(coalesce(p_image_storage_path, '')), ''),
    nullif(trim(coalesce(p_image_mime_type, '')), ''),
    nullif(trim(coalesce(p_source_url, '')), ''),
    nullif(trim(coalesce(p_building_name, '')), ''),
    nullif(trim(coalesce(p_area, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_unit_number, '')), ''),
    nullif(trim(coalesce(p_floor, '')), ''),
    nullif(trim(coalesce(p_operating_hours, '')), ''),
    v_menu_items,
    v_delivery_links,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into v_submission;

  return v_submission;
end;
$$;

revoke execute on function public.submit_user_stall_submission(
  text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.submit_user_stall_submission(
  text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, text
) to authenticated, service_role;

alter table public.food_cred_events drop constraint if exists food_cred_events_source_action_check;
alter table public.food_cred_events
  add constraint food_cred_events_source_action_check check (source_action in (
    'review_created',
    'photo_uploaded',
    'stall_saved',
    'stall_marked_tried',
    'stall_submitted',
    'helpful_vote_received',
    'stall_info_corrected',
    'tag_added',
    'collection_created',
    'post_created',
    'mission_completed'
  ));

create or replace function public.food_cred_default_points(p_source_action text)
returns integer
language sql
immutable
as $$
  select case p_source_action
    when 'stall_saved' then 2
    when 'stall_marked_tried' then 5
    when 'stall_submitted' then 12
    when 'review_created' then 15
    when 'photo_uploaded' then 5
    when 'post_created' then 10
    when 'helpful_vote_received' then 3
    when 'stall_info_corrected' then 10
    when 'tag_added' then 3
    when 'collection_created' then 10
    else 0
  end;
$$;

create or replace function public.food_cred_daily_cap(p_source_action text)
returns integer
language sql
immutable
as $$
  select case p_source_action
    when 'stall_saved' then 10
    when 'stall_marked_tried' then 5
    when 'stall_submitted' then 5
    when 'review_created' then 5
    when 'photo_uploaded' then 10
    when 'post_created' then 3
    when 'helpful_vote_received' then 99
    when 'stall_info_corrected' then 3
    when 'tag_added' then 5
    when 'collection_created' then 2
    when 'mission_completed' then 4
    else 0
  end;
$$;

alter table public.weekly_missions drop constraint if exists weekly_missions_mission_type_check;
alter table public.weekly_missions
  add constraint weekly_missions_mission_type_check check (mission_type in (
    'save_stalls',
    'add_stall',
    'create_post',
    'write_review',
    'mark_tried',
    'add_to_collection',
    'helpful_vote'
  ));

insert into public.weekly_missions (
  id,
  title,
  description,
  mission_type,
  requirement_count,
  reward_type,
  reward_value,
  week_start,
  week_end,
  is_active
)
values (
  'mission-add-new-stall',
  'Add a stall find',
  'Submit a stall you found online with a photo and useful details.',
  'add_stall',
  1,
  'food_cred',
  20,
  date_trunc('week', current_date)::date,
  (date_trunc('week', current_date)::date + 6),
  true
)
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  mission_type = excluded.mission_type,
  requirement_count = excluded.requirement_count,
  reward_type = excluded.reward_type,
  reward_value = excluded.reward_value,
  week_start = excluded.week_start,
  week_end = excluded.week_end,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.passport_progress_events drop constraint if exists passport_progress_events_event_type_check;
alter table public.passport_progress_events
  add constraint passport_progress_events_event_type_check check (event_type in (
    'dish_tried',
    'stall_visited',
    'stall_submitted',
    'review_posted',
    'photo_posted',
    'portfolio_item_added',
    'public_portfolio_published',
    'trail_completed'
  ));

alter table public.passport_stamps
  add column if not exists stalls_submitted_count integer not null default 0;

alter table public.passport_stamps drop constraint if exists passport_stamps_stalls_submitted_count_check;
alter table public.passport_stamps
  add constraint passport_stamps_stalls_submitted_count_check check (stalls_submitted_count >= 0);

create or replace function public.record_passport_progress(
  p_category_id text,
  p_event_type text,
  p_reference_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.passport_stamps (user_id, category_id)
  values (auth.uid(), p_category_id)
  on conflict (user_id, category_id) do nothing;

  insert into public.passport_progress_events (user_id, category_id, event_type, reference_id)
  values (auth.uid(), p_category_id, p_event_type, p_reference_id);

  if p_event_type = 'stall_submitted' then
    update public.passport_stamps
    set stalls_submitted_count = stalls_submitted_count + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  elsif p_event_type = 'portfolio_item_added' then
    update public.passport_stamps
    set portfolio_items_added = portfolio_items_added + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  elsif p_event_type = 'public_portfolio_published' then
    update public.passport_stamps
    set public_portfolios_published = public_portfolios_published + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  elsif p_event_type = 'trail_completed' then
    update public.passport_stamps
    set trails_completed = trails_completed + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  end if;
end;
$$;

grant execute on function public.record_passport_progress(text, text, text)
to authenticated, service_role;

comment on table public.user_stall_submissions is
  'User-submitted stall leads found online. Reviewed by ops before any canonical venue/menu mutation.';
comment on function public.submit_user_stall_submission(
  text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, text
) is
  'RPC-only user stall discovery submission path. Requires auth, stall name, and image.';
