export type TasteKey = "sweet" | "spicy" | "sour" | "salty" | "rich" | "aromatic";

export interface TasteVector {
  sweet: number;
  spicy: number;
  sour: number;
  salty: number;
  rich: number;
  aromatic: number;
}

/**
 * What diners who rated a dish's taste say, per axis (0-10 standard levels). An axis appears
 * only once at least three diners rated it, so a single opinion is never shown as the dish.
 */
export type DishTasteRatingSummary = Partial<Record<TasteKey, { average: number; raters: number }>>;

// ─── Extended AI Taste Model ─────────────────────────────────────────────────

/** Oral processing style — which mechanical texture satisfies the user most */
export type TextureArchetype = "cruncher" | "chewer" | "smoother" | "mixed";

/**
 * Extended taste profile — wraps the core 6-axis vector with psychometric
 * secondary axes derived from the scenario-based onboarding quiz and refined
 * by ongoing user behaviour.
 */
export interface TasteProfile {
  /** Core 6-axis taste preference, 0–10 per axis */
  vector: TasteVector;
  /** Bitter tolerance: 0 = supertaster (extreme aversion) → 10 = non-taster (high tolerance) */
  bitterTolerance: number;
  /** Fat/richness affinity: 0 = light/clean preference → 10 = heavy/lemak craving */
  fatAffinity: number;
  /** Texture archetype: which oral processing style satisfies this user most */
  textureArchetype: TextureArchetype;
  /** Neophilia index: 0 = strong neophobe (safe choices) → 10 = extreme neophiliac (seeks novelty) */
  neophiliaIndex: number;
  /** Spice-seeking threshold: 0 = zero capsaicin tolerance → 10 = extreme heat seeker */
  spiceSeeking: number;
  /** How open the user is to new food (onboarding/settings); sets neophiliaIndex and the exploration mix */
  foodOpenness?: FoodOpenness;
}

/** How open a user is to trying new food; drives the familiar-vs-new split of recommendations. */
export type FoodOpenness = "favourites" | "mix" | "adventurous";

/** Why a dish is in a recommendation slate. */
export type RecommendationBucket = "repeat" | "same_type" | "similar" | "new";

/** Per-dish evidence of what a user has eaten or liked, decayed to lastEventAt (user_dish_affinities). */
export interface UserDishAffinity {
  dishId: string;
  foodType?: string;
  venueId?: string;
  /** Signed evidence, decayed to lastEventAt */
  evidence: number;
  /** Sum of |weight|, decayed to lastEventAt; the shrinkage denominator */
  absEvidence: number;
  lastEventAt: string;
  dismissedUntil?: string;
}

/**
 * Localized hawker taste tags — the semantic bridge between community
 * reviews and AI vector updates. Maps Singlish food vocabulary to
 * quantifiable AI signals.
 */
export type HawkerTasteTag =
  | "wok_hei" // breath of the wok — smoky, charred, fleeting aroma
  | "lemak" // rich, creamy, coconut-milk-based mouthcoating
  | "qq" // springy, bouncy, elastic texture (fishballs, tapioca, noodles)
  | "jelak" // excessively rich/sweet — cloying, overwhelming
  | "hiam" // intense, aggressive, lingering spiciness
  | "gao" // thick, concentrated, heavily reduced
  | "chao_ta" // burnt, scorched, charred (desirable or undesirable)
  | "shiok" // intensely satisfying, perfect balance
  | "sedap" // deeply delicious, umami-rich
  | "power"; // exceptionally strong flavor, standout dish

export type BuildingType =
  | "hawker_centre"
  | "food_court"
  | "restaurant"
  | "mall"
  | "mixed_development"
  | "cafe"
  | "bar_bistro"
  | "chain_outlet"
  | "standalone"
  | "kopitiam"
  | "other";
export type DeliveryPlatform = "grabfood" | "foodpanda";
export type DietaryFlag =
  | "halal"
  | "vegetarian"
  | "vegan"
  | "pork_free"
  | "nut_free"
  | "gluten_free"
  | "dairy_free"
  | "egg_free"
  | "peanut_free"
  | "shellfish_free"
  | "soy_free"
  | "sesame_free"
  | "pescatarian"
  | "kosher"
  | "keto"
  | "paleo"
  | "low_carb"
  | "low_sodium"
  | "low_sugar"
  | "diabetic_friendly"
  | "fodmap_friendly"
  | "beef_free"
  | "allium_free"
  | "fish_free"
  | "mollusc_free"
  | "celery_free"
  | "mustard_free"
  | "lupin_free"
  | "sulphite_free";
export type SearchCategory = "local favourites" | "noodles" | "rice" | "desserts" | "late night";

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
  planningArea?: string;
  imageUrl?: string;
  logoUrl?: string;
}

