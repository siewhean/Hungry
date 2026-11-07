-- Smoke checks for 20261107180000_social_profiles_network_picks.sql.
-- 1. get_profile_relationship: "Follows you" and mutual followers; a private account's mutuals
--    stay hidden from a non-follower; a blocked pair gets no row.
-- 2. get_taste_matches: one call for many people; private and blocked people are left out.
-- 3. get_people_suggestions: follows of follows and taste twins; never self, followed, private
--    or blocked people.
-- 4. get_network_stall_picks: stalls the caller's follows reviewed 4+ or posted from; a 3-star
--    review and a moderated review do not count; with no follows, taste twins stand in.
-- 5. get_taste_comparison: both palates for a readable person; nothing for a private one.
-- 6. anon cannot run any of the five, and each has a rate rule.
-- Runs in a transaction and rolls back.
--   viewer   V 00000000-0000-1107-d000-000000000001
--   followed A ...02  (V follows A)
--   fof      B ...03  (A follows B; B follows V)
--   private  C ...04  (A follows C; private account)
--   twin     D ...05  (public, same palate as V, not followed)
--   blocked  E ...06  (V blocked E)

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-1107-d000-000000000001', 'social-smoke-1@example.test'),
  ('00000000-0000-1107-d000-000000000002', 'social-smoke-2@example.test'),
  ('00000000-0000-1107-d000-000000000003', 'social-smoke-3@example.test'),
  ('00000000-0000-1107-d000-000000000004', 'social-smoke-4@example.test'),
  ('00000000-0000-1107-d000-000000000005', 'social-smoke-5@example.test'),
  ('00000000-0000-1107-d000-000000000006', 'social-smoke-6@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-1107-d000-000000000001', 'Smoke Viewer'),
  ('00000000-0000-1107-d000-000000000002', 'Smoke Alice'),
  ('00000000-0000-1107-d000-000000000003', 'Smoke Bob'),
  ('00000000-0000-1107-d000-000000000004', 'Smoke Private'),
  ('00000000-0000-1107-d000-000000000005', 'Smoke Twin'),
  ('00000000-0000-1107-d000-000000000006', 'Smoke Blocked')
on conflict (id) do nothing;

insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-1107-d000-000000000004', 'private')
on conflict (user_id) do update set account_visibility = 'private';

insert into user_blocks (blocker_id, blocked_user_key)
values ('00000000-0000-1107-d000-000000000001', '00000000-0000-1107-d000-000000000006')
on conflict do nothing;

insert into follows (follower_id, followee_id, status, approved_at)
values
  ('00000000-0000-1107-d000-000000000001', '00000000-0000-1107-d000-000000000002', 'approved', now() - interval '3 days'),
  ('00000000-0000-1107-d000-000000000002', '00000000-0000-1107-d000-000000000003', 'approved', now() - interval '2 days'),
  ('00000000-0000-1107-d000-000000000002', '00000000-0000-1107-d000-000000000004', 'approved', now() - interval '2 days'),
  ('00000000-0000-1107-d000-000000000003', '00000000-0000-1107-d000-000000000001', 'approved', now() - interval '1 day')
on conflict (follower_id, followee_id) do update set status = excluded.status, approved_at = excluded.approved_at;

-- V, D and E love spice and richness; A is the opposite; B and C have a mild palate.
insert into user_taste_vectors (user_id, sweet, spicy, sour, salty, rich, aromatic)
values
  ('00000000-0000-1107-d000-000000000001', 4, 9, 5, 6, 8, 6),
  ('00000000-0000-1107-d000-000000000002', 8, 1, 5, 4, 2, 4),
  ('00000000-0000-1107-d000-000000000003', 5, 7, 5, 5, 7, 5),
  ('00000000-0000-1107-d000-000000000004', 4, 9, 5, 6, 8, 6),
  ('00000000-0000-1107-d000-000000000005', 4, 9, 5, 6, 8, 7),
  ('00000000-0000-1107-d000-000000000006', 4, 9, 5, 6, 8, 6)
on conflict (user_id) do update set
  sweet = excluded.sweet, spicy = excluded.spicy, sour = excluded.sour,
  salty = excluded.salty, rich = excluded.rich, aromatic = excluded.aromatic;

