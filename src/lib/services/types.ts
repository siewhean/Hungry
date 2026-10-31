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
  CustomerInteraction,
  DishDetail,
  DishTasteRatingSummary,
  DietaryFlag,
  PrivacyConsents,
  PushPreferences,
  LifecycleSnapshot,
  WelcomeBackDish,
  FoodCredAction,
  HawkerTasteTag,
  InteractionType,
  MerchantAccount,
  MerchantAnalytics,
  MerchantDailyPoint,
  MerchantDashboardSummary,
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
  PortfolioCollaboratorRole,
  PortfolioFlag,
  PortfolioFollow,
  PortfolioItem,
  PublicPortfolio,
  OpeningSchedule,
  PublicMerchantProfile,
  PublicUserProfile,
  ReviewStats,
  PromotionStatus,
  RecommendationBucket,
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
  UserDishAffinity,
  UserFoodCred,
  UserMissionProgress,
  UserStallSubmission,
  UserProfile,
  VerificationEvidence,
  VenueSummary,
  WeeklyMission,
} from "@/types/domain";

export type VerificationSubmission = Omit<VerificationEvidence, "id" | "uploadedAt"> & {
  additionalFileUrls?: string[];
};

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

/** Name, photo, stall and price of one list item, as get_portfolio_item_details returns it. */
export interface PortfolioItemDetailRow {
  dishId?: string;
  stallId?: string;
  /** Absent when the dish or stall is gone or not visible to this viewer. */
  name?: string;
  stallName?: string;
  price?: number;
  imageUrl?: string;
}

/** One saved dish as the Saved page shows it: the dish, its stall and where the stall is. */
export interface SavedDishCard {
  id: string;
  name: string;
  venueId?: string;
  venueName?: string;
  buildingName?: string;
  unitNumber?: string;
  address?: string;
  postalCode?: string;
  price?: number;
  imageUrl?: string;
  /** The stall's logo, drawn on the placeholder tile while the dish has no photo. */
  logoUrl?: string;
  /** Absent until the dish has a review. */
  rating?: number;
  reviewCount?: number;
  isOpen?: boolean;
  /** The stall's own point, else its building's. */
  latitude?: number;
  longitude?: number;
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
  markChecklistItemTried?(id: string, tried?: boolean): Promise<void>;
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
  /** Server comment and share totals, when the read returns them. */
  commentCount?: number;
  shareCount?: number;
  /** Server distance from the query point, when the read computed one. */
  distanceMeters?: number;
  /** The viewer's own like/save, when the read returns it (undefined = unknown). */
  viewerHasLiked?: boolean;
  viewerHasSaved?: boolean;
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
  /** The poster's own rating; 0 when they gave none (never the dish average). */
  rating: number;
  author?: Pick<UserProfile, "id" | "displayName" | "avatarUrl">;
  /** Client-made post id reused across retries, so a retry resumes the post instead of duplicating it. */
  clientPostId?: string;
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
  /** The mall, hawker centre or food court the viewer is in: its stalls come first. */
  buildingId?: string;
}

