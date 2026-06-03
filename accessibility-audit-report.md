# Accessibility Audit Report — Hungry App

**Date:** May 25, 2026  
**Auditor:** Claude (Opus 4.7)  
**Scope:** React Native mobile app UI components and screens  
**Standards:** WCAG 2.1 Level AA

---

## Executive Summary

This audit evaluated the Hungry app's accessibility compliance across UI components, screens, and design system. The original audit found **moderate accessibility implementation** with several strengths but source-level gaps in contrast validation, image semantics, and modal behavior.

**Current Assessment after A11Y-01:** ⚠️ **Source Remediated / Manual Assistive-Tech Proof Pending** — P0/P1 source fixes from this batch are complete and current-bundle large-text/high-contrast screenshots have been recorded for the primary mobile surfaces. Hungry should not claim full WCAG support until native screen-reader and keyboard/switch smoke checks are recorded.

### Key Findings

✅ **Strengths:**
- Consistent use of `accessibilityRole` on interactive components
- Touch target sizes meet 44px minimum (componentSizes.touchTarget: 44)
- Semantic color tokens with clear naming
- Error messages use `accessibilityLiveRegion="polite"` (Input component)
- IconButton requires `accessibilityLabel` prop

✅ **Source-remediated issues in A11Y-01:**
- Color contrast validation and documented WCAG AA token pairs
- Meaningful/decorative image semantics for production `expo-image`, React Native image, and Skia media-preview paths
- Dialog and bottom-sheet modal semantics with labelled dismiss targets
- Button busy/disabled state and input label fallback behavior

⚠️ **Remaining manual proof gaps:**
- iOS VoiceOver, Android TalkBack, and keyboard/switch traversal
- Full reduced-motion/high-contrast assistive-tech traversal beyond the selected screenshot smoke

The detailed findings below are retained as the original audit body for traceability. Use the remediation update as the current source-status summary.

---

## Remediation Update — May 25-26, 2026

**Status:** Source remediation complete; selected large-text visual smoke recorded; manual screen-reader/device smoke pending.

Completed in `A11Y-01`:
- Added documented WCAG AA contrast ratios and accessible text/control tokens in `src/theme/tokens.ts`.
- Updated shared Button, Badge, and AppText color paths so normal-sized orange/status text uses accessible foregrounds.
- Added `src/components/ui/AccessibleImage.tsx` and routed app/component image renders through either meaningful labels or decorative screen-reader hiding.
- Improved shared primitives:
  - Button now merges caller `accessibilityState` with `disabled` and `busy`.
  - Input defaults labels from label/placeholder and stops moving placeholders while a screen reader is enabled.
  - Dialog and BottomSheet now expose modal semantics, announcements, and labelled dismiss targets without grouping away nested action buttons.
  - Avatar announces once from the container and hides duplicate image/initials announcements.
  - Card continues to avoid unsupported web-only roles.
- Added contracts:
  - `src/theme/accessibility-contrast.test.ts`
  - `src/components/ui/accessibility-primitives-contracts.test.ts`
  - `src/components/ui/accessible-image-contracts.test.ts`
