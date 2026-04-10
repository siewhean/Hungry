# product-context.md — Product Requirements & App Context

> Derived from Research/01_Product_Requirements_Document_Hungry.docx,
> Research/02_App_Flow_Document_Hungry.docx, Research/03_Frontend_Guidelines_Hungry.docx.
> Dictionary format. Agents read this before any feature work.

---

## Core Identity

| Key | Value |
|-----|-------|
| Tagline | "Find the dish. Not just the restaurant." |
| Secondary | "Find the dish. Makan nearby." |
| Primary data object | Individual Dish (not venue/restaurant) |
| Market | Singapore locals and residents (MVP) — Malaysia, Thailand etc. are V2+ |
| Phase | Pre-backend: frontend mock-first demo |
| Future backend | Supabase (PostgreSQL + PostGIS + pgvector), Claude Haiku for taste tagging |

---

## Problem This App Solves

| Problem | Magnitude |
|---------|-----------|
| Decision fatigue | 25,000+ licensed F&B in Singapore; users waste 35–55 min/week deciding what to eat |
| No dish-first search | All competitors (Google Maps, Burpple, GrabFood) are restaurant-centric |
| Hawker centres are black boxes | 114 hawker centres, 6,000+ stalls — no app organises by floor + unit + live ratings |
| Food blogs are scattered | 60+ independent Singapore food blogs; unlinked from live discovery |
| No taste-based filtering | Users think in cravings (spicy, rich, sweet) — not cuisine categories |
| Hawker culture under-served | Burpple skews premium restaurants; UNESCO-inscribed hawker culture ignored |

---

## User Personas

### Persona 1 — The Indecisive Local (Primary)
| Attribute | Value |
|-----------|-------|
| Archetype | Wei Ming, 26, NUS graduate, CBD office worker |
| Goals | Find food near office in <3 min · discover new hawker stalls · order delivery |
| Pain points | 10+ min deciding daily · Burpple too expensive for daily use · Google Maps doesn't say what to order |
| Device | Android (primary) |

### Persona 2 — Tourist / Expat Explorer
| Attribute | Value |
|-----------|-------|
| Archetype | Sarah, 34, British expat, 6 months in Singapore |
| Goals | Navigate hawker centres · discover authentic local dishes · delivery on weekday evenings |
| Pain points | Overwhelmed by hawker centre complexity · blog articles not actionable · doesn't know what to order |
| Device | iPhone (primary) |

### Persona 3 — Hawker Stall Owner (Business User, V1.1)
| Attribute | Value |
|-----------|-------|
| Archetype | Uncle Tan, 58, second-generation chicken rice stall |
| Goals | Get found by younger audience · list delivery links · understand customer taste preferences |
| Pain points | No digital presence · relies on regulars · no time to manage social media |
| Business portal | Next.js web dashboard (separate from consumer app — out of scope for this phase) |

---

## MVP Feature Set

### Core Features (Must Have)

| ID | Feature | Key Requirement |
|----|---------|----------------|
| F-001 | User accounts + Auth | Email + password, Google Sign-In, guest mode |
| F-002 | Taste Profile (Onboarding) | 6-slider quiz seeding TasteVector; skip allowed |
| F-003 | Location permissions | Opt-in; required for proximity ranking |
| F-004 | Building Drill-Down | Tap map pin → floor tabs → stall grid. Loads <1.5s |
| F-005 | Dish-First Search | Type "laksa" → all options across venues ranked by proximity + rating + taste match. Results <1s |
| F-006 | Taste-Based Filtering | 6 sliders (sweet/spicy/sour/salty/rich/aromatic). Real-time results <500ms |
| F-007 | Decide For Me | Tap FAB → best dish within 500m by cosine similarity. Result <2s |
| F-008 | Dish Detail | Photo carousel, taste radar, price, tags, reviews, delivery buttons |
| F-009 | Stall Detail | Name, floor/unit, hygiene grade, hours, closure notice, all dishes, directions |
| F-010 | Dish-Level Reviews | Stars (1–5), text, taste tags, photos (up to 5, max 1MB each) |
| F-011 | Favourites | Saved dishes; updates user taste vector (weighted avg, recency-weighted), and supports saved-list sorting by dish type, rating, taste profile, and location |
| F-012 | Delivery Deep Links | GrabFood + Foodpanda universal links. Native app if installed, else web. Hidden if no URL. |

### Secondary Features (V1.1 — Should Have)

| ID | Feature | Notes |
|----|---------|-------|
| F-013 | Food Blog Aggregator (Reads tab) | RSS from 60+ blogs, 3–6h polling. Excerpt-only |
| F-014 | Halal / Dietary Filter Toggle | Top-level: Halal, Vegetarian, Vegan, Pork-Free |
| F-015 | Situation-Based Discovery | Quick presets: <15 min meal, Budget <S$8, Late night >10pm |
| F-016 | NEA Closure Integration | Auto-refresh from data.gov.sg; 'Closed today' badge |
| F-017 | Business Portal | Next.js web — claim listing, manage photos, add delivery links, analytics |
| F-018 | 30-Second Tag Review | Quick path: taste tags + recommend toggle only |
| F-019 | Photo Check-In | One-tap: take photo, tag dish, seeds taste database |

### V2+ (Nice to Have — Do Not Implement Now)

| ID | Feature |
|----|---------|
| F-020 | Taste similarity between friends |
| F-021 | AI-predicted dish score |
| F-022 | Busy hours heatmap |
| F-023 | Telegram share integration |
| F-024 | Annual Hungry Awards |
| F-025 | Curated scenario guides |
| F-026 | Offline saved maps |
| F-027 | Instagram Story auto-logging |

