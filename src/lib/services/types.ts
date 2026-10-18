/**
 * Hungry — Universal Service Interface
 *
 * All data access in the app goes through this interface.
 * Swappable between mock (current) and live Supabase (future).
 */

import type {
  AIBusinessInsight,
  BlogPost,
  BuildingSummary,
  Checklist,
  ChecklistItem,
  CollectionItem,
  CustomerInteraction,
  DishDetail,
  DietaryFlag,
  PushPreferences,
  FoodCredAction,
  FoodCollection,
  HawkerTasteTag,
  InteractionType,
  MerchantAccount,
  MerchantAnalytics,
  MerchantNotification,
  MerchantNotificationPreferences,
  MerchantOutlet,
  MerchantPromotion,
  MerchantWeeklySummary,
  MoodSearchIntent,
  MissionType,
  MerchantTeamMember,
  MerchantRole,
  OCRDishDraft,
  PassportProgressEvent,
  PassportStamp,
  PopularVisitorCandidate,
  PopularVisitorPin,
  Portfolio,
  PortfolioCollaborator,
  PortfolioFlag,
  PortfolioFollow,
  PortfolioItem,
  PublicPortfolio,
  PromotionStatus,
  RecommendationSurface,
  SearchFilters,
  StallInteraction,
  StallPost,
  Story,
  StoryContent,
  StoryGalleryAsset,
  SubmitUserStallSubmissionInput,
  TasteProfile,
  TasteInteractionEvent,
  TasteVector,
  UserFoodCred,
  UserMissionProgress,
  UserStallSubmission,
  UserProfile,
  VerificationEvidence,
  VenueSummary,
  WeeklyMission,
} from "@/types/domain";

export interface DecideForMeOptions {
  dietaryFlags?: DietaryFlag[];
  radiusMeters?: number;
  excludeDishIds?: string[];
  neophiliaIndex?: number;
  latitude?: number;
  longitude?: number;
}

// ─── Checklist Input Types ────────────────────────────────────────────────────

export interface ChecklistItemCreateInput {
  checklistId: string;
  itemType: "dish" | "stall" | "custom";
  dishId?: string;
  stallId?: string;
  customText?: string;
  reminderAt?: string;
  plannedVisitDate?: string;
}

// ─── Portfolio Input Types ────────────────────────────────────────────────────

export interface PortfolioCreateInput {
  name: string;
  description?: string;
  type: "recommendation" | "ranking" | "trail" | "collection";
  visibility: "private" | "followers_only" | "public";
}

export interface PortfolioItemCreateInput {
  portfolioId: string;
  itemType: "dish" | "stall";
  dishId?: string;
  stallId?: string;
  score?: number;
  publicNotes?: string;
  privateNotes?: string;
}

export interface PortfolioMutationOptions {
  expectedUpdatedAt?: string;
  portfolioId?: string;
}

export interface DataRepository {
  getProfile(isAuthenticated: boolean, userId?: string | null): UserProfile;
  listBuildings(): BuildingSummary[];
  listVenuesByBuilding(buildingId: string): VenueSummary[];
  getVenueById(venueId: string): VenueSummary | undefined;
  getDishById(dishId: string): DishDetail | undefined;
  listDishesByVenue(venueId: string): DishDetail[];
  listPopularNearby(): DishDetail[];
  searchDishes(filters: SearchFilters, tasteProfile: TasteVector): DishDetail[];
  getDecideForMe(tasteProfile: TasteVector, options?: DecideForMeOptions): DishDetail | undefined;
  listBlogPosts(): BlogPost[];
  listStallPosts(): StallPost[];

  // ─── Gamification (optional — not all implementations required at launch) ────
  listCollections?(): Promise<FoodCollection[]>;
  listFeaturedCollections?(): Promise<FoodCollection[]>;
  getCollectionById?(collectionId: string): Promise<FoodCollection | null>;
  listCollectionItems?(collectionId: string): Promise<CollectionItem[]>;
  getStallInteraction?(userId: string, stallId: string): Promise<StallInteraction | null>;
  listStallInteractions?(userId: string): Promise<StallInteraction[]>;
  getUserFoodCred?(userId: string): Promise<UserFoodCred | null>;
  listActiveMissions?(): Promise<WeeklyMission[]>;
  listUserMissionProgress?(userId: string): Promise<UserMissionProgress[]>;
  awardFoodCred?(
    action: FoodCredAction,
    relatedEntityId?: string,
    relatedEntityType?: "stall" | "review" | "post" | "collection" | "mission",
    points?: number,
  ): Promise<{ totalPoints: number; levelIndex: number; pointsAwarded: number } | null>;
  upsertStallInteraction?(
    userId: string,
    stallId: string,
    patch: Partial<Pick<StallInteraction, "isSaved" | "isTried" | "isReviewed">>,
  ): Promise<StallInteraction | null>;
  incrementMissionProgress?(userId: string, missionType: MissionType): Promise<void>;

