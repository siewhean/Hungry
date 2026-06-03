-- User settings table for synced preferences (notification prefs, privacy, etc.)

create table if not exists public.user_settings (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists idx_user_settings_user_id
  on public.user_settings(user_id);

alter table public.user_settings enable row level security;

create policy "user_settings_select_own"
on public.user_settings for select to authenticated
using (user_id = auth.uid());

create policy "user_settings_insert_own"
on public.user_settings for insert to authenticated
with check (user_id = auth.uid());

create policy "user_settings_update_own"
on public.user_settings for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_settings_delete_own"
on public.user_settings for delete to authenticated
using (user_id = auth.uid());

create policy "user_settings_service_role_all"
on public.user_settings for all to service_role
using (true)
with check (true);