export interface VenueSummary {
  id: string;
  buildingId: string;
  name: string;
  unitNumber: string;
  floor: string;
  isOpen: boolean;
  liveCrowd?: "low" | "medium" | "high";
  topDishId: string;
  operatingHours: string;
  /** Weekly + special hours a verified merchant set; wins over operatingHours for "Open now". */
  openingSchedule?: OpeningSchedule;
  closureNotice?: string;
  /** The merchant paused the stall until this instant (ISO); ignored once it has passed. */
  closedUntil?: string;
  /** How many diners saved this stall. Undefined when the count is not available. */
  savedCount?: number;
  deliveryLinks: DeliveryLink[];
  verificationStatus?: VerificationStatus;
  planningArea?: string;
  imageUrl?: string;
  logoUrl?: string;
  buildingName?: string;
  address?: string;
  postalCode?: string;
  /** The stall's own map pin (a merchant-set pin, or the stored venue coordinate). */
  latitude?: number;
  longitude?: number;
  /** Metres from the search point; set only on stalls read from the discovery feed. */
  distanceMeters?: number;
}

export type UserStallSubmissionStatus =
  | "pending"
  | "under_review"
  | "accepted"
  | "rejected"
  | "duplicate";

export interface UserStallSubmissionMenuItem {
  name: string;
  priceRange?: string;
  notes?: string;
}

export interface UserStallSubmissionDeliveryLink {
  label: string;
  url: string;
}

