# Maps Bottom Sheet Visual Specification (G-02)

> Generated 2026-04-12 by Gemini (ArchitectUX). This spec governs the implementation of Batch 1.

---

## 1. Sheet Geometry (P1-43, P1-44)

| Property | Value | Rationale |
|----------|-------|-----------|
| **Peek Height** | `240px` | Provides enough space for "Popular Dishes" carousel while maintaining map visibility. |
| **Full Height** | `600px` | Allows for full stall listing without crowding. |
| **Top Radius** | `radii.xl` (24px) | Consistent with app-wide card styling. |
| **Bottom Radius** | `0px` (Square) | Ensures the sheet feels docked to the bottom of the viewport. |
| **Placement** | `bottom: 0` | No floating gap at the bottom; must be flush with screen edge. |
| **Bottom Padding** | `insets.bottom + spacing[4]` | Ensures content clears the native home indicator/tab bar. |

---

## 2. Floating Components (P2-13, P2-14)

### Building Legend
- **Placement**: Absolute position, `bottom: PEEK_HEIGHT + spacing[4]`, `left: spacing[4]`.
- **Z-Index**: `20` (above map, below modal overlays).
- **Style**: Horizontal row of chips with semantic colours (Orange: Hawker, Teal: Food Court, Grey: Restaurant).

### Map Camera Padding
- **Prop**: `cameraPadding` in `MapSurface`.
- **Dynamic Offset**: 
  - Peek state: `bottom: 260`
  - Expanded state: `bottom: 300`
- **Goal**: Ensures selected building pin remains visible in the top half of the screen when the sheet is open.

---

## 3. Copy & Metadata (P2-09, P2-12)

### Building Directory Placeholder
- **Target**: `BuildingDrillDownScreen.tsx`
- **Current**: "Search on this building"
- **New**: "Search stalls in this building"

### Open Stall Count Logic
- **Display**: "X stalls open now"
- **Logic**: `venues.filter(v => v.isOpen).length`
- **Fallback**: If building is closed: "Building currently closed"

---

## 4. Accessibility (P2-50)

| Component | Role | Label |
|-----------|------|-------|
| `MapBottomSheet` | `adjustable` | "Building information sheet" |
| `BuildingLegend` | `none` | "Building type legend" |
| `HandleBar` | `button` | "Expand building details" |