- QA/QC follow-up fixed raw React Native image gaps in merchant, collection, brand, wheel, and splash surfaces; added explicit Skia preview semantics in the review media editor; and changed the contrast contract so documented ratios must match computed token pairs.
- Runtime follow-up fixed Home story/media accessibility semantics, auth screen generic controls, onboarding icon/list controls, taste quiz selectable cards, Search recommendation/result cards, and stall menu cards with explicit button roles, labels, state, and hints.
- Final source follow-up fixed direct `BottomSheetModal` surfaces and shared bottom-sheet callers so production sheets expose contextual modal labels, labelled dismiss backdrops, and labelled nested controls instead of falling back to generic third-party semantics.
- Moving search placeholders now disable animation for screen-reader and reduced-motion users across every `useMovingSearchPlaceholder` consumer, and expandable search inputs expose stable input/clear labels instead of relying on animated placeholder text.
- Direct modal surfaces found in the review success confirmation and Hungry Wheel option picker now expose modal semantics and labelled dismiss controls; shared chips expose their label and selected state directly on the pressable control.
- A source sweep over production app/component/feature files found no remaining `Pressable` or `IconButton` tags with `accessibilityRole="button"` and no explicit `accessibilityLabel`; the sweep also prompted explicit labels on the global back control, auth provider/resend controls, floor filters, collection rows, and V2 search clear action.
- Large-text follow-up changed the taste quiz action footer from an absolute overlay into normal layout flow, scales dietary-list bottom space with the OS font scale, and allows the long dietary action label to use two lines at accessibility text sizes.
- Shared text and input scaling now use bounded theme-level font multipliers so fixed-format mobile UI can respect accessibility settings without clipping headers, tab labels, buttons, or input placeholders.
- Large-text visual follow-up fixed Discover popular dish labels, Profile display-name wrapping, and comment input placeholder clipping found in current-bundle simulator screenshots.

Verified:
- Focused accessibility/layout contracts: pass 62/62, including auth control semantics, onboarding controls, manual-location input labelling, taste quiz/selectable dietary semantics, Search card semantics, Profile edit/share/tab controls, bounded AppText/Input font scaling, Discover/Home layout contracts, moving search placeholder screen-reader/reduced-motion fallback, expandable search input/clear labels, direct review/wheel modal semantics, chip labels/state, global back/auth/floor/collection labels, stall menu cards, Home action labels, story/media semantics, contrast, shared primitives, bottom-sheet modal/backdrop/nested-control labels, image semantics, Skia media previews, and marketing hero image/alt-text contracts.
- Earlier stale source-contract slice: pass 17/17.
- `npm run typecheck`: pass on the current worktree after the large-text shared scaling follow-up.
- `npm test -- --watch=false`: pass, 406 total / 404 passing / 2 skipped.
- Scoped accessibility `git diff --check`: pass. Full `git diff --check` is blocked by pre-existing trailing whitespace in `tasks/Roadmap/claude-full-project-audit.md`.

