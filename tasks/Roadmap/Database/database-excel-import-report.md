# Database Excel Import Report

> Updated: 2026-06-06
> Scope: Hungry F&B Excel workbook validation and staging-import readiness
> Workbook: `data/Hungry F&B Database.xlsx`
> Status: Source-ready; live Supabase staging import pending

## Summary

The Excel integration source path is ready for a guarded staging import. The workbook headers match the expected 52-column contract, and the importer remains staging-only with service-role execution explicitly gated by `HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1`.

No live Supabase import was run in this pass.

## Validation Run

Command:

```bash
PYTHONPYCACHEPREFIX=/tmp/hungry-pycache python3 scripts/validate_excel_workbook.py --allow-row-errors --output /tmp/hungry-excel-validation-full.json
```

Result:

| Metric | Value |
|---|---:|
| Headers OK | yes |
| Rows checked | 35,909 |
| Valid rows | 35,752 |
| Invalid rows | 157 |
| Missing columns | 0 |
| Extra columns | 0 |
| Duplicate source key groups | 3,656 |

Issue counts:

| Issue | Count | Severity |
|---|---:|---|
| `duplicate_source_key` | 7,312 | warning |
| `missing_latitude` | 132 | error |
| `missing_longitude` | 132 | error |
| `missing_stall_name` | 25 | error |

## Interpretation

The duplicate source keys are warnings because they are expected to be resolved by staging dedupe and provenance review. They should not block staging load.

The 157 invalid rows should remain in staging error output until corrected or explicitly excluded. The current importer skips invalid rows and records errors in `staging_import_errors`; it does not promote data into `buildings`, `venues`, or `dishes`.

## Live Import Status

Not run. Required guarded command:

```bash
HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1 python3 scripts/import_excel_to_supabase.py --apply-supabase
```

Required env:

```bash
HUNGRY_SUPABASE_IMPORT_URL=
HUNGRY_SUPABASE_IMPORT_PROJECT_REF=
HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY=
HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1
```

## Next Operational Checks

After staging import:

```bash
node scripts/smoke_location_queries.mjs
node scripts/smoke_search_queries.mjs
node scripts/smoke_rls.mjs
```

Expected import behavior:

- Insert a row into `import_runs`.
- Insert valid workbook rows into `staging_food_businesses`.
- Insert rejected row issues into `staging_import_errors`.
- Leave canonical app tables unchanged until a separate reviewed promotion pass.
