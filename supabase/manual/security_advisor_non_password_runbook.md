# Security Advisor Non-Password Runbook

Scope: all linked Hungry Supabase Security Advisor findings except
`auth_leaked_password_protection`.

Project ref: `vlqfgmrsprbrgzteixsj`

## Current Live State

Last refreshed: 2026-05-27

Supabase Support relocated the existing PostGIS extension into the unexposed
`extensions` schema. Linked object-state checks now show `postgis` in
`extensions` with `extrelocatable = false`, and `spatial_ref_sys` is also in
`extensions` rather than the exposed `public` schema.

`npm run audit:supabase:advisor-security` confirms there are no unexpected
app-owned Security Advisor findings. `npm run
audit:supabase:advisor-security:non-password` passes, and the linked
Performance Advisor reports no issues.

Remaining accepted Security Advisor finding:

- `auth_leaked_password_protection`

Project owner instruction on 2026-05-27: ignore the leaked-password protection
warning for this cleanup pass. It remains optional Auth hardening, not an
app-owned schema/RLS blocker.

## Resolution Path

1. Verify the non-password hard gate:

   ```bash
   npm run audit:supabase:advisor-security:non-password
   ```

2. Verify the linked Performance Advisor:

   ```bash
   /opt/homebrew/bin/supabase db advisors --linked --type performance --level warn -o json
   ```

3. Optional only: enable leaked-password protection if the owner later wants a
   completely empty Security Advisor result and has an eligible Supabase plan /
   Management API token:

   ```bash
   npm run security:supabase:enable-leaked-password
   ```

4. Optional full Security Advisor verification after enabling the Auth setting:

   ```bash
   npm run audit:supabase:advisor-security
   ```

## Do Not Use These Workarounds

- Do not remove `public` from `supabase/config.toml` API schemas just to hide
  `spatial_ref_sys`; the app still intentionally exposes public tables/RPCs.
- Do not drop/recreate PostGIS from the project role. The project has
  PostGIS-typed columns and app-owned geospatial RPCs.
- Do not retry normal project-role SQL as a migration for PostGIS-owned objects
  if they reappear. Prior probes showed `ERROR 42501: must be owner of table
spatial_ref_sys` and `WARNING 01006: no privileges could be revoked for
"st_estimatedextent"`.

## Support Ticket References

Existing support report for the `spatial_ref_sys` owner error:
`5789f01ec3724199bf9e675a48ca92f1`

Creating a new CLI support ticket for the PostGIS relocation error requires
explicit owner approval because it discloses the linked project ref and database
error details to Supabase Support.