  // ─── Checklist Methods ────────────────────────────────────────────────────────
  insertChecklist?(userId: string, name: string): Promise<Checklist>;
  fetchChecklists?(userId: string): Promise<Checklist[]>;
  fetchChecklist?(id: string): Promise<Checklist | null>;
  updateChecklistName?(id: string, name: string): Promise<void>;
  deleteChecklist?(id: string): Promise<void>;

  insertChecklistItem?(item: ChecklistItemCreateInput): Promise<ChecklistItem>;
  fetchChecklistItems?(checklistId: string): Promise<ChecklistItem[]>;
  updateChecklistItem?(id: string, updates: Partial<ChecklistItemCreateInput>): Promise<void>;
  markChecklistItemTried?(id: string): Promise<void>;
  deleteChecklistItem?(id: string): Promise<void>;
  reorderChecklistItems?(checklistId: string, itemIds: string[]): Promise<void>;

  // ─── Portfolio Methods ────────────────────────────────────────────────────────
  insertPortfolio?(userId: string, input: PortfolioCreateInput): Promise<Portfolio>;
  fetchPortfolios?(filters: {
    userId?: string;
    visibility?: string;
    type?: string;
  }): Promise<Portfolio[]>;
  fetchPortfolio?(id: string): Promise<Portfolio | null>;
  updatePortfolio?(id: string, updates: Partial<PortfolioCreateInput>): Promise<void>;
  deletePortfolio?(id: string): Promise<void>;
  publishPortfolio?(id: string): Promise<void>;

  insertPortfolioItem?(item: PortfolioItemCreateInput): Promise<PortfolioItem>;
  fetchPortfolioItems?(portfolioId: string): Promise<PortfolioItem[]>;
  updatePortfolioItem?(id: string, updates: Partial<PortfolioItemCreateInput>): Promise<void>;
  deletePortfolioItem?(id: string): Promise<void>;
  reorderPortfolioItems?(portfolioId: string, itemIds: string[]): Promise<void>;

  insertPortfolioCollaborator?(
    portfolioId: string,
    userId: string,
    role: "viewer" | "editor",
  ): Promise<void>;
  deletePortfolioCollaborator?(portfolioId: string, userId: string): Promise<void>;
  fetchPortfolioCollaborators?(portfolioId: string): Promise<PortfolioCollaborator[]>;

  insertPortfolioFollow?(portfolioId: string, userId: string): Promise<void>;
  deletePortfolioFollow?(portfolioId: string, userId: string): Promise<void>;
  fetchPortfolioFollows?(portfolioId: string): Promise<PortfolioFollow[]>;
  checkPortfolioFollow?(portfolioId: string, userId: string): Promise<boolean>;

  insertPortfolioFlag?(
    portfolioId: string,
    userId: string,
    reason: string,
    details?: string,
  ): Promise<void>;
  fetchPortfolioFlags?(filters?: { status?: string }): Promise<PortfolioFlag[]>;
  updatePortfolioFlagStatus?(flagId: string, status: "dismissed" | "removed"): Promise<void>;

  // ─── Passport Methods ─────────────────────────────────────────────────────────
  fetchPassportStamps?(userId: string): Promise<PassportStamp[]>;
  fetchPassportProgressEvents?(
    userId: string,
    categoryId?: string,
  ): Promise<PassportProgressEvent[]>;
  recordPassportProgress?(
    userId: string,
    categoryId: string,
    eventType: string,
    referenceId?: string,
  ): Promise<void>;

  // ─── Search Methods ───────────────────────────────────────────────────────────
  searchPortfolios?(
    query: string,
    filters?: { type?: string; visibility?: string },
  ): Promise<Portfolio[]>;
}

// ─── Floor Plan Types ──────────────────────────────────────────────────────────

export type StallStatus = "open" | "closed" | "non_food";
export type FloorPolygonKind = "tenant" | "facility" | "corridor";
export type FacilityType = "lift" | "escalator" | "washroom" | "service";

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
  /** Optional semantic kind for richer mall directory rendering */
  kind?: FloorPolygonKind;
  /** Optional facility subtype, used when kind is "facility" */
  facilityType?: FacilityType;
}

export interface FloorPlan {
  buildingId: string;
  floor: string;
  /** Logical canvas dimensions (SVG viewBox) */
  canvasWidth: number;
  canvasHeight: number;
  /** Optional reference floor map image rendered beneath polygons */
  backgroundImage?: {
    uri: string;
    opacity?: number;
  };
  stalls: StallPolygon[];
}

// ─── Canonical Floor Plan Source Types ───────────────────────────────────────

