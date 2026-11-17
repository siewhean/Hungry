# Hungry source-only backup — 17 November 2026

This is a parentless source-only backup snapshot, not an application release or a migration of the active checkout.

Original complete local backup: `backup/hungry-old-tabs-20261117` at `33115b5e5ab44a9bae84f11a48e4e2e10984493e`. The complete original snapshot and original old working directory remain local and unchanged by this export.

The following original commits are provenance text only and are not parents or imported history:

- `721786b8e7d786d64a53b624ac5b0e56dea6c0a1`
- `cbbe9c18a9cb1b9b98909640e6e1c527ea7d7c8f`
- `3630cd837bd7336f97f3c611f83457cc7f6d94b8`

## Scope

- 2,863 original source/needed-asset files, 319,198,993 bytes.
- 1,951 original paths omitted; each omission has a reason, original Git blob hash and byte count in `SOURCE_BACKUP_MANIFEST.json`.
- Two generated files (this document and the manifest) describe the export.
- Raw data/output/crawl collections, workbooks, CSV/JSONL/database/archive files, caches/dependencies/build outputs, environment and signing files, private tool configuration, and selected generated audit/catalog evidence were withheld.
- `eas.json` was withheld conservatively after JWT scanner matches, even though the values were public anonymous-client configuration. Supply deployment configuration separately before attempting a build.
- Generated catalog data and local environment configuration are intentionally absent. This source backup is not guaranteed to build or run without its separately retained inputs.
- Original Git history was not imported. The original full backup contains oversized blobs unsuitable for an ordinary GitHub push.
- No phone installation, Metro change, database action, deployment or original-checkout/index edit is part of this backup.

## Safety and verification

The initial complete default-rule Gitleaks directory scan finished in 16 seconds and found 82 potential matches across eight files. All eight files were conservatively omitted rather than applying a broad secret-scan allowlist. The final exported tree is scanned separately before publication; scan evidence is retained outside the source tree. No private credential values are recorded in this document or the manifest.
