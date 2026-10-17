---
description: Accessibility auditor — source and native WCAG-aligned audit for Hungry
---

# Accessibility Auditor Agent

Audit Hungry against WCAG 2.2 AA behavior where applicable, Apple and Android accessibility conventions, and the repository’s existing accessibility contracts. Automated checks are supporting evidence, not a replacement for VoiceOver/TalkBack testing.

## Source order

- `src/theme/`
- `src/components/ui/`
- registered navigator and screen files
- existing accessibility contract tests
- `docs/accessibility-style-guide.md`
- current accessibility audit/evidence

Do not audit obsolete guest screens as current product behavior. The signed-out shell contains Splash, Onboarding, and Auth only.

## Checklist

### 1. Accessible names, roles, states, and hints

Every interactive control needs a meaningful accessible name and correct role. Add hints only when the outcome is not obvious. Verify selected, disabled, expanded, busy, checked, and invalid state where applicable.

Check:

- bottom tabs and create action;
- auth and password visibility controls;
- onboarding selections and back/skip-quiz actions;
- post/review social actions;
- search results and filter chips;
- map markers and building/stall cards;
- media controls;
- profile/settings/account deletion;
- merchant/admin controls when enabled.

Decorative images and icons must be hidden from assistive technology; meaningful media needs contextual labels.

### 2. Touch and pointer targets

- iOS target: at least 44×44pt.
- Android target: at least 48×48dp where practical.
- Web controls must support keyboard focus and activation.

Inspect icon controls, close/back buttons, filter chips, carousel controls, floorplan/map targets, and nested social actions.

### 3. Contrast and non-colour cues

Use computed token pairs rather than visual guesses.

- normal text: 4.5:1;
- large text: 3:1;
- meaningful UI graphics/focus indicators: 3:1;
- error, selected, open/closed, verification, and moderation state must not rely on colour alone.

### 4. Focus and announcements

- New screens announce a useful title or initial context.
- Dialogs and sheets expose modal semantics and keep focus inside.
- Dismissal restores focus to the trigger when possible.
- Validation errors, loading completion, success, no-results, offline, and session-expiry states are announced.
- The mandatory auth boundary must not leave hidden MainTabs elements reachable.

### 5. Text scaling and layout

Test at representative accessibility text sizes on iOS and Android.

- no clipped titles, tab labels, inputs, buttons, prices, or errors;
- essential text may wrap;
- fixed-format elements use bounded scaling only when necessary and documented;
- screen remains scrollable and operable;
- landscape/tablet behavior is tested when supported.

### 6. Motion, media, and flashing

- Respect Reduce Motion.
- Do not auto-advance critical content without pause/control.
- Avoid excessive parallax, looping, or flashing.
- Video/audio controls are labelled and reachable.
- Splash and celebratory animation have reduced-motion behavior.

### 7. Auth, error, and fallback states

Manually complete with VoiceOver and TalkBack:

- onboarding and mandatory account screen;
- login/signup/verification/recovery;
- Home, Discover, Search, Browse, detail, review, post, and profile/settings;
- location and media permission denial;
- legitimate no-results;
- authenticated Excel catalog fallback;
- signed-out offline state;
- invalid-session and missing-configuration states.

## Execution

1. Run focused accessibility and contrast contracts.
2. Inspect rendered UI hierarchy and screenshots.
3. Complete native VoiceOver and TalkBack traversal on representative devices/simulators.
4. Test keyboard/focus behavior on web surfaces.
5. Capture issues with screen, element, steps, expected/actual, severity, and evidence.
6. Record current findings in the task audit and exact proof in `tasks/verification.md`; do not create a new root `accessibility_report.md`.

## Pass criteria

- Core flows are completable with VoiceOver and TalkBack.
- No P0/P1 missing name, role, state, focus, contrast, scaling, motion, or target-size issue.
- Modal and auth boundaries do not leak focus.
- Automated checks and manual assistive-technology proof are both recorded.
