# Search & Discover UI Polish (G-06)

> Generated 2026-04-12 by Gemini (ArchitectUX). This spec governs the implementation of Batch 4.

---

## 1. Suggested Content (P2-05)

### DishSearch "Suggested for tonight" Card
- **Layout**: Full-width card with image background or left-aligned image with text on right.
- **Image**: High-quality foodie image (`FOOD_LAKSA` or `FOOD_CHICKEN_RICE`).
- **Content**:
  - **Title**: "Craving Laksa?"
  - **Body**: "Best spicy noodles within 2km of your location."
  - **Price Range**: "S$5 – S$12"
- **CTA**: "Browse Laksa".
- **Visual Style**: Glassmorphism text overlay or high-contrast card with `palette.surface`.

---

## 2. Empty States & Feedback (P2-06, P2-07)

### SearchResults Empty State
- **Illustration**: Custom SVG or stylized `Search` icon in `palette.textMuted`.
- **Primary Message**: "No dishes found matching your criteria."
- **Secondary Actions**:
  - Button 1: "Clear Taste Filters" (Only visible if filters are active).
  - Button 2: "Explore Popular Nearby".
- **Subtitle Cleanup**: Hide the "0 dishes matched" subtitle when the `EmptyState` component is rendered.

---

## 3. Taste Filters & Sliders (P1-47)

> Retired 2026-10-19: `TasteFilterScreen` was removed with the legacy (non catalog-v2) search path. The paged catalog has no taste-slider input.

### TasteFilterScreen Polish
- **Slider Step**: Force integer values (`step={1}`).
- **Axis Legend**: Labels at each end (e.g., "Mild" to "Extra Spicy", "Light" to "Extra Rich").
- **Real-time Feedback**: Update the "X dishes match these settings" count in the `primary` apply button as the user slides.

---

## 4. Discover Screen Carousel (P2-10)

### BuildingDrillDown Dish Carousel
- **Count**: Max 8 items.
- **Affordance**: "View All Stalls" button at the end of the carousel or as a separate section header action.
- **Interaction**: Tap to `DishDetail`.

---

## 5. Search Logic & UI Integration (P1-20, P1-21, P2-08)

### Venue Grouping (UX Direction)
- **Grouping**: When users search for a dish (e.g., "Laksa"), allow toggling between "Dishes" (default) and "Stalls" (grouped by venue).
- **Recent Searches**: Persist the last 5 successful queries to `useSearchStore` and display them as chips below the search bar.
- **Proximity**: Sort discovery feed by distance (current location to building center) by default.
