# Independent database QA — 20 October 2026

Reviewer: profile/settings implementation agent, independent of database author. Scope: four forward migrations `20261020132426`–`20261020132429`, their public/private compatibility wrappers, grants, RLS, triggers, and fixture SQL. Supabase skill security checks applied; official RLS documentation reviewed at https://supabase.com/docs/guides/database/postgres/row-level-security. Changelog index read; relevant hosted PG15/17 minor-version/runtime proof remains separate from this local PG18 fixture.

## Verified locally

Ran independently, without a linked Supabase reset or hosted writes:

```sh
psql -d hungry_remediation_20261020_finalqa -v ON_ERROR_STOP=1 \
  -f supabase/smoke/remediation_authorization.sql \
  -f supabase/smoke/remediation_publication.sql \
  -f tasks/remediation-2026-10-20/QA-independent-anonymous.sql
```

Exit 0. Output: `tasks/remediation-2026-10-20/database-independent-fixture.log`. Both supplied behavioral scripts finish `ROLLBACK`. My additional isolated transaction creates a hidden home-based venue, switches to anonymous role, and requires ordinary table read to return zero without permission errors. The original fixture reproduced an actual `permission denied for function merchant_can_manage_venue` failure; corrected fixture passes.

Covered: owner/editor/viewer/stranger private-note access, rejected legacy exposed-note writes, decimal score validation, public/private follow transitions, explicit deletion cancellation, moderated portfolio ordinary/search/share reads including old private alias, verified merchant capability/provenance denial, stable coarse location and protected exact lookup, hidden venue/dish exclusions, anonymous mixed reads, raw approximate building-name scrub, all dietary requirements before the result limit, zero-match unknown metadata, publication receipt idempotency, target/owner/manifest failure, previous media retention, direct manifest/core mutation denials, immutable storage denials, and corrected/idempotent OCR acceptance.

Inspected generated `venues.location` and `buildings.location`: stored generated expressions derive from latitude/longitude, so the privacy trigger's coordinate changes propagate to geography. Fixture geography functions are stubs; this proves no actual distance, radius, PostGIS geography or spatial index behavior.

## Defects found and corrected by database author

1. Anonymous hidden/mixed reads called capability function without anonymous EXECUTE; independently reproduced, corrected and rerun.
2. Existing v2 review core fields could bypass transactional publication via direct table UPDATE, and legacy photo rows could be inserted into v2 review manifests. Author expanded review/photo guards; negative fixture cases now pass.
3. Approximate raw dish cards retained `building_name` because scrub only removed it from venue cards, and existing snapshot refresh did not remove names. Author expanded both current/future snapshot scrubbing and fixture shape; negative case passes. Dedicated residential building names are protected too.

4. Canonical `public_profiles` became a TABLE in historical20260522124728; the initial fixture treated it as the older VIEW and masked an upgrade failure. Author replaced the view replacement with an additive pending-recipient policy on the existing safe table; schema-faithful fresh fixture and independent rerun pass.
5. Deliberate hidden/approximate exact-location edits previously discarded updated fields. Author now merges intentional changed fields and exposes verified-owner patch RPC with explicit null clearing; targeted regressions pass independently.
6. Public shared portfolio images now use the full rights/source display helper. Explicit public portfolio audience remains public when owner account is private; regression passes while blocks/removal stay enforced.
7. Public graph RPC now exposes approved relationships only within target audience and block rules; ordinary stranger/private graph denial regression passes. New review listing uses complete composite cursors; recommendations apply budget/all dietary before limiting.

8. Merchant independent QA identified home-business category relabeling could disable location protection. Database author added durable private residential classification; category-change negative regression and independent rerun now pass.

## Remaining verification / review concerns

- Full historical clean replay and upgrade against a real Supabase stack, actual PostGIS/vector/storage behavior, concurrent transactions, hosted role/REST negative tests and production deployment are **not proved** by this fixture. Local runtime is Homebrew PostgreSQL18.4; hosted PG15/17 remains a distinct acceptance gate.


This QA does not certify all database observations closed. It records bounded source/fixture evidence and preserves the remaining real-stack and compatibility gates.

Final additive delta: authenticated preference persistence uses newly added `max_dish_budget` (nullable, bounded numeric) and `onboarding_selected_dish_ids` (text array) columns alongside cuisine IDs. Latest isolated fixture rerun passes persistence and safe-public-profile column exclusion assertions. This additive fixture evidence still does not replace full historical replay/upgrade proof.

Independent role-matrix follow-up: `psql -d hungry_remediation_20261020_finalqa -v ON_ERROR_STOP=1 -f supabase/smoke/remediation_role_matrix.sql` exited0; log `database-independent-role-matrix.log`. This directly exercises editor writes, viewer denial, owner update/null clearing, follower audience with notes denial, stranger/private denial, blocked follower and anonymous safe public read. No hosted/runtime upgrade proof is inferred.
