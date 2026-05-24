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
import { STORY_GALLERY_ASSETS } from "@/lib/services/storyGalleryAssets";
import {
  blogPosts,
  buildings,
  chatConversations,
  chatMessages,
  dishes,
  guestProfile,
  merchantAccount,
  merchantAIInsights,
  merchantAnalytics30d,
  merchantAnalytics7d,
  merchantAnalyticsToday,
  merchantCustomerInteractions,
  merchantOCRDrafts,
  merchantPromotions,
  popularVisitorPins,
  userProfile,
  venues,
} from "./data";
import { mockRepository } from "./repositories";
import { assertFixtureBundleValid } from "./validation";
import type {
  Bite,
  BiteDraft,
  BuildingDetail,
  ChatConversation,
  ChatMessage,
  ChatParticipant,
  ChatSubscriptionHandlers,
  ExplicitFeedbackInput,
  ExtendedRecommendationContext,
  HungryService,
  ImplicitSignalInput,
  QuizAnswer,
  RankedRecommendation,
  RecommendationContext,
  RecommendationResult,
  RecommendationSlateRequest,
  ScenarioQuizAnswer,
  SearchResult,
  Session,
  SubmitReviewInput,
} from "@/lib/services/types";
import type {
  AIBusinessInsight,
  CustomerInteraction,
  DishDetail,
  DietaryFlag,
  HawkerTasteTag,
  MerchantAnalytics,
  MerchantDishViewEvent,
  MerchantNotification,
  MerchantNotificationPreferences,
  MerchantPromotion,
  MerchantTeamMember,
  MerchantWeeklySummary,
  OCRDishDraft,
  PopularVisitorCandidate,
  PopularVisitorPin,
  SearchFilters,
  TasteProfile,
  TasteVector,
  UserProfile,
  Story,
  StoryContent,
  MerchantAccount,
  VenueSummary,
} from "@/types/domain";
import { computeTasteProfileFromQuiz } from "@/lib/ai/tasteQuiz";
import {
  runRecommendationPipeline,
  processExplicitFeedback as processExplicitFeedbackCore,
} from "@/lib/ai/tasteEngine";
import type { ExplicitFeedbackEvent } from "@/lib/ai/tasteEngine";
import { applyVerificationSubmission } from "@/features/merchant/verificationStateMachine";
import { validateMerchantProfileUpdates } from "@/features/merchant/profileValidation";
import { loadMockState, saveMockState } from "./persistence";
import { biteToStallPost } from "@/lib/services/postTransforms";
import {
  appendPublishedStallPost,
  hydratePublishedStallPosts,
  listMockStallPosts,
} from "./stallPostState";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate async latency (0 in test/mock — just ticks the microtask queue) */
function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
let _merchantAccount: MerchantAccount = clone(merchantAccount);
let _merchantDishCounter = 0;
let _merchantPromotionCounter = 0;
let _merchantOCRDrafts: OCRDishDraft[] = clone(merchantOCRDrafts);
let _merchantInbox: CustomerInteraction[] = clone(merchantCustomerInteractions);
let _merchantPromotions: MerchantPromotion[] = clone(merchantPromotions);
let _popularVisitorPins: PopularVisitorPin[] = clone(popularVisitorPins);
let _merchantAIInsights = clone(merchantAIInsights);
let _merchantTeamMemberCounter = 0;
let _merchantDishViewCounter = 0;
let _merchantNotificationCounter = 0;
let _chatConversations: ChatConversation[] = clone(chatConversations);
let _chatMessages: Record<string, ChatMessage[]> = clone(chatMessages);
const _chatSubscribers = new Map<string, Set<(message: ChatMessage) => void>>();
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

let _mockStories: Story[] = [
  {
    id: "s0",
    displayName: "Your Story",
    avatarUrl: "https://i.pravatar.cc/150?u=me",
    hasUnseen: false,
    isStall: false,
    isOwn: true,
    content: {
      type: "image",
      url: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=800&q=80",
    },
    createdAt: new Date().toISOString(),
    interaction: { liked: false, saved: false, likeCount: 0, commentCount: 0, shareCount: 0 },
  },
  {
    id: "s1",
    displayName: "Tian Tian",
    avatarUrl: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=150&h=150&fit=crop",
    hasUnseen: true,
    isStall: true,
    content: {
      type: "image",
      url: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800&q=80",
    },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    interaction: { liked: false, saved: false, likeCount: 0, commentCount: 0, shareCount: 0 },
  },
  {
    id: "s2",
    displayName: "Wei Ming",
    avatarUrl: "https://i.pravatar.cc/150?u=wm",
    hasUnseen: true,
    isStall: false,
    content: {
      type: "image",
      url: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80",
    },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    interaction: { liked: false, saved: false, likeCount: 0, commentCount: 0, shareCount: 0 },
  },
];

function matchesRecommendationQuery(dish: DishDetail, query?: string) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;
  return `${dish.name} ${dish.venueName} ${dish.tasteTags.join(" ")}`
    .toLowerCase()
    .includes(normalized);
}

function getRankedRecommendations(request: RecommendationSlateRequest): RankedRecommendation[] {
  const candidateDishes = dishes.filter((dish) => matchesRecommendationQuery(dish, request.query));
  const pipelineResults = runRecommendationPipeline(candidateDishes, {
    userVector: request.tasteProfile,
    dietaryFlags: request.dietaryFlags ?? _profile.dietaryPreferences,
    neophiliaIndex: request.neophiliaIndex ?? _profile.tasteProfile?.neophiliaIndex ?? 5,
    latitude: request.latitude,
    longitude: request.longitude,
    radiusMeters: request.radiusMeters,
    excludeDishIds: request.excludeDishIds,
  }).slice(0, request.limit ?? 20);

  return pipelineResults
    .map((result) => {
      const dish = dishes.find((item) => item.id === result.dishId);
      if (!dish) return null;
      return {
        dish,
        matchScore: result.score,
        matchPercent: result.matchPercent,
        matchReason: result.explanation,
        isSerendipitous: result.isSerendipitous,
      };
    })
    .filter((result): result is RankedRecommendation => Boolean(result));
}

function toCoreFeedbackType(feedback: ExplicitFeedbackInput): ExplicitFeedbackEvent["type"] {
  if (feedback.feedbackType === "rating" || feedback.feedbackType === "review") {
    const rating = feedback.rating ?? 3;
    if (rating >= 5) return "rating_5_star";
    if (rating >= 4) return "rating_4_star";
    if (rating >= 3) return "rating_3_star";
    if (rating >= 2) return "rating_2_star";
    return "rating_1_star";
  }
  if (feedback.feedbackType === "save") return "saved";
  if (feedback.feedbackType === "unsave") return "unsaved";
  if (feedback.feedbackType === "search_query") return "search_query";
  if (feedback.feedbackType === "dish_result_click") return "dish_result_click";
  if (feedback.feedbackType === "dish_like") return "dish_like";
  if (feedback.feedbackType === "food_button_click") return "food_button_click";
  if (feedback.feedbackType === "dismissed") return "dismissed";
  return "hawker_tag_positive";
}

function isFreshStory(story: Story): boolean {
  const createdAt = new Date(story.createdAt).getTime();
  if (!Number.isFinite(createdAt)) return true;
  return Date.now() - createdAt < STORY_TTL_MS;
}

function pruneMockStories() {
  const nextStories = _mockStories.filter(isFreshStory);
  if (nextStories.length !== _mockStories.length) {
    _mockStories = nextStories;
    void saveMockState("stories", _mockStories);
  }
}

