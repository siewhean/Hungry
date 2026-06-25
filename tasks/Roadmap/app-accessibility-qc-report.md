# Hungry App Accessibility QC Report

Updated: 2026-06-25
Verdict: **Partial**. Source contracts and accessible labels exist in key flows; reduce-motion support present in PassportScreen and search placeholder. Public launch requires manual iOS VoiceOver and Android TalkBack proof.

## Source Checks

| Area | Expected | Status |
|---|---|---|
| Tabs/buttons | meaningful labels/testIDs | source coverage present ✅ |
| Search and media controls | accessible labels | source coverage present ✅ |
| Error/empty states | text not icon-only | partial source coverage |
| Modals/sheets | labels, focus-safe behavior | key sheets covered ✅ |
| Media picker denial | user-visible permission fallback | source/native smoke contract ✅ |
| Reduce motion | `AccessibilityInfo.isReduceMotionEnabled()` | PassportScreen and useMovingSearchPlaceholder ✅; 22 Reanimated animations not yet gated — pre-launch hardening item |
| Text scaling | no full runtime proof | pending |
| Color contrast | design-token dependent; WCAG AA pass documented | source-tested via `accessibility-contrast.test.ts` ✅ |
| Interactive element labels | `accessibilityLabel`/`accessibilityRole` | 933 Pressable usages; coverage partial — pre-launch improvement item |
| Screen reader flows | onboarding, login, search, detail, save, review, post, settings | pending manual proof |

## WCAG Contract Coverage

- `accessibility-contrast.test.ts`: all Hungry theme text pairs meet WCAG AA contrast ✅
- `accessibility-primitives-contracts.test.ts`: a11y primitive contracts pass ✅
- `accessible-image-contracts.test.ts`: image accessibility contracts pass ✅

## Reduce Motion Gap

22 `withTiming`/`withSpring`/`withRepeat` calls found in animation code without `isReduceMotionEnabled` checks. Only `PassportScreen` and `useMovingSearchPlaceholder` correctly gate animations.

**Pre-launch hardening:** Create a shared `useReduceMotion()` hook and apply to all decorative animation invocations.

## Manual Smoke Required

| Scenario | iOS VoiceOver | Android TalkBack | Result |
|---|---:|---:|---|
| Onboarding to location selection | pending | pending | No-Go until tested |
| Login/signup/password reset | pending | pending | No-Go until tested |
| Home and Discover navigation | pending | pending | No-Go until tested |
| Search and filter results | pending | pending | No-Go until tested |
| Dish and Stall Detail | pending | pending | No-Go until tested |
| Protected save/review/post redirect | pending | pending | No-Go until tested |
| Review and post composer media flow | pending | pending | No-Go until tested |
| Profile and Settings account deletion | pending | pending | No-Go until tested |

## Required Evidence Before Launch

- Screenshots or notes from iOS VoiceOver smoke on: onboarding, login, search, dish detail, save, review, post composer, profile, settings
- Screenshots or notes from Android TalkBack smoke (same flows)
- 200% text-size check on key screens (Home, Detail, Search, Review)
- Reduce Motion check for feed, carousel, and composer flows
- No inaccessible icon-only primary actions in production launch scope
- Tab bar: confirm all tabs announced correctly
- Error states: confirm announced via `accessibilityLiveRegion` or equivalent
- Forms: confirm all inputs have accessible labels (login, sign up, review, search, edit profile)

## Pre-Launch Hardening Items (Not Blocking if Manual Smoke Passes)

1. `useReduceMotion()` hook to gate 22 unguarded Reanimated animations
2. Systematic `accessibilityLabel` pass on the 933 Pressable elements in primary flows (Home, Discover, Search, Detail, Review, Post)
3. Add `eslint-plugin-react-native-a11y` rule to CI to catch missing labels
4. Confirm modal/sheet focus management with VoiceOver (bottom sheets, action sheets, media picker)
