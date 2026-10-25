# Pending migrations

`20260724113000_catalog_raw_publish_quality_gate.sql` reached `main` with PR #72 on 2026-10-23,
after production (Singapore) and staging were built, so neither database has it. It cannot be
applied as it is: its publish body predates `20261021140000_catalog_raw_display_rights` (menu
display rights), it drops the live `(integer, integer)` publisher, and its manifest expects the
July workbook (119,232 venues), not today's catalog. `scripts/publish-catalog-raw-release.mjs`
needs it. Nothing in this folder is applied by any script.

The other three migrations from PR #72 (non-consumer venue exclusion, map exclusion, cursor-helper
grants) were rebuilt on today's functions as
`supabase/migrations/20261025090000_catalog_hide_non_consumer_venues.sql`.
