/**
 * Hungry — Full Mock Implementation of HungryService
 *
 * Implements all 41 methods across 6 domains. Every method returns a Promise
 * so the call sites are identical to the future Supabase implementation.
 *
 * Swap: replace `hungryService` export with a Supabase adapter when ready.
 */

import { getFloorPlan } from "@/lib/geo/floorPlans";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { blogPosts, buildings, dishes, guestProfile, stallPosts, userProfile, venues } from "./data";
import { mockRepository, similarityScore } from "./repositories";
import type {
  Bite,
  BiteDraft,
  BuildingDetail,
  HungryService,
  QuizAnswer,
  RecommendationContext,
  RecommendationResult,
  SearchResult,
  Session,
} from "@/lib/services/types";
import type {
  BlogPost,
  DishDetail,
  SearchFilters,
  TasteVector,
  UserProfile,
  VenueSummary,
} from "@/types/domain";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate async latency (0 in test/mock — just ticks the microtask queue) */
function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/** Cosine similarity between two TasteVectors, 0–1 */
const cosine = similarityScore;

function matchReason(userVec: TasteVector, dishVec: TasteVector): string {
  const keys = Object.keys(userVec) as Array<keyof TasteVector>;
  const topKey = keys.reduce((best, k) =>
    dishVec[k] > dishVec[best] ? k : best
  );
  const labels: Record<keyof TasteVector, string> = {
    sweet: "Sweet",
    spicy: "Spicy",
    sour: "Tangy",
    salty: "Savoury",
    rich: "Rich & umami",
    aromatic: "Aromatic",
  };
  return `${labels[topKey]} — matches your taste profile`;
}

// ─── Mutable in-memory state (mirrors what Supabase would persist) ─────────────

let _profile: UserProfile = { ...guestProfile };
let _isAuthenticated = false;
const _biteReactions: Record<string, { cravings: Set<string>; saves: Set<string> }> = {};

// ─── Mock session ─────────────────────────────────────────────────────────────

function mockSession(profile: UserProfile): Session {
  return {
    userId: profile.id,
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    profile,
  };
}

// ─── Mock bites feed ─────────────────────────────────────────────────────────

