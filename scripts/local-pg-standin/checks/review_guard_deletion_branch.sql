-- Check for enforce_merchant_review_reply_update (latest body in
-- 20261021180100_merchant_review_reply_requires_verification.sql):
--   * a postgres-owned SECURITY DEFINER function may null a review's user_id
--     (account deletion), both the real worker path called as service_role
--     and an ad hoc definer function called by an authenticated user;
--   * an authenticated non-author still cannot update the review, nor null
--     its user_id; the author cannot null their own user_id directly.
-- Rolls back.

begin;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0c18-b000-000000000001', 'Guard Author'),
  ('00000000-0000-0c18-b000-000000000002', 'Guard Stranger'),
  ('00000000-0000-0c18-b000-000000000003', 'Guard Author Two')
on conflict (id) do nothing;

create temp table smoke_dish on commit drop as
select id, venue_id from dishes order by id limit 1;

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
select r.id, r.user_id, d.id, d.venue_id, 'Guard Author', 4, 'Guard review'
from smoke_dish d
cross join (values
  ('00000000-0000-0c18-e000-000000000001'::uuid, '00000000-0000-0c18-b000-000000000001'::uuid),
  ('00000000-0000-0c18-e000-000000000002'::uuid, '00000000-0000-0c18-b000-000000000003'::uuid)
) r(id, user_id);

-- Ad hoc postgres-owned definer that detaches review 2 from its author.
create function public.zz_check_detach_review(p_id uuid) returns void
language sql security definer set search_path = public
as $$ update public.reviews set user_id = null where id = p_id $$;
grant execute on function public.zz_check_detach_review(uuid) to authenticated;

-- 1. Stranger (authenticated, not author, not merchant) is blocked.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0c18-b000-000000000002', true);
set local role authenticated;

do $$
begin
  begin
    update public.reviews set text = 'hijacked' where id = '00000000-0000-0c18-e000-000000000001';
    if found then raise exception 'stranger updated another user''s review text'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    update public.reviews set user_id = null where id = '00000000-0000-0c18-e000-000000000001';
    if found then raise exception 'stranger nulled another user''s review user_id'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

-- 2. Author cannot null their own user_id through the API.
select set_config('request.jwt.claim.sub', '00000000-0000-0c18-b000-000000000001', true);
do $$
begin
  update public.reviews set user_id = null where id = '00000000-0000-0c18-e000-000000000001';
  raise exception 'author nulled own review user_id directly';
exception when insufficient_privilege then null;
end $$;

-- 3. Ad hoc postgres-owned SECURITY DEFINER called by an authenticated user.
select public.zz_check_detach_review('00000000-0000-0c18-e000-000000000002');

reset role;
do $$
begin
  if (select user_id from public.reviews where id = '00000000-0000-0c18-e000-000000000002') is not null then
    raise exception 'definer function did not null user_id';
  end if;
  if (select user_id from public.reviews where id = '00000000-0000-0c18-e000-000000000001') is null
     or (select text from public.reviews where id = '00000000-0000-0c18-e000-000000000001') <> 'Guard review' then
    raise exception 'review 1 changed by a blocked caller';
  end if;
end $$;

-- 4. The real account deletion worker path, called as service_role.
insert into account_deletion_requests (id, user_id, status)
values ('00000000-0000-0c18-a000-000000000001', '00000000-0000-0c18-b000-000000000001', 'processing');

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
select public.anonymize_account_deletion_request('00000000-0000-0c18-a000-000000000001', null);
reset role;

do $$
begin
  if not exists (
    select 1 from public.reviews
    where id = '00000000-0000-0c18-e000-000000000001' and user_id is null
  ) then
    raise exception 'anonymize_account_deletion_request did not detach the review';
  end if;
end $$;

rollback;