Runtime evidence collected:
- XcodeBuildMCP iOS simulator accessibility hierarchy read succeeded on iPhone 17 Pro / iOS 26.1 for Developer Launcher and Home.
- The Home hierarchy exposed the tab bar, activity inbox, story rail, author/profile actions, media, captions, and bottom navigation with accessible labels/roles.
- The first Home hierarchy also exposed unlabeled generic post action elements for save/comment/like; those source controls are now fixed with explicit labels, roles, and selected state in `src/app/screens/home/HomeFeedScreen.tsx`, and the Sprint 9 source contract now guards those labels.
- A fresh iOS hierarchy re-snapshot after the story/media patch showed story rail items and zoomable post media as `AXButton` elements with meaningful labels and hints.
- Auth screen source now fixes the runtime-discovered generic password visibility, forgot-password, create-account, sign-up footer, reset footer, and reset confirmation controls; a fresh auth runtime hierarchy snapshot now shows login fields, password visibility, forgot-password, sign-in, provider, and create-account controls with labels/roles.
- Simulator display settings were applied and verified: dark appearance, `accessibility-extra-extra-extra-large` content size, Increase Contrast enabled, and Reduce Motion enabled.
- Latest iOS re-run evidence: the current dev bundle is reachable again through XcodeBuildMCP and elevated simulator deep links. Runtime hierarchy snapshots now cover login, onboarding location permission, manual location selection, dish detail, and stall detail. These snapshots found and verified fixes for the onboarding back/location rows and stall menu-card role gaps.
- Latest runtime follow-up snapshots also covered Discover and Search. Discover exposes the search launcher, chips, popular dishes, decision buttons, browse cards, quick-bite rails, and vertical stall cards as labelled buttons. Search initially exposed the suggestion and stall cards as generic elements and the moving placeholder as the text-field label; source fixes now give the search field a stable label and expose the suggestion/stall result cards as buttons with hints.
- Latest follow-up also covered the signed-out Profile/Auth path from the bottom tab bar. The hierarchy exposes login fields, password visibility, forgot-password, and auth controls with labels/roles, while Profile-private content remains auth-gated for a signed-out user.
- Large-text simulator screenshot on the installed bundle exposed the taste quiz dietary footer visually overlapping the list. Source is now fixed and guarded.
- Current-bundle iOS large-text/high-contrast screenshot captured through LAN Metro on 2026-05-26 shows the Taste Quiz dietary footer fitting without visible list overlap, with the long "I have no restrictions" label still contained in the orange button. Evidence paths: `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_e15d417a-ade4-4b77-878b-c1b6951cd3c8.jpg` and `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_064c0566-2dcf-4bef-8a75-092a5555d320.jpg`.
- Current-bundle iOS large-text/high-contrast screenshots also cover Home, Discover, Search, Dish Detail, Location Permission, and Profile. The Profile hierarchy re-run exposed generic/unlabelled edit, share, and tab controls; source is now fixed and a current-bundle hierarchy re-run verifies them as labelled buttons. Evidence paths include `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_a7d13079-752c-441b-8b36-22a9213610e4.jpg`, `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_82f94c13-2354-4ef1-8bfb-09a76e58f5fb.jpg`, `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_cdf89cf5-fba3-4ad0-85ad-1d699dabe26c.jpg`, `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_6ff7bda5-1a5c-47ee-8bdb-af6e525698af.jpg`, `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_d668d2fb-c661-4574-98fc-469490bd1670.jpg`, and `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_b27a5bbe-43b8-4a2e-a71d-84d3849c6c04.jpg`.
- Latest large-text visual QA after bounded AppText/Input scaling captured fixed current-bundle screenshots for Home, Discover, Search, Profile, Dish Detail, and the Comments bottom sheet. Evidence paths: `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_c4dabdce-448a-4620-967a-0bfebad9e350.jpg`, `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_7cd1e292-1703-4453-b9d6-70eb808aea42.jpg`, `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_e9d5259e-c6d2-44c2-bef5-0a6c0a8524ba.jpg`, `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_efeb140a-cac0-4bac-af60-03f1b197aa53.jpg`, `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_612ca583-f623-4cd9-aa36-0b3859a9b81c.jpg`, and `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_03703694-9b5f-4e48-a154-71c29d51ecac.jpg`.
- Current-bundle bottom-sheet hierarchy proof shows the comments sheet exposed as `Post comments`, with a labelled `Bottom sheet handle` and `Close comments` dismiss button carrying the hint `Dismisses the comments sheet`. Screenshot evidence: `/var/folders/ty/7bm_mb757m1f5wr1jlnyrdf80000gn/T/screenshot_optimized_159ce1a4-9b98-4c02-8608-57b7fc855c2a.jpg`.
- iOS simulator accessibility defaults were probed on device `99014C62-326A-4514-9C75-3449E9B3F5BE`: `AccessibilityEnabled=1`, `ApplicationAccessibilityEnabled=1`, `DarkenSystemColors=1`, and `ReduceMotionEnabled=1`. The simulator preference domain does not expose `VoiceOverTouchEnabled`, `VoiceOverTouchEnabledByiTunes`, or `SwitchControlEnabled` keys in this runtime, so local tooling can collect AX hierarchy and screenshots but still cannot prove spoken VoiceOver or Switch Control traversal.
- Remaining iOS caveat: this is simulator accessibility hierarchy evidence, not a full hands-on VoiceOver traversal. Expo Dev Client and simulator controls still expose development/OS overlays such as the dev menu and AssistiveTouch `gearshape.fill`; those are excluded from app-source findings but prevent claiming a clean end-to-end native assistive-tech pass from this shell alone.
- Android TalkBack runtime proof is blocked in this shell because `adb` is not installed/available, no Android emulator connector was exposed, and Expo reports the Android project folder is missing in this checkout.

Remaining manual gaps before claiming full WCAG support:
- iOS VoiceOver smoke across Home, Discover, Search, Detail, Profile, dialog, and bottom sheet.
- Android TalkBack smoke.
- Keyboard/switch traversal for modal and bottom-sheet dismissal.
- Large-text/high-contrast current-bundle screenshots are recorded for selected primary surfaces and the Comments bottom sheet; true reduced-motion/high-contrast assistive-tech traversal remains open.

---

## Detailed Findings by WCAG Criterion

### 1. Perceivable

#### 1.1 Text Alternatives (Level A)

**Status:** ✅ **Source Remediated / Manual Proof Pending**

**Resolved source findings:**
1. **Avatar component** (`src/components/ui/Avatar.tsx`)
   - Announces a single avatar label from the container.
   - Hides duplicate image/initials announcements from assistive tech.

2. **General image usage**
   - Added `src/components/ui/AccessibleImage.tsx`.
   - Production app/component image renders now route through meaningful labels or decorative screen-reader hiding.
   - Raw React Native image usage in production surfaces is covered by source contracts.

3. **Icon-only buttons**
   - Shared `IconButton` continues to require `accessibilityLabel`.
   - Inline decorative icons remain hidden where appropriate; meaningful icon-only actions must provide labels.

**Remaining validation:**
- Confirm the image reading order with iOS VoiceOver and Android TalkBack across Home, Discover, Detail, Profile, Review, and Merchant surfaces.

---

#### 1.3 Adaptable (Level A)

**Status:** ✅ **Source Remediated / Manual Proof Pending**

**Resolved source findings:**
1. **Card component** (`src/components/ui/Card.tsx`)
   - Does not force unsupported web-style `article` semantics in React Native.
   - Keeps child reading order intact and allows explicit semantic props when a card is a single actionable/summary element.

2. **Dialog component** (`src/components/ui/Dialog.tsx`)
   - Exposes native modal semantics with `accessibilityViewIsModal`.
   - Announces dialog open state and labels the dismiss backdrop.
   - Keeps nested action buttons reachable instead of grouping away children.

3. **BottomSheet component** (`src/components/ui/BottomSheet.tsx`)
   - Adds accessible modal labelling and backdrop semantics around the third-party sheet.
   - Requires device/screen-reader smoke to confirm focus behavior in the native runtime.

**Remaining validation:**
- Confirm dialog and bottom-sheet traversal with VoiceOver, TalkBack, keyboard, and switch-style navigation.

---

#### 1.4 Distinguishable (Level AA)

**Status:** ✅ **Compliant** — Contrast ratios documented and validated

**Validated source state:**
1. **Base contrast ratios are documented and computed** (`src/theme/tokens.ts`)
   - Light mode ratios documented:
     - `textOnBg: 13.83` (exceeds 4.5:1 requirement)
     - `textSecondaryOnBg: 7.54` (exceeds 4.5:1 requirement)
     - `textMutedOnBg: 5.43` (exceeds 4.5:1 requirement)
     - `accentTextOnBg: 5.87` (exceeds 4.5:1 requirement)
     - All documented ratios meet or exceed WCAG AA requirements
   - Dark mode ratios documented:
     - `textOnBg: 16.48` (exceeds 4.5:1 requirement)
     - `textSecondaryOnBg: 7.66` (exceeds 4.5:1 requirement)
     - `textMutedOnBg: 6.74` (exceeds 4.5:1 requirement)
     - All documented ratios meet or exceed WCAG AA requirements

2. **Status colors are documented and validated:**
   - Light: `statusFastOnBg: 5.48`, `statusModerateOnBg: 6.68`, `statusBusyOnBg: 5.82`
   - Dark: `statusFastOnBg: 9.92`, `statusModerateOnBg: 11.98`, `statusBusyOnBg: 6.25`

3. **Badge tone contrast is documented and validated:**
   - Light badge tones: orange, amber, success, warning, error, info, and neutral all meet 4.5:1.
   - Dark badge tones are validated against their rendered surface-composited backgrounds.

4. **Brand-orange button color is preserved with accessible text:**
   - Primary buttons keep the Hungry orange control background.
   - Primary button text uses `textOnOrange` so normal-sized labels meet WCAG AA.

