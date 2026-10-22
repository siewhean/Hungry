-- Minimal Supabase stand-in for a plain PostgreSQL 16 database.
-- Mirrors what a fresh Supabase project already has before any migration runs.
-- Extensions are NOT created here: the migrations create them (vector, pg_trgm,
-- citext, pgcrypto, postgis, pg_cron, pg_net, ...), exactly as on Supabase.

\set ON_ERROR_STOP 1

-- Roles ---------------------------------------------------------------------
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
create role supabase_admin login superuser createdb createrole replication bypassrls;
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;

-- Schemas -------------------------------------------------------------------
create schema auth;
create schema storage;
create schema extensions;
create schema vault;
create schema cron;
create schema net;
create schema supabase_migrations;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant usage on schema cron to postgres;
grant usage on schema net to postgres, service_role;

-- Supabase default privileges: objects postgres creates in public / extensions
-- are granted to the API roles; RLS and explicit revokes do the gating.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema extensions grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema extensions grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema extensions grant all on functions to anon, authenticated, service_role;

-- Supabase resolves unqualified extension objects through the extensions schema.
-- Set per role (as Supabase does) so databases cloned from this one keep it.
alter role postgres set search_path = "$user", public, extensions;
alter role supabase_admin set search_path = "$user", public, extensions;
alter role authenticator set search_path = "$user", public, extensions;
alter role anon set search_path = "$user", public, extensions;
alter role authenticated set search_path = "$user", public, extensions;
alter role service_role set search_path = "$user", public, extensions;

-- Realtime publication exists on every Supabase project.
create publication supabase_realtime;

-- auth ----------------------------------------------------------------------
create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create function auth.email()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.email(), auth.jwt()
  to anon, authenticated, service_role;

-- Subset of GoTrue's auth.users. created_at has no default, as on Supabase.
create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text unique,
  phone_confirmed_at timestamptz,
  confirmed_at timestamptz generated always as (least(email_confirmed_at, phone_confirmed_at)) stored,
  banned_until timestamptz,
  deleted_at timestamptz,
  is_sso_user boolean not null default false,
  is_anonymous boolean not null default false
);
grant all on auth.users to service_role;

-- storage -------------------------------------------------------------------
create table storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);
create unique index bname on storage.buckets (name);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text,
  owner_id text,
  user_metadata jsonb
);
create unique index bucketid_objname on storage.objects (bucket_id, name);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

create function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

create function storage.filename(name text)
returns text
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts, 1)];
end
$$;

create function storage.extension(name text)
returns text
language plpgsql
immutable
as $$
declare
  _parts text[];
  _filename text;
begin
  select string_to_array(name, '/') into _parts;
  select _parts[array_length(_parts, 1)] into _filename;
  return reverse(split_part(reverse(_filename), '.', 1));
end
$$;

grant execute on function storage.foldername(text), storage.filename(text), storage.extension(text)
  to anon, authenticated, service_role;

-- vault (supabase_vault, without encryption) --------------------------------
create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  description text not null default '',
  secret text not null,
  key_id uuid,
  nonce bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create view vault.decrypted_secrets as
select id, name, description, secret, secret as decrypted_secret, key_id, nonce, created_at, updated_at
from vault.secrets;

create function vault.create_secret(
  new_secret text,
  new_name text default null,
  new_description text default '',
  new_key_id uuid default null
)
returns uuid
language sql
as $$
  insert into vault.secrets (secret, name, description, key_id)
  values (new_secret, new_name, new_description, new_key_id)
  returning id;
$$;

revoke all on schema vault from public;
revoke all on all tables in schema vault from public;
grant usage on schema vault to postgres, service_role;

-- supabase_migrations -------------------------------------------------------
create table supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
