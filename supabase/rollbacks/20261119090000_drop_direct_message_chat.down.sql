-- Undo 20261119090000_drop_direct_message_chat: recreates the direct-message schema exactly as the
-- migrations left it (0023, 0038, 0041, 20260522*, 20260524*, 20260527, 20261022150000, 20261111130000)
-- and puts chat back into the data export and account deletion.
-- SCHEMA ONLY: the dropped rows are not in the database any more. Restore them from the backup taken
-- before the up migration with scripts/db/restore-chat-tables.sh, after this file. It skips archive
-- rows whose user or merchant account was deleted in the meantime, imports the rest with foreign keys
-- enforced, and validates the post_shares foreign key (supabase/manual/chat-db-drop-runbook.md).
-- The three rate rules the up migration removed are inserted back at the end.
-- down-loses-data: schema only; the dropped chat rows come back from the pre-drop backup, not from this file.

create schema if not exists app_private;

-- Tables ----------------------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null default 'user'
    check (conversation_type in ('user', 'merchant')),
  dedupe_key text not null unique,
  subject_merchant_account_id uuid references public.merchant_accounts(id) on delete set null,
  created_by_user_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  participant_kind text not null check (participant_kind in ('user', 'merchant')),
  participant_user_id uuid references public.user_profiles(id) on delete cascade,
  participant_merchant_account_id uuid references public.merchant_accounts(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (conversation_id, participant_user_id),
  unique (conversation_id, participant_merchant_account_id),
  check (
    (participant_kind = 'user' and participant_user_id is not null and participant_merchant_account_id is null)
    or
    (participant_kind = 'merchant' and participant_user_id is null and participant_merchant_account_id is not null)
  )
);

create index if not exists idx_conversation_participants_user
  on public.conversation_participants(participant_user_id);
create index if not exists idx_conversation_participants_merchant
  on public.conversation_participants(participant_merchant_account_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid references public.user_profiles(id) on delete cascade,
  sender_merchant_account_id uuid references public.merchant_accounts(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  client_nonce text,
  delivered_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, client_nonce),
  check (
    (sender_user_id is not null and sender_merchant_account_id is null)
    or
    (sender_user_id is null and sender_merchant_account_id is not null)
  )
);

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at);

create table if not exists public.read_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reader_user_id uuid references public.user_profiles(id) on delete cascade,
  reader_merchant_account_id uuid references public.merchant_accounts(id) on delete cascade,
  read_at timestamptz not null default now(),
  check (
    (reader_user_id is not null and reader_merchant_account_id is null)
    or
    (reader_user_id is null and reader_merchant_account_id is not null)
  )
);

create index if not exists idx_read_receipts_conversation
  on public.read_receipts(conversation_id, read_at desc);
create unique index if not exists idx_messages_id_conversation
  on public.messages(id, conversation_id);
create unique index if not exists idx_read_receipts_user_once
  on public.read_receipts(message_id, reader_user_id)
  where reader_user_id is not null;
create unique index if not exists idx_read_receipts_merchant_once
  on public.read_receipts(message_id, reader_merchant_account_id)
  where reader_merchant_account_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'read_receipts_message_conversation_fkey'
      and conrelid = 'public.read_receipts'::regclass
  ) then
    alter table public.read_receipts
      add constraint read_receipts_message_conversation_fkey
      foreign key (message_id, conversation_id) references public.messages(id, conversation_id)
      on delete cascade;
  end if;
end
$$;