select set_config('smoke.dish_a', (select d.id from dishes d order by d.id limit 1), true);
select set_config('smoke.dish_b', (select d.id from dishes d where d.venue_id <> (select venue_id from dishes where id = current_setting('smoke.dish_a')) order by d.id limit 1), true);
select set_config('smoke.venue_a', (select venue_id from dishes where id = current_setting('smoke.dish_a')), true);
select set_config('smoke.venue_b', (select venue_id from dishes where id = current_setting('smoke.dish_b')), true);

-- A loved dish_a (5) and was lukewarm on dish_b (3). D (the twin) loved dish_b.
insert into reviews (id, user_id, dish_id, venue_id, rating, text, created_at)
values
  ('00000000-0000-1107-e000-000000000001', '00000000-0000-1107-d000-000000000002', current_setting('smoke.dish_a'), current_setting('smoke.venue_a'), 5, 'smoke love', now() - interval '2 days'),
  ('00000000-0000-1107-e000-000000000002', '00000000-0000-1107-d000-000000000002', current_setting('smoke.dish_b'), current_setting('smoke.venue_b'), 3, 'smoke meh', now() - interval '2 days'),
  ('00000000-0000-1107-e000-000000000003', '00000000-0000-1107-d000-000000000005', current_setting('smoke.dish_b'), current_setting('smoke.venue_b'), 5, 'smoke twin', now() - interval '1 day'),
  ('00000000-0000-1107-e000-000000000004', '00000000-0000-1107-d000-000000000002', current_setting('smoke.dish_b'), current_setting('smoke.venue_b'), 5, 'smoke hidden', now() - interval '1 day');

-- The second 5-star review of venue_b by A is hidden by moderation, so it never counts.
insert into review_moderation_states (review_id, state)
values ('00000000-0000-1107-e000-000000000004', 'hidden');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1107-d000-000000000001', true);
set local role authenticated;

-- 1. Relationship.
do $$
declare
  r record;
  v_rows integer;
begin
  select * into r from public.get_profile_relationship('00000000-0000-1107-d000-000000000003');
  if r.follows_you is distinct from true or r.mutual_count <> 1
     or r.mutual_names <> array['Smoke Alice'] then
    raise exception 'relationship with B was % / % / %, expected true / 1 / {Smoke Alice}',
      r.follows_you, r.mutual_count, r.mutual_names;
  end if;

  select * into r from public.get_profile_relationship('00000000-0000-1107-d000-000000000004');
  if r.follows_you is distinct from false or r.mutual_count <> 0 then
    raise exception 'a private account''s mutuals must stay hidden (got % / %)', r.follows_you, r.mutual_count;
  end if;

  select count(*) into v_rows from public.get_profile_relationship('00000000-0000-1107-d000-000000000006');
  if v_rows <> 0 then
    raise exception 'a blocked pair must get no relationship row';
  end if;

  select count(*) into v_rows from public.get_profile_relationship('00000000-0000-1107-d000-000000000001');
  if v_rows <> 0 then
    raise exception 'yourself must get no relationship row';
  end if;
end $$;

-- 2. Taste matches in one call.
do $$
declare
  v_ids uuid[];
  v_twin integer;
  v_alice integer;
begin
  select array_agg(user_id order by user_id) into v_ids
  from public.get_taste_matches(array[
    '00000000-0000-1107-d000-000000000001',
    '00000000-0000-1107-d000-000000000002',
    '00000000-0000-1107-d000-000000000004',
    '00000000-0000-1107-d000-000000000005',
    '00000000-0000-1107-d000-000000000006'
  ]::uuid[]);
  if v_ids <> array['00000000-0000-1107-d000-000000000002', '00000000-0000-1107-d000-000000000005']::uuid[] then
    raise exception 'taste matches covered %, expected Alice and the twin only', v_ids;
  end if;
  select score into v_twin from public.get_taste_matches(array['00000000-0000-1107-d000-000000000005']::uuid[]);
  select score into v_alice from public.get_taste_matches(array['00000000-0000-1107-d000-000000000002']::uuid[]);
  if v_twin < 90 or v_alice > 50 then
    raise exception 'twin scored %, Alice %; expected a high and a low match', v_twin, v_alice;
  end if;
