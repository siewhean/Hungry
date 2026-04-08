# data-contracts.md — Domain Types & Mock Data Reference

> Dictionary format. Authoritative reference for all data shapes and fixture contents.
> Source of truth: `src/types/domain.ts` and `src/lib/services/mock/data.ts`.

---

## Primitive Types

### TasteKey

```ts
type TasteKey = "sweet" | "spicy" | "sour" | "salty" | "rich" | "aromatic"
```

### TasteVector

```ts
interface TasteVector {
  sweet: number    // 0–10
  spicy: number    // 0–10
  sour: number     // 0–10
  salty: number    // 0–10
  rich: number     // 0–10
  aromatic: number // 0–10
}
```

`NEUTRAL_TASTE_VECTOR` — all values `5`. Source: `src/constants/taste.ts`

### Enumerations

| Type | Values |
|------|--------|
| `BuildingType` | `"hawker_centre"` · `"food_court"` · `"restaurant"` |
| `HygieneGrade` | `"A"` · `"B"` · `"C"` · `"D"` |
| `DeliveryPlatform` | `"grabfood"` · `"foodpanda"` |
| `DietaryFlag` | `"halal"` · `"vegetarian"` · `"vegan"` · `"pork_free"` · `"nut_free"` · `"gluten_free"` |
| `SearchCategory` | `"local favourites"` · `"noodles"` · `"rice"` · `"desserts"` · `"late night"` |

---

## Entity Hierarchy

```
BuildingSummary (hawker centre / food court / restaurant)
  └── VenueSummary (individual stall / unit)
        └── DishSummary (dish at a stall)
              └── DishDetail extends DishSummary (full detail with reviews)
```

---

## Core Interfaces

### Coordinate
```ts
interface Coordinate {
  latitude: number
  longitude: number
}
```

### DeliveryLink
```ts
interface DeliveryLink {
  platform: DeliveryPlatform   // "grabfood" | "foodpanda"
  nativeUrl: string            // deep link into delivery app
  webUrl: string               // fallback web URL
  affiliateEligible: boolean
}
```

### BuildingSummary
```ts
interface BuildingSummary {
  id: string
  name: string
  type: BuildingType
  coordinate: Coordinate
  floors: string[]             // e.g. ["L1", "L2"]
  venueCount: number
  isClosedToday: boolean
  heroDishId: string           // top dish for this building
}
```

### VenueSummary
```ts
interface VenueSummary {
  id: string
  buildingId: string
  name: string
  unitNumber: string           // e.g. "#01-10"
  floor: string                // e.g. "L1"
  hygieneGrade: HygieneGrade
  isOpen: boolean
  topDishId: string
  operatingHours: string       // e.g. "10:00 AM – 8:00 PM"
  closureNotice?: string       // shown when closed for reason
  deliveryLinks: DeliveryLink[]
}
```

### DishSummary
```ts
interface DishSummary {
  id: string
  venueId: string
  buildingId: string
  venueName: string
  unitNumber: string
  floor: string
  name: string
  imageUrl: string
  blurhash?: string            // placeholder while image loads
  distanceMeters: number
  rating: number               // 0–5
  reviewCount: number
  price: number                // SGD
  priceRange: string           // e.g. "S$5.50 – S$7.00"
  tasteTags: string[]          // human-readable tags e.g. ["Fragrant", "Juicy"]
  tasteVector: TasteVector
  dietaryFlags: DietaryFlag[]
}
```

### DishDetail (extends DishSummary)
```ts
interface DishDetail extends DishSummary {
  gallery: string[]            // additional image URLs
  mustOrder: boolean           // surfaces MustOrderBadge
  availabilityFlags: string[]  // e.g. ["Delivery available", "Dine-in only"]
  reviews: Review[]
}
```

### Review
```ts
interface Review {
  id: string
  authorName: string
  rating: number               // 1–5
  createdAt: string            // ISO date or relative string
  text: string
  tags: string[]
  wouldRecommend: boolean
  photos: string[]             // image URLs
}
```

### BlogPost
```ts
interface BlogPost {
  id: string
  title: string
  excerpt: string
  area: string                 // e.g. "Chinatown", "CBD"
  sourceName: string           // e.g. "EatBook"
  sourceLogo: string           // initials or short code
  imageUrl: string
  url: string                  // external article URL
  relatedVenueId?: string
}
```

### UserProfile
```ts
interface UserProfile {
  id: string
  displayName: string
  email: string
  tasteVector: TasteVector
  dietaryPreferences: DietaryFlag[]
  favouriteDishIds: string[]
  reviewedDishIds: string[]
  stats: {
    dishesReviewed: number
    stallsVisited: number
    favouritesCount: number
  }
}
```

### ReviewDraft
```ts
interface ReviewDraft {
  selectedVenueId?: string
  selectedDishId?: string
  rating: number
  selectedTags: string[]
  recommend: boolean
  text: string
  photos: string[]
}
```

