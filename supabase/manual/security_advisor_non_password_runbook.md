# Security Advisor Non-Password Runbook

Scope: all linked Hungry Supabase Security Advisor findings except
`auth_leaked_password_protection`.

Project ref: `vlqfgmrsprbrgzteixsj`

## Current Live State

Last refreshed: 2026-05-24

`npm run audit:supabase:advisor-security` confirms there are no unexpected
app-owned Security Advisor findings. The remaining non-password findings are
all PostGIS-owned:

- `public.spatial_ref_sys` has RLS disabled.
- `postgis` is installed in `public`.
- `public.st_estimatedextent(text, text)` is executable by `anon` and
  `authenticated`.
- `public.st_estimatedextent(text, text, text)` is executable by `anon` and
  `authenticated`.
- `public.st_estimatedextent(text, text, text, boolean)` is executable by
  `anon` and `authenticated`.

The linked database role is `postgres`, but these objects are owned or granted
by `supabase_admin`. Project ownership in the Supabase Dashboard does not make
the SQL session the owner of these extension-owned objects.

## Resolution Path

1. Refresh the owner/support evidence:

   ```bash
   SUPABASE_NPX_COMMAND=/opt/homebrew/bin/npx \
     npm run audit:supabase:advisor-support-snapshot
   ```

2. File or update the Supabase Support request using
   `supabase/manual/postgis_advisor_owner_support_request.md`.

3. Ask Supabase Support to apply the owner-context fix from
   `supabase/manual/spatial_ref_sys_rls_admin.sql` or their equivalent
   hardening:
   - enable RLS on `public.spatial_ref_sys`
   - keep a read policy for `spatial_ref_sys`
   - revoke `anon` and `authenticated` execute privileges from the three
     `public.st_estimatedextent(...)` overloads
   - resolve the existing `postgis`-in-`public` extension warning through the
     supported owner/platform path

4. After Support confirms changes, verify the linked Advisor state:

   ```bash
   SUPABASE_NPX_COMMAND=/opt/homebrew/bin/npx \
     npm run audit:supabase:advisor-security
   ```

5. Verify the non-password hard gate. This must fail until the PostGIS findings
   are cleared, but it intentionally ignores leaked-password protection:

   ```bash
   SUPABASE_NPX_COMMAND=/opt/homebrew/bin/npx \
     npm run audit:supabase:advisor-security:non-password
   ```

6. Verify the full hard release gate. This must fail until every remaining
   Advisor finding, including leaked-password protection, is cleared:

   ```bash
   HUNGRY_SUPABASE_ADVISOR_FAIL_ON_EXTERNAL=1 \
   SUPABASE_NPX_COMMAND=/opt/homebrew/bin/npx \
     npm run audit:supabase:advisor-security
   ```

7. Smoke-test PostGIS-backed app reads after any support-assisted PostGIS
   change:

   ```bash
   /opt/homebrew/bin/npx --no-install supabase db query --linked \
     -f supabase/smoke/postgis_distance.sql -o table
   /opt/homebrew/bin/npx --no-install supabase db query --linked \
     -f supabase/smoke/location_directory_reads.sql -o table
   /opt/homebrew/bin/npx --no-install supabase db query --linked \
     -f supabase/smoke/server_side_discovery_reads.sql -o table
   /opt/homebrew/bin/npx --no-install supabase db query --linked \
     -f supabase/smoke/taste_recommendations.sql -o table
   npm run smoke:supabase-full-audit-v1
   ```

## Do Not Use These Workarounds

- Do not remove `public` from `supabase/config.toml` API schemas just to hide
  `spatial_ref_sys`; the app still intentionally exposes public tables/RPCs.
- Do not drop/recreate PostGIS from the project role. The project has
  PostGIS-typed columns and app-owned geospatial RPCs.
- Do not retry normal project-role SQL as a migration for these objects. Prior
  probes already show `ERROR 42501: must be owner of table spatial_ref_sys` and
  `WARNING 01006: no privileges could be revoked for "st_estimatedextent"`.

## Support Ticket References

Existing support report for the `spatial_ref_sys` owner error:
`5789f01ec3724199bf9e675a48ca92f1`

Creating a new CLI support ticket for the PostGIS relocation error requires
explicit owner approval because it discloses the linked project ref and database
error details to Supabase Support.
