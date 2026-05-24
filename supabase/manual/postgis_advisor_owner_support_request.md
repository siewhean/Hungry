# Supabase Support Request: PostGIS Advisor Owner Action

Project ref: `vlqfgmrsprbrgzteixsj`

## Request

Please resolve the remaining Supabase Security Advisor findings that require
`supabase_admin` / PostGIS owner action:

- `RLS Disabled in Public`
- Entity: `public.spatial_ref_sys`
- Cache key: `rls_disabled_in_public_public_spatial_ref_sys`
- `Security Definer Function Executable`
- Entity: `public.st_estimatedextent(...)` overloads
- `Extension in Public`
- Entity: `postgis`

Current linked Advisor state after app-owned cleanup migration
`20260522142004_advisor_private_rpc_wrappers.sql`: 9 security findings remain.
The only remaining security-definer executable findings are the three PostGIS
`st_estimatedextent(...)` overloads for `anon` and `authenticated`; app-owned
public RPC/helper findings have been moved behind public SECURITY INVOKER
wrappers with non-exposed `app_private` SECURITY DEFINER bodies.

Live rechecks on 2026-05-22 through 2026-05-24 confirmed the same 9-finding
state. The project role
and owner metadata are:

```text
current_user: postgres
session_user: postgres
postgres rolsuper: false
postgres can set role supabase_admin: false
public.spatial_ref_sys owner: supabase_admin
postgis owner: supabase_admin
postgis schema: public
postgis extrelocatable: false
```

The 2026-05-24 recheck still shows:

```text
error-level Advisor: public.spatial_ref_sys RLS disabled
warning-level Advisor:
- public.postgis installed in public
- public.st_estimatedextent(text,text) executable by anon/authenticated
- public.st_estimatedextent(text,text,text) executable by anon/authenticated
- public.st_estimatedextent(text,text,text,boolean) executable by anon/authenticated
- leaked-password protection disabled
```

The 2026-05-24 non-password remediation probes confirmed there is no safe
project-role SQL path for the remaining PostGIS findings:

```text
revoke execute on public.st_estimatedextent(...) from public, anon, authenticated
result: completed, but anon/authenticated still have execute privilege because
the ACLs are granted by supabase_admin.

alter extension postgis set schema extensions
result: ERROR 0A000: extension "postgis" does not support SET SCHEMA
```

The project role used by the CLI is `postgres`, but `public.spatial_ref_sys`
and extension `postgis` are owned by `supabase_admin`. The project role cannot
enable RLS, revoke Supabase-admin-granted PostGIS function grants, or relocate
PostGIS:

```sql
ERROR 42501: must be owner of table spatial_ref_sys
WARNING 01006: no privileges could be revoked for "st_estimatedextent"
```

The three Advisor-flagged PostGIS functions have ACLs granted by
`supabase_admin`:

```text
public.st_estimatedextent(text,text)
public.st_estimatedextent(text,text,text)
public.st_estimatedextent(text,text,text,boolean)

ACL:
{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}
```

Current PostGIS typed columns that must be smoke-tested if support chooses the
alternate relocation path:

```text
public.buildings.location                         geography(Point,4326)
public.staging_food_businesses.observed_location  geography(Point,4326)
public.venue_source_observations.observed_location geography(Point,4326)
```

Hungry app-owned geospatial RPCs were prepared for relocation on 2026-05-23
with migration `20260522160920_postgis_relocation_search_path_prep.sql`.
The following functions now have `search_path=public, extensions`, so they can
resolve PostGIS functions before and after a support-assisted move:

```text
public.get_taste_recommendations(...)
public.search_dishes(...)
public.get_nearby_open_venues(...)
public.list_buildings(...)
public.list_venues_by_building(...)
```

## Low-risk requested action

Run the SQL in `supabase/manual/spatial_ref_sys_rls_admin.sql` from an owner
context that can alter extension-owned objects. This clears the
`public.spatial_ref_sys` RLS finding and the six `st_estimatedextent(...)`
execute findings:

```sql
alter table public.spatial_ref_sys enable row level security;

drop policy if exists spatial_ref_sys_read_all on public.spatial_ref_sys;
create policy spatial_ref_sys_read_all
on public.spatial_ref_sys for select
using (true);

revoke execute on function public.st_estimatedextent(text, text)
from public, anon, authenticated;

revoke execute on function public.st_estimatedextent(text, text, text)
from public, anon, authenticated;

revoke execute on function public.st_estimatedextent(text, text, text, boolean)
from public, anon, authenticated;
```

## Full non-password Advisor resolution request

To clear all remaining non-password Advisor findings, Supabase Support needs to
perform one of these owner-context remediations:

1. Apply the low-risk owner SQL above, then perform a support-assisted PostGIS
   relocation from `public` to `extensions`.
2. Apply Supabase's recommended equivalent hardening for existing projects where
   PostGIS was originally installed in `public`.

Direct project-role relocation is not available on this project:

```sql
begin;
alter extension postgis set schema extensions;
rollback;
```

returns:

```text
ERROR 0A000: extension "postgis" does not support SET SCHEMA
```

## Rejected project-side alternatives

Do not remove `public` from the exposed API schemas as a workaround for
`rls_disabled_in_public`. `supabase/config.toml` currently exposes:

```toml
schemas = ["public", "storage", "graphql_public"]
```

The app and Edge Functions still intentionally use public tables and RPCs such
as `buildings`, `venues`, `dishes`, `public_profiles`, `messages`,
`read_receipts`, `submit_menu_photo`, `send_chat_message`,
`open_chat_conversation`, and `get_taste_recommendations`. Removing `public`
from the API schemas would be a broad app/API migration, not a safe Advisor
cleanup.