const MOCK_BITES_FEED: Bite[] = [
  {
    id: "bite-feed-1",
    authorId: "user-sarah",
    authorName: "Sarah L",
    authorAvatar: "https://i.pravatar.cc/64?img=5",
    dishId: "dish-chicken-rice",
    dishName: "Chicken Rice",
    venueId: "venue-tian-tian",
    venueName: "Tian Tian Hainanese",
    unitNumber: "#01-10",
    buildingId: "building-maxwell",
    buildingName: "Maxwell Food Centre",
    photoUrl: "https://images.unsplash.com/photo-1605098702935-b61af3b4ff3d?w=800",
    caption: "Still the gold standard after 10 years. Not a drop of oil wasted.",
    tasteStamp: { sweet: 2, spicy: 1, sour: 1, salty: 7, rich: 6, aromatic: 5 },
    cravingCount: 512,
    savedCount: 89,
    rating: 5,
    price: 5.5,
    expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
  },
  {
    id: "bite-feed-2",
    authorId: "user-wei-ming",
    authorName: "Wei Ming",
    authorAvatar: "https://i.pravatar.cc/64?img=11",
    dishId: "dish-char-kway-teow",
    dishName: "Char Kway Teow",
    venueId: "venue-old-airport-char-kway-teow",
    venueName: "Lao Fu Zi CKT",
    unitNumber: "#01-12",
    buildingId: "building-old-airport-road",
    buildingName: "Old Airport Road Food Centre",
    photoUrl: "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800",
    caption: "Smoky wok hei, perfectly charred with big juicy cockles 🔥",
    tasteStamp: { sweet: 1, spicy: 5, sour: 1, salty: 7, rich: 7, aromatic: 6 },
    cravingCount: 284,
    savedCount: 41,
    rating: 5,
    price: 4.0,
    expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
  {
    id: "bite-feed-3",
    authorId: "user-emma",
    authorName: "Emma C",
    authorAvatar: "https://i.pravatar.cc/64?img=47",
    dishId: "dish-laksa",
    dishName: "Laksa",
    venueId: "venue-maxwell-laksa",
    venueName: "Old School Laksa",
    unitNumber: "#01-37",
    buildingId: "building-maxwell",
    buildingName: "Maxwell Food Centre",
    photoUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800",
    caption: "Thick coconut broth, tons of cockles. Queue 20min — worth every second.",
    tasteStamp: { sweet: 3, spicy: 6, sour: 2, salty: 6, rich: 8, aromatic: 7 },
    cravingCount: 349,
    savedCount: 67,
    rating: 5,
    price: 5.0,
    expiresAt: new Date(Date.now() + 4 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 8 * 3600_000).toISOString(),
  },
];

// ─── Building detail lookups ──────────────────────────────────────────────────

const BUILDING_DETAILS: Record<string, Omit<BuildingDetail, keyof typeof buildings[number]>> = {
  "building-maxwell": {
    address: "1 Kadayanallur St, Singapore 069184",
    postalCode: "069184",
    operatingHours: "Mon–Sun 06:00–22:00",
    description: "One of Singapore's most iconic hawker centres, home to the famous Tian Tian Chicken Rice.",
    famousDishes: ["Chicken Rice", "Laksa", "Indian Rojak", "Cheng Tng"],
    totalStalls: 100,
    openStalls: 85,
    avgRating: 4.5,
  },
  "building-lau-pa-sat": {
    address: "18 Raffles Quay, Singapore 048582",
    postalCode: "048582",
    operatingHours: "Mon–Sun 24 hours (Satay Street from 19:00)",
    description: "A Victorian cast-iron market gazetted as a national monument, famed for satay at night.",
    famousDishes: ["Satay", "Stingray", "Kopi"],
    totalStalls: 80,
    openStalls: 60,
    avgRating: 4.3,
  },
  "building-amoy": {
    address: "7 Maxwell Rd, Singapore 069111",
    postalCode: "069111",
    operatingHours: "Mon–Fri 07:30–14:30",
    description: "A lunchtime favourite with office crowds, known for thunder tea rice and ban mian.",
    famousDishes: ["Thunder Tea Rice", "Ban Mian", "Fish Soup"],
    totalStalls: 70,
    openStalls: 0,
    avgRating: 4.4,
  },
  "building-old-airport-road": {
    address: "51 Old Airport Rd, Singapore 390051",
    postalCode: "390051",
    operatingHours: "Mon–Sun 06:00–23:00",
    description: "One of Singapore's largest and oldest hawker centres. A pilgrimage site for food lovers.",
    famousDishes: ["Char Kway Teow", "Lor Mee", "Hokkien Mee"],
    totalStalls: 150,
    openStalls: 130,
    avgRating: 4.6,
  },
  "building-tiong-bahru": {
    address: "30 Seng Poh Rd, Singapore 168898",
    postalCode: "168898",
    operatingHours: "Mon–Sun 06:00–21:00",
    description: "Beloved neighbourhood market in Singapore's oldest housing estate, known for Shui Kueh.",
    famousDishes: ["Choon Kueh", "Chwee Kueh", "Char Kway Teow"],
    totalStalls: 83,
    openStalls: 70,
    avgRating: 4.4,
  },
  "building-food-republic-wisma": {
    address: "435 Orchard Rd, #04-01 Wisma Atria, Singapore 238877",
    postalCode: "238877",
    operatingHours: "Mon–Sun 10:00–22:00",
    description: "Upscale food court in the heart of Orchard Road with a focus on local heritage cuisine.",
    famousDishes: ["Sambal Seafood", "Claypot Rice"],
    totalStalls: 40,
    openStalls: 38,
    avgRating: 4.1,
  },
  "building-koufu-jem": {
    address: "50 Jurong Gateway Rd, #03-01 Jem, Singapore 608549",
    postalCode: "608549",
    operatingHours: "Mon–Sun 10:00–22:00",
    description: "Modern food court serving a mix of local and international fare in Jurong East.",
    famousDishes: ["Japanese Curry", "Yong Tau Foo"],
    totalStalls: 35,
    openStalls: 33,
    avgRating: 4.0,
  },
};

// ─── Full HungryService implementation ───────────────────────────────────────

export const hungryService: HungryService = {
  // ── Auth ────────────────────────────────────────────────────────────────────

  auth: {
    async signUp(email, _password, name) {
      _isAuthenticated = true;
      _profile = {
        ...userProfile,
        id: `user-${Date.now()}`,
        email,
        displayName: name,
        favouriteDishIds: [],
        reviewedDishIds: [],
        stats: { dishesReviewed: 0, stallsVisited: 0, favouritesCount: 0 },
      };
      return resolve(mockSession(_profile));
    },

    async signIn(email, _password) {
      _isAuthenticated = true;
      _profile = { ...userProfile, email };
      return resolve(mockSession(_profile));
    },

    async signInWithGoogle() {
      _isAuthenticated = true;
      _profile = { ...userProfile };
      return resolve(mockSession(_profile));
    },

    async signOut() {
      _isAuthenticated = false;
      _profile = { ...guestProfile };
      return resolve(undefined);
    },

    async forgotPassword(_email) {
      // Mock: no-op — in production sends a reset email
      return resolve(undefined);
    },

    async resetPassword(_token, _password) {
      // Mock: no-op — in production verifies token and updates password
      return resolve(undefined);
    },

    async getCurrentSession() {
      if (!_isAuthenticated) return resolve(null);
      return resolve(mockSession(_profile));
    },

    async refreshSession() {
      if (!_isAuthenticated) return resolve(null);
      return resolve(mockSession(_profile));
    },
  },

  // ── Discovery ───────────────────────────────────────────────────────────────

  discovery: {
    async listBuildings(_lat?, _lng?, _radiusMeters?) {
      return resolve([...buildings]);
    },

    async getBuildingDetail(id) {
      const building = buildings.find((b) => b.id === id);
      if (!building) return resolve(undefined);
      const extra = BUILDING_DETAILS[id];
      if (!extra) return resolve({ ...building, address: "", postalCode: "", operatingHours: "", famousDishes: [], totalStalls: building.venueCount, openStalls: building.venueCount, avgRating: 4.0 });
      return resolve({ ...building, ...extra } as BuildingDetail);
    },

    async getFloorPlan(buildingId, floor) {
      // getFloorPlan always returns a plan (generic fallback if no custom one exists)
      return resolve(getFloorPlan(buildingId, floor));
    },

    async listFloors(buildingId) {
      const building = buildings.find((b) => b.id === buildingId);
      return resolve(building?.floors ?? []);
    },

    async getVenue(id) {
      return resolve(venues.find((v) => v.id === id));
    },

    async listVenuesByBuilding(buildingId) {
      return resolve(venues.filter((v) => v.buildingId === buildingId));
    },

    async getDish(id) {
      return resolve(dishes.find((d) => d.id === id));
    },

    async listDishesByVenue(venueId) {
      return resolve(dishes.filter((d) => d.venueId === venueId));
    },

    async listPopularNearby(_lat?, _lng?) {
      return resolve(
        [...dishes].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 6)
      );
    },

    async searchDishes(filters: SearchFilters, tasteProfile: TasteVector): Promise<SearchResult[]> {
      const results = mockRepository.searchDishes(filters, tasteProfile);
      return resolve(
        results.map((dish) => ({
          dish,
          score: cosine(dish.tasteVector, tasteProfile),
        }))
      );
    },

    async decideForMe(tasteProfile, _lat?, _lng?) {
      return resolve(mockRepository.getDecideForMe(tasteProfile));
    },
  },

  // ── Reviews ─────────────────────────────────────────────────────────────────

  reviews: {
    async getReviewsForDish(dishId) {
      const dish = dishes.find((d) => d.id === dishId);
      return resolve(dish?.reviews ?? []);
    },

    async getUserReviews(_userId) {
      // Mock: return the demo user's reviews (keyed by reviewedDishIds)
      const reviewedDishes = _profile.reviewedDishIds
        .map((id) => dishes.find((d) => d.id === id))
        .filter(Boolean);
      const reviews = reviewedDishes.flatMap((d) => (d?.reviews ?? []).slice(0, 1));
      return resolve(reviews);
    },

    async submitReview(draft) {
      // Mock: persist the reviewed dish into the in-memory profile
      if (!_profile.reviewedDishIds.includes(draft.dishId)) {
        _profile = {
          ..._profile,
          reviewedDishIds: [..._profile.reviewedDishIds, draft.dishId],
          stats: {
            ..._profile.stats,
            dishesReviewed: _profile.stats.dishesReviewed + 1,
          },
        };
      }
      return resolve(undefined);
    },
  },

  // ── Profile ─────────────────────────────────────────────────────────────────

  profile: {
    async getProfile() {
      return resolve({ ..._profile });
    },

    async updateProfile(updates) {
      _profile = { ..._profile, ...updates } as UserProfile;
      return resolve({ ..._profile });
    },

    async getGuestProfile() {
      return resolve({ ...guestProfile });
    },

    async toggleFavourite(dishId) {
      const isFav = _profile.favouriteDishIds.includes(dishId);
      _profile = {
        ..._profile,
        favouriteDishIds: isFav
          ? _profile.favouriteDishIds.filter((id) => id !== dishId)
          : [..._profile.favouriteDishIds, dishId],
        stats: {
          ..._profile.stats,
          favouritesCount: isFav
            ? _profile.stats.favouritesCount - 1
            : _profile.stats.favouritesCount + 1,
        },
      };
      return resolve(!isFav);
    },

    async getFavouriteDishIds() {
      return resolve([..._profile.favouriteDishIds]);
    },

    async updateTasteVector(vector) {
      _profile = { ..._profile, tasteVector: vector };
      return resolve(undefined);
    },
  },

  // ── Social (Bites) ──────────────────────────────────────────────────────────

  social: {
    async getBitesFeed(_lat?, _lng?) {
      return resolve([...MOCK_BITES_FEED]);
    },

    async postBite(draft: BiteDraft) {
      const venue = venues.find((v) => v.id === draft.venueId);
      const building = buildings.find((b) => b.id === venue?.buildingId);
      const newBite: Bite = {
        id: `bite-${Date.now()}`,
        authorId: _profile.id,
        authorName: _profile.displayName,
        authorAvatar: undefined,
        dishId: draft.dishId,
        dishName: dishes.find((d) => d.id === draft.dishId)?.name ?? "Unknown dish",
        venueId: draft.venueId,
        venueName: venue?.name ?? "Unknown stall",
        unitNumber: venue?.unitNumber ?? "",
        buildingId: venue?.buildingId ?? "",
        buildingName: building?.name ?? "",
        photoUrl: draft.photoUrl,
        caption: draft.caption,
        tasteStamp: draft.tasteStamp,
        cravingCount: 0,
        savedCount: 0,
        rating: draft.rating,
        price: dishes.find((d) => d.id === draft.dishId)?.priceRange === "$" ? 4.5 : 8.0,
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      MOCK_BITES_FEED.unshift(newBite);
      return resolve(newBite);
    },

    async reactToBite(biteId, reaction) {
      if (!_biteReactions[biteId]) {
        _biteReactions[biteId] = { cravings: new Set(), saves: new Set() };
      }
      const userId = _profile.id;
      const bucket = reaction === "craving" ? "cravings" : "saves";
      const set = _biteReactions[biteId][bucket];
      if (set.has(userId)) {
        set.delete(userId);
      } else {
        set.add(userId);
      }
      return resolve(undefined);
    },
  },

  // ── Content ─────────────────────────────────────────────────────────────────

  content: {
    async listArticles() {
      return resolve([...blogPosts]);
    },

    async listStallPosts() {
      return resolve([...stallPosts]);
    },

    async getArticle(id) {
      return resolve(blogPosts.find((p) => p.id === id));
    },
  },

  // ── AI ───────────────────────────────────────────────────────────────────────

  ai: {
    computeTasteVector(answers: QuizAnswer[]): TasteVector {
      const result: TasteVector = { ...NEUTRAL_TASTE_VECTOR };
      for (const answer of answers) {
        const impact = answer.tasteImpact;
        for (const key of Object.keys(impact) as Array<keyof TasteVector>) {
          result[key] = Math.min(10, Math.max(0, result[key] + (impact[key] ?? 0)));
        }
      }
      return result;
    },

    async getSmartRecommendations(ctx: RecommendationContext): Promise<RecommendationResult[]> {
      const candidates = dishes.filter((d) => {
        const withinRadius = d.distanceMeters <= (ctx.radiusMeters ?? 800);
        const notExcluded = !(ctx.excludeDishIds ?? []).includes(d.id);
        return withinRadius && notExcluded;
      });

      return resolve(
        candidates
          .map((dish) => ({
            dish,
            matchScore: cosine(ctx.tasteProfile, dish.tasteVector),
            matchReason: matchReason(ctx.tasteProfile, dish.tasteVector),
          }))
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 10)
      );
    },

    async adjustCommunityTasteVector(_dishId, _userRating) {
      // Mock: no-op — in production aggregates community ratings for the dish
      return resolve(undefined);
    },

    explainMatch(userVector, dishVector) {
      const score = Math.round(cosine(userVector, dishVector) * 100);
      return `${score}% taste match — ${matchReason(userVector, dishVector)}`;
    },
  },
};
