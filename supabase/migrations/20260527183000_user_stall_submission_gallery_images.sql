-- Support multiple user-submitted stall photos while preserving the first image as the cover.

begin;

alter table public.user_stall_submissions
  add column if not exists gallery_images jsonb not null default '[]'::jsonb
  check (jsonb_typeof(gallery_images) = 'array');

create or replace function public.submit_user_stall_submission(
  p_stall_name text,
  p_image_url text,
  p_image_storage_bucket text default null,
  p_image_storage_path text default null,
  p_image_mime_type text default null,
  p_gallery_images jsonb default '[]'::jsonb,
  p_source_url text default null,
  p_building_name text default null,
  p_area text default null,
  p_address text default null,
  p_postal_code text default null,
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
  v_gallery_images jsonb := coalesce(p_gallery_images, '[]'::jsonb);
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

  if jsonb_typeof(v_gallery_images) <> 'array' then
    raise exception 'Gallery images must be an array.' using errcode = '22023';
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
    gallery_images,
    source_url,
    building_name,
    area,
    address,
    postal_code,
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
    v_gallery_images,
    nullif(trim(coalesce(p_source_url, '')), ''),
    nullif(trim(coalesce(p_building_name, '')), ''),
    nullif(trim(coalesce(p_area, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_postal_code, '')), ''),
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
  text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.submit_user_stall_submission(
  text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, jsonb, jsonb, text
) to authenticated, service_role;

comment on column public.user_stall_submissions.gallery_images is
  'Ordered user-uploaded stall photo metadata. First item is treated as the cover image.';

commit;
