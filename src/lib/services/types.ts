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
  CustomerInteraction,
  DishDetail,
  DietaryFlag,
  HawkerTasteTag,
  InteractionType,
  MerchantAccount,
  MerchantAnalytics,
  MerchantNotificationPreferences,
  MerchantOutlet,
  MerchantPromotion,
  MerchantTeamMember,
  MerchantRole,
  OCRDishDraft,
  PromotionStatus,
  SearchFilters,
  StallPost,
  Story,
  StoryContent,
  TasteProfile,
  TasteVector,
  UserProfile,
  VerificationEvidence,
  VenueSummary,
} from "@/types/domain";

export interface DecideForMeOptions {
  dietaryFlags?: DietaryFlag[];
  radiusMeters?: number;
  excludeDishIds?: string[];
  neophiliaIndex?: number;
  latitude?: number;
  longitude?: number;
}

export interface DataRepository {
  getProfile(isAuthenticated: boolean): UserProfile;
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
  mediaType?: "photo" | "video";
  mediaTypes?: ("photo" | "video")[];
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

export interface ExplicitFeedbackInput {
  dishId: string;
  feedbackType: "rating" | "save" | "unsave" | "hawker_tag";
  rating?: number;
  hawkerTags?: HawkerTasteTag[];
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

// ─── Session Types ────────────────────────────────────────────────────────────

export interface Session {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  profile: UserProfile;
}

export type AuthProvider = "email" | "google" | "apple";

export interface SubmitReviewInput {
  dishId: string;
  venueId: string;
  rating: number;
  text: string;
  tags: string[];
  photos: string[];
  // TODO(api): include upload references (asset ids / signed urls) once media service is wired.
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

export type ContentReportTargetType = "review" | "bite" | "reply" | "profile";

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
  };

  // Profile
  profile: {
    getProfile(): Promise<UserProfile>;
    updateProfile(updates: Partial<UserProfile>): Promise<UserProfile>;
    updateDietaryPreferences(flags: DietaryFlag[]): Promise<void>;
    getGuestProfile(): Promise<UserProfile>;
    toggleFavourite(dishId: string): Promise<boolean>;
    getFavouriteDishIds(): Promise<string[]>;
    updateTasteVector(vector: TasteVector): Promise<void>;
    updateTasteProfile(profile: TasteProfile): Promise<void>;
  };

  // Social (Bites)
  social: {
    getBitesFeed(lat?: number, lng?: number): Promise<Bite[]>;
    postBite(draft: BiteDraft): Promise<Bite>;
    reactToBite(biteId: string, reaction: "craving" | "save"): Promise<void>;

    // Stories
    getStories(): Promise<Story[]>;
    likeStory(storyId: string): Promise<void>;
    saveStory(storyId: string): Promise<void>;
    addStory(content: StoryContent): Promise<Story>;
    getLikedStories(): Promise<Story[]>;
    getSavedStories(): Promise<Story[]>;
    getSavedBites(): Promise<Bite[]>;
    getLikedBites(): Promise<Bite[]>;
  };

  communitySafety: {
    reportContent(request: ContentReportRequest): Promise<void>;
    blockUser(request: BlockUserRequest): Promise<void>;
  };

  // Content
  content: {
    listArticles(): Promise<BlogPost[]>;
    listStallPosts(): Promise<StallPost[]>;
    getArticle(id: string): Promise<BlogPost | undefined>;
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
}
