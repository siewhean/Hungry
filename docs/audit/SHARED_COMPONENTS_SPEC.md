# Shared Component & Token Cleanup (G-08)

> Generated 2026-04-12 by Gemini (ArchitectUX). This spec governs the implementation of Batch 7.

---

## 1. FloatingToast & Global Motion (P1-37, P1-38, P1-39, P2-57)

### Animation (G-08)
- **Entrance**: `SlideInDown` or `FadeInDown` from `react-native-reanimated`.
- **Exit**: `FadeOut` or `SlideOutUp`.
- **Duration**: `motion.toast` (250ms).

### Visual Structure
- **Z-Index**: `zIndex.toast` (30).
- **Tone Mapping**:
  - `success`: `palette.orange`, icon `CircleCheck`.
  - `warning`: `palette.amber`, icon `TriangleAlert`.
  - `error`: `palette.error`, icon `CircleAlert`.
  - `info`: `palette.navy`, icon `Info`.

---

## 2. Design Token Adoption (P2-33, P2-35, P2-36, P2-37, P2-39, P2-40, P2-55, P2-56)

### Component Refactor List
| Component | Attribute | Target Token |
|-----------|-----------|--------------|
| `DishCard` | Image Placeholder | `palette.border` (light) or `palette.bgSoft` (dark) |
| `StallHeader` | Spacing/Gaps | `spacing[4]`, `spacing[2]` |
| `OperatingHours` | Status Color | `palette.teal` (open), `palette.error` (closed) |
| `BiteCard` | Tag Background | `palette.orange` |
| `BiteCard` | Tag Text | `palette.bg` (inverse) |
| `MapSurface` | Road Colors | `palette.mapRoadPrimary` (rgba(0,0,0,0.05)) |

### Global Token Rules
- **Font Family**: Use `typography.body` for labels, `typography.heading` for titles. NEVER inline `Nunito_700Bold`.
- **Pill Radius**: Use `radii.pill` (999) for all buttons and chips.
- **Card Shadows**: Use `shadows.card` which should have `shadowColor: palette.navy` in light and `rgba(0,0,0,0.4)` in dark mode.

---

## 3. Dark Mode Support (P1-40, P1-41, P2-55)

### Component Specifics
- **HygieneGradeBadge**: Map Grade A/B/C/D to `palette` tokens.
- **FloorPlanViewer**: Use `palette.surface` for default stalls, `palette.orangeLight` for selected stalls.

---

## 4. Shared Component Checklist (G-10)
- [ ] No hardcoded hex values in component files.
- [ ] Z-index and motion tokens are consumed.
- [ ] Typography follows the central token scale.
- [ ] Spacing values are derived from the 4px grid (spacing[N]).
- [ ] Components are responsive to dark mode transitions.
