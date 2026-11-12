-- Smoke checks for 20261112090000_audit_batch_fixes.sql.
-- Checklist reorder refuses a repeated id and sets every position in one go; a review inserted
-- by its author starts unedited; a collaborator change with a stale version is refused; the
-- public block check is not callable by a signed-in user; a stall submission cannot point at
-- another user's photo; a taste event keeps the server time. Brings its own rows, so it runs
-- on prod (no seed data) as well as staging. Runs in a transaction and rolls back.
--   users: 00000000-0000-0112-b000-000000000001 (owner), ...0002 (friend)

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-0112-b000-000000000001', 'audit-batch-smoke-1@example.test'),
  ('00000000-0000-0112-b000-000000000002', 'audit-batch-smoke-2@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0112-b000-000000000001', 'Audit Batch Owner'),
  ('00000000-0000-0112-b000-000000000002', 'Audit Batch Friend')
on conflict (id) do nothing;

insert into checklists (id, user_id, name)
values ('00000000-0000-0112-c000-000000000001', '00000000-0000-0112-b000-000000000001', 'Smoke list');

insert into checklist_items (id, checklist_id, item_type, custom_text, position)
values
  ('00000000-0000-0112-c100-000000000001', '00000000-0000-0112-c000-000000000001', 'custom', 'one', 0),
  ('00000000-0000-0112-c100-000000000002', '00000000-0000-0112-c000-000000000001', 'custom', 'two', 1),
  ('00000000-0000-0112-c100-000000000003', '00000000-0000-0112-c000-000000000001', 'custom', 'three', 2);

insert into portfolios (id, owner_id, name, type, visibility)
values (
  '00000000-0000-0112-f000-000000000001', '00000000-0000-0112-b000-000000000001',
  'Audit batch smoke list', 'collection', 'private'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0112-b000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0112-b000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  -- A repeated id is refused, even with the right count.
  begin
    perform public.reorder_checklist_items(
      '00000000-0000-0112-c000-000000000001',
      array[
        '00000000-0000-0112-c100-000000000001',
        '00000000-0000-0112-c100-000000000001',
        '00000000-0000-0112-c100-000000000002'
      ]::uuid[]
    );
    raise exception 'a reorder that lists an item twice should be refused';
  exception when others then
    if sqlerrm not like '%exactly once%' then
      raise;
    end if;
  end;

  perform public.reorder_checklist_items(
    '00000000-0000-0112-c000-000000000001',
    array[
      '00000000-0000-0112-c100-000000000003',
      '00000000-0000-0112-c100-000000000001',
      '00000000-0000-0112-c100-000000000002'
    ]::uuid[]
  );
  if (
    select string_agg(custom_text, ',' order by position)
    from checklist_items
    where checklist_id = '00000000-0000-0112-c000-000000000001'
  ) is distinct from 'three,one,two' then
    raise exception 'reorder should set the positions in the order given';
  end if;

  -- A stale version is refused for a collaborator change.
  begin
    perform public.change_portfolio_collaborator(
      '00000000-0000-0112-f000-000000000001',
      '00000000-0000-0112-b000-000000000002',
      'remove',
      null,
      '2000-01-01T00:00:00Z'::timestamptz
    );
    raise exception 'a collaborator change against an old version should be refused';
  exception when others then
    if sqlerrm like '%should be refused%' then
      raise;
    end if;
  end;
  -- With the current version (or none), removing a non-collaborator is a no-op.
  perform public.change_portfolio_collaborator(
    '00000000-0000-0112-f000-000000000001',
    '00000000-0000-0112-b000-000000000002',
    'remove'
  );

  -- The public block check is not callable by a signed-in user.
  begin
    perform public.app_user_block_exists(
      '00000000-0000-0112-b000-000000000002', '00000000-0000-0112-b000-000000000001'
    );
    raise exception 'a signed-in user should not call app_user_block_exists directly';
  exception when insufficient_privilege then
    null;
  end;

  -- A stall submission cannot point at another user's photo.
  begin
    insert into user_stall_submissions (
      user_id, stall_name, image_url, image_storage_bucket, image_storage_path
    )
    values (
      '00000000-0000-0112-b000-000000000001', 'Borrowed Photo Stall', 'https://example.test/a.jpg',
      'user-stall-submission-images', '00000000-0000-0112-b000-000000000002/cover.jpg'
    );
    raise exception 'a stall photo under another user should be refused';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into user_stall_submissions (user_id, stall_name, image_url, gallery_images)
    values (
      '00000000-0000-0112-b000-000000000001', 'Borrowed Bucket Stall', 'https://example.test/a.jpg',
      jsonb_build_array(jsonb_build_object(
        'bucket', 'post-media', 'path', '00000000-0000-0112-b000-000000000001/x.jpg'
      ))
    );
    raise exception 'a gallery photo in another bucket should be refused';
  exception when insufficient_privilege then
    null;
  end;
  -- The submitter's own photo is fine.
  insert into user_stall_submissions (
    user_id, stall_name, image_url, image_storage_bucket, image_storage_path
  )
  values (
    '00000000-0000-0112-b000-000000000001', 'Own Photo Stall', 'https://example.test/a.jpg',
    'user-stall-submission-images', '00000000-0000-0112-b000-000000000001/cover.jpg'
  );
end $$;

reset role;

-- Function bodies carry the patches.
do $$
begin
  if position('taste:server-time' in (
    select prosrc from pg_proc
    where oid = 'app_private.record_taste_interaction_event(text,text,double precision[],double precision[],text,text,text,text,numeric,boolean,numeric,text,timestamp with time zone,jsonb)'::regprocedure
  )) = 0 then
    raise exception 'record_taste_interaction_event should use the server time';
  end if;
  if position('low-rating-per-account' in (
    select prosrc from pg_proc where oid = 'app_private.enqueue_merchant_low_rating_alert()'::regprocedure
  )) = 0 then
    raise exception 'low-rating alerts should dedupe per merchant account';
  end if;
  if position('claim:lock-order' in (
    select prosrc from pg_proc where oid = 'app_private.approve_merchant_claim(uuid)'::regprocedure
  )) = 0 then
    raise exception 'claim approval should take the stall lock first';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_reviews_set_edited_at_insert' and tgrelid = 'public.reviews'::regclass
  ) then
    raise exception 'reviews should reset edited_at on insert';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_keep_popular_visitor_pin_review'
      and tgrelid = 'public.merchant_popular_visitor_pins'::regclass
  ) then
    raise exception 'a pin should keep its review on update';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dishes_draft' and column_name = 'review_notes'
  ) then
    raise exception 'dishes_draft.review_notes should exist';
  end if;
end $$;

select 'audit_batch_fixes_smoke_passed' as result;

rollback;
