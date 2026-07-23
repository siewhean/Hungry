# Hungry Release 0.1 — Week 1 and Week 2 Completion Report

Final commit SHA:  
Report date:  
Prepared by:  
Verdict: **No-Go / Go Candidate / Week 1–2 Complete**

## 1. Branch and integration

| Check | Result | Evidence |
|---|---:|---|
| PR #44 updated against latest `main` |  |  |
| PR mergeable |  |  |
| PR #43 catalog work preserved |  |  |
| Worktree clean |  |  |

## 2. Automated checks

| Command | Result | Key output/link |
|---|---:|---|
| `npm ci` |  |  |
| `npm run typecheck` |  |  |
| `npm run lint` |  |  |
| `npm run format:check` |  |  |
| `npm run audit:assets` |  |  |
| `node scripts/audit-release-01-catalog.mjs` |  |  |
| `npm run test` |  |  |
| `npm run test:e2e` |  |  |
| `npm run test:e2e:merchant-catalog` |  |  |
| `npx expo-doctor --non-interactive` |  |  |
| `npm run audit:supabase:static` |  |  |
| `npm run check:edge-functions` |  |  |
| `npm run security:audit` |  |  |
| `npm run security:gitleaks` |  |  |
| `npm run security:trufflehog` |  |  |
| `npm run release:ready:local` |  |  |
| `git diff --check` |  |  |

## 3. Staging Supabase

| Check | Result | Evidence |
|---|---:|---|
| Security Advisor non-password gate |  |  |
| Canonical food-business staging smoke |  |  |
| Full audit V1 smoke |  |  |
| Location queries |  |  |
| Search queries |  |  |
| RLS smoke |  |  |
| Raw catalog smoke |  |  |
| Active release ID and totals |  |  |

Skipped credential-gated checks must be recorded as blocked, not passed.

## 4. Jurong East pilot

| Metric | Result | Threshold | Pass |
|---|---:|---:|---:|
| Venues |  | 10 |  |
| Dishes |  | 20 |  |
| Image-backed venues |  | 5 |  |
| Image-backed dishes |  | 10 |  |
| Coordinate coverage |  | 95% |  |
| Blocked image URLs |  | 0 |  |

Pilot manifest path/link:  
Audit JSON path/link:  

## 5. Data-source behavior

| Scenario | Expected | Result | Evidence |
|---|---|---:|---|
| Healthy Supabase | Supabase source |  |  |
| Authenticated catalog network/RPC failure | Excel read-only fallback |  |  |
| Signed out | Auth only; no Excel |  |  |
| Invalid/revoked session | Clear state; auth only |  |  |
| Missing released config | Blocking configuration state |  |  |
| Legitimate no-results | Empty state; no fallback substitution |  |  |
| Write unavailable | Clear failure/retry; no false success |  |  |

## 6. Paging and source continuity

| Surface/source | Pages tested | Duplicate IDs | Release/source retained | Result |
|---|---:|---:|---:|---:|
| Supabase dishes |  |  |  |  |
| Supabase stalls |  |  |  |  |
| Excel dishes |  |  |  |  |
| Excel stalls |  |  |  |  |
| Dish detail | n/a | n/a |  |  |
| Stall detail/menu | n/a | n/a |  |  |

## 7. Image behavior

| Surface | Approved menu image | Venue/logo priority | Blocked hosts absent | Failure fallback | Result |
|---|---:|---:|---:|---:|---:|
| Discover |  |  |  |  |  |
| Browse Dishes |  | n/a |  |  |  |
| Browse Stalls | n/a |  |  |  |  |
| Search |  |  |  |  |  |
| Dish detail |  | n/a |  |  |  |
| Stall detail/menu |  |  |  |  |  |

## 8. Native build and QA

### iOS

Build ID/artifact:  
Device/simulator and OS:  

| Scenario | Result | Evidence |
|---|---:|---|
| Fresh install/onboarding/mandatory auth |  |  |
| Valid session restore/sign-out |  |  |
| Healthy catalog |  |  |
| Authenticated Excel fallback |  |  |
| Signed-out outage denial |  |  |
| Invalid-session denial |  |  |
| Missing configuration block |  |  |
| No-results |  |  |
| Large text/dark mode/VoiceOver smoke |  |  |

### Android

Build ID/artifact:  
Device/emulator and OS:  

| Scenario | Result | Evidence |
|---|---:|---|
| Fresh install/onboarding/mandatory auth |  |  |
| Valid session restore/sign-out |  |  |
| Healthy catalog |  |  |
| Authenticated Excel fallback |  |  |
| Signed-out outage denial |  |  |
| Invalid-session denial |  |  |
| Missing configuration block |  |  |
| No-results |  |  |
| Large text/dark mode/TalkBack smoke |  |  |

## 9. Internal testers

| Tester | Platform | Build | Primary journey completed | Issues |
|---|---|---|---:|---|
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

Do not include passwords.

## 10. Issues resolved

| ID | Severity | Problem | Fix | Verification |
|---|---|---|---|---|
|  |  |  |  |  |

## 11. Remaining blockers

| Blocker | Owner | Code/external | Required action | Target date |
|---|---|---|---|---|
|  |  |  |  |  |

## 12. Final decision

Week 1 and Week 2 are complete only when every P0 row is passed on the final commit, staging and native evidence are attached, and five internal testers can complete the core journey.

Final verdict and rationale:
