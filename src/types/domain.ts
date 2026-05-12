export type TasteKey = "sweet" | "spicy" | "sour" | "salty" | "rich" | "aromatic";

export interface TasteVector {
  sweet: number;
  spicy: number;
  sour: number;
  salty: number;
  rich: number;
  aromatic: number;
}

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

export type BuildingType = "hawker_centre" | "food_court" | "restaurant" | "mall";
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
  closureNotice?: string;
  deliveryLinks: DeliveryLink[];
  verificationStatus?: VerificationStatus;
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
  liveCrowd?: "low" | "medium" | "high";
  tasteTags: string[];
  tasteVector: TasteVector;
  dietaryFlags: DietaryFlag[];
  venueVerificationStatus?: VerificationStatus;
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
  description?: string;
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

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  tasteVector: TasteVector;
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
  onboardingSelectedDishIds?: string[];
}

export interface ReviewDraft {
  selectedVenueId?: string;
  selectedDishId?: string;
  rating: number;
  selectedTags: string[];
  recommend: boolean;
  text: string;
  photos: string[];
  videoUri?: string;
  filterId?: string;
  musicId?: string;
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
  /** true = stall/merchant account (orange ring + fork badge), false = user (grey ring) */
  isStallAccount?: boolean;
  /** Inline dish link references in caption — tap navigates to dish detail */
  dishLinks?: { name: string; dishId: string }[];
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

export interface MerchantOutlet {
  id: string;
  merchantAccountId: string;
  name: string;
  businessType: BusinessType;
  buildingId?: string;
  unitNumber?: string;
  floor?: string;
  coordinate?: Coordinate;
  locationPrivacy: LocationPrivacy;
  description: string;
  cuisineCategories: string[];
  operatingHours: string;
  temporaryClosure?: string;
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

export type PromotionStatus = "draft" | "scheduled" | "active" | "ended";

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
  startDate: string;
  endDate: string;
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

export interface AIBusinessInsight {
  id: string;
  outletId: string;
  type:
    | "profile_improvement"
    | "menu_cleanup"
    | "demand_insight"
    | "promotion_tip"
    | "photo_enhancement"
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

export interface StoryInteraction {
  liked: boolean;
  saved: boolean;
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