export type FloorPlanSourceType =
  | "imported_svg"
  | "imported_geojson"
  | "cv_extracted"
  | "fallback_demo";

export interface FloorPlanSourceCanvas {
  width: number;
  height: number;
}

export interface FloorPlanSourceOutline {
  polygon: [number, number][];
  label?: string;
}

export interface FloorPlanSourceStall {
  id: string;
  unitNumber: string;
  polygon: [number, number][];
  kind: FloorPolygonKind;
  facilityType?: FacilityType;
  label?: string;
  venueId?: string;
  statusDefault: StallStatus;
}

export interface FloorPlanSourceMeta {
  sourceType: FloorPlanSourceType;
  sourceConfidence: number;
  verified: boolean;
  updatedAt: string;
}

export interface FloorPlanSourceV1 {
  schemaVersion: "floorplan-source.v1";
  buildingId: string;
  floor: string;
  canvas: FloorPlanSourceCanvas;
  buildingOutline: FloorPlanSourceOutline;
  stalls: FloorPlanSourceStall[];
  meta: FloorPlanSourceMeta;
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
  mediaUrls?: string[];
  imageSourceType?:
    | "dish"
    | "dish_image"
    | "venue"
    | "building"
    | "representative_dish"
    | "local_fallback";
  mediaType?: "photo" | "video";
  mediaTypes?: ("photo" | "video")[];
  showFoodContextOverlay?: boolean;
  caption: string;
  tags?: string[];
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
  mediaUrls?: string[];
  mediaType?: "photo" | "video";
  mediaTypes?: ("photo" | "video")[];
  showFoodContextOverlay?: boolean;
  caption: string;
  tags?: string[];
  tasteStamp: TasteStamp;
  rating: number;
  author?: Pick<UserProfile, "id" | "displayName" | "avatarUrl">;
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

// ─── Extended AI Types ────────────────────────────────────────────────────────

export interface ScenarioQuizAnswer {
  scenarioId: string;
  selectedOptionId: string;
}

export interface ExtendedRecommendationContext {
  tasteProfile: TasteProfile;
  dietaryFlags: DietaryFlag[];
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  excludeDishIds?: string[];
}

export interface RankedRecommendation {
  dish: DishDetail;
  matchScore: number;
  matchPercent: number;
  matchReason: string;
  isSerendipitous: boolean;
}

export interface RecommendationSlateRequest {
  surface: RecommendationSurface;
  tasteProfile: TasteVector;
  dietaryFlags?: DietaryFlag[];
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  excludeDishIds?: string[];
  query?: string;
  limit?: number;
  neophiliaIndex?: number;
}

export interface RecommendationSlate {
  surface: RecommendationSurface;
  generatedAt: string;
  items: RankedRecommendation[];
}

export interface ExplicitFeedbackInput {
  dishId?: string;
  feedbackType:
    | "rating"
    | "review"
    | "save"
    | "unsave"
    | "search_query"
    | "dish_result_click"
    | "dish_like"
    | "food_button_click"
    | "dismissed"
    | "hawker_tag";
  surface?: RecommendationSurface;
  query?: string;
  chipId?: string;
  buttonId?: string;
  rating?: number;
  hawkerTags?: HawkerTasteTag[];
  createdAt?: string;
  applied?: boolean;
  reason?: "missing_dish" | "missing_signal" | "capped";
  userVectorBefore?: TasteVector;
  userVectorAfter?: TasteVector;
  metadata?: Record<string, unknown>;
}

export interface RecordRecommendationFeedbackResult {
  tasteVector: TasteVector;
  event?: TasteInteractionEvent;
  applied: boolean;
  reason?: "missing_dish" | "missing_signal" | "capped";
}

export interface ImplicitSignalInput {
  type:
    | "category_click"
    | "dwell_time"
    | "photo_zoom"
    | "ignored_recommendation"
    | "rapid_scroll_past";
  dishId: string;
  timestamp: number;
}

// ─── Search Types ─────────────────────────────────────────────────────────────

export interface SearchResult {
  dish: DishDetail;
  score: number;
}

export interface DiscoveryLocationFeedRequest {
  areaName?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  limit?: number;
}

export interface DiscoveryLocationFeed {
  venues: VenueSummary[];
  results: SearchResult[];
}

export interface VenueLocationSearchRequest extends DiscoveryLocationFeedRequest {
  query?: string;
}

// ─── Session Types ────────────────────────────────────────────────────────────

export interface Session {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  profile: UserProfile;
  /** Resolves after non-critical OAuth profile provisioning and hydration. */
  profileReady?: Promise<UserProfile>;
}

export type AuthProvider = "email" | "google" | "apple";

export interface SubmitReviewInput {
  dishId: string;
  venueId: string;
  rating: number;
  text: string;
  tags: string[];
  photos: string[];
  /** The reviewer's "Recommend" choice. Defaults to true when omitted. */
  wouldRecommend?: boolean;
  /**
   * Client-generated UUID used as the review row id. Retrying with the same id resumes the
   * submission (photo upload) instead of inserting a duplicate review.
   */
  clientReviewId?: string;
  // TODO(api): include upload references (asset ids / signed urls) once media service is wired.
}

export interface RecentReviewFeedEntry {
  review: DishDetail["reviews"][number];
  dishId: string;
  dishName: string;
  venueId: string;
  venueName: string;
}

export interface ListRecentReviewsOptions {
  /** Page size (defaults to 50). */
  limit?: number;
  /** Cursor: only return reviews created strictly before this ISO timestamp. */
  before?: string;
}

export interface SubmitMenuPhotoInput {
  venueId: string;
  photoUri: string;
  photoMimeType?: string;
  photoFileSizeBytes?: number;
  dishId?: string;
  reviewText?: string;
}

export interface AccountDeletionRequest {
  userId?: string;
  reason?: string;
}

/** Account deletion runs after a grace period; until then the owner can cancel. */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

export interface PendingAccountDeletion {
  /** ISO timestamp when the deletion worker may process the request. */
  scheduledFor: string;
}

export type ContentReportTargetType =
  | "review"
  | "bite"
  | "reply"
  | "profile"
  | "post"
  | "post_comment"
  | "story"
  | "message";

export interface ContentReportRequest {
  targetType: ContentReportTargetType;
  targetId: string;
  targetAuthorKey?: string;
  reason: string;
}

export interface BlockUserRequest {
  blockedUserKey: string;
  reason?: string;
}

export interface MenuPhotoSubmissionResult {
  submissionId: string;
  storagePath: string;
}

export interface SubmitMerchantClaimInterestInput {
  venueId: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  uen?: string;
  notes?: string;
}

export interface MerchantClaimSubmissionResult {
  claimId: string | null;
  status: "created" | "already_exists";
}

export interface DraftDishRow {
  id: string;
  venueId: string;
  sourcePhotoId: string | null;
  name: string;
  nameNormalized: string;
  price: number | null;
  currency: string;
  modifiers: string[];
  extractionConfidence: number;
  confidenceBumps: number;
  reviewStatus: "pending" | "accepted" | "edited" | "rejected" | "promoted" | "duplicate";
  duplicateOf: string | null;
  createdAt: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type ChatParticipantKind = "user" | "merchant";
export type ChatConversationType = "user" | "merchant";

export interface ChatParticipant {
  kind: ChatParticipantKind;
  userId?: string;
  merchantAccountId?: string;
  displayName: string;
  avatarUrl?: string;
  isCurrentUser?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  body: string;
  sender: ChatParticipant;
  sentByCurrentUser: boolean;
  clientNonce?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  type: ChatConversationType;
  title: string;
  avatarUrl?: string;
  isOnline?: boolean;
  participants: ChatParticipant[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  updatedAt: string;
}

export interface OpenChatConversationInput {
  target: ChatParticipant;
  type?: ChatConversationType;
}

export interface SendChatMessageInput {
  conversationId: string;
  body: string;
  clientNonce?: string;
  senderMerchantAccountId?: string;
}

export interface ChatSubscriptionHandlers {
  onMessage?: (message: ChatMessage) => void;
  onReadReceipt?: (messageId: string, readAt: string) => void;
  onError?: (error: Error) => void;
}

export interface ChatSubscription {
  unsubscribe(): void;
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
    signUp(email: string, password: string, name: string): Promise<Session | null>;
    resendVerificationEmail(email: string): Promise<void>;
    signIn(email: string, password: string): Promise<Session>;
    signInWithGoogle(): Promise<Session>;
    signInWithApple(): Promise<Session>;
    signOut(): Promise<void>;
    requestAccountDeletion(request?: AccountDeletionRequest): Promise<void>;
    getPendingAccountDeletion(): Promise<PendingAccountDeletion | null>;
    cancelAccountDeletion(): Promise<boolean>;
    forgotPassword(email: string): Promise<void>;
    resetPassword(token: string, password: string): Promise<void>;
    getCurrentSession(): Promise<Session | null>;
    refreshSession(): Promise<Session | null>;
  };

