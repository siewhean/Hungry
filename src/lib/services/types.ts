/**
 * Hungry — Universal Service Interface
 *
 * All data access in the app goes through this interface.
 * Swappable between mock (current) and live Supabase (future).
 */

import type {
  BlogPost,
  BuildingSummary,
  DishDetail,
  SearchFilters,
  StallPost,
  TasteVector,
  UserProfile,
  VenueSummary,
} from "@/types/domain";

// ─── Floor Plan Types ──────────────────────────────────────────────────────────

export type StallStatus = "open" | "closed" | "non_food";

export interface StallPolygon {
  /** Unique stall id → matches venueId when it's a food stall */
  stallId: string;
  unitNumber: string;
  /** SVG-space polygon points e.g. [[0,0],[100,0],[100,80],[0,80]] */
  polygon: [number, number][];
  status: StallStatus;
  /** venueId is set only for food stalls */
  venueId?: string;
  label?: string;
}

export interface FloorPlan {
  buildingId: string;
  floor: string;
  /** Logical canvas dimensions (SVG viewBox) */
  canvasWidth: number;
  canvasHeight: number;
  stalls: StallPolygon[];
}

// ─── Bites (Social) Types ─────────────────────────────────────────────────────

export interface TasteStamp {
  sweet: number;
  spicy: number;
  sour: number;
  salty: number;
  rich: number;
  aromatic: number;
}

export interface Bite {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  dishId: string;
  dishName: string;
  venueId: string;
  venueName: string;
  unitNumber: string;
  buildingId: string;
  buildingName: string;
  photoUrl: string;
  caption: string;
  tasteStamp: TasteStamp;
  cravingCount: number;
  savedCount: number;
  rating: number;
  price: number;
  expiresAt: string; // ISO 8601 — Bites expire after 7 days
  createdAt: string;
}

export interface BiteDraft {
  dishId: string;
  venueId: string;
  photoUrl: string;
  caption: string;
  tasteStamp: TasteStamp;
  rating: number;
}

// ─── AI / Recommendation Types ────────────────────────────────────────────────

export interface QuizAnswer {
  questionId: string;
  selectedOption: string;
  tasteImpact: Partial<TasteVector>;
}

export interface RecommendationContext {
  tasteProfile: TasteVector;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  excludeDishIds?: string[];
  timeOfDay?: "morning" | "lunch" | "afternoon" | "dinner" | "late_night";
}

export interface RecommendationResult {
  dish: DishDetail;
  matchScore: number; // 0–1 cosine similarity
  matchReason: string; // "Rich & aromatic — matches your taste profile"
}

// ─── Search Types ─────────────────────────────────────────────────────────────

export interface SearchResult {
  dish: DishDetail;
  score: number;
}

// ─── Session Types ────────────────────────────────────────────────────────────

export interface Session {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  profile: UserProfile;
}

// ─── Building Detail ──────────────────────────────────────────────────────────

export interface BuildingDetail extends BuildingSummary {
  address: string;
  postalCode: string;
  operatingHours: string;
  description?: string;
  famousDishes: string[];
  totalStalls: number;
  openStalls: number;
  avgRating: number;
}

// ─── Universal Service Interface ──────────────────────────────────────────────

export interface HungryService {
  // Auth
  auth: {
    signUp(email: string, password: string, name: string): Promise<Session>;
    signIn(email: string, password: string): Promise<Session>;
    signInWithGoogle(): Promise<Session>;
    signOut(): Promise<void>;
    forgotPassword(email: string): Promise<void>;
    resetPassword(token: string, password: string): Promise<void>;
    getCurrentSession(): Promise<Session | null>;
    refreshSession(): Promise<Session | null>;
  };

  // Discovery
  discovery: {
    listBuildings(lat?: number, lng?: number, radiusMeters?: number): Promise<BuildingSummary[]>;
    getBuildingDetail(id: string): Promise<BuildingDetail | undefined>;
    getFloorPlan(buildingId: string, floor: string): Promise<FloorPlan | undefined>;
    listFloors(buildingId: string): Promise<string[]>;
    getVenue(id: string): Promise<VenueSummary | undefined>;
    listVenuesByBuilding(buildingId: string): Promise<VenueSummary[]>;
    getDish(id: string): Promise<DishDetail | undefined>;
    listDishesByVenue(venueId: string): Promise<DishDetail[]>;
    listPopularNearby(lat?: number, lng?: number): Promise<DishDetail[]>;
    searchDishes(filters: SearchFilters, tasteProfile: TasteVector): Promise<SearchResult[]>;
    decideForMe(tasteProfile: TasteVector, lat?: number, lng?: number): Promise<DishDetail | undefined>;
  };

  // Reviews
  reviews: {
    getReviewsForDish(dishId: string): Promise<DishDetail["reviews"]>;
    getUserReviews(userId: string): Promise<DishDetail["reviews"]>;
    submitReview(draft: {
      dishId: string;
      venueId: string;
      rating: number;
      text: string;
      tags: string[];
      photos: string[];
    }): Promise<void>;
  };

  // Profile
  profile: {
    getProfile(): Promise<UserProfile>;
    updateProfile(updates: Partial<UserProfile>): Promise<UserProfile>;
    getGuestProfile(): Promise<UserProfile>;
    toggleFavourite(dishId: string): Promise<boolean>;
    getFavouriteDishIds(): Promise<string[]>;
    updateTasteVector(vector: TasteVector): Promise<void>;
  };

  // Social (Bites)
  social: {
    getBitesFeed(lat?: number, lng?: number): Promise<Bite[]>;
    postBite(draft: BiteDraft): Promise<Bite>;
    reactToBite(biteId: string, reaction: "craving" | "save"): Promise<void>;
  };

  // Content
  content: {
    listArticles(): Promise<BlogPost[]>;
    listStallPosts(): Promise<StallPost[]>;
    getArticle(id: string): Promise<BlogPost | undefined>;
  };

  // AI
  ai: {
    computeTasteVector(answers: QuizAnswer[]): TasteVector;
    getSmartRecommendations(ctx: RecommendationContext): Promise<RecommendationResult[]>;
    adjustCommunityTasteVector(
      dishId: string,
      userRating: Partial<TasteVector>
    ): Promise<void>;
    explainMatch(
      userVector: TasteVector,
      dishVector: TasteVector
    ): string;
  };
}
