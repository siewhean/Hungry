/**
 * Hungry — Full Mock Implementation of HungryService
 *
 * Implements all 41 methods across 6 domains. Every method returns a Promise
 * so the call sites are identical to the future Supabase implementation.
 *
 * Swap: replace `hungryService` export with a Supabase adapter when ready.
 */

import { getFloorPlan } from "@/lib/geo/floorPlans";
import { PROFILE_BIO_MAX_LENGTH } from "@/features/profile/profileBio";
import { normalizeReviewPatch } from "@/features/review/reviewEdit";
import { MERCHANT_DEEP_LINKS } from "@/features/merchant/merchantDeepLinks";
import { getNearestBuildings } from "@/lib/geo/singaporeBuildings";
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
  ChecklistItemCreateInput,
  ExplicitFeedbackInput,
  ExtendedRecommendationContext,
  HungryService,
  ImplicitSignalInput,
  PortfolioCreateInput,
  PortfolioItemCreateInput,
  PortfolioMutationOptions,
  QuizAnswer,
  RankedRecommendation,
  RecommendationContext,
  RecommendationResult,
  RecommendationSlateRequest,
  ScenarioQuizAnswer,
  SearchResult,
  Session,
  SubmitReviewInput,
  RecentReviewFeedEntry,
} from "@/lib/services/types";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/services/types";
import type {
  AIBusinessInsight,
  MoodSearchIntent,
  CustomerInteraction,
  DishDetail,
  DietaryFlag,
  HawkerTasteTag,
  MerchantAnalytics,
  MerchantDishViewEvent,
  MerchantNotification,
  MerchantNotificationPreferences,
  MerchantPromotion,
  OpeningSchedule,
  PublicMerchantProfile,
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
  Checklist,
  ChecklistItem,
  Portfolio,
  PortfolioCollaborator,
  PortfolioFlag,
  PortfolioFlagReason,
  PortfolioFollow,
  PortfolioItem,
  PassportEventType,
  PassportProgressEvent,
  PassportStamp,
  SubmitUserStallSubmissionInput,
  UserStallSubmission,
  PushPreferences,
  LifecycleSnapshot,
  WelcomeBackDish,
} from "@/types/domain";
import { DEFAULT_PUSH_PREFERENCES } from "@/types/domain";
import { computeTasteProfileFromQuiz } from "@/lib/ai/tasteQuiz";
import {
  runRecommendationPipeline,
  processExplicitFeedback as processExplicitFeedbackCore,
} from "@/lib/ai/tasteEngine";
import type { ExplicitFeedbackEvent } from "@/lib/ai/tasteEngine";
import { buildLifecycleSnapshot, singaporeDateKey } from "@/features/lifecycle/lifecycle";
import { suggestAllergensFromIngredients } from "@/features/merchant/allergenKeywords";
import { applyVerificationSubmission } from "@/features/merchant/verificationStateMachine";
import { validateMerchantProfileUpdates } from "@/features/merchant/profileValidation";
import { filterCustomerVisiblePromotions } from "@/features/merchant/customerPromotions";
import { validateMerchantPromotionInput } from "@/features/merchant/promotionValidation";
import { loadMockState, saveMockState } from "./persistence";
import { POST_CAPTION_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import { biteToStallPost } from "@/lib/services/postTransforms";
import {
  appendPublishedStallPost,
  hydratePublishedStallPosts,
  listMockStallPosts,
  removePublishedStallPost,
} from "./stallPostState";

type MerchantActionEventInput = Parameters<
  HungryService["discovery"]["recordMerchantActionEvent"]
>[0];
type MockMerchantActionEvent = MerchantActionEventInput & {
  outletId: string;
  sessionId: string;
  occurredAt: string;
};

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

function canViewMockPortfolio(portfolio: Portfolio): boolean {
  return (
    portfolio.ownerId === _profile.id ||
    portfolio.visibility === "public" ||
    _portfolioFollows.some(
      (follow) => follow.portfolioId === portfolio.id && follow.userId === _profile.id,
    ) ||
    _portfolioCollaborators.some(
      (collaborator) =>
        collaborator.portfolioId === portfolio.id && collaborator.userId === _profile.id,
    )
  );
}

/** Owner or editor collaborator, like the item RPCs (add/update/delete/reorder). */
function canEditMockPortfolio(portfolioId: string): boolean {
  return (
    _portfolios.some((entry) => entry.id === portfolioId && entry.ownerId === _profile.id) ||
    _portfolioCollaborators.some(
      (collaborator) =>
        collaborator.portfolioId === portfolioId &&
        collaborator.userId === _profile.id &&
        collaborator.role === "editor",
    )
  );
}

function assertMockPortfolioVersion(portfolioId: string, options?: PortfolioMutationOptions): void {
  if (!options?.expectedUpdatedAt) return;
  const portfolio = _portfolios.find((entry) => entry.id === portfolioId);
  if (!portfolio || portfolio.updatedAt !== options.expectedUpdatedAt) {
    throw new Error(
      "This portfolio changed elsewhere. Review the latest version before saving again.",
    );
  }
}

function ensureMockContributorStamp(now = new Date().toISOString()): PassportStamp {
  const existing = _passportStamps.find(
    (stamp) => stamp.userId === _profile.id && stamp.categoryId === "contributor",
  );
  if (existing) {
    return existing;
  }

  const stamp: PassportStamp = {
    id: `passport-stamp-${++_passportStampCounter}`,
    userId: _profile.id,
    categoryId: "contributor",
    level: 1,
    dishesTriedCount: 0,
    stallsVisitedCount: 0,
    stallsSubmittedCount: 0,
    reviewsPostedCount: 0,
    photosPostedCount: 0,
    portfolioItemsAdded: 0,
    publicPortfoliosPublished: 0,
    trailsCompleted: 0,
    createdAt: now,
    updatedAt: now,
  };
  _passportStamps = [..._passportStamps, stamp];
  return stamp;
}

function recordMockPassportProgress(eventType: PassportEventType, referenceId?: string): void {
  const now = new Date().toISOString();
  const event: PassportProgressEvent = {
    id: `passport-event-${++_passportEventCounter}`,
    userId: _profile.id,
    categoryId: "contributor",
    eventType,
    referenceId,
    createdAt: now,
  };
  _passportEvents = [event, ..._passportEvents];

  ensureMockContributorStamp(now);
  _passportStamps = _passportStamps.map((stamp) => {
    if (stamp.userId !== _profile.id || stamp.categoryId !== "contributor") {
      return stamp;
    }

    return {
      ...stamp,
      portfolioItemsAdded:
        eventType === "portfolio_item_added"
          ? stamp.portfolioItemsAdded + 1
          : stamp.portfolioItemsAdded,
      publicPortfoliosPublished:
        eventType === "public_portfolio_published"
          ? stamp.publicPortfoliosPublished + 1
          : stamp.publicPortfoliosPublished,
      trailsCompleted:
        eventType === "trail_completed" ? stamp.trailsCompleted + 1 : stamp.trailsCompleted,
      stallsSubmittedCount:
        eventType === "stall_submitted"
          ? stamp.stallsSubmittedCount + 1
          : stamp.stallsSubmittedCount,
      updatedAt: now,
    };
  });
}

function cleanOptionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function createMockUserStallSubmission(input: SubmitUserStallSubmissionInput): UserStallSubmission {
  const now = new Date().toISOString();
  return {
    id: `mock-stall-submission-${++_userStallSubmissionCounter}`,
    userId: _profile.id,
    stallName: input.stallName.trim(),
    imageUrl: input.imageUri,
    galleryImageUrls: input.imageUris?.length ? input.imageUris : [input.imageUri],
    imageMimeType: input.imageMimeType,
    sourceUrl: cleanOptionalText(input.sourceUrl),
    buildingName: cleanOptionalText(input.buildingName),
    area: cleanOptionalText(input.area),
    address: cleanOptionalText(input.address),
    postalCode: cleanOptionalText(input.postalCode),
    unitNumber: cleanOptionalText(input.unitNumber),
    floor: cleanOptionalText(input.floor),
    operatingHours: cleanOptionalText(input.operatingHours),
    menuItems: (input.menuItems ?? [])
      .map((item) => ({
        name: item.name.trim(),
        priceRange: cleanOptionalText(item.priceRange),
        notes: cleanOptionalText(item.notes),
      }))
      .filter((item) => item.name.length > 0),
    deliveryLinks: (input.deliveryLinks ?? [])
      .map((link) => ({
        label: link.label.trim(),
        url: link.url.trim(),
      }))
      .filter((link) => link.label.length > 0 && link.url.length > 0),
    notes: cleanOptionalText(input.notes),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Mutable in-memory state (mirrors what Supabase would persist) ─────────────

let _profile: UserProfile = { ...guestProfile };
const _submittedClientReviewIds = new Set<string>();
/** Reviews the mock viewer marked helpful. */
const _helpfulReviewIds = new Set<string>();
let _followedStallIds = new Set<string>();
let _pushPreferences: PushPreferences = { ...DEFAULT_PUSH_PREFERENCES };
/** Singapore dates the mock user opened the app (record_app_open). */
const _activityDates = new Set<string>();
let _isAuthenticated = false;
let _authProvider: "email" | "google" | "apple" = "email";
let _pendingDeletionScheduledFor: string | undefined;
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
let _checklistCounter = 0;
let _checklistItemCounter = 0;
let _portfolioCounter = 0;
let _portfolioItemCounter = 0;
let _portfolioCollaboratorCounter = 0;
let _portfolioFollowCounter = 0;
let _portfolioFlagCounter = 0;
let _passportStampCounter = 0;
let _passportEventCounter = 0;
let _userStallSubmissionCounter = 0;
let _checklists: Checklist[] = [];
let _checklistItems: ChecklistItem[] = [];
let _portfolios: Portfolio[] = [];
let _portfolioItems: PortfolioItem[] = [];
let _portfolioCollaborators: PortfolioCollaborator[] = [];
let _portfolioFollows: PortfolioFollow[] = [];
let _portfolioFlags: PortfolioFlag[] = [];
/** Lists a moderator removed; like portfolios.moderation_removed_at they stay private. */
const _moderationRemovedPortfolioIds = new Set<string>();
const MODERATION_REMOVED_LIST_MESSAGE = "This list was removed by moderators and can't be shared";
let _passportStamps: PassportStamp[] = [];
let _passportEvents: PassportProgressEvent[] = [];
let _userStallSubmissions: UserStallSubmission[] = [];
let _chatConversations: ChatConversation[] = clone(chatConversations);
let _chatMessages: Record<string, ChatMessage[]> = clone(chatMessages);
const _chatSubscribers = new Map<string, Set<(message: ChatMessage) => void>>();
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

let _mockStories: Story[] = [
  {
    id: "s0",
    displayName: "Your Story",
    authorId: _profile.id,
    authorProfileVisibility: _profile.profileVisibility,
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
    authorId: "story-author-tian-tian",
    authorProfileVisibility: "public",
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
    authorId: "story-author-wei-ming",
    authorProfileVisibility: "public",
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
const _merchantActionEvents: MockMerchantActionEvent[] = [];
const _merchantNotifications: MerchantNotification[] = [];
const _merchantMenuByOutlet = new Map<string, DishDetail[]>();
const _biteReactions: Record<string, { cravings: Set<string>; saves: Set<string> }> = {};

function withMockViewerReactions(bite: Bite): Bite {
  const reactions = _biteReactions[bite.id];
  const viewerHasLiked = reactions?.cravings.has(_profile.id) ?? false;
  const viewerHasSaved = reactions?.saves.has(_profile.id) ?? false;
  // Seeded counts exclude the viewer, like a server count that includes them.
  return {
    ...bite,
    cravingCount: bite.cravingCount + (viewerHasLiked ? 1 : 0),
    savedCount: bite.savedCount + (viewerHasSaved ? 1 : 0),
    viewerHasLiked,
    viewerHasSaved,
  };
}
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
/** Blocked author ids, keyed like the Supabase user_blocks.blocked_user_key column. */
const _blockedUsers = new Map<string, { reason?: string; createdAt: string }>();

/** Distinct reporters that auto-hide a review, like report_content on the server. */
const REVIEW_REPORT_AUTO_HIDE_THRESHOLD = 3;
/** Reviews hidden by the report threshold: only their author still sees them. */
const _moderationHiddenReviewIds = new Set<string>();

function recordMockReviewReport(reviewId: string) {
  const reporters = new Set(
    _contentReports
      .filter((report) => report.targetType === "review" && report.targetId === reviewId)
      .map((report) => report.reporterId),
  );
  if (reporters.size >= REVIEW_REPORT_AUTO_HIDE_THRESHOLD) {
    _moderationHiddenReviewIds.add(reviewId);
  }
}

/** Merchant inbox reviews hidden by the report threshold, like reviews RLS for the merchant. */
function isMockInboxReviewModerationHidden(interaction: CustomerInteraction): boolean {
  return (
    interaction.type === "review" &&
    _moderationHiddenReviewIds.has(interaction.sourceId ?? interaction.id)
  );
}

/**
 * Mirrors the Supabase review read policies: hide report-threshold reviews from everyone but
 * their author, blocked authors, and reviews the viewer reported.
 */
/** The dish holding the signed-in user's own review; throws like the RLS-scoped update. */
function findMockOwnReviewDish(reviewId: string, action: "edit" | "delete") {
  const dish = dishes.find((item) =>
    item.reviews.some((review) => review.id === reviewId && review.authorId === _profile.id),
  );
  if (!dish) throw new Error(`Review not found, or it isn't yours to ${action}.`);
  return dish;
}

function isMockReviewHiddenForViewer(review: { id: string; authorId?: string }): boolean {
  if (_moderationHiddenReviewIds.has(review.id) && review.authorId !== _profile.id) return true;
  if (review.authorId && _blockedUsers.has(review.authorId)) return true;
  return _contentReports.some(
    (report) =>
      report.reporterId === _profile.id &&
      report.targetType === "review" &&
      report.targetId === review.id,
  );
}
const _userFollows = new Set<string>(); // Set of followee userId strings (current user follows these)
/** Mock private accounts: following them creates a pending request, like follow_user in SQL. */
const _mockPrivateUserIds = new Set<string>(["user-emma"]);
/** Pending requests the current user sent (followee ids). */
const _userFollowRequests = new Set<string>();
/** Pending requests other users sent to the current user, newest first. */
let _incomingFollowRequests: {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  requestedAt: string;
}[] = [
  {
    userId: "user-jia-hui",
    displayName: "Jia Hui",
    avatarUrl: "https://i.pravatar.cc/64?img=32",
    requestedAt: "2026-10-18T09:30:00.000Z",
  },
  {
    userId: "user-marcus-tan",
    displayName: "Marcus Tan",
    avatarUrl: "https://i.pravatar.cc/64?img=13",
    requestedAt: "2026-10-17T14:05:00.000Z",
  },
];
function listMockIncomingFollowRequests() {
  return _incomingFollowRequests.filter((request) => !_blockedUsers.has(request.userId));
}
const _mockFollowersByUser: Record<
  string,
  { userId: string; displayName: string; avatarUrl?: string }[]
> = {
  [userProfile.id]: [
    {
      userId: "user-sarah-lim",
      displayName: "Sarah Lim",
      avatarUrl: "https://i.pravatar.cc/64?img=5",
    },
    {
      userId: "user-sarah-l",
      displayName: "Sarah L",
      avatarUrl: "https://i.pravatar.cc/64?img=6",
    },
    {
      userId: "user-tan-ah-teck",
      displayName: "Tan Ah Teck",
      avatarUrl: "https://i.pravatar.cc/64?img=15",
    },
    {
      userId: "user-emma-watson",
      displayName: "Emma Watson",
      avatarUrl: "https://i.pravatar.cc/64?img=47",
    },
    {
      userId: "user-emma-c",
      displayName: "Emma C",
      avatarUrl: "https://i.pravatar.cc/64?img=50",
    },
    {
      userId: "user-wei-ming",
      displayName: "Wei Ming",
      avatarUrl: "https://i.pravatar.cc/64?img=11",
    },
  ],
};

function dedupeMockFollowers(
  followers: { userId: string; displayName: string; avatarUrl?: string }[],
) {
  const seen = new Set<string>();

  return followers.filter((follower) => {
    const normalizedId = follower.userId.trim();
    const normalizedName = follower.displayName.trim().toLowerCase();
    const key = normalizedId || normalizedName;

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/** Only the signed-in mock profile has seeded followers; other users get their real mock follows. */
function listMockFollowers(userId: string) {
  const seeded =
    _mockFollowersByUser[userId] ??
    (userId === _profile.id ? _mockFollowersByUser[userProfile.id] : undefined) ??
    [];
  const viewerFollows =
    userId !== _profile.id && _userFollows.has(userId)
      ? [{ userId: _profile.id, displayName: _profile.displayName, avatarUrl: _profile.avatarUrl }]
      : [];
  return dedupeMockFollowers([...seeded.filter(Boolean), ...viewerFollows]);
}
/** Name/avatar for a mock user id, like the user_profiles join in the list RPCs. */
function findMockPerson(userId: string): { displayName: string; avatarUrl?: string } {
  if (userId === _profile.id) {
    return { displayName: _profile.displayName, avatarUrl: _profile.avatarUrl };
  }
  const known = [...Object.values(_mockFollowersByUser).flat(), ..._incomingFollowRequests].find(
    (person) => person.userId === userId,
  );
  return known
    ? { displayName: known.displayName, avatarUrl: known.avatarUrl }
    : { displayName: "Hungry member" };
}
/** Same paging rules as the list_user_followers/list_user_following RPCs (default 100, max 500). */
function pageMockFollowRows<T>(rows: T[], page?: { limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(page?.limit ?? 100, 1), 500);
  const offset = Math.max(page?.offset ?? 0, 0);
  return rows.slice(offset, offset + limit);
}
const _mockComments: Record<
  string,
  {
    id: string;
    userId: string;
    body: string;
    createdAt: string;
    parentCommentId?: string;
    authorName?: string;
    authorAvatarUrl?: string;
  }[]
> = {};

if (typeof __DEV__ !== "undefined" && __DEV__) {
  // TODO(api): keep fixture validation while mock mode is active; remove once backend contracts are fully live.
  assertFixtureBundleValid();
}

// ─── Mock session ─────────────────────────────────────────────────────────────

function mockUserIdFromEmail(email: string): string {
  const slug = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `user-${slug || "mock"}`;
}

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

function getMerchantPromotionOutletDishIds(outletId: string): string[] {
  const outlet = getMerchantOutlet(outletId);
  const menu = getMerchantMenu(outletId);
  return Array.from(new Set([...menu.map((dish) => dish.id), ...outlet.signatureDishIds]));
}

function syncMerchantOutletToUserCatalog(
  outlet: ReturnType<typeof getMerchantOutlet>,
): VenueSummary {
  const venueId = getMockMerchantVenueId(outlet.id);
  const menu = _merchantMenuByOutlet.get(outlet.id) ?? [];
  const topDishId = menu[0]?.id ?? outlet.signatureDishIds[0] ?? "";
  // Same rule as the Supabase sync trigger: a home-based outlet never shows unit or floor.
  const isHomeBased = outlet.businessType === "home_based";
  const venue: VenueSummary = {
    id: venueId,
    buildingId: outlet.buildingId ?? "building-maxwell",
    name: outlet.name,
    unitNumber: isHomeBased ? "" : (outlet.unitNumber ?? ""),
    floor: isHomeBased ? "" : (outlet.floor ?? ""),
    isOpen: outlet.isLive && !outlet.temporaryClosure,
    liveCrowd: "medium",
    topDishId,
    operatingHours: outlet.operatingHours,
    openingSchedule: outlet.openingSchedule,
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
    .filter(
      (interaction) =>
        interaction.outletId === outlet.id &&
        interaction.type === "review" &&
        !isMockInboxReviewModerationHidden(interaction),
    )
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

function getPromotionOutletVenueId(promotion: MerchantPromotion): string | undefined {
  if (promotion.targetDishId) {
    return dishes.find((dish) => dish.id === promotion.targetDishId)?.venueId;
  }
  const outlet = merchantAccount.outlets.find((item) => item.id === promotion.outletId);
  const signatureDishId = outlet?.signatureDishIds[0];
  return signatureDishId ? dishes.find((dish) => dish.id === signatureDishId)?.venueId : undefined;
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

function getOutletForMerchantAction(
  input: MerchantActionEventInput,
): ReturnType<typeof getMerchantOutlet> | undefined {
  if (input.outletId) {
    const outlet = _merchantAccount.outlets.find((candidate) => candidate.id === input.outletId);
    if (outlet) return outlet;
  }

  if (input.dishId) {
    const outlet = getOutletForDishView(input.dishId);
    if (outlet) return outlet;
  }

  if (input.venueId) {
    return _merchantAccount.outlets.find(
      (outlet) =>
        getMockMerchantVenueId(outlet.id) === input.venueId ||
        dishes.some(
          (dish) =>
            dish.venueId === input.venueId && getOutletForDishView(dish.id)?.id === outlet.id,
        ),
    );
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
  const actionEvents = _merchantActionEvents.filter((event) => event.outletId === outletId);
  const countActions = (eventType: MerchantActionEventInput["eventType"]) =>
    actionEvents.filter((event) => event.eventType === eventType).length;
  const saveCounts = new Map<string, number>();
  actionEvents
    .filter((event) => event.eventType === "save" && event.dishId)
    .forEach((event) => {
      saveCounts.set(event.dishId!, (saveCounts.get(event.dishId!) ?? 0) + 1);
    });
  analytics.dishViews += eventViews;
  analytics.menuViews += eventViews;
  analytics.profileVisits += Math.floor(eventViews / 2);
  analytics.profileVisits += countActions("stall_profile_view");
  analytics.menuViews += countActions("menu_view");
  analytics.directionTaps += countActions("direction_tap");
  analytics.saves += countActions("save");
  analytics.shares += countActions("share");
  analytics.contactTaps += countActions("contact_tap");
  analytics.socialLinkTaps += countActions("social_link_tap");
  analytics.topDishes = menu
    .map((dish, index) => ({
      dishId: dish.id,
      name: dish.name,
      views: (analytics.topDishes[index]?.views ?? 0) + (viewCounts.get(dish.id) ?? 0),
      saves: (analytics.topDishes[index]?.saves ?? 0) + (saveCounts.get(dish.id) ?? 0),
    }))
    .sort((left, right) => right.views - left.views)
    .slice(0, 5);

  const reviews = _merchantInbox.filter(
    (interaction) =>
      interaction.outletId === outletId &&
      interaction.type === "review" &&
      !isMockInboxReviewModerationHidden(interaction),
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
      deepLink: MERCHANT_DEEP_LINKS.inbox,
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
      _authProvider = "email";
      _profile = {
        ...userProfile,
        id: mockUserIdFromEmail(email),
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

    async confirmEmail(_code) {
      _isAuthenticated = true;
      _authProvider = "email";
      return resolve(mockSession(_profile));
    },

    async verifyEmailCode(_email, code, type) {
      if (!/^\d{8}$/.test(code.trim())) throw new Error("Invalid code");
      _isAuthenticated = true;
      _authProvider = "email";
      return resolve(type === "signup" ? mockSession(_profile) : null);
    },

    async signIn(email, _password) {
      _isAuthenticated = true;
      _authProvider = "email";
      _profile = { ...userProfile, email };
      return resolve(mockSession(_profile));
    },

    async signInWithGoogle() {
      _isAuthenticated = true;
      _authProvider = "google";
      _profile = { ...userProfile };
      return resolve(mockSession(_profile));
    },

    async signInWithApple() {
      _isAuthenticated = true;
      _authProvider = "apple";
      _profile = { ...userProfile };
      return resolve(mockSession(_profile));
    },

    async signOut() {
      _isAuthenticated = false;
      _profile = { ...guestProfile };
      return resolve(undefined);
    },

    async sendAccountDeletionCode() {
      return resolve(undefined);
    },

    async requestAccountDeletion() {
      // Mock-safe stub: production queues the request for the deletion worker.
      _pendingDeletionScheduledFor = new Date(
        Date.now() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      _isAuthenticated = false;
      _profile = { ...guestProfile };
      return resolve({ scheduledFor: _pendingDeletionScheduledFor });
    },

    async getPendingAccountDeletion() {
      if (!_isAuthenticated || !_pendingDeletionScheduledFor) return resolve(null);
      return resolve({ scheduledFor: _pendingDeletionScheduledFor });
    },

    async cancelAccountDeletion() {
      const hadPending = _isAuthenticated && Boolean(_pendingDeletionScheduledFor);
      if (hadPending) _pendingDeletionScheduledFor = undefined;
      return resolve(hadPending);
    },

    async forgotPassword(_email) {
      // Mock: no-op — in production sends a reset email
      return resolve(undefined);
    },

    async exchangeRecoveryCode(_token) {
      // Mock: no-op — in production exchanges the reset link code for a session
      return resolve(undefined);
    },

    async updatePassword(_password) {
      // Mock: no-op — in production updates the recovery session's password
      return resolve(undefined);
    },

    async canChangePassword() {
      return resolve(_isAuthenticated && _authProvider === "email");
    },

    async changePassword(currentPassword, _newPassword) {
      if (!_isAuthenticated) throw new Error("You must be signed in to change your password.");
      if (_authProvider !== "email") {
        throw new Error("This account signs in with Google or Apple and has no password.");
      }
      if (!currentPassword) throw new Error("Current password is incorrect.");
      return resolve(undefined);
    },

    async requestEmailChange(newEmail) {
      if (!_isAuthenticated) throw new Error("You must be signed in to change your email.");
      if (!newEmail.trim()) throw new Error("Enter a new email address.");
      // Like Supabase, nothing changes until the user confirms from the new inbox.
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

    async countVenuesInArea(lat?, lng?, radiusMeters?, areaName?) {
      const normalizedAreaName = areaName?.trim().toLowerCase();
      if (normalizedAreaName) {
        return resolve(
          venues.filter((venue) => venue.planningArea?.trim().toLowerCase() === normalizedAreaName)
            .length,
        );
      }
      const scopedBuildings =
        typeof lat === "number" && typeof lng === "number"
          ? getNearestBuildings(lat, lng, radiusMeters ? radiusMeters / 1000 : 3, 14)
          : buildings;
      const scopedBuildingIds = new Set(scopedBuildings.map((building) => building.id));
      return resolve(venues.filter((venue) => scopedBuildingIds.has(venue.buildingId)).length);
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
      const dish = dishes.find((d) => d.id === id);
      if (!dish) return resolve(undefined);
      const reviews = dish.reviews.filter((review) => !isMockReviewHiddenForViewer(review));
      // Report-threshold reviews also leave the dish total for everyone, like dish_review_stats.
      const moderationHidden = dish.reviews.filter((review) =>
        _moderationHiddenReviewIds.has(review.id),
      ).length;
      if (reviews.length === dish.reviews.length && moderationHidden === 0) return resolve(dish);
      return resolve({
        ...dish,
        reviews,
        reviewCount: Math.max(0, dish.reviewCount - moderationHidden),
      });
    },

    async listActivePromotionsForTarget(input) {
      // Like list_customer_active_promotions: only outlets shown on Hungry (is_live).
      const promotions = _merchantPromotions.filter(
        (promotion) =>
          getPromotionOutletVenueId(promotion) === input.venueId &&
          _merchantAccount.outlets.find((outlet) => outlet.id === promotion.outletId)?.isLive !==
            false,
      );
      return resolve(clone(filterCustomerVisiblePromotions(promotions, { dishId: input.dishId })));
    },

    async getPublicMerchantProfile(venueId) {
      const outlet = _merchantAccount.outlets.find(
        (item) =>
          item.isLive &&
          (getMockMerchantVenueId(item.id) === venueId ||
            item.signatureDishIds.some(
              (dishId) => dishes.find((dish) => dish.id === dishId)?.venueId === venueId,
            )),
      );
      if (!outlet) return resolve(undefined);
      const isVerified = outlet.verification?.status === "verified";
      return resolve({
        outletId: outlet.id,
        description: outlet.description || undefined,
        contactPhone: outlet.contactPhone,
        contactEmail: outlet.contactEmail,
        socialLinks: clone(outlet.socialLinks),
        cuisineCategories: [...outlet.cuisineCategories],
        profilePhotoUrl: isVerified ? outlet.profilePhotoUrl : undefined,
        coverPhotoUrl: isVerified ? outlet.coverPhotoUrl : undefined,
        temporaryClosure: outlet.temporaryClosure,
        isVerified,
      } satisfies PublicMerchantProfile);
    },

    async getVenueOpeningSchedule(venueId) {
      const schedule = venues.find((venue) => venue.id === venueId)?.openingSchedule;
      return resolve(schedule ? clone(schedule) : undefined);
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

    async recordMerchantActionEvent(input) {
      const outlet = getOutletForMerchantAction(input);
      if (!outlet) return resolve(undefined);
      _merchantActionEvents.push({
        ...input,
        outletId: outlet.id,
        sessionId:
          input.sessionId ??
          input.userId ??
          (_isAuthenticated ? _profile.id : "mock-guest-session"),
        occurredAt: new Date().toISOString(),
      });
      return resolve(undefined);
    },

    async listDishesByVenue(venueId) {
      return resolve(dishes.filter((d) => d.venueId === venueId));
    },

    async listPopularNearby(_lat?, _lng?) {
      return resolve([...dishes].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 6));
    },

    async listDiscoveryFeedByLocation(request) {
      const nearbyVenues = venues.slice(0, request.limit ?? 20);
      return resolve({
        venues: nearbyVenues,
        results: nearbyVenues
          .map((venue) => {
            const dish = dishes.find((item) => item.id === venue.topDishId);
            return dish ? { dish, score: dish.rating / 5 } : undefined;
          })
          .filter((result): result is SearchResult => Boolean(result)),
      });
    },

    async searchVenuesByLocation(request) {
      const query = request.query?.trim().toLowerCase();
      const scopedVenues = query
        ? venues.filter((venue) => venue.name.toLowerCase().includes(query))
        : venues;
      return resolve(scopedVenues.slice(0, request.limit ?? 30));
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
      return resolve(
        (dish?.reviews ?? []).filter((review) => !isMockReviewHiddenForViewer(review)),
      );
    },

    async getUserReviews(_userId, _page) {
      // Another user's profile: only reviews written by that account, like the Supabase read.
      if (_userId !== _profile.id) {
        return resolve(
          dishes
            .flatMap((dish) => dish.reviews ?? [])
            .filter(
              (review) => review.authorId === _userId && !isMockReviewHiddenForViewer(review),
            ),
        );
      }
      // Mock: return the demo user's reviews (keyed by reviewedDishIds)
      const reviewedDishes = _profile.reviewedDishIds
        .map((id) => dishes.find((d) => d.id === id))
        .filter(Boolean);
      const reviews = reviewedDishes
        .flatMap((d) => (d?.reviews ?? []).slice(0, 1))
        .filter((review) => !isMockReviewHiddenForViewer(review));
      return resolve(reviews);
    },

    async submitReview(draft: SubmitReviewInput) {
      // Mock: a retried submission with the same client id is a no-op, like the Supabase resume.
      if (draft.clientReviewId) {
        if (_submittedClientReviewIds.has(draft.clientReviewId)) return resolve(undefined);
        _submittedClientReviewIds.add(draft.clientReviewId);
      }
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

    async listRecentReviews(options) {
      const limit = Math.min(Math.max(Math.floor(options?.limit ?? 50), 1), 100);
      const before = options?.before ? new Date(options.before).getTime() : undefined;
      const dishIdFilter = options?.dishIds ? new Set(options.dishIds) : undefined;
      const entries = dishes
        .filter((dish) => !dishIdFilter || dishIdFilter.has(dish.id))
        .flatMap((dish): RecentReviewFeedEntry[] =>
          dish.reviews
            .filter((review) => !isMockReviewHiddenForViewer(review))
            .map((review) => ({
              review: {
                ...review,
                helpfulCount:
                  (review.helpfulCount ?? 0) + (_helpfulReviewIds.has(review.id) ? 1 : 0),
                viewerFoundHelpful: _helpfulReviewIds.has(review.id),
              },
              dishId: dish.id,
              dishName: dish.name,
              venueId: dish.venueId,
              venueName: dish.venueName,
            })),
        )
        .filter((entry) => {
          if (before === undefined) return true;
          const createdAt = new Date(entry.review.createdAt).getTime();
          if (createdAt < before) return true;
          return Boolean(
            options?.beforeId && createdAt === before && entry.review.id < options.beforeId,
          );
        })
        .sort(
          (a, b) =>
            new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime() ||
            (b.review.id < a.review.id ? -1 : b.review.id > a.review.id ? 1 : 0),
        );
      return resolve(entries.slice(0, limit));
    },

    async setReviewHelpful(reviewId, helpful) {
      if (helpful) _helpfulReviewIds.add(reviewId);
      else _helpfulReviewIds.delete(reviewId);
      return resolve(undefined);
    },

    async updateReview(reviewId, patch) {
      const dish = findMockOwnReviewDish(reviewId, "edit");
      const normalized = normalizeReviewPatch(patch);
      dish.reviews = dish.reviews.map((review) =>
        review.id === reviewId ? { ...review, ...normalized } : review,
      );
      return resolve(undefined);
    },

    async deleteReview(reviewId) {
      const dish = findMockOwnReviewDish(reviewId, "delete");
      dish.reviews = dish.reviews.filter((review) => review.id !== reviewId);
      _helpfulReviewIds.delete(reviewId);
      return resolve(undefined);
    },
  },

  // ── Profile ─────────────────────────────────────────────────────────────────

  profile: {
    async getProfile() {
      return resolve({ ..._profile });
    },

    async updateProfile(updates) {
      // The sign-in email changes only through auth.requestEmailChange.
      const { email: _ignoredEmail, ...profileUpdates } = updates;
      // Mirrors the user_profiles_bio_length check constraint.
      if (profileUpdates.bio !== undefined) {
        const bio = profileUpdates.bio.trim();
        if (bio.length > PROFILE_BIO_MAX_LENGTH) {
          throw new Error(`Bio must be ${PROFILE_BIO_MAX_LENGTH} characters or fewer.`);
        }
        profileUpdates.bio = bio || undefined;
      }
      _profile = { ..._profile, ...profileUpdates } as UserProfile;
      return resolve({ ..._profile });
    },

    async getPublicProfile(userId: string) {
      if (userId === _profile.id) {
        return resolve({
          id: _profile.id,
          displayName: _profile.displayName,
          avatarUrl: _profile.avatarUrl,
          bio: _profile.bio,
        });
      }
      const person = findMockPerson(userId);
      return resolve({ id: userId, ...person });
    },

    async updateDietaryPreferences(flags: DietaryFlag[]) {
      _profile = { ..._profile, dietaryPreferences: flags };
      return resolve(undefined);
    },

    async exportMyData() {
      const userId = _profile.id;
      const loadAllFollowRows = async <T>(
        loadPage: (page: { limit: number; offset: number }) => Promise<T[]>,
      ) => {
        const rows: T[] = [];
        for (;;) {
          const page = await loadPage({ limit: 500, offset: rows.length });
          rows.push(...page);
          if (page.length < 500) return rows;
        }
      };
      const [reviews, posts, savedPosts, followers, following] = await Promise.all([
        hungryService.reviews.getUserReviews(userId),
        hungryService.social.listUserPosts(userId),
        hungryService.social.getSavedBites(),
        loadAllFollowRows((page) => hungryService.social.listFollowers(userId, page)),
        loadAllFollowRows((page) => hungryService.social.listFollowing(userId, page)),
      ]);
      const data: Record<string, unknown> = {
        profile: clone(_profile),
        reviews,
        posts,
        favouriteDishIds: [..._profile.favouriteDishIds],
        savedPosts,
        followers,
        following,
      };
      return resolve({
        exportVersion: 2,
        generatedAt: new Date().toISOString(),
        categories: Object.keys(data),
        notIncluded: ["Mock data source: only in-memory demo data is included."],
        data,
      });
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

    async setDishTried(dishId, tried) {
      // Mirrors set_dish_tried: a dish the user reviewed stays in the Tried list.
      const hasReview = dishes.some(
        (dish) =>
          dish.id === dishId && dish.reviews.some((review) => review.authorId === _profile.id),
      );
      const keep = tried || hasReview;
      const current = _profile.reviewedDishIds;
      const reviewedDishIds = keep
        ? current.includes(dishId)
          ? current
          : [...current, dishId]
        : current.filter((id) => id !== dishId);
      _profile = { ..._profile, reviewedDishIds };
      return resolve([...reviewedDishIds]);
    },

    async setStallFollow(stallId, following) {
      if (following) _followedStallIds.add(stallId);
      else _followedStallIds.delete(stallId);
      return resolve(undefined);
    },

    async getFollowedStallIds() {
      return resolve([..._followedStallIds]);
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

    async recordQuizResponse() {
      return resolve(undefined);
    },
  },

  // ── Push notifications ──────────────────────────────────────────────────────

  push: {
    async getPreferences() {
      return resolve({ ..._pushPreferences });
    },

    async updatePreferences(updates) {
      _pushPreferences = { ..._pushPreferences, ...updates };
      return resolve({ ..._pushPreferences });
    },

    async registerPushToken() {
      return resolve(undefined);
    },

    async unregisterPushToken() {
      return resolve(undefined);
    },

    async markOpened() {
      return resolve(undefined);
    },
  },

  lifecycle: {
    async recordAppOpen(): Promise<LifecycleSnapshot | null> {
      const today = singaporeDateKey();
      const snapshot = buildLifecycleSnapshot([..._activityDates], today);
      _activityDates.add(today);
      return resolve(snapshot);
    },

    async getWelcomeBackDishes(): Promise<WelcomeBackDish[]> {
      // Mock dishes carry no created date, so any dish at a followed stall counts as new.
      return resolve(
        dishes
          .filter((dish) => _followedStallIds.has(dish.venueId))
          .slice(0, 3)
          .map((dish) => ({
            dishId: dish.id,
            dishName: dish.name,
            stallId: dish.venueId,
            stallName: dish.venueName,
          })),
      );
    },
  },

  // ── Social (Bites) ──────────────────────────────────────────────────────────

  social: {
    async getBitesFeed(_lat?, _lng?) {
      await hydrateSocial();
      // Mirrors the Supabase feed read: blocked authors never reach the client,
      // and each row carries the viewer's own like/save state.
      return resolve(
        MOCK_BITES_FEED.filter((bite) => !_blockedUsers.has(bite.authorId)).map(
          withMockViewerReactions,
        ),
      );
    },

    async getPostById(postId: string) {
      await hydrateSocial();
      const bite = MOCK_BITES_FEED.find(
        (candidate) => candidate.id === postId && !_blockedUsers.has(candidate.authorId),
      );
      return resolve(bite ? withMockViewerReactions(bite) : null);
    },

    async updatePost(postId: string, patch: { caption: string }) {
      await hydrateSocial();
      const bite = MOCK_BITES_FEED.find(
        (candidate) => candidate.id === postId && candidate.authorId === _profile.id,
      );
      if (!bite) throw new Error("This post can no longer be edited.");
      bite.caption = sanitizeFreeText(patch.caption, POST_CAPTION_MAX_LENGTH);
    },

    async deletePost(postId: string) {
      await hydrateSocial();
      const index = MOCK_BITES_FEED.findIndex(
        (candidate) => candidate.id === postId && candidate.authorId === _profile.id,
      );
      if (index < 0) throw new Error("This post was already deleted.");
      MOCK_BITES_FEED.splice(index, 1);
      await removePublishedStallPost(postId);
    },

    async listUserPosts(userId: string, page?: { limit?: number; offset?: number }) {
      await hydrateSocial();
      const offset = page?.offset ?? 0;
      return resolve(
        MOCK_BITES_FEED.filter((bite) => bite.authorId === userId).slice(
          offset,
          offset + (page?.limit ?? 60),
        ),
      );
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
        showFoodContextOverlay: draft.showFoodContextOverlay,
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
          showFoodContextOverlay: draft.showFoodContextOverlay,
        }),
      );
      return resolve(newBite);
    },

    async reactToBite(biteId, reaction, active) {
      await hydrateSocial();
      if (!_biteReactions[biteId]) {
        _biteReactions[biteId] = { cravings: new Set(), saves: new Set() };
      }
      const userId = _profile.id;
      const bucket = reaction === "craving" ? "cravings" : "saves";
      const set = _biteReactions[biteId][bucket];
      // Idempotent, like the Supabase upsert/delete.
      if (active) {
        set.add(userId);
      } else {
        set.delete(userId);
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

    async shareBite() {
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

    async shareStory(storyId: string) {
      await hydrateSocial();
      pruneMockStories();
      const story = _mockStories.find((s) => s.id === storyId);
      if (story) {
        story.interaction.shareCount += 1;
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
        authorId: _profile.id,
        authorProfileVisibility: _profile.profileVisibility,
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

    async followUser(userId: string) {
      if (userId === _profile.id) throw new Error("You can't follow yourself.");
      if (!_userFollows.has(userId) && _mockPrivateUserIds.has(userId)) {
        _userFollowRequests.add(userId);
        return resolve("pending" as const);
      }
      _userFollows.add(userId);
      return resolve("approved" as const);
    },

    async unfollowUser(userId: string) {
      _userFollows.delete(userId);
      return resolve(undefined as void);
    },

    async listFollowers(userId: string, page?: { limit?: number; offset?: number }) {
      return resolve(pageMockFollowRows(listMockFollowers(userId), page));
    },

    async listFollowing(userId: string, page?: { limit?: number; offset?: number }) {
      if (userId !== _profile.id) return resolve([]);
      return resolve(
        pageMockFollowRows(
          Array.from(_userFollows).map((id) => ({ userId: id, ...findMockPerson(id) })),
          page,
        ),
      );
    },

    async removeFollower(userId: string) {
      const followersKey = _mockFollowersByUser[_profile.id] ? _profile.id : userProfile.id;
      _mockFollowersByUser[followersKey] = (_mockFollowersByUser[followersKey] ?? []).filter(
        (person) => person.userId !== userId,
      );
      return resolve(undefined as void);
    },

    async searchProfiles(query: string, page?: { limit?: number; offset?: number }) {
      const term = query.trim().toLowerCase();
      if (term.length < 2) return resolve([]);
      const known = [...Object.values(_mockFollowersByUser).flat(), ..._incomingFollowRequests];
      const matches = dedupeMockFollowers(known).filter(
        (person) =>
          person.userId !== _profile.id &&
          !_mockPrivateUserIds.has(person.userId) &&
          !_blockedUsers.has(person.userId) &&
          person.displayName.toLowerCase().includes(term),
      );
      return resolve(pageMockFollowRows(matches, { limit: page?.limit ?? 20, ...page }));
    },

    async canViewFollowLists(_userId: string) {
      return resolve(true);
    },

    async getFollowCounts(userId: string) {
      const isOwnProfile = userId === _profile.id;
      return resolve({
        followersCount: listMockFollowers(userId).length,
        followingCount: isOwnProfile ? _userFollows.size : 0,
      });
    },

    async isFollowing(userId: string) {
      return resolve(_userFollows.has(userId));
    },

    async getFollowStatus(userId: string) {
      const status = _userFollows.has(userId)
        ? "approved"
        : _userFollowRequests.has(userId)
          ? "pending"
          : "none";
      return resolve(status as "approved" | "pending" | "none");
    },

    async cancelFollowRequest(userId: string) {
      _userFollowRequests.delete(userId);
      return resolve(undefined as void);
    },

    async listFollowRequests(page?: { limit?: number; offset?: number }) {
      // Same paging rules as list_incoming_follow_requests (default 50, max 200).
      const limit = Math.min(Math.max(page?.limit ?? 50, 1), 200);
      const offset = Math.max(page?.offset ?? 0, 0);
      return resolve(listMockIncomingFollowRequests().slice(offset, offset + limit));
    },

    async getFollowRequestCount() {
      return resolve(listMockIncomingFollowRequests().length);
    },

    async approveFollowRequest(requesterId: string) {
      const request = _incomingFollowRequests.find((item) => item.userId === requesterId);
      if (!request) throw new Error("Follow request not found.");
      if (_blockedUsers.has(requesterId)) {
        throw new Error("You cannot approve this follow request.");
      }
      _incomingFollowRequests = _incomingFollowRequests.filter(
        (item) => item.userId !== requesterId,
      );
      const followersKey = _mockFollowersByUser[_profile.id] ? _profile.id : userProfile.id;
      _mockFollowersByUser[followersKey] = [
        { userId: request.userId, displayName: request.displayName, avatarUrl: request.avatarUrl },
        ...(_mockFollowersByUser[followersKey] ?? []),
      ];
      return resolve(undefined as void);
    },

    async declineFollowRequest(requesterId: string) {
      if (!_incomingFollowRequests.some((item) => item.userId === requesterId)) {
        throw new Error("Follow request not found.");
      }
      _incomingFollowRequests = _incomingFollowRequests.filter(
        (item) => item.userId !== requesterId,
      );
      return resolve(undefined as void);
    },

    async createComment(postId: string, body: string, parentCommentId?: string) {
      const id = `mock-comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const comment = {
        id,
        userId: _profile.id,
        body,
        createdAt: new Date().toISOString(),
        parentCommentId,
        authorName: _profile.displayName,
        authorAvatarUrl: _profile.avatarUrl,
      };
      if (!_mockComments[postId]) _mockComments[postId] = [];
      _mockComments[postId].push(comment);
      return resolve(comment);
    },

    async deleteComment(commentId: string) {
      for (const postId of Object.keys(_mockComments)) {
        _mockComments[postId] = (_mockComments[postId] ?? []).filter((c) => c.id !== commentId);
      }
      return resolve(undefined as void);
    },

    async listCommentsForPost(postId: string) {
      return resolve(_mockComments[postId] ?? []);
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
      if (request.targetType === "review") recordMockReviewReport(request.targetId);
      return resolve(undefined);
    },

    async blockUser(request) {
      if (!request.blockedUserId.trim()) throw new Error("Blocking requires a valid user id.");
      if (request.blockedUserId === _profile.id) throw new Error("You cannot block yourself.");
      _blockedUsers.set(request.blockedUserId, {
        reason: request.reason,
        createdAt: new Date().toISOString(),
      });
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

    async getBlockedUsers() {
      return resolve(
        Array.from(_blockedUsers.entries()).map(([blockedUserId, entry]) => ({
          blockedUserId,
          reason: entry.reason,
          createdAt: entry.createdAt,
        })),
      );
    },
  },

  // ── User Contributions ─────────────────────────────────────────────────────

  contributions: {
    async submitDiscoveredStall(input) {
      if (!_isAuthenticated) {
        throw new Error("You must be signed in to add a stall.");
      }
      if (!input.stallName.trim()) {
        throw new Error("Stall name is required.");
      }
      if (!input.imageUri.trim()) {
        throw new Error("Stall image is required.");
      }

      const submission = createMockUserStallSubmission(input);
      _userStallSubmissions = [submission, ..._userStallSubmissions];
      return resolve(clone(submission));
    },

    async listMyDiscoveredStalls() {
      if (!_isAuthenticated) return resolve([]);
      return resolve(
        clone(_userStallSubmissions.filter((submission) => submission.userId === _profile.id)),
      );
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
        _popularVisitorPins.filter(
          (pin) =>
            pin.venueId === venueId &&
            pin.isActive &&
            !_moderationHiddenReviewIds.has(pin.reviewId),
        ),
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

    async recordImpression() {
      return resolve(undefined);
    },

    async getFoodHistory() {
      // The mock keeps no server history; the profile store derives it from favourites and reviews.
      return resolve([]);
    },

    async resetFoodHistory() {
      return resolve(undefined);
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

    // Mock and guest mode have no Claude access; search falls back to name matching.
    async parseMoodQuery(_query: string): Promise<MoodSearchIntent | null> {
      return resolve(null);
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
      // Partial update like Supabase: fields left out (undefined) keep their stored value.
      Object.assign(
        outlet,
        Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined)),
      );
      // Mirrors the DB trigger: home-based outlets are never 'exact'.
      if (outlet.businessType === "home_based" && outlet.locationPrivacy === "exact") {
        outlet.locationPrivacy = "approximate";
      }
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

    async toggleSoldOut(outletId, dishId, soldOut) {
      const menu = getMerchantMenu(outletId);
      const dish = menu.find((menuDish) => menuDish.id === dishId);
      if (!dish) throw new Error(`Dish ${dishId} not found for outlet ${outletId}`);
      const isSoldOut = soldOut ?? !dish.availabilityFlags.includes("Sold out");
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

    async acceptOCRDraft(draftId, edits) {
      const draft = _merchantOCRDrafts.find((d) => d.id === draftId);
      if (!draft) throw new Error(`OCR draft ${draftId} not found`);
      const dishId = `dish-from-${draftId}`;
      if (draft.status === "accepted") {
        const existing = getMerchantMenu(draft.outletId).find((dish) => dish.id === dishId);
        if (existing) {
          // Already added (another device or a list tap): apply the editor's changes, not drop them.
          return edits && Object.keys(edits).length > 0
            ? this.editDish(draft.outletId, existing.id, edits)
            : resolve(clone(existing));
        }
      }
      if (draft.status !== "pending")
        throw new Error(`OCR draft ${draftId} is already ${draft.status}`);

      const price = edits?.price ?? draft.price ?? 5;
      const acceptedDish = buildMerchantDish(draft.outletId, {
        name: draft.name,
        price,
        priceRange: `S$${price.toFixed(2)}`,
        imageUrl: draft.sourcePhotoUrl,
        gallery: [draft.sourcePhotoUrl],
        description: draft.suggestedDescription,
        tasteTags: draft.suggestedTasteTags ?? [],
        dietaryFlags: draft.suggestedDietaryTags ?? [],
        ...edits,
        id: dishId,
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
      let interactions = _merchantInbox.filter(
        (interaction) =>
          interaction.outletId === outletId && !isMockInboxReviewModerationHidden(interaction),
      );
      if (filters?.type) {
        interactions = interactions.filter((i) => i.type === filters.type);
      }
      if (filters?.unrepliedOnly) {
        interactions = interactions.filter((i) => !i.reply);
      }
      interactions = [...interactions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      if (filters?.limit !== undefined) {
        interactions = interactions.slice(0, Math.max(1, filters.limit));
      }
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
      const validatedPromo = validateMerchantPromotionInput(promo, {
        outletDishIds: getMerchantPromotionOutletDishIds(outletId),
      });
      const newPromotion: MerchantPromotion = {
        ...validatedPromo,
        id: `promo-new-${++_merchantPromotionCounter}`,
        outletId,
        createdAt: new Date().toISOString(),
        analytics: getPromotionAnalyticsValue({
          ...validatedPromo,
          id: "preview",
          outletId,
          createdAt: "",
        }),
      };
      _merchantPromotions.push(newPromotion);
      return resolve(clone(newPromotion));
    },

    async updatePromotion(promoId, updates) {
      const promoIndex = _merchantPromotions.findIndex((p) => p.id === promoId);
      if (promoIndex === -1) throw new Error(`Promotion ${promoId} not found`);
      const currentPromotion = _merchantPromotions[promoIndex];
      const validatedPromotion = validateMerchantPromotionInput(
        {
          ...currentPromotion,
          ...updates,
          targetDishId: updates.targetDishId ?? currentPromotion.targetDishId,
          promotionItemType: updates.promotionItemType ?? currentPromotion.promotionItemType,
          originalPrice: updates.originalPrice ?? currentPromotion.originalPrice,
          promotionalPrice: updates.promotionalPrice ?? currentPromotion.promotionalPrice,
          finalPrice: updates.finalPrice ?? updates.promotionalPrice ?? currentPromotion.finalPrice,
          discountPercentage: updates.discountPercentage ?? currentPromotion.discountPercentage,
          isAvailable: updates.isAvailable ?? currentPromotion.isAvailable,
        },
        {
          outletDishIds: getMerchantPromotionOutletDishIds(currentPromotion.outletId),
        },
      );
      const updatedPromotion: MerchantPromotion = {
        ..._merchantPromotions[promoIndex],
        ...validatedPromotion,
      };
      updatedPromotion.analytics = getPromotionAnalyticsValue(updatedPromotion);
      _merchantPromotions[promoIndex] = updatedPromotion;
      return resolve(clone(updatedPromotion));
    },

    async deletePromotion(promoId) {
      const promoIndex = _merchantPromotions.findIndex((p) => p.id === promoId);
      if (promoIndex === -1) throw new Error(`Promotion ${promoId} not found`);
      _merchantPromotions.splice(promoIndex, 1);
      return resolve(undefined);
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

    async getDashboardSummary(outletId) {
      getMerchantOutlet(outletId);
      const menu = getMerchantMenu(outletId);
      const reviews = _merchantInbox
        .filter(
          (interaction) =>
            interaction.outletId === outletId &&
            interaction.type === "review" &&
            !isMockInboxReviewModerationHidden(interaction),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latest = reviews[0];
      return resolve({
        menuCount: menu.length,
        dishesWithoutImages: menu.filter(
          (dish) => !dish.imageUrl?.trim() && !(dish.gallery ?? []).some((url) => url.trim()),
        ).length,
        unrepliedReviews: reviews.filter((review) => !review.reply).length,
        latestReview: latest
          ? {
              id: latest.id,
              authorName: latest.authorName,
              rating: latest.rating,
              text: latest.text,
              createdAt: latest.createdAt,
            }
          : undefined,
      });
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
          deepLink: MERCHANT_DEEP_LINKS.analytics,
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
      return resolve(suggestAllergensFromIngredients(ingredients));
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
        deepLink: MERCHANT_DEEP_LINKS.settings,
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

  // ── Checklist ───────────────────────────────────────────────────────────────

  checklist: {
    async createChecklist(name: string) {
      const now = new Date().toISOString();
      const checklist: Checklist = {
        id: `checklist-${++_checklistCounter}`,
        userId: _profile.id,
        name: name.trim() || "Untitled checklist",
        createdAt: now,
        updatedAt: now,
      };
      _checklists = [checklist, ..._checklists];
      return resolve(clone(checklist));
    },

    async getChecklists() {
      return resolve(
        clone(
          _checklists
            .filter((checklist) => checklist.userId === _profile.id)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .map((checklist) => ({
              ...checklist,
              itemCount: _checklistItems.filter((item) => item.checklistId === checklist.id).length,
            })),
        ),
      );
    },

    async getChecklist(id: string) {
      const checklist = _checklists.find(
        (entry) => entry.id === id && entry.userId === _profile.id,
      );
      if (!checklist) {
        throw new Error(`Checklist ${id} not found`);
      }
      return resolve(clone(checklist));
    },

    async updateChecklist(id: string, name: string) {
      const updatedAt = new Date().toISOString();
      let found = false;
      _checklists = _checklists.map((checklist) => {
        if (checklist.id !== id || checklist.userId !== _profile.id) {
          return checklist;
        }
        found = true;
        return {
          ...checklist,
          name: name.trim() || checklist.name,
          updatedAt,
        };
      });
      if (!found) {
        throw new Error(`Checklist ${id} not found`);
      }
      return resolve(undefined);
    },

    async deleteChecklist(id: string) {
      const beforeCount = _checklists.length;
      _checklists = _checklists.filter(
        (checklist) => !(checklist.id === id && checklist.userId === _profile.id),
      );
      if (_checklists.length === beforeCount) {
        throw new Error(`Checklist ${id} not found`);
      }
      _checklistItems = _checklistItems.filter((item) => item.checklistId !== id);
      return resolve(undefined);
    },

    async addChecklistItem(input: ChecklistItemCreateInput) {
      const checklist = _checklists.find(
        (entry) => entry.id === input.checklistId && entry.userId === _profile.id,
      );
      if (!checklist) {
        throw new Error(`Checklist ${input.checklistId} not found`);
      }
      if (input.itemType === "custom" && !input.customText?.trim()) {
        throw new Error("Custom checklist items require text");
      }
      if (
        input.itemType !== "custom" &&
        _checklistItems.some(
          (item) =>
            item.checklistId === input.checklistId &&
            item.itemType === input.itemType &&
            item.dishId === input.dishId &&
            item.stallId === input.stallId,
        )
      ) {
        throw new Error("This item is already in the checklist");
      }
      const now = new Date().toISOString();
      const position =
        Math.max(
          -1,
          ..._checklistItems
            .filter((item) => item.checklistId === input.checklistId)
            .map((item) => item.position),
        ) + 1;
      const item: ChecklistItem = {
        id: `checklist-item-${++_checklistItemCounter}`,
        checklistId: input.checklistId,
        itemType: input.itemType,
        dishId: input.dishId,
        stallId: input.stallId,
        customText: input.customText?.trim(),
        reminderAt: input.reminderAt,
        plannedVisitDate: input.plannedVisitDate,
        triedAt: undefined,
        position,
        createdAt: now,
        updatedAt: now,
      };
      _checklistItems = [..._checklistItems, item];
      _checklists = _checklists.map((entry) =>
        entry.id === checklist.id ? { ...entry, updatedAt: now } : entry,
      );
      return resolve(clone(item));
    },

    async getChecklistItems(checklistId: string) {
      const checklist = _checklists.find(
        (entry) => entry.id === checklistId && entry.userId === _profile.id,
      );
      if (!checklist) {
        throw new Error(`Checklist ${checklistId} not found`);
      }
      return resolve(
        clone(
          _checklistItems
            .filter((item) => item.checklistId === checklistId)
            .sort((left, right) => left.position - right.position),
        ),
      );
    },

    async updateChecklistItem(id: string, updates: Partial<ChecklistItemCreateInput>) {
      const updatedAt = new Date().toISOString();
      let updatedChecklistId: string | undefined;
      _checklistItems = _checklistItems.map((item) => {
        if (item.id !== id) {
          return item;
        }
        const checklist = _checklists.find(
          (entry) => entry.id === item.checklistId && entry.userId === _profile.id,
        );
        if (!checklist) {
          return item;
        }
        updatedChecklistId = item.checklistId;
        return {
          ...item,
          ...updates,
          customText: updates.customText?.trim() ?? item.customText,
          updatedAt,
        };
      });
      if (!updatedChecklistId) {
        throw new Error(`Checklist item ${id} not found`);
      }
      _checklists = _checklists.map((entry) =>
        entry.id === updatedChecklistId ? { ...entry, updatedAt } : entry,
      );
      return resolve(undefined);
    },

    async markChecklistItemTried(id: string) {
      const triedAt = new Date().toISOString();
      let updatedChecklistId: string | undefined;
      _checklistItems = _checklistItems.map((item) => {
        if (item.id !== id) {
          return item;
        }
        const checklist = _checklists.find(
          (entry) => entry.id === item.checklistId && entry.userId === _profile.id,
        );
        if (!checklist) {
          return item;
        }
        updatedChecklistId = item.checklistId;
        return { ...item, triedAt, updatedAt: triedAt };
      });
      if (!updatedChecklistId) {
        throw new Error(`Checklist item ${id} not found`);
      }
      _checklists = _checklists.map((entry) =>
        entry.id === updatedChecklistId ? { ...entry, updatedAt: triedAt } : entry,
      );
      return resolve(undefined);
    },

    async deleteChecklistItem(id: string) {
      const item = _checklistItems.find((entry) => entry.id === id);
      if (!item) {
        throw new Error(`Checklist item ${id} not found`);
      }
      const checklist = _checklists.find(
        (entry) => entry.id === item.checklistId && entry.userId === _profile.id,
      );
      if (!checklist) {
        throw new Error(`Checklist item ${id} not found`);
      }
      _checklistItems = _checklistItems.filter((entry) => entry.id !== id);
      const remainingItems = _checklistItems
        .filter((entry) => entry.checklistId === item.checklistId)
        .sort((left, right) => left.position - right.position)
        .map((entry, position) => ({ ...entry, position }));
      _checklistItems = [
        ..._checklistItems.filter((entry) => entry.checklistId !== item.checklistId),
        ...remainingItems,
      ];
      _checklists = _checklists.map((entry) =>
        entry.id === item.checklistId ? { ...entry, updatedAt: new Date().toISOString() } : entry,
      );
      return resolve(undefined);
    },

    async reorderChecklistItems(checklistId: string, itemIds: string[]) {
      const checklist = _checklists.find(
        (entry) => entry.id === checklistId && entry.userId === _profile.id,
      );
      if (!checklist) {
        throw new Error(`Checklist ${checklistId} not found`);
      }
      const currentItems = _checklistItems.filter((item) => item.checklistId === checklistId);
      const itemById = new Map(currentItems.map((item) => [item.id, item]));
      const requestedIds = new Set(itemIds);
      if (
        requestedIds.size !== itemIds.length ||
        requestedIds.size !== currentItems.length ||
        itemIds.some((id) => !itemById.has(id))
      ) {
        throw new Error("Checklist reorder requires every current item exactly once");
      }
      const orderedItems = itemIds
        .map((id) => itemById.get(id))
        .filter((item): item is ChecklistItem => Boolean(item));
      const updatedAt = new Date().toISOString();
      const nextItems = orderedItems.map((item, position) => ({
        ...item,
        position,
        updatedAt,
      }));
      _checklistItems = [
        ..._checklistItems.filter((item) => item.checklistId !== checklistId),
        ...nextItems,
      ];
      _checklists = _checklists.map((entry) =>
        entry.id === checklistId ? { ...entry, updatedAt } : entry,
      );
      return resolve(undefined);
    },
  },

  // ── Portfolio ───────────────────────────────────────────────────────────────

  portfolio: {
    async createPortfolio(input: PortfolioCreateInput) {
      const now = new Date().toISOString();
      const portfolio: Portfolio = {
        id: `portfolio-${++_portfolioCounter}`,
        ownerId: _profile.id,
        name: input.name.trim() || "Untitled portfolio",
        description: input.description?.trim(),
        type: input.type,
        visibility: input.visibility,
        publishedAt: undefined,
        createdAt: now,
        updatedAt: now,
      };
      _portfolios = [portfolio, ..._portfolios];
      return resolve(clone(portfolio));
    },

    async getPortfolios(filters?: {
      userId?: string;
      visibility?: string;
      type?: string;
      ids?: string[];
    }) {
      const visiblePortfolios = _portfolios.filter((portfolio) => {
        if (filters?.userId && portfolio.ownerId !== filters.userId) return false;
        if (filters?.visibility && portfolio.visibility !== filters.visibility) return false;
        if (filters?.type && portfolio.type !== filters.type) return false;
        if (filters?.ids && !filters.ids.includes(portfolio.id)) return false;
        return canViewMockPortfolio(portfolio);
      });
      return resolve(
        clone(
          visiblePortfolios
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .map((portfolio) => ({
              ...portfolio,
              itemCount: _portfolioItems.filter((item) => item.portfolioId === portfolio.id).length,
            })),
        ),
      );
    },

    async getPortfolio(id: string) {
      const portfolio = _portfolios.find((entry) => entry.id === id);
      if (!portfolio) {
        throw new Error(`Portfolio ${id} not found`);
      }
      if (!canViewMockPortfolio(portfolio)) {
        throw new Error(`Portfolio ${id} not found`);
      }
      return resolve(clone(portfolio));
    },

    async getPublicPortfolio(id: string) {
      const portfolio = _portfolios.find((entry) => entry.id === id);
      if (!portfolio || portfolio.visibility !== "public") return resolve(null);
      const items = _portfolioItems
        .filter((item) => item.portfolioId === id)
        .sort((left, right) => left.position - right.position)
        .map((item) => {
          const dish = item.dishId ? mockRepository.getDishById(item.dishId) : undefined;
          const venue = mockRepository.getVenueById(item.stallId ?? dish?.venueId ?? "");
          return {
            itemType: item.itemType,
            dishId: item.dishId,
            stallId: item.stallId ?? dish?.venueId,
            name: dish?.name ?? venue?.name ?? "Untitled",
            stallName: venue?.name,
            price: dish?.price,
            publicNotes: item.publicNotes,
            imageUrl: dish?.imageUrl || undefined,
          };
        });
      return resolve({
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        updatedAt: portfolio.updatedAt,
        items,
      });
    },

    async updatePortfolio(
      id: string,
      updates: Partial<PortfolioCreateInput>,
      options?: PortfolioMutationOptions,
    ) {
      assertMockPortfolioVersion(id, options);
      if (
        _moderationRemovedPortfolioIds.has(id) &&
        updates.visibility &&
        updates.visibility !== "private"
      ) {
        throw new Error(MODERATION_REMOVED_LIST_MESSAGE);
      }
      const updatedAt = new Date().toISOString();
      let found = false;
      _portfolios = _portfolios.map((portfolio) => {
        if (portfolio.id !== id || portfolio.ownerId !== _profile.id) {
          return portfolio;
        }
        found = true;
        return {
          ...portfolio,
          ...updates,
          name: updates.name?.trim() ?? portfolio.name,
          description: updates.description?.trim() ?? portfolio.description,
          updatedAt,
        };
      });
      if (!found) {
        throw new Error(`Portfolio ${id} not found`);
      }
      return resolve(undefined);
    },

    async deletePortfolio(id: string, options?: PortfolioMutationOptions) {
      assertMockPortfolioVersion(id, options);
      const beforeCount = _portfolios.length;
      _portfolios = _portfolios.filter(
        (portfolio) => !(portfolio.id === id && portfolio.ownerId === _profile.id),
      );
      if (_portfolios.length === beforeCount) {
        throw new Error(`Portfolio ${id} not found`);
      }
      _portfolioItems = _portfolioItems.filter((item) => item.portfolioId !== id);
      _portfolioCollaborators = _portfolioCollaborators.filter(
        (collaborator) => collaborator.portfolioId !== id,
      );
      _portfolioFollows = _portfolioFollows.filter((follow) => follow.portfolioId !== id);
      return resolve(undefined);
    },

    async publishPortfolio(id: string, options?: PortfolioMutationOptions) {
      assertMockPortfolioVersion(id, options);
      if (_moderationRemovedPortfolioIds.has(id)) {
        throw new Error(MODERATION_REMOVED_LIST_MESSAGE);
      }
      const publishedAt = new Date().toISOString();
      let found = false;
      let shouldRecordPublish = false;
      let publishedPortfolioType: Portfolio["type"] | undefined;
      _portfolios = _portfolios.map((portfolio) => {
        if (portfolio.id !== id || portfolio.ownerId !== _profile.id) {
          return portfolio;
        }
        found = true;
        shouldRecordPublish = !portfolio.publishedAt;
        publishedPortfolioType = portfolio.type;
        return {
          ...portfolio,
          publishedAt,
          visibility: "public",
          updatedAt: publishedAt,
        };
      });
      if (!found) {
        throw new Error(`Portfolio ${id} not found`);
      }
      if (shouldRecordPublish) {
        recordMockPassportProgress("public_portfolio_published", id);
        if (publishedPortfolioType === "trail") {
          recordMockPassportProgress("trail_completed", id);
        }
      }
      return resolve(undefined);
    },

    async addPortfolioItem(input: PortfolioItemCreateInput, options?: PortfolioMutationOptions) {
      assertMockPortfolioVersion(input.portfolioId, options);
      if (!canEditMockPortfolio(input.portfolioId)) {
        throw new Error(`Portfolio ${input.portfolioId} not found`);
      }
      const duplicateItem = _portfolioItems.find(
        (item) =>
          item.portfolioId === input.portfolioId &&
          item.itemType === input.itemType &&
          item.dishId === input.dishId &&
          item.stallId === input.stallId,
      );
      if (duplicateItem) {
        throw new Error("This item is already in the portfolio");
      }
      if (typeof input.score === "number" && (input.score < 1 || input.score > 10)) {
        throw new Error("Portfolio item score must be between 1 and 10");
      }
      const now = new Date().toISOString();
      const position =
        Math.max(
          -1,
          ..._portfolioItems
            .filter((item) => item.portfolioId === input.portfolioId)
            .map((item) => item.position),
        ) + 1;
      const item: PortfolioItem = {
        id: `portfolio-item-${++_portfolioItemCounter}`,
        portfolioId: input.portfolioId,
        itemType: input.itemType,
        dishId: input.dishId,
        stallId: input.stallId,
        score: input.score,
        publicNotes: input.publicNotes?.trim(),
        privateNotes: input.privateNotes?.trim(),
        position,
        createdAt: now,
        updatedAt: now,
      };
      _portfolioItems = [..._portfolioItems, item];
      _portfolios = _portfolios.map((entry) =>
        entry.id === input.portfolioId ? { ...entry, updatedAt: now } : entry,
      );
      recordMockPassportProgress("portfolio_item_added", item.id);
      return resolve(clone(item));
    },

    async getPortfolioItems(portfolioId: string) {
      const portfolio = _portfolios.find((entry) => entry.id === portfolioId);
      if (!portfolio || !canViewMockPortfolio(portfolio)) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }
      // Private notes are only for the owner and collaborators, like the Supabase column guard.
      const canReadPrivateNotes =
        portfolio.ownerId === _profile.id ||
        _portfolioCollaborators.some(
          (collaborator) =>
            collaborator.portfolioId === portfolioId && collaborator.userId === _profile.id,
        );
      return resolve(
        clone(
          _portfolioItems
            .filter((item) => item.portfolioId === portfolioId)
            .sort((left, right) => left.position - right.position)
            .map((item) => (canReadPrivateNotes ? item : { ...item, privateNotes: undefined })),
        ),
      );
    },

    async updatePortfolioItem(
      id: string,
      updates: Partial<PortfolioItemCreateInput>,
      options?: PortfolioMutationOptions,
    ) {
      if (options?.portfolioId) {
        assertMockPortfolioVersion(options.portfolioId, options);
      }
      const updatedAt = new Date().toISOString();
      let updatedPortfolioId: string | undefined;
      _portfolioItems = _portfolioItems.map((item) => {
        if (item.id !== id) {
          return item;
        }
        if (!canEditMockPortfolio(item.portfolioId)) {
          return item;
        }
        if (typeof updates.score === "number" && (updates.score < 1 || updates.score > 10)) {
          throw new Error("Portfolio item score must be between 1 and 10");
        }
        updatedPortfolioId = item.portfolioId;
        return {
          ...item,
          ...updates,
          publicNotes: updates.publicNotes?.trim() ?? item.publicNotes,
          privateNotes: updates.privateNotes?.trim() ?? item.privateNotes,
          updatedAt,
        };
      });
      if (!updatedPortfolioId) {
        throw new Error(`Portfolio item ${id} not found`);
      }
      _portfolios = _portfolios.map((entry) =>
        entry.id === updatedPortfolioId ? { ...entry, updatedAt } : entry,
      );
      return resolve(undefined);
    },

    async deletePortfolioItem(id: string, options?: PortfolioMutationOptions) {
      const item = _portfolioItems.find((entry) => entry.id === id);
      if (!item) {
        throw new Error(`Portfolio item ${id} not found`);
      }
      assertMockPortfolioVersion(item.portfolioId, options);
      if (!canEditMockPortfolio(item.portfolioId)) {
        throw new Error(`Portfolio item ${id} not found`);
      }
      _portfolioItems = _portfolioItems.filter((entry) => entry.id !== id);
      const remainingItems = _portfolioItems
        .filter((entry) => entry.portfolioId === item.portfolioId)
        .sort((left, right) => left.position - right.position)
        .map((entry, position) => ({ ...entry, position }));
      _portfolioItems = [
        ..._portfolioItems.filter((entry) => entry.portfolioId !== item.portfolioId),
        ...remainingItems,
      ];
      _portfolios = _portfolios.map((entry) =>
        entry.id === item.portfolioId ? { ...entry, updatedAt: new Date().toISOString() } : entry,
      );
      return resolve(undefined);
    },

    async reorderPortfolioItems(
      portfolioId: string,
      itemIds: string[],
      options?: PortfolioMutationOptions,
    ) {
      assertMockPortfolioVersion(portfolioId, options);
      if (!canEditMockPortfolio(portfolioId)) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }
      const currentItems = _portfolioItems.filter((item) => item.portfolioId === portfolioId);
      const itemById = new Map(currentItems.map((item) => [item.id, item]));
      const requestedIds = new Set(itemIds);
      if (
        requestedIds.size !== itemIds.length ||
        requestedIds.size !== currentItems.length ||
        itemIds.some((id) => !itemById.has(id))
      ) {
        throw new Error("Portfolio reorder requires every current item exactly once");
      }
      const orderedItems = itemIds
        .map((id) => itemById.get(id))
        .filter((item): item is PortfolioItem => Boolean(item));
      const updatedAt = new Date().toISOString();
      const nextItems = orderedItems.map((item, position) => ({
        ...item,
        position,
        updatedAt,
      }));
      _portfolioItems = [
        ..._portfolioItems.filter((item) => item.portfolioId !== portfolioId),
        ...nextItems,
      ];
      _portfolios = _portfolios.map((entry) =>
        entry.id === portfolioId ? { ...entry, updatedAt } : entry,
      );
      return resolve(undefined);
    },

    async addPortfolioCollaborator(
      portfolioId: string,
      userId: string,
      role: "viewer" | "editor",
      options?: PortfolioMutationOptions,
    ) {
      assertMockPortfolioVersion(portfolioId, options);
      const portfolio = _portfolios.find(
        (entry) => entry.id === portfolioId && entry.ownerId === _profile.id,
      );
      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }
      _portfolioCollaborators = _portfolioCollaborators.filter(
        (collaborator) =>
          !(collaborator.portfolioId === portfolioId && collaborator.userId === userId),
      );
      _portfolioCollaborators = [
        ..._portfolioCollaborators,
        {
          id: `portfolio-collaborator-${++_portfolioCollaboratorCounter}`,
          portfolioId,
          userId,
          role,
          createdAt: new Date().toISOString(),
        },
      ];
      return resolve(undefined);
    },

    async getPortfolioCollaborators(portfolioId: string) {
      const portfolio = _portfolios.find((entry) => entry.id === portfolioId);
      if (!portfolio || !canViewMockPortfolio(portfolio)) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }
      const collaborators = _portfolioCollaborators.filter(
        (entry) => entry.portfolioId === portfolioId,
      );
      // Like list_portfolio_collaborators: only the owner and collaborators get rows.
      const isMember =
        portfolio.ownerId === _profile.id ||
        collaborators.some((entry) => entry.userId === _profile.id);
      if (!isMember) return resolve([]);
      // Non-owners don't see collaborators they blocked (mock blocks are one-way).
      const visible =
        portfolio.ownerId === _profile.id
          ? collaborators
          : collaborators.filter((entry) => !_blockedUsers.has(entry.userId));
      return resolve(
        clone(visible.map((entry) => ({ ...entry, ...findMockPerson(entry.userId) }))),
      );
    },

    async removePortfolioCollaborator(
      portfolioId: string,
      userId: string,
      options?: PortfolioMutationOptions,
    ) {
      assertMockPortfolioVersion(portfolioId, options);
      const portfolio = _portfolios.find(
        (entry) => entry.id === portfolioId && entry.ownerId === _profile.id,
      );
      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }
      _portfolioCollaborators = _portfolioCollaborators.filter(
        (entry) => !(entry.portfolioId === portfolioId && entry.userId === userId),
      );
      return resolve(undefined);
    },

    async followPortfolio(portfolioId: string) {
      const portfolio = _portfolios.find((entry) => entry.id === portfolioId);
      if (!portfolio) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }
      if (portfolio.ownerId === _profile.id) {
        return resolve(undefined);
      }
      const existingFollow = _portfolioFollows.find(
        (follow) => follow.portfolioId === portfolioId && follow.userId === _profile.id,
      );
      if (!existingFollow) {
        _portfolioFollows = [
          ..._portfolioFollows,
          {
            id: `portfolio-follow-${++_portfolioFollowCounter}`,
            portfolioId,
            userId: _profile.id,
            createdAt: new Date().toISOString(),
          },
        ];
      }
      return resolve(undefined);
    },

    async unfollowPortfolio(portfolioId: string) {
      _portfolioFollows = _portfolioFollows.filter(
        (follow) => !(follow.portfolioId === portfolioId && follow.userId === _profile.id),
      );
      return resolve(undefined);
    },

    async getPortfolioFollows(portfolioId: string) {
      const portfolio = _portfolios.find((entry) => entry.id === portfolioId);
      if (!portfolio || !canViewMockPortfolio(portfolio)) {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }
      return resolve(clone(_portfolioFollows.filter((entry) => entry.portfolioId === portfolioId)));
    },

    async isFollowingPortfolio(portfolioId: string) {
      return resolve(
        _portfolioFollows.some(
          (follow) => follow.portfolioId === portfolioId && follow.userId === _profile.id,
        ),
      );
    },

    async getFollowedPortfolioIds() {
      return resolve(
        _portfolioFollows
          .filter((follow) => follow.userId === _profile.id)
          .map((follow) => follow.portfolioId),
      );
    },

    async getSharedPortfolioIds(options?: { role?: "viewer" | "editor" }) {
      return resolve(
        _portfolioCollaborators
          .filter(
            (collaborator) =>
              collaborator.userId === _profile.id &&
              (!options?.role || collaborator.role === options.role),
          )
          .map((collaborator) => collaborator.portfolioId),
      );
    },

    async flagPortfolio(portfolioId: string, reason: string, details?: string) {
      const portfolio = _portfolios.find((entry) => entry.id === portfolioId);
      if (!portfolio || portfolio.visibility !== "public") {
        throw new Error(`Portfolio ${portfolioId} not found`);
      }
      const normalizedReason = (
        ["spam", "inappropriate", "misleading"].includes(reason) ? reason : "other"
      ) as PortfolioFlagReason;
      const existingFlag = _portfolioFlags.find(
        (flag) => flag.portfolioId === portfolioId && flag.reporterId === _profile.id,
      );
      if (existingFlag) {
        return resolve(undefined);
      }
      _portfolioFlags = [
        ..._portfolioFlags,
        {
          id: `portfolio-flag-${++_portfolioFlagCounter}`,
          portfolioId,
          reporterId: _profile.id,
          reason: normalizedReason,
          details: details?.trim(),
          status: "pending",
          createdAt: new Date().toISOString(),
        },
      ];
      return resolve(undefined);
    },

    async getPortfolioFlags(filters?: { status?: string }) {
      return resolve(
        clone(
          _portfolioFlags.filter((flag) => {
            if (!filters?.status) return true;
            return flag.status === filters.status;
          }),
        ),
      );
    },

    async resolvePortfolioFlag(flagId: string, resolution: "dismissed" | "removed") {
      const reviewedAt = new Date().toISOString();
      let found = false;
      _portfolioFlags = _portfolioFlags.map((flag) => {
        if (flag.id !== flagId) {
          return flag;
        }
        found = true;
        return {
          ...flag,
          status: resolution,
          reviewedAt,
          reviewedBy: _profile.id,
        };
      });
      if (!found) {
        throw new Error(`Portfolio flag ${flagId} not found`);
      }
      if (resolution === "removed") {
        // Like resolve_portfolio_flag: the list is taken down, not just the flag closed.
        const flaggedPortfolioId = _portfolioFlags.find((flag) => flag.id === flagId)?.portfolioId;
        if (flaggedPortfolioId) _moderationRemovedPortfolioIds.add(flaggedPortfolioId);
        _portfolios = _portfolios.map((portfolio) =>
          portfolio.id === flaggedPortfolioId
            ? { ...portfolio, visibility: "private", publishedAt: undefined, updatedAt: reviewedAt }
            : portfolio,
        );
        _portfolioFlags = _portfolioFlags.map((flag) =>
          flag.portfolioId === flaggedPortfolioId && flag.status === "pending"
            ? { ...flag, status: "removed", reviewedAt, reviewedBy: _profile.id }
            : flag,
        );
      }
      return resolve(undefined);
    },

    async searchPortfolios(query: string, filters?: { type?: string; visibility?: string }) {
      const normalizedQuery = query.trim().toLowerCase();
      const results = _portfolios.filter((portfolio) => {
        if (portfolio.visibility !== "public" && portfolio.ownerId !== _profile.id) return false;
        if (filters?.type && portfolio.type !== filters.type) return false;
        if (filters?.visibility && portfolio.visibility !== filters.visibility) return false;
        if (!normalizedQuery) return true;
        return `${portfolio.name} ${portfolio.description ?? ""} ${portfolio.type}`
          .toLowerCase()
          .includes(normalizedQuery);
      });
      return resolve(
        clone(results.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))),
      );
    },
  },

  // ── Passport ────────────────────────────────────────────────────────────────

  passport: {
    async getPassportStamps() {
      return resolve(clone(_passportStamps.filter((stamp) => stamp.userId === _profile.id)));
    },

    async getPassportProgressEvents(categoryId?: string) {
      const events = _passportEvents.filter(
        (event) => event.userId === _profile.id && (!categoryId || event.categoryId === categoryId),
      );
      return resolve(clone(events));
    },

    async recordProgress(categoryId, eventType, referenceId) {
      if (categoryId !== "contributor") {
        return resolve(undefined);
      }
      recordMockPassportProgress(eventType, referenceId);
      return resolve(undefined);
    },
  },

  notifications: {
    async listActivityEvents() {
      return resolve([]);
    },
    async markActivityRead(_eventId: string) {
      return resolve(undefined);
    },
  },
};
