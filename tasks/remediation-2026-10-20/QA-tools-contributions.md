# Independent saved-tools and contributions QA

Reviewer: discovery/maps specialist, independently inspecting the saved-tools and contributions workers' final source and focused behavioral checks.

## Checks

- Saved tools: `saved-tools-remediation.test.ts`, `checklist-portfolio-store.test.ts`, `mock/service-methods.test.ts`: **52 passed, 0 failed**, including final collection-race regressions. Evidence: `qa-saved-focused-tests.log`.
- Discovery/details canonical report IDs, failed-gallery source indexes, account draft storage and draft selection: targeted behavioral run recorded in `qa-contributions-focused-tests.log`.
- Assigned discovery/catalog/detail/header contracts updated to approved behavior, plus failed-gallery behavior tests: **21 passed, 0 failed**. Evidence: `discovery-contract-tests.log`.
- Recommendation budget/review exclusion before limit, account-change rejection, dietary/search/discover/source policy/RPC contracts: **25 passed, 0 failed**. Evidence: `discovery-focused-tests.log`.
- Scoped ESLint passed. Test terminal output contains the existing Node `module.register()` deprecation notice; no test failures in the passing logs.

## Findings and repairs

1. **Wheel interrupted animation lost its result screen.** A reduced-motion change or animation interruption called central `finishSpin`, then returned without navigation. Saved-tools owner added a result observer keyed by party/start/winner and limited Spin to lobby state. Reinspected: animation only presents the centrally resolved winner; the observer handles completion and interruption.
2. **Collection refresh could overwrite a confirmed same-account save.** The account generation guard did not distinguish a load started before a save. Saved-tools owner added latest-load request IDs and a confirmed-save mutation revision; a load crossing a save refetches both authoritative snapshots. Independent rerun passes deferred load/save, reverse-order concurrent load and failed-save regressions.
3. **Native-stack route removal protection was incomplete.** Review had no removal guard and composer used `beforeRemove`. Contributions owner added shared `useDraftExitGuard` based on `usePreventRemove`, dispatching only after the controlled bypass renders; it re-arms after dispatch.
4. **Review picker fetched the full building/venue catalogue.** Replaced by bounded asynchronous `searchVenuesByLocation` with current query/location, limit 30 and stale-response rejection. Reinspected source: explicit dish selection remains required.
5. **Dish-only route intent could silently retain the previous draft's dish.** Owner now resolves the routed dish's canonical venue, confirms conflicting draft changes and disables publishing while intent loads.
6. **Private media picker could complete into a subsequent account's draft.** Owner added generation checks around asynchronous gallery operations; old completions cannot append media after transition.
7. **Messaging handoff failures still emitted successful share analytics.** Owner changed the common share helper to honor the boolean handoff result. System cancellation remains distinct.
8. **Stall sharing announced a dish.** The share sheet now supports the stall subject; StallDetail explicitly selects it. Dish/review sharing remains dish-labelled.
9. **Derived stall review IDs were unsuitable for moderation.** Detail transform previously prefixed the dish ID to the canonical review ID. Reviewer repaired it to preserve `review.id`, with behavioral assertions for canonical report identity, author identity and honest avatar metadata.
10. **Stall save metric was lost during correct venue-save conversion.** Reviewer restored the event only after a confirmed new save, never on unsave or failure; a telemetry failure does not misrepresent a successful save as failed.

## Native evidence boundary

Read-only inventory found two booted available iPhone 17 Pro simulators (iOS 27.0 and iOS 26.5). `adb devices -l` returned no attached Android target. This independent pass did not build, install or exercise a candidate and cannot certify simulator runtime, VoiceOver/TalkBack, large text, keyboard, picker permissions, reduced motion or offline overlap. Root owns identifiable candidate builds and native acceptance. No device release proof is inferred from source or tests.

## Final follow-up

All independently identified source defects above were repaired and reinspected. Final saved-tools behavioral rerun: 52 passed, 0 failed. Contributions owner additionally reports 14 passed, 0 failed for guarded navigation/media/sharing follow-ups. No additional confirmed source defect remains from this bounded independent pass. Native acceptance remains open as stated above.