function getCurrentChatParticipant(): ChatParticipant {
  return {
    kind: "user",
    userId: _profile.id,
    displayName: _profile.displayName || "You",
    avatarUrl: _profile.avatarUrl,
    isCurrentUser: true,
  };
}

function sortMockConversations(conversations: ChatConversation[]): ChatConversation[] {
  return [...conversations].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function updateMockConversationPreview(conversationId: string, message: ChatMessage) {
  _chatConversations = _chatConversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          lastMessage: message.body,
          lastMessageAt: message.createdAt,
          unreadCount: message.sentByCurrentUser
            ? conversation.unreadCount
            : conversation.unreadCount + 1,
          updatedAt: message.createdAt,
        }
      : conversation,
  );
}

function emitMockChatMessage(message: ChatMessage) {
  const listeners = _chatSubscribers.get(message.conversationId);
  listeners?.forEach((listener) => listener(clone(message)));
}

let _isSocialHydrated = false;
async function hydrateSocial() {
  if (_isSocialHydrated) return;
  await hydratePublishedStallPosts();
  const s = await loadMockState<Story[]>("stories");
  if (s) _mockStories = s;
  pruneMockStories();

  const r = await loadMockState<any>("bite_reactions");
  if (r) {
    Object.keys(r).forEach((id) => {
      _biteReactions[id] = {
        cravings: new Set(r[id].cravings),
        saves: new Set(r[id].saves),
      };
    });
  }
  _isSocialHydrated = true;
}

const _merchantTeamMembersByAccount = new Map<string, MerchantTeamMember[]>([
  [
    merchantAccount.id,
    [
      {
        id: "tm-1",
        merchantAccountId: merchantAccount.id,
        userId: merchantAccount.userId,
        displayName: merchantAccount.displayName,
        email: merchantAccount.email,
        role: "owner",
        addedAt: merchantAccount.createdAt,
        inviteStatus: "accepted",
        acceptedAt: merchantAccount.createdAt,
      },
      {
        id: "tm-2",
        merchantAccountId: merchantAccount.id,
        userId: "user-merchant-manager",
        displayName: "Mei Lin",
        email: "meilin@hawker.sg",
        role: "manager",
        addedAt: "2026-04-01T09:00:00Z",
        inviteStatus: "accepted",
        acceptedAt: "2026-04-01T09:00:00Z",
      },
    ],
  ],
]);
const DEFAULT_NOTIFICATION_PREFERENCES: MerchantNotificationPreferences = {
  newReviews: true,
  lowRatingAlerts: true,
  newComments: true,
  promotionUpdates: true,
  weeklyDigest: true,
  aiInsights: true,
};
const _merchantNotificationPreferencesByAccount = new Map<string, MerchantNotificationPreferences>([
  [merchantAccount.id, clone(DEFAULT_NOTIFICATION_PREFERENCES)],
]);
const _merchantDishViewEvents: MerchantDishViewEvent[] = [];
const _merchantNotifications: MerchantNotification[] = [];
const _merchantMenuByOutlet = new Map<string, DishDetail[]>();
const _biteReactions: Record<string, { cravings: Set<string>; saves: Set<string> }> = {};
const _merchantClaimInterests = new Set<string>();
const _merchantInteractionReports: {
  interactionId: string;
  reason: string;
  reportedAt: string;
}[] = [];
const _contentReports: {
  reporterId: string;
  targetType: string;
  targetId: string;
  targetAuthorKey?: string;
  reason: string;
}[] = [];
const _blockedUserKeys = new Set<string>();

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

function getMerchantOutlet(outletId: string) {
  const outlet = _merchantAccount.outlets.find((o) => o.id === outletId);
  if (!outlet) throw new Error(`Outlet ${outletId} not found`);
  return outlet;
}

function getMockMerchantVenueId(outletId: string): string {
  return `mock-venue-${outletId}`;
}

function getMockMerchantSeedDishId(outletId: string, dishId: string): string {
  return `mock-${outletId}-${dishId}`;
}

function toMerchantMenuSeedDish(outletId: string, dish: DishDetail): DishDetail {
  const outlet = getMerchantOutlet(outletId);
  return {
    ...dish,
    id: getMockMerchantSeedDishId(outletId, dish.id),
    venueId: getMockMerchantVenueId(outletId),
    buildingId: outlet.buildingId ?? dish.buildingId,
    venueName: outlet.name,
    unitNumber: outlet.unitNumber ?? dish.unitNumber,
    floor: outlet.floor ?? dish.floor,
    venueVerificationStatus: outlet.verification.status,
  };
}

function getMerchantMenu(outletId: string): DishDetail[] {
  const outlet = getMerchantOutlet(outletId);
  const existingMenu = _merchantMenuByOutlet.get(outletId);
  if (existingMenu) {
    syncMerchantMenuToUserCatalog(outletId, existingMenu);
    return existingMenu;
  }

  const seededMenu =
    outlet.signatureDishIds.length > 0
      ? dishes.filter((dish) => outlet.signatureDishIds.includes(dish.id)).slice(0, 8)
      : dishes.filter((dish) => dish.buildingId === outlet.buildingId).slice(0, 8);
  const merchantMenu = seededMenu.map((dish) => toMerchantMenuSeedDish(outletId, dish));
  _merchantMenuByOutlet.set(outletId, merchantMenu);
  syncMerchantMenuToUserCatalog(outletId, merchantMenu);
  return merchantMenu;
}

function syncMerchantOutletToUserCatalog(
  outlet: ReturnType<typeof getMerchantOutlet>,
): VenueSummary {
  const venueId = getMockMerchantVenueId(outlet.id);
  const menu = _merchantMenuByOutlet.get(outlet.id) ?? [];
  const topDishId = menu[0]?.id ?? outlet.signatureDishIds[0] ?? "";
  const venue: VenueSummary = {
    id: venueId,
    buildingId: outlet.buildingId ?? "building-maxwell",
    name: outlet.name,
    unitNumber: outlet.unitNumber ?? "",
    floor: outlet.floor ?? "",
    isOpen: outlet.isLive && !outlet.temporaryClosure,
    liveCrowd: "medium",
    topDishId,
    operatingHours: outlet.operatingHours,
    closureNotice: outlet.temporaryClosure,
    deliveryLinks: outlet.deliveryLinks,
    verificationStatus: outlet.verification.status,
  };
  const venueIndex = venues.findIndex((item) => item.id === venueId);
  if (venueIndex === -1) {
    venues.push(venue);
  } else {
    venues[venueIndex] = venue;
  }
  dishes.forEach((dish) => {
    if (dish.venueId !== venueId) return;
    dish.buildingId = venue.buildingId;
    dish.venueName = venue.name;
    dish.unitNumber = venue.unitNumber;
    dish.floor = venue.floor;
    dish.liveCrowd = dish.liveCrowd ?? venue.liveCrowd;
    dish.venueVerificationStatus = venue.verificationStatus;
  });
  return venue;
}

function syncMerchantDishToUserCatalog(outletId: string, dish: DishDetail): DishDetail {
  const outlet = getMerchantOutlet(outletId);
  const venue = syncMerchantOutletToUserCatalog(outlet);
  const userVisibleDish: DishDetail = {
    ...dish,
    venueId: venue.id,
    buildingId: venue.buildingId,
    venueName: venue.name,
    unitNumber: venue.unitNumber,
    floor: venue.floor,
    liveCrowd: dish.liveCrowd ?? venue.liveCrowd,
    venueVerificationStatus: venue.verificationStatus,
  };
  const dishIndex = dishes.findIndex((item) => item.id === userVisibleDish.id);
  if (dishIndex === -1) {
    dishes.push(userVisibleDish);
  } else {
    dishes[dishIndex] = userVisibleDish;
  }
  syncMerchantOutletToUserCatalog(outlet);
  return userVisibleDish;
}