**Recommendation:**
1. Keep `src/theme/accessibility-contrast.test.ts` in the CI test suite.
2. Add any new semantic color pair to both `contrastRatios` and the computed contrast contract before use in production UI.
3. Manually spot-check image-overlay text because contrast depends on the underlying image crop.

---

### 2. Operable

#### 2.1 Keyboard Accessible (Level A)

**Status:** ⚠️ **Not Applicable / Partial**

**Context:** React Native mobile app — keyboard navigation primarily applies to:
- External keyboard users (iPad, Android tablets)
- Switch control / assistive input devices

**Issues:**
1. No evidence of keyboard navigation testing
2. Focus order not explicitly managed
3. Dialog and bottom-sheet source semantics are improved, but native focus trapping still needs keyboard/switch verification

**Recommendation:**
- Test with external keyboard on iOS/Android
- Ensure tab order follows visual order
- Verify modal focus trapping and dismissal behavior with VoiceOver/TalkBack plus keyboard/switch traversal

---

#### 2.4 Navigable (Level A)

**Status:** ✅ **Source Remediated**

**Resolved source findings:**
1. **Button component** (`src/components/ui/Button.tsx`)
   - Has `accessibilityRole="button"` ✅
   - Merges caller `accessibilityState` with disabled and busy state ✅
   - Still relies on callers to provide hints for non-obvious actions

2. **IconButton component** (`src/components/ui/IconButton.tsx`)
   - Requires `accessibilityLabel` ✅
   - Accepts optional `accessibilityHint` ✅
   - Good implementation

3. **Input component** (`src/components/ui/Input.tsx`)
   - Defaults `accessibilityLabel` from explicit label, then placeholder ✅

**Recommendation:**
- Continue adding `accessibilityHint` to non-obvious actions during feature work.

---

#### 2.5 Input Modalities (Level A)

**Status:** ✅ **Compliant**

**Strengths:**
1. Touch targets meet 44px minimum (componentSizes.touchTarget: 44)
2. IconButton has `hitSlop={spacing[2.5]}` for expanded touch area
3. Haptic feedback on button press (good for motor impairments)

**Minor Issue:**
- Button component has visual press feedback (`translateY: 1`) but this is acceptable

---

### 3. Understandable

#### 3.1 Readable (Level A)

**Status:** ✅ **Compliant**

**Strengths:**
1. Typography scale is clear and consistent
2. Font sizes scaled up by 2px (typographyLevelUp: 2) for better readability
3. Line heights provide adequate spacing

---

#### 3.2 Predictable (Level A)

**Status:** ✅ **Source Remediated / Manual Proof Pending**

**Resolved source findings:**
1. **Dialog backdrop** (`src/components/ui/Dialog.tsx`)
   - Backdrop has accessible dismiss role/label/hint.
   - Dialog open state is announced.

2. **Input placeholder animation** (`src/components/ui/Input.tsx`)
   - Moving placeholders are disabled while a screen reader is enabled.
   - Static placeholder text remains available to assistive tech.
   - Shared search placeholder animation is also disabled when screen reader or reduced-motion settings are active.

**Recommendation:**
- Confirm actual announcement order and dismissal behavior with VoiceOver/TalkBack.

---

#### 3.3 Input Assistance (Level A)

**Status:** ✅ **Compliant**

**Strengths:**
1. **Input component** has error handling:
   - Error text with `accessibilityLiveRegion="polite"` ✅
   - Visual error state (red border)
   - Helper text for guidance

2. **EmptyState component** provides clear feedback

---

### 4. Robust

#### 4.1 Compatible (Level A)

**Status:** ⚠️ **Partial Compliance**

**Issues:**
1. **No screen reader testing evidence**
   - No documentation of TalkBack (Android) testing
   - No documentation of VoiceOver (iOS) testing

2. **Third-party components** lack accessibility audit:
   - `@gorhom/bottom-sheet` (BottomSheet.tsx)
   - `@shopify/flash-list` (HomeFeedScreen.tsx)
   - Need to verify these are accessible