  // Discovery
  discovery: {
    listBuildings(lat?: number, lng?: number, radiusMeters?: number): Promise<BuildingSummary[]>;
    countVenuesInArea(
      lat?: number,
      lng?: number,
      radiusMeters?: number,
      areaName?: string,
    ): Promise<number | undefined>;
    getBuildingDetail(id: string): Promise<BuildingDetail | undefined>;
    getFloorPlan(buildingId: string, floor: string): Promise<FloorPlan | undefined>;
    listFloors(buildingId: string): Promise<string[]>;
    getVenue(id: string): Promise<VenueSummary | undefined>;
    listVenuesByBuilding(buildingId: string): Promise<VenueSummary[]>;
    getDish(id: string): Promise<DishDetail | undefined>;
    listActivePromotionsForTarget(input: {
      venueId: string;
      dishId?: string;
    }): Promise<MerchantPromotion[]>;
    recordDishView(
      dishId: string,
      context?: { sessionId?: string; userId?: string },
    ): Promise<void>;
    recordMerchantActionEvent(input: {
      eventType:
        | "stall_profile_view"
        | "menu_view"
        | "direction_tap"
        | "contact_tap"
        | "social_link_tap"
        | "save"
        | "share"
        | "promotion_impression"
        | "promotion_click"
        | "promotion_save"
        | "promotion_profile_visit"
        | "promotion_dish_view";
      outletId?: string;
      venueId?: string;
      dishId?: string;
      promotionId?: string;
      sessionId?: string;
      userId?: string;
      source?: "customer" | "merchant_preview" | "system";
      metadata?: Record<string, string | number | boolean | null>;
    }): Promise<void>;
    listDishesByVenue(venueId: string): Promise<DishDetail[]>;
    listPopularNearby(lat?: number, lng?: number): Promise<DishDetail[]>;
    listDiscoveryFeedByLocation(
      request: DiscoveryLocationFeedRequest,
    ): Promise<DiscoveryLocationFeed | undefined>;
    searchVenuesByLocation(
      request: VenueLocationSearchRequest,
    ): Promise<VenueSummary[] | undefined>;
    searchDishes(filters: SearchFilters, tasteProfile: TasteVector): Promise<SearchResult[]>;
    decideForMe(
      tasteProfile: TasteVector,
      lat?: number,
      lng?: number,
    ): Promise<DishDetail | undefined>;
  };

