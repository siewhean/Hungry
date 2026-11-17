# Hungry Accessibility Style Guide

This guide captures the source-level accessibility contract for Hungry production UI. It does not replace native VoiceOver, TalkBack, keyboard, switch, large-text, reduced-motion, and high-contrast smoke testing before a release claim.

## WCAG Target

- Target: WCAG 2.1 AA for the mobile app and marketing surfaces.
- Source contracts validate documented color contrast, image semantics, shared primitive semantics, and key Home feed action labels.
- Runtime proof is still required for third-party native UI, screen readers, focus order, and assistive input.

## Shared Primitives

- `Button`: visible `label` is the accessible name and is passed explicitly to the pressable unless a caller overrides `accessibilityLabel`. Loading buttons must expose `accessibilityState.busy` and disabled state. Non-obvious actions should add `accessibilityHint`.
- `IconButton`: caller must provide `accessibilityLabel`; add `accessibilityHint` when the icon does more than its visible metaphor suggests.
- `Input`: prefer a visible `label`; otherwise the static placeholder becomes the fallback accessible name. Moving placeholders must stay disabled while a screen reader is enabled.
- Search placeholders: use `useMovingSearchPlaceholder` only for decorative hint cycling. The hook must return static text when a screen reader or reduced motion is enabled, and the actual input still needs a stable `accessibilityLabel`.
- `Dialog`: announce the title on open, keep nested action buttons reachable, and keep the backdrop as a labelled dismiss target.
- `BottomSheet`: provide a contextual `accessibilityLabel` for each sheet, keep the backdrop dismiss target labelled, and manually smoke-test traversal because it wraps third-party native UI.
- Direct `BottomSheetModal` usage is allowed only when the shared wrapper cannot support the layout; every direct sheet must include a contextual `accessibilityLabel`, `accessibilityViewIsModal`, and a labelled dismiss backdrop.
- Direct React Native `Modal` usage must include `accessibilityViewIsModal`, a labelled dismiss target, and a visible or accessible header.
- `Avatar`: announce once from the container and hide duplicate image or initials announcements.
- `Chip`: expose the visible label on the pressable control and keep selected state on `accessibilityState`.
- `Card`: do not force unsupported web roles. Add explicit role/label only when the whole card is a single action or summary.

## Images And Media

- Use `AccessibleImage` for production `expo-image` usage.
- Meaningful images require a specific label, such as `Laksa photo from Maxwell Food Centre`.
- Decorative images use `decorative` so screen readers skip repeated visual texture.
- Media previews rendered by Skia or SVG need explicit surrounding semantics because the native drawing surface is otherwise silent.

## Interaction Labels

- Labels should name the object being acted on: `Save Laksa`, not `Save`.
- Toggle-like actions should expose `accessibilityState.selected` where appropriate.
- Selectable list rows inside sheets should expose `accessibilityRole="button"`, a contextual label, a result-oriented hint, and selected state when applicable.
- Hints should describe the result, not repeat the label: `Adds this post to your saved items`.
- Avoid fake affordances: disabled, unavailable, or prototype actions must be hidden, disabled, or described truthfully.

## Runtime Smoke Checklist

- iOS VoiceOver: Home, Discover, Search, Dish Detail, Stall Detail, Profile, dialog, bottom sheet.
- Android TalkBack: same critical surfaces when Android tooling is available.
- External keyboard or switch-style traversal: main tabs, dialog dismissal, bottom-sheet dismissal, post actions.
- Visual settings: light and dark modes, larger text, increased contrast, reduced motion.
- Third-party native UI: `@gorhom/bottom-sheet`, `@shopify/flash-list`, native image/media picker.

## Source Verification

Run the focused accessibility slice after accessibility changes:

```bash
HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/app/screens/sprint9-screen-contracts.test.ts src/theme/accessibility-contrast.test.ts src/components/ui/accessibility-primitives-contracts.test.ts src/components/ui/accessible-image-contracts.test.ts src/app/marketing-accessibility-contracts.test.ts
```