function syncMerchantMenuToUserCatalog(outletId: string, menu: DishDetail[]): void {
  syncMerchantOutletToUserCatalog(getMerchantOutlet(outletId));
  menu.forEach((dish) => {
    syncMerchantDishToUserCatalog(outletId, dish);
  });
}

function sortPopularVisitorPins(pins: PopularVisitorPin[]): PopularVisitorPin[] {
  return [...pins].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return new Date(right.pinnedAt).getTime() - new Date(left.pinnedAt).getTime();
  });
}

function listActivePopularVisitorPins(outletId: string): PopularVisitorPin[] {
  getMerchantOutlet(outletId);
  return sortPopularVisitorPins(
    _popularVisitorPins.filter((pin) => pin.outletId === outletId && pin.isActive),
  ).slice(0, 6);
}

function getReviewBackedVisitorCandidates(outletId: string): PopularVisitorCandidate[] {
  const outlet = getMerchantOutlet(outletId);
  const venueId = getMockMerchantVenueId(outlet.id);
  const menu = getMerchantMenu(outlet.id);
  const fallbackDishName = menu[0]?.name;
  const activePinByReviewId = new Map(
    listActivePopularVisitorPins(outlet.id).map((pin) => [pin.reviewId, pin]),
  );

  return _merchantInbox
    .filter((interaction) => interaction.outletId === outlet.id && interaction.type === "review")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((interaction) => {
      const reviewId = interaction.sourceId ?? interaction.id;
      const activePin = activePinByReviewId.get(reviewId);
      return {
        outletId: outlet.id,
        venueId,
        reviewId,
        sourceId: reviewId,
        authorProfileId: `mock-profile-${interaction.authorName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}`,
        authorName: interaction.authorName,
        authorAvatarUrl: interaction.authorAvatarUrl,
        authorLocation: "Singapore",
        reviewText: interaction.text,
        rating: interaction.rating ?? 0,
        dishName: fallbackDishName,
        visitedAt: interaction.createdAt,
        isPinned: Boolean(activePin),
        pinId: activePin?.id,
        sortOrder: activePin?.sortOrder,
      } satisfies PopularVisitorCandidate;
    });
}

function buildPopularVisitorPin(outletId: string, reviewId: string): PopularVisitorPin {
  const candidate = getReviewBackedVisitorCandidates(outletId).find(
    (item) => item.reviewId === reviewId,
  );
  if (!candidate) {
    throw new Error(`Review ${reviewId} was not found for outlet ${outletId}`);
  }
  const activePins = listActivePopularVisitorPins(outletId);
  if (activePins.length >= 6) {
    throw new Error("A stall can feature up to 6 popular visitors.");
  }
  const nextSortOrder = activePins.reduce((max, pin) => Math.max(max, pin.sortOrder), -1) + 1;
  return {
    id: `pin-${outletId}-${reviewId}`,
    outletId: candidate.outletId,
    venueId: candidate.venueId,
    reviewId: candidate.reviewId,
    sourceId: candidate.sourceId,
    authorProfileId: candidate.authorProfileId,
    authorName: candidate.authorName,
    authorAvatarUrl: candidate.authorAvatarUrl,
    authorLocation: candidate.authorLocation,
    reviewText: candidate.reviewText,
    rating: candidate.rating,
    dishName: candidate.dishName,
    visitedAt: candidate.visitedAt,
    pinnedAt: new Date().toISOString(),
    sortOrder: nextSortOrder,
    isActive: true,
  };
}

