# Accessibility Presentation Specification (G-09)

> Generated 2026-04-12 by Gemini (ArchitectUX). This spec governs the implementation of Batch 8.

---

## 1. Interactive Components (P2-46, P2-49, P2-50, P2-51)

### Component ARIA Rules
| Component | Accessibility Role | Accessibility Label | Accessibility State |
|-----------|-------------------|---------------------|---------------------|
| `StarRating` (Editable) | `adjustable` | "Rating out of 5 stars" | `value: currentRating` |
| `BiteCard` | `button` | "View [Dish Name] details" | `none` |
| `MapBottomSheet` | `adjustable` | "Building details panel" | `expanded: true/false` |
| `Input` | `text` | "Enter [Label Name]" | `error: true/false` |

---

## 2. Visual Feedback (P2-51, P2-52)

### Error States
- **Visual**: Border `palette.error`.
- **Label**: Show error message text directly below input in `color: palette.error`, `variant="micro"`.
- **A11y**: Input should have `accessibilityLiveRegion="polite"` to announce errors.

### Loading States
- **Skeletons**: Use `Skeleton` primitive for `HomeFeed`, `SearchResults`, and `Detail` hero areas.
- **A11y**: Skeleton containers should have `accessibilityLabel="Loading content"`.

---

## 3. Data Visualization (P2-47)

### ProfileRadarChart A11y
- **Strategy**: Provide a hidden `View` with `accessibilityLabel` summarizing the taste profile.
- **Label Format**: "Your taste profile: Sweet 4.0, Spicy 8.5, Sour 2.0, Salty 5.5, Rich 7.0, Aromatic 6.0."
- **Focus**: Ensure the summary is the first item focusable when navigating the chart.

---

## 4. Branding & Badges (P2-48)

### MustOrderBadge A11y
- **Label**: "Must order signature dish."
- **Importance**: High (Announce on focus).

---

## 5. Accessibility Checklist (G-10)
- [ ] Every `Pressable` has an `accessibilityRole`.
- [ ] Every non-decorative `Image` has an `accessibilityLabel`.
- [ ] Touch targets are at least `44x44` pixels.
- [ ] Contrast ratios meet WCAG 2.1 AA (4.5:1 for text).
- [ ] Screen readers announce state changes (e.g., "Saved" vs "Save Favorite").
