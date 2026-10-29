-- Smoke checks for 20261029090000_account_deletion_keeps_accepted_submissions.sql.
-- An accepted submission with a cover and two gallery photos survives account deletion with
-- user_id and notes cleared, all three paths come back as retained storage objects, and a
-- pending submission is deleted with the profile. Rolls back.

begin;

insert into user_profiles (id, display_name)
values ('00000000-0000-0061-b000-000000000001', 'Keep Submission Smoke')
on conflict (id) do nothing;

insert into public.user_stall_submissions (
  id, user_id, stall_name, image_url, image_storage_bucket, image_storage_path,
  gallery_images, notes, status
)
values
  (
    '00000000-0000-0061-c000-000000000001',
    '00000000-0000-0061-b000-000000000001',
    'Accepted Smoke Stall', 'https://example.test/cover.jpg',
    'user-stall-submission-images',
    '00000000-0000-0061-b000-000000000001/cover.jpg',
    jsonb_build_array(
      jsonb_build_object('bucket', 'user-stall-submission-images',
        'path', '00000000-0000-0061-b000-000000000001/gallery-1.jpg'),
      jsonb_build_object('storageBucket', 'user-stall-submission-images',
        'storagePath', '00000000-0000-0061-b000-000000000001/gallery-2.jpg')
    ),
    'private note', 'accepted'
  ),
  (
    '00000000-0000-0061-c000-000000000002',
    '00000000-0000-0061-b000-000000000001',
    'Pending Smoke Stall', 'https://example.test/pending.jpg',
    null, null, '[]'::jsonb, null, 'pending'
  );

insert into account_deletion_requests (id, user_id, status)
values ('00000000-0000-0061-a000-000000000001', '00000000-0000-0061-b000-000000000001', 'processing');

select public.anonymize_account_deletion_request('00000000-0000-0061-a000-000000000001', null);

do $$
declare
  v_purge jsonb;
begin
  if exists (select 1 from user_profiles where id = '00000000-0000-0061-b000-000000000001') then
    raise exception 'the profile must be gone after anonymize';
  end if;
  if not exists (
    select 1 from public.user_stall_submissions
    where id = '00000000-0000-0061-c000-000000000001'
      and user_id is null
      and notes is null
      and status = 'accepted'
  ) then
    raise exception 'the accepted submission must survive with user_id and notes cleared';
  end if;
  if exists (
    select 1 from public.user_stall_submissions where id = '00000000-0000-0061-c000-000000000002'
  ) then
    raise exception 'the pending submission must be deleted with the profile';
  end if;

  v_purge := public.purge_account_deletion_residual_data('00000000-0000-0061-a000-000000000001', null);
  if jsonb_array_length(v_purge -> 'retained_storage_objects') <> 3 then
    raise exception 'expected 3 retained storage objects, got %', v_purge -> 'retained_storage_objects';
  end if;
  if not (v_purge -> 'retained_storage_objects') @> jsonb_build_array(
    jsonb_build_object('bucket', 'user-stall-submission-images',
      'path', '00000000-0000-0061-b000-000000000001/gallery-2.jpg')
  ) then
    raise exception 'the storageBucket/storagePath gallery shape must be retained too';
  end if;
  if has_function_privilege('authenticated', 'public.purge_account_deletion_residual_data(uuid, uuid)', 'execute') then
    raise exception 'authenticated must not execute the purge RPC';
  end if;
end $$;

select 'account_deletion_keeps_accepted_submissions smoke passed' as result;

rollback;
