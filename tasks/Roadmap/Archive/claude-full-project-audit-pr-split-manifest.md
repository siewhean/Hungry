# Full Audit V1 PR Split Manifest

Date: 2026-05-24  
Branch: `frontend-design-overhaul`  
Source: `git status --porcelain=v1 -z` on the current checkout

## Current Dirty Tree Shape

| group | file count | notes |
| --- | ---: | --- |
| CI/tooling/scripts | 22 | Workflow, Maestro smoke flows, package scripts/lockfile, Metro repair, asset/security/Supabase smoke scripts. |
| Docs/ledger | 18 | Current release evidence surfaces, task ledgers, release gates, and security docs. |
| Marketing web-v2 | 47 | Website copy, policy/account-deletion pages, SEO/LLM assets, and web visual sections. |
| Mobile app/source | 83 | Feature flags, navigation contracts, screens, stores, visual assets, and interaction fixes. |
| Supabase/backend | 25 | Migrations, manual owner-action docs, smoke SQL, Supabase service/tests, and live smoke scripts. |
| Root cleanup | 5 | Deleted legacy scratch/test files from the repo root. |

Total dirty entries: 200.

## Merge Rule

Do not merge `frontend-design-overhaul` into `main` as one PR. Land the work as a ladder from a fresh `origin/main`, preserving the current branch as the source branch. Each PR should use path-scoped staging and run the checks listed below before opening.

## PR 1 - Release Ledger, Tooling, CI Foundation, And Asset Gate Enablers

Purpose: make the release gates and CI reflect Full Audit V1 without pulling in feature behavior yet. This PR also carries the minimum asset-budget cleanup required for the asset gate to pass on a fresh `origin/main` branch. Edge Function hardening stays with the backend PR because it depends on later database/security objects.

Owns:
- `.github/workflows/ci.yml`
- `.maestro/ios-chat-smoke.yaml`
- `.maestro/ios-media-picker-permission.yaml`
- `metro.config.js`
- `package.json`
- `package-lock.json`
- `references/release-gates.md`
- `scripts/audit-assets.mjs`
- `scripts/generate-passport-assets.mjs`
- `scripts/metro-babel-transformer.cjs`
- `scripts/release_ready_checklist.sh`
- `scripts/run-maestro-smoke.mjs`
- `scripts/run-trufflehog.mjs`
- `scripts/supabase-neutral-audit.mjs`
- `scripts/trufflehog-exclude-paths.txt`
- `tasks/asset-provenance.md`
- `src/assets/discover/**`
- `src/assets/gamification/passport/**`