---

## Out of Scope (MVP, Never Add)

```
- In-app ordering or payment
- Table reservations
- Full social network / messaging
- International markets
- Desktop/web consumer app
- Grocery, recipes, delivery logistics
- In-app purchases
```

---

## Key UX Specifications

### Taste Vector

| Spec | Detail |
|------|--------|
| Dimensions | sweet · spicy · sour · salty · rich · aromatic |
| Range (PRD) | 0.0–1.0 (floating point) |
| Range (implementation) | 0–10 (integer) — map to/from 0.0–1.0 when backend integration begins |
| Dish tagging | Claude Haiku (future); manual fixtures now |
| User profile | Seeded from onboarding quiz; updated by favourites (weighted avg) |
| Matching | Cosine similarity between user vector and dish vector |

### Decide For Me

| Spec | Detail |
|------|--------|
| Trigger | Orange FAB, bottom-right, 56dp, spring animation, haptic |
| Algorithm | Best dish within 500m by cosine similarity to user taste vector |
| Result | Large photo, dish name, stall, floor/unit, taste match % |
| Time limit | <2 seconds |
| No match | Expand radius option |

### Favourites Sorting

| Spec | Detail |
|------|--------|
| Primary object | Saved dishes in Profile > Favourites |
| Dish-type grouping | Users can sort or group favourites by dish type, for example Chicken Rice, Nasi Lemak, Laksa |
| Rating sort | Users can sort favourites by rating, highest to lowest first |
| Taste-profile sort | Users can sort favourites by strongest taste signal or closest match to their personal taste vector |
| Location sort | Users can sort favourites by nearest distance or by building / hawker centre |
| Data dependency | Dish type must be explicit in mock data or derived from canonical dish taxonomy before UI rollout |
| UX goal | Help users revisit saved dishes by craving, quality, and convenience instead of a flat chronological list |

### Hygiene Grade Colours

| Grade | Colour | Hex |
|-------|--------|-----|
| A | Green | `#16A34A` (success) |
| B | Amber | `#D97706` (warning) |
| C | Orange | `#E8531E` (orange brand) |
| D | Red | `#DC2626` (error) |

### Map Pin Colours

| Building Type | Colour | Hex |
|--------------|--------|-----|
| `hawker_centre` | Orange | `#E8531E` |
| `food_court` | Teal | `#14B8A6` |
| `restaurant` | Grey | `#6B7280` |

### Delivery Buttons

| Platform | Brand Colour | Hex |
|----------|-------------|-----|
| GrabFood | Green | `#00B14F` |
| Foodpanda | Pink | `#D70F64` |
| Behaviour | Universal link — native app if installed, else webUrl |
| When to hide | When `deliveryLinks` array is empty |

### Guest vs Authenticated Access

| Action | Guest | Authenticated |
|--------|-------|--------------|
| Browse map | No — redirect to login | Yes |
| Dish/stall detail | No — redirect to login | Yes |
| Search | No — redirect to login | Yes |
| Reads | No — redirect to login | Yes |
| Favourite a dish | No — redirect to login | Yes |
| Write a review | No — redirect to login | Yes |
| View profile | No — redirect to login | Yes |
| Taste profile | No — redirect to login | Yes |

---

## Performance Targets (Reference — Not enforced in mock-first phase)

| Action | Target |
|--------|--------|
| Search results | <1 second |
| Taste filter update | <500ms |
| Building drill-down load | <1.5 seconds |
| Decide For Me | <2 seconds |
| Taste profile update after favourite | <3 seconds |
| App cold start to interactive | <3 seconds |

---

## Data Sources (Future Backend)

| Data | Source | Notes |
|------|--------|-------|
| Eating establishments | SFA GeoJSON from data.gov.sg | GPS coords, floor, unit |
| Hygiene grades | NEA dataset | A/B/C/D |
| Hawker closures | NEA "Dates of Hawker Centres Closure" from data.gov.sg | Scheduled cleaning |
| Postal codes | OneMap SG API | Free |
| Food blogs | RSS feeds (60+ blogs) | Poll every 3–6 hours |
| Delivery URLs | Stall owner input + scraper | Updated weekly |
| Taste vectors | Claude Haiku batch tagging | ~S$0.01–0.05 per dish |

---

## Tone of Voice Rules

| Do | Don't |
|----|-------|
| Direct, warm, local | Corporate jargon |
| Singlish references acceptable | Excessive exclamation marks |
| Knowledgeable food friend | Generic stock photography |
| "Find the dish. Makan nearby." | "Discover amazing restaurants!" |
| Show real dish photos | AI-generated food imagery |
| Specific stall/dish names | Vague testimonials |

---

## Tab Structure Reference

The PRD defines 4 main tabs. Current implementation has 5. Reconciliation:

| PRD Tab | PRD Screen | Current Implementation |
|---------|-----------|----------------------|
| Discover (map pin) | Home Map Screen | Maps tab |
| Search (magnifying glass) | Dish Search | Discover tab |
| Reads (newspaper) | Blog Feed | Reads (via feature flag + Home) |
| Profile (person) | User Profile | Profile tab |
| — | — | Home tab (feed) — added in implementation |
| — | — | Review tab — surfaced as tab in implementation |

> Note: Tab structure may be reconciled in a future sprint. Do not reorder tabs without explicit instruction.
