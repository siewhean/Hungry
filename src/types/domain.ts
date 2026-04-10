export type TasteKey =
  | "sweet"
  | "spicy"
  | "sour"
  | "salty"
  | "rich"
  | "aromatic";

export interface TasteVector {
  sweet: number;
  spicy: number;
  sour: number;
  salty: number;
  rich: number;
  aromatic: number;
}

export type BuildingType = "hawker_centre" | "food_court" | "restaurant";
export type HygieneGrade = "A" | "B" | "C" | "D";
export type DeliveryPlatform = "grabfood" | "foodpanda";
export type DietaryFlag =
  | "halal"
  | "vegetarian"
  | "vegan"
  | "pork_free"
  | "nut_free"
  | "gluten_free";
export type SearchCategory =
  | "local favourites"
  | "noodles"
  | "rice"
  | "desserts"
  | "late night";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface DeliveryLink {
  platform: DeliveryPlatform;
  nativeUrl: string;
  webUrl: string;
  affiliateEligible: boolean;
}

export interface BuildingSummary {
  id: string;
  name: string;
  type: BuildingType;
  coordinate: Coordinate;
  floors: string[];
  venueCount: number;
  isClosedToday: boolean;
  heroDishId: string;
}

export interface VenueSummary {
  id: string;
  buildingId: string;
  name: string;
  unitNumber: string;
  floor: string;
  hygieneGrade: HygieneGrade;
  isOpen: boolean;
  topDishId: string;
  operatingHours: string;
  closureNotice?: string;
  deliveryLinks: DeliveryLink[];
}

export interface DishSummary {
  id: string;
  venueId: string;
  buildingId: string;
  venueName: string;
  unitNumber: string;
  floor: string;
  name: string;
  imageUrl: string;
  blurhash?: string;
  distanceMeters: number;
  rating: number;
  reviewCount: number;
  price: number;
  priceRange: string;
  tasteTags: string[];
  tasteVector: TasteVector;
  dietaryFlags: DietaryFlag[];
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  createdAt: string;
  text: string;
  tags: string[];
  wouldRecommend: boolean;
  photos: string[];
}

export interface DishDetail extends DishSummary {
  gallery: string[];
  mustOrder: boolean;
  availabilityFlags: string[];
  reviews: Review[];
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  area: string;
  sourceName: string;
  sourceLogo: string;
  imageUrl: string;
  url: string;
  relatedVenueId?: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  tasteVector: TasteVector;
  dietaryPreferences: DietaryFlag[];
  favouriteDishIds: string[];
  reviewedDishIds: string[];
  stats: {
    dishesReviewed: number;
    stallsVisited: number;
    favouritesCount: number;
  };
}

export interface ReviewDraft {
  selectedVenueId?: string;
  selectedDishId?: string;
  rating: number;
  selectedTags: string[];
  recommend: boolean;
  text: string;
  photos: string[];
}

export interface SearchFilters {
  query: string;
  categories: SearchCategory[];
  dietaryFlags: DietaryFlag[];
  tasteValues: TasteVector;
  radius: number;
}

export interface StallPost {
  id: string;
  venueId: string;
  buildingId: string;
  authorName: string;
  authorLocation: string;
  authorAvatarUrl: string;
  mediaType: "photo" | "video";
  mediaUrl: string;
  caption: string;
  dishIds: string[];
  createdAt: string;
}

export interface AppSession {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  hasSkippedTasteQuiz: boolean;
  returnRoute?: string | { name: string; params?: Record<string, unknown> };
}

// ─── Hungry Wheel ────────────────────────────────────────────────────────────

export type WheelSpinMode = "classic" | "elimination";
export type WheelTriggerMode = "manual" | "countdown" | "scheduled" | "timed_range";
export type PartyStatus = "lobby" | "spinning" | "resolved";

export type TriggerValue =
  | { type: "countdown"; durationMs: number }
  | { type: "scheduled"; scheduledAt: string }
  | { type: "timed_range"; rangeStart: string; rangeEnd: string };

export interface WheelParty {
  id: string;
  code: string;
  hostUserId: string;
  status: PartyStatus;
  spinMode: WheelSpinMode;
  triggerMode: WheelTriggerMode;
  triggerValue?: TriggerValue;
  /** Server-generated seed; every client derives winner from this. */
  spinSeed?: number;
  /** Unix ms when the spin animation was broadcast. */
  spinStartedAt?: number;
  /** Fixed animation duration shared by all clients (ms). */
  spinDurationMs: number;
  winnerEntryId?: string;
  currentRound: number;
  createdAt: string;
  expiresAt: string;
}

export interface WheelMember {
  id: string;
  partyId: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  isPresent: boolean;
  joinedAt: string;
}

export interface WheelEntry {
  id: string;
  partyId: string;
  addedByMemberId: string;
  venueId: string;
  buildingId: string;
  label: string;
  imageUrl: string;
  isEliminated: boolean;
  eliminatedInRound?: number;
  position: number;
  addedAt: string;
}

/** Realtime broadcast event shapes ───────────────────────────────── */
export type WheelChannelEvent =
  | { type: "entry_added"; entry: WheelEntry }
  | { type: "entry_removed"; entryId: string }
  | { type: "spin_triggered"; seed: number; startedAt: number; activeEntryIds: string[] }
  | { type: "round_resolved"; eliminatedEntryId: string; nextRound: number }
  | { type: "party_resolved"; winnerEntryId: string }
  | { type: "trigger_update"; triggerMode: WheelTriggerMode; triggerValue?: TriggerValue }
  | { type: "member_joined"; member: WheelMember }
  | { type: "member_left"; memberId: string };
