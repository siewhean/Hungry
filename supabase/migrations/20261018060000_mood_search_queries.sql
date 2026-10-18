-- Taste engine plan: plain-language ("mood") search. The mood-search Edge Function stores
-- each answer from Claude here so repeat searches are served from cache, and counts each
-- person's fresh calls to enforce a daily cap. Only the function (service role) touches it.

create table if not exists public.mood_search_queries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  query_norm text not null check (char_length(query_norm) between 2 and 200),
  intent jsonb not null,
  cached boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mood_search_queries_cache_idx
  on public.mood_search_queries (query_norm, created_at desc)
  where cached = false;

create index if not exists mood_search_queries_user_created_idx
  on public.mood_search_queries (user_id, created_at desc);

alter table public.mood_search_queries enable row level security;

-- No policies: app users never read or write this table directly.
revoke all on public.mood_search_queries from anon, authenticated;