-- post_shares kept its target_conversation_id column, and the up migration left its values in place;
-- its foreign key comes back. A value that points at a conversation that does not exist (the table is
-- empty after the up migration) would make a validated foreign key fail and abort the whole rollback,
-- so in that case the constraint is added NOT VALID: it still guards new rows, and the restore script
-- nulls the unmatched targets (what ON DELETE SET NULL would have done) and runs VALIDATE CONSTRAINT.
-- With no such value the constraint is added validated, exactly as it was before the up migration.
do $$
declare
  v_has_dangling_targets boolean;
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'post_shares_target_conversation_id_fkey'
      and conrelid = 'public.post_shares'::regclass
  ) then
    select exists (
      select 1
      from public.post_shares ps
      where ps.target_conversation_id is not null
        and not exists (select 1 from public.conversations c where c.id = ps.target_conversation_id)
    ) into v_has_dangling_targets;

    if v_has_dangling_targets then
      alter table public.post_shares
        add constraint post_shares_target_conversation_id_fkey
        foreign key (target_conversation_id) references public.conversations(id) on delete set null
        not valid;
    else
      alter table public.post_shares
        add constraint post_shares_target_conversation_id_fkey
        foreign key (target_conversation_id) references public.conversations(id) on delete set null;
    end if;
  end if;
end
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.read_receipts enable row level security;
alter table public.read_receipts replica identity full;

-- Functions -------------------------------------------------------------------------------------
-- can_access_conversation: SECURITY DEFINER body in app_private, public SECURITY INVOKER wrapper
-- (20260522142004), the layout every other client-callable helper has.
create or replace function app_private.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and (
        cp.participant_user_id = auth.uid()
        or (
          cp.participant_merchant_account_id is not null
          and public.is_merchant_member(cp.participant_merchant_account_id)
        )
      )
  );
$$;

create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
security invoker
set search_path = public, app_private
as 'select app_private.can_access_conversation(p_conversation_id);';

revoke all on function public.can_access_conversation(uuid) from public, anon, authenticated;
revoke all on function app_private.can_access_conversation(uuid) from public, anon, authenticated;
grant execute on function public.can_access_conversation(uuid) to authenticated, service_role;
grant execute on function app_private.can_access_conversation(uuid) to authenticated, service_role;

-- send_chat_message (0041 body, moved to app_private by 20260522142004).
create or replace function app_private.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_client_nonce text default null,
  p_sender_merchant_account_id uuid default null
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_user_id uuid,
  sender_merchant_account_id uuid,
  body text,
  client_nonce text,
  delivered_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_message messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required to send messages.' using errcode = '42501';
  end if;

  if v_body is null or char_length(v_body) > 4000 then
    raise exception 'Message body must be 1-4000 characters.';
  end if;

  if not public.can_access_conversation(p_conversation_id) then
    raise exception 'Conversation is unavailable to this sender.' using errcode = '42501';
  end if;

  if p_sender_merchant_account_id is not null
    and not public.is_merchant_member(p_sender_merchant_account_id) then
    raise exception 'Merchant sender is unavailable to this user.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.participant_user_id is not null
      and cp.participant_user_id <> v_user_id
      and public.app_user_block_exists(v_user_id, cp.participant_user_id)
  ) then
    raise exception 'Messaging is unavailable between these users.' using errcode = '42501';
  end if;

  if not public.app_can_make_user_request_window(v_user_id, 'chat_message_minute', 'minute', 30)
    or not public.app_can_make_user_request_window(v_user_id, 'chat_message_hour', 'hour', 120) then
    raise exception 'Message rate limit exceeded.' using errcode = '42901';
  end if;

  insert into messages (
    conversation_id,
    sender_user_id,
    sender_merchant_account_id,
    body,
    client_nonce,
    delivered_at
  )
  values (
    p_conversation_id,
    case when p_sender_merchant_account_id is null then v_user_id else null end,
    p_sender_merchant_account_id,
    v_body,
    coalesce(p_client_nonce, v_user_id::text || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::text),
    now()
  )
  returning * into v_message;

  update conversations
  set updated_at = now()
  where conversations.id = p_conversation_id;

  return query
  select
    v_message.id,
    v_message.conversation_id,
    v_message.sender_user_id,
    v_message.sender_merchant_account_id,
    v_message.body,
    v_message.client_nonce,
    v_message.delivered_at,
    v_message.created_at;
