-- Atomic, service-only OCR draft persistence. Existing evidence is not rewritten.
-- The submission/job lock fences retries; the venue lock serializes matching even
-- when concurrent submissions have not yet created a matching draft row.
create or replace function public.app_complete_menu_photo_ingestion(
  p_submission_id uuid,
  p_ocr_job_id text,
  p_items jsonb,
  p_ocr_text text
) returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_submission public.menu_photo_submissions%rowtype;
  v_item jsonb;
  v_name text;
  v_normalized text;
  v_price integer;
  v_modifiers jsonb;
  v_confidence numeric;
  v_draft_id uuid;
  v_count integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'ocr_items_must_be_array';
  end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'ocr_too_many_items'; end if;
  select * into v_submission from public.menu_photo_submissions
    where id = p_submission_id for update;
  if not found then raise exception 'ocr_submission_not_found'; end if;
  if p_ocr_job_id is null or v_submission.ocr_job_id is distinct from p_ocr_job_id then
    raise exception 'ocr_job_not_current';
  end if;
  if v_submission.ocr_status in ('succeeded', 'skipped') then
    return coalesce((v_submission.vision_response ->> 'extractedCount')::integer, 0);
  end if;
  if v_submission.ocr_status <> 'processing' then raise exception 'ocr_job_not_processing'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ocr-venue:' || v_submission.venue_id, 0));

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'name') <> 'string' then
      raise exception 'ocr_invalid_item';
    end if;
    v_name := btrim(v_item ->> 'name');
    v_normalized := lower(regexp_replace(v_name, '\s+', ' ', 'g'));
    if v_normalized = '' then raise exception 'ocr_empty_name'; end if;
    v_price := (v_item ->> 'price_cents')::integer;
    if v_price < 0 then raise exception 'ocr_invalid_price'; end if;
    v_modifiers := coalesce(v_item -> 'modifiers', '[]'::jsonb);
    if jsonb_typeof(v_modifiers) <> 'array' or exists (
      select 1 from jsonb_array_elements(v_modifiers) as m where jsonb_typeof(m) <> 'string'
    ) then raise exception 'ocr_invalid_modifiers'; end if;
    v_confidence := greatest(0, least(1, coalesce((v_item ->> 'extraction_confidence')::numeric, 0)));

    -- Exact identity only: equal price cannot make Tea the same dish as Pie.
    -- Price variants and modifier variants remain separate, reviewable evidence.
    select id into v_draft_id from public.dishes_draft
      where venue_id = v_submission.venue_id
        and name_normalized = v_normalized
        and price_cents is not distinct from v_price
        and modifiers = v_modifiers
        and review_status in ('pending', 'accepted', 'edited')
      order by created_at, id limit 1 for update;
    if found then
      update public.dishes_draft
        set extraction_confidence = greatest(extraction_confidence, v_confidence),
            confidence_bumps = confidence_bumps + 1,
            updated_at = now()
        where id = v_draft_id;
    else
      insert into public.dishes_draft (
        venue_id, building_id, source_photo_id, name, name_normalized,
        price_cents, modifiers, ocr_raw_text, extraction_confidence, review_status
      ) values (
        v_submission.venue_id, v_submission.building_id, v_submission.id,
        v_name, v_normalized, v_price, v_modifiers, p_ocr_text, v_confidence, 'pending'
      );
    end if;
    v_count := v_count + 1;
  end loop;
  update public.menu_photo_submissions
    set ocr_status = case when v_count > 0 then 'succeeded' else 'skipped' end,
        processed_at = now(),
        vision_response = jsonb_build_object('textPreview', left(p_ocr_text, 1200), 'extractedCount', v_count),
        ocr_error = null
    where id = v_submission.id;
  return v_count;
end;
$function$;
revoke all on function public.app_complete_menu_photo_ingestion(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.app_complete_menu_photo_ingestion(uuid, text, jsonb, text) to service_role;
comment on function public.app_complete_menu_photo_ingestion(uuid, text, jsonb, text) is
  'Service-only atomic OCR draft persistence; exact name/price/modifier identity, serialized confidence and idempotent completion by job.';
