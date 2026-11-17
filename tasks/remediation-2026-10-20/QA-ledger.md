# Independent closure-ledger QA — 20 October 2026

Reviewer: database specialist independently checking root's ledger integration and final provider use. Scope is audited-ID coverage, specialist evidence linkage, current SQL/provider names, and bounded source gaps. This is not independent reexecution of every page test or release acceptance.

## Coverage

- Audited register and ledger contain exactly **187 IDs**, with identical sets, no missing/extra IDs and no duplicates.
- All **187 independent adjudication references** in the audited register resolve to existing authoritative cross-check reports.
- Ledger reports **171 source_addressed / 16 acceptance_pending**, with119 implemented,36 shared,16 removed and16 external_pending primary dispositions. Source-addressed is explicitly distinct from release-closed.
- All listed implementation and integration-evidence paths exist. Empty implementation arrays are limited to DS-16/MER-19 acceptance-only concerns and MD-PRIV-01/MER-28/MER-29 shared database causes. The latter require database evidence linkage described below.
- Worker handoff requests are retained as provenance. Existing account/publication/tools/merchant QA records supersede completed shared integration requests; native, hosted, permissions, actual worker/storage and full historical migration replay limitations remain open.

## Concrete corrections requested from integrator

1. **Database results omitted by ledger merger.** `merge-ledger.py` initially read only `findings`/`observations` from `RESULT-database.json`, whose actual array key is `entries`. Consequently zero ledger rows had `database_evidence`, including shared-only MER-28/MER-29/MD-PRIV-01. Integrator was notified to read `entries` and rerun. Until that regeneration, the claimed complete evidence mapping is incomplete despite complete ID mapping.
2. **Pending follow-request safe identity projection unused.** `supabaseService.social.listFollowRequests` initially embedded raw `user_profiles!follows_follower_id_fkey(display_name,avatar_url)`. The raw profile table's owner-only RLS prevents a recipient from resolving the requester's name/avatar. The database migration's safe `public_profiles` recipient policy cannot repair a caller that reads the wrong table. Requested two-step requester IDs + safe `public_profiles` lookup, retaining canonical IDs, plus focused regression. This is a concrete remaining source issue for PROFILE-01 until corrected.

## SQL/provider compatibility

TypeScript AST inspection matched **22 named-object calls** in the current Supabase service/repository against the four new migration function signatures: **zero unknown or missing required SQL argument names**. Reviewed publication/attempt-media/review-list, search/taste ranking, graph/follow decisions, deletion, merchant OCR/verification and exact-location contracts. Output aliases align with service mappings: publication camel-case receipt; reviews full rows/composite cursors; graph snake-case safe identity rows; metadata `path,metadata`; private notes `item_id,private_notes`.

Follow state changes use versioned locked RPCs, while direct unfollow DELETE remains permitted. Recommendation v2 uses hard budget/all dietary before limiting and soft canonical cuisines; review listing accepts recent/top_rated, preserves timestamp precision and canonical UUID ties. Private preference columns are absent from the safe public profile projection.

## Additional local role-matrix verification

The initial editor-coverage wording exceeded the original viewer-only collaborator fixture. Root authorized a targeted smoke update. `supabase/smoke/remediation_role_matrix.sql` now executes real editor protected-note/score mutation and public-note clearing; viewer read and rejected write; owner update and explicit protected-note clearing; approved follower followers-only list/item reads with private-note denial; stranger private/follower denial; blocked follower/public-share denial; and anonymous safe public projection with protected column/value absence. Executed on retained local `hungry_remediation_20261020_finalqa`, exit0, transaction `ROLLBACK`. Evidence: `database-role-matrix.log`. No migrations or application source changed during this QA.

## Correction readback

- Pending requester identities now query canonical follow IDs then safe `public_profiles`; raw profile embedding removed. Source correction reinspected.
- Merger recognizes the database `entries` key. Independent regenerated-JSON readback confirms exactly21 database evidence records, equal to the database result ID set, correctly attached to their own finding IDs. ID coverage remains exact187, with171 source_addressed and16 acceptance_pending; all implementation/integration paths resolve.

## Evidence limits and deployment boundary

- Database independent fixture QA passed separately, recorded in `QA-database.md` and `database-independent-fixture.log`. Fixture geography is deliberately stubbed and does not prove actual PostGIS/vector/storage or complete historical replay.
- Existing `final-tests.log` and `final-typecheck.log` contained earlier failures when inspected; they must not be described as passing. Root's final reruns are ongoing. Existing lint/format/Edge logs are separate proof and do not overwrite failed earlier history.
- Native QA records an initial identifiable mock iOS preflight and an observed manual-location keyboard defect, source repair and final-candidate retest requirement. It explicitly retains Android/assistive/offline/final-source acceptance; ledger acceptance_pending classifications correctly avoid claiming those complete.
- This reviewer performed only local reads/static compatibility checks during this ledger QA. Earlier database work used local isolated PostgreSQL fixtures only. **No hosted Supabase, production/staging database, storage, deployment, outbound message or provider mutation was performed.**

Verdict: **coverage and source-disposition evidence linkage pass**. Independent final readback confirms all187 audited IDs exactly once,21 database evidence records, corrected safe follow-request identity reads, and22 RPC calls with no missing required or unknown argument names. Root final test/typecheck/format reruns remain separately owned by the integrator/merchant QA; this ledger verdict does not promote pending gates into passing evidence. No claim of all187 release acceptance is supported.

Final fingerprint readback: snapshot `ea57857ed7d4098abde8be295255506d34c573ed516591dd88e30ba94cb1cac1` records651 files;650 match current bytes, while `src/app/screens/onboarding/TasteQuizScreen.tsx` changed after snapshot. Integrator notified to finalize that source and regenerate before claiming exact-candidate evidence. This does not invalidate ID/evidence linkage.

Release acceptance remains **blocked** by the explicitly retained native, hosted-service/storage/worker, concurrency, and full historical Supabase clean/upgrade replay requirements. No hosted changes were performed.

## Final independent closeout readback

Independent database/ledger reviewer confirms187 unique exact audit IDs,21 correctly linked supplemental database records,171 source-addressed and16 acceptance-pending dispositions. Final manifest654/654 file bytes match; compact sorted mapping SHA256 is `39a5bbe2f099d567c179fa95f3442d8e0cc03c58665f63e501cbff68c0d0a631`. Final test log804total/802pass/0fail/2existing skips agrees with canonical README, verification and remediation README. This supersedes earlier fingerprint-drift and ongoing-gate notes. Native post-candidate source differences, Android ENOSPC and real Supabase/replay/release limitations remain explicitly open. No further concrete source/evidence errors were found in this final bounded readback.