Do not drop/recreate PostGIS from the project role. Current app data includes
PostGIS typed columns and app-owned geo RPCs; destructive extension changes
need a backup, dependency review, Supabase owner/support involvement, and the
smoke suite listed below.

## Support ticket body

Refresh the live support evidence immediately before filing or updating the
ticket:

```bash
SUPABASE_NPX_COMMAND=/opt/homebrew/bin/npx \
  npm run audit:supabase:advisor-support-snapshot
```

The command is read-only and prints the current linked role, PostGIS ownership,
`spatial_ref_sys` RLS state, `st_estimatedextent(...)` ACLs, active PostGIS
typed columns, and app-owned geo RPC search paths.

```text
Project ref: vlqfgmrsprbrgzteixsj

Please resolve the remaining Supabase Security Advisor findings for
extension-owned PostGIS objects in the linked Hungry project.

Current live Advisor findings excluding leaked-password protection:
- ERROR rls_disabled_in_public_public_spatial_ref_sys
- WARN extension_in_public_postgis
- WARN anon/authenticated can execute SECURITY DEFINER
  public.st_estimatedextent(text,text)
- WARN anon/authenticated can execute SECURITY DEFINER
  public.st_estimatedextent(text,text,text)
- WARN anon/authenticated can execute SECURITY DEFINER
  public.st_estimatedextent(text,text,text,boolean)

The linked project role is postgres, not a superuser and not a member of
supabase_admin. The flagged objects are owned/granted by supabase_admin:
- public.spatial_ref_sys owner: supabase_admin, RLS disabled
- postgis owner: supabase_admin, schema: public, extrelocatable: false
- public.st_estimatedextent(...) ACLs are granted by supabase_admin and remain
  executable by anon/authenticated after project-role revoke probes.

Please apply the owner-context RLS/revoke hardening for spatial_ref_sys and
st_estimatedextent, and advise or perform the supported PostGIS relocation from
public to extensions for this existing project.

Prior CLI support report for spatial_ref_sys:
5789f01ec3724199bf9e675a48ca92f1
```

## Optional CLI support-ticket path

The Supabase CLI has a global `--create-ticket` flag for CLI errors. If the
project owner explicitly approves disclosing the linked project ref and the
`spatial_ref_sys` ownership error to Supabase Support, run this rollback-wrapped
probe to create a support ticket without changing database state:

```bash
npx --no-install supabase db query --linked --create-ticket -o json \
  "begin; alter table public.spatial_ref_sys enable row level security; rollback;"
```

Do not run the full owner-action SQL from the normal project role just to retry
the known failure; current live metadata already proves the project role cannot
alter `supabase_admin`-owned PostGIS objects.

2026-05-22 result after explicit project-owner approval:

```text
unexpected status 400: {"message":"Failed to run sql query: ERROR:  42501: must be owner of table spatial_ref_sys\n"}
Sent crash report: 5789f01ec3724199bf9e675a48ca92f1
```

Quote report ID `5789f01ec3724199bf9e675a48ca92f1` when following up with
Supabase Support.

If the project owner explicitly approves disclosing the linked project ref and
PostGIS relocation error to Supabase Support, this second rollback-wrapped probe
can create a matching support ticket for the `extension_in_public` warning:

```bash
npx --no-install supabase db query --linked --create-ticket -o json \
  "begin; alter extension postgis set schema extensions; rollback;"
```

Do not run this command without explicit approval for the PostGIS relocation
error disclosure.

## Alternate hardening path

If Supabase recommends clearing both `rls_disabled_in_public` and
`extension_in_public` together, plan a support-assisted PostGIS relocation from
`public` to `extensions`. This must be scheduled separately because current
Hungry migrations and database functions depend on existing PostGIS objects and
need a full backup, dependency review, and linked smoke verification.

After support-assisted relocation, rerun:

```bash
npx --no-install supabase db query --linked -f supabase/smoke/postgis_distance.sql -o table
npx --no-install supabase db query --linked -f supabase/smoke/location_directory_reads.sql -o table
npx --no-install supabase db query --linked -f supabase/smoke/server_side_discovery_reads.sql -o table
npx --no-install supabase db query --linked -f supabase/smoke/taste_recommendations.sql -o table
npm run smoke:supabase-full-audit-v1
```

Supabase's current PostGIS documentation says new installs should use a
dedicated schema and that PostGIS 2.3+ is no longer normally relocatable; for
public-to-extensions relocation it documents either backup/drop/recreate or
contacting Supabase Support to temporarily mark PostGIS relocatable, move it,
update it, and restore `extrelocatable = false`.

Reference docs:

- <https://supabase.com/docs/guides/database/extensions/postgis>
- <https://supabase.com/docs/guides/database/database-advisors>
- <https://supabase.com/docs/guides/auth/password-security>

## Separate dashboard/API action

The remaining `auth_leaked_password_protection` warning is not a database-owner
issue. After the project is on a plan that supports leaked password protection,
enable it in the Supabase Dashboard Auth settings or run:

```bash
SUPABASE_ACCESS_TOKEN=... npm run security:supabase:enable-leaked-password
```

The helper uses the official Management API auth config field
`password_hibp_enabled`.

2026-05-24 helper recheck still exits before mutation because
`SUPABASE_ACCESS_TOKEN` is not present in the Codex shell.

## Verification after owner action

```bash
npx --no-install supabase db advisors --linked --type security --level error -o json
npx --no-install supabase db advisors --linked --type security --level warn -o json
```
