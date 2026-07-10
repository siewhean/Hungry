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

### PopularVisitorPin
```ts
interface PopularVisitorPin {
  id: string
  outletId: string
  venueId: string
  reviewId: string
  sourceId: string
  authorProfileId?: string
  authorName: string
  authorAvatarUrl?: string
  authorLocation?: string
  reviewText: string
  rating: number
  dishName?: string
  visitedAt: string
  pinnedAt: string
  sortOrder: number
  isActive: boolean
}
```

`PopularVisitorCandidate` is the merchant-side candidate shape for review-backed pins. Pins are capped to 6 active records per outlet in the service layer and sorted by `sortOrder` then newest `pinnedAt`. Source: `src/types/domain.ts`

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

### Buildings (4 fixtures)

| ID | Name | Type | Open? |
|----|------|------|-------|
| `building-maxwell` | Maxwell Food Centre | `hawker_centre` | Yes |
| `building-amoy` | Amoy Street Food Centre | `hawker_centre` | Yes |
| `building-lau-pa-sat` | Lau Pa Sat | `hawker_centre` | Yes |
| `building-313` | 313@Somerset | `restaurant` | Yes |

### Venues (8 fixtures)

| ID | Building | Name | Grade | Open? |
|----|----------|------|-------|-------|
| `venue-tian-tian` | Maxwell | Tian Tian Chicken Rice | - | Yes |
| `venue-ban-mian` | Amoy | Han Kee Fish Soup | - | Yes |
| `venue-satay-street` | Lau Pa Sat | Satay Street Classics | - | Yes |
| `venue-japanese-curry` | 313@Somerset | Monster Curry | - | Yes |
| `venue-maxwell-porridge` | Maxwell | Night Owl Teochew Porridge | - | **No** |
| `venue-fish-soup` | Amoy | Ah Seng Fish Soup | - | Yes |
| `venue-pasta-express` | Maxwell | Pasta Express Maxwell | - | Yes |
| `venue-napoli-pizza` | Lau Pa Sat | Napoli Pizza LPS | - | Yes |

### Dishes (13 fixtures)

| ID | Venue | Name | Price | Must Order |
|----|-------|------|-------|-----------|
| `dish-chicken-rice` | Tian Tian | Chicken Rice | S$5.50 | **Yes** |
| `dish-ban-mian` | Han Kee Fish Soup | Sliced Fish Ban Mian | S$6.50 | **Yes** |
| `dish-satay` | Satay Street | Chicken Satay (10 sticks) | S$8.00 | No |
| `dish-japanese-curry` | Monster Curry | Monster Combo Curry | S$28.00 | No |
| `dish-laksa` | Tian Tian | Signature Laksa | S$6.00 | No |
| `dish-fish-soup` | Ah Seng Fish Soup | Sliced Fish Soup | S$6.80 | **Yes** |
| `dish-kaya-toast` | Ah Seng Fish Soup | Kaya Toast Set | S$4.50 | **Yes** |
| `dish-pandan-cake` | Tian Tian | Pandan Cake | S$2.80 | No |
| `dish-wagyu-burger` | Monster Curry | Wagyu Burger | S$14.80 | No |
| `dish-salmon-don` | Pasta Express Maxwell | Salmon Don | S$12.80 | No |
| `dish-mala-xiang-guo` | Monster Curry | Mala Xiang Guo | S$9.80 | No |
| `dish-truffle-tagliatelle` | Pasta Express Maxwell | Wild Truffle Tagliatelle | S$28.00 | **Yes** |
| `dish-burrata-pizza` | Napoli Pizza LPS | Burrata & Prosciutto Pizza | S$24.00 | No |

### Other Fixtures

| Export | Count | Notes |
|--------|-------|-------|
| `stallPosts` | 8 | Home/social feed fixtures |
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
| Show toast | `showToast({ message, tone? })` |
| Dismiss toast | `clearToast()` |
| Review success modal | `showReviewSuccess(payload)` / `hideReviewSuccess()` |
| Scroll-back affordance | `registerScrollForBack(offsetY)` / `setScrollBackVisible(visible)` |

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

## Production Integration Source Policy

Mock fixtures remain valid for developer/prototype surfaces, but production-like user flows must share the same service-backed source across writers and readers.