end;
$$;

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_client_nonce text default null,
  p_sender_merchant_account_id uuid default null
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_user_id uuid,
  sender_merchant_account_id uuid,
  body text,
  client_nonce text,
  delivered_at timestamptz,
  created_at timestamptz
)
language sql
security invoker
set search_path = public, app_private
as 'select * from app_private.send_chat_message(p_conversation_id, p_body, p_client_nonce, p_sender_merchant_account_id);';

revoke all on function public.send_chat_message(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function app_private.send_chat_message(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.send_chat_message(uuid, text, text, uuid) to authenticated, service_role;
grant execute on function app_private.send_chat_message(uuid, text, text, uuid) to authenticated, service_role;

comment on function app_private.send_chat_message(uuid, text, text, uuid) is
  'Checked chat message writer with participant, block, merchant, and rate-limit enforcement.';

-- open_chat_conversation (20260524023000 body, private body plus public wrapper from 20260524024500).
create or replace function app_private.open_chat_conversation(
  p_target_user_id uuid default null,
  p_target_merchant_account_id uuid default null,
  p_conversation_type text default 'user'
)
returns table (
  id uuid,
  conversation_type text,
  subject_merchant_account_id uuid,
  created_by_user_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_type text;
  v_dedupe_key text;
  v_conversation public.conversations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required to start a chat.' using errcode = '42501';
  end if;

  if (p_target_user_id is null and p_target_merchant_account_id is null)
    or (p_target_user_id is not null and p_target_merchant_account_id is not null) then
    raise exception 'Provide exactly one chat target.' using errcode = '22023';
  end if;

  if p_target_user_id is not null then
    v_type := 'user';

    if p_target_user_id = v_user_id then
      raise exception 'Cannot start a chat with yourself.' using errcode = '22023';
    end if;

    if not exists (select 1 from public.user_profiles up where up.id = p_target_user_id) then
      raise exception 'Target user is unavailable.' using errcode = '22023';
    end if;

    if public.app_user_block_exists(v_user_id, p_target_user_id)
      or public.app_user_block_exists(p_target_user_id, v_user_id) then
      raise exception 'Messaging is unavailable between these users.' using errcode = '42501';
    end if;

    select array_to_string(array_agg(part order by part), ':')
    into v_dedupe_key
    from unnest(array['user', v_user_id::text, p_target_user_id::text]) as parts(part);
  else
    v_type := 'merchant';

    if p_conversation_type not in ('merchant', 'user') then
      raise exception 'Invalid conversation type.' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.merchant_accounts ma
      where ma.id = p_target_merchant_account_id
    ) then
      raise exception 'Target merchant is unavailable.' using errcode = '22023';
    end if;

    v_dedupe_key := 'merchant:' || v_user_id::text || ':' || p_target_merchant_account_id::text;
  end if;

  insert into public.conversations (
    conversation_type,
    dedupe_key,
    subject_merchant_account_id,
    created_by_user_id
  )
  values (
    v_type,
    v_dedupe_key,
    p_target_merchant_account_id,
    v_user_id
  )
  on conflict (dedupe_key) do update
  set updated_at = public.conversations.updated_at
  returning * into v_conversation;

  insert into public.conversation_participants (
    conversation_id,
    participant_kind,
    participant_user_id,
    participant_merchant_account_id
  )
  values (
    v_conversation.id,
    'user',
    v_user_id,
    null
  )
  on conflict (conversation_id, participant_user_id) do nothing;

  if p_target_user_id is not null then
    insert into public.conversation_participants (
      conversation_id,
      participant_kind,
      participant_user_id,
      participant_merchant_account_id
    )
    values (
      v_conversation.id,
      'user',
      p_target_user_id,
      null
    )
    on conflict (conversation_id, participant_user_id) do nothing;
  else
    insert into public.conversation_participants (
      conversation_id,
      participant_kind,
      participant_user_id,
      participant_merchant_account_id
    )
    values (
      v_conversation.id,
      'merchant',
      null,
      p_target_merchant_account_id
    )
    on conflict (conversation_id, participant_merchant_account_id) do nothing;
  end if;

  return query
  select
    v_conversation.id,
    v_conversation.conversation_type,
    v_conversation.subject_merchant_account_id,
    v_conversation.created_by_user_id,
    v_conversation.updated_at;
end;
$$;

create or replace function public.open_chat_conversation(
  p_target_user_id uuid default null,
  p_target_merchant_account_id uuid default null,
  p_conversation_type text default 'user'
)
returns table (
  id uuid,
  conversation_type text,
  subject_merchant_account_id uuid,
  created_by_user_id uuid,
  updated_at timestamptz
)
language sql
security invoker
set search_path = public, app_private
as $$
  select *
  from app_private.open_chat_conversation(
    p_target_user_id,
    p_target_merchant_account_id,
    p_conversation_type
  );
$$;

revoke all on function public.open_chat_conversation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function app_private.open_chat_conversation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.open_chat_conversation(uuid, uuid, text) to authenticated, service_role;
grant execute on function app_private.open_chat_conversation(uuid, uuid, text) to authenticated, service_role;

comment on function public.open_chat_conversation(uuid, uuid, text) is
  'Public invoker wrapper for checked conversation creation.';
comment on function app_private.open_chat_conversation(uuid, uuid, text) is
  'Private checked conversation opener that creates the conversation and first participants atomically.';

-- mark_conversation_read (20261022150000: one INSERT .. ON CONFLICT).
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_user_id is null then
    return;
  end if;

  update public.conversation_participants cp
  set last_read_at = v_now
  where cp.conversation_id = p_conversation_id
    and cp.participant_user_id = v_user_id;

  insert into public.read_receipts (message_id, conversation_id, reader_user_id, read_at)
  select m.id, m.conversation_id, v_user_id, v_now
  from public.messages m
  where m.conversation_id = p_conversation_id
    and m.deleted_at is null
    and m.sender_user_id is distinct from v_user_id
  on conflict do nothing;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;

-- Immutable-field guards (0038).
create or replace function public.enforce_conversation_participant_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.participant_kind is distinct from old.participant_kind
    or new.participant_user_id is distinct from old.participant_user_id
    or new.participant_merchant_account_id is distinct from old.participant_merchant_account_id
    or new.joined_at is distinct from old.joined_at then
    raise exception 'conversation participant identity fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_conversation_participant_update_guard on public.conversation_participants;
create trigger trg_enforce_conversation_participant_update_guard
before update on public.conversation_participants
for each row
execute function public.enforce_conversation_participant_update_guard();

create or replace function public.enforce_message_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_user_id is distinct from old.sender_user_id
    or new.sender_merchant_account_id is distinct from old.sender_merchant_account_id
    or new.client_nonce is distinct from old.client_nonce
    or new.created_at is distinct from old.created_at then
    raise exception 'message identity fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_message_update_guard on public.messages;
create trigger trg_enforce_message_update_guard
before update on public.messages
for each row
execute function public.enforce_message_update_guard();

create or replace function public.enforce_read_receipt_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.message_id is distinct from old.message_id
    or new.conversation_id is distinct from old.conversation_id
    or new.reader_user_id is distinct from old.reader_user_id
    or new.reader_merchant_account_id is distinct from old.reader_merchant_account_id then
    raise exception 'read receipt identity fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_read_receipt_update_guard on public.read_receipts;
create trigger trg_enforce_read_receipt_update_guard
before update on public.read_receipts
for each row
execute function public.enforce_read_receipt_update_guard();

-- Row-level security policies, in their final form: 0023 policies with auth.uid() wrapped as a
-- scalar sub-select (20260527145534), and read_receipts_upsert_reader split per command there.
-- Function references are app_private.can_access_conversation / app_private.is_merchant_member:
-- 20260522142004 moved those functions with ALTER FUNCTION ... SET SCHEMA, and a policy follows the
-- function by OID, so the live policies are written with the app_private names (confirmed against a
-- pg_dump of staging taken before the up migration). Writing public.* here changes the definition.
drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
on public.conversations for select to authenticated
using (app_private.can_access_conversation(id));

drop policy if exists "conversations_insert_creator" on public.conversations;
create policy "conversations_insert_creator"
on public.conversations for insert to authenticated
with check ((select auth.uid()) = created_by_user_id);

drop policy if exists "conversations_update_participant" on public.conversations;
create policy "conversations_update_participant"
on public.conversations for update to authenticated
using (app_private.can_access_conversation(id))
with check (app_private.can_access_conversation(id));

drop policy if exists "conversation_participants_select_participant" on public.conversation_participants;
create policy "conversation_participants_select_participant"
on public.conversation_participants for select to authenticated
using (app_private.can_access_conversation(conversation_id));

drop policy if exists "conversation_participants_insert_creator_or_self" on public.conversation_participants;
create policy "conversation_participants_insert_creator_or_self"
on public.conversation_participants for insert to authenticated
with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_participants.conversation_id
      and c.created_by_user_id = (select auth.uid())
  )
  or (
    participant_merchant_account_id is not null
    and app_private.is_merchant_member(participant_merchant_account_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.created_by_user_id = (select auth.uid())
    )
  )
);

