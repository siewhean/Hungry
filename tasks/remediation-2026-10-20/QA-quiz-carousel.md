# Quiz carousel restoration follow-up

Browser reproduction supplied by independent QA: Local cuisine → Sweet-forward → Next (spicy) → reload → normal Get started flow → Local retained → Next resumes spicy → Back displayed Light / no selected card. Stored sweet value was8 in the captured draft. Evidence directory: `browser/quiz-resume-draft-snapshots.json` and browser QA screenshots.

Confirmed source hazards in TasteQuizScreen:

- `onMomentumScrollEnd` treated programmatic restoration/layout scrolls as answers and wrote values/answeredKeys unconditionally.
- Separate snappedIndex state could diverge from the persisted question value during restoration and step transitions.

Remediation: the list remounts by question key and starts at the saved `initialScrollIndex`; selected state derives from `values[currentKey]`; explicit card presses commit directly. Only a drag begun on the current question can commit drag/momentum end. Step transitions, relayout, restoration and explicit card presses cancel old gesture identity. A late event from another question cannot change its answer. Browser follow-up run5 retained sweet8 but measured the saved card512px outside the viewport. The FlatList overflow-visible style overrode RNWeb scrolling; removing that override restores default ScrollView overflow behavior while preserving the outer animation container. No separate BipolarCarousel component exists in this checkout; the rendered component is Animated.FlatList inside TasteQuizScreen.

Verification:21 focused tests passed (new3 carousel-event regressions,4 atomic-finish regressions and existing14 screen contracts); scoped ESLint0 errors/0 warnings. Output `quiz-carousel-focused.log`. The larger run additionally exposed an existing auth-hydration test timing issue (`finish is not a function` in remediation-onboarding.test.ts); integrator owns correction while preserving its stale-response assertion.

Browser QA found RNWeb omits aria-selected attributes globally; its rerun will assert stored sweet8 and actual saved-card horizontal centering, with a screenshot. Independent browser run6 passed the exact normal-entry reload flow, retained stored sweet8 and measured Sweet-forward centered within20px. Screenshot: `browser/onboarding-selection-and-quiz-answer-resume-after-a-browser-reload.png`. Native-device carousel acceptance remains a separate gate.