### SearchFilters
```ts
interface SearchFilters {
  query: string
  categories: SearchCategory[]
  dietaryFlags: DietaryFlag[]
  tasteValues: TasteVector
  radius: number               // metres
}
```

### StallPost
```ts
interface StallPost {
  id: string
  venueId: string
  buildingId: string
  authorName: string
  authorLocation: string
  authorAvatarUrl: string
  mediaType: "photo" | "video"
  mediaUrl: string
  caption: string
  dishIds: string[]
  createdAt: string
}
```

### AppSession
```ts
interface AppSession {
  isAuthenticated: boolean
  hasCompletedOnboarding: boolean
  hasSkippedTasteQuiz: boolean
  returnRoute?: string
}
```

---

## Mock Data Fixtures

Source: `src/lib/services/mock/data.ts`

### Buildings (3 fixtures)

| ID | Name | Type | Open? |
|----|------|------|-------|
| `building-maxwell` | Maxwell Food Centre | `hawker_centre` | Yes |
| `building-lau-pa-sat` | Lau Pa Sat | `food_court` | Yes |
| `building-amoy` | Amoy Street Food Centre | `hawker_centre` | **No** |

### Venues (5 fixtures)

| ID | Building | Name | Grade | Open? |
|----|----------|------|-------|-------|
| `venue-tian-tian` | Maxwell | Tian Tian Chicken Rice | A | Yes |
| `venue-maxwell-laksa` | Maxwell | Old School Laksa | B | Yes |
| `venue-satay-street` | Lau Pa Sat | Satay Street Classics | A | Yes |
| `venue-kopi-club` | Lau Pa Sat | Kopi Club | B | **No** |
| `venue-fish-soup` | Amoy | Ah Seng Fish Soup | A | **No** |

### Dishes (5 fixtures)

| ID | Venue | Name | Price | Must Order |
|----|-------|------|-------|-----------|
| `dish-chicken-rice` | Tian Tian | Chicken Rice | S$5.50 | **Yes** |
| `dish-laksa` | Old School Laksa | Laksa | S$6.00 | No |
| `dish-satay` | Satay Street | Satay Set | S$12.00 | **Yes** |
| `dish-kaya-toast` | Kopi Club | Kaya Toast | S$4.80 | No |
| `dish-fish-soup` | Ah Seng | Sliced Fish Soup | S$7.20 | No |

### Other Fixtures

| Export | Count | Notes |
|--------|-------|-------|
| `blogPosts` | 2 | EatBook, SethLui |
| `userProfile` | 1 | Demo authenticated user (Wei Ming) |
| `guestProfile` | 1 | Signed-out fallback fixture — neutral taste vector, no favourites |
| `stallPosts` | 4 | One per open venue |

---

## Store Interfaces

### useSessionStore

| Key | Type | Notes |
|-----|------|-------|
| `isAuthenticated` | boolean | Signed out = false |
| `hasCompletedOnboarding` | boolean | |
| `hasSkippedTasteQuiz` | boolean | |
| `sessionExpired` | boolean | Triggers redirect to Login |

**Actions:** `completeAuth(options?)` · `completeOnboarding(skippedQuiz?)` · `expireSession()` · `signOut()` · `setReturnRoute(route?)`

### useProfileStore

Manages `UserProfile` — taste vector, dietary prefs, favourites, reviewed dishes.

### useSearchStore

Manages `SearchFilters` — query, categories, dietary flags, taste values, radius.

### useDiscoveryStore

Manages selected building, active floor, map region.

### useReviewDraftStore

Manages `ReviewDraft` — persists across review multi-step flow.

### useLocationStore

Manages device `Coordinate` and permission state.

### useUIStore

| Key | Method |
|-----|--------|
| Show soft gate | `showSoftGate()` |
| Dismiss soft gate | `hideSoftGate()` |
| Show toast | `showToast(message, type?)` |

---

## Extending Mock Data

When adding new fixture data:

1. Add the object to the relevant export array in `src/lib/services/mock/data.ts`
2. Follow the exact interface shape from `src/types/domain.ts`
3. Use existing `FOOD_1`–`FOOD_4` image constants, or add a new named constant
4. Add the corresponding repository method in `src/lib/services/mock/repositories.ts`
5. Run `npm run typecheck` — must pass before any commit

**Do not** create new fixture data inline in screens or components.

---

## Mock Repository Pattern

Source: `src/lib/services/mock/repositories.ts`

```ts
// Pattern: async function returning Promise.resolve() with mock data
export async function getDishById(id: string): Promise<DishDetail | null> {
  return Promise.resolve(dishes.find(d => d.id === id) ?? null)
}

// Screens call repositories, never raw data arrays
const dish = await getDishById(dishId)
```

All repositories return `Promise<T>` to mirror the future real API contract.