drop policy if exists "conversation_participants_update_self" on public.conversation_participants;
create policy "conversation_participants_update_self"
on public.conversation_participants for update to authenticated
using (
  participant_user_id = (select auth.uid())
  or (
    participant_merchant_account_id is not null
    and app_private.is_merchant_member(participant_merchant_account_id)
  )
)
with check (
  participant_user_id = (select auth.uid())
  or (
    participant_merchant_account_id is not null
    and app_private.is_merchant_member(participant_merchant_account_id)
  )
);

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
on public.messages for select to authenticated
using (app_private.can_access_conversation(conversation_id) and deleted_at is null);

drop policy if exists "messages_insert_sender_participant" on public.messages;
create policy "messages_insert_sender_participant"
on public.messages for insert to authenticated
with check (
  app_private.can_access_conversation(conversation_id)
  and (
    sender_user_id = (select auth.uid())
    or (
      sender_merchant_account_id is not null
      and app_private.is_merchant_member(sender_merchant_account_id)
    )
  )
);

drop policy if exists "messages_update_sender" on public.messages;
create policy "messages_update_sender"
on public.messages for update to authenticated
using (
  sender_user_id = (select auth.uid())
  or (
    sender_merchant_account_id is not null
    and app_private.is_merchant_member(sender_merchant_account_id)
  )
)
with check (
  sender_user_id = (select auth.uid())
  or (
    sender_merchant_account_id is not null
    and app_private.is_merchant_member(sender_merchant_account_id)
  )
);