end $$;

-- 3. Suggested people.
do $$
declare
  v_ids uuid[];
  v_reason_b text;
  v_reason_d text;
begin
  select array_agg(user_id), max(reason) filter (where user_id = '00000000-0000-1107-d000-000000000003'),
         max(reason) filter (where user_id = '00000000-0000-1107-d000-000000000005')
  into v_ids, v_reason_b, v_reason_d
  from public.get_people_suggestions(20)
  where user_id::text like '00000000-0000-1107-d000-%';
  if not (v_ids @> array['00000000-0000-1107-d000-000000000003', '00000000-0000-1107-d000-000000000005']::uuid[]) then
    raise exception 'suggestions % must include Bob (follow of a follow) and the twin', v_ids;
  end if;
  if v_ids && array[
    '00000000-0000-1107-d000-000000000001',
    '00000000-0000-1107-d000-000000000002',
    '00000000-0000-1107-d000-000000000004',
    '00000000-0000-1107-d000-000000000006'
  ]::uuid[] then
    raise exception 'suggestions % must not include yourself, Alice (followed), private or blocked people', v_ids;
  end if;
  if v_reason_b <> 'mutual' or v_reason_d <> 'taste' then
    raise exception 'reasons were Bob %, twin %; expected mutual, taste', v_reason_b, v_reason_d;
  end if;
end $$;

-- 5. Taste comparison.
do $$
declare
  r record;
  v_rows integer;
begin
  select * into r from public.get_taste_comparison('00000000-0000-1107-d000-000000000005');
  if r.score < 90 or r.aromatic <> 7 or r.my_aromatic <> 6 or r.spicy <> 9 then
    raise exception 'twin comparison was % / % / % / %', r.score, r.aromatic, r.my_aromatic, r.spicy;
  end if;
  select count(*) into v_rows from public.get_taste_comparison('00000000-0000-1107-d000-000000000004');
  if v_rows <> 0 then
    raise exception 'a private account''s palate must stay hidden from a non-follower';
  end if;
end $$;

-- 4. Network picks from follows.
do $$
declare
  r record;
  v_rows integer;
begin
  select count(*) into v_rows from public.get_network_stall_picks(30);
  if v_rows <> 1 then
    raise exception 'expected one followed pick (3-star and hidden reviews excluded), got %', v_rows;
  end if;
  select * into r from public.get_network_stall_picks(30);
  if r.venue_id <> current_setting('smoke.venue_a') or r.source <> 'following'
     or r.people_count <> 1 or r.sample_names <> array['Smoke Alice'] then
    raise exception 'followed pick was % / % / % / %', r.venue_id, r.source, r.people_count, r.sample_names;
  end if;
end $$;

reset role;
-- With no follows, taste twins stand in.
delete from follows where follower_id = '00000000-0000-1107-d000-000000000001';
set local role authenticated;

do $$
declare
  r record;
begin
  select * into r from public.get_network_stall_picks(30);
  if r.venue_id is distinct from current_setting('smoke.venue_b') or r.source <> 'taste_twin'
     or r.sample_names <> array['Smoke Twin'] then
    raise exception 'twin pick was % / % / %', r.venue_id, r.source, r.sample_names;
  end if;
end $$;

reset role;

-- 6. Grants and rate rules.
do $$
begin
  if has_function_privilege('anon', 'public.get_profile_relationship(uuid)', 'execute')
    or has_function_privilege('anon', 'public.get_taste_matches(uuid[])', 'execute')
    or has_function_privilege('anon', 'public.get_people_suggestions(integer)', 'execute')
    or has_function_privilege('anon', 'public.get_network_stall_picks(integer)', 'execute')
    or has_function_privilege('anon', 'public.get_taste_comparison(uuid)', 'execute') then
    raise exception 'anon must not execute the social profile RPCs';
  end if;
  if (select count(*) from app_private.request_rate_rules where route in (
    'rpc/get_profile_relationship', 'rpc/get_taste_matches',
    'rpc/get_people_suggestions', 'rpc/get_network_stall_picks', 'rpc/get_taste_comparison'
  )) <> 5 then
    raise exception 'each social profile RPC needs a rate rule';
  end if;
end $$;

rollback;