export interface UserStallSubmission {
  id: string;
  userId: string;
  stallName: string;
  imageUrl: string;
  galleryImageUrls?: string[];
  imageStorageBucket?: string;
  imageStoragePath?: string;
  imageMimeType?: string;
  sourceUrl?: string;
  buildingName?: string;
  area?: string;
  address?: string;
  postalCode?: string;
  unitNumber?: string;
  floor?: string;
  operatingHours?: string;
  menuItems: UserStallSubmissionMenuItem[];
  deliveryLinks: UserStallSubmissionDeliveryLink[];
  notes?: string;
  status: UserStallSubmissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitUserStallSubmissionInput {
  stallName: string;
  imageUri: string;
  imageUris?: string[];
  imageMimeType?: string;
  imageMimeTypes?: string[];
  sourceUrl?: string;
  buildingName?: string;
  area?: string;
  address?: string;
  postalCode?: string;
  unitNumber?: string;
  floor?: string;
  operatingHours?: string;
  menuItems?: UserStallSubmissionMenuItem[];
  deliveryLinks?: UserStallSubmissionDeliveryLink[];
  notes?: string;
}

export interface DishSummary {
  id: string;
  venueId: string;
  buildingId: string;
  venueName: string;
  unitNumber: string;
  floor: string;
  name: string;
  foodTypeTag?: string;
  /** Main, Side, Drink or Dessert & bakery; only the dish search returns it. */
  course?: string;
  /** Cuisine tags of the dish and its stall; only the dish search returns them. */
  cuisineTags?: string[];
  imageUrl: string;
  blurhash?: string;
  distanceMeters: number;
  rating: number;
  reviewCount: number;
  price: number;
  priceRange: string;
  liveCrowd?: "low" | "medium" | "high";
  tasteTags: string[];
  tasteVector: TasteVector;
  /** 0-1 trust in tasteVector (AI tagging confidence); undefined = fully trusted. */
  tasteConfidence?: number;
  dietaryFlags: DietaryFlag[];
  venueVerificationStatus?: VerificationStatus;
  /** ISO time the dish row last changed; shown as "Updated 3d ago". Undefined when unknown. */
  updatedAt?: string;
  /** How many diners saved this dish. Undefined when the count is not available. */
  savedCount?: number;
  /** The stall's position, when the read that produced this dish carried it (taste picks). */
  venuePin?: Coordinate;
}

export interface Review {
  id: string;
  dishId?: string;
  venueId?: string;
  /** Auth user id of the author, when the review came from a signed-in account. */
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  rating: number;
  createdAt: string;
  text: string;
  tags: string[];
  wouldRecommend: boolean;
  photos: string[];
  /**
   * Small copies of `photos`, the same order (grid tiles). An entry is empty when that photo has
   * none (reviews posted before thumbnails), so use `photos[i]` then.
   */
  photoThumbnails?: string[];
  /** Public reply from the stall owner, if they answered this review. */
  merchantReply?: {
    text: string;
    repliedAt: string;
  };
  /** People who marked this review helpful (server-kept count). */
  helpfulCount?: number;
  /** The signed-in viewer marked this review helpful. */
  viewerFoundHelpful?: boolean;
  /** Set only on the viewer's own review when it was hidden or removed after reports. */
  moderationState?: "hidden" | "removed";
  /** ISO time the author last changed the rating, text or tags (undefined when never edited). */
  editedAt?: string;
}

export interface PopularVisitorPin {
  id: string;
  outletId: string;
  venueId: string;
  reviewId: string;
  sourceId: string;
  authorProfileId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorLocation?: string;
  reviewText: string;
  rating: number;
  dishName?: string;
  visitedAt: string;
  pinnedAt: string;
  sortOrder: number;
  isActive: boolean;
}

export interface PopularVisitorCandidate {
  outletId: string;
  venueId: string;
  reviewId: string;
  sourceId: string;
  authorProfileId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorLocation?: string;
  reviewText: string;
  rating: number;
  dishName?: string;
  visitedAt: string;
  isPinned: boolean;
  pinId?: string;
  sortOrder?: number;
}

export interface DishDetail extends DishSummary {
  gallery: string[];
  description?: string;
  mustOrder: boolean;
  availabilityFlags: string[];
  reviews: Review[];
  /**
   * Merchant menu reads only: false for a dish diners can already see, true for a draft kept
   * hidden until the outlet is verified. Unset elsewhere.
   */
  isMerchantDraft?: boolean;
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

export interface RecommendationSignalState {
  confidence: number;
  signalCount: number;
  lastSignalAt?: string;
}

export type RecommendationSurface =
  | "home"
  | "discover"
  | "search"
  | "decide"
  | "dish_detail"
  | "review"
  | "profile";

export type TasteInteractionType =
  | "quiz_completed"
  | "search_query"
  | "dish_result_click"
  | "dish_like"
  | "saved"
  | "unsaved"
  | "rating"
  | "review"
  | "dismissed"
  | "food_button_click"
  | "hawker_tag";

export interface TasteInteractionEvent {
  id: string;
  type: TasteInteractionType;
  surface: RecommendationSurface;
  dishId?: string;
  query?: string;
  chipId?: string;
  buttonId?: string;
  rating?: number;
  createdAt: string;
  userVectorBefore: TasteVector;
  userVectorAfter: TasteVector;
  applied: boolean;
  reason?: "missing_dish" | "missing_signal" | "capped";
}

export type ProfileVisibility = "public" | "private";

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  /** Short public bio, at most PROFILE_BIO_MAX_LENGTH (150) characters. */
  bio?: string;
  tasteVector: TasteVector;
  profileVisibility: ProfileVisibility;
  /** Extended psychometric taste profile (populated after scenario quiz) */
  tasteProfile?: TasteProfile;
  dietaryPreferences: DietaryFlag[];
  favouriteDishIds: string[];
  reviewedDishIds: string[];
  stats: {
    dishesReviewed: number;
    stallsVisited: number;
    favouritesCount: number;
    followersCount: number;
    followingCount: number;
  };
  recommendationSignals?: RecommendationSignalState;
  leftHandedMode?: boolean;
  /** Legacy: dishes picked by the old cuisine step; kept for profiles saved before it was cut. */
  onboardingSelectedDishIds?: string[];
  /** Legacy: cuisine ids picked by the old cuisine step (e.g. "local", "japanese"). */
  onboardingCuisineIds?: string[];
  /** Usual max price per dish in SGD, set during onboarding. Undefined = no budget limit. */
  maxDishBudget?: number;
  /** When the account was created (ISO); drives "Member since". */
  createdAt?: string;
}

/** Count, average and 1-5 histogram over all of the signed-in user's reviews (server totals). */
export interface ReviewStats {
  reviewCount: number;
  /** Null when there are no reviews. */
  averageRating: number | null;
  /** Reviews per star, index 0 = 1 star ... index 4 = 5 stars. */
  ratingCounts: [number, number, number, number, number];
}

export interface ReviewDraft {
  selectedVenueId?: string;
  selectedDishId?: string;
  rating: number;
  selectedTags: string[];
  /** null until the reviewer answers Yes or No. */
  recommend: boolean | null;
  text: string;
  photos: string[];
  videoUri?: string;
  musicId?: string;
}

export interface SearchFilters {
  query: string;
  categories: SearchCategory[];
  dietaryFlags: DietaryFlag[];
  tasteValues: TasteVector;
  radius: number;
  latitude?: number;
  longitude?: number;
  areaName?: string;
  cuisineTags?: string[];
  /** Decide for Me's quiz answers, sent to the server as whole-word keywords (up to 12 each). */
  cuisineKeywords?: string[];
  stapleKeywords?: string[];
  foodTypeTag?: string;
  maxPrice?: number;
  openOnly?: boolean;
  /** Rows to ask the server for (default 20, server cap 50). */
  limit?: number;
}

/** What Claude understood from a plain-language search such as "something soupy, under $8". */
export interface MoodSearchIntent {
  /** Added to the person's usual taste for this search only, each axis -5 to +5. */
  tasteShift: TasteVector;
  maxPrice?: number;
  dietaryFlags: DietaryFlag[];
  /** Dish-type words such as "soup" or "noodle", matched against dish names and tags. */
  keywords: string[];
  summary: string;
}

export interface StallPost {
  id: string;
  /** Stable author id when the post came from an authenticated publish flow. */
  authorId?: string;
  venueId: string;
  buildingId: string;
  authorName: string;
  authorLocation: string;
  authorAvatarUrl: string;
  mediaType: "photo" | "video";
  mediaUrl: string;
  /** Optional carousel media. Keep mediaUrl as the first/canonical image for legacy consumers. */
  mediaUrls?: string[];
  /** Controls the bottom-left dish/stall label overlay on feed media. Defaults to true. */
  showFoodContextOverlay?: boolean;
  caption: string;
  /** Post-authored social tags. Falls back to dish taste tags when omitted. */
  tags?: string[];
  dishIds: string[];
  createdAt: string;
  publishedStatus?: "published" | "draft" | "scheduled";
  visibility?: "public" | "private";
  likeCount?: number;
  commentCount?: number;
  savedCount?: number;
  /** Server share total from the feed read, when it returned one. */
  shareCount?: number;
  /** The viewer's own like/save from the server read; undefined when the read did not say. */
  viewerHasLiked?: boolean;
  viewerHasSaved?: boolean;
  /** true = stall/merchant account (orange ring + fork badge), false = user (grey ring) */
  isStallAccount?: boolean;
  /** Inline dish link references in caption — tap navigates to dish detail */
  dishLinks?: { name: string; dishId: string }[];
  /** Venue fields from the feed read, used when the local catalog has not loaded this venue. */
  venueName?: string;
  venueUnitNumber?: string;
  buildingName?: string;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  timestamp: string; // ISO string
  location?: string;
  genre?: string;
  resultCount?: number;
  rating?: number;
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
  maxEntriesPerMember?: number;
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
  dietaryPreferences?: DietaryFlag[];
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

// ─── Merchant Centre ─────────────────────────────────────────────────────────

export type BusinessType =
  | "hawker_stall"
  | "food_court_stall"
  | "restaurant"
  | "cafe"
  | "mall_tenant"
  | "home_based";

export type VerificationStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "in_review"
  | "verified"
  | "rejected"
  | "more_info_needed";

export type VerificationMethod =
  | "video_walkaround"
  | "licence_upload"
  | "singpass_myinfo"
  | "home_based_declaration";

export type LocationPrivacy = "exact" | "approximate" | "hidden";

export type MerchantRole = "owner" | "manager" | "staff";
export type MerchantInviteStatus = "pending" | "accepted" | "declined" | "removed";
export type MerchantNotificationKind =
  | "team_invite"
  | "team_added"
  | "low_rating"
  | "weekly_summary"
  | "ai_insight";

export interface VerificationEvidence {
  id: string;
  method: VerificationMethod;
  /** URI to the uploaded file or video */
  fileUrl: string;
  uploadedAt: string;
  /** Review notes from ops (visible to merchant only for rejected/more_info_needed) */
  reviewNote?: string;
}

export interface MerchantVerification {
  status: VerificationStatus;
  method?: VerificationMethod;
  evidence: VerificationEvidence[];
  submittedAt?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  expiresAt?: string;
}

export type OpeningDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** 24-hour "HH:MM" times. close "24:00" is midnight; close before open runs past midnight. */
export interface OpeningTimeRange {
  open: string;
  close: string;
}

/** Fixed weekly hours (a missing or empty day is closed) plus special hours by date. */
export interface OpeningSchedule {
  weekly: Partial<Record<OpeningDayKey, OpeningTimeRange[]>>;
  /** Overrides by Singapore date ("YYYY-MM-DD"); empty ranges = closed that day. */
  special?: { date: string; ranges: OpeningTimeRange[]; note?: string }[];
}

export interface MerchantOutlet {
  id: string;
  merchantAccountId: string;
  /** Consumer catalog venue this outlet is linked to. */
  venueId?: string;
  name: string;
  businessType: BusinessType;
  buildingId?: string;
  unitNumber?: string;
  floor?: string;
  coordinate?: Coordinate;
  /** Street address and 6-digit postal code, from the OneMap postal-code lookup. */
  address?: string;
  postalCode?: string;
  locationPrivacy: LocationPrivacy;
  description: string;
  cuisineCategories: string[];
  /** Display line derived from openingSchedule when one is set. */
  operatingHours: string;
  openingSchedule?: OpeningSchedule;
  temporaryClosure?: string;
  /** The stall is closed until this instant (ISO); ignored once it has passed. null clears it. */
  closedUntil?: string | null;
  profilePhotoUrl?: string;
  coverPhotoUrl?: string;
  galleryUrls: string[];
  contactPhone?: string;
  contactEmail?: string;
  socialLinks: { platform: string; url: string }[];
  deliveryLinks: DeliveryLink[];
  dietaryLabels: DietaryFlag[];
  tasteTags: string[];
  signatureDishIds: string[];
  isLive: boolean;
  verification: MerchantVerification;
}

/** What diners see of a live merchant outlet on the stall page. */
/** Another user's public-safe profile fields (public_profiles; RLS applies visibility). */
export interface PublicUserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  /** The account is private (only set when the server says so). */
  isPrivate?: boolean;
  /** The viewer may see the account's posts and profile reviews. */
  canViewContent?: boolean;
  /** Stalls visited, counted on the server by the same rule as your own Stalls stat. */
  stallsVisited?: number;
  /** Distinct dishes reviewed, the server's user_profiles.dishes_reviewed counter. */
  dishesReviewed?: number;
  /** When the account was created (ISO); drives "Member since". */
  createdAt?: string;
}

export interface PublicMerchantProfile {
  outletId: string;
  description?: string;
  contactPhone?: string;
  contactEmail?: string;
  socialLinks: { platform: string; url: string }[];
  cuisineCategories: string[];
  profilePhotoUrl?: string;
  coverPhotoUrl?: string;
  temporaryClosure?: string;
  isVerified: boolean;
}

export interface MerchantAccount {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: MerchantRole;
  outlets: MerchantOutlet[];
  createdAt: string;
}

export interface MerchantTeamMember {
  id: string;
  merchantAccountId: string;
  userId: string;
  displayName: string;
  email: string;
  role: MerchantRole;
  inviteStatus?: MerchantInviteStatus;
  invitedAt?: string;
  acceptedAt?: string;
  removedAt?: string;
  addedAt: string;
}

/** Analytics snapshot for a single outlet and date range */
export interface MerchantAnalytics {
  outletId: string;
  dateRange: "today" | "7d" | "30d";
  profileVisits: number;
  menuViews: number;
  dishViews: number;
  directionTaps: number;
  saves: number;
  shares: number;
  contactTaps: number;
  socialLinkTaps: number;
  postInteractions: number;
  reviewCount: number;
  averageRating: number;
  topDishes: { dishId: string; name: string; views: number; saves: number }[];
  mostSearchedKeywords: string[];
  peakDiscoveryHours: number[];
  customerTasteTags: { tag: string; count: number }[];
  previousPeriodComparison: {
    profileVisits: number;
    menuViews: number;
    reviewCount: number;
    averageRating: number;
  };
}

/** One Singapore day of the Performance chart (get_merchant_daily_series). */
export interface MerchantDailyPoint {
  /** "YYYY-MM-DD", Singapore date. */
  date: string;
  profileVisits: number;
  menuViews: number;
  dishViews: number;
  directionTaps: number;
  saves: number;
}

/** What get_merchant_insight_facts returns: the counts the Insights rules read, from one call. */
export interface MerchantInsightFacts {
  dishCount: number;
  dishesWithoutPhoto: number;
  /** Dishes marked sold out right now (no history is stored). */
  soldOutCount: number;
  soldOutNames: string[];
  unrepliedReviews: number;
  oldestUnrepliedAt?: string;
  reviewsLast7Days: number;
  ratingLast7Days?: number;
  reviewsPrevious7Days: number;
  ratingPrevious7Days?: number;
}

/** Counts behind the merchant dashboard's action cards, from one call. */
export interface MerchantDashboardSummary {
  menuCount: number;
  dishesWithoutImages: number;
  unrepliedReviews: number;
  latestReview?: {
    id: string;
    authorName: string;
    rating?: number;
    text: string;
    createdAt: string;
  };
}

export type PromotionStatus = "draft" | "scheduled" | "active" | "ended";

// ─── Checklist Types ──────────────────────────────────────────────────────────

export type ChecklistItemType = "dish" | "stall" | "custom";

export interface Checklist {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Server item count from the list query; undefined when the read did not include it. */
  itemCount?: number;
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  itemType: ChecklistItemType;
  dishId?: string;
  stallId?: string;
  customText?: string;
  reminderAt?: string;
  plannedVisitDate?: string;
  triedAt?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Portfolio Types ──────────────────────────────────────────────────────────

export type PortfolioType = "recommendation" | "ranking" | "trail" | "collection";
export type PortfolioVisibility = "private" | "followers_only" | "public";
export type PortfolioItemType = "dish" | "stall";
export type PortfolioCollaboratorRole = "viewer" | "editor";
export type PortfolioFlagReason = "spam" | "inappropriate" | "misleading" | "other";
export type PortfolioFlagStatus = "pending" | "dismissed" | "removed";

export interface Portfolio {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  type: PortfolioType;
  visibility: PortfolioVisibility;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Server item count from the list query; undefined when the read did not include it. */
  itemCount?: number;
  /** Server follower count (search_portfolios); undefined when not returned. */
  followerCount?: number;
}

export interface PortfolioItem {
  id: string;
  portfolioId: string;
  itemType: PortfolioItemType;
  dishId?: string;
  stallId?: string;
  score?: number;
  publicNotes?: string;
  privateNotes?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** A public list as anyone with the link sees it (get_public_portfolio). */
export interface PublicPortfolio {
  id: string;
  name: string;
  description?: string;
  ownerDisplayName?: string;
  type?: PortfolioType;
  updatedAt?: string;
  items: PublicPortfolioItem[];
}

export interface PublicPortfolioItem {
  itemType: PortfolioItemType;
  dishId?: string;
  stallId?: string;
  name: string;
  stallName?: string;
  price?: number;
  score?: number;
  publicNotes?: string;
  imageUrl?: string;
  /** Free-text place for a maps search ("Get directions"). */
  mapQuery?: string;
}

export interface PortfolioCollaborator {
  id: string;
  portfolioId: string;
  /** Internal key for add/remove; never shown in the UI. */
  userId: string;
  role: PortfolioCollaboratorRole;
  createdAt: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface PortfolioFollow {
  id: string;
  portfolioId: string;
  userId: string;
  createdAt: string;
}

export interface PortfolioFlag {
  id: string;
  portfolioId: string;
  reporterId: string;
  reason: PortfolioFlagReason;
  details?: string;
  status: PortfolioFlagStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

// ─── Passport Types ───────────────────────────────────────────────────────────

export type PassportEventType =
  | "dish_tried"
  | "stall_visited"
  | "stall_submitted"
  | "review_posted"
  | "photo_posted"
  | "portfolio_item_added"
  | "public_portfolio_published"
  | "trail_completed";

export interface PassportStamp {
  id: string;
  userId: string;
  categoryId: string;
  level: number;
  dishesTriedCount: number;
  stallsVisitedCount: number;
  stallsSubmittedCount: number;
  reviewsPostedCount: number;
  photosPostedCount: number;
  portfolioItemsAdded: number;
  publicPortfoliosPublished: number;
  trailsCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface PassportProgressEvent {
  id: string;
  userId: string;
  categoryId: string;
  eventType: PassportEventType;
  referenceId?: string;
  createdAt: string;
}

export interface PassportContributionStats {
  stallsSubmitted: number;
  portfolioItemsAdded: number;
  publicPortfoliosPublished: number;
  trailsCompleted: number;
  recentEvents: PassportProgressEvent[];
}

export type PromotionTargetAudience =
  | "nearby_users"
  | "saved_stall_users"
  | "taste_match_users"
  | "followers";

export interface MerchantPromotion {
  id: string;
  outletId: string;
  title: string;
  description: string;
  /** Dish ID if promoting a specific dish, else outlet-level */
  targetDishId?: string;
  promotionItemType?: "new_item" | "existing_menu_item";
  startDate: string;
  endDate: string;
  originalPrice?: number;
  promotionalPrice?: number;
  finalPrice?: number;
  discountPercentage?: number;
  isAvailable?: boolean;
  targetAudience: PromotionTargetAudience[];
  status: PromotionStatus;
  createdAt: string;
  analytics?: {
    impressions: number;
    clicks: number;
    saves: number;
    profileVisits: number;
    dishViews: number;
  };
}

export type InteractionType = "review" | "comment" | "post_mention" | "question";

export interface CustomerInteraction {
  id: string;
  outletId: string;
  type: InteractionType;
  authorName: string;
  authorAvatarUrl?: string;
  rating?: number;
  text: string;
  tags?: string[];
  createdAt: string;
  /** Name of the dish the review is about, when it is about one */
  dishName?: string;
  /** Merchant's reply, if any */
  reply?: {
    text: string;
    repliedAt: string;
  };
  /** ID of the source review/post for "View original" navigation */
  sourceId?: string;
  sentiment?: "positive" | "neutral" | "negative";
}

export interface OCRDishDraft {
  id: string;
  outletId: string;
  /** Extracted dish name from menu photo OCR */
  name: string;
  /** Extracted price, if detected */
  price?: number;
  /** OCR extraction confidence 0–1 */
  confidence: number;
  /** URL of the source menu photo */
  sourcePhotoUrl: string;
  /** AI-suggested description */
  suggestedDescription?: string;
  /** AI-suggested dietary tags */
  suggestedDietaryTags?: DietaryFlag[];
  /** AI-suggested taste tags */
  suggestedTasteTags?: string[];
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface MerchantNotificationPreferences {
  newReviews: boolean;
  lowRatingAlerts: boolean;
  newComments: boolean;
  promotionUpdates: boolean;
  weeklyDigest: boolean;
  aiInsights: boolean;
}

export interface MerchantNotification {
  id: string;
  merchantAccountId: string;
  outletId?: string;
  recipientUserId?: string;
  recipientEmail?: string;
  kind: MerchantNotificationKind;
  title: string;
  body: string;
  status: "unread" | "read" | "sent";
  dedupeKey: string;
  deepLink?: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface MerchantDishViewEvent {
  id: string;
  outletId: string;
  dishId: string;
  sessionId: string;
  userId?: string;
  viewedAt: string;
}

export interface MerchantWeeklySummary {
  id: string;
  outletId: string;
  weekStart: string;
  weekEnd: string;
  totalViews: number;
  dishViews: number;
  topDishes: { dishId: string; name: string; views: number; saves: number }[];
  newReviews: number;
  averageRating: number;
  ratingChange: number;
  unrepliedReviews: number;
  promotionViews: number;
  createdAt: string;
}

export interface AIBusinessInsight {
  id: string;
  outletId: string;
  type:
    | "profile_improvement"
    | "menu_cleanup"
    | "demand_insight"
    | "promotion_tip"
    | "photo_enhancement"
    | "review_attention"
    | "weekly_summary";
  title: string;
  body: string;
  /** Action label, e.g. "Fix missing ingredients" */
  actionLabel?: string;
  /** Screen to navigate to when action is tapped */
  actionTarget?: string;
  createdAt: string;
  isDismissed: boolean;
}

// ─── Figma V2 Feed Types ─────────────────────────────────────────────────────

/** Story rail item — rendered as circular avatar with ring colour based on isStall */
export interface StoryItem {
  id: string;
  displayName: string;
  authorId?: string;
  authorProfileVisibility?: ProfileVisibility;
  avatarUrl?: string;
  emoji?: string;
  /** true = stall account (orange gradient ring + fork badge), false = user (grey ring) */
  isStall: boolean;
  hasUnseen: boolean;
  /** "Your story" entry — shows + add icon instead of ring */
  isOwn?: boolean;
}

export interface StoryContent {
  type: "image" | "video";
  url: string;
}

export interface StoryGalleryAsset extends StoryContent {
  id: string;
  title: string;
}

export interface StoryInteraction {
  liked: boolean;
  saved: boolean;
  savedAt?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

export interface Story extends StoryItem {
  content: StoryContent;
  createdAt: string;
  interaction: StoryInteraction;
}

/**
 * Quick-review taste tags — tap-only tags replacing mandatory text input.
 * 12 tags covering 90% of user review intent.
 */
export type ReviewTasteTag =
  | "spicy"
  | "savoury"
  | "sweet"
  | "sour"
  | "generous"
  | "fresh"
  | "worth_it"
  | "cold_refreshing"
  | "rich_broth"
  | "chewy_noodles"
  | "hot_fresh"
  | "quick_service";

/** Map of review taste tag keys to display label + emoji */
export const REVIEW_TASTE_TAG_META: Record<ReviewTasteTag, { emoji: string; label: string }> = {
  spicy: { emoji: "🌶️", label: "Spicy" },
  savoury: { emoji: "🧂", label: "Savoury" },
  sweet: { emoji: "🍯", label: "Sweet" },
  sour: { emoji: "🍋", label: "Sour" },
  generous: { emoji: "💪", label: "Generous" },
  fresh: { emoji: "🌿", label: "Fresh" },
  worth_it: { emoji: "💰", label: "Worth it" },
  cold_refreshing: { emoji: "🧊", label: "Cold & refreshing" },
  rich_broth: { emoji: "🫙", label: "Rich broth" },
  chewy_noodles: { emoji: "🥢", label: "Chewy noodles" },
  hot_fresh: { emoji: "🔥", label: "Hot & fresh" },
  quick_service: { emoji: "⚡", label: "Quick service" },
};

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

// ─── Gamification ─────────────────────────────────────────────────────────────

/**
 * Every discrete action that earns Food Cred.
 * Used in both the event ledger and the points config table.
 */
export type FoodCredAction =
  | "review_created"
  | "photo_uploaded"
  | "stall_saved"
  | "stall_marked_tried"
  | "stall_submitted"
  | "helpful_vote_received"
  | "stall_info_corrected"
  | "tag_added"
  | "collection_created"
  | "post_created"
  | "mission_completed";

/**
 * Immutable event record: one row per cred-earning action.
 * Append-only — never mutated after creation.
 */
export interface FoodCredEvent {
  id: string;
  userId: string;
  sourceAction: FoodCredAction;
  points: number;
  relatedEntityId?: string;
  relatedEntityType?: "stall" | "review" | "post" | "collection" | "mission";
  createdAt: string; // ISO 8601
}

/**
 * Materialized summary of a user's total Food Cred.
 * Derived from food_cred_events; updated via RPC after each event.
 */
export interface UserFoodCred {
  userId: string;
  totalPoints: number;
  /** Index into FOOD_CRED_LEVELS array */
  levelIndex: number;
}

/**
 * One tier in the Food Cred progression ladder.
 * Names are professional — no emojis, no game-world language.
 */
export interface FoodCredLevel {
  index: number;
  name: string;
  /** Minimum cumulative points to reach this tier */
  minPoints: number;
  /** Short descriptor shown on profile badges */
  badgeLabel: string;
}

// ─── Stall Interactions ───────────────────────────────────────────────────────

/**
 * Per-user, per-stall interaction state.
 * Primary key: (userId, stallId).
 */
export interface StallInteraction {
  userId: string;
  stallId: string;
  isSaved: boolean;
  isTried: boolean;
  isReviewed: boolean;
  savedAt?: string;
  triedAt?: string;
  reviewedAt?: string;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Where a user is in their Hungry habit, from the Singapore days they opened the app.
 * Active today: new, current (back within 7 days), reactivated (8-30), resurrected (31+).
 * Not active today: at_risk_weekly (last visit within 7 days), at_risk_monthly (8-30), dormant.
 */
export type LifecycleState =
  | "new"
  | "current"
  | "reactivated"
  | "resurrected"
  | "at_risk_weekly"
  | "at_risk_monthly"
  | "dormant";

export interface LifecycleSnapshot {
  state: LifecycleState;
  /** Singapore date (YYYY-MM-DD) of the visit before today, if any. */
  previousActiveDate: string | null;
  daysSincePrevious: number | null;
}

/** A dish added at a followed stall since the user's last visit, for the welcome back card. */
export interface WelcomeBackDish {
  dishId: string;
  dishName: string;
  stallId: string;
  stallName: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

/** Per-user push settings. Hours are Singapore time (0-23); quiet hours wrap past midnight. */
export interface PushPreferences {
  stallUpdates: boolean;
  /** Weekly "Your new picks are ready" push. On unless the user opts out. */
  weeklyPicks: boolean;
  /** Lunch (11:30) and dinner (17:30) suggestion pushes. Off unless the user turns them on. */
  mealtimeSuggestions: boolean;
  /** Follow-request pushes (notification_preferences.social_activity). On unless the user opts out. */
  socialActivity: boolean;
  quietStartHour: number;
  quietEndHour: number;
  weeklyCap: number;
}

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  stallUpdates: false,
  weeklyPicks: true,
  mealtimeSuggestions: false,
  socialActivity: true,
  quietStartHour: 22,
  quietEndHour: 8,
  weeklyCap: 3,
};

// ─── Helpful Voting ───────────────────────────────────────────────────────────

export interface ReviewHelpfulVote {
  userId: string;
  reviewId: string;
  createdAt: string;
}

// ─── Passport ─────────────────────────────────────────────────────────────────

/** Top-level dimension of the Hungry Passport */
export type PassportCategoryType =
  | "cuisine"
  | "neighbourhood"
  | "classic"
  | "dietary"
  | "contributor";

export type PassportStampAssetKey =
  | "stamp-cuisine-hawker"
  | "stamp-classic-laksa"
  | "stamp-hood-chinatown"
  | "stamp-dietary-halal";

export type PassportBadgeAssetKey =
  | "badge-hawker-explorer"
  | "badge-classics-trail"
  | "badge-night-makan"
  | "badge-contributor";

export type PassportInkTone = "orange" | "amber" | "navy" | "teal";
export type PassportStampShape = "rounded" | "oval" | "slanted";

/**
 * A single passport category (e.g. "Japanese Explorer", "CBD Lunch Explorer").
 * These are config/seed data — not user-generated.
 */
export interface PassportCategory {
  id: string;
  name: string;
  description: string;
  type: PassportCategoryType;
  /** The tag value to match against stall metadata (cuisineTag or neighbourhoodTag) */
  matchTag: string;
  /** Milestone thresholds (tried counts) at which a stamp is awarded */
  stampThresholds: number[];
}

export interface PassportStampDefinition {
  id: string;
  categoryId: string;
  threshold: number;
  index: number;
  title: string;
  subtitle: string;
  description: string;
  assetKey: PassportStampAssetKey;
  inkTone: PassportInkTone;
  stampShape: PassportStampShape;
}

export interface PassportBadgeDefinition {
  id: string;
  title: string;
  description: string;
  categoryType: PassportCategoryType;
  assetKey: PassportBadgeAssetKey;
  unlockCategoryId?: string;
  unlockThreshold: number;
}

export interface EarnedPassportStamp extends PassportStampDefinition {
  triedCount: number;
}

export interface PassportNextStamp {
  category: PassportCategory;
  stamp: PassportStampDefinition;
  triedCount: number;
  remainingCount: number;
  progressFraction: number;
}

export interface PassportCelebrateMarker {
  stampId: string;
  categoryId: string;
  title: string;
  shouldCelebrate: boolean;
}

/**
 * A user's computed progress within one passport category.
 * Computed from user_stall_interactions — not stored independently for MVP.
 */
export interface UserPassportProgress {
  categoryId: string;
  /** Count of unique stalls tried that match this category */
  triedCount: number;
  /** Index of the next stamp milestone to reach */
  nextStampIndex: number;
  /** Thresholds for which stamps have been awarded */
  earnedStampThresholds: number[];
}

export interface UserPassportStamp {
  stampId: string;
  categoryId: string;
  threshold: number;
  earnedAt: string;
  triggerAction: FoodCredAction | "initial_sync";
  celebratedAt?: string;
}

// ─── Weekly Missions ──────────────────────────────────────────────────────────

export type MissionType =
  | "save_stalls"
  | "add_stall"
  | "create_post"
  | "write_review"
  | "mark_tried"
  | "add_to_collection"
  | "helpful_vote";

export type MissionRewardType = "food_cred" | "passport_progress" | "badge";

/**
 * A weekly mission template. Active missions are surfaced on the home feed.
 * Rotated weekly — same pool for all users at launch.
 */
export interface WeeklyMission {
  id: string;
  title: string;
  description: string;
  missionType: MissionType;
  /** Number of qualifying actions required to complete */
  requirementCount: number;
  rewardType: MissionRewardType;
  /** Food Cred awarded on completion, or passport step count, etc. */
  rewardValue: number;
  weekStart: string; // ISO date (YYYY-MM-DD)
  weekEnd: string;
  isActive: boolean;
}

/**
 * Per-user progress on a specific weekly mission.
 * Primary key: (userId, missionId).
 */
export interface UserMissionProgress {
  userId: string;
  missionId: string;
  currentCount: number;
  completedAt?: string;
}
