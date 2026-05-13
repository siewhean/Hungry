# Hungry V2 Map Screen & Store Directory Planning

## Purpose

This document captures the planning, product direction, UX decisions, technical architecture, and refined AI-agent prompt for improving the **V2 Map Screen** and **Store Directory** in Hungry.

Hungry is a food discovery app. The V2 map experience should help users discover trending food nearby, browse hawker centres, malls, food courts, and view stalls inside real venues.

The goal is not to build a generic map. The goal is to build a polished, production-ready food discovery and venue directory experience that can eventually support accurate indoor stall layouts.

---

# 1. Product Direction

The V2 map should be treated as **two connected systems**:

## 1. Outdoor Discovery Map

This is the main map experience where users can discover:

- Trending food nearby
- Hawker centres
- Malls
- Food courts
- Restaurants
- Cafes
- Popular food locations
- Individual stalls when zoomed in

The primary user goal is discovery, not navigation.

## 2. Indoor Venue Directory / Store Directory

This is the building-level experience where users can browse stalls inside a mall, hawker centre, or food court.

Users should be able to:

- Open a venue from the map
- View all stalls within the venue
- Select floors or levels
- See stall locations represented by polygons
- Tap a polygon to view the stall details
- See whether stalls are open, closing soon, closed, or non-food/unavailable

---

# 2. Clarified Requirements

## Primary Map Purpose

The map should focus on:

- Discovering trending food nearby
- Browsing malls and hawker centres
- Browsing food courts and popular food locations

The map should **not** focus on navigation or wayfinding.

## Search and Filters

The map should include a top search bar.

Below the search bar, show only 3–4 primary filter chips:

- Nearby
- Trending
- Hawker
- Mall

Additional filters should be hidden inside a filter button or filter sheet.

Possible advanced filters:

- Open now
- Food court
- Cafe
- Restaurant
- Cheap eats
- Highly rated
- Closing soon
- Promotions

## Marker Count Display

Cluster markers should **not** show the count or number of stalls directly on the marker.

Instead:

- The marker stays clean and visually simple.
- When the user taps the marker, a bottom sheet appears.
- The bottom sheet can show the stall count and list of stalls inside the venue.

## Indoor Layout Strategy

The preferred approach is **Option A**:

Build a scalable architecture for importing, storing, and rendering real indoor floor-plan data.

The AI agent should not try to invent mall layouts from imagination as the long-term solution.

## Wayfinding

No indoor navigation or routing is required.

The store directory is for browsing and discovery only.

## Stall Cards

When users tap a stall, the stall details shown should reuse the existing stall details already available inside the app.

## Bottom Sheet Behavior

When a user taps a marker:

1. Show a quick preview bottom sheet.
2. Allow the user to expand the bottom sheet into a full venue/store directory page.

## Indoor Map Style

The primary indoor view should be 2D.

A 3D or pseudo-3D option can be considered later, but it is not the priority.

## Map Visual Style

The outdoor map should feel similar to Google Maps, but with Hungry’s own design twist.

It should feel polished, clean, food-focused, and consistent with Hungry’s existing UI.

## Live Opening Status

Opening status should be computed from the stall opening and closing hours stored in the database.

The system should map real stall data to:

- Map markers
- Stall dots
- Indoor stall polygons

This should be live where possible, starting at small scale.

---

# 3. Recommended UX Structure

## Outdoor Map Screen

The outdoor map should include:

- Full-screen interactive map
- Top search bar
- Quick filter chips
- Advanced filter button
- Map markers
- Zoom-based marker visibility
- Bottom sheet preview
- Expandable venue directory

## Suggested Outdoor Map Layout

```text
┌──────────────────────────────┐
│ Search food, stalls, places  │
├──────────────────────────────┤
│ Nearby | Trending | Hawker | Mall │
├──────────────────────────────┤
│                              │
│           MAP AREA           │
│                              │
│   image markers / venue pins │
│   stall dots at high zoom    │
│                              │
├──────────────────────────────┤
│ Bottom sheet appears on tap  │
└──────────────────────────────┘
```

## Marker Types

### Popular Location Marker

Used for popular or trending food locations.

Visual style:

- Image thumbnail marker
- Slightly larger than normal markers
- Used sparingly to avoid clutter

### Venue Marker

Used for:

- Malls
- Hawker centres
- Food courts
- Restaurant clusters

Visual style:

- Larger marker
- Icon or color based on venue type
- Does not display count directly

### Individual Stall Dot

Used for individual stalls.

Behavior:

- Hidden when zoomed out
- Appears only after a defined zoom threshold
- Small dot marker
- Tappable

### Cluster / Grouped Building Marker

Used when a venue contains multiple stalls.

Behavior:

- Does not show count on marker
- Tapping opens bottom sheet with count and list

---

# 4. Marker Tap Behavior

## Tapping a Venue Marker

Show a quick preview bottom sheet with:

- Venue image
- Venue name
- Venue type
- Address
- Number of stalls
- Open/closed summary
- Popular stalls
- CTA: View Directory

The user can expand the bottom sheet into a full venue/store directory page.

## Tapping an Individual Stall Dot

Show a stall preview card using existing app data:

- Stall name
- Image
- Rating
- Opening status
- Opening hours
- Tags/categories
- Location
- CTA to view full stall details

---

# 5. Store Directory / Indoor Venue Page

The store directory should let users view all stalls within a building, mall, food court, or hawker centre.

## Requirements

- Show venue details at the top.
- Support floor/level selection.
- Render a 2D floor plan.
- Represent each stall with a clickable polygon.
- Use polygon colors based on status.
- Let users tap polygons to view stall details.
- Allow users to switch between floors.
- Use actual floor-plan data where available.

## Polygon Colors

- Green = open
- Orange = closing soon
- Red = closed
- Grey = not a food stall / non-food unit / unmapped / unavailable

## Important Constraint

Do **not** create fake mall layouts using rows of identical rectangles.

The long-term solution must be data-driven and based on real imported floor-plan data.

If real layout data is not available, a fallback/demo SVG may be used only for testing. It must be clearly labelled as fallback/demo and should still look realistic.

---

# 6. Indoor Floor Plan Data Strategy

## Why Previous Attempts Failed

Previous attempts produced unrealistic layouts because the AI was asked to create mall layouts directly.

This causes the AI to generate:

- Generic rectangles
- Straight rows of stalls
- Unrealistic building outlines
- No real relationship to actual mall/hawker layouts

The better approach is to create a scalable architecture that can import and render real layouts.

## Recommended Approach

The app should support:

- Imported SVG floor plans
- Imported GeoJSON floor plans
- Manually verified stall polygons
- Mapping polygons to existing stall IDs
- Source confidence metadata
- Future replacement of fallback layouts with verified real data

## Floor Plan Pipeline

Suggested pipeline:

1. Collect or upload a venue floor plan.
2. Convert or trace the floor plan into SVG or GeoJSON.
3. Define polygons for each stall/shop unit.
4. Map each polygon to an existing stall in the database.
5. Store confidence and verification metadata.
6. Render the floor plan in the app.
7. Compute live open/closed status from opening hours.
8. Color the polygons dynamically.

---

# 7. Suggested Backend / Data Model

## venues

```text
venues
- id
- name
- type: mall | hawker_centre | food_court | restaurant_cluster
- latitude
- longitude
- address
- cover_image_url
```

## floors

```text
floors
- id
- venue_id
- level_name
- floor_order
- floorplan_svg_url
- floorplan_geojson_url
```

## stalls

```text
stalls
- id
- venue_id
- floor_id
- name
- category
- unit_number
- latitude
- longitude
- opening_hours
- existing_app_data_reference
```

## stall_map_polygons

```text
stall_map_polygons
- id
- stall_id
- floor_id
- polygon_points
- polygon_type
- source_type
- source_confidence
- last_verified_at
```

## stall_status

```text
stall_status
- stall_id
- current_status: open | closed | closing_soon | unknown
- computed_from_opening_hours
- updated_at
```

---

# 8. Opening Status Logic

The map and indoor directory should compute live opening status using existing stall opening hours.

## Status Types

### Open

The current time is within the stall’s opening hours.

### Closing Soon

The current time is within opening hours, but the stall will close soon.

Suggested threshold:

- Closing within the next 30–60 minutes

This threshold should be configurable.

### Closed

The current time is outside opening hours.

### Unknown

Used when:

- Opening hours are missing
- Opening hours are incomplete
- Data is unreliable

---

# 9. Small-Scale First Implementation

The first implementation should be a proof of concept.

## Recommended Scope

Start with:

- 1 venue
- 1–2 floors
- 10–30 mapped stalls
- Real stall data from the database where available
- Clickable polygons
- Working level selector
- Working marker-to-directory flow
- Dynamic open/closed/closing-soon status

This avoids pretending that the app already has accurate indoor layouts for every venue.

---

# 10. Required App States

The AI agent should design and implement these states:

## Map States

- Initial loading map
- Location permission prompt
- Location permission denied
- No nearby food found
- Search results loading
- No search results
- Map data loading
- Error loading map

## Marker / Venue States

- Marker selected
- Venue selected
- Bottom sheet collapsed
- Bottom sheet expanded
- Store directory loading
- Store directory unavailable

## Indoor Directory States

- Floor plan loading
- Floor plan unavailable
- Fallback floor plan mode
- Floor selected
- Stall polygon selected
- Stall details loading
- Error loading venue directory

---

# 11. Implementation Priorities

## Priority 1: Outdoor Map Foundation

- Working map screen
- Search bar
- Quick filter chips
- Marker system
- Bottom sheet preview
- Zoom-based marker visibility

## Priority 2: Venue Directory

- Venue bottom sheet
- Expand to full directory page
- Floor selector
- Stall list
- Stall cards using existing app data

## Priority 3: Indoor Floor Plan Proof of Concept

- Render one venue with SVG or GeoJSON
- Support 1–2 floors
- Support clickable polygons
- Map polygons to stall data
- Show live status colors

## Priority 4: Data Pipeline

- Create data models
- Map stall IDs to polygons
- Add verification/source confidence fields
- Support fallback/demo floor plans

## Priority 5: Production Polish

- Loading states
- Empty states
- Error states
- Animations
- Marker transitions
- Smooth bottom sheet interactions
- Responsive mobile layout

---

# 12. Refined AI-Agent Prompt

Use the following prompt for the AI agent:

```text
Work on the V2 Map Screen and Store Directory for Hungry.

Hungry is a food discovery app. The V2 map experience should help users discover trending food nearby, browse hawker centres, malls, food courts, and view stalls inside real venues.

The screen must be polished, production-ready, mobile-first, and match the existing Hungry app design system. Inspect the existing repository locally and reuse the existing colors, components, spacing, typography, navigation patterns, cards, and data models where possible.

Do not build a generic mock map. Do not create unrealistic mall layouts made of simple rectangles in straight rows.

The V2 map should consist of two connected experiences:

1. Outdoor Discovery Map
2. Indoor Store Directory / Venue Floor Plan

Outdoor Discovery Map Requirements:
- Create a working interactive map screen.
- Main purpose: discover trending food nearby and browse malls, hawkers, food courts, and popular food locations.
- No navigation or wayfinding is needed.
- Use a Google Maps-style visual direction, but adapted with Hungry’s own design language.
- Add a top search bar.
- Add 3–4 quick filter chips below the search bar:
  - Nearby
  - Trending
  - Hawker
  - Mall
- Add a filter button for additional map filters.
- Additional filters can include:
  - Open now
  - Food court
  - Cafe
  - Restaurant
  - Cheap eats
  - Highly rated
  - Closing soon
  - Promotions
- The filters should be clickable and update the visible markers.

Marker System:
- Popular/trending locations should use image thumbnail markers.
- Malls, hawker centres, and food courts should use larger venue markers.
- Individual stalls should be represented as small dots.
- Individual stall dots should only appear after the user zooms in past a defined zoom threshold.
- Do not show all stall dots when zoomed out because it will clutter the map.
- Different marker colors/icons should represent venue types:
  - Hawker centre
  - Food court
  - Mall
  - Restaurant
  - Cafe
  - Individual stall
- Clustered or grouped building markers should not show the stall count directly on the marker.
- When the user taps a marker, show a quick preview bottom sheet.
- The bottom sheet can display the stall count/list inside that building or venue.
- The user should be able to expand the bottom sheet into a full venue/store directory page.

Marker Tap Behavior:
When tapping a building/venue marker, show:
- Venue image
- Venue name
- Venue type
- Address
- Number of stalls
- Open/closed summary
- Popular stalls
- CTA: View Directory

When tapping an individual stall dot, show the existing stall card details already available in the app:
- Stall name
- Image
- Rating
- Opening status
- Opening hours
- Tags/categories
- Location
- CTA to view full stall details

Store Directory / Indoor Venue Page:
- When the user opens a mall/hawker centre/food court, show a store directory for all stalls inside the venue.
- The directory should support floor/level selection similar to how indoor maps show building levels.
- Users should be able to tap a level/floor to view stalls on that level.
- Each stall should be represented by a polygon that outlines its actual stall/shop unit location.
- The polygon should be clickable.
- Clicking a stall polygon should show the stall card using the existing stall details already available in the app.

Polygon Status Colors:
- Green = open
- Orange = closing soon
- Red = closed
- Grey = not a food stall / non-food unit / unmapped / unavailable

Important Indoor Map Requirement:
- Do not create a fake mall layout using rows of identical rectangles.
- The long-term solution must be data-driven and based on real imported floor-plan data.
- Build the architecture for importing, storing, and rendering real floor-plan data.
- If actual mall/hawker centre layout data is not available, create a clearly labelled fallback/demo SVG only for testing.
- The fallback/demo SVG should still use realistic irregular corridors, units, paths, and polygons, not simple aligned rows of rectangles.
- Clearly separate real-data rendering from fallback/demo rendering.

Indoor Floor Plan Data Architecture:
Plan and implement the best possible scalable approach for real indoor layout support:
- Store venue-level data.
- Store floor-level data.
- Store SVG or GeoJSON floor-plan data.
- Store stall polygon data.
- Map each stall polygon to the existing stall database using a stable stall_id.
- Support source confidence and verification metadata.
- Support future replacement of fallback floor plans with real uploaded/imported floor plans.

Suggested Backend/Data Model:
Create or plan models similar to:

venues:
- id
- name
- type
- latitude
- longitude
- address
- cover_image_url

floors:
- id
- venue_id
- level_name
- floor_order
- floorplan_svg_url
- floorplan_geojson_url

stalls:
- id
- venue_id
- floor_id
- name
- category
- unit_number
- latitude
- longitude
- opening_hours
- existing_app_data_reference

stall_map_polygons:
- id
- stall_id
- floor_id
- polygon_points
- polygon_type
- source_type
- source_confidence
- last_verified_at

stall_status:
- stall_id
- current_status
- computed_from_opening_hours
- updated_at

Live Opening Status:
- The map and floor-plan status should use the stall opening/closing hours already stored in the database.
- Compute the status dynamically:
  - open
  - closed
  - closing soon
  - unknown
- “Closing soon” should be calculated based on a configurable threshold, such as closing within the next 30–60 minutes.
- The marker, stall dot, and polygon color should update based on this computed status.

Small-Scale First Implementation:
Start with a small proof of concept:
- 1 venue
- 1–2 floors
- 10–30 mapped stalls
- real stall data from the database where available
- clickable polygons
- working level selector
- working bottom sheet
- working marker-to-directory flow
- dynamic open/closed/closing-soon status

Map Interaction Requirements:
- Smooth zoom behavior.
- Marker visibility changes by zoom level.
- Bottom sheet preview on marker tap.
- Expand bottom sheet to full page.
- Floor level selector inside venue directory.
- Clickable stall polygons.
- Clickable stall cards.
- Search and filters update visible results.
- Loading, empty, and error states must be handled.

States to Design:
- Initial loading map
- Location permission prompt
- Location permission denied
- No nearby food found
- Search results loading
- No search results
- Map data loading
- Marker selected
- Venue selected
- Store directory loading
- Floor plan unavailable
- Fallback floor plan mode
- Stall polygon selected
- Stall details loading
- Error loading map
- Error loading venue directory

Deliverables:
1. Improve the V2 map screen UI.
2. Improve the venue/store directory UI.
3. Implement clickable map markers and bottom sheets.
4. Implement zoom-based marker visibility.
5. Implement filter chips and advanced filter button.
6. Implement the indoor store directory structure.
7. Implement a realistic data-driven floor-plan rendering architecture.
8. Implement a small proof of concept with one venue first.
9. Clearly document what is possible now and what requires real floor-plan data or additional data collection.
10. Avoid unrealistic mocked layouts unless clearly labelled as fallback/demo.

The final result should look and behave like a polished production app, not a wireframe.
```

---

# 13. Key Notes for the AI Agent

The agent should clearly report:

- What was implemented
- What was mocked
- What requires real venue/floor-plan data
- What data models were added or changed
- How stall data maps to markers and polygons
- How opening status is computed
- How to add more venues in the future

The most important instruction is:

> Do not invent indoor mall layouts as if they are real. Build the architecture to support real layouts and create only a clearly labelled fallback/demo layout when real data is unavailable.

---

# 14. Future Enhancements

These can be added later:

- 3D or pseudo-3D indoor map option
- Admin tool to upload and trace floor plans
- Polygon editor for mapping stalls
- Data verification workflow
- Crowdsourced corrections
- Venue owner dashboard
- Heatmap for trending stalls
- Queue-time overlays
- Promotions layer
- AI-assisted floor-plan tracing
- Batch import from mall/hawker directory sources