  // Reviews
  reviews: {
    getReviewsForDish(dishId: string): Promise<DishDetail["reviews"]>;
    getUserReviews(userId: string): Promise<DishDetail["reviews"]>;
    submitReview(draft: SubmitReviewInput): Promise<void>;
    /** Newest-first review feed across all dishes, fetched as one paginated query. */
    listRecentReviews(options?: ListRecentReviewsOptions): Promise<RecentReviewFeedEntry[]>;
  };

  // Profile
  profile: {
    getProfile(): Promise<UserProfile>;
    updateProfile(updates: Partial<UserProfile>): Promise<UserProfile>;
    updateDietaryPreferences(flags: DietaryFlag[]): Promise<void>;
    getGuestProfile(): Promise<UserProfile>;
    toggleFavourite(dishId: string): Promise<boolean>;
    getFavouriteDishIds(): Promise<string[]>;
    /** Follow or unfollow a stall; followers get opt-in alerts when its menu changes. */
    setStallFollow(stallId: string, following: boolean): Promise<void>;
    getFollowedStallIds(): Promise<string[]>;
    updateTasteVector(vector: TasteVector): Promise<void>;
    updateTasteProfile(profile: TasteProfile): Promise<void>;
    /** Best-effort log of taste quiz answers; skipped for guests. */
    recordQuizResponse(responses: Record<string, unknown>, tasteVector: TasteVector): Promise<void>;
  };

  // Push notifications (opt-in)
  push: {
    getPreferences(): Promise<PushPreferences>;
    updatePreferences(updates: Partial<PushPreferences>): Promise<PushPreferences>;
    registerPushToken(token: string, platform: "ios" | "android"): Promise<void>;
    /** Unbinds this device's registered push token from the signed-in user. Call before sign-out. */
    unregisterPushToken(): Promise<void>;
    markOpened(notificationId: string): Promise<void>;
  };