export interface DiscoveryLocationFeed {
  venues: VenueSummary[];
  results: SearchResult[];
  /** True when the live read failed and these rows come from the local cache. */
  isFallback?: boolean;
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

/** Fields an author may change on their own review; identity fields stay locked. */
export interface UpdateReviewInput {
  rating?: number;
  text?: string;
  tags?: string[];
  wouldRecommend?: boolean;
}

export interface RecentReviewFeedEntry {
  review: DishDetail["reviews"][number];
  dishId: string;
  dishName: string;
  venueId: string;
  venueName: string;
}

/** Opaque keyset cursor for the next page of a stall's menu. */
export interface VenueMenuCursor {
  score: number | null;
  id: string;
  /** The stall photo, so later pages drop it from dishes that have no photo of their own. */
  venueImageUrl?: string;
}

export interface VenueMenuPage {
  dishes: DishDetail[];
  /** Set while more of the menu may exist. */
  nextCursor?: VenueMenuCursor;
}

/** One page of the review feed, with the cursor taken from the raw rows read. */
export interface RecentReviewFeedPage {
  entries: RecentReviewFeedEntry[];
  /**
   * More rows exist after this page. Based on the raw row count, so reviews dropped from
   * `entries` (for example a dish the viewer cannot read) never end the feed early.
   */
  hasMore: boolean;
  /** Keyset cursor for the next page: the last raw row read, even when its entry was dropped. */
  nextCursor?: { before: string; beforeId: string };
}

/** Keyset paging for one person's reviews (same cursor as the feed). */

export interface ListRecentReviewsOptions {
  /** Page size (defaults to 50). */
  limit?: number;
  /** Only reviews created at or after this ISO timestamp (what is newer than a loaded page). */
  after?: string;
  /** Cursor: only return reviews created strictly before this ISO timestamp. */
  before?: string;
  /**
   * Keyset tie-breaker for `before`: also return reviews created at exactly
   * `before` whose id sorts below this one, so rows sharing a timestamp are not skipped.
   */
  beforeId?: string;
  /** Only reviews of these dishes (for example one stall's menu). An empty list returns none. */
  dishIds?: string[];
  /** Only reviews written for this stall (read by its indexed venue column, not a long dish-id list). */
  venueId?: string;
  /** Only reviews with at least one photo (the Reviews grid); dish and stall pages leave it off. */
  withPhotos?: boolean;
}

/** Search over every review (not only the loaded page): dish, stall, text or taste tag. */
export interface SearchReviewsOptions {
  query: string;
  /** Page size (defaults to 50). */
  limit?: number;
  /** Keyset cursor from the previous page's `nextCursor`. */
  before?: string;
  beforeId?: string;
  /** Only reviews with a photo (the Reviews grid). Defaults to true. */
  withPhotos?: boolean;
}

export interface SubmitMenuPhotoInput {
  venueId: string;
  photoUri: string;
  photoMimeType?: string;
  photoFileSizeBytes?: number;
  dishId?: string;
  reviewText?: string;
}

export type CatalogCorrectionKind =
  | "closed"
  | "wrong_price"
  | "wrong_hours"
  | "wrong_dish_info"
  | "other";

/** A diner's "Something wrong?" report on a stall or dish, queued for ops. */
export interface SubmitCatalogCorrectionInput {
  venueId: string;
  dishId?: string;
  kind: CatalogCorrectionKind;
  note?: string;
}

/** PDPA access export. `categories` lists every key in `data`; nothing is silently skipped. */
export interface MyDataExport {
  exportVersion: number;
  generatedAt: string;
  categories: string[];
  notIncluded: string[];
  data: Record<string, unknown>;
}

export interface AccountDeletionRequest {
  userId?: string;
  reason?: string;
  /** The code from sendAccountDeletionCode; required with Supabase. */
  code?: string;
}

/**
 * What `auth.signOut` revokes: this device only ("local", the default), every device
 * ("global") or every device except this one ("others").
 */
export type AuthSignOutScope = "local" | "global" | "others";

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

export interface BitesFeedPage {
  /** Rows per page (default 40). */
  limit?: number;
  /** Continue after this post; omit for the newest page. */
  cursor?: { createdAt: string; postId: string };
}

export interface BlockedUserEntry {
  blockedUserId: string;
  displayName?: string;
  avatarUrl?: string;
  reason?: string;
  createdAt: string;
}

export interface HiddenPostEntry {
  postId: string;
  caption?: string;
  authorId?: string;
  authorName?: string;
  dishName?: string;
  venueName?: string;
  hiddenAt: string;
}

export interface BlockUserRequest {
  /** Auth user id (UUID) of the person being blocked. Never a display name. */
  blockedUserId: string;
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

/** Where the signed-in user's claim for a stall stands, in diner-facing terms. */
export type MerchantClaimStatus = "none" | "submitted" | "in_review" | "approved" | "rejected";

/** One of the signed-in user's own stall claims, for the Merchant Centre gate. */
export interface MerchantClaimSummary {
  claimId: string;
  venueId: string;
  venueName: string;
  status: Exclude<MerchantClaimStatus, "none">;
  submittedAt: string;
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
    /** Exchanges the `?code` from the signup confirmation link for a session. */
    confirmEmail(code: string): Promise<Session>;
    /**
     * Verifies the 8-digit code from a sign-up or password-reset email, so a link
     * opened on another device is not needed. Signs the user in.
     */
    verifyEmailCode(
      email: string,
      code: string,
      type: "signup" | "recovery" | "email",
    ): Promise<Session | null>;
    /**
     * Emails an 8-digit sign-in code: no password. An address with no account becomes a new
     * account (named `displayName` when given), so the same call serves sign-in and sign-up and
     * never reveals which one it was. Finish with verifyEmailCode(email, code, "email").
     */
    signInWithEmailCode(email: string, options?: { displayName?: string }): Promise<void>;
    signIn(email: string, password: string): Promise<Session>;
    signInWithGoogle(): Promise<Session>;
    signInWithApple(): Promise<Session>;
    /** Ends this device's session by default; "global" and "others" also revoke other devices. */
    signOut(options?: { scope?: AuthSignOutScope }): Promise<void>;
    /** Why this account cannot be deleted yet ("merchant_owner_must_transfer"), or null. */
    getAccountDeletionBlocker(): Promise<"merchant_owner_must_transfer" | null>;
    /** Emails the signed-in user a one-time code to confirm account deletion. */
    sendAccountDeletionCode(): Promise<void>;
    /** Verifies `request.code`, then queues deletion; resolves with the server's scheduled date. */
    requestAccountDeletion(request?: AccountDeletionRequest): Promise<PendingAccountDeletion>;
    getPendingAccountDeletion(): Promise<PendingAccountDeletion | null>;
    cancelAccountDeletion(): Promise<boolean>;
    /** True while the deletion worker is processing this account's request (too late to keep). */
    isAccountDeletionProcessing(): Promise<boolean>;
    forgotPassword(email: string): Promise<void>;
    /** Exchanges the `?code` from the password-reset link; this signs the user in. */
    exchangeRecoveryCode(token: string): Promise<void>;
    /** Sets a new password for the signed-in recovery session. Safe to retry. */
    updatePassword(password: string): Promise<void>;
    /** True when the signed-in account has an email+password identity (not Google/Apple only). */
    canChangePassword(): Promise<boolean>;
    /** Re-authenticates with the current password, then sets a new one. No recovery code involved. */
    changePassword(currentPassword: string, newPassword: string): Promise<void>;
    /**
     * Starts a sign-in email change. The address only changes after the user confirms the link
     * sent to the new inbox; until then the current email stays in effect.
     */
    requestEmailChange(newEmail: string): Promise<void>;
    /**
     * Stamps the signed-in account as having finished first-run onboarding, so a later
     * sign-in (on another phone, hours after confirming elsewhere) is not taken for a
     * sign-up. Safe to repeat; a no-op once stamped.
     */
    markOnboarded(): Promise<void>;
    /** The new address of an email change still waiting for confirmation, or null. */
    getPendingEmailChange(): Promise<string | null>;
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
    /**
     * Diner taste ratings for a dish, averaged per axis (get_dish_taste_rating_summary). Only
     * axes with 3+ raters are returned; {} while no axis has enough. Throws on a failed read.
     */
    getDishTasteRatingSummary(dishId: string): Promise<DishTasteRatingSummary>;
    /** Name, photo, stall and price for a set of dishes and stalls in one call. */
    getItemDetails(input: {
      dishIds: string[];
      stallIds: string[];
    }): Promise<PortfolioItemDetailRow[]>;
    /**
     * Saved-dish cards for a set of dish ids in a few batched reads, never one per dish. Ids
     * that are gone or not visible are left out. Throws when a read fails.
     */
    getSavedDishCards(dishIds: string[]): Promise<SavedDishCard[]>;
    /** Stall summaries (hours, open flag, building) for a set of ids in one call; no menus. */
    getVenuesByIds(ids: string[]): Promise<VenueSummary[]>;
    listActivePromotionsForTarget(input: {
      venueId: string;
      dishId?: string;
    }): Promise<MerchantPromotion[]>;
    /** Live merchant profile shown on the stall page, if the stall is claimed. */
    getPublicMerchantProfile(venueId: string): Promise<PublicMerchantProfile | undefined>;
    /** Structured weekly + special hours a verified merchant set for this stall, if any. */
    getVenueOpeningSchedule(venueId: string): Promise<OpeningSchedule | undefined>;
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
    /**
     * A stall's menu one page at a time, so the first dishes show at once. With no cursor it
     * returns the page that comes with the venue detail. Throws when a page cannot be read,
     * so a cut-short menu never looks complete. Services without paging leave it out and the
     * caller uses listDishesByVenue.
     */
    listDishesByVenuePage?(venueId: string, cursor?: VenueMenuCursor): Promise<VenueMenuPage>;
    /**
     * `noCatalogFallback` makes a failed server read throw instead of falling back to the cached
     * catalog, whose download is large (onboarding has none cached and shows a Retry instead).
     */
    listPopularNearby(
      lat?: number,
      lng?: number,
      options?: { noCatalogFallback?: boolean },
    ): Promise<DishDetail[]>;
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
    /**
     * One user's reviews for a profile list, newest first, without photos. Paged on the server
     * (default 200).
     */
    getUserReviews(
      userId: string,
      page?: { limit?: number; offset?: number },
    ): Promise<DishDetail["reviews"]>;
    /** Totals and the 1-5 histogram over all of your reviews; undefined on a backend without it. */
    getMyReviewStats(): Promise<ReviewStats | undefined>;
    submitReview(draft: SubmitReviewInput): Promise<void>;
    /** Newest-first review feed across all dishes, fetched as one paginated query. */
    listRecentReviews(options?: ListRecentReviewsOptions): Promise<RecentReviewFeedEntry[]>;
    /** The same feed as listRecentReviews, with paging state that survives dropped rows. */
    listRecentReviewsPage(options?: ListRecentReviewsOptions): Promise<RecentReviewFeedPage>;
    /** The same page shape for a text search over all reviews, newest first. */
    searchReviewsPage(options: SearchReviewsOptions): Promise<RecentReviewFeedPage>;
    /** One review with its dish and stall names (the shared review page); null when not visible. */
    getReviewById(reviewId: string): Promise<RecentReviewFeedEntry | null>;
    /** Marks (helpful=true) or un-marks a review as helpful for the signed-in user. Idempotent. */
    setReviewHelpful(reviewId: string, helpful: boolean): Promise<void>;
    /** Edits the signed-in author's own review. Throws when it is not theirs or the text is refused. */
    updateReview(reviewId: string, patch: UpdateReviewInput): Promise<void>;
    /** Deletes the signed-in author's own review and its photos; it stops counting in the dish rating. */
    deleteReview(reviewId: string): Promise<void>;
  };

