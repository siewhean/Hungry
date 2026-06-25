# Home Feed Page-Agent Report

## Result

Grade: A-

Status: repo-local Playwright coverage complete; native guest browse proof passed; production release proof pending.

## Coverage

| Scenario | Status |
| --- | --- |
| Guest normal-app entry reaches Login instead of private Home | Pass |
| Authenticated mock session opens Home | Pass |
| `home-social-feed` renders populated feed content | Pass |
| Save toggles to Unsave | Pass |
| Like toggles to Unlike | Pass |
| Author profile navigation opens a profile surface | Pass |
| Broken image check | Pass |
| Missing dish/stall data check | Pass |
| Document/fetch/xhr 5xx check | Pass |

## Evidence

Spec: `tests/e2e/home-feed.agent.spec.ts`

Focused command: `npx playwright test tests/e2e/home-feed.agent.spec.ts --project=chromium --reporter=line`

Included in refreshed full page-agent pass: `E2E_PORT=8099 npx playwright test tests/e2e/home-feed.agent.spec.ts tests/e2e/discovery.agent.spec.ts tests/e2e/review.agent.spec.ts tests/e2e/post.agent.spec.ts tests/e2e/profile.agent.spec.ts --project=chromium --reporter=line` -> Pass, 11/11.

Native smoke evidence: `HUNGRY_NATIVE_SMOKE_METRO_URL=http://localhost:8081 node scripts/prepare-maestro-smoke.mjs ios-guest` -> Pass; Home visible, Discover tab reachable.

## Blockers

- Full multi-flow native suite remains blocked by Maestro/XCUITest driver flakiness after app launch; direct iOS guest flow passes.
- Cross-device Android installed-app proof still requires a working Maestro/Android environment or EAS artifact install.
