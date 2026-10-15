#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const REQUIRED_ENV = "HUNGRY_SUPABASE_ADVISOR_SNAPSHOT_REQUIRED";
const npxCommand = process.env.SUPABASE_NPX_COMMAND || "npx";
const npxInstallArgs = process.env.SUPABASE_NPX_ALLOW_INSTALL === "1" ? [] : ["--no-install"];
// Self-hosted Supabase: target the database explicitly instead of a CLI-linked cloud project.
const DB_URL_ENV = "SUPABASE_DB_URL";
const dbUrl = process.env[DB_URL_ENV]?.trim() ?? "";
const installedSupabaseCli =
  process.env.SUPABASE_CLI_COMMAND ||
  ["/opt/homebrew/bin/supabase", "/usr/local/bin/supabase"].find((candidate) =>
    existsSync(candidate),
  );

const SNAPSHOT_SQL = `
with role_state as (
  select jsonb_build_object(
    'current_user', current_user,
    'session_user', session_user,
    'current_user_super', (select rolsuper from pg_roles where rolname = current_user),
    'current_user_is_supabase_admin_member', pg_has_role(current_user, 'supabase_admin', 'member')
  ) as data
),
spatial_ref_sys_state as (
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', c.relname,
      'owner', pg_get_userbyid(c.relowner),
      'rls_enabled', c.relrowsecurity
    )),
    '[]'::jsonb
  ) as data
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'spatial_ref_sys'
),
postgis_state as (
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'extension', e.extname,
      'schema', n.nspname,
      'owner', pg_get_userbyid(e.extowner),
      'relocatable', e.extrelocatable
    )),
    '[]'::jsonb
  ) as data
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'postgis'
),
st_estimatedextent_state as (
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'owner', pg_get_userbyid(p.proowner),
      'security_definer', p.prosecdef,
      'acl', p.proacl::text,
      'anon_can_execute', has_function_privilege('anon', p.oid, 'execute'),
      'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'execute')
    ) order by pg_get_function_identity_arguments(p.oid)),
    '[]'::jsonb
  ) as data
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'st_estimatedextent'
),
postgis_typed_columns as (
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'column', a.attname,
      'type', format_type(a.atttypid, a.atttypmod)
    ) order by n.nspname, c.relname, a.attname),
    '[]'::jsonb
  ) as data
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where a.attnum > 0
    and not a.attisdropped
    and c.relkind in ('r', 'p')
    and format_type(a.atttypid, a.atttypmod) ~* '^(geometry|geography)'
),
geo_rpc_search_paths as (
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'function', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'config', p.proconfig
    ) order by p.proname, pg_get_function_identity_arguments(p.oid)),
    '[]'::jsonb
  ) as data
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(array[
      'get_taste_recommendations',
      'search_dishes',
      'get_nearby_open_venues',
      'list_buildings',
      'list_venues_by_building'
    ])
)
select jsonb_build_object(
  'database', current_database(),
  'generated_at', clock_timestamp(),
  'role_state', role_state.data,
  'spatial_ref_sys_state', spatial_ref_sys_state.data,
  'postgis_state', postgis_state.data,
  'st_estimatedextent_state', st_estimatedextent_state.data,
  'postgis_typed_columns', postgis_typed_columns.data,
  'geo_rpc_search_paths', geo_rpc_search_paths.data
) as support_snapshot
from role_state, spatial_ref_sys_state, postgis_state, st_estimatedextent_state, postgis_typed_columns, geo_rpc_search_paths;
`;

const args = ["db", "query", "--db-url", dbUrl, "-o", "json", SNAPSHOT_SQL];
const command = installedSupabaseCli || npxCommand;
const commandArgs = installedSupabaseCli ? args : [...npxInstallArgs, "supabase", ...args];

function isRequired() {
  return process.argv.includes("--require-network") || process.env[REQUIRED_ENV] === "1";
}

function runSnapshotQuery() {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function isSkippableEnvironmentError(stderr) {
  const message = stderr.toLowerCase();
  return [
    "access token",
    "cannot find project ref",
    "command not found",
    "eai_again",
    "enotfound",
    "failed to dial",
    "lookup api.supabase.com",
    "no such host",
    "not logged in",
    "not linked",
    "spawn npx enoent",
    "timed out",
  ].some((snippet) => message.includes(snippet));
}

function fail(message, details) {
  console.error(`[supabase-advisor-support-snapshot] ${message}`);
  if (details?.trim()) console.error(details.trim());
  process.exit(1);
}

if (!dbUrl) {
  if (isRequired()) {
    console.error(
      `[supabase-advisor-support-snapshot] ${DB_URL_ENV} is required (Postgres connection string for the target Supabase database).`,
    );
    process.exit(1);
  }
  console.log(
    `[supabase-advisor-support-snapshot] skipped; ${DB_URL_ENV} is not set. Set ${REQUIRED_ENV}=1 to make this a hard failure.`,
  );
  process.exit(0);
}

const result = await runSnapshotQuery();

if (result.code !== 0) {
  if (!isRequired() && isSkippableEnvironmentError(result.stderr)) {
    console.log(
      `[supabase-advisor-support-snapshot] skipped; target Supabase database is not reachable from this environment. Set ${REQUIRED_ENV}=1 to make this a hard failure.`,
    );
    process.exit(0);
  }

  fail("failed to capture Supabase Advisor support snapshot.", result.stderr || result.stdout);
}

let payload;
try {
  payload = JSON.parse(result.stdout);
} catch (error) {
  fail("failed to parse Supabase query JSON output.", String(error));
}

const snapshot = payload?.rows?.[0]?.support_snapshot;
if (!snapshot) {
  fail("Supabase query did not return support_snapshot.");
}

console.log(JSON.stringify(snapshot, null, 2));