function removeMerchantDishFromUserCatalog(outletId: string, dishId: string): void {
  const venueId = getMockMerchantVenueId(outletId);
  const dishIndex = dishes.findIndex((dish) => dish.id === dishId && dish.venueId === venueId);
  if (dishIndex !== -1) {
    dishes.splice(dishIndex, 1);
  }
  syncMerchantOutletToUserCatalog(getMerchantOutlet(outletId));
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function mergeAvailabilityFlag(currentFlags: string[], flag: string, enabled: boolean): string[] {
  const withoutFlag = currentFlags.filter((currentFlag) => currentFlag !== flag);
  return enabled ? [...withoutFlag, flag] : withoutFlag;
}

function buildMerchantDish(outletId: string, input: Partial<DishDetail>): DishDetail {
  const outlet = getMerchantOutlet(outletId);
  const base =
    getMerchantMenu(outletId)[0] ??
    dishes.find((dish) => dish.buildingId === outlet.buildingId) ??
    dishes[0];
  const venueId = getMockMerchantVenueId(outletId);

  return {
    ...base,
    ...input,
    id: input.id ?? `merchant-dish-${++_merchantDishCounter}`,
    venueId,
    buildingId: outlet.buildingId ?? base.buildingId,
    venueName: outlet.name,
    unitNumber: outlet.unitNumber ?? base.unitNumber,
    floor: outlet.floor ?? base.floor,
    gallery: input.gallery ?? (input.imageUrl ? [input.imageUrl] : base.gallery),
    availabilityFlags: uniqueValues(input.availabilityFlags ?? base.availabilityFlags ?? []),
    reviews: input.reviews ?? [],
  };
}

function getPromotionAnalyticsValue(
  promotion: MerchantPromotion,
): NonNullable<MerchantPromotion["analytics"]> {
  if (promotion.analytics) return promotion.analytics;
  if (promotion.status === "draft") {
    return { impressions: 0, clicks: 0, saves: 0, profileVisits: 0, dishViews: 0 };
  }
  if (promotion.status === "scheduled") {
    return { impressions: 0, clicks: 0, saves: 0, profileVisits: 0, dishViews: 0 };
  }
  return { impressions: 1200, clicks: 96, saves: 24, profileVisits: 48, dishViews: 132 };
}

function getAIInsightsForOutlet(
  outletId: string,
  types?: AIBusinessInsight["type"][],
): AIBusinessInsight[] {
  getMerchantOutlet(outletId);
  const typeSet = types ? new Set(types) : null;
  return _merchantAIInsights
    .filter((insight) => insight.outletId === outletId)
    .filter((insight) => !typeSet || typeSet.has(insight.type))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function getMerchantAccountById(merchantAccountId: string): MerchantAccount {
  if (_merchantAccount.id !== merchantAccountId) {
    throw new Error(`Merchant account ${merchantAccountId} not found`);
  }
  return _merchantAccount;
}

function getTeamMembersForAccount(merchantAccountId: string): MerchantTeamMember[] {
  getMerchantAccountById(merchantAccountId);
  const existing = _merchantTeamMembersByAccount.get(merchantAccountId);
  if (existing) return existing;
  _merchantTeamMembersByAccount.set(merchantAccountId, []);
  return _merchantTeamMembersByAccount.get(merchantAccountId) ?? [];
}

function getNotificationPreferencesForAccount(
  merchantAccountId: string,
): MerchantNotificationPreferences {
  getMerchantAccountById(merchantAccountId);
  const existing = _merchantNotificationPreferencesByAccount.get(merchantAccountId);
  if (existing) return existing;
  const seeded = clone(DEFAULT_NOTIFICATION_PREFERENCES);
  _merchantNotificationPreferencesByAccount.set(merchantAccountId, seeded);
  return seeded;
}

function getOutletForDishView(dishId: string): ReturnType<typeof getMerchantOutlet> | undefined {
  for (const outlet of _merchantAccount.outlets) {
    const menu = getMerchantMenu(outlet.id);
    if (menu.some((dish) => dish.id === dishId)) return outlet;
    const userVisibleVenueId = getMockMerchantVenueId(outlet.id);
    if (dishes.some((dish) => dish.id === dishId && dish.venueId === userVisibleVenueId)) {
      return outlet;
    }
  }
  return undefined;
}

function getDishViewCounts(outletId: string): Map<string, number> {
  const counts = new Map<string, number>();
  _merchantDishViewEvents
    .filter((event) => event.outletId === outletId)
    .forEach((event) => {
      counts.set(event.dishId, (counts.get(event.dishId) ?? 0) + 1);
    });
  return counts;
}

function buildMockMerchantAnalytics(
  outletId: string,
  dateRange: "today" | "7d" | "30d",
): MerchantAnalytics {
  const base =
    dateRange === "7d"
      ? merchantAnalytics7d
      : dateRange === "30d"
        ? merchantAnalytics30d
        : merchantAnalyticsToday;
  const analytics = clone(base);
  analytics.outletId = outletId;
  analytics.dateRange = dateRange;

  const menu = getMerchantMenu(outletId);
  const viewCounts = getDishViewCounts(outletId);
  const eventViews = Array.from(viewCounts.values()).reduce((sum, count) => sum + count, 0);
  analytics.dishViews += eventViews;
  analytics.menuViews += eventViews;
  analytics.profileVisits += Math.floor(eventViews / 2);
  analytics.topDishes = menu
    .map((dish, index) => ({
      dishId: dish.id,
      name: dish.name,
      views: (analytics.topDishes[index]?.views ?? 0) + (viewCounts.get(dish.id) ?? 0),
      saves: analytics.topDishes[index]?.saves ?? 0,
    }))
    .sort((left, right) => right.views - left.views)
    .slice(0, 5);

  const reviews = _merchantInbox.filter(
    (interaction) => interaction.outletId === outletId && interaction.type === "review",
  );
  const ratings = reviews
    .map((interaction) => interaction.rating)
    .filter((rating): rating is number => typeof rating === "number");
  analytics.reviewCount = ratings.length;
  analytics.averageRating =
    ratings.length === 0 ? 0 : ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  analytics.postInteractions = _merchantInbox.filter(
    (interaction) => interaction.outletId === outletId,
  ).length;
  return analytics;
}

function createMerchantNotification(
  input: Omit<MerchantNotification, "id" | "createdAt"> & { createdAt?: string },
): MerchantNotification {
  const existing = _merchantNotifications.find(
    (notification) => notification.dedupeKey === input.dedupeKey,
  );
  if (existing) return existing;
  const notification: MerchantNotification = {
    ...input,
    id: `merchant-note-${++_merchantNotificationCounter}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  _merchantNotifications.push(notification);
  return notification;
}

function getLowRatingNotificationsForOutlet(outletId: string): MerchantNotification[] {
  const outlet = getMerchantOutlet(outletId);
  const lowReviews = _merchantInbox.filter(
    (interaction) =>
      interaction.outletId === outletId &&
      interaction.type === "review" &&
      typeof interaction.rating === "number" &&
      interaction.rating <= 2,
  );
  return lowReviews.map((review) =>
    createMerchantNotification({
      merchantAccountId: outlet.merchantAccountId,
      outletId,
      kind: "low_rating",
      title: `${outlet.name} received a low rating`,
      body: `${review.rating?.toFixed(1)} stars: ${review.text.slice(0, 120)}`,
      status: "unread",
      dedupeKey: `low-rating:${review.id}`,
      deepLink: "MerchantTabs/CustomerInbox",
      metadata: {
        reviewId: review.id,
        rating: review.rating ?? null,
        snippet: review.text,
      },
      createdAt: review.createdAt,
    }),
  );
}

function buildWeeklySummaryStats(outletId: string): MerchantWeeklySummary {
  const analytics = buildMockMerchantAnalytics(outletId, "7d");
  const interactions = _merchantInbox.filter((interaction) => interaction.outletId === outletId);
  const reviews = interactions.filter((interaction) => interaction.type === "review");
  const unrepliedReviews = reviews.filter((review) => !review.reply).length;
  const promotionViews = _merchantPromotions
    .filter((promotion) => promotion.outletId === outletId)
    .reduce((sum, promotion) => sum + (promotion.analytics?.impressions ?? 0), 0);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  return {
    id: `weekly-${outletId}-${weekStart.toISOString().slice(0, 10)}`,
    outletId,
    weekStart: weekStart.toISOString(),
    weekEnd: now.toISOString(),
    totalViews: analytics.profileVisits + analytics.menuViews + analytics.dishViews,
    dishViews: analytics.dishViews,
    topDishes: analytics.topDishes,
    newReviews: reviews.length,
    averageRating: analytics.averageRating,
    ratingChange: analytics.averageRating - analytics.previousPeriodComparison.averageRating,
    unrepliedReviews,
    promotionViews,
    createdAt: now.toISOString(),
  };
}

// ─── Mock bites feed ─────────────────────────────────────────────────────────

const MOCK_BITES_FEED: Bite[] = [
  {
    id: "bite-feed-mock-wei",
    authorId: "user-1",
    authorName: "Wei Ming",
    authorAvatar: "https://i.pravatar.cc/64?img=11",
    dishId: "dish-chicken-rice",
    dishName: "Chicken Rice",
    venueId: "venue-tian-tian",
    venueName: "Tian Tian Hainanese",
    unitNumber: "#01-10",
    buildingId: "building-maxwell",
    buildingName: "Maxwell Food Centre",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/71/Hainanese_Chicken_Rice.jpg",
    caption:
      "Quick lunch energy with clean flavour and crispy skin — perfect after a busy morning.",
    tasteStamp: { sweet: 3, spicy: 1, sour: 1, salty: 6, rich: 6, aromatic: 8 },
    cravingCount: 128,
    savedCount: 34,
    rating: 5,
    price: 5.5,
    expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 45 * 60_000).toISOString(),
  },
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
        stats: {
          dishesReviewed: 0,
          stallsVisited: 0,
          favouritesCount: 0,
          followersCount: 0,
          followingCount: 0,
        },
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

    async requestAccountDeletion() {
      // Mock-safe stub: production uses external deletion endpoint + legal workflow.
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

    async recordDishView(dishId, context) {
      const outlet = getOutletForDishView(dishId);
      if (!outlet) return resolve(undefined);
      const sessionId =
        context?.sessionId ??
        context?.userId ??
        (_isAuthenticated ? _profile.id : "mock-guest-session");
      const dedupeWindow = new Date().toISOString().slice(0, 13);
      const hasRecentView = _merchantDishViewEvents.some(
        (event) =>
          event.dishId === dishId &&
          event.outletId === outlet.id &&
          event.sessionId === sessionId &&
          event.viewedAt.slice(0, 13) === dedupeWindow,
      );
      if (hasRecentView) return resolve(undefined);
      _merchantDishViewEvents.push({
        id: `dish-view-${++_merchantDishViewCounter}`,
        outletId: outlet.id,
        dishId,
        sessionId,
        userId: context?.userId ?? (_isAuthenticated ? _profile.id : undefined),
        viewedAt: new Date().toISOString(),
      });
      return resolve(undefined);
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
      await hydrateSocial();
      return resolve([...MOCK_BITES_FEED]);
    },

    async postBite(draft: BiteDraft) {
      await hydrateSocial();
      const venue = venues.find((v) => v.id === draft.venueId);
      const building = buildings.find((b) => b.id === venue?.buildingId);
      const author = draft.author ?? _profile;
      const newBite: Bite = {
        id: `bite-${Date.now()}`,
        authorId: author.id,
        authorName: author.displayName,
        authorAvatar: author.avatarUrl,
        dishId: draft.dishId,
        dishName: dishes.find((d) => d.id === draft.dishId)?.name ?? "Unknown dish",
        venueId: draft.venueId,
        venueName: venue?.name ?? "Unknown stall",
        unitNumber: venue?.unitNumber ?? "",
        buildingId: venue?.buildingId ?? "",
        buildingName: building?.name ?? "",
        photoUrl: draft.photoUrl,
        mediaUrls: draft.mediaUrls,
        mediaType: draft.mediaType,
        caption: draft.caption,
        tags: draft.tags,
        tasteStamp: draft.tasteStamp,
        cravingCount: 0,
        savedCount: 0,
        rating: draft.rating,
        price: dishes.find((d) => d.id === draft.dishId)?.priceRange === "$" ? 4.5 : 8.0,
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      MOCK_BITES_FEED.unshift(newBite);
      await appendPublishedStallPost(
        biteToStallPost(newBite, {
          authorAvatarUrl: author.avatarUrl ?? draft.photoUrl,
          mediaType: draft.mediaType,
          mediaUrls: draft.mediaUrls ?? [draft.photoUrl],
          tags: draft.tags,
        }),
      );
      return resolve(newBite);
    },

    async reactToBite(biteId, reaction) {
      await hydrateSocial();
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

      // Persist (convert Sets to Arrays for JSON)
      const serializable: any = {};
      Object.keys(_biteReactions).forEach((id) => {
        serializable[id] = {
          cravings: Array.from(_biteReactions[id].cravings),
          saves: Array.from(_biteReactions[id].saves),
        };
      });
      void saveMockState("bite_reactions", serializable);

      return resolve(undefined);
    },

    async getStories() {
      await hydrateSocial();
      pruneMockStories();
      return resolve([..._mockStories]);
    },

    async listStoryGalleryAssets() {
      return resolve([...STORY_GALLERY_ASSETS]);
    },

    async likeStory(storyId: string) {
      await hydrateSocial();
      pruneMockStories();
      const story = _mockStories.find((s) => s.id === storyId);
      if (story) {
        story.interaction.liked = !story.interaction.liked;
        story.interaction.likeCount += story.interaction.liked ? 1 : -1;
        void saveMockState("stories", _mockStories);
      }
      return resolve(undefined);
    },

    async saveStory(storyId: string) {
      await hydrateSocial();
      pruneMockStories();
      const story = _mockStories.find((s) => s.id === storyId);
      if (story) {
        story.interaction.saved = !story.interaction.saved;
        void saveMockState("stories", _mockStories);
      }
      return resolve(undefined);
    },

    async addStory(content: StoryContent) {
      await hydrateSocial();
      pruneMockStories();
      const newStory: Story = {
        id: `s_${Date.now()}`,
        displayName: _profile.displayName || "You",
        avatarUrl: _profile.avatarUrl || "https://i.pravatar.cc/150?u=me",
        hasUnseen: false,
        isStall: false,
        isOwn: true,
        content,
        createdAt: new Date().toISOString(),
        interaction: { liked: false, saved: false, likeCount: 0, commentCount: 0, shareCount: 0 },
      };

      const yourStoryIndex = _mockStories.findIndex((s) => s.isOwn);
      if (yourStoryIndex >= 0) {
        _mockStories[yourStoryIndex] = newStory;
      } else {
        _mockStories.unshift(newStory);
      }

      void saveMockState("stories", _mockStories);
      return resolve(newStory);
    },

    async getLikedStories() {
      await hydrateSocial();
      return resolve(_mockStories.filter((s) => s.interaction.liked));
    },

    async getSavedStories() {
      await hydrateSocial();
      return resolve(_mockStories.filter((s) => s.interaction.saved));
    },

    async getSavedBites() {
      await hydrateSocial();
      const savedBiteIds = Object.keys(_biteReactions).filter((id) =>
        _biteReactions[id].saves.has(_profile.id),
      );
      const savedBites = MOCK_BITES_FEED.filter((b) => savedBiteIds.includes(b.id));
      return resolve(savedBites);
    },

    async getLikedBites() {
      await hydrateSocial();
      const likedBiteIds = Object.keys(_biteReactions).filter((id) =>
        _biteReactions[id].cravings.has(_profile.id),
      );
      const likedBites = MOCK_BITES_FEED.filter((b) => likedBiteIds.includes(b.id));
      return resolve(likedBites);
    },
  },

  chat: {
    async listConversations() {
      return resolve(sortMockConversations(_chatConversations).map(clone));
    },

    async openConversation(input) {
      const target = input.target;
      const currentParticipant = getCurrentChatParticipant();
      const existing = _chatConversations.find((conversation) =>
        conversation.participants.some((participant) =>
          target.kind === "merchant"
            ? participant.merchantAccountId === target.merchantAccountId
            : participant.userId === target.userId,
        ),
      );
      if (existing) return resolve(clone(existing));

      const now = new Date().toISOString();
      const conversation: ChatConversation = {
        id: `chat-${Date.now()}`,
        type: input.type ?? (target.kind === "merchant" ? "merchant" : "user"),
        title: target.displayName,
        avatarUrl: target.avatarUrl,
        participants: [currentParticipant, { ...target, isCurrentUser: false }],
        unreadCount: 0,
        updatedAt: now,
      };
      _chatConversations = [conversation, ..._chatConversations];
      _chatMessages[conversation.id] = [];
      return resolve(clone(conversation));
    },

    async listMessages(conversationId) {
      const messages = _chatMessages[conversationId] ?? [];
      return resolve(messages.map(clone));
    },

    async sendMessage(input) {
      const body = input.body.trim();
      if (!body) throw new Error("Message cannot be empty.");
      const conversation = _chatConversations.find((item) => item.id === input.conversationId);
      if (!conversation) throw new Error("Conversation not found.");

      const createdAt = new Date().toISOString();
      const message: ChatMessage = {
        id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conversationId: input.conversationId,
        body,
        sender: getCurrentChatParticipant(),
        sentByCurrentUser: true,
        clientNonce: input.clientNonce,
        deliveredAt: createdAt,
        createdAt,
      };
      _chatMessages[input.conversationId] = [
        ...(_chatMessages[input.conversationId] ?? []),
        message,
      ];
      updateMockConversationPreview(input.conversationId, message);
      emitMockChatMessage(message);
      return resolve(clone(message));
    },

    async markConversationRead(conversationId) {
      const now = new Date().toISOString();
      _chatConversations = _chatConversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              unreadCount: 0,
              participants: conversation.participants.map((participant) =>
                participant.isCurrentUser ? { ...participant } : participant,
              ),
              updatedAt: conversation.updatedAt,
            }
          : conversation,
      );
      _chatMessages[conversationId] = (_chatMessages[conversationId] ?? []).map((message) =>
        message.sentByCurrentUser || message.readAt ? message : { ...message, readAt: now },
      );
      return resolve(undefined);
    },

    subscribeToConversation(conversationId, handlers: ChatSubscriptionHandlers) {
      const listener = (message: ChatMessage) => {
        handlers.onMessage?.(message);
      };
      const listeners = _chatSubscribers.get(conversationId) ?? new Set();
      listeners.add(listener);
      _chatSubscribers.set(conversationId, listeners);
      return {
        unsubscribe() {
          const current = _chatSubscribers.get(conversationId);
          current?.delete(listener);
        },
      };
    },
  },

  // ── Community Safety ────────────────────────────────────────────────────────
  communitySafety: {
    async reportContent(request) {
      _contentReports.push({
        reporterId: _profile.id,
        targetType: request.targetType,
        targetId: request.targetId,
        targetAuthorKey: request.targetAuthorKey,
        reason: request.reason,
      });
      return resolve(undefined);
    },

    async blockUser(request) {
      _blockedUserKeys.add(request.blockedUserKey);
      return resolve(undefined);
    },

    async hidePost(postId, reason) {
      _contentReports.push({
        reporterId: _profile.id,
        targetType: "post",
        targetId: postId,
        reason: reason ?? "hidden_by_user",
      });
      return resolve(undefined);
    },

    async unhidePost(postId) {
      _contentReports.push({
        reporterId: _profile.id,
        targetType: "post",
        targetId: postId,
        reason: "unhidden_by_user",
      });
      return resolve(undefined);
    },
  },

  // ── Content ─────────────────────────────────────────────────────────────────

  content: {
    async listArticles() {
      return resolve([...blogPosts]);
    },

    async listStallPosts() {
      await hydrateSocial();
      return resolve(listMockStallPosts());
    },

    async listPopularVisitorPinsByVenue(venueId) {
      const pins = sortPopularVisitorPins(
        _popularVisitorPins.filter((pin) => pin.venueId === venueId && pin.isActive),
      ).slice(0, 6);
      return resolve(clone(pins));
    },

    async getArticle(id) {
      return resolve(blogPosts.find((p) => p.id === id));
    },
  },

  // ── Recommendations ─────────────────────────────────────────────────────────

  recommendations: {
    async getSlate(request) {
      return resolve({
        surface: request.surface,
        generatedAt: new Date().toISOString(),
        items: getRankedRecommendations(request),
      });
    },

    async recordExplicitFeedback(feedback) {
      const dish = feedback.dishId ? dishes.find((item) => item.id === feedback.dishId) : undefined;
      if (!dish && feedback.feedbackType !== "search_query") {
        return resolve({
          tasteVector: _profile.tasteVector,
          applied: false,
          reason: "missing_dish",
        });
      }

      const searchVector =
        feedback.feedbackType === "search_query" && feedback.query
          ? getRankedRecommendations({
              surface: feedback.surface ?? "search",
              tasteProfile: _profile.tasteVector,
              dietaryFlags: _profile.dietaryPreferences,
              query: feedback.query,
              limit: 5,
            }).map((item) => item.dish.tasteVector)
          : [];
      const dishVector =
        dish?.tasteVector ??
        (searchVector.length
          ? searchVector.reduce<TasteVector>(
              (sum, vector, _index, array) => ({
                sweet: sum.sweet + vector.sweet / array.length,
                spicy: sum.spicy + vector.spicy / array.length,
                sour: sum.sour + vector.sour / array.length,
                salty: sum.salty + vector.salty / array.length,
                rich: sum.rich + vector.rich / array.length,
                aromatic: sum.aromatic + vector.aromatic / array.length,
              }),
              { sweet: 0, spicy: 0, sour: 0, salty: 0, rich: 0, aromatic: 0 },
            )
          : undefined);

      if (!dishVector) {
        return resolve({
          tasteVector: _profile.tasteVector,
          applied: false,
          reason: "missing_signal",
        });
      }

      const updatedVector = processExplicitFeedbackCore(_profile.tasteVector, {
        type: toCoreFeedbackType(feedback),
        dishVector,
        hawkerTags: feedback.hawkerTags,
        timestamp: feedback.createdAt ? new Date(feedback.createdAt).getTime() : Date.now(),
      });
      _profile = { ..._profile, tasteVector: updatedVector };

      return resolve({
        tasteVector: updatedVector,
        applied: true,
      });
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

      const updatedVector = processExplicitFeedbackCore(_profile.tasteVector, {
        type: toCoreFeedbackType(feedback),
        dishVector: dish.tasteVector,
        hawkerTags: feedback.hawkerTags,
      });

      _profile = { ..._profile, tasteVector: updatedVector };
      return resolve(updatedVector);
    },

    async processImplicitFeedback(_signals: ImplicitSignalInput[]): Promise<TasteVector> {
      return resolve(_profile.tasteVector);
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

  // ─── Merchant Centre ────────────────────────────────────────────────────────
  merchant: {
    async getMerchantAccount() {
      return resolve(_merchantAccount);
    },

    async getOutlets() {
      return resolve(_merchantAccount.outlets);
    },

    async switchOutlet(outletId) {
      return resolve(getMerchantOutlet(outletId));
    },

    async getVerificationStatus(outletId) {
      const outlet = getMerchantOutlet(outletId);
      return resolve(outlet.verification);
    },

    async submitVerification(outletId, evidence) {
      const outlet = getMerchantOutlet(outletId);
      outlet.verification = applyVerificationSubmission(outlet.verification, evidence);
      return resolve(undefined);
    },

    async resubmitVerification(outletId, evidence) {
      return this.submitVerification(outletId, evidence);
    },

    async updateBusinessProfile(outletId, updates) {
      const outlet = getMerchantOutlet(outletId);
      const normalized = validateMerchantProfileUpdates(updates);
      Object.assign(outlet, normalized);
      syncMerchantOutletToUserCatalog(outlet);
      return resolve(outlet);
    },

    async getMenu(outletId) {
      return resolve(clone(getMerchantMenu(outletId)));
    },

    async addDish(outletId, dish) {
      const menu = getMerchantMenu(outletId);
      const newDish = buildMerchantDish(outletId, { ...dish, id: undefined });
      menu.push(newDish);
      syncMerchantDishToUserCatalog(outletId, newDish);
      return resolve(clone(newDish));
    },

    async editDish(outletId, dishId, updates) {
      const menu = getMerchantMenu(outletId);
      const dishIndex = menu.findIndex((dish) => dish.id === dishId);
      if (dishIndex === -1) throw new Error(`Dish ${dishId} not found for outlet ${outletId}`);
      const updatedDish = buildMerchantDish(outletId, {
        ...menu[dishIndex],
        ...updates,
        id: dishId,
      });
      menu[dishIndex] = updatedDish;
      syncMerchantDishToUserCatalog(outletId, updatedDish);
      return resolve(clone(updatedDish));
    },

    async deleteDish(outletId, dishId) {
      const menu = getMerchantMenu(outletId);
      const dishIndex = menu.findIndex((dish) => dish.id === dishId);
      if (dishIndex === -1) throw new Error(`Dish ${dishId} not found for outlet ${outletId}`);
      menu.splice(dishIndex, 1);
      removeMerchantDishFromUserCatalog(outletId, dishId);
      return resolve(undefined);
    },

    async toggleSoldOut(outletId, dishId) {
      const menu = getMerchantMenu(outletId);
      const dish = menu.find((menuDish) => menuDish.id === dishId);
      if (!dish) throw new Error(`Dish ${dishId} not found for outlet ${outletId}`);
      const isSoldOut = !dish.availabilityFlags.includes("Sold out");
      dish.availabilityFlags = mergeAvailabilityFlag(dish.availabilityFlags, "Sold out", isSoldOut);
      syncMerchantDishToUserCatalog(outletId, dish);
      return resolve(isSoldOut);
    },

    async toggleFeatured(outletId, dishId) {
      const menu = getMerchantMenu(outletId);
      const dish = menu.find((menuDish) => menuDish.id === dishId);
      if (!dish) throw new Error(`Dish ${dishId} not found for outlet ${outletId}`);
      const isFeatured = !dish.availabilityFlags.includes("Featured");
      dish.availabilityFlags = mergeAvailabilityFlag(
        dish.availabilityFlags,
        "Featured",
        isFeatured,
      );
      syncMerchantDishToUserCatalog(outletId, dish);
      return resolve(isFeatured);
    },

    async getOCRDrafts(outletId) {
      getMerchantOutlet(outletId);
      return resolve(clone(_merchantOCRDrafts.filter((draft) => draft.outletId === outletId)));
    },

    async acceptOCRDraft(draftId) {
      const draft = _merchantOCRDrafts.find((d) => d.id === draftId);
      if (!draft) throw new Error(`OCR draft ${draftId} not found`);
      if (draft.status !== "pending")
        throw new Error(`OCR draft ${draftId} is already ${draft.status}`);

      const acceptedDish = buildMerchantDish(draft.outletId, {
        id: `dish-from-${draftId}`,
        name: draft.name,
        price: draft.price ?? 5,
        priceRange: `S$${(draft.price ?? 5).toFixed(2)}`,
        imageUrl: draft.sourcePhotoUrl,
        gallery: [draft.sourcePhotoUrl],
        description: draft.suggestedDescription,
        tasteTags: draft.suggestedTasteTags ?? [],
        dietaryFlags: draft.suggestedDietaryTags ?? [],
      });
      getMerchantMenu(draft.outletId).push(acceptedDish);
      syncMerchantDishToUserCatalog(draft.outletId, acceptedDish);
      draft.status = "accepted";
      return resolve(clone(acceptedDish));
    },

    async rejectOCRDraft(draftId) {
      const draft = _merchantOCRDrafts.find((d) => d.id === draftId);
      if (!draft) throw new Error(`OCR draft ${draftId} not found`);
      draft.status = "rejected";
      return resolve(undefined);
    },

    async getInbox(outletId, filters) {
      getMerchantOutlet(outletId);
      let interactions = _merchantInbox.filter((interaction) => interaction.outletId === outletId);
      if (filters?.type) {
        interactions = interactions.filter((i) => i.type === filters.type);
      }
      if (filters?.unrepliedOnly) {
        interactions = interactions.filter((i) => !i.reply);
      }
      interactions = [...interactions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return resolve(clone(interactions));
    },

    async replyToInteraction(interactionId, text) {
      const interaction = _merchantInbox.find((i) => i.id === interactionId);
      if (!interaction) throw new Error(`Interaction ${interactionId} not found`);
      const trimmedText = text.trim();
      if (!trimmedText) throw new Error("Reply text is required");
      interaction.reply = {
        text: trimmedText,
        repliedAt: new Date().toISOString(),
      };
      return resolve(undefined);
    },

    async reportInteraction(interactionId, reason) {
      const interaction = _merchantInbox.find((i) => i.id === interactionId);
      if (!interaction) throw new Error(`Interaction ${interactionId} not found`);
      const trimmedReason = reason.trim();
      if (!trimmedReason) throw new Error("Report reason is required");
      _merchantInteractionReports.push({
        interactionId,
        reason: trimmedReason,
        reportedAt: new Date().toISOString(),
      });
      return resolve(undefined);
    },

    async listPopularVisitorCandidates(outletId) {
      return resolve(clone(getReviewBackedVisitorCandidates(outletId)));
    },

    async listPopularVisitorPins(outletId) {
      return resolve(clone(listActivePopularVisitorPins(outletId)));
    },

    async pinPopularVisitor(outletId, reviewId) {
      getMerchantOutlet(outletId);
      const existing = _popularVisitorPins.find(
        (pin) => pin.outletId === outletId && pin.reviewId === reviewId,
      );
      if (existing?.isActive) {
        return resolve(clone(existing));
      }

      const nextPin = buildPopularVisitorPin(outletId, reviewId);
      if (existing) {
        Object.assign(existing, {
          ...nextPin,
          id: existing.id,
        });
        return resolve(clone(existing));
      }

      _popularVisitorPins.push(nextPin);
      return resolve(clone(nextPin));
    },

    async unpinPopularVisitor(pinId) {
      const pin = _popularVisitorPins.find((item) => item.id === pinId);
      if (!pin) throw new Error(`Popular visitor pin ${pinId} not found`);
      pin.isActive = false;
      return resolve(undefined);
    },

    async reorderPopularVisitorPins(outletId, orderedPinIds) {
      const activePins = listActivePopularVisitorPins(outletId);
      const activePinIds = new Set(activePins.map((pin) => pin.id));
      const uniqueOrderedIds = Array.from(
        new Set(orderedPinIds.filter((pinId) => activePinIds.has(pinId))),
      );
      const remainingIds = activePins
        .map((pin) => pin.id)
        .filter((pinId) => !uniqueOrderedIds.includes(pinId));

      [...uniqueOrderedIds, ...remainingIds].forEach((pinId, index) => {
        const pin = _popularVisitorPins.find(
          (item) => item.id === pinId && item.outletId === outletId && item.isActive,
        );
        if (pin) pin.sortOrder = index;
      });

      return resolve(clone(listActivePopularVisitorPins(outletId)));
    },

    async getPromotions(outletId, status) {
      getMerchantOutlet(outletId);
      let promotions = _merchantPromotions.filter((promo) => promo.outletId === outletId);
      if (status) {
        promotions = promotions.filter((promo) => promo.status === status);
      }
      promotions = [...promotions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return resolve(clone(promotions));
    },

    async createPromotion(outletId, promo) {
      getMerchantOutlet(outletId);
      const newPromotion: MerchantPromotion = {
        ...promo,
        id: `promo-new-${++_merchantPromotionCounter}`,
        outletId,
        createdAt: new Date().toISOString(),
        analytics: getPromotionAnalyticsValue({ ...promo, id: "preview", outletId, createdAt: "" }),
      };
      _merchantPromotions.push(newPromotion);
      return resolve(clone(newPromotion));
    },

    async updatePromotion(promoId, updates) {
      const promoIndex = _merchantPromotions.findIndex((p) => p.id === promoId);
      if (promoIndex === -1) throw new Error(`Promotion ${promoId} not found`);
      const updatedPromotion: MerchantPromotion = {
        ..._merchantPromotions[promoIndex],
        ...updates,
      };
      updatedPromotion.analytics = getPromotionAnalyticsValue(updatedPromotion);
      _merchantPromotions[promoIndex] = updatedPromotion;
      return resolve(clone(updatedPromotion));
    },

    async getPromotionAnalytics(promoId) {
      const promo = _merchantPromotions.find((p) => p.id === promoId);
      if (!promo) throw new Error(`Promotion ${promoId} not found`);
      promo.analytics = getPromotionAnalyticsValue(promo);
      return resolve(clone(promo.analytics));
    },

    async getAnalytics(outletId, dateRange) {
      getMerchantOutlet(outletId);
      return resolve(clone(buildMockMerchantAnalytics(outletId, dateRange)));
    },

    async getWeeklySummaryStats(outletId) {
      getMerchantOutlet(outletId);
      return resolve(clone(buildWeeklySummaryStats(outletId)));
    },

    async getMerchantNotifications(merchantAccountId) {
      getMerchantAccountById(merchantAccountId);
      return resolve(
        clone(
          _merchantNotifications
            .filter((notification) => notification.merchantAccountId === merchantAccountId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        ),
      );
    },

    async syncLowRatingNotifications(outletId) {
      const notifications = getLowRatingNotificationsForOutlet(outletId);
      return resolve(clone(notifications));
    },

    async sendWeeklySummaryNotifications(outletId) {
      const outlet = getMerchantOutlet(outletId);
      const summary = buildWeeklySummaryStats(outletId);
      const members = getTeamMembersForAccount(outlet.merchantAccountId).filter(
        (member) => member.inviteStatus !== "removed",
      );
      const notifications = members.map((member) =>
        createMerchantNotification({
          merchantAccountId: outlet.merchantAccountId,
          outletId,
          recipientUserId: member.userId,
          recipientEmail: member.email,
          kind: "weekly_summary",
          title: `${outlet.name} weekly summary is ready`,
          body: `${summary.totalViews.toLocaleString()} views, ${summary.newReviews} new reviews, ${summary.unrepliedReviews} unreplied reviews.`,
          status: "unread",
          dedupeKey: `weekly-summary:${summary.id}:${member.id}`,
          deepLink: "MerchantTabs/MerchantAnalytics",
          metadata: { summaryId: summary.id },
        }),
      );
      return resolve(clone(notifications));
    },

    async generateDishDescription(dishName, ingredients) {
      const ingredientStr = ingredients?.join(", ") ?? "";
      return resolve(
        `A delicious ${dishName} made with ${ingredientStr || "fresh, quality ingredients"}. Perfectly seasoned and prepared to order.`,
      );
    },

    async suggestIngredients(dishName) {
      const suggestions: Record<string, string[]> = {
        "Wonton Mee": [
          "egg noodles",
          "wonton wrappers",
          "minced pork",
          "char siu",
          "spring onions",
          "sesame oil",
          "dark soy sauce",
        ],
        default: ["salt", "pepper", "oil", "garlic", "onion"],
      };
      return resolve(suggestions[dishName] ?? suggestions.default);
    },

    async suggestAllergens(ingredients) {
      const allergens: string[] = [];
      const lower = ingredients.map((i) => i.toLowerCase());
      if (lower.some((i) => i.includes("egg"))) allergens.push("Eggs");
      if (lower.some((i) => i.includes("soy"))) allergens.push("Soy");
      if (lower.some((i) => i.includes("wheat") || i.includes("noodle"))) allergens.push("Gluten");
      if (lower.some((i) => i.includes("peanut"))) allergens.push("Peanuts");
      if (lower.some((i) => i.includes("sesame"))) allergens.push("Sesame");
      if (lower.some((i) => i.includes("shrimp") || i.includes("prawn")))
        allergens.push("Shellfish");
      return resolve(allergens);
    },

    async suggestTags(dishName, _description) {
      const tags: Record<string, string[]> = {
        "Wonton Mee": ["Savoury", "Springy noodles", "Wok hei"],
        "Char Siu Rice": ["Sweet", "Savoury", "BBQ"],
        default: ["Savoury", "Fresh"],
      };
      return resolve(tags[dishName] ?? tags.default);
    },

    async generateAIReply(interactionId) {
      const interaction = _merchantInbox.find((i) => i.id === interactionId);
      if (!interaction) throw new Error(`Interaction ${interactionId} not found`);
      if (interaction.type === "question") {
        return resolve(
          "Thanks for checking with us. We will confirm this clearly so you can plan your visit.",
        );
      }
      if (interaction?.sentiment === "positive") {
        return resolve(
          "Thank you so much for your kind words. We're glad you enjoyed your meal and hope to see you again soon.",
        );
      }
      if (interaction?.sentiment === "negative") {
        return resolve(
          "We're sorry to hear about your experience. This is not up to our usual standards. We will review this with the team and do better.",
        );
      }
      return resolve("Thank you for your feedback! We appreciate you taking the time to share.");
    },

    async getAIInsights(outletId) {
      return resolve(clone(getAIInsightsForOutlet(outletId)));
    },

    async getWeeklySummary(outletId) {
      const summary = getAIInsightsForOutlet(outletId, ["weekly_summary"])[0];
      if (!summary) throw new Error(`Weekly summary for outlet ${outletId} not found`);
      return resolve(clone(summary));
    },

    async getProfileSuggestions(outletId) {
      return resolve(clone(getAIInsightsForOutlet(outletId, ["profile_improvement"])));
    },

    async getMenuCleanupSuggestions(outletId) {
      return resolve(
        clone(getAIInsightsForOutlet(outletId, ["menu_cleanup", "photo_enhancement"])),
      );
    },

    async getDemandInsights(outletId) {
      return resolve(clone(getAIInsightsForOutlet(outletId, ["demand_insight", "promotion_tip"])));
    },

    async getTeamMembers(merchantAccountId) {
      return resolve(clone(getTeamMembersForAccount(merchantAccountId)));
    },

    async addTeamMember(merchantAccountId, email, role, displayName) {
      const members = getTeamMembersForAccount(merchantAccountId);
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = displayName?.trim() ?? "";
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        throw new Error("Valid team member email is required");
      }
      if (!trimmedName) {
        throw new Error("Team member name is required");
      }
      if (members.some((member) => member.email.toLowerCase() === normalizedEmail)) {
        throw new Error(`Team member ${normalizedEmail} already exists`);
      }
      const newMember: MerchantTeamMember = {
        id: `tm-new-${++_merchantTeamMemberCounter}`,
        merchantAccountId,
        userId: `invited-user-${_merchantTeamMemberCounter}`,
        displayName: trimmedName,
        email: normalizedEmail,
        role,
        addedAt: new Date().toISOString(),
        inviteStatus: "pending",
        invitedAt: new Date().toISOString(),
      };
      members.push(newMember);
      createMerchantNotification({
        merchantAccountId,
        recipientEmail: normalizedEmail,
        kind: "team_invite",
        title: "You have been invited to manage a Hungry stall",
        body: `${trimmedName}, open Hungry to accept your merchant team invite.`,
        status: "sent",
        dedupeKey: `team-invite:${merchantAccountId}:${normalizedEmail}`,
        deepLink: "MerchantTabs/MerchantSettings",
        metadata: {
          memberId: newMember.id,
          role,
          delivery: "email",
        },
      });
      return resolve(clone(newMember));
    },

    async removeTeamMember(memberId) {
      for (const members of _merchantTeamMembersByAccount.values()) {
        const memberIndex = members.findIndex((member) => member.id === memberId);
        if (memberIndex === -1) continue;
        if (members[memberIndex].role === "owner") {
          throw new Error("Owner team member cannot be removed");
        }
        members.splice(memberIndex, 1);
        return resolve(undefined);
      }
      throw new Error(`Team member ${memberId} not found`);
    },

    async updateTeamMemberRole(memberId, role) {
      for (const members of _merchantTeamMembersByAccount.values()) {
        const member = members.find((candidate) => candidate.id === memberId);
        if (!member) continue;
        if (member.role === "owner" && role !== "owner") {
          throw new Error("Owner role cannot be changed");
        }
        member.role = role;
        return resolve(undefined);
      }
      throw new Error(`Team member ${memberId} not found`);
    },

    async getNotificationPreferences(merchantAccountId) {
      return resolve(clone(getNotificationPreferencesForAccount(merchantAccountId)));
    },

    async updateNotificationPreferences(merchantAccountId, prefs) {
      const current = getNotificationPreferencesForAccount(merchantAccountId);
      Object.assign(current, prefs);
      return resolve(undefined);
    },
  },
};
