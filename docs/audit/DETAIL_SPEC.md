# Detail Screens Visual Specification (G-03)

> Generated 2026-04-12 by Gemini (ArchitectUX). This spec governs the implementation of Batch 2.

---

## 1. StallDetail Hero Polish (P1-48, G-03)

### Image-to-Text Transition
- **Bottom Gradient**: `transparent` to `palette.bg`.
- **Height**: `80px` (anchored at the bottom of the hero image).
- **Readability**: Ensure the venue name and distance labels are clearly legible over the transition.

### Navigation Header
- **Top Gradient**: `rgba(0,0,0,0.3)` to `transparent`.
- **Height**: `100px` (starting from status bar).
- **Controls**: `ChevronLeft` and `Share2` should use white circular backgrounds with `shadows.floating` for high contrast against varied food imagery.

### Attribute Grid Consistency
- **Cards**: Use `spacing[4]` for internal padding.
- **Labels**: `variant="micro"`, `tone="secondary"`, `letterSpacing: 0.5`.
- **Values**: `variant="bodyLarge"`, `fontWeight: "700"`.

---

## 2. DishDetail Delivery Branding (P1-04)

### Platform Visual Identity
| Platform | Background | Text | Icon (fallback) |
|----------|------------|------|-----------------|
| **GrabFood** | `#00B14F` | `#FFFFFF` | `Truck` |
| **Foodpanda** | `#D70F64` | `#FFFFFF` | `Truck` |
| **Deliveroo** | `#00CCBC` | `#FFFFFF` | `Truck` |
| **Standard** | `palette.surface` | `palette.text` | `Truck` |

### Button Implementation
- **Border Radius**: `radii.pill` (999).
- **Elevation**: `shadows.card`.
- **Feedback**: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on press.

---

## 3. General Detail Component Rules

- **Photo Carousel**: Continuous scroll indicator (interpolation of scroll X).
- **Price Display**: Always `AppText` with `variant="price"` (DM Mono font).
- **Distance**: Format to 1 decimal place with "km away" (Singapore localization).
- **Hygiene Grade**: (Removed per latest UX, but preserve logic for future use-cases).
