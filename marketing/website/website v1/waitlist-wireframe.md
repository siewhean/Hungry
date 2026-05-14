# Hungry Waitlist Wireframe

## Objective

Define the content contract and layout order for a future waitlist page without committing to implementation yet.

## Page Principles

- One page
- One primary CTA
- Fast to understand on mobile
- Balanced mix of app UI proof and real food / hawker imagery
- Consumer-first story with a clear hawker secondary module

## Recommended Structure

### 1. Hero
**Purpose:** Explain the category and the core difference immediately.

**Content:**
- Eyebrow: Singapore dish-first food discovery
- H1: Find the dish. Not just the restaurant.
- One supporting paragraph
- Single primary CTA button

**Visual treatment:**
- Left or top: strong headline and CTA
- Right or below: product UI collage pulled from `design/figma-v2/discover-search.html`, `design/figma-v2/home-feed.html`, and `design/figma-v2/stall-detail.html`
- Background: Paper Warm with a restrained local-food texture or map-line motif

### 2. Problem strip
**Purpose:** Validate the frustration before talking features.

**Content:**
- Short section title
- 2-3 lines explaining why venue-first browsing slows people down
- 3 compact pain bullets

**Visual treatment:**
- Could use a split-screen "restaurant list overload" versus "dish-first clarity" graphic

### 3. Why dish-first matters
**Purpose:** Make the product difference feel obvious.

**Content:**
- Three compact cards: Search by dish, Filter by taste, Decide faster

**Visual treatment:**
- App UI crop plus simple iconography
- No giant generic marketing illustrations

### 4. How Hungry works
**Purpose:** Show the journey in 3 steps.

**Content:**
- Search
- Compare
- Go

**Visual treatment:**
- Three phone frames or three stacked mobile panels
- Recommended screen sources:
  - Search results
  - Taste filter or Decide For Me
  - Stall detail or building drill-down

### 5. Local proof block
**Purpose:** Make Hungry feel specific to Singapore rather than generic food-tech.

**Content:**
- Short paragraph about hawker centres, food courts, and local dish discovery
- 3 stat callouts sourced from repo docs:
  - 25,000+ licensed F&B businesses
  - 114 hawker centres
  - 6,000+ stalls

**Visual treatment:**
- Editorial food photography and hawker-environment imagery
- Stats in DM Mono for structure

### 6. Product preview band
**Purpose:** Give a wider sense of the product surface.

**Content:**
- 4-5 compact preview cards:
  - Dish-first search
  - Taste profile
  - Hawker clarity
  - Reviews
  - Reads bridge

**Visual treatment:**
- Small UI cards mixed with close-up dish crops

### 7. Hawker secondary module
**Purpose:** Capture merchant-side relevance without stealing the page.

**Content:**
- "Own a stall? Get discovered by dish."
- Short supporting paragraph
- Secondary CTA that still routes into the same waitlist system or hawker-interest capture

**Visual treatment:**
- Keep smaller than the consumer hero
- Use stall board or hawker-environment photography, not corporate dashboard mockups

### 8. FAQ
**Purpose:** Resolve launch-stage anxieties.

**Content:**
- Is it live yet?
- Why not just use Google Maps or GrabFood?
- Is it only for hawker centres?
- Is this a content app or a utility app?

### 9. Final CTA
**Purpose:** Close with the same single promise.

**Content:**
- Reinforce decision relief
- Repeat the waitlist CTA

## Form Contract

**Required field:**
- Email

**Optional fields:**
- First name
- Joining as: Diner / Hawker / Both

**Reasoning:** Keep friction low. One required field protects conversion rate; optional segmentation supports follow-up messaging later.

## State Requirements

### Default
- Hero, form, and proof sections fully visible without heavy animation

### Success state
- Inline confirmation or dedicated thank-you block
- Reinforce what happens next
- Encourage share, but do not introduce a second major CTA

### Error state
- Plain-language form error copy
- No blame language
- Keep form values intact where possible

## Asset Sourcing Rules

- Use real app captures from repo design prototypes and app screens as the primary proof layer
- Use real or clearly editorial food imagery for appetite and local texture
- Do not use AI-generated food shots as if they represent actual dishes or stalls in the product
- If motion is needed later, AI can support transitions and ambient texture, but the core proof should still be UI plus real food/hawker visuals