  // Social (Bites)
  social: {
    getBitesFeed(lat?: number, lng?: number): Promise<Bite[]>;
    listUserPosts(userId: string): Promise<Bite[]>;
    postBite(draft: BiteDraft): Promise<Bite>;
    reactToBite(biteId: string, reaction: "craving" | "save"): Promise<void>;
    shareBite(
      biteId: string,
      options?: {
        channel?: "in_app" | "system_share" | "copy_link";
        targetConversationId?: string;
        targetUserId?: string;
      },
    ): Promise<void>;

    // Stories
    getStories(): Promise<Story[]>;
    listStoryGalleryAssets(): Promise<StoryGalleryAsset[]>;
    likeStory(storyId: string): Promise<void>;
    saveStory(storyId: string): Promise<void>;
    shareStory(storyId: string): Promise<void>;
    addStory(content: StoryContent): Promise<Story>;
    getLikedStories(): Promise<Story[]>;
    getSavedStories(): Promise<Story[]>;
    getSavedBites(): Promise<Bite[]>;
    getLikedBites(): Promise<Bite[]>;

    // Follows
    followUser(userId: string): Promise<void>;
    unfollowUser(userId: string): Promise<void>;
    listFollowers(
      userId: string,
    ): Promise<{ userId: string; displayName: string; avatarUrl?: string }[]>;
    listFollowing(
      userId: string,
    ): Promise<{ userId: string; displayName: string; avatarUrl?: string }[]>;
    isFollowing(userId: string): Promise<boolean>;

    // Comments
    createComment(
      postId: string,
      body: string,
      parentCommentId?: string,
    ): Promise<{
      id: string;
      userId: string;
      body: string;
      createdAt: string;
      parentCommentId?: string;
      authorName?: string;
      authorAvatarUrl?: string;
    }>;
    deleteComment(commentId: string): Promise<void>;
    listCommentsForPost(postId: string): Promise<
      {
        id: string;
        userId: string;
        body: string;
        createdAt: string;
        parentCommentId?: string;
        authorName?: string;
        authorAvatarUrl?: string;
      }[]
    >;
  };

  chat: {
    listConversations(): Promise<ChatConversation[]>;
    openConversation(input: OpenChatConversationInput): Promise<ChatConversation>;
    listMessages(conversationId: string): Promise<ChatMessage[]>;
    sendMessage(input: SendChatMessageInput): Promise<ChatMessage>;
    markConversationRead(conversationId: string): Promise<void>;
    subscribeToConversation(
      conversationId: string,
      handlers: ChatSubscriptionHandlers,
    ): ChatSubscription;
  };

  communitySafety: {
    reportContent(request: ContentReportRequest): Promise<void>;
    blockUser(request: BlockUserRequest): Promise<void>;
    hidePost(postId: string, reason?: string): Promise<void>;
    unhidePost(postId: string): Promise<void>;
    getBlockedUsers(): Promise<{ blockedUserKey: string; reason?: string; createdAt: string }[]>;
  };

  contributions: {
    submitDiscoveredStall(input: SubmitUserStallSubmissionInput): Promise<UserStallSubmission>;
    listMyDiscoveredStalls(): Promise<UserStallSubmission[]>;
  };

  // Content
  content: {
    listArticles(): Promise<BlogPost[]>;
    listStallPosts(): Promise<StallPost[]>;
    listPopularVisitorPinsByVenue(venueId: string): Promise<PopularVisitorPin[]>;
    getArticle(id: string): Promise<BlogPost | undefined>;
  };

  recommendations: {
    getSlate(request: RecommendationSlateRequest): Promise<RecommendationSlate>;
    /** Best-effort log of the dishes a surface showed, for tap-rate measurement; skipped for guests. */
    recordImpression(surface: RecommendationSurface, dishIds: string[]): Promise<void>;
    recordExplicitFeedback(
      feedback: ExplicitFeedbackInput,
    ): Promise<RecordRecommendationFeedbackResult>;
  };

  // AI
  ai: {
    // Legacy (backward-compatible)
    computeTasteVector(answers: QuizAnswer[]): TasteVector;
    getSmartRecommendations(ctx: RecommendationContext): Promise<RecommendationResult[]>;
    adjustCommunityTasteVector(dishId: string, userRating: Partial<TasteVector>): Promise<void>;
    explainMatch(userVector: TasteVector, dishVector: TasteVector): string;

    // Extended — Scenario Quiz
    computeTasteProfile(answers: ScenarioQuizAnswer[]): TasteProfile;

    // Extended — Full Recommendation Pipeline
    getContextualRecommendations(
      ctx: ExtendedRecommendationContext,
    ): Promise<RankedRecommendation[]>;

    // Extended — Feedback Processing
    processExplicitFeedback(feedback: ExplicitFeedbackInput): Promise<TasteVector>;
    processImplicitFeedback(signals: ImplicitSignalInput[]): Promise<TasteVector>;

    // Extended — Community Calibration
    getTagSuggestions(dishId: string): Promise<HawkerTasteTag[]>;
    submitCommunityTags(dishId: string, tags: HawkerTasteTag[]): Promise<void>;

    /** Plain-language search: Claude turns the text into a taste tweak and filters. Null when unavailable. */
    parseMoodQuery(query: string): Promise<MoodSearchIntent | null>;
  };

