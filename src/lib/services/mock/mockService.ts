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
import { similarityScore } from "@/lib/ai/similarityScore";
import {
  blogPosts,
  buildings,
  dishes,
  guestProfile,
  stallPosts,
  userProfile,
  venues,
} from "./data";
import { mockRepository } from "./repositories";
import { assertFixtureBundleValid } from "./validation";
import type {
  Bite,
  BiteDraft,
  BuildingDetail,
  ExplicitFeedbackInput,
  ExtendedRecommendationContext,
  HungryService,
  ImplicitSignalInput,
  QuizAnswer,
  RankedRecommendation,
  RecommendationContext,
  RecommendationResult,
  ScenarioQuizAnswer,
  SearchResult,
  Session,
  SubmitReviewInput,
} from "@/lib/services/types";
import type {
  DietaryFlag,
  HawkerTasteTag,
  SearchFilters,
  TasteProfile,
  TasteVector,
  UserProfile,
} from "@/types/domain";
import { computeTasteProfileFromQuiz } from "@/lib/ai/tasteQuiz";
import {
  runRecommendationPipeline,
  processExplicitFeedback as processExplicitFeedbackCore,
  processImplicitFeedback as processImplicitFeedbackCore,
} from "@/lib/ai/tasteEngine";
import type { ExplicitFeedbackEvent, ImplicitSignal } from "@/lib/ai/tasteEngine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate async latency (0 in test/mock — just ticks the microtask queue) */
function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/** Cosine similarity between two TasteVectors, 0–1 */
const cosine = similarityScore;