  // Profile
  profile: {
    getProfile(): Promise<UserProfile>;
    updateProfile(updates: Partial<UserProfile>): Promise<UserProfile>;
    /** Another user's public profile (name, avatar, bio); undefined when hidden or missing. */
    getPublicProfile(userId: string): Promise<PublicUserProfile | undefined>;
    /**
     * 0-100 taste match with another diner; null when there is none to show (yourself, a blocked
     * or private account, or either of you has no taste fingerprint yet, or an older backend).
     */
    getTasteMatch(userId: string): Promise<number | null>;
    /**
     * The dishes pinned on a profile, in order (at most 4); null on an older backend that has no
     * pins table yet, so callers can tell "none pinned" from "cannot pin".
     */
    listFavouriteDishIds(userId: string): Promise<string[] | null>;
    /** Replaces your pinned dishes (at most 4, each saved or reviewed by you); returns the stored order. */
    setFavouriteDishes(dishIds: string[]): Promise<string[]>;
    /** Every category of the signed-in user's own data. Throws instead of returning partial data. */
    exportMyData(): Promise<MyDataExport>;
    updateDietaryPreferences(flags: DietaryFlag[]): Promise<void>;
    /** Saves the usual max price per dish (SGD); null clears it ("Any price"). */
    updateMaxDishBudget(maxDishBudget: number | null): Promise<void>;
    getGuestProfile(): Promise<UserProfile>;
    /**
     * `expectedUserId` pins the write to the account that initiated it; the
     * implementation must refuse to write if the live session belongs to anyone else.
     */
    toggleFavourite(dishId: string, expectedUserId?: string): Promise<boolean>;
    /** Saves (true) or removes (false) a favourite with one idempotent write; no read first. */
    setFavourite(dishId: string, saved: boolean, expectedUserId?: string): Promise<boolean>;
    /** Saves several favourites with one idempotent multi-row write (a guest's pending saves). */
    addFavourites(dishIds: string[], expectedUserId?: string): Promise<void>;
    /**
     * Saves the dish "Tried" mark on the server and resolves to the updated Tried list.
     * A dish the user reviewed stays in the list when un-ticked.
     */
    setDishTried(dishId: string, tried: boolean): Promise<string[]>;
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

  // Consents saved on the account (analytics, AI search)
  privacy: {
    /** Nothing answered yet when nobody is signed in. */
    getConsents(): Promise<PrivacyConsents>;
    /** Saves only the consents named; the others are left as they are. Throws when it cannot save. */
    saveConsents(updates: Partial<PrivacyConsents>): Promise<void>;
  };

  // Lifecycle (new, current, at risk, dormant, ...)
  lifecycle: {
    /**
     * Records today's visit (once per Singapore day; repeat calls are no-ops) and
     * returns the user's lifecycle state. Null when nobody is signed in.
     */
    recordAppOpen(): Promise<LifecycleSnapshot | null>;
    /** Up to 3 dishes added at stalls the user follows on or after a Singapore date (YYYY-MM-DD). */
    getWelcomeBackDishes(sinceDate: string): Promise<WelcomeBackDish[]>;
  };

  // Social (Bites)
  social: {
    /** Newest posts first. `page.cursor` is the last post of the previous page (createdAt + id). */
    getBitesFeed(lat?: number, lng?: number, page?: BitesFeedPage): Promise<Bite[]>;
    /** One author's published posts, newest first, paged on the server (default 60). */
    listUserPosts(userId: string, page?: { limit?: number; offset?: number }): Promise<Bite[]>;
    postBite(draft: BiteDraft): Promise<Bite>;
    /** One readable post for shared links; null when missing or not visible. Works signed out. */
    getPostById(postId: string): Promise<Bite | null>;
    /** Edits the caption of the signed-in user's own post. Throws when it is not theirs. */
    updatePost(postId: string, patch: { caption: string }): Promise<void>;
    /**
     * Deletes the signed-in user's own post. Soft delete: it disappears from every
     * read at once, and the row stays for moderation. Throws when it is not theirs.
     */
    deletePost(postId: string): Promise<void>;
    /** Idempotent: sets the viewer's like/save to `active` (never toggles server state). */
    reactToBite(biteId: string, reaction: "craving" | "save", active: boolean): Promise<void>;
    shareBite(
      biteId: string,
      options?: {
        channel?: "in_app" | "system_share" | "copy_link" | "whatsapp" | "telegram";
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
    /** "pending" when the target's account is private and must approve the request. */
    followUser(userId: string): Promise<"approved" | "pending">;
    unfollowUser(userId: string): Promise<void>;
    /** One page of approved followers; `limit` defaults to 100 (max 500). */
    listFollowers(
      userId: string,
      page?: { limit?: number; offset?: number },
    ): Promise<{ userId: string; displayName: string; avatarUrl?: string }[]>;
    /** One page of approved followees; `limit` defaults to 100 (max 500). */
    listFollowing(
      userId: string,
      page?: { limit?: number; offset?: number },
    ): Promise<{ userId: string; displayName: string; avatarUrl?: string }[]>;
    /** Removes one of your approved followers. No-op when they do not follow you. */
    removeFollower(userId: string): Promise<void>;
    /**
     * People search by display name (signed-in only; needs 2+ characters). Public accounts only,
     * never yourself or a blocked pair.
     */
    searchProfiles(
      query: string,
      page?: { limit?: number; offset?: number },
    ): Promise<{ userId: string; displayName: string; avatarUrl?: string }[]>;
    /** False when the viewer may not see this user's follower/following lists (private or blocked). */
    canViewFollowLists(userId: string): Promise<boolean>;
    /** Approved follower/following counts; null when hidden from the viewer or unavailable. */
    getFollowCounts(
      userId: string,
    ): Promise<{ followersCount: number; followingCount: number } | null>;
    isFollowing(userId: string): Promise<boolean>;
    /** The viewer's follow toward this user: approved, a pending request, or none. */
    getFollowStatus(userId: string): Promise<"approved" | "pending" | "none">;
    /** Withdraw the viewer's pending request to follow this user; no-op when there is none. */
    cancelFollowRequest(userId: string): Promise<void>;
    /** One page of the viewer's incoming pending follow requests; `limit` defaults to 50 (max 200). */
    listFollowRequests(page?: {
      limit?: number;
      offset?: number;
    }): Promise<{ userId: string; displayName: string; avatarUrl?: string; requestedAt: string }[]>;
    /** Number of incoming pending follow requests (blocked users excluded). */
    getFollowRequestCount(): Promise<number>;
    /** Approve a pending request: the requester becomes an approved follower. */
    approveFollowRequest(requesterId: string): Promise<void>;
    /** Decline a pending request: it is removed and the requester may ask again later. */
    declineFollowRequest(requesterId: string): Promise<void>;

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
    getBlockedUsers(): Promise<{ blockedUserId: string; reason?: string; createdAt: string }[]>;
    /** Removes a block (the follows it removed do not come back). */
    unblockUser(blockedUserId: string): Promise<void>;
    /** The viewer's blocks with the blocked person's name, newest first. */
    listBlockedUsers(): Promise<BlockedUserEntry[]>;
    /** Posts the viewer hid, newest first. */
    listHiddenPosts(): Promise<HiddenPostEntry[]>;
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
    recordImpression(
      surface: RecommendationSurface,
      dishIds: string[],
      buckets?: Record<string, RecommendationBucket>,
    ): Promise<void>;
    /** What the signed-in user has eaten or liked (user_dish_affinities); [] for guests. */
    getFoodHistory(): Promise<UserDishAffinity[]>;
    /** Clear the signed-in user's food history ("Reset food history" in Settings). */
    resetFoodHistory(): Promise<void>;
    recordExplicitFeedback(
      feedback: ExplicitFeedbackInput,
    ): Promise<RecordRecommendationFeedbackResult>;
  };

  // AI
  ai: {
    // Legacy (backward-compatible)
    computeTasteVector(answers: QuizAnswer[]): TasteVector;
    getSmartRecommendations(ctx: RecommendationContext): Promise<RecommendationResult[]>;
    /**
     * Saves a reviewer's taste rating for a dish (dish_taste_ratings), already converted to standard
     * 0-10 levels. One per diner per dish: rating again replaces it. Links the review when given.
     */
    adjustCommunityTasteVector(
      dishId: string,
      userRating: Partial<TasteVector>,
      reviewId?: string,
    ): Promise<void>;
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

    /**
     * Plain-language search: Claude turns the text into a taste tweak and filters. Null when unavailable.
     * No client caller since the legacy search was removed; kept until mood search is wired into v2 search.
     */
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
    /**
     * Uploads the evidence and marks the outlet submitted once. `additionalFileUrls` are more files
     * for the same method (e.g. home-based photos); every file is recorded or none are.
     */
    submitVerification(outletId: string, evidence: VerificationSubmission): Promise<void>;
    resubmitVerification(outletId: string, evidence: VerificationSubmission): Promise<void>;

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
    /** Toggles sold out, or sets it when `soldOut` is given. Returns the new state. */
    toggleSoldOut(outletId: string, dishId: string, soldOut?: boolean): Promise<boolean>;
    /** Sets or clears sold-out on many dishes in one call; resolves with the ids that changed. */
    setDishesSoldOut(outletId: string, dishIds: string[], soldOut: boolean): Promise<string[]>;
    /** Toggles featured, or sets it when `featured` is given (retry-safe). Returns the new state. */
    toggleFeatured(outletId: string, dishId: string, featured?: boolean): Promise<boolean>;

    // OCR Drafts
    getOCRDrafts(outletId: string): Promise<OCRDishDraft[]>;
    /**
     * Publishes a pending draft as a dish, applying optional merchant edits. Idempotent: a draft
     * that was already accepted returns its existing dish instead of inserting again.
     */
    acceptOCRDraft(draftId: string, edits?: Partial<DishDetail>): Promise<DishDetail>;
    /**
     * Accepts many drafts at once. The drafts, outlet and current menu are read once for the whole
     * batch instead of once per draft; a draft that fails is reported and does not stop the rest.
     */
    acceptOCRDrafts(draftIds: string[]): Promise<{ acceptedIds: string[]; failedIds: string[] }>;
    rejectOCRDraft(draftId: string): Promise<void>;

    // Customer Inbox
    getInbox(
      outletId: string,
      filters?: {
        type?: InteractionType;
        unrepliedOnly?: boolean;
        limit?: number;
        /** Keyset page: only items created before this ISO timestamp. */
        before?: string;
        /** With `before`: the id of the oldest item held, so rows sharing its timestamp are kept. */
        beforeId?: string;
      },
    ): Promise<CustomerInteraction[]>;
    /** Posts a public reply, or replaces the existing one. */
    replyToInteraction(interactionId: string, text: string): Promise<void>;
    /** Takes down the merchant's public reply. */
    removeInteractionReply(interactionId: string): Promise<void>;
    reportInteraction(interactionId: string, reason: string): Promise<void>;

    // Featured Visitors
    /** Keyset page on (visitedAt, reviewId): `before` and `beforeId` of the oldest row held. */
    listPopularVisitorCandidates(
      outletId: string,
      options?: { limit?: number; before?: string; beforeId?: string },
    ): Promise<PopularVisitorCandidate[]>;
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
    /** Permanently removes a promotion (any status). */
    deletePromotion(promoId: string): Promise<void>;
    getPromotionAnalytics(promoId: string): Promise<NonNullable<MerchantPromotion["analytics"]>>;

    // Analytics
    getAnalytics(outletId: string, dateRange: "today" | "7d" | "30d"): Promise<MerchantAnalytics>;
    /**
     * Visits and actions per Singapore day for the Performance chart, oldest first. `previous`
     * is the same number of days just before the range, for the chart's comparison bars.
     */
    getDailySeries(
      outletId: string,
      dateRange: "7d" | "30d",
      period?: "current" | "previous",
    ): Promise<MerchantDailyPoint[]>;
    getDashboardSummary(outletId: string): Promise<MerchantDashboardSummary>;
    getWeeklySummaryStats(outletId: string): Promise<MerchantWeeklySummary>;
    getMerchantNotifications(merchantAccountId: string): Promise<MerchantNotification[]>;

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
    submitCatalogCorrection(input: SubmitCatalogCorrectionInput): Promise<void>;
    submitMerchantClaimInterest(
      input: SubmitMerchantClaimInterestInput,
    ): Promise<MerchantClaimSubmissionResult>;
    /** The caller's own claim for this stall ("none" when there is no claim or no session). */
    getMerchantClaimStatus(venueId: string): Promise<MerchantClaimStatus>;
    /** The caller's own claims, newest first, with the stall names. Empty when signed out. */
    getMyMerchantClaims(): Promise<MerchantClaimSummary[]>;
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
    /** `tried` false undoes a mistaken tap (clears the tried date). */
    markChecklistItemTried(id: string, tried?: boolean): Promise<void>;
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
      /** Only these list ids (the Following and Shared tabs). */
      ids?: string[];
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
    /** Items of several lists in one read, keyed by list id. */
    getPortfolioItemsForPortfolios(
      portfolioIds: string[],
    ): Promise<Record<string, PortfolioItem[]>>;
    /** Names, photos and prices for every item of a list in one call. */
    getPortfolioItemDetails(portfolioId: string): Promise<PortfolioItemDetailRow[]>;
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
    updatePortfolioCollaboratorRole(
      portfolioId: string,
      userId: string,
      role: "viewer" | "editor",
      options?: PortfolioMutationOptions,
    ): Promise<void>;
    getPortfolioCollaborators(portfolioId: string): Promise<PortfolioCollaborator[]>;

    followPortfolio(portfolioId: string): Promise<void>;
    unfollowPortfolio(portfolioId: string): Promise<void>;
    getPortfolioFollows(portfolioId: string): Promise<PortfolioFollow[]>;
    isFollowingPortfolio(portfolioId: string): Promise<boolean>;
    /** Ids of the lists the signed-in user follows (empty when signed out). */
    getFollowedPortfolioIds(): Promise<string[]>;
    /**
     * Ids of the lists the signed-in user collaborates on (empty when signed out);
     * `role: "editor"` keeps only lists they may add items to.
     */
    getSharedPortfolioIds(options?: { role?: PortfolioCollaboratorRole }): Promise<string[]>;

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
    listActivityEvents(page?: { limit?: number; offset?: number }): Promise<
      {
        id: string;
        actorId: string;
        actorName: string;
        actorAvatarUrl?: string;
        eventType: "new_like" | "new_comment" | "new_reply" | "new_follower" | "follow_request";
        targetType: "post" | "comment" | "profile";
        targetId: string;
        /** The post a comment target belongs to, so a reply update can open it. */
        postId?: string;
        readAt?: string;
        createdAt: string;
      }[]
    >;
    markActivityRead(eventId: string): Promise<void>;
    /** Marks every unread update read in one call; resolves with how many changed. */
    markAllActivityRead(): Promise<number>;
  };
}
