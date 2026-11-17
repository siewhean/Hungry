# Budget discovery and lunch shortlist — 13 November 2026

Task: `DISCOVERY-BUDGET-LUNCH-20261113`. User selected market-research recommendations #2 and #3. Changes remain local; no deployment or migration was performed.

## Implemented

- Budget discovery: selectable inclusive S$5/S$8/S$10 maxima, stricter saved profile cap retained, invalid limits fail closed. Production search receives the cap before ranking. Response guards reject unsupported prices and out-of-radius distances. Fresh search prices/distances survive mapping without stale cache substitution. Unknown distance is hidden rather than shown as zero.
- Lunch shortlist: existing hero plus two distinct alternatives, budget/radius controls, explicit GPS/manual-location requirement, hard price/dietary/distance checks, budget passed before candidate limit, retry/empty/loading controls retained. Try another never silently expands radius.
- Both routes use listed item prices. They do not establish a complete meal, portion, dine-in price, current availability, walking route, queue/preparation duration, or verified catalogue accuracy.
- Design sources: `design/figma-v2/discover-search.html`, Stitch briefs sections 11–12 and bounded addenda `design/budget-discovery-2026-11-13.md`, `design/lunch-shortlist-2026-11-13.md`.

## Evidence

- Final focused/service regression run: 44 tests passed, zero failed/skipped; `/tmp/hungry-budget-lunch-final-tests.log`.
- TypeScript: latest implementation agent run passed, root check passed; `/tmp/hungry-budget-lunch-typecheck.log`.
- Prettier scoped check passed; scoped `git diff --check` passed.
- Independent QA: 20 focused tests passed; stale-cache price and false-zero-distance findings resolved; `/tmp/hungry-budget-lunch-independent-final-qc.log`.
- Browser/native acceptance: being completed in this session; see final verification entry.

## Release acceptance and recovery

1. Run the exact changed artifact in staging with an authenticated test account and GPS/manual selected coordinate. Verify deployed `search_dishes_v2` and `get_taste_recommendations_v2` support max-price/radius arguments; existing migration `20261020132429_remediation_search.sql` applies price constraints before final limit. Local source tests are not proof of deployed database state.
2. Use branch-specific, source-backed catalogue examples around each price boundary (5/8/10 and stricter profile), plus zero/unknown prices, dietary mismatch, no-results and location denied. Verify every returned item respects all retained constraints; no mock fallback or fabricated factual fields.
3. Complete native/device interaction and visual checks against both design addenda on the exact release candidate. Browser mock tests cannot substitute for live-service/device acceptance.
4. Only then classify this feature slice for release. Existing app-wide release holds are unchanged. No app-store submission requested.
5. Recovery: restore only this task's reviewed hunks/new files from the pre-change version; preserve unrelated dirty work. No schema rollback is needed. Price and dietary evidence holds must remain in force.
