-- Smoke checks for 20261022082000_user_stall_submission_limits.sql.
-- Direct inserts (and so the RPC, which inserts as the caller) hit the size caps and the
-- 10-a-day limit.
-- Runs in a transaction and rolls back.

begin;

-- Fixed id for this smoke only.
--   submitter: 00000000-0000-0082-b000-000000000001
insert into user_profiles (id, display_name)
values ('00000000-0000-0082-b000-000000000001', 'Submission Smoke')
on conflict (id) do nothing;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0082-b000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0082-b000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  i integer;
begin
  -- A name over 120 characters is refused on a direct insert.
  begin
    insert into user_stall_submissions (user_id, stall_name, image_url)
    values ('00000000-0000-0082-b000-000000000001', repeat('n', 121), 'https://example.test/a.jpg');
    raise exception 'A 121-character stall name should be refused';
  exception
    when check_violation then null;
  end;

  -- More than 50 menu items is refused.
  begin
    insert into user_stall_submissions (user_id, stall_name, image_url, menu_items)
    values (
      '00000000-0000-0082-b000-000000000001',
      'Too Many Items',
      'https://example.test/a.jpg',
      (select jsonb_agg(jsonb_build_object('name', 'item ' || g)) from generate_series(1, 51) g)
    );
    raise exception '51 menu items should be refused';
  exception
    when check_violation then null;
  end;

  -- Ten submissions in a day are fine; the eleventh is refused.
  for i in 1..10 loop
    insert into user_stall_submissions (user_id, stall_name, image_url)
    values (
      '00000000-0000-0082-b000-000000000001',
      'Daily Limit Stall ' || i,
      'https://example.test/a.jpg'
    );
  end loop;

  begin
    insert into user_stall_submissions (user_id, stall_name, image_url)
    values (
      '00000000-0000-0082-b000-000000000001',
      'Daily Limit Stall 11',
      'https://example.test/a.jpg'
    );
    raise exception 'The eleventh submission in a day should be refused';
  exception
    when program_limit_exceeded then null;
  end;
end $$;

reset role;
rollback;
