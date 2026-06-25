# Hungry Multi-Agent Page QA/QC Loop Plan

## Scope

Core app pages under this loop:

| Page | Primary surface | Automated path |
| --- | --- | --- |
| Home Feed | Home social feed and card actions | `tests/e2e/home-feed.agent.spec.ts` |
| Discovery | Discover rails, search entry, dish and stall navigation | `tests/e2e/discovery.agent.spec.ts` |
| Review | Review feed and QuickRate composer | `tests/e2e/review.agent.spec.ts` |
| Post | Post Composer V2 baseline, validation, publish, feed visibility | `tests/e2e/post.agent.spec.ts` |
| Profile | Profile home, settings, account actions | `tests/e2e/profile.agent.spec.ts` |

## Loop Model

Each page uses the same bounded cycle:

| Cycle | Purpose | Output |
| --- | --- | --- |
| 0 | Baseline render and inventory | screenshot evidence, button inventory, crash/broken-image/network checks |
| 1 | P0/P1 functionality and navigation fixes | focused code or test fixes |
| 2 | UI, accessibility, and performance polish | only if baseline finds issues |
| 3 | Final verification | page report and Go/No-Go status |

## Automation

- Shared helper: `tests/e2e/helpers/pageAgent.ts`
- Primary verification: Expo web Playwright on Chromium.
- Mobile coverage: existing mobile smoke specs or native smoke, not these page-agent specs.
- Static contracts:
  - `tests/e2e/app-feature-flags-production.spec.ts`
  - `tests/e2e/app-prefetch-contracts.spec.ts`

## Agents Used

| Agent | Role | Scope |
| --- | --- | --- |
| Lagrange | Explorer | Home Feed and Post Composer selectors, happy paths, and P0 risks |
| Gauss | Explorer | Discovery, Search, Dish Detail, Stall Detail selectors and routing |
| McClintock | Explorer | Review and Profile selectors, protected routes, account actions |
| Final QA/QC | Verifier | Reports, terminal output, test evidence, unresolved blockers |

## Completion Criteria

A page is complete only when:

- Chromium page-agent coverage passes.
- No unresolved P0/P1 issue is recorded.
- Broken image, visible crash, missing dish/stall data, and document/fetch/xhr 5xx checks pass.
- Protected routes redirect to auth where required.
- External blockers are recorded instead of being hidden.

