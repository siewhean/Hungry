# Pending migrations

These four migrations reached `main` with PR #72 on 2026-10-23, after production (Singapore)
and staging were built, so neither database has them. They cannot be applied as they are:
they patch or replace catalog functions (`catalog_raw_*_page`, `catalog_raw_map_view`,
`catalog_raw_*_detail`, `catalog_raw_publish_release`) that newer migrations have since
redefined, so running them now would put back older bodies or fail.

- `20260715013000` / `20260715020000`: hide non-consumer venues (7-Eleven, schools, factories).
- `20260724090000`: advisor hardening. Its only missing effect is making the cursor helpers
  `catalog_raw_cursor(jsonb)` and `catalog_raw_cursor_value(text)` service-role only (the page
  RPCs that call them are SECURITY DEFINER, so revoking anon/authenticated is safe).
- `20260724113000`: catalog publish quality gate (manifests, quarantines,
  `catalog_raw_publish_release(text)`). `scripts/publish-catalog-raw-release.mjs` needs it.
  Its publish body predates `20261021140000_catalog_raw_display_rights` (menu display rights)
  and drops the `(integer, integer)` publisher, so it must be rebuilt on today's functions.

Port the catalog pieces as a new migration (with rollback, smoke and rehearsal), then delete
the file it replaces from this folder. Nothing in this folder is applied by any script.