Verify:
- `bash -n scripts/release_ready_checklist.sh`
- `node --check scripts/run-maestro-smoke.mjs`
- `node --check scripts/run-trufflehog.mjs`
- `npm run audit:assets`
- `npm run security:trufflehog`
- `npm run audit:supabase:static`
- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run format:check`
- `git diff --check`

## PR 2 - Supabase Full Audit V1 Backend And Smokes

Purpose: land the applied backend controls, smoke scripts, release-hardening account deletion/auth/UGC contracts, and service contracts together.

Status: committed on split branch `codex/full-audit-v1-pr2-supabase` as `f582dd601` after PR 1 commit `e5a133978`.

Owns:
- `.github/workflows/ci.yml`
- `package.json`
- `references/release-gates.md`
- `scripts/release_ready_checklist.sh`
- `supabase/migrations/0028_data_import_provenance_foundation.sql`
- `supabase/migrations/0029_server_side_discovery_reads.sql`
- `supabase/migrations/0030_home_social_feed_reads.sql`
- `supabase/migrations/0031_location_directory_reads.sql`
- `supabase/migrations/0032_social_governance_feed_foundation.sql`
- `supabase/migrations/0033_social_governance_feed_foundation_fixes.sql`
- `supabase/migrations/0034_post_report_write_integrity.sql`
- `supabase/migrations/0035_merchant_organization_foundation.sql`
- `supabase/migrations/0036_merchant_change_requests.sql`
- `supabase/migrations/0037_merchant_change_request_helper_grants.sql`
- `supabase/migrations/0038_app_security_hardening.sql`
- `supabase/migrations/0039_merchant_portal_readiness.sql`
- `supabase/migrations/0040_release_hardening_account_deletion_merchant_rpcs.sql`
- `supabase/migrations/0041_full_audit_social_safety.sql`
- `supabase/migrations/0042_full_audit_gamification.sql`
- `supabase/migrations/20260522124728_security_advisor_rls_view_fixes.sql`
- `supabase/migrations/20260522131215_advisor_security_warning_hardening.sql`
- `supabase/migrations/20260522132749_advisor_public_profile_anon_grant_fix.sql`
- `supabase/migrations/20260522134703_advisor_rls_auto_enable_execute_fix.sql`
- `supabase/migrations/20260522134944_advisor_trigger_function_execute_fix.sql`
- `supabase/migrations/20260522135336_advisor_non_postgis_extension_schema_fix.sql`
- `supabase/migrations/20260522135654_advisor_postgis_rpc_grant_fix.sql`
- `supabase/migrations/20260522142004_advisor_private_rpc_wrappers.sql`
- `supabase/migrations/20260522160920_postgis_relocation_search_path_prep.sql`
- `supabase/migrations/20260524023000_chat_conversation_open_rpc.sql`
- `supabase/migrations/20260524024500_chat_open_conversation_private_wrapper.sql`
- `supabase/migrations/20260524031000_fix_upsert_stall_interaction_conflict.sql`
- `supabase/migrations/20260524032500_fix_upsert_stall_interaction_return_query.sql`
- `supabase/migrations/20260524041000_merchant_popular_visitor_pins.sql`
- `supabase/smoke/account_deletion_merchant_rpc_hardening.sql`
- `supabase/smoke/database_foundation.sql`
- `supabase/smoke/full_audit_v1_readiness.sql`
- `supabase/smoke/home_social_feed_reads.sql`
- `supabase/smoke/location_directory_reads.sql`
- `supabase/smoke/merchant_change_requests.sql`
- `supabase/smoke/merchant_organization_foundation.sql`
- `supabase/smoke/server_side_discovery_reads.sql`
- `supabase/smoke/social_governance_feed_foundation.sql`
- `supabase/manual/`
- `scripts/supabase-advisor-security-classifier.mjs`
- `scripts/supabase-chat-smoke.mjs`
- `scripts/supabase-full-audit-v1-smoke.mjs`
- `scripts/supabase-ocr-smoke.mjs`
- `scripts/supabase-social-gamification-smoke.mjs`
- `scripts/supabase-enable-leaked-password-protection.mjs`
- `scripts/check-edge-functions.mjs`
- `supabase/functions/ingest-menu-photo/index.ts`
- `supabase/functions/ops-dishes-draft/index.ts`
- `supabase/functions/process-account-deletions/index.ts`
- `marketing/web/app/account/delete/page.tsx`
- `marketing/website/web-v2/src/app/account/delete/page.tsx`
- `marketing/web/app/_components/footerData.ts`
- `marketing/website/web-v2/src/content/site.ts`
- `src/app/navigation/linking.ts`
- `src/app/screens/auth/**`
- `src/app/screens/home/ActivityPostDetailScreen.tsx`
- `src/app/screens/home/HomeFeedScreen.tsx`
- `src/app/screens/profile/SettingsScreen.tsx`
- `src/app/screens/profile/SocialPostDetailScreen.tsx`
- `src/components/social/ReviewCommentsSheet.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/FeedStateView.tsx`
- `src/constants/featureFlags.ts`
- `src/features/social/sharedStallPosts.ts`
- `src/hooks/useAppBootstrap.ts`
- `src/lib/analytics/**`
- `src/lib/security/**`
- `src/lib/services/mock/**`
- `src/lib/services/storyGalleryAssets.ts`
- `src/lib/services/supabase/`
- `src/lib/services/types.ts`
- `src/store/useFoodCredStore.ts`
- `src/store/useGamificationStore.ts`
- `src/store/useMissionStore.ts`
- `src/store/useProfileStore.ts`
- `src/store/useSessionStore.ts`
- `src/store/useStallInteractionStore.ts`
- `src/theme/index.tsx`
- `src/theme/tokens.ts`
- `src/types/domain.ts`

Verify:
- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run format:check`
- `npm run audit:supabase:static`
- `npm run check:edge-functions`
- `npm run security:gitleaks`
- `npm run security:trufflehog`
- `git diff --check`
- `git diff --cached --check`
- QA/QC subagent read-only audit

Live verification after merge to staging:
- `npm run audit:supabase:advisor-security`
- `npm run smoke:supabase-full-audit-v1`
- `npm run smoke:supabase-chat`
- `npm run smoke:supabase-social-gamification`
- `npm run smoke:ocr-staging`
- linked `supabase db push --dry-run`

## PR 3 - Canonical Food-Business Staging

Purpose: keep the large data-import foundation separate from app/social release work.

Status: committed on split branch `codex/full-audit-v1-pr3-canonical-staging` as `50a1f9f68` after PR 2 commit `f582dd601`.

Owns:
- `supabase/migrations/0043_canonical_food_business_staging.sql`
- `supabase/smoke/canonical_food_business_staging.sql`
- `scripts/stage_canonical_food_businesses.py`
- `scripts/supabase-apply-canonical-food-business-staging-chunks.mjs`
- `scripts/supabase-canonical-food-business-staging-smoke.mjs`
- `src/lib/services/supabase/canonical-food-business-staging.test.ts`
- `data/README.md`

Verify:
- `python3 -m py_compile scripts/stage_canonical_food_businesses.py`
- `node --check scripts/supabase-apply-canonical-food-business-staging-chunks.mjs`
- `node --check scripts/supabase-canonical-food-business-staging-smoke.mjs`
- focused canonical staging tests
- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run format:check`
- `npm run smoke:supabase-canonical-food-business-staging`
- `npm run audit:supabase:static`
- `npm run security:gitleaks`
- `npm run security:trufflehog`
- `git diff --check`
- `git diff --cached --check`

## PR 4 - Mobile Full Audit V1 Feature Surfaces

Purpose: land user-facing app changes after backend contracts are present.

Status: committed on split branch `codex/full-audit-v1-pr4-mobile-surfaces` as `7d9d6f3bd` after PR 3 commit `50a1f9f68`. This is a stacked PR; review the PR4 delta against `codex/full-audit-v1-pr3-canonical-staging`, not directly against `main`.

Owns:
- `src/constants/featureFlags.ts`
- `src/constants/featureFlags.test.ts`
- `src/constants/visualAssetColors.ts`
- `.maestro/ios-chat-smoke.yaml`
- `src/app/navigation/route-production-readiness.test.ts`
- `src/app/screens/**`
- `src/components/**`
- `src/features/**`
- `src/hooks/useAppBootstrap.ts`
- `src/lib/services/mock/**`
- `src/lib/services/dataTrustDisclosure.ts`
- `src/lib/services/storyGalleryAssets.ts`
- `src/lib/services/types.ts`
- `src/store/**`
- `src/theme/tokens.ts`
- `src/types/domain.ts`
- `src/test/sourceContracts.ts`
- `tests/e2e/merchant-catalog.spec.ts`

Verify:
- focused route/native/story/merchant/full-audit contracts
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npm run smoke:native:ios:prepared`
- `npm run security:gitleaks`
- `npm run security:trufflehog`
- `git diff --check`
- `git diff --cached --check`
- QA/QC subagent read-only audit

## PR 5 - Marketing Web V2 And Store Policy Pages

Purpose: land public privacy/account-deletion/terms and marketing SEO work separately from the mobile app.

Status: committed on split branch `codex/full-audit-v1-pr5-marketing-web` as `748829797` after PR 4 commit `7d9d6f3bd`. This is a stacked PR; review the PR5 delta against `codex/full-audit-v1-pr4-mobile-surfaces`, not directly against `main`.

Owns:
- `marketing/website/web-v2/**`

Verify:
- web-v2 `npm run lint`
- web-v2 `npm run seo:audit`
- web-v2 `npm run build:webpack`
- local route smoke for `/`, `/for-foodies`, `/for-merchants`, `/join-waitlist`, `/privacy`, `/terms`, `/account/delete`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`
- `git diff --check -- marketing/website/web-v2`
- `git diff --cached --check`
- `npm run security:gitleaks`
- `npm run security:trufflehog`
- QA/QC subagent read-only audit

External proof still required:
- final public privacy URL
- final public account-deletion URL
- App Store Connect privacy metadata
- Google Play Data Safety and account-deletion form answers

## PR 6 - Active Docs And Audit Ledgers

Purpose: land the current evidence ledger after the implementation PRs it references are merged.

Status: committed on split branch `codex/full-audit-v1-pr6-docs-ledgers` as `d4fc2cdd0` after PR 5 commit `748829797`. This is a stacked PR; review the PR6 delta against `codex/full-audit-v1-pr5-marketing-web`, not directly against `main`.

Owns:
- `README.md`
- `AGENTS.md`
- `SECURITY.md`
- `tasks/backlog.md`
- `tasks/environment.md`
- `tasks/verification.md`
- `tasks/session-log.md`
- `tasks/store-submission-checklists.md`
- `tasks/data-contracts.md`
- `tasks/screens.md`
- `tasks/todo.md`
- `tasks/lessons.md`
- `tasks/Roadmap/claude-full-project-audit.md`
- `tasks/Roadmap/claude-full-project-audit-implementation-status.md`
- `tasks/Roadmap/claude-full-project-audit-pr-split-manifest.md`
- `tasks/Roadmap/Frontend/frontend-design-overhaul-batched-implementation-plan.md`

Verify:
- table sanity check for Markdown ledgers
- `git diff --check`
- `git diff --cached --check`
- `npm run security:gitleaks`
- `npm run security:trufflehog`
- QA/QC subagent read-only audit

## PR 7 - Root Scratch Cleanup

Purpose: remove legacy scratch files only after implementation/test PRs are stable, and land the tracked docs secret redactions surfaced by the final PR7 QA scan.

Status: committed on split branch `codex/full-audit-v1-pr7-root-cleanup` as `fed2f5b5d` and follow-up tracked docs secret redaction `3cad5775e` after PR 6 commit `d4fc2cdd0`. This is a stacked PR; review the PR7 delta against `codex/full-audit-v1-pr6-docs-ledgers`, not directly against `main`.

Owns deletions:
- `test-geocode.ts`
- `testResults_20260417_141538.json`
- `test_jwt.js`
- `test_service_role.ts`
- `test_trigger.ts`

Owns tracked secret redactions:
- `design/archive/figma-concept/README.md`
- `tasks/Roadmap/production-infrastructure.md`
- `tasks/Roadmap/state_of_the_union.md`

Verify:
- `git ls-files 'test*'`
- `npm run test`
- `git diff --check`
- `git diff --cached --check`
- `npm run security:gitleaks`
- full-tree `/opt/homebrew/bin/gitleaks detect --no-git --redact --source . --verbose` in the clean PR7 worktree
- `npm run security:trufflehog`
- QA/QC subagent read-only audit

## Remaining No-Go Gates After PR Split

- Android/EAS build or device smoke proof.
- Production secret verification for EAS/store release environments.
- Final public privacy/account-deletion URL reachability and store-console metadata.
- Supabase leaked-password protection and remaining PostGIS-owned Advisor findings.