| Flow | Write source | Read source | Public visibility rule |
|------|--------------|-------------|------------------------|
| Merchant stall/profile updates | Supabase `merchant_outlets` + linked `venues` | Consumer stall/detail repository reads `venues` | Verified merchant-owned outlet only; public user side reads published/live venue fields |
| Merchant dish/menu updates | Supabase `dishes` + `dish_images` / merchant image bucket | Consumer dish/detail/stall-menu repository reads `dishes` | Verified merchant-owned outlet only; draft/unsaved changes are not public |
| Post drafts | Supabase `posts.status = 'draft'` + optional `post_media` | Author-only draft surface | Author only |
| Published posts | Supabase `posts.status = 'published'` + `post_media` | Home feed, author profile, post detail | Public accounts visible to authenticated users; private accounts visible to author and approved followers |
| Deleted posts | Supabase `posts.status = 'deleted'` or `deleted_at` | No public route should render deleted content | Author/service cleanup only |
| Chat messages | Supabase `conversations`, `conversation_participants`, `messages` | Participant inbox/thread reads + realtime subscription | Conversation participants only |
| Read/unread state | Supabase `read_receipts` / participant `last_read_at` | Activity bell badge, inbox previews, chat thread | Conversation participants only |

Rules:
- Do not treat Zustand or AsyncStorage persistence as cross-user/shared persistence.
- Do not show save/publish/send success unless the service call has completed or an explicit optimistic rollback path exists.
- Do not let user-side screens import mock data directly except for developer-only routes and tests.
- Use run-id-prefixed data for integration tests and cleanup all rows/storage objects by that prefix.

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

---

## Image Storage Policy

Use this policy when Hungry moves image assets into Supabase Storage or another owned object store.

### Source Rules

| Source | Store permanently? | Notes |
|--------|--------------------|-------|
| User uploads | Yes | Resize/compress before upload; store review ownership metadata |
| Merchant uploads | Yes | Resize/compress before upload; allow cover/gallery management |
| Hungry seed images | Yes | Use app-owned or licensed assets only |
| Existing official/NEA URLs | Prefer reference URL first | Cache only when rights permit |
| Google Places photo metadata | Metadata only | Do not fetch/store photo media unless explicitly enabled and licensed for use |
| Random scraped web images | No | Avoid copyright, hotlinking, and reliability issues |

### Derivatives

Do not store raw originals by default. Store controlled derivatives:

| Variant | Target | Use |
|---------|--------|-----|
| `thumb` | 300px wide | Lists, cards, grid previews |
| `medium` | 900-1200px wide | Detail pages and feed media |
| `original` | Optional/admin only | Temporary retention for merchant/admin workflows |

Rules:
- Prefer WebP; use JPEG fallback where needed.
- Use quality `70-80`.
- Strip EXIF metadata.
- Cap final `medium` assets around `300-600KB`.
- Enforce upload limits before compression, e.g. `5MB` max incoming file.

### Storage Paths

```text
food-images/
  venues/{venue_id}/cover.webp
  venues/{venue_id}/gallery/{image_id}_medium.webp
  dishes/{dish_id}/thumb.webp
  dishes/{dish_id}/medium.webp
  reviews/{review_id}/{image_id}_thumb.webp
  reviews/{review_id}/{image_id}_medium.webp
```

### Metadata Contract

Store metadata in Postgres rather than storing blobs in tables.

```ts
interface StoredImageMetadata {
  id: string
  ownerEntityType: "venue" | "dish" | "review" | "profile"
  ownerEntityId: string
  storagePath: string
  publicUrl?: string
  width: number
  height: number
  sizeBytes: number
  blurhash?: string
  contentHash: string
  sourceType: "user_upload" | "merchant_upload" | "seed" | "official_reference" | "google_metadata"
  uploadedBy?: string
  createdAt: string
}
```

### Storage Controls

| Control | Default |
|---------|---------|
| Review photos | `3-5` per review |
| Merchant gallery | `10-20` images |
| Dish image | 1 primary image plus optional gallery only when needed |
| Duplicate detection | Hash original bytes and reuse existing stored asset |
| Cleanup | Scheduled deletion for orphaned paths not referenced by metadata |

Default Hungry policy:
- Reviews store `thumb` + `medium`, no original.
- Venue profiles store one `cover` plus bounded gallery images.
- Dish cards store one `thumb` and one `medium`.
- External image URLs remain references unless Hungry has the rights to cache them.