3. **AppText component** (`src/components/ui/AppText.tsx`)
   - Passes through Text accessibility props ✅
   - Relies on caller semantics for headings, labels, and live regions

**Recommendation:**
1. Test with VoiceOver on iOS
2. Test with TalkBack on Android
3. Document screen reader behavior in component docs
4. Add accessibility testing to QA checklist

---

## Component-by-Component Summary

| Component | Compliance | Current Status |
|-----------|-----------|----------------|
| Button | ✅ Source remediated | Merges caller state with disabled/busy and keeps orange primary buttons with accessible text |
| IconButton | ✅ Good | Enforces labels, has hints |
| Input | ✅ Source remediated | Defaults accessibility label from label/placeholder and disables moving placeholders for screen readers |
| Dialog | ✅ Source remediated / manual smoke pending | Modal semantics, open announcement, and labelled dismiss target added |
| BottomSheet | ✅ Source remediated / manual smoke pending | Modal/container/backdrop semantics added around third-party sheet |
| Card | ✅ Good | Avoids unsupported web-only role and preserves explicit semantic prop pass-through |
| Avatar | ✅ Source remediated | Announces once and hides duplicate image/initials announcements |
| Badge | ✅ Source remediated | Tone contrast ratios are documented and contract-validated |
| EmptyState | ✅ Good | Clear messaging |
| AppText | ✅ Good | Flexible, passes props |

---

## Priority Recommendations

### Source-remediated items

1. **Add accessibility labels to all images** — Done in source via `AccessibleImage` and production image contracts.
2. **Fix Dialog component** — Done in source with modal semantics, announcement, and labelled dismiss behavior.
3. **Associate Input labels properly** — Done in source with label/placeholder fallback.
4. **Add busy state to Button** — Done in source by merging `disabled` and `busy` state.
5. **Audit BottomSheet accessibility** — Done in source; native traversal still needs manual proof.
6. **Disable animated placeholders for screen readers** — Done in source.
7. **Add automated contrast testing** — Done in source with computed token-pair contracts.
8. **Verify marketing website food card alt text is descriptive** — Done by source contract.
9. **Add `aria-hidden="true"` to decorative atmosphere image** — Done in `Hero.tsx`.

### P0 — Critical (Blocks full accessibility claim)

1. **Test with screen readers**
   - VoiceOver on iOS
   - TalkBack on Android
   - Document findings and fix issues

### P1 — High (Improves usability significantly)

2. **Manual keyboard/switch traversal**
   - Dialog dismissal
   - Bottom-sheet dismissal
   - Main tab/action traversal

3. **Third-party component runtime audit**
   - `@gorhom/bottom-sheet`
   - `@shopify/flash-list`
   - Native image picker/media picker surfaces

### P2 — Medium (Polish and best practices)

4. **Add accessibility hints to non-obvious actions**
    - Review all buttons and add hints where needed

5. **Document accessibility in component docs**
    - Add accessibility section to each component's JSDoc
    - Include screen reader behavior

6. **Keep automated contrast testing in CI**
    - Validate documented ratios against actual token pairs
    - Keep color regressions visible as theme tokens evolve

### P3 — Low (Nice to have)

7. **Add rendered accessibility testing**
    - Integrate `@testing-library/react-native` with accessibility queries
    - Test focus order in automated tests

8. **Create accessibility style guide**
    - Document patterns for developers
    - Include code examples
    - Add to project README

---

## Testing Recommendations

### Manual Testing Checklist

- [ ] Enable VoiceOver on iOS, navigate entire app
- [ ] Enable TalkBack on Android, navigate entire app
- [ ] Test with external keyboard (iPad/Android tablet)
- [ ] Test with Switch Control (iOS) or Switch Access (Android)
- [x] Test selected primary surfaces with increased text size (current-bundle iOS screenshots)
- [x] Test selected primary surfaces with high contrast mode (current-bundle iOS screenshots)
- [x] Verify reduced motion setting is enabled in the simulator defaults
- [ ] Test reduced-motion behavior with full assistive-tech traversal
- [ ] Test in both light and dark modes