  // Merchant Centre
  merchant: {
    // Account & Outlets
    getMerchantAccount(): Promise<MerchantAccount | null>;
    getOutlets(): Promise<MerchantOutlet[]>;
    switchOutlet(outletId: string): Promise<MerchantOutlet>;

    // Verification
    getVerificationStatus(outletId: string): Promise<MerchantOutlet["verification"]>;
    submitVerification(
      outletId: string,
      evidence: Omit<VerificationEvidence, "id" | "uploadedAt">,
    ): Promise<void>;
    resubmitVerification(
      outletId: string,
      evidence: Omit<VerificationEvidence, "id" | "uploadedAt">,
    ): Promise<void>;

    // Profile
    updateBusinessProfile(
      outletId: string,
      updates: Partial<MerchantOutlet>,
    ): Promise<MerchantOutlet>;

    // Menu
    getMenu(outletId: string): Promise<DishDetail[]>;
    addDish(outletId: string, dish: Partial<DishDetail>): Promise<DishDetail>;
    editDish(outletId: string, dishId: string, updates: Partial<DishDetail>): Promise<DishDetail>;
    deleteDish(outletId: string, dishId: string): Promise<void>;
    toggleSoldOut(outletId: string, dishId: string): Promise<boolean>;
    toggleFeatured(outletId: string, dishId: string): Promise<boolean>;

    // OCR Drafts
    getOCRDrafts(outletId: string): Promise<OCRDishDraft[]>;
    acceptOCRDraft(draftId: string): Promise<DishDetail>;
    rejectOCRDraft(draftId: string): Promise<void>;

    // Customer Inbox
    getInbox(
      outletId: string,
      filters?: { type?: InteractionType; unrepliedOnly?: boolean },
    ): Promise<CustomerInteraction[]>;
    replyToInteraction(interactionId: string, text: string): Promise<void>;
    reportInteraction(interactionId: string, reason: string): Promise<void>;

    // Featured Visitors
    listPopularVisitorCandidates(outletId: string): Promise<PopularVisitorCandidate[]>;
    listPopularVisitorPins(outletId: string): Promise<PopularVisitorPin[]>;
    pinPopularVisitor(outletId: string, reviewId: string): Promise<PopularVisitorPin>;
    unpinPopularVisitor(pinId: string): Promise<void>;
    reorderPopularVisitorPins(
      outletId: string,
      orderedPinIds: string[],
    ): Promise<PopularVisitorPin[]>;

    // Promotions
    getPromotions(outletId: string, status?: PromotionStatus): Promise<MerchantPromotion[]>;
    createPromotion(
      outletId: string,
      promo: Omit<MerchantPromotion, "id" | "outletId" | "createdAt" | "analytics">,
    ): Promise<MerchantPromotion>;
    updatePromotion(
      promoId: string,
      updates: Partial<MerchantPromotion>,
    ): Promise<MerchantPromotion>;
    getPromotionAnalytics(promoId: string): Promise<NonNullable<MerchantPromotion["analytics"]>>;

    // Analytics
    getAnalytics(outletId: string, dateRange: "today" | "7d" | "30d"): Promise<MerchantAnalytics>;
    getWeeklySummaryStats(outletId: string): Promise<MerchantWeeklySummary>;
    getMerchantNotifications(merchantAccountId: string): Promise<MerchantNotification[]>;
    syncLowRatingNotifications(outletId: string): Promise<MerchantNotification[]>;
    sendWeeklySummaryNotifications(outletId: string): Promise<MerchantNotification[]>;

    // AI Tools
    generateDishDescription(dishName: string, ingredients?: string[]): Promise<string>;
    suggestIngredients(dishName: string): Promise<string[]>;
    suggestAllergens(ingredients: string[]): Promise<string[]>;
    suggestTags(dishName: string, description?: string): Promise<string[]>;
    generateAIReply(interactionId: string): Promise<string>;
    getAIInsights(outletId: string): Promise<AIBusinessInsight[]>;
    getWeeklySummary(outletId: string): Promise<AIBusinessInsight>;
    getProfileSuggestions(outletId: string): Promise<AIBusinessInsight[]>;
    getMenuCleanupSuggestions(outletId: string): Promise<AIBusinessInsight[]>;
    getDemandInsights(outletId: string): Promise<AIBusinessInsight[]>;

    // Team Management
    getTeamMembers(merchantAccountId: string): Promise<MerchantTeamMember[]>;
    addTeamMember(
      merchantAccountId: string,
      email: string,
      role: MerchantRole,
      displayName?: string,
    ): Promise<MerchantTeamMember>;
    removeTeamMember(memberId: string): Promise<void>;
    updateTeamMemberRole(memberId: string, role: MerchantRole): Promise<void>;

    // Notification Preferences
    getNotificationPreferences(merchantAccountId: string): Promise<MerchantNotificationPreferences>;
    updateNotificationPreferences(
      merchantAccountId: string,
      prefs: Partial<MerchantNotificationPreferences>,
    ): Promise<void>;
  };

