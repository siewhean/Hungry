# Final independent integration QA

Reviewer: merchant/Edge worker, reading other workers' shared contracts and consumer code. Scope: settings consumers, account-transition cleanup/persistence, haptics, and review publication. Source inspection and focused regressions are distinguished from native, hosted, or production proof.

## Findings from this QA pass

1. **Search-history opt-out still retained raw search queries in profile taste history/analytics/backend**: `SearchResultsScreen.recordBrowseSearchQuery` invokes `useProfileStore.recordTasteInteraction` with `search_query` and raw query; boundary lacked `allowSearchHistory` guard. Fixed by root at the profile boundary before retention or backend/analytics dispatch. Independent preferencesConsumers.qa regressions confirm both search and profile consumers honor the opt-out.
2. **Chat drafts remained in one global persistence entry and were erased on transition**: fixed by home-social worker using accountDraftPersistence with separate owner partitions;2behavioral tests pass for A/logout/B/restore. Root session lifecycle now invokes account scope changes.
3. **Home double-tap native haptics bypassed preference**: fixed by home-social worker with current preference check and lazy shared wrapper, which rechecks at action time. Social-store dynamic import also now uses the shared wrapper to cover the async import race. No native tactile behavior claimed.
4. **Clear search history also erased current query and all filters**: fixed by profile-settings worker to call `clearHistory`, retaining active search intent and other user data.
5. **Home privacy could be disabled through category relabelling**: database worker confirmed and fixed with durable private residential classification/last privacy surviving business category changes and outlet deletion. Added direct negative category-change SQL regression; fresh smoke pass reported by database worker. This reviewer did not rerun the SQL environment.
6. **Stall saved metric was lost when save moved into the store**: discovery worker restored it only after an authoritative successful new save; unsave/failure emits none. Strict source assertion retained; merchant focused contract batch passes.

## Checks and inspected boundaries

- Merchant source/contracts/behavioral batch: **43 passed, 0 failed**, `merchant-final-tests.log`.
- Merchant operation scope and reply ownership independently rechecked by saved-tools worker: no new bounded source blocker; `QA-social-merchant.md`.
- Review publication independent focused batch: **13 passed, 0 failed**, `qa-publication-tests.log`; detailed source conclusions in `QA-review-publication.md`.
- Actual Deno compilation: all **8** deployable Edge entrypoints and imported shared modules pass `npm run check:edge-types`.
- Signed webhook regressions: **4 passed** through exported handler with provider fetch stubbed; no emails sent. Existing Edge static check passes.
- Independent settings preference regressions: **2 passed, 0 failed**, `src/store/preferencesConsumers.qa.test.ts` (history opt-out and precise history clearing).
- Shared haptic wrapper reads current device preference and suppresses native failures. Static imports use it; remaining lazy native imports reviewed above.
- Session transition central cleanup advances account generation and resets private stores, subscriptions, transient overlays, service catalogs, and export temporary files. Personal store persistence uses explicit account metadata and generation guard; profile cache verifies restored subject. Discovery persistence stores only map filters; raw catalog cache keys include account generation.
- Onboarding persistence now uses owner partitions, serialized targeted writes/removals, explicit guest adoption/retirement and late hydration/edit/generation guards;11focused storage/onboarding regressions pass. Root awaits scoped hydration before pending-save completion.

## Final integration gates

- `npm run lint`: final restart exits0, no diagnostics (`final-lint.log`).
- `npm run format:check`: final restart exits0; all matched source files use Prettier (`final-format.log`). One subsequent Sprint9 test-only assertion correction had17focused tests pass and its owning worker reports Prettier unchanged; no product code changed after these gates.
- `npm run typecheck`: final restart exits0 after auth receipt/session hydration/bootstrap and fixture corrections; no diagnostics (`final-typecheck.log`).
- Final merchant unsupported-control cleanup:24focused contract tests pass (`merchant-last-copy-tests.log`); removed AI notification toggle and QR ordering pilot promotion, and retained truthful recorded summary.

Browser runtime validation exposed bootstrap/mock-auth, sign-out hydration reset, fixture links, and carousel/restore interaction corrections. Those source corrections are now integrated and the independent TypeScript/lint/format restart passes with actual exit0 results. No unresolved bounded source blocker remains from this pass. The remediation ledger retains the external evidence requirements below.

## Remaining proof

 Native worker reports bounded iOS keyboard proof on its tested candidate; this is not acceptance of every journey or subsequent source change. Android build/candidate validation is blocked by ENOSPC, with no further builds authorized in the current pass. VoiceOver/TalkBack, physical haptics, signed-storage/provider acknowledgements, hosted RPCs, real permissions/offline journeys, and final identifiable cross-platform candidate acceptance remain separately unverified. No source/unit result is a release or deployment approval.

Final integrator suite readback: `final-tests.log` exits0,804 total/802pass/0fail/2existing skips. Browser6core+4composer pass. Final native candidate limitations and post-candidate source delta are explicit in QA-native.md.