### Automated Testing

```typescript
// Example test with @testing-library/react-native
import { render } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';

describe('Button accessibility', () => {
  it('has accessible role', () => {
    const { getByRole } = render(<Button label="Submit" />);
    expect(getByRole('button')).toBeTruthy();
  });

  it('announces loading state', () => {
    const { getByRole } = render(<Button label="Submit" loading />);
    const button = getByRole('button');
    expect(button).toHaveAccessibilityState({ busy: true });
  });

  it('is disabled when loading', () => {
    const { getByRole } = render(<Button label="Submit" loading />);
    const button = getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

---

## Marketing Website Accessibility (Next.js)

**Status:** ⚠️ **Partial Compliance**

### Strengths

1. Navbar uses semantic HTML with `aria-label="Primary navigation"`.
2. Next.js `Image` provides automatic optimization and better accessibility defaults.
3. GSAP animations respect `prefers-reduced-motion` via the `useReducedMotion` hook.

### Source-verified items

1. **Hero.tsx atmosphere image** (`marketing/website/web-v2/src/components/sections/Hero.tsx:85-92`)
   - Decorative image has `alt=""` ✅
   - Parent wrapper currently has `aria-hidden="true"` ✅
   - Image itself now has `aria-hidden="true"` ✅

2. **Hero.tsx food card images** (`marketing/website/web-v2/src/components/sections/Hero.tsx:135-142`)
   - Images have alt text from content ✅
   - Current `content/site.ts` values are dish-specific, for example `Top-down bowl of Singapore laksa`
   - Source contract prevents regression to filenames or generic labels ✅

### Recommendation

- Keep `src/app/marketing-accessibility-contracts.test.ts` in the test suite.
- Re-run a screen-reader smoke on the marketing site before public launch if the hero/media content changes.

---

## Resources

### Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [React Native Accessibility Docs](https://reactnative.dev/docs/accessibility)
- [Expo Accessibility Guide](https://docs.expo.dev/guides/accessibility/)
- [@testing-library/react-native](https://callstack.github.io/react-native-testing-library/)

### Guidelines
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [iOS VoiceOver Testing Guide](https://developer.apple.com/accessibility/voiceover/)
- [Android TalkBack Testing Guide](https://support.google.com/accessibility/android/answer/6283677)

---

## Conclusion

The Hungry app now has a **stronger source-level accessibility foundation** with consistent component patterns, good touch target sizing, documented and contract-validated WCAG AA contrast ratios, production image semantics, remediated modal/input/button primitives, and selected current-bundle large-text/high-contrast screenshot evidence. The remaining blocker for a full WCAG 2.1 AA claim is **manual assistive-tech runtime evidence**, especially VoiceOver, TalkBack, keyboard/switch traversal, and dialog/bottom-sheet behavior under reduced-motion/high-contrast settings on real native/web surfaces.

**Estimated effort to reach compliance:**
- P0 remaining: 1 day (VoiceOver/TalkBack smoke and remediation of any findings)
- P1 remaining: 0.5-1 day (keyboard/switch traversal and third-party runtime checks)
- P2 remaining: 0.5 day (component docs/style guide and accessibility hints audit)

**Total remaining: ~2-2.5 days** if manual smoke does not uncover new runtime defects.

**Next steps:**
1. Conduct iOS VoiceOver and Android TalkBack smoke testing.
2. Verify dialog/bottom-sheet focus behavior with keyboard and switch-style traversal.
3. Record large text, reduced motion, high contrast, and light/dark-mode results.
4. Fix any runtime findings discovered by manual assistive-tech testing.
5. Keep the focused source contracts in CI to prevent regressions.

---

**Audit completed:** May 25, 2026  
**Auditor:** Claude (Opus 4.7)  
**Contact:** For questions about this audit, refer to WCAG 2.1 documentation or accessibility testing resources listed above.