function matchReason(userVec: TasteVector, dishVec: TasteVector): string {
  const keys = Object.keys(userVec) as (keyof TasteVector)[];
  const topKey = keys.reduce((best, k) => (dishVec[k] > dishVec[best] ? k : best));
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
const _merchantClaimInterests = new Set<string>();

if (typeof __DEV__ !== "undefined" && __DEV__) {
  // TODO(api): keep fixture validation while mock mode is active; remove once backend contracts are fully live.
  assertFixtureBundleValid();
}

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

const BUILDING_DETAILS: Record<string, Omit<BuildingDetail, keyof (typeof buildings)[number]>> = {
  "building-maxwell": {
    address: "1 Kadayanallur St, Singapore 069184",
    postalCode: "069184",
    operatingHours: "Mon–Sun 06:00–22:00",
    description:
      "One of Singapore's most iconic hawker centres, home to the famous Tian Tian Chicken Rice.",
    famousDishes: ["Chicken Rice", "Laksa", "Indian Rojak", "Cheng Tng"],
    totalStalls: 100,
    openStalls: 85,
    avgRating: 4.5,
  },
  "building-lau-pa-sat": {
    address: "18 Raffles Quay, Singapore 048582",
    postalCode: "048582",
    operatingHours: "Mon–Sun 24 hours (Satay Street from 19:00)",
    description:
      "A Victorian cast-iron market gazetted as a national monument, famed for satay at night.",
    famousDishes: ["Satay", "Stingray", "Kopi"],
    totalStalls: 80,
    openStalls: 60,
    avgRating: 4.3,
  },
  "building-amoy": {
    address: "7 Maxwell Rd, Singapore 069111",
    postalCode: "069111",
    operatingHours: "Mon–Fri 07:30–14:30",
    description:
      "A lunchtime favourite with office crowds, known for thunder tea rice and ban mian.",
    famousDishes: ["Thunder Tea Rice", "Ban Mian", "Fish Soup"],
    totalStalls: 70,
    openStalls: 0,
    avgRating: 4.4,
  },
  "building-old-airport-road": {
    address: "51 Old Airport Rd, Singapore 390051",
    postalCode: "390051",
    operatingHours: "Mon–Sun 06:00–23:00",
    description:
      "One of Singapore's largest and oldest hawker centres. A pilgrimage site for food lovers.",
    famousDishes: ["Char Kway Teow", "Lor Mee", "Hokkien Mee"],
    totalStalls: 150,
    openStalls: 130,
    avgRating: 4.6,
  },
  "building-tiong-bahru": {
    address: "30 Seng Poh Rd, Singapore 168898",
    postalCode: "168898",
    operatingHours: "Mon–Sun 06:00–21:00",
    description:
      "Beloved neighbourhood market in Singapore's oldest housing estate, known for Shui Kueh.",
    famousDishes: ["Choon Kueh", "Chwee Kueh", "Char Kway Teow"],
    totalStalls: 83,
    openStalls: 70,
    avgRating: 4.4,
  },
  "building-food-republic-wisma": {
    address: "435 Orchard Rd, #04-01 Wisma Atria, Singapore 238877",
    postalCode: "238877",
    operatingHours: "Mon–Sun 10:00–22:00",
    description:
      "Upscale food court in the heart of Orchard Road with a focus on local heritage cuisine.",
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

    async resendVerificationEmail(_email) {
      return resolve(undefined);
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

    async signInWithApple() {
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
      if (!extra)
        return resolve({
          ...building,
          address: "",
          postalCode: "",
          operatingHours: "",
          famousDishes: [],
          totalStalls: building.venueCount,
          openStalls: building.venueCount,
          avgRating: 4.0,
        });
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
      return resolve([...dishes].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 6));
    },

    async searchDishes(filters: SearchFilters, tasteProfile: TasteVector): Promise<SearchResult[]> {
      const results = mockRepository.searchDishes(filters, tasteProfile);
      return resolve(
        results.map((dish) => ({
          dish,
          score: cosine(dish.tasteVector, tasteProfile),
        })),
      );
    },

    async decideForMe(tasteProfile, _lat?, _lng?) {
      return resolve(
        mockRepository.getDecideForMe(tasteProfile, {
          dietaryFlags: _profile.dietaryPreferences,
          neophiliaIndex: _profile.tasteProfile?.neophiliaIndex ?? 5,
          radiusMeters: 500,
          latitude: _lat,
          longitude: _lng,
        }),
      );
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

    async submitReview(draft: SubmitReviewInput) {
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

    async updateDietaryPreferences(flags: DietaryFlag[]) {
      _profile = { ..._profile, dietaryPreferences: flags };
      return resolve(undefined);
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

    async updateTasteProfile(profile) {
      _profile = {
        ..._profile,
        tasteVector: profile.vector,
        tasteProfile: profile,
      };
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
    // Legacy methods (backward-compatible)
    computeTasteVector(answers: QuizAnswer[]): TasteVector {
      const result: TasteVector = { ...NEUTRAL_TASTE_VECTOR };
      for (const answer of answers) {
        const impact = answer.tasteImpact;
        for (const key of Object.keys(impact) as (keyof TasteVector)[]) {
          result[key] = Math.min(10, Math.max(0, result[key] + (impact[key] ?? 0)));
        }
      }
      return result;
    },

    async getSmartRecommendations(ctx: RecommendationContext): Promise<RecommendationResult[]> {
      const results = runRecommendationPipeline(dishes, {
        userVector: ctx.tasteProfile,
        dietaryFlags: _profile.dietaryPreferences,
        neophiliaIndex: _profile.tasteProfile?.neophiliaIndex ?? 5,
        latitude: ctx.latitude,
        longitude: ctx.longitude,
        radiusMeters: ctx.radiusMeters,
        excludeDishIds: ctx.excludeDishIds,
      })
        .slice(0, 10)
        .map((result) => {
          const dish = dishes.find((item) => item.id === result.dishId);
          if (!dish) {
            return undefined;
          }

          return {
            dish,
            matchScore: result.score,
            matchReason: result.explanation,
          };
        })
        .filter((recommendation): recommendation is RecommendationResult =>
          Boolean(recommendation),
        );

      return resolve(results);
    },

    async adjustCommunityTasteVector(_dishId, _userRating) {
      // Mock: no-op — in production aggregates community ratings for the dish
      return resolve(undefined);
    },

    explainMatch(userVector, dishVector) {
      const score = Math.round(cosine(userVector, dishVector) * 100);
      return `${score}% taste match — ${matchReason(userVector, dishVector)}`;
    },

    // Extended — Scenario Quiz
    computeTasteProfile(answers: ScenarioQuizAnswer[]): TasteProfile {
      return computeTasteProfileFromQuiz(answers);
    },

    // Extended — Full Recommendation Pipeline
    async getContextualRecommendations(
      ctx: ExtendedRecommendationContext,
    ): Promise<RankedRecommendation[]> {
      const pipelineResults = runRecommendationPipeline(dishes, {
        userVector: ctx.tasteProfile.vector,
        dietaryFlags: ctx.dietaryFlags,
        neophiliaIndex: ctx.tasteProfile.neophiliaIndex,
        latitude: ctx.latitude,
        longitude: ctx.longitude,
        radiusMeters: ctx.radiusMeters,
        excludeDishIds: ctx.excludeDishIds,
      });

      // Map pipeline results back to RankedRecommendation (with full DishDetail)
      const results: RankedRecommendation[] = pipelineResults
        .map((pr) => {
          const dish = dishes.find((d) => d.id === pr.dishId);
          if (!dish) return null;
          return {
            dish,
            matchScore: pr.score,
            matchPercent: pr.matchPercent,
            matchReason: pr.explanation,
            isSerendipitous: pr.isSerendipitous,
          };
        })
        .filter((r): r is RankedRecommendation => r !== null);

      return resolve(results);
    },

    // Extended — Feedback Processing
    async processExplicitFeedback(feedback: ExplicitFeedbackInput): Promise<TasteVector> {
      const dish = dishes.find((d) => d.id === feedback.dishId);
      if (!dish) return resolve(_profile.tasteVector);

      // Map input to core feedback event
      let feedbackType: ExplicitFeedbackEvent["type"] = "rating_3_star";
      if (feedback.feedbackType === "rating" && feedback.rating !== undefined) {
        const ratingMap: Record<number, ExplicitFeedbackEvent["type"]> = {
          5: "rating_5_star",
          4: "rating_4_star",
          3: "rating_3_star",
          2: "rating_2_star",
          1: "rating_1_star",
        };
        feedbackType = ratingMap[feedback.rating] ?? "rating_3_star";
      } else if (feedback.feedbackType === "save") {
        feedbackType = "saved";
      } else if (feedback.feedbackType === "unsave") {
        feedbackType = "unsaved";
      } else if (feedback.feedbackType === "hawker_tag") {
        feedbackType = "hawker_tag_positive";
      }

      const updatedVector = processExplicitFeedbackCore(_profile.tasteVector, {
        type: feedbackType,
        dishVector: dish.tasteVector,
        hawkerTags: feedback.hawkerTags,
      });

      _profile = { ..._profile, tasteVector: updatedVector };
      return resolve(updatedVector);
    },

    async processImplicitFeedback(signals: ImplicitSignalInput[]): Promise<TasteVector> {
      const coreSignals: ImplicitSignal[] = signals
        .map((s) => {
          const dish = dishes.find((d) => d.id === s.dishId);
          if (!dish) return null;
          return {
            type: s.type,
            dishVector: dish.tasteVector,
            timestamp: s.timestamp,
          };
        })
        .filter((s): s is ImplicitSignal => s !== null);

      const updatedVector = processImplicitFeedbackCore(_profile.tasteVector, coreSignals);
      _profile = { ..._profile, tasteVector: updatedVector };
      return resolve(updatedVector);
    },

    // Extended — Community Calibration
    async getTagSuggestions(dishId: string): Promise<HawkerTasteTag[]> {
      const dish = dishes.find((d) => d.id === dishId);
      if (!dish) return resolve([]);

      // Mock heuristic: suggest tags based on the dish's taste vector
      const suggestions: HawkerTasteTag[] = [];
      if (dish.tasteVector.aromatic >= 7) suggestions.push("wok_hei");
      if (dish.tasteVector.rich >= 7) suggestions.push("lemak");
      if (dish.tasteVector.spicy >= 7) suggestions.push("hiam");
      if (dish.tasteVector.rich >= 6 && dish.tasteVector.salty >= 6) suggestions.push("sedap");
      if (dish.tasteVector.salty >= 7 && dish.tasteVector.aromatic >= 6) suggestions.push("shiok");

      // Always suggest at most 3
      return resolve(suggestions.slice(0, 3));
    },

    async submitCommunityTags(_dishId: string, _tags: HawkerTasteTag[]): Promise<void> {
      // Mock: no-op — in production updates the dish's community taste vector
      return resolve(undefined);
    },
  },

  supply: {
    async submitMenuPhoto(input) {
      return resolve({
        submissionId: `mock-menu-photo-${Date.now()}`,
        storagePath: `menu-photos/mock/${input.venueId}/${Date.now()}.jpg`,
      });
    },

    async submitMerchantClaimInterest(input) {
      if (!_isAuthenticated) {
        throw new Error("You must be signed in to claim a stall.");
      }

      const claimKey = `${_profile.id}:${input.venueId}`;
      if (_merchantClaimInterests.has(claimKey)) {
        return resolve({
          claimId: null,
          status: "already_exists",
        } as const);
      }

      _merchantClaimInterests.add(claimKey);
      return resolve({
        claimId: `mock-merchant-claim-${Date.now()}`,
        status: "created",
      } as const);
    },

    async listDraftDishesQueue() {
      return resolve([]);
    },

    async reviewDraftDish(_draftDishId, _decision, _notes) {
      return resolve(undefined);
    },
  },
};
