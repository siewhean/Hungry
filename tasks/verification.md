# Hungry Verification

> Current verification bundle evidence.
> Update this file for the latest known-good state.

## Standard Bundle

1. `npm run typecheck`
2. `npm test -- --runInBand`
3. `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor`

## Latest Known Good

| date | scope | command | result | notes |
|---|---|---|---|---|
| 2026-04-23 | app | `npm run typecheck` | Pass | Recorded in `tasks/todo.md` Sprint 11 gate |
| 2026-04-23 | app | `npm run test -- --runInBand` | Pass | Current suite green after follow-up fixes |
| 2026-04-23 | app | `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor` | Pass | Requires writable npm cache path |
| 2026-04-23 | marketing/web | `npm run lint` | Pass | From `marketing/web/` |
| 2026-04-23 | marketing/web | `npm run build` | Pass | Routes `/`, `/for-merchants`, `/about`, `/privacy`, `/api/waitlist` |

## Outstanding Verification

| id | scope | required proof | owner |
|---|---|---|---|
| OCR-DG-01 | Sprint 10 OCR | Staging photo upload to `dishes_draft` within 30s | Codex |
| OCR-DG-02 | Claim CTA | Staging row insert + analytics event | Codex |
| OCR-DG-03 | Test environment | Full `npm test` in stable runtime/tooling environment | Codex |
| OCR-DG-04 | Feature flags | Confirm staging/prod values for `merchantClaimCtaEnabled` | Codex |
| WEB-11 | Marketing deploy | Preview + production deploy evidence | Codex + User |

