-- Smoke checks for 20261021163000_review_text_filter.sql (H36).
-- App users cannot post or edit a review with a blocked term or more than one
-- link / phone number; normal text and a single link pass. Rolled back.

begin;

-- Fixed ids for this smoke only.
--   author: 00000000-0000-0d36-b000-000000000001
insert into user_profiles (id, display_name)
values ('00000000-0000-0d36-b000-000000000001', 'Text Filter Smoke')
on conflict (id) do nothing;

select set_config('smoke.dish_id', (select d.id from dishes d order by d.id limit 1), true);

do $$
begin
  if nullif(current_setting('smoke.dish_id', true), '') is null then
    raise exception 'Smoke needs at least one dish row';
  end if;
  if app_private.review_text_violation('Lovely broth, will come back') is not null then
    raise exception 'Normal text should pass';
  end if;
  if app_private.review_text_violation('What the FUCK is this') is distinct from 'blocked_term' then
    raise exception 'A blocked term should be caught case-insensitively';
  end if;
  -- Whole words only: "Scunthorpe" and "classic" are fine.
  if app_private.review_text_violation('Scunthorpe classic dish') is not null then
    raise exception 'Blocked terms must match whole words only';
  end if;
  if app_private.review_text_violation('Menu at https://example.com') is not null then
    raise exception 'One link should pass';
  end if;
  if app_private.review_text_violation('Order www.spam.biz or call 9123 4567') is distinct from 'too_many_links' then
    raise exception 'A link plus a phone number should be refused';
  end if;
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0d36-b000-000000000001', true);
set local role authenticated;

-- The term list is not readable by app users.
do $$
begin
  begin
    perform 1 from app_private.review_blocked_terms limit 1;
    raise exception 'review_blocked_terms should not be readable by authenticated';
  exception
    when insufficient_privilege then null;
  end;
end $$;

insert into reviews (id, user_id, dish_id, rating, text)
values (
  '00000000-0000-0d36-e000-000000000001',
  '00000000-0000-0d36-b000-000000000001',
  current_setting('smoke.dish_id'),
  4,
  'Great char kway teow, menu at https://example.com'
);

do $$
begin
  begin
    insert into reviews (id, user_id, dish_id, rating, text)
    values (
      '00000000-0000-0d36-e000-000000000002',
      '00000000-0000-0d36-b000-000000000001',
      current_setting('smoke.dish_id'),
      1,
      'Owner is a bastard'
    );
    raise exception 'A blocked term should be refused on insert';
  exception
    when check_violation then null;
  end;

  begin
    insert into reviews (id, user_id, dish_id, rating, text)
    values (
      '00000000-0000-0d36-e000-000000000003',
      '00000000-0000-0d36-b000-000000000001',
      current_setting('smoke.dish_id'),
      5,
      'Cheap deals at https://a.example.com and https://b.example.com'
    );
    raise exception 'Two links should be refused';
  exception
    when check_violation then null;
  end;

  begin
    update reviews set text = 'Edited: kanina lah'
    where id = '00000000-0000-0d36-e000-000000000001';
    raise exception 'A blocked term should be refused on edit';
  exception
    when check_violation then null;
  end;
end $$;

reset role;

do $$
begin
  if (select text from reviews where id = '00000000-0000-0d36-e000-000000000001')
    <> 'Great char kway teow, menu at https://example.com' then
    raise exception 'The refused edit must leave the review unchanged';
  end if;
end $$;

select 'review_text_filter_smoke_passed' as result;

rollback;