drop policy if exists "read_receipts_select_participant" on public.read_receipts;
create policy "read_receipts_select_participant"
on public.read_receipts for select to authenticated
using (app_private.can_access_conversation(conversation_id));

drop policy if exists "read_receipts_upsert_reader" on public.read_receipts;
drop policy if exists "read_receipts_upsert_reader_insert" on public.read_receipts;
create policy "read_receipts_upsert_reader_insert"
on public.read_receipts for insert to authenticated
with check (
  app_private.can_access_conversation(conversation_id)
  and (
    reader_user_id = (select auth.uid())
    or (
      reader_merchant_account_id is not null
      and app_private.is_merchant_member(reader_merchant_account_id)
    )
  )
);

drop policy if exists "read_receipts_upsert_reader_update" on public.read_receipts;
create policy "read_receipts_upsert_reader_update"
on public.read_receipts for update to authenticated
using (
  reader_user_id = (select auth.uid())
  or (
    reader_merchant_account_id is not null
    and app_private.is_merchant_member(reader_merchant_account_id)
  )
)
with check (
  app_private.can_access_conversation(conversation_id)
  and (
    reader_user_id = (select auth.uid())
    or (
      reader_merchant_account_id is not null
      and app_private.is_merchant_member(reader_merchant_account_id)
    )
  )
);

