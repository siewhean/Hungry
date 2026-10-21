-- H36: a basic server-side filter on review text before it goes public.
--
-- A review is public the moment it is inserted, and nothing screened its text.
-- A BEFORE INSERT / UPDATE OF text trigger now refuses review text that:
--   - contains a blocked term (whole-word, case-insensitive) from
--     app_private.review_blocked_terms; ops add or remove terms with plain SQL,
--     no migration needed;
--   - carries more than one link or phone number (spam and contact touting).
-- Length stays capped at 500 characters by reviews_text_length_check
-- (20261019052000). The check runs for app users (anon / authenticated) only;
-- trusted server code is not filtered. Photos keep the existing upload flow
-- (type and size checks); image moderation is an open decision for sh.
--
-- New: app_private.review_blocked_terms, app_private.review_text_violation(text)
-- (SECURITY DEFINER), app_private.reviews_enforce_text_filter() (trigger only,
-- SECURITY INVOKER).

create schema if not exists app_private;

create table if not exists app_private.review_blocked_terms (
  term text primary key check (term = lower(btrim(term)) and term <> ''),
  created_at timestamptz not null default now()
);

revoke all on table app_private.review_blocked_terms from public, anon, authenticated;
grant all on table app_private.review_blocked_terms to service_role;

-- A starter list: slurs and strong profanity in English and Singlish. Ops can
-- extend it; words that are also food or normal prose are left out.
insert into app_private.review_blocked_terms (term)
values
  ('fuck'), ('fucking'), ('fucker'), ('motherfucker'), ('cunt'), ('bitch'),
  ('asshole'), ('bastard'), ('dickhead'), ('wanker'), ('whore'), ('slut'),
  ('nigger'), ('nigga'), ('faggot'), ('fag'), ('retard'), ('tranny'),
  ('chink'), ('paki'), ('keling'),
  ('knn'), ('kanina'), ('ccb'), ('cheebye'), ('chee bye'), ('lanjiao'),
  ('lan jiao'), ('nabeh'), ('pukimak'), ('puki')
on conflict (term) do nothing;

-- Returns a short reason code, or null when the text is allowed.
create or replace function app_private.review_text_violation(p_text text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_text text := lower(coalesce(p_text, ''));
  v_links integer;
begin
  if v_text = '' then
    return null;
  end if;

  if exists (
    select 1
    from app_private.review_blocked_terms bt
    where v_text ~ ('(^|[^a-z0-9])' || bt.term || '([^a-z0-9]|$)')
  ) then
    return 'blocked_term';
  end if;

  select count(*)
    into v_links
  from regexp_matches(
    v_text,
    -- One match per URL (scheme or www. up to the next space), bare domain,
    -- or Singapore phone number (8 digits starting 3, 6, 8 or 9).
    '(https?://[^[:space:]]+|www\.[^[:space:]]+|[a-z0-9-]+\.(com|sg|net|org|io|co|ly|me|biz|xyz|link)([^a-z0-9][^[:space:]]*)?($|[[:space:]])|(\+?65[ -]?)?[3689][0-9]{3}[ -]?[0-9]{4})',
    'g'
  );

  if v_links > 1 then
    return 'too_many_links';
  end if;

  return null;
end;
$$;

revoke all on function app_private.review_text_violation(text) from public, anon, authenticated;
grant execute on function app_private.review_text_violation(text)
  to anon, authenticated, service_role;

-- SECURITY INVOKER so current_user is the caller; the term lookup above is
-- the definer part.
create or replace function app_private.reviews_enforce_text_filter()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text;
begin
  -- Trusted server code (service role, migrations, workers) is not filtered.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  v_reason := app_private.review_text_violation(new.text);
  if v_reason = 'blocked_term' then
    raise exception 'Your review contains words we don''t allow. Please edit it and try again.'
      using errcode = '23514', hint = 'review_text_blocked_term';
  elsif v_reason = 'too_many_links' then
    raise exception 'Reviews can include at most one link or phone number.'
      using errcode = '23514', hint = 'review_text_too_many_links';
  end if;

  return new;
end;
$$;

revoke all on function app_private.reviews_enforce_text_filter() from public, anon, authenticated;

drop trigger if exists trg_reviews_enforce_text_filter on public.reviews;
create trigger trg_reviews_enforce_text_filter
  before insert or update of text on public.reviews
  for each row
  execute function app_private.reviews_enforce_text_filter();

comment on table app_private.review_blocked_terms is
  'Whole-word terms refused in review text (H36). Lowercase. Ops-maintained.';