  // Supply priming (developer/ops-only)
  supply: {
    submitMenuPhoto(input: SubmitMenuPhotoInput): Promise<MenuPhotoSubmissionResult>;
    submitMerchantClaimInterest(
      input: SubmitMerchantClaimInterestInput,
    ): Promise<MerchantClaimSubmissionResult>;
    listDraftDishesQueue(venueId?: string): Promise<DraftDishRow[]>;
    reviewDraftDish(
      draftDishId: string,
      decision: "accepted" | "rejected" | "duplicate",
      notes?: string,
    ): Promise<void>;
  };

  // Checklist
  checklist: {
    createChecklist(name: string): Promise<Checklist>;
    getChecklists(): Promise<Checklist[]>;
    getChecklist(id: string): Promise<Checklist>;
    updateChecklist(id: string, name: string): Promise<void>;
    deleteChecklist(id: string): Promise<void>;

    addChecklistItem(input: ChecklistItemCreateInput): Promise<ChecklistItem>;
    getChecklistItems(checklistId: string): Promise<ChecklistItem[]>;
    updateChecklistItem(id: string, updates: Partial<ChecklistItemCreateInput>): Promise<void>;
    markChecklistItemTried(id: string): Promise<void>;
    deleteChecklistItem(id: string): Promise<void>;
    reorderChecklistItems(checklistId: string, itemIds: string[]): Promise<void>;
  };

  // Portfolio
  portfolio: {
    createPortfolio(input: PortfolioCreateInput): Promise<Portfolio>;
    getPortfolios(filters?: {
      userId?: string;
      visibility?: string;
      type?: string;
    }): Promise<Portfolio[]>;
    getPortfolio(id: string): Promise<Portfolio>;
    /** A public list by id for anyone, signed in or not; null when private or missing. */
    getPublicPortfolio(id: string): Promise<PublicPortfolio | null>;
    updatePortfolio(
      id: string,
      updates: Partial<PortfolioCreateInput>,
      options?: PortfolioMutationOptions,
    ): Promise<void>;
    deletePortfolio(id: string, options?: PortfolioMutationOptions): Promise<void>;
    publishPortfolio(id: string, options?: PortfolioMutationOptions): Promise<void>;

    addPortfolioItem(
      input: PortfolioItemCreateInput,
      options?: PortfolioMutationOptions,
    ): Promise<PortfolioItem>;
    getPortfolioItems(portfolioId: string): Promise<PortfolioItem[]>;
    updatePortfolioItem(
      id: string,
      updates: Partial<PortfolioItemCreateInput>,
      options?: PortfolioMutationOptions,
    ): Promise<void>;
    deletePortfolioItem(id: string, options?: PortfolioMutationOptions): Promise<void>;
    reorderPortfolioItems(
      portfolioId: string,
      itemIds: string[],
      options?: PortfolioMutationOptions,
    ): Promise<void>;

    addPortfolioCollaborator(
      portfolioId: string,
      userId: string,
      role: "viewer" | "editor",
      options?: PortfolioMutationOptions,
    ): Promise<void>;
    removePortfolioCollaborator(
      portfolioId: string,
      userId: string,
      options?: PortfolioMutationOptions,
    ): Promise<void>;
    getPortfolioCollaborators(portfolioId: string): Promise<PortfolioCollaborator[]>;

    followPortfolio(portfolioId: string): Promise<void>;
    unfollowPortfolio(portfolioId: string): Promise<void>;
    getPortfolioFollows(portfolioId: string): Promise<PortfolioFollow[]>;
    isFollowingPortfolio(portfolioId: string): Promise<boolean>;

    flagPortfolio(portfolioId: string, reason: string, details?: string): Promise<void>;
    getPortfolioFlags(filters?: { status?: string }): Promise<PortfolioFlag[]>;
    resolvePortfolioFlag(flagId: string, resolution: "dismissed" | "removed"): Promise<void>;

    searchPortfolios(
      query: string,
      filters?: { type?: string; visibility?: string },
    ): Promise<Portfolio[]>;
  };

  // Passport
  passport: {
    getPassportStamps(): Promise<PassportStamp[]>;
    getPassportProgressEvents(categoryId?: string): Promise<PassportProgressEvent[]>;
    recordProgress(
      categoryId: string,
      eventType: PassportProgressEvent["eventType"],
      referenceId?: string,
    ): Promise<void>;
  };

  // Notifications / Activity
  notifications: {
    listActivityEvents(): Promise<
      {
        id: string;
        actorId: string;
        actorName: string;
        actorAvatarUrl?: string;
        eventType: "new_like" | "new_comment" | "new_reply" | "new_follower";
        targetType: "post" | "comment" | "profile";
        targetId: string;
        readAt?: string;
        createdAt: string;
      }[]
    >;
    markActivityRead(eventId: string): Promise<void>;
  };
}