drop policy if exists "read_receipts_upsert_reader_delete" on public.read_receipts;
create policy "read_receipts_upsert_reader_delete"
on public.read_receipts for delete to authenticated
using (
  reader_user_id = (select auth.uid())
  or (
    reader_merchant_account_id is not null
    and app_private.is_merchant_member(reader_merchant_account_id)
  )
);

-- Table privileges, in their final form (0041, 20261111130000): the Supabase defaults, then:
--   conversations / conversation_participants: the phone cannot insert or update directly
--   messages: the phone can only read; anon cannot write or truncate
grant all on table public.conversations, public.conversation_participants,
  public.messages, public.read_receipts to anon, authenticated, service_role;
revoke insert, update on table public.conversations from authenticated;
revoke insert on table public.conversation_participants from authenticated;
revoke insert, update, delete, truncate on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
grant all on table public.messages to service_role;

-- Realtime publication (guarded: absent on a plain Postgres).
do $$
declare
  v_table text;
begin
  foreach v_table in array array['conversations', 'conversation_participants', 'messages', 'read_receipts'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end
$$;

-- Rate rules removed by the up migration (values from 20261022120000).
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/send_chat_message', null, 60, 'chat'),
  ('rpc/open_chat_conversation', null, 30, 'chat'),
  ('read_receipts', null, 120, 'chat read receipts')
on conflict (route) do update
set anon_per_minute = excluded.anon_per_minute,
    user_per_minute = excluded.user_per_minute,
    note = excluded.note;

-- Data export and account deletion mention chat again (text from 20261113090000 / 20261021100000).
create or replace function pg_temp.patch_function(p_oid regprocedure, p_find text, p_replace text)
returns void
language plpgsql
as $patch$
declare
  v_src text := (select prosrc from pg_proc where oid = p_oid);
  v_count integer := (length(v_src) - length(replace(v_src, p_find, ''))) / length(p_find);
begin
  if v_count <> 1 then
    raise exception 'patch_function: % has % copies of the expected text', p_oid, v_count;
  end if;
  execute replace(pg_get_functiondef(p_oid), p_find, p_replace);
end;
$patch$;

select pg_temp.patch_function(
  'app_private.export_my_data()'::regprocedure,
  $find$    'activity',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.activity_events t where t.recipient_id = v_user), '[]'::jsonb),
$find$,
  $repl$    'conversations',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.conversation_participants t where t.participant_user_id = v_user), '[]'::jsonb),
    'messagesSent',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.messages t where t.sender_user_id = v_user), '[]'::jsonb),
    'activity',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.activity_events t where t.recipient_id = v_user), '[]'::jsonb),
$repl$
)
where position('conversation_participants' in (
  select prosrc from pg_proc where oid = 'app_private.export_my_data()'::regprocedure
)) = 0;

select pg_temp.patch_function(
  'public.anonymize_account_deletion_request(uuid, uuid)'::regprocedure,
  $find$  update chat_messages
  set body = '[deleted]'
  where sender_user_id = v_user_id;
$find$,
  $repl$  delete from conversation_participants
  where participant_user_id = v_user_id;

  update conversations
  set created_by_user_id = null
  where created_by_user_id = v_user_id;

  update messages
  set
    body = '[deleted]',
    deleted_at = coalesce(deleted_at, now()),
    edited_at = coalesce(edited_at, now())
  where sender_user_id = v_user_id;

  delete from read_receipts
  where reader_user_id = v_user_id;

  update chat_messages
  set body = '[deleted]'
  where sender_user_id = v_user_id;
$repl$
)
where position('conversation_participants' in (
  select prosrc from pg_proc where oid = 'public.anonymize_account_deletion_request(uuid, uuid)'::regprocedure
)) = 0;

notify pgrst, 'reload schema';
