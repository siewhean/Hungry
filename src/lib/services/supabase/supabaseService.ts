import type {
  PostgrestError,
  Session as SupabaseAuthSession,
  SupabaseClient,
} from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";

import { getFloorPlan } from "@/lib/geo/floorPlans";
import { similarityScore } from "@/lib/ai/similarityScore";
import { computeTasteProfileFromQuiz } from "@/lib/ai/tasteQuiz";
import { STORY_GALLERY_ASSETS } from "@/lib/services/storyGalleryAssets";
import { POST_CAPTION_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import {
  averageTasteVectors,
  processExplicitFeedback as processExplicitFeedbackCore,
  runRecommendationPipeline,
} from "@/lib/ai/tasteEngine";
import { parseMoodIntent } from "@/lib/ai/moodSearch";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { AUTH_REDIRECTS } from "@/constants/links";
import { getAuthErrorCode } from "@/features/auth/authErrors";
import {
  countVenuesInAreaViaRpc,
  getDishByIdViaRpc,
  getBuildingDetailViaRpc,
  getItemDetailsViaRpc,
  getInlineMerchantReads,
  getSavedDishCardsViaRpc,
  getVenueByIdViaRpc,
  invalidateVenueDetail,
  getVenuesByIdsViaRpc,
  listBuildingsViaRpc,
  listDiscoveryFeedByLocationViaRpc,
  listDishesByVenueViaRpc,
  listDishesByVenuePageViaRpc,
  listPopularNearbyViaRpc,
  listVenuesByBuildingViaRpc,
  mapTasteCardRow,
  refreshSupabaseRepositoryCache,
  refreshSupabaseRepositoryVenueDishes,
  searchDishesViaRpc,
  searchVenuesByLocationViaRpc,
  supabaseRepository,
} from "@/lib/services/supabase/supabaseRepository";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/services/supabase/client";
import { hungryPersistStorage } from "@/store/persistStorage";
import {
  assertValidMenuPhotoUpload,
  uploadImageFromUri,
  uploadPostMediaFromUri,
} from "@/lib/services/supabase/mediaUpload";
import { suggestAllergensFromIngredients } from "@/features/merchant/allergenKeywords";
import { validateMerchantProfileUpdates } from "@/features/merchant/profileValidation";
import { NO_ACCOUNT_EMAIL_MESSAGE } from "@/features/auth/accountDeletionErrors";
import { PROFILE_DISPLAY_NAME_MAX_LENGTH, isCheckViolation } from "@/features/profile/profileName";
import { validateOpeningSchedule } from "@/utils/openingSchedule";
import { REVIEW_PHOTOS_NOT_ATTACHED, createClientReviewId } from "@/features/review/reviewDraft";
import { validateMerchantPromotionInput } from "@/features/merchant/promotionValidation";
import { MERCHANT_DEEP_LINKS } from "@/features/merchant/merchantDeepLinks";
import { MERCHANT_REPLY_MAX_LENGTH } from "@/features/merchant/merchantReadiness";
import { normalizeReviewPatch, normalizeReviewTags } from "@/features/review/reviewEdit";
import { REVIEW_SEARCH_MIN_LENGTH, reviewMatchesQuery } from "@/features/review/reviewSearch";
import type {
  Bite,
  BiteDraft,
  BitesFeedPage,
  BlockUserRequest,
  BlockedUserEntry,
  HiddenPostEntry,
  BuildingDetail,
  DiscoveryLocationFeed,
  ChatConversation,
  ChatMessage,
  ChatParticipant,
  ChatSubscriptionHandlers,
  ContentReportRequest,
  ExplicitFeedbackInput,
  HungryService,
  ImplicitSignalInput,
  PortfolioMutationOptions,
  QuizAnswer,
  RankedRecommendation,
  RecommendationSlateRequest,
  SearchResult,
  Session,
  SubmitReviewInput,
  ListRecentReviewsOptions,
  RecentReviewFeedEntry,
  RecentReviewFeedPage,
  MerchantClaimStatus,
} from "@/lib/services/types";
import type {
  AIBusinessInsight,
  Checklist,
  ChecklistItem,
  CustomerInteraction,
  DietaryFlag,
  DishDetail,
  HawkerTasteTag,
  InteractionType,
  MerchantAccount,
  MerchantAnalytics,
  MerchantNotification,
  MerchantNotificationPreferences,
  MerchantOutlet,
  MerchantPromotion,
  MerchantRole,
  MerchantTeamMember,
  MerchantWeeklySummary,
  OCRDishDraft,
  PassportEventType,
  PassportProgressEvent,
  PassportStamp,
  PopularVisitorCandidate,
  PopularVisitorPin,
  Portfolio,
  PortfolioCollaborator,
  PortfolioFlag,
  PortfolioFollow,
  PortfolioItem,
  ProfileVisibility,
  PromotionStatus,
  OpeningSchedule,
  PublicMerchantProfile,
  SearchFilters,
  TasteProfile,
  TasteInteractionEvent,
  TasteInteractionType,
  TasteVector,
  VenueSummary,
  Story,
  StoryContent,
  UserStallSubmission,
  UserStallSubmissionDeliveryLink,
  UserStallSubmissionMenuItem,
  UserProfile,
  ReviewStats,
  VerificationEvidence,
  PushPreferences,
  LifecycleSnapshot,
  WelcomeBackDish,
} from "@/types/domain";
import { DEFAULT_PUSH_PREFERENCES } from "@/types/domain";

type Row = Record<string, unknown>;
type DishPresentation = {
  gallery: string[];
  dietaryFlags: DietaryFlag[];
  tasteVector?: TasteVector;
};
type MerchantActionEventInput = Parameters<
  HungryService["discovery"]["recordMerchantActionEvent"]
>[0];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const merchantAnonymousSessionId = `anon:${Date.now().toString(36)}:${Math.random()
  .toString(36)
  .slice(2, 12)}`;

const DEFAULT_AUTH_PROFILE_BASE: Omit<UserProfile, "id"> = {
  displayName: "Hungry User",
  email: "",
  profileVisibility: "public",
  tasteVector: { ...NEUTRAL_TASTE_VECTOR },
  dietaryPreferences: [],
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

const DEFAULT_GUEST_PROFILE: UserProfile = {
  ...DEFAULT_AUTH_PROFILE_BASE,
  id: "guest-user",
  displayName: "Guest",
  email: "guest@hungry.local",
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter((item): item is string => Boolean(item));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => asString(item)).filter((item): item is string => Boolean(item));
      }
    } catch {
      return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function asRecord(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function mapChecklist(row: Row): Checklist {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    name: String(row.name ?? "Untitled checklist"),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ""),
    itemCount: readEmbeddedCount(row.checklist_items),
  };
}

function mapChecklistItem(row: Row): ChecklistItem {
  return {
    id: String(row.id ?? ""),
    checklistId: String(row.checklist_id ?? row.checklistId ?? ""),
    itemType: String(row.item_type ?? row.itemType ?? "custom") as ChecklistItem["itemType"],
    dishId: asString(row.dish_id ?? row.dishId),
    stallId: asString(row.stall_id ?? row.stallId),
    customText: asString(row.custom_text ?? row.customText),
    reminderAt: asString(row.reminder_at ?? row.reminderAt),
    plannedVisitDate: asString(row.planned_visit_date ?? row.plannedVisitDate),
    triedAt: asString(row.tried_at ?? row.triedAt),
    position: Number(row.position ?? 0),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ""),
  };
}

/** Most lists one getPortfolios read returns (matches the search_portfolios cap). */
const PORTFOLIO_LIST_LIMIT = 100;

function mapPortfolio(row: Row): Portfolio {
  return {
    id: String(row.id ?? ""),
    ownerId: String(row.owner_id ?? row.ownerId ?? ""),
    name: String(row.name ?? "Untitled portfolio"),
    description: asString(row.description),
    type: String(row.type ?? "recommendation") as Portfolio["type"],
    visibility: String(row.visibility ?? "private") as Portfolio["visibility"],
    publishedAt: asString(row.published_at ?? row.publishedAt),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ""),
    itemCount: readEmbeddedCount(row.item_count ?? row.portfolio_items),
    followerCount: readEmbeddedCount(row.follower_count),
  };
}

/** Count from an RPC column (number/bigint string) or a PostgREST `rel(count)` embed. */
function readEmbeddedCount(value: unknown): number | undefined {
  if (Array.isArray(value)) return readEmbeddedCount((value[0] as Row | undefined)?.count);
  if (value === null || value === undefined || value === "") return undefined;
  const count = Number(value);
  return Number.isFinite(count) ? count : undefined;
}

function mapPortfolioItem(row: Row): PortfolioItem {
  return {
    id: String(row.id ?? ""),
    portfolioId: String(row.portfolio_id ?? row.portfolioId ?? ""),
    itemType: String(row.item_type ?? row.itemType ?? "dish") as PortfolioItem["itemType"],
    dishId: asString(row.dish_id ?? row.dishId),
    stallId: asString(row.stall_id ?? row.stallId),
    score: asNumber(row.score),
    publicNotes: asString(row.public_notes ?? row.publicNotes),
    privateNotes: asString(row.private_notes ?? row.privateNotes),
    position: Number(row.position ?? 0),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ""),
  };
}

/**
 * Readable portfolio_items columns. private_notes is not granted to clients
 * (20261019111000); owners and collaborators read it via get_portfolio_private_notes.
 */
const PORTFOLIO_ITEM_COLUMNS =
  "id,portfolio_id,item_type,dish_id,stall_id,score,public_notes,position,created_at,updated_at";

async function attachPortfolioPrivateNotes(
  client: SupabaseClient,
  portfolioId: string,
  items: PortfolioItem[],
): Promise<PortfolioItem[]> {
  if (!items.length) return items;
  const { data, error } = await client.rpc("get_portfolio_private_notes", {
    p_portfolio_id: portfolioId,
  });
  // Viewers who are not the owner or a collaborator get no rows; on error show no notes.
  if (error || !Array.isArray(data)) return items;
  const notesById = new Map(
    (data as Row[]).map((row) => [String(row.item_id ?? ""), asString(row.private_notes)]),
  );
  return items.map((item) =>
    notesById.has(item.id) ? { ...item, privateNotes: notesById.get(item.id) } : item,
  );
}

function mapPortfolioCollaborator(row: Row): PortfolioCollaborator {
  return {
    id: String(row.id ?? ""),
    portfolioId: String(row.portfolio_id ?? row.portfolioId ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    role: String(row.role ?? "viewer") as PortfolioCollaborator["role"],
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    displayName: asString(row.display_name),
    avatarUrl: asString(row.avatar_url),
  };
}

function mapPortfolioFollow(row: Row): PortfolioFollow {
  return {
    id: String(row.id ?? ""),
    portfolioId: String(row.portfolio_id ?? row.portfolioId ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
  };
}

function mapPortfolioFlag(row: Row): PortfolioFlag {
  return {
    id: String(row.id ?? ""),
    portfolioId: String(row.portfolio_id ?? row.portfolioId ?? ""),
    reporterId: String(row.reporter_id ?? row.reporterId ?? ""),
    reason: String(row.reason ?? "other") as PortfolioFlag["reason"],
    details: asString(row.details),
    status: String(row.status ?? "pending") as PortfolioFlag["status"],
    reviewedBy: asString(row.reviewed_by ?? row.reviewedBy),
    reviewedAt: asString(row.reviewed_at ?? row.reviewedAt),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
  };
}

function mapPassportStamp(row: Row): PassportStamp {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    categoryId: String(row.category_id ?? row.categoryId ?? ""),
    level: Number(row.level ?? 0),
    dishesTriedCount: Number(row.dishes_tried_count ?? row.dishesTriedCount ?? 0),
    stallsVisitedCount: Number(row.stalls_visited_count ?? row.stallsVisitedCount ?? 0),
    stallsSubmittedCount: Number(row.stalls_submitted_count ?? row.stallsSubmittedCount ?? 0),
    reviewsPostedCount: Number(row.reviews_posted_count ?? row.reviewsPostedCount ?? 0),
    photosPostedCount: Number(row.photos_posted_count ?? row.photosPostedCount ?? 0),
    portfolioItemsAdded: Number(row.portfolio_items_added ?? row.portfolioItemsAdded ?? 0),
    publicPortfoliosPublished: Number(
      row.public_portfolios_published ?? row.publicPortfoliosPublished ?? 0,
    ),
    trailsCompleted: Number(row.trails_completed ?? row.trailsCompleted ?? 0),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ""),
  };
}

function mapPassportProgressEvent(row: Row): PassportProgressEvent {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    categoryId: String(row.category_id ?? row.categoryId ?? ""),
    eventType: String(
      row.event_type ?? row.eventType ?? "portfolio_item_added",
    ) as PassportProgressEvent["eventType"],
    referenceId:
      row.reference_id || row.referenceId ? String(row.reference_id ?? row.referenceId) : undefined,
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
  };
}

function mapSubmissionMenuItems(value: unknown): UserStallSubmissionMenuItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = asRecord(item);
      const name = asString(row.name)?.trim();
      if (!name) return null;
      const menuItem: UserStallSubmissionMenuItem = { name };
      const priceRange = asString(row.priceRange ?? row.price_range);
      const notes = asString(row.notes);
      if (priceRange) menuItem.priceRange = priceRange;
      if (notes) menuItem.notes = notes;
      return menuItem;
    })
    .filter((item): item is UserStallSubmissionMenuItem => item !== null);
}

function mapSubmissionDeliveryLinks(value: unknown): UserStallSubmissionDeliveryLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = asRecord(item);
      const label = asString(row.label)?.trim();
      const url = asString(row.url)?.trim();
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((item): item is UserStallSubmissionDeliveryLink => item !== null);
}

type PresignedSubmissionUrls = ReadonlyMap<string, string>;

/** Signed URLs for every photo in a list of submissions: one signing call per bucket, not per photo. */
async function presignSubmissionPhotos(
  client: SupabaseClient,
  rows: Row[],
): Promise<PresignedSubmissionUrls> {
  const pathsByBucket = new Map<string, string[]>();
  const add = (bucket: string | undefined, path: string | undefined) => {
    if (!bucket || !path) return;
    pathsByBucket.set(bucket, [...(pathsByBucket.get(bucket) ?? []), path]);
  };
  for (const row of rows) {
    add(asString(row.image_storage_bucket), asString(row.image_storage_path));
    for (const item of Array.isArray(row.gallery_images) ? row.gallery_images : []) {
      const photo = asRecord(item);
      add(
        asString(photo.bucket) ?? asString(photo.storageBucket),
        asString(photo.path) ?? asString(photo.storagePath),
      );
    }
  }
  const signed = new Map<string, string>();
  await Promise.all(
    [...pathsByBucket].map(async ([bucket, paths]) => {
      const urls = await createSignedStorageUrls(client, bucket, paths);
      urls.forEach((url, path) => signed.set(`${bucket}/${path}`, url));
    }),
  );
  return signed;
}

function mapSubmissionGalleryUrls(
  value: unknown,
  fallbackUrl: string,
  presigned: PresignedSubmissionUrls,
): string[] {
  if (!Array.isArray(value)) return fallbackUrl ? [fallbackUrl] : [];
  const urls = value.map((item) => {
    if (!item || typeof item !== "object") return undefined;
    const row = item as Row;
    const bucket = asString(row.bucket) ?? asString(row.storageBucket);
    const path = asString(row.path) ?? asString(row.storagePath);
    if (bucket && path) {
      return presigned.get(`${bucket}/${path}`) ?? asString(row.url);
    }
    return asString(row.url);
  });
  const cleaned = urls.filter((url): url is string => Boolean(url));
  return cleaned.length > 0 ? cleaned : fallbackUrl ? [fallbackUrl] : [];
}

async function mapUserStallSubmission(
  client: SupabaseClient,
  row: Row,
  presignedUrls?: PresignedSubmissionUrls,
): Promise<UserStallSubmission> {
  // A list passes URLs signed together; a single row signs its own photos in one call per bucket.
  const presigned = presignedUrls ?? (await presignSubmissionPhotos(client, [row]));
  const bucket = asString(row.image_storage_bucket);
  const path = asString(row.image_storage_path);
  const signedUrl = bucket && path ? presigned.get(`${bucket}/${path}`) : undefined;
  const imageUrl = signedUrl ?? asString(row.image_url) ?? "";
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    stallName: asString(row.stall_name) ?? "",
    imageUrl,
    galleryImageUrls: mapSubmissionGalleryUrls(row.gallery_images, imageUrl, presigned),
    imageStorageBucket: bucket,
    imageStoragePath: path,
    imageMimeType: asString(row.image_mime_type),
    sourceUrl: asString(row.source_url),
    buildingName: asString(row.building_name),
    area: asString(row.area),
    address: asString(row.address),
    postalCode: asString(row.postal_code),
    unitNumber: asString(row.unit_number),
    floor: asString(row.floor),
    operatingHours: asString(row.operating_hours),
    menuItems: mapSubmissionMenuItems(row.menu_items),
    deliveryLinks: mapSubmissionDeliveryLinks(row.delivery_links),
    notes: asString(row.notes),
    status: String(row.status ?? "pending") as UserStallSubmission["status"],
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function getDisplayNameFromUserMetadata(metadata: unknown): string | undefined {
  const userMetadata = asRecord(metadata);
  const metadataName =
    asString(userMetadata.name) ??
    asString(userMetadata.full_name) ??
    asString(userMetadata.given_name) ??
    asString(userMetadata.family_name) ??
    asString(userMetadata.nickname) ??
    asString(userMetadata.preferred_username) ??
    asString(userMetadata.username);
  if (metadataName) return metadataName;

  const structuredName = asRecord(userMetadata.name);
  const firstName = asString(structuredName.first_name) ?? asString(structuredName.givenName);
  const lastName = asString(structuredName.last_name) ?? asString(structuredName.familyName);
  if (firstName && lastName) return `${firstName} ${lastName}`.trim();
  if (firstName) return firstName;
  if (lastName) return lastName;

  return undefined;
}

function asRowArray(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.map((item) => asRecord(item)).filter((item) => Object.keys(item).length > 0)
    : [];
}

function isLocalUri(value: string): boolean {
  return value.startsWith("file://") || value.startsWith("content://") || value.startsWith("/");
}

function assertLocalUserMediaUri(value: string, label: string): void {
  if (!isLocalUri(value)) {
    throw new Error(`${label} must be uploaded from a local device file.`);
  }
}

function sanitizeStorageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-") || "asset";
}

function extensionFromUri(uri: string): string {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension;
  return "jpg";
}

function toTasteVector(row?: Row): TasteVector {
  const vector = Array.isArray(row?.vector) ? (row?.vector as unknown[]) : [];
  if (vector.length >= 6) {
    return {
      sweet: asNumber(vector[0]) ?? NEUTRAL_TASTE_VECTOR.sweet,
      spicy: asNumber(vector[1]) ?? NEUTRAL_TASTE_VECTOR.spicy,
      sour: asNumber(vector[2]) ?? NEUTRAL_TASTE_VECTOR.sour,
      salty: asNumber(vector[3]) ?? NEUTRAL_TASTE_VECTOR.salty,
      rich: asNumber(vector[4]) ?? NEUTRAL_TASTE_VECTOR.rich,
      aromatic: asNumber(vector[5]) ?? NEUTRAL_TASTE_VECTOR.aromatic,
    };
  }
  return {
    sweet: asNumber(row?.sweet) ?? NEUTRAL_TASTE_VECTOR.sweet,
    spicy: asNumber(row?.spicy) ?? NEUTRAL_TASTE_VECTOR.spicy,
    sour: asNumber(row?.sour) ?? NEUTRAL_TASTE_VECTOR.sour,
    salty: asNumber(row?.salty) ?? NEUTRAL_TASTE_VECTOR.salty,
    rich: asNumber(row?.rich) ?? NEUTRAL_TASTE_VECTOR.rich,
    aromatic: asNumber(row?.aromatic) ?? NEUTRAL_TASTE_VECTOR.aromatic,
  };
}

function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase client is not configured.");
  }
  return client;
}

// The Expo push token this device last registered, so sign-out can unbind it
// from the account (otherwise the next person on the phone gets the alerts).
const REGISTERED_PUSH_TOKEN_KEY = "hungry-push-token-v1";

async function rememberRegisteredPushToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await hungryPersistStorage?.setItem(REGISTERED_PUSH_TOKEN_KEY, {
        state: { token },
        version: 0,
      });
    } else {
      await hungryPersistStorage?.removeItem(REGISTERED_PUSH_TOKEN_KEY);
    }
  } catch {
    // Storage is best effort; the server re-binds the token on next registration.
  }
}

async function unregisterStoredPushToken(client: SupabaseClient): Promise<void> {
  const stored = await hungryPersistStorage?.getItem(REGISTERED_PUSH_TOKEN_KEY);
  const token = (stored?.state as { token?: unknown } | undefined)?.token;
  if (typeof token !== "string" || !token) return;
  const { error } = await client.rpc("unregister_push_token", { p_token: token });
  if (error) throw error;
  await rememberRegisteredPushToken(null);
}

function portfolioEditConflictError(): Error {
  return new Error(
    "This portfolio changed elsewhere. Review the latest version before saving again.",
  );
}

async function assertSupabasePortfolioVersion(
  client: SupabaseClient,
  portfolioId: string | undefined,
  options?: PortfolioMutationOptions,
): Promise<void> {
  if (!portfolioId || !options?.expectedUpdatedAt) return;
  const { data, error } = await client
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("updated_at", options.expectedUpdatedAt)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw portfolioEditConflictError();
}

async function getCurrentSupabaseUserId(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const session = await client.auth.getSession();
    return session.data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function ensureCurrentUserProfileRow(
  client: SupabaseClient,
  authenticatedUser?: SupabaseAuthSession["user"] | null,
): Promise<void> {
  let user = authenticatedUser ?? null;
  if (!user) {
    try {
      const { data: sessionData } = await client.auth.getSession();
      user = sessionData.session?.user ?? null;
    } catch {
      return;
    }
  }
  if (!user?.id) return;

  const providerDisplayName = getDisplayNameFromUserMetadata(user.user_metadata);
  const existingProfile = await client
    .from("user_profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const existingDisplayName = asString(asRecord(existingProfile.data).display_name);
  const payload: Row = {
    id: user.id,
    email: user.email ?? null,
  };
  if (!existingDisplayName && providerDisplayName) {
    // user_profiles caps display names at 40 characters.
    payload.display_name = providerDisplayName.slice(0, PROFILE_DISPLAY_NAME_MAX_LENGTH).trim();
  }

  let { error } = await client.from("user_profiles").upsert(payload, { onConflict: "id" });
  if (error && payload.display_name !== undefined && isCheckViolation(error)) {
    // The server refused the provider's name (reserved or filtered): sign in without a name.
    delete payload.display_name;
    ({ error } = await client.from("user_profiles").upsert(payload, { onConflict: "id" }));
  }
  if (error) {
    throw error;
  }
}

const LIFECYCLE_STATES = new Set<LifecycleSnapshot["state"]>([
  "new",
  "current",
  "reactivated",
  "resurrected",
  "at_risk_weekly",
  "at_risk_monthly",
  "dormant",
]);

function mapLifecycleSnapshot(data: unknown): LifecycleSnapshot | null {
  const row = (data ?? {}) as Record<string, unknown>;
  const state = row.state as LifecycleSnapshot["state"];
  if (!LIFECYCLE_STATES.has(state)) return null;
  return {
    state,
    previousActiveDate: typeof row.previousActiveDate === "string" ? row.previousActiveDate : null,
    daysSincePrevious: typeof row.daysSincePrevious === "number" ? row.daysSincePrevious : null,
  };
}

/** A stall submission whose saved row could not be found after the write. */
export class StallSubmissionUnconfirmedError extends Error {
  constructor() {
    super(
      "We couldn't confirm your submission was saved. Check My submissions before trying again.",
    );
    this.name = "StallSubmissionUnconfirmedError";
  }
}

function mapPushPreferencesRow(row: {
  stall_updates: boolean;
  weekly_picks: boolean;
  mealtime_suggestions: boolean;
  social_activity: boolean;
  quiet_start_hour: number;
  quiet_end_hour: number;
  weekly_cap: number;
}): PushPreferences {
  return {
    stallUpdates: row.stall_updates,
    weeklyPicks: row.weekly_picks,
    mealtimeSuggestions: row.mealtime_suggestions,
    socialActivity: row.social_activity,
    quietStartHour: row.quiet_start_hour,
    quietEndHour: row.quiet_end_hour,
    weeklyCap: row.weekly_cap,
  };
}

async function fetchFavouriteDishIdsForUser(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("user_favourite_dishes")
    .select("dish_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return (data as Row[])
    .map((row) => asString(row.dish_id))
    .filter((dishId): dishId is string => Boolean(dishId));
}

async function getSessionEmailForUser(
  client: SupabaseClient,
  userId: string,
): Promise<string | undefined> {
  try {
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    return user?.id === userId ? (user.email ?? undefined) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchUserProfile(client: SupabaseClient, userId: string, email?: string) {
  const { data } = await client.from("user_profiles").select("*").eq("id", userId).maybeSingle();
  const { data: privacyData } = await client
    .from("privacy_settings")
    .select("account_visibility")
    .eq("user_id", userId)
    .maybeSingle();
  const row = (data ?? {}) as Row;
  const privacyRow = (privacyData ?? {}) as Row;
  // The sign-in (auth) address is the source of truth; user_profiles.email is only a fallback
  // because it can be null (OAuth/new sign-ups) or stale.
  const resolvedEmail =
    email ?? (await getSessionEmailForUser(client, userId)) ?? asString(row.email);
  const favouriteDishIds = await fetchFavouriteDishIdsForUser(client, userId);
  const reviewedDishIds = asStringArray(row.reviewed_dish_ids);
  const accountVisibility = asString(privacyRow.account_visibility);
  return {
    ...DEFAULT_AUTH_PROFILE_BASE,
    id: userId,
    displayName:
      asString(row.display_name) ??
      asString(row.displayName) ??
      DEFAULT_AUTH_PROFILE_BASE.displayName,
    email: resolvedEmail ?? "",
    avatarUrl: asString(row.avatar_url),
    bio: asString(row.bio),
    createdAt: asString(row.created_at),
    profileVisibility: accountVisibility === "private" ? "private" : "public",
    tasteVector: toTasteVector(row),
    tasteProfile: (row.taste_profile as TasteProfile | undefined) ?? undefined,
    dietaryPreferences: asStringArray(row.dietary_preferences) as DietaryFlag[],
    maxDishBudget: asNumber(row.max_dish_budget),
    favouriteDishIds,
    reviewedDishIds,
    stats: {
      dishesReviewed: asNumber(row.dishes_reviewed) ?? reviewedDishIds.length,
      stallsVisited: asNumber(row.stalls_visited) ?? 0,
      // The user_profiles column is never written, so it reads 0; count the real saved dishes.
      favouritesCount: favouriteDishIds.length,
      followersCount: asNumber(row.followers_count) ?? 0,
      followingCount: asNumber(row.following_count) ?? 0,
    },
  } satisfies UserProfile;
}

async function getCurrentUserProfileOrGuest(): Promise<UserProfile> {
  const client = getSupabaseClient();
  if (!client) return DEFAULT_GUEST_PROFILE;
  const userId = await getCurrentSupabaseUserId();
  if (!userId) return DEFAULT_GUEST_PROFILE;
  return fetchUserProfile(client, userId);
}

/** Reviews per profile-list read; the Supabase read has no photos, so a page is cheap. */
const USER_REVIEWS_PAGE_SIZE = 200;
/** Saved posts read for Saved > Posts (newest save first). */
const SAVED_POSTS_LIMIT = 200;

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function clampRadiusMeters(radiusMeters?: number): number {
  if (typeof radiusMeters !== "number" || !Number.isFinite(radiusMeters))
    return Number.MAX_SAFE_INTEGER;
  return radiusMeters > 0 ? radiusMeters : Number.MAX_SAFE_INTEGER;
}

function getFallbackDiscoveryFeed(request: {
  areaName?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  limit?: number;
}): DiscoveryLocationFeed {
  const limit = request.limit ?? 20;
  const fallbackFilters: SearchFilters = {
    query: "",
    categories: [],
    dietaryFlags: [],
    tasteValues: NEUTRAL_TASTE_VECTOR,
    radius: clampRadiusMeters(request.radiusMeters),
    latitude: request.lat,
    longitude: request.lng,
    areaName: request.areaName,
    openOnly: false,
  };

  const fallbackDishes = supabaseRepository
    .searchDishes(fallbackFilters, NEUTRAL_TASTE_VECTOR)
    .slice(0, limit);

  const venueById = new Map<string, VenueSummary>();
  const discoveryVenues: VenueSummary[] = [];

  for (const dish of fallbackDishes) {
    const venue = supabaseRepository.getVenueById(dish.venueId);
    if (venue && !venueById.has(venue.id)) {
      venueById.set(venue.id, venue);
      discoveryVenues.push(venue);
    }
  }

  return {
    venues: discoveryVenues,
    results: fallbackDishes.map((dish) => ({
      dish,
      score: dish.rating / 5,
    })),
    isFallback: true,
  };
}

function cloneStory(story: Story): Story {
  return {
    ...story,
    content: { ...story.content },
    interaction: { ...story.interaction },
  };
}

function cloneStoryList(stories: Story[]): Story[] {
  return stories.map((story) => cloneStory(story));
}

function sanitizeStoryTimestamp(story: Story): Story {
  const createdAt = new Date(story.createdAt).getTime();
  if (Number.isFinite(createdAt)) return story;
  return {
    ...story,
    createdAt: new Date().toISOString(),
  };
}

function isFreshStory(story: Story): boolean {
  const createdAt = new Date(story.createdAt).getTime();
  if (!Number.isFinite(createdAt)) return true;
  return Date.now() - createdAt < STORY_TTL_MS;
}

function buildStorySeed(profile: {
  id: string;
  displayName: string;
  avatarUrl?: string;
  profileVisibility?: ProfileVisibility;
}): Story[] {
  const now = Date.now();
  return [
    {
      id: `s_${now}`,
      displayName: profile.displayName,
      authorId: profile.id,
      authorProfileVisibility: profile.profileVisibility,
      avatarUrl: profile.avatarUrl,
      hasUnseen: false,
      isStall: false,
      isOwn: true,
      content: {
        type: "image",
        url: "https://i.pravatar.cc/150?u=me",
      },
      createdAt: new Date(now).toISOString(),
      interaction: { liked: false, saved: false, likeCount: 0, commentCount: 0, shareCount: 0 },
    },
    {
      id: `s_${now + 1}`,
      displayName: "Tian Tian",
      authorId: "story-author-tian-tian",
      authorProfileVisibility: "public",
      avatarUrl:
        "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=150&h=150&fit=crop",
      hasUnseen: true,
      isStall: true,
      content: {
        type: "image",
        url: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800&q=80",
      },
      createdAt: new Date(now - 3_600_000).toISOString(),
      interaction: { liked: false, saved: false, likeCount: 0, commentCount: 0, shareCount: 0 },
    },
    {
      id: `s_${now + 2}`,
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
      createdAt: new Date(now - 7_200_000).toISOString(),
      interaction: { liked: false, saved: false, likeCount: 0, commentCount: 0, shareCount: 0 },
    },
  ];
}

let supabaseStoryCache: Story[] | null = null;

async function getStoryCache(): Promise<Story[]> {
  if (supabaseStoryCache && supabaseStoryCache.length > 0) {
    return cloneStoryList(supabaseStoryCache.map(sanitizeStoryTimestamp).filter(isFreshStory));
  }
  const profile = await getCurrentUserProfileOrGuest();
  supabaseStoryCache = buildStorySeed(profile);
  return cloneStoryList(supabaseStoryCache.map(sanitizeStoryTimestamp).filter(isFreshStory));
}

function persistStoryCache(stories: Story[]) {
  supabaseStoryCache = stories.map(sanitizeStoryTimestamp);
}

async function toAppSession(client: SupabaseClient): Promise<Session | null> {
  let data;
  try {
    ({ data } = await client.auth.getSession());
  } catch {
    return null;
  }
  const session = data.session;
  if (!session?.user) return null;
  const hydrateProfile = () =>
    ensureCurrentUserProfileRow(client, session.user).then(() =>
      fetchUserProfile(client, session.user.id, session.user.email ?? undefined),
    );
  try {
    return toAppSessionFromAuthSession(session, await hydrateProfile());
  } catch {
    // Authentication already succeeded and the SIGNED_IN listener has let the user in, so a
    // profile read that fails (a network blip) must not surface as "Sign in failed". Return
    // the session with a provisional profile and finish hydrating in the background, as the
    // OAuth path does.
    const profileReady = hydrateProfile();
    // Callers that ignore profileReady (a session refresh) must not leave an unhandled rejection.
    profileReady.catch(() => undefined);
    return toAppSessionFromAuthSession(
      session,
      provisionalProfileFromAuthSession(session),
      profileReady,
    );
  }
}

function provisionalProfileFromAuthSession(session: SupabaseAuthSession): UserProfile {
  return {
    ...DEFAULT_AUTH_PROFILE_BASE,
    id: session.user.id,
    displayName:
      getDisplayNameFromUserMetadata(session.user.user_metadata) ??
      DEFAULT_AUTH_PROFILE_BASE.displayName,
    email: session.user.email ?? "",
  };
}

function toAppSessionFromAuthSession(
  session: SupabaseAuthSession,
  profile: UserProfile,
  profileReady?: Promise<UserProfile>,
): Session {
  return {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: new Date(session.expires_at ? session.expires_at * 1000 : Date.now()).toISOString(),
    profile,
    profileReady,
  };
}

/** Review photos uploaded at once; more in flight starves slow mobile links. */
const REVIEW_PHOTO_UPLOAD_CONCURRENCY = 3;
/** Longest edge of the grid thumbnail uploaded next to each review photo. */
const REVIEW_THUMBNAIL_EDGE_PX = 480;

/** Every storage object (photo and thumbnail) in a list of uploaded review photo rows. */
function uploadedObjectPaths(rows: (Row | undefined)[]): (string | undefined)[] {
  return rows.flatMap((row) => (row ? [asString(row.storage_path), asString(row.thumb_path)] : []));
}

/** Best-effort removal of objects this client just uploaded; a failure is left to the orphan purge. */
async function removeUploadedObjects(
  client: SupabaseClient,
  bucket: string,
  paths: (string | undefined)[],
): Promise<void> {
  const uploaded = paths.filter((path): path is string => Boolean(path));
  if (uploaded.length === 0) return;
  try {
    await client.storage.from(bucket).remove(uploaded);
  } catch {
    // Offline or refused: the scheduled purge removes unreferenced objects after 24 hours.
  }
}

async function uploadReviewPhotos(
  client: SupabaseClient,
  userId: string,
  reviewId: string,
  photos: string[],
): Promise<Row[]> {
  // Uploads never overwrite, so a retried submission needs fresh object paths.
  const attempt = Date.now().toString(36);
  const jobs = photos
    .map((uri, index) => ({ uri, index }))
    .filter((job): job is { uri: string; index: number } => Boolean(job.uri));
  jobs.forEach(({ uri }) => {
    if (!isLocalUri(uri)) {
      throw new Error("Review photos must be uploaded from local device files.");
    }
  });
  const uploaded: (Row | undefined)[] = new Array(jobs.length);
  let nextJob = 0;
  const worker = async () => {
    while (nextJob < jobs.length) {
      const jobIndex = nextJob;
      nextJob += 1;
      const { uri, index } = jobs[jobIndex]!;
      const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${reviewId}/photo-${index}-${attempt}.${extension}`;
      const asset = await uploadImageFromUri({
        client,
        bucket: "review-media",
        path,
        uri,
      });
      // A small copy for the grid tiles. Best effort: without it the tile loads the full photo.
      let thumbPath: string | undefined;
      try {
        thumbPath = (
          await uploadImageFromUri({
            client,
            bucket: "review-media",
            path: `${userId}/${reviewId}/photo-${index}-${attempt}.thumb.${extension}`,
            uri,
            maxEdgePx: REVIEW_THUMBNAIL_EDGE_PX,
          })
        ).path;
      } catch {
        thumbPath = undefined;
      }
      uploaded[jobIndex] = {
        url: asset.path,
        storage_bucket: "review-media",
        storage_path: asset.path,
        thumb_path: thumbPath,
      };
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(REVIEW_PHOTO_UPLOAD_CONCURRENCY, jobs.length) }, worker),
    );
  } catch (error) {
    // One photo failed: the ones already uploaded would never be attached to a review.
    await removeUploadedObjects(client, "review-media", uploadedObjectPaths(uploaded));
    throw error;
  }
  // Keep the picked order for sort_order.
  return uploaded.filter((row): row is Row => Boolean(row));
}

/** Text the account-deletion worker leaves on a deleted account's kept review (rating only). */
export const DELETED_ACCOUNT_REVIEW_TEXT = "[deleted]";

function isDeletedAccountReviewRow(row: Row): boolean {
  return !asString(row.user_id) && asString(row.text) === DELETED_ACCOUNT_REVIEW_TEXT;
}

/**
 * Signed URLs for review-media paths in one request. A URL already signed for a path is reused,
 * so refetching a feed does not re-download its images.
 */
async function signReviewMediaPaths(
  client: SupabaseClient,
  paths: (string | undefined)[],
): Promise<Map<string, string>> {
  const wanted = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  const unsignedPaths = wanted.filter((path) => !cachedSignedMediaUrl("review-media", path));
  const freshlySigned = await createSignedStorageUrls(client, "review-media", unsignedPaths);
  freshlySigned.forEach((url, path) => rememberSignedMediaUrl("review-media", path, url));
  const signedUrlByPath = new Map<string, string>();
  for (const path of wanted) {
    const url = cachedSignedMediaUrl("review-media", path);
    if (url) signedUrlByPath.set(path, url);
  }
  return signedUrlByPath;
}

/** Exported for tests. Batches photo and author lookups for one page of review rows. */
export async function mapSupabaseReviewRows(
  client: SupabaseClient,
  rows: Row[],
  options: { includePhotos?: boolean } = {},
): Promise<DishDetail["reviews"]> {
  // A deleted account's kept review is a bare rating: its photos were removed from storage.
  const reviewIds = rows
    .filter((row) => !isDeletedAccountReviewRow(row))
    .map((row) => asString(row.id))
    .filter((id): id is string => Boolean(id));
  const userIds = rows
    .map((row) => asString(row.user_id))
    .filter((id): id is string => Boolean(id));
  const photosByReviewId = new Map<string, string[]>();
  const namesByUserId = new Map<string, string>();
  const avatarsByUserId = new Map<string, string>();

  if (options.includePhotos !== false && reviewIds.length > 0) {
    const { data: photoRows } = await client
      .from("review_photos")
      .select("review_id,url,storage_bucket,storage_path,sort_order")
      .in("review_id", reviewIds)
      .order("sort_order", { ascending: true });

    if (Array.isArray(photoRows)) {
      // One signing request for the whole page instead of one per photo, and a URL already
      // signed for a path is reused so refetching the feed does not re-download its images.
      const signedUrlByPath = await signReviewMediaPaths(
        client,
        (photoRows as Row[])
          .filter(
            (photoRow) => (asString(photoRow.storage_bucket) || "review-media") === "review-media",
          )
          .map((photoRow) => asString(photoRow.storage_path)),
      );
      for (const photoRow of photoRows as Row[]) {
        const reviewId = asString(photoRow.review_id);
        if (!reviewId) continue;
        const bucket = asString(photoRow.storage_bucket) || "review-media";
        const path = asString(photoRow.storage_path);
        const legacyUrl = asString(photoRow.url);
        const displayUrl =
          path && bucket === "review-media" ? (signedUrlByPath.get(path) ?? legacyUrl) : legacyUrl;
        if (!displayUrl) continue;
        photosByReviewId.set(reviewId, [...(photosByReviewId.get(reviewId) ?? []), displayUrl]);
      }
    }
  }

  if (userIds.length > 0) {
    const { data: profileRows } = await client
      .from("public_profiles")
      .select("id,display_name,avatar_url")
      .in("id", Array.from(new Set(userIds)));

    if (Array.isArray(profileRows)) {
      (profileRows as Row[]).forEach((profileRow) => {
        const userId = asString(profileRow.id);
        const displayName = asString(profileRow.display_name);
        const avatarUrl = asString(profileRow.avatar_url);
        if (!userId) return;
        if (displayName) namesByUserId.set(userId, displayName);
        if (avatarUrl) avatarsByUserId.set(userId, avatarUrl);
      });
    }
  }

  return rows.map((row) => {
    const id = asString(row.id) ?? `${Date.now()}`;
    const userId = asString(row.user_id);
    const fromDeletedAccount = isDeletedAccountReviewRow(row);
    return {
      id,
      dishId: asString(row.dish_id),
      venueId: asString(row.venue_id),
      authorId: userId,
      authorName: fromDeletedAccount
        ? "Deleted account"
        : ((userId ? namesByUserId.get(userId) : undefined) ??
          asString(row.author_name) ??
          "Hungry User"),
      authorAvatarUrl: (userId ? avatarsByUserId.get(userId) : undefined) ?? undefined,
      rating: asNumber(row.rating) ?? 0,
      createdAt: asString(row.created_at) ?? new Date().toISOString(),
      text: fromDeletedAccount ? "" : (asString(row.text) ?? ""),
      tags: fromDeletedAccount ? [] : asStringArray(row.tags),
      wouldRecommend: asBoolean(row.would_recommend) ?? true,
      photos: fromDeletedAccount ? [] : (photosByReviewId.get(id) ?? []),
      helpfulCount: asNumber(row.helpful_count),
      editedAt: asString(row.edited_at),
      merchantReply: asString(row.merchant_reply_text)
        ? {
            text: asString(row.merchant_reply_text) ?? "",
            repliedAt: asString(row.merchant_replied_at) ?? asString(row.created_at) ?? "",
          }
        : undefined,
    };
  });
}

const AVATAR_UPLOAD_MAX_EDGE_PX = 512;

/** Moderation state of the viewer's own reviews (hidden or removed after reports), when any. */
async function attachOwnReviewModeration(
  client: SupabaseClient,
  reviews: DishDetail["reviews"],
  viewerId: string | null,
): Promise<DishDetail["reviews"]> {
  const ownIds = viewerId
    ? reviews.filter((review) => review.authorId === viewerId).map((review) => review.id)
    : [];
  if (ownIds.length === 0) return reviews;
  const { data, error } = await client.rpc("get_my_review_moderation_states", {
    p_review_ids: ownIds,
  });
  // A backend without the RPC simply shows no notice.
  if (error || !Array.isArray(data)) return reviews;
  const stateByReviewId = new Map<string, "hidden" | "removed">();
  for (const row of data as Row[]) {
    const reviewId = asString(row.review_id);
    const state = asString(row.state);
    if (reviewId && (state === "hidden" || state === "removed")) {
      stateByReviewId.set(reviewId, state);
    }
  }
  if (stateByReviewId.size === 0) return reviews;
  return reviews.map((review) => {
    const moderationState = stateByReviewId.get(review.id);
    return moderationState ? { ...review, moderationState } : review;
  });
}

const REVIEW_FEED_COLUMNS =
  "id,user_id,dish_id,venue_id,author_name,rating,created_at,text,tags,would_recommend,merchant_reply_text,merchant_replied_at,helpful_count,edited_at";

/** Feed entries for raw review rows. Reviews of a dish the viewer cannot read are dropped. */
async function buildRecentReviewEntries(
  client: SupabaseClient,
  rows: Row[],
): Promise<RecentReviewFeedEntry[]> {
  if (rows.length === 0) return [];

  const dishIds = Array.from(
    new Set(rows.map((row) => asString(row.dish_id)).filter((id): id is string => !!id)),
  );
  const { data: dishRows, error: dishError } = await client
    .from("dishes")
    .select("id,name,venue_id")
    .in("id", dishIds);
  if (dishError) throw dishError;
  const dishById = new Map<string, { name: string; venueId?: string }>();
  for (const dishRow of (Array.isArray(dishRows) ? dishRows : []) as Row[]) {
    const id = asString(dishRow.id);
    if (!id) continue;
    dishById.set(id, {
      name: asString(dishRow.name) ?? "Dish",
      venueId: asString(dishRow.venue_id),
    });
  }

  const venueIds = Array.from(
    new Set(
      [
        ...rows.map((row) => asString(row.venue_id)),
        ...Array.from(dishById.values()).map((dish) => dish.venueId),
      ].filter((id): id is string => !!id),
    ),
  );
  const venueNameById = new Map<string, string>();
  if (venueIds.length > 0) {
    const { data: venueRows } = await client.from("venues").select("id,name").in("id", venueIds);
    for (const venueRow of (Array.isArray(venueRows) ? venueRows : []) as Row[]) {
      const id = asString(venueRow.id);
      const name = asString(venueRow.name);
      if (id && name) venueNameById.set(id, name);
    }
  }

  // Dish and stall pages show review photos too, so every read signs them.
  const viewerId = await getCurrentSupabaseUserId();
  const reviews = await attachOwnReviewModeration(
    client,
    await mapSupabaseReviewRows(client, rows, { includePhotos: true }),
    viewerId,
  );
  // The viewer's own helpful votes on this page (RLS returns only their rows).
  const helpfulReviewIds = new Set<string>();
  if (viewerId) {
    const { data: voteRows } = await client
      .from("review_helpful_votes")
      .select("review_id")
      .eq("user_id", viewerId)
      .in(
        "review_id",
        reviews.map((review) => review.id),
      );
    for (const voteRow of (Array.isArray(voteRows) ? voteRows : []) as Row[]) {
      const reviewId = asString(voteRow.review_id);
      if (reviewId) helpfulReviewIds.add(reviewId);
    }
  }
  return reviews.flatMap((review): RecentReviewFeedEntry[] => {
    const dish = review.dishId ? dishById.get(review.dishId) : undefined;
    // Reviews of dishes the catalog cannot display are skipped.
    if (!review.dishId || !dish) return [];
    const venueId = review.venueId ?? dish.venueId ?? "";
    return [
      {
        review: { ...review, viewerFoundHelpful: helpfulReviewIds.has(review.id) },
        dishId: review.dishId,
        dishName: dish.name,
        venueId,
        venueName: venueNameById.get(venueId) ?? "",
      },
    ];
  });
}

/**
 * Publishes a review by writing the tables directly (a backend without submit_review). Not one
 * transaction: the review row can exist for a moment without its photos.
 */
async function submitReviewWithoutRpc(
  client: SupabaseClient,
  userId: string,
  reviewRow: Row,
  uploadedPhotos: Row[],
): Promise<void> {
  const reviewId = asString(reviewRow.id) ?? "";
  const discardUploadedPhotos = () =>
    removeUploadedObjects(client, "review-media", uploadedObjectPaths(uploadedPhotos));

  const { data: existing, error: existingError } = await client
    .from("reviews")
    .select("id")
    .eq("id", reviewId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) {
    await discardUploadedPhotos();
    throw existingError;
  }
  const isResumedSubmission = Boolean(asString(existing?.id));

  try {
    if (isResumedSubmission) {
      // Keep any edits made between attempts.
      const { error: updateError } = await client
        .from("reviews")
        .update({
          rating: reviewRow.rating,
          text: reviewRow.text,
          tags: reviewRow.tags,
          would_recommend: reviewRow.would_recommend,
        })
        .eq("id", reviewId)
        .eq("user_id", userId);
      if (updateError) throw updateError;
    } else {
      const { error } = await client.from("reviews").insert(reviewRow);
      // 23505: a parallel attempt already created this review; carry on and
      // attach the photos to it.
      if (error && error.code !== "23505") throw error;
    }
  } catch (error) {
    await discardUploadedPhotos();
    throw error;
  }

  if (isResumedSubmission) {
    const { count, error: photoCountError } = await client
      .from("review_photos")
      .select("id", { count: "exact", head: true })
      .eq("review_id", reviewId);
    if (photoCountError) throw photoCountError;
    if ((count ?? 0) > 0) {
      await discardUploadedPhotos();
      return;
    }
  }

  if (uploadedPhotos.length > 0) {
    const { error: photoInsertError } = await client.from("review_photos").insert(
      uploadedPhotos.map((photo, index) => ({
        review_id: reviewId,
        url: photo.url,
        storage_bucket: photo.storage_bucket,
        storage_path: photo.storage_path,
        thumb_path: photo.thumb_path ?? null,
        sort_order: index,
      })),
    );
    if (photoInsertError) {
      await discardUploadedPhotos();
      // The review itself is saved; only the photos are missing. A retry
      // with the same clientReviewId attaches them.
      throw Object.assign(new Error("Review saved, but its photos were not attached."), {
        code: REVIEW_PHOTOS_NOT_ATTACHED,
        cause: photoInsertError,
      });
    }
  }
}

/** A page returned by get_review_feed_page / search_reviews, turned into feed entries. */
async function mapReviewFeedRpcPage(
  client: SupabaseClient,
  data: unknown,
  options: { withPhotos?: boolean },
): Promise<RecentReviewFeedPage> {
  const payload = (data && typeof data === "object" ? data : {}) as Row;
  const rows = (Array.isArray(payload.entries) ? payload.entries : []) as Row[];
  const photoRowsOf = (row: Row): Row[] => (Array.isArray(row.photos) ? (row.photos as Row[]) : []);

  // One signing request for the whole page, thumbnails and full photos together.
  const pathsToSign: (string | undefined)[] = [];
  for (const row of rows) {
    if (isDeletedAccountReviewRow(row)) continue;
    for (const photo of photoRowsOf(row)) {
      if ((asString(photo.storage_bucket) || "review-media") !== "review-media") continue;
      pathsToSign.push(asString(photo.storage_path), asString(photo.thumb_path));
    }
  }
  const signedUrlByPath = await signReviewMediaPaths(client, pathsToSign);

  const entries = rows.flatMap((row): RecentReviewFeedEntry[] => {
    const id = asString(row.id);
    const dishId = asString(row.dish_id);
    if (!id || !dishId) return [];
    const userId = asString(row.user_id);
    const fromDeletedAccount = isDeletedAccountReviewRow(row);
    const photos: string[] = [];
    const photoThumbnails: string[] = [];
    if (!fromDeletedAccount) {
      for (const photo of photoRowsOf(row)) {
        const bucket = asString(photo.storage_bucket) || "review-media";
        const path = asString(photo.storage_path);
        const legacyUrl = asString(photo.url);
        const thumbPath = asString(photo.thumb_path);
        const displayUrl =
          path && bucket === "review-media" ? (signedUrlByPath.get(path) ?? legacyUrl) : legacyUrl;
        if (!displayUrl) continue;
        photos.push(displayUrl);
        photoThumbnails.push((thumbPath && signedUrlByPath.get(thumbPath)) || "");
      }
    }
    const replyText = asString(row.merchant_reply_text);
    const moderationState = asString(row.moderation_state);
    const venueId = asString(row.venue_id) ?? "";
    return [
      {
        review: {
          id,
          dishId,
          venueId: asString(row.venue_id),
          authorId: userId,
          authorName: fromDeletedAccount
            ? "Deleted account"
            : (asString(row.author_name) ?? "Hungry User"),
          authorAvatarUrl: asString(row.author_avatar_url),
          rating: asNumber(row.rating) ?? 0,
          createdAt: asString(row.created_at) ?? new Date().toISOString(),
          text: fromDeletedAccount ? "" : (asString(row.text) ?? ""),
          tags: fromDeletedAccount ? [] : asStringArray(row.tags),
          wouldRecommend: asBoolean(row.would_recommend) ?? true,
          photos,
          photoThumbnails: photoThumbnails.some(Boolean) ? photoThumbnails : undefined,
          helpfulCount: asNumber(row.helpful_count),
          editedAt: asString(row.edited_at),
          merchantReply: replyText
            ? {
                text: replyText,
                repliedAt: asString(row.merchant_replied_at) ?? asString(row.created_at) ?? "",
              }
            : undefined,
          viewerFoundHelpful: asBoolean(row.viewer_found_helpful) ?? false,
          moderationState:
            moderationState === "hidden" || moderationState === "removed"
              ? moderationState
              : undefined,
        },
        dishId,
        dishName: asString(row.dish_name) ?? "Dish",
        venueId,
        venueName: asString(row.venue_name) ?? "",
      },
    ];
  });

  const cursor = (payload.next_cursor ?? null) as Row | null;
  const before = cursor ? asString(cursor.before) : undefined;
  const beforeId = cursor ? asString(cursor.before_id) : undefined;
  return {
    // A deleted account's review keeps its photo rows but is shown without photos: leave it off
    // the photo grid instead of a blank tile.
    entries: options.withPhotos
      ? entries.filter((entry) => entry.review.photos.length > 0)
      : entries,
    hasMore: asBoolean(payload.has_more) ?? false,
    nextCursor: before && beforeId ? { before, beforeId } : undefined,
  };
}

async function fetchRecentReviewsPage(
  options: ListRecentReviewsOptions | undefined,
): Promise<RecentReviewFeedPage> {
  const client = requireSupabaseClient();
  const limit = Math.min(Math.max(Math.floor(options?.limit ?? 50), 1), 100);
  if (options?.dishIds && options.dishIds.length === 0) return { entries: [], hasMore: false };
  // One call returns the page with dish, stall, author, photo paths and the viewer's own state.
  const { data, error } = await client.rpc("get_review_feed_page", {
    p_limit: limit,
    p_before: options?.before,
    p_before_id: options?.before ? options.beforeId : undefined,
    p_after: options?.after,
    p_venue_id: options?.venueId,
    p_dish_ids: options?.dishIds,
    p_with_photos: options?.withPhotos ?? false,
  });
  // A backend that has not shipped the function yet is read table by table, as before.
  if (isMissingBackendObjectError(error)) return fetchRecentReviewsPageWithoutRpc(options);
  if (error) throw error;
  return mapReviewFeedRpcPage(client, data, { withPhotos: options?.withPhotos });
}

async function fetchRecentReviewsPageWithoutRpc(
  options: ListRecentReviewsOptions | undefined,
): Promise<RecentReviewFeedPage> {
  const client = requireSupabaseClient();
  const limit = Math.min(Math.max(Math.floor(options?.limit ?? 50), 1), 100);
  if (options?.dishIds && options.dishIds.length === 0) return { entries: [], hasMore: false };
  let query = client
    .from("reviews")
    // withPhotos: an inner join on review_photos (indexed by its (review_id, sort_order)
    // unique key) keeps text-only reviews off the photo grid, so a page is all photo reviews.
    .select(
      options?.withPhotos ? `${REVIEW_FEED_COLUMNS},review_photos!inner(id)` : REVIEW_FEED_COLUMNS,
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (options?.before && options.beforeId) {
    // Keyset cursor (created_at, id): rows sharing the boundary timestamp are kept.
    query = query.or(
      `created_at.lt."${options.before}",and(created_at.eq."${options.before}",id.lt."${options.beforeId}")`,
    );
  } else if (options?.before) {
    query = query.lt("created_at", options.before);
  }
  if (options?.after) {
    query = query.gte("created_at", options.after);
  }
  if (options?.venueId) {
    query = query.eq("venue_id", options.venueId);
  }
  if (options?.dishIds) {
    query = query.in("dish_id", options.dishIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = Array.isArray(data) ? (data as unknown as Row[]) : [];
  const lastRow = rows[rows.length - 1];
  const lastCreatedAt = lastRow ? asString(lastRow.created_at) : undefined;
  const lastId = lastRow ? asString(lastRow.id) : undefined;
  const entries = await buildRecentReviewEntries(client, rows);
  return {
    // A deleted account's review keeps its photo rows (the join matches) but is shown without
    // photos, so it would be a blank tile on the photo grid: leave it out there.
    entries: options?.withPhotos
      ? entries.filter((entry) => entry.review.photos.length > 0)
      : entries,
    // From the raw rows: a dropped review must not look like the end of the feed.
    hasMore: rows.length >= limit,
    nextCursor: lastCreatedAt && lastId ? { before: lastCreatedAt, beforeId: lastId } : undefined,
  };
}

async function uploadAvatarIfNeeded(
  client: SupabaseClient,
  userId: string,
  avatarUri?: string,
): Promise<string | undefined> {
  if (!avatarUri) {
    return undefined;
  }
  if (!isLocalUri(avatarUri)) {
    throw new Error("Profile avatar must be uploaded from a local device file.");
  }
  const extension = avatarUri.split(".").pop()?.toLowerCase() || "jpg";
  const uploaded = await uploadImageFromUri({
    client,
    bucket: "avatars",
    path: `${userId}/avatar-${Date.now()}.${extension}`,
    uri: avatarUri,
    // Avatars show at most a few hundred points wide; resize before upload.
    maxEdgePx: AVATAR_UPLOAD_MAX_EDGE_PX,
  });
  return uploaded.publicUrl;
}

/** Removes the user's older avatar files once the new avatar_url is saved. Best effort. */
async function removePreviousAvatars(
  client: SupabaseClient,
  userId: string,
  currentAvatarUrl: string,
): Promise<void> {
  try {
    const { data, error } = await client.storage.from("avatars").list(userId, { limit: 100 });
    if (error || !Array.isArray(data)) return;
    const stalePaths = data
      .filter((entry) => entry.id && !currentAvatarUrl.includes(`${userId}/${entry.name}`))
      .map((entry) => `${userId}/${entry.name}`);
    if (stalePaths.length > 0) await client.storage.from("avatars").remove(stalePaths);
  } catch {
    // A leftover file is harmless; the profile already points at the new avatar.
  }
}

function isVideoUri(value: string): boolean {
  const normalized = value.split("?")[0]?.toLowerCase() ?? "";
  return normalized.endsWith(".mp4") || normalized.endsWith(".mov") || normalized.endsWith(".webm");
}

function postMediaTypeFromUri(uri: string, fallback?: BiteDraft["mediaType"]): "image" | "video" {
  if (fallback === "video" || isVideoUri(uri)) return "video";
  return "image";
}

async function createSignedStorageUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<string | undefined> {
  try {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return undefined;
    return data.signedUrl;
  } catch {
    return undefined;
  }
}

async function createSignedStorageUrls(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const uniquePaths = Array.from(new Set(paths));
  if (uniquePaths.length === 0) return signed;
  try {
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrls(uniquePaths, 60 * 60);
    if (error || !Array.isArray(data)) return signed;
    data.forEach((entry) => {
      if (entry.path && entry.signedUrl && !entry.error) signed.set(entry.path, entry.signedUrl);
    });
  } catch {
    // Fall back to the stored urls.
  }
  return signed;
}

/** Signed media URLs live 1 hour; reuse one until 5 minutes before it expires. */
const POST_MEDIA_SIGNED_URL_REUSE_MS = 55 * 60 * 1000;
/**
 * Signed URL per bucket and storage path (post and review media). A refetch reuses the
 * same URL, so the image cache (keyed by URL) does not re-download or flicker on every
 * feed load.
 */
const signedMediaUrlCache = new Map<string, { url: string; expiresAt: number }>();

function cachedSignedMediaUrl(bucket: string, path: string): string | undefined {
  const key = `${bucket}/${path}`;
  const cached = signedMediaUrlCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    signedMediaUrlCache.delete(key);
    return undefined;
  }
  return cached.url;
}

function rememberSignedMediaUrl(bucket: string, path: string, url: string) {
  signedMediaUrlCache.set(`${bucket}/${path}`, {
    url,
    expiresAt: Date.now() + POST_MEDIA_SIGNED_URL_REUSE_MS,
  });
}

/** Sign every uncached post-media path in one request before rows are mapped. */
async function presignPostMediaRows(client: SupabaseClient, mediaRows: Row[]): Promise<void> {
  const paths = mediaRows
    .filter((row) => asString(row.storage_bucket) === "post-media")
    .map((row) => asString(row.storage_path))
    .filter((path): path is string => Boolean(path) && !cachedSignedMediaUrl("post-media", path!));
  if (paths.length === 0) return;
  const signed = await createSignedStorageUrls(client, "post-media", paths);
  signed.forEach((url, path) => rememberSignedMediaUrl("post-media", path, url));
}

async function resolvePostMediaDisplayUrl(client: SupabaseClient, row: Row): Promise<string> {
  const bucket = asString(row.storage_bucket);
  const path = asString(row.storage_path) ?? "";
  const publicUrl = asString(row.public_url);
  if (bucket === "post-media" && path) {
    const cached = cachedSignedMediaUrl("post-media", path);
    if (cached) return cached;
    const signed = await createSignedStorageUrl(client, bucket, path);
    if (signed) rememberSignedMediaUrl("post-media", path, signed);
    return signed ?? publicUrl ?? "";
  }
  return publicUrl ?? path;
}

async function buildPostMediaRows(
  client: SupabaseClient,
  userId: string,
  postId: string,
  mediaUrls: string[],
  mediaTypes?: BiteDraft["mediaTypes"],
  fallbackMediaType?: BiteDraft["mediaType"],
  /** Receives each uploaded storage path, so a caller whose publish fails can remove them. */
  uploadedPaths?: string[],
): Promise<{
  rows: Row[];
  displayUrls: string[];
  canonicalMediaType: Bite["mediaType"];
}> {
  const rows: Row[] = [];
  const uploadedForDisplay: { path: string; publicUrl: string }[] = [];
  let hasVideo = false;

  for (let index = 0; index < mediaUrls.length; index += 1) {
    const uri = mediaUrls[index];
    if (!uri) continue;
    const mediaKind = postMediaTypeFromUri(uri, mediaTypes?.[index] ?? fallbackMediaType);
    hasVideo = hasVideo || mediaKind === "video";

    if (isLocalUri(uri)) {
      const extension = extensionFromUri(uri);
      const storagePath = `${userId}/${postId}/media-${index}-${Date.now()}.${extension}`;
      // n-plus-one-ok: each file is its own upload; the display URLs are signed together below.
      const uploaded = await uploadPostMediaFromUri({
        client,
        bucket: "post-media",
        path: storagePath,
        uri,
      });
      uploadedPaths?.push(uploaded.path);
      rows.push({
        post_id: postId,
        media_type: mediaKind,
        storage_bucket: "post-media",
        storage_path: uploaded.path,
        public_url: uploaded.publicUrl,
        mime_type: uploaded.contentType,
        size_bytes: uploaded.sizeBytes ?? null,
        sort_order: index,
      });
      uploadedForDisplay.push({ path: uploaded.path, publicUrl: uploaded.publicUrl });
      continue;
    }

    throw new Error("Post media must be uploaded from local device files.");
  }

  const signedByPath = await createSignedStorageUrls(
    client,
    "post-media",
    uploadedForDisplay.map((entry) => entry.path),
  );
  const displayUrls = uploadedForDisplay.map(
    (entry) => signedByPath.get(entry.path) ?? entry.publicUrl,
  );

  return {
    rows,
    displayUrls,
    canonicalMediaType: hasVideo ? "video" : "photo",
  };
}

function postTypeForMedia(mediaRows: Row[], mediaType: Bite["mediaType"]): string {
  if (mediaType === "video") return "video";
  if (mediaRows.length > 1) return "multi_image";
  if (mediaRows.length > 0) return "image";
  return "text";
}

function tasteStampFromPostMeta(meta: Row): Bite["tasteStamp"] {
  const tasteStamp = asRecord(meta.tasteStamp);
  return {
    sweet: asNumber(tasteStamp.sweet) ?? NEUTRAL_TASTE_VECTOR.sweet,
    spicy: asNumber(tasteStamp.spicy) ?? NEUTRAL_TASTE_VECTOR.spicy,
    sour: asNumber(tasteStamp.sour) ?? NEUTRAL_TASTE_VECTOR.sour,
    salty: asNumber(tasteStamp.salty) ?? NEUTRAL_TASTE_VECTOR.salty,
    rich: asNumber(tasteStamp.rich) ?? NEUTRAL_TASTE_VECTOR.rich,
    aromatic: asNumber(tasteStamp.aromatic) ?? NEUTRAL_TASTE_VECTOR.aromatic,
  };
}

function resolvePostBiteMediaType(mediaRows: Row[], meta: Row): Bite["mediaType"] {
  if (asString(meta.mediaType) === "video") return "video";
  return mediaRows.some((row) => asString(row.media_type) === "video") ? "video" : "photo";
}

function groupRowsByStringKey(rows: Row[], key: string): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  rows.forEach((row) => {
    const value = asString(row[key]);
    if (!value) return;
    const current = grouped.get(value) ?? [];
    current.push(row);
    grouped.set(value, current);
  });
  return grouped;
}

/** Default page size for one user's profile post grid. */
const USER_POSTS_PAGE_SIZE = 60;

async function fetchPublishedPostBites(
  client: SupabaseClient,
  limit = 40,
  options?: { authorId?: string; offset?: number; ids?: string[] },
): Promise<Bite[]> {
  let query = client.from("posts").select("*").eq("status", "published").is("deleted_at", null);
  // Specific posts (the viewer's saved ones), whatever their age.
  if (options?.ids) query = query.in("id", options.ids);
  // One author's posts are filtered on the server so older posts are not cut off.
  if (options?.authorId) query = query.eq("author_id", options.authorId);
  const offset = options?.offset ?? 0;
  const { data, error } = await query
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  // A failed read throws so it is not shown as "No posts yet" (offline included).
  if (error) throw error;
  if (!Array.isArray(data)) return [];

  const postRows = data as Row[];
  const postIds = postRows.map((row) => asString(row.id)).filter((id): id is string => !!id);
  const mediaRows =
    postIds.length > 0
      ? await client
          .from("post_media")
          .select("*")
          .in("post_id", postIds)
          .order("sort_order", { ascending: true })
          .then(({ data: mediaData, error: mediaError }) =>
            mediaError || !Array.isArray(mediaData) ? [] : (mediaData as Row[]),
          )
      : [];

  const dishIds = [
    ...new Set(postRows.map((row) => asString(row.dish_id)).filter((id): id is string => !!id)),
  ];
  const venueIds = [
    ...new Set(postRows.map((row) => asString(row.venue_id)).filter((id): id is string => !!id)),
  ];
  const authorIds = [
    ...new Set(postRows.map((row) => asString(row.author_id)).filter((id): id is string => !!id)),
  ];

  const [dishRows, venueRows, authorRows] = await Promise.all([
    dishIds.length > 0
      ? client
          .from("dishes")
          .select("id,name,price,rating_avg,image_url,venue_id,building_id")
          .in("id", dishIds)
          .then(({ data: rows, error: rowsError }) =>
            rowsError || !Array.isArray(rows) ? [] : (rows as Row[]),
          )
      : [],
    venueIds.length > 0
      ? client
          .from("venues")
          .select("id,name,unit_number,building_id")
          .in("id", venueIds)
          .then(({ data: rows, error: rowsError }) =>
            rowsError || !Array.isArray(rows) ? [] : (rows as Row[]),
          )
      : [],
    // The author is read from their profile, never from the client-written post JSON.
    authorIds.length > 0
      ? client
          .from("public_profiles")
          .select("id,display_name,avatar_url")
          .in("id", authorIds)
          .then(({ data: rows, error: rowsError }) =>
            rowsError || !Array.isArray(rows) ? [] : (rows as Row[]),
          )
      : [],
  ]);

  const buildingIds = [
    ...new Set(
      [
        ...postRows.map((row) => asString(row.building_id)),
        ...venueRows.map((row) => asString(row.building_id)),
        ...dishRows.map((row) => asString(row.building_id)),
      ].filter((id): id is string => !!id),
    ),
  ];
  const buildingRows =
    buildingIds.length > 0
      ? await client
          .from("buildings")
          .select("id,name")
          .in("id", buildingIds)
          .then(({ data: rows, error: rowsError }) =>
            rowsError || !Array.isArray(rows) ? [] : (rows as Row[]),
          )
      : [];

  await presignPostMediaRows(client, mediaRows);
  const mediaByPostId = groupRowsByStringKey(mediaRows, "post_id");
  const dishById = new Map(dishRows.map((row) => [asString(row.id) ?? "", row]));
  const venueById = new Map(venueRows.map((row) => [asString(row.id) ?? "", row]));
  const buildingById = new Map(buildingRows.map((row) => [asString(row.id) ?? "", row]));
  const authorById = new Map(authorRows.map((row) => [asString(row.id) ?? "", row]));

  return Promise.all(
    postRows.map(async (row) => {
      const meta = asRecord(row.generated_content);
      const authorRow = authorById.get(asString(row.author_id) ?? "");
      const dishMeta = asRecord(meta.dish);
      const venueMeta = asRecord(meta.venue);
      const postId = asString(row.id) ?? `post-${Date.now()}`;
      const dishId = asString(row.dish_id) ?? asString(dishMeta.id) ?? "";
      const venueId = asString(row.venue_id) ?? asString(venueMeta.id) ?? "";
      const dishRow = dishById.get(dishId);
      const venueRow = venueById.get(venueId);
      const buildingId =
        asString(row.building_id) ??
        asString(venueRow?.building_id) ??
        asString(dishRow?.building_id) ??
        asString(venueMeta.buildingId) ??
        "";
      const buildingRow = buildingById.get(buildingId);
      const mediaForPost = mediaByPostId.get(postId) ?? [];
      // n-plus-one-ok: presignPostMediaRows signed every path in one call above; this reads the cache.
      const mediaUrls = (
        await Promise.all(
          mediaForPost.map((mediaRow) => resolvePostMediaDisplayUrl(client, mediaRow)),
        )
      ).filter((url): url is string => url.length > 0);
      const fallbackImage =
        asString(dishRow?.image_url) ??
        asString(dishMeta.imageUrl) ??
        asString(row.public_url) ??
        "";
      const photoUrl = mediaUrls[0] ?? fallbackImage;
      const mediaType = resolvePostBiteMediaType(mediaForPost, meta);

      return {
        id: postId,
        authorId: asString(row.author_id) ?? "unknown-author",
        authorName: asString(authorRow?.display_name) ?? "Hungry User",
        authorAvatar: asString(authorRow?.avatar_url),
        dishId,
        dishName: asString(dishRow?.name) ?? asString(dishMeta.name) ?? "Unknown dish",
        venueId,
        venueName: asString(venueRow?.name) ?? asString(venueMeta.name) ?? "Unknown venue",
        unitNumber: asString(venueRow?.unit_number) ?? asString(venueMeta.unitNumber) ?? "",
        buildingId,
        buildingName: asString(buildingRow?.name) ?? asString(venueMeta.buildingName) ?? "",
        photoUrl,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : photoUrl ? [photoUrl] : [],
        mediaType,
        showFoodContextOverlay: meta.showFoodContextOverlay !== false,
        caption: asString(row.caption) ?? "",
        tags: asStringArray(meta.tags),
        tasteStamp: tasteStampFromPostMeta(meta),
        cravingCount: asNumber(row.like_count) ?? 0,
        savedCount: asNumber(row.save_count) ?? 0,
        // The poster's own rating; posts without one show no star (never the dish average).
        rating: asNumber(meta.rating) ?? 0,
        price: asNumber(dishRow?.price) ?? asNumber(dishMeta.price) ?? 0,
        expiresAt:
          asString(row.published_at) ?? asString(row.created_at) ?? new Date().toISOString(),
        createdAt:
          asString(row.published_at) ?? asString(row.created_at) ?? new Date().toISOString(),
      } satisfies Bite;
    }),
  );
}

async function mapFeedRpcRowToBite(client: SupabaseClient, row: Row): Promise<Bite> {
  const meta = asRecord(row.generated_content);
  const dishMeta = asRecord(meta.dish);
  const venueMeta = asRecord(meta.venue);
  const mediaRows = asRowArray(row.media);
  // n-plus-one-ok: the caller presigned every path in one call (presignPostMediaRows); this reads the cache.
  const mediaUrls = (
    await Promise.all(mediaRows.map((mediaRow) => resolvePostMediaDisplayUrl(client, mediaRow)))
  ).filter((url): url is string => url.length > 0);
  const fallbackImage =
    asString(row.dish_image_url) ?? asString(dishMeta.imageUrl) ?? asString(row.public_url) ?? "";
  const photoUrl = mediaUrls[0] ?? fallbackImage;
  const mediaType = resolvePostBiteMediaType(mediaRows, meta);

  return {
    id: asString(row.id) ?? `post-${Date.now()}`,
    authorId: asString(row.author_id) ?? "unknown-author",
    // Only the live profile: generated_content.author is client-written and untrusted.
    authorName: asString(row.author_display_name) ?? "Hungry User",
    authorAvatar: asString(row.author_avatar_url),
    dishId: asString(row.dish_id) ?? asString(dishMeta.id) ?? "",
    dishName: asString(row.dish_name) ?? asString(dishMeta.name) ?? "Unknown dish",
    venueId: asString(row.venue_id) ?? asString(venueMeta.id) ?? "",
    venueName: asString(row.venue_name) ?? asString(venueMeta.name) ?? "Unknown venue",
    unitNumber: asString(row.venue_unit_number) ?? asString(venueMeta.unitNumber) ?? "",
    buildingId:
      asString(row.building_id) ??
      asString(row.venue_building_id) ??
      asString(venueMeta.buildingId) ??
      "",
    buildingName: asString(row.building_name) ?? asString(venueMeta.buildingName) ?? "",
    photoUrl,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : photoUrl ? [photoUrl] : [],
    mediaType,
    showFoodContextOverlay: meta.showFoodContextOverlay !== false,
    caption: asString(row.caption) ?? "",
    tags: asStringArray(meta.tags),
    tasteStamp: tasteStampFromPostMeta(meta),
    cravingCount: asNumber(row.like_count) ?? 0,
    savedCount: asNumber(row.save_count) ?? 0,
    commentCount: asNumber(row.comment_count),
    shareCount: asNumber(row.share_count),
    // Only v3 and get_post_by_id return the viewer's own state.
    viewerHasLiked: typeof row.viewer_has_liked === "boolean" ? row.viewer_has_liked : undefined,
    viewerHasSaved: typeof row.viewer_has_saved === "boolean" ? row.viewer_has_saved : undefined,
    rating: asNumber(meta.rating) ?? 0,
    price: asNumber(row.dish_price) ?? asNumber(dishMeta.price) ?? 0,
    expiresAt: asString(row.published_at) ?? asString(row.created_at) ?? new Date().toISOString(),
    createdAt: asString(row.published_at) ?? asString(row.created_at) ?? new Date().toISOString(),
  } satisfies Bite;
}

const HOME_FEED_PAGE_SIZE = 40;

async function fetchHomeSocialFeedBitesViaRpc(
  client: SupabaseClient,
  page: BitesFeedPage = {},
): Promise<Bite[] | undefined> {
  const limit = page.limit ?? HOME_FEED_PAGE_SIZE;
  const cursorCreatedAt = page.cursor?.createdAt ?? null;
  const cursorPostId = page.cursor?.postId ?? null;
  // v3 adds the viewer's like/save state; fall back to v2, then the legacy RPC.
  const v3Result = await client.rpc("get_home_social_feed_v3", {
    p_limit: limit,
    p_cursor_feed_created_at: cursorCreatedAt,
    p_cursor_post_id: cursorPostId,
  });
  const v2Result = v3Result.error
    ? await client.rpc("get_home_social_feed_v2", {
        p_limit: limit,
        p_cursor_feed_created_at: cursorCreatedAt,
        p_cursor_post_id: cursorPostId,
      })
    : v3Result;
  const legacyResult = v2Result.error
    ? await client.rpc("get_home_social_feed", {
        p_limit: limit,
        p_cursor_published_at: cursorCreatedAt,
        p_cursor_id: cursorPostId,
      })
    : v2Result;

  if (legacyResult.error) {
    console.warn("Failed to fetch Home social feed RPC", legacyResult.error.message);
    return undefined;
  }
  if (!Array.isArray(legacyResult.data)) return undefined;

  const rows = legacyResult.data as Row[];
  await presignPostMediaRows(
    client,
    rows.flatMap((row) => asRowArray(row.media)),
  );
  return Promise.all(rows.map((row) => mapFeedRpcRowToBite(client, row)));
}

/** Guests have no session, so the signed-in feed RPCs and posts RLS return nothing. */
async function fetchPublicHomeFeedBites(
  client: SupabaseClient,
  page: BitesFeedPage = {},
): Promise<Bite[] | undefined> {
  const { data, error } = await client.rpc("get_public_home_feed", {
    p_limit: page.limit ?? HOME_FEED_PAGE_SIZE,
    p_cursor_feed_created_at: page.cursor?.createdAt ?? null,
    p_cursor_post_id: page.cursor?.postId ?? null,
  });
  if (error) {
    console.warn("Failed to fetch public Home feed RPC", error.message);
    return undefined;
  }
  if (!Array.isArray(data)) return undefined;
  const rows = data as Row[];
  await presignPostMediaRows(
    client,
    rows.flatMap((row) => asRowArray(row.media)),
  );
  return Promise.all(rows.map((row) => mapFeedRpcRowToBite(client, row)));
}

function listAllDishesFromRepository(): DishDetail[] {
  return supabaseRepository
    .listBuildings()
    .flatMap((building) => supabaseRepository.listVenuesByBuilding(building.id))
    .flatMap((venue) => supabaseRepository.listDishesByVenue(venue.id));
}

function matchesRecommendationQuery(dish: DishDetail, query?: string) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;
  return `${dish.name} ${dish.venueName} ${dish.tasteTags.join(" ")}`
    .toLowerCase()
    .includes(normalized);
}

function getRankedRecommendations(
  request: RecommendationSlateRequest,
  profile: UserProfile = DEFAULT_GUEST_PROFILE,
): RankedRecommendation[] {
  const dishes = listAllDishesFromRepository().filter((dish) =>
    matchesRecommendationQuery(dish, request.query),
  );
  const ranked = runRecommendationPipeline(dishes, {
    userVector: request.tasteProfile,
    dietaryFlags: request.dietaryFlags ?? profile.dietaryPreferences,
    neophiliaIndex: request.neophiliaIndex ?? 5,
    latitude: request.latitude,
    longitude: request.longitude,
    radiusMeters: request.radiusMeters,
    excludeDishIds: request.excludeDishIds,
  }).slice(0, request.limit ?? 20);

  return ranked
    .map((item) => {
      const dish = dishes.find((candidate) => candidate.id === item.dishId);
      if (!dish) return null;
      return {
        dish,
        matchScore: item.score,
        matchPercent: item.matchPercent,
        matchReason: item.explanation,
        isSerendipitous: item.isSerendipitous,
      };
    })
    .filter((item): item is RankedRecommendation => Boolean(item));
}

function tasteVectorToArray(vector: TasteVector): number[] {
  return [vector.sweet, vector.spicy, vector.sour, vector.salty, vector.rich, vector.aromatic];
}

function clampTasteAxis(value: number | undefined): number {
  return Math.max(0, Math.min(10, Number.isFinite(value) ? (value as number) : 5));
}

function clampTasteVector(vector: TasteVector): TasteVector {
  return {
    sweet: clampTasteAxis(vector.sweet),
    spicy: clampTasteAxis(vector.spicy),
    sour: clampTasteAxis(vector.sour),
    salty: clampTasteAxis(vector.salty),
    rich: clampTasteAxis(vector.rich),
    aromatic: clampTasteAxis(vector.aromatic),
  };
}

function mapRecommendationRpcRows(rows: Row[]): RankedRecommendation[] {
  return rows
    .map((row) => {
      const dishId = asString(row.dish_id);
      // The card the RPC sent. Looking the dish up in the repository would start the full
      // catalog download as a side effect; only rows from before the card columns existed (ids
      // only) still need that lookup.
      const dish = dishId
        ? row.venue_name === undefined
          ? supabaseRepository.getDishById(dishId)
          : mapTasteCardRow(row)
        : undefined;
      if (!dish) return null;

      const matchScore = asNumber(row.match_score) ?? 0;
      return {
        dish,
        matchScore,
        matchPercent:
          asNumber(row.match_percent) ?? Math.max(0, Math.min(100, Math.round(matchScore * 100))),
        matchReason: asString(row.match_reason) ?? "Taste profile match",
        isSerendipitous: asBoolean(row.is_serendipitous) ?? false,
      };
    })
    .filter((item): item is RankedRecommendation => Boolean(item));
}

// p_radius_meters is a Postgres integer: a "no limit" radius such as
// Number.MAX_SAFE_INTEGER would fail the whole call, so send null instead.
const MAX_RPC_RADIUS_METERS = 2_147_483_647;
function toRpcRadiusMeters(radiusMeters: number | undefined): number | null {
  return radiusMeters && radiusMeters > 0 && radiusMeters <= MAX_RPC_RADIUS_METERS
    ? Math.round(radiusMeters)
    : null;
}

// Loaded on first use: Sentry is a native module that plain service tests never need.
function reportTasteRecommendationsError(error: unknown): void {
  try {
    const { reportError } =
      require("@/lib/monitoring/reportError") as typeof import("@/lib/monitoring/reportError");
    reportError(error, { screen: "service", action: "get_taste_recommendations" });
  } catch {
    // Reporting must never break the recommendations fallback.
  }
}

async function getLiveTasteRecommendations(
  client: SupabaseClient,
  request: RecommendationSlateRequest,
  profile: UserProfile,
): Promise<RankedRecommendation[] | undefined> {
  const { data, error } = await client.rpc("get_taste_recommendations", {
    p_surface: request.surface,
    p_user_vector: tasteVectorToArray(request.tasteProfile),
    p_dietary_flags: request.dietaryFlags ?? profile.dietaryPreferences,
    p_query: request.query ?? null,
    p_lat: request.latitude ?? null,
    p_lng: request.longitude ?? null,
    p_radius_meters: toRpcRadiusMeters(request.radiusMeters),
    p_exclude_dish_ids: request.excludeDishIds ?? [],
    p_limit: request.limit ?? 20,
  });

  if (error) {
    console.warn("Failed to fetch live taste recommendations", error.message);
    // The fallback (popular dishes) hides the failure from users, so it must reach Sentry;
    // a rate-limit refusal is expected under load and is not reported.
    if (error.code !== "rate_limited") reportTasteRecommendationsError(error);
    return undefined;
  }
  if (!Array.isArray(data)) return undefined;

  const rows = data as Row[];
  let mapped = mapRecommendationRpcRows(rows);
  // Only an id-only reply needs the full catalog to be turned into dishes.
  if (rows.length > 0 && mapped.length === 0 && rows[0]?.venue_name === undefined) {
    await refreshSupabaseRepositoryCache();
    mapped = mapRecommendationRpcRows(rows);
  }
  return mapped;
}

function toCoreFeedbackType(
  feedback: ExplicitFeedbackInput,
): Parameters<typeof processExplicitFeedbackCore>[1]["type"] {
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

function toPersistedFeedbackType(feedback: ExplicitFeedbackInput): TasteInteractionType {
  if (feedback.feedbackType === "save") return "saved";
  if (feedback.feedbackType === "unsave") return "unsaved";
  return feedback.feedbackType;
}

const LOW_VALUE_FEEDBACK_WINDOW_MS = 10 * 60 * 1000;
const LOW_VALUE_FEEDBACK_CAP = 3;
const CAPPED_FEEDBACK_TYPES = new Set<TasteInteractionType>([
  "search_query",
  "dish_result_click",
  "food_button_click",
]);

function createServiceTasteEvent({
  type,
  feedback,
  vectorBefore,
  vectorAfter,
  applied,
  createdAt,
  reason,
}: {
  type: TasteInteractionType;
  feedback: ExplicitFeedbackInput;
  vectorBefore: TasteVector;
  vectorAfter: TasteVector;
  applied: boolean;
  createdAt: string;
  reason?: TasteInteractionEvent["reason"];
}): TasteInteractionEvent {
  return {
    id: `taste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    surface: feedback.surface ?? "search",
    dishId: feedback.dishId,
    query: feedback.query,
    chipId: feedback.chipId,
    buttonId: feedback.buttonId,
    rating: feedback.rating,
    createdAt,
    userVectorBefore: vectorBefore,
    userVectorAfter: vectorAfter,
    applied,
    reason,
  };
}

function feedbackMetadata(
  feedback: ExplicitFeedbackInput,
  reason?: TasteInteractionEvent["reason"],
): Row {
  return {
    ...(feedback.metadata ?? {}),
    ...(reason ? { reason } : {}),
    ...(feedback.hawkerTags?.length ? { hawkerTags: feedback.hawkerTags } : {}),
  };
}

async function isLiveFeedbackCapped(
  client: SupabaseClient,
  userId: string,
  feedback: ExplicitFeedbackInput,
  persistedType: TasteInteractionType,
  createdAt: string,
): Promise<boolean> {
  if (!CAPPED_FEEDBACK_TYPES.has(persistedType)) return false;

  const cutoff = new Date(
    new Date(createdAt).getTime() - LOW_VALUE_FEEDBACK_WINDOW_MS,
  ).toISOString();
  let query = client
    .from("taste_interaction_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", persistedType)
    .eq("surface", feedback.surface ?? "search")
    .eq("applied", true)
    .gte("created_at", cutoff);

  query = feedback.dishId ? query.eq("dish_id", feedback.dishId) : query.is("dish_id", null);
  query = feedback.query ? query.eq("query", feedback.query) : query.is("query", null);
  query = feedback.chipId ? query.eq("chip_id", feedback.chipId) : query.is("chip_id", null);
  query = feedback.buttonId
    ? query.eq("button_id", feedback.buttonId)
    : query.is("button_id", null);

  const { count, error } = await query;

  if (error) {
    console.warn("Failed to check taste feedback cap", error.message);
    return false;
  }
  return (count ?? 0) >= LOW_VALUE_FEEDBACK_CAP;
}

async function persistFeedbackEvent({
  persistedType,
  feedback,
  vectorBefore,
  vectorAfter,
  applied,
  createdAt,
  reason,
  dishId,
}: {
  persistedType: TasteInteractionType;
  feedback: ExplicitFeedbackInput;
  vectorBefore: TasteVector;
  vectorAfter: TasteVector;
  applied: boolean;
  createdAt: string;
  reason?: TasteInteractionEvent["reason"];
  dishId?: string;
}): Promise<boolean> {
  const client = getSupabaseClient();
  const userId = await getCurrentSupabaseUserId();
  if (!client || !userId) return false;

  const metadata = feedbackMetadata(feedback, reason);
  const { error } = await client.rpc("record_taste_interaction_event", {
    p_type: persistedType,
    p_surface: feedback.surface ?? "search",
    p_user_vector_before: tasteVectorToArray(vectorBefore),
    p_user_vector_after: tasteVectorToArray(vectorAfter),
    p_dish_id: dishId ?? null,
    p_query: feedback.query ?? null,
    p_chip_id: feedback.chipId ?? null,
    p_button_id: feedback.buttonId ?? null,
    p_rating: feedback.rating ?? null,
    p_applied: applied,
    p_confidence_delta: confidenceDeltaForFeedback(feedback),
    p_source: "explicit_feedback",
    p_created_at: createdAt,
    p_metadata: metadata,
  });

  if (!error) {
    return true;
  }

  if (!isMissingPgVectorTypeError(error)) {
    console.warn("Failed to persist taste interaction event via RPC", error.message);
  }
  const { error: insertError } = await client.from("taste_interaction_events").insert({
    user_id: userId,
    type: persistedType,
    surface: feedback.surface ?? "search",
    dish_id: dishId ?? null,
    query: feedback.query ?? null,
    chip_id: feedback.chipId ?? null,
    button_id: feedback.buttonId ?? null,
    rating: feedback.rating ?? null,
    user_vector_before: tasteVectorToArray(vectorBefore),
    user_vector_after: tasteVectorToArray(vectorAfter),
    applied,
    metadata,
    created_at: createdAt,
  });
  if (insertError) {
    if (!isMissingPgVectorTypeError(insertError)) {
      console.warn("Failed to persist taste interaction event", insertError.message);
    }
  }

  return false;
}

function confidenceDeltaForFeedback(feedback: ExplicitFeedbackInput): number {
  if (feedback.feedbackType === "rating" || feedback.feedbackType === "review") {
    const rating = feedback.rating ?? 3;
    if (rating >= 5) return 0.03;
    if (rating >= 4) return 0.02;
    if (rating >= 3) return 0.01;
    if (rating >= 2) return 0.015;
    return 0.02;
  }
  if (feedback.feedbackType === "save") return 0.04;
  if (feedback.feedbackType === "unsave") return 0.005;
  if (feedback.feedbackType === "search_query") return 0.003;
  if (feedback.feedbackType === "dish_result_click") return 0.012;
  if (feedback.feedbackType === "dish_like") return 0.018;
  if (feedback.feedbackType === "food_button_click") return 0.012;
  if (feedback.feedbackType === "dismissed") return 0.01;
  return 0.01;
}

function isMissingPgVectorTypeError(error: { message?: string } | null | undefined): boolean {
  return /type "vector" does not exist/i.test(error?.message ?? "");
}

/** Inbox rows per read; the inbox pages through older ones with `offset`. */
const ACTIVITY_EVENTS_PAGE_SIZE = 50;

function isMissingActivityEventsSchemaError(error: PostgrestError | null | undefined): boolean {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    message.includes("activity_events") &&
    (error.code === "PGRST205" ||
      error.code === "42P01" ||
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find the table"))
  );
}

/** True when the backend does not have the function or table yet (migration not shipped). */
function isMissingBackendObjectError(error: PostgrestError | null | undefined): boolean {
  return (
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    error?.code === "42P01" ||
    error?.code === "PGRST205"
  );
}

function isMissingMarkActivityReadRpcError(error: PostgrestError | null | undefined): boolean {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    (message.includes("mark_activity_read") || message.includes("activity_events")) &&
    (error.code === "PGRST202" ||
      error.code === "PGRST205" ||
      error.code === "42883" ||
      error.code === "42P01" ||
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find the function") ||
      message.includes("could not find the table"))
  );
}

function buildTasteVectorFromAnswers(answers: QuizAnswer[]): TasteVector {
  if (answers.length === 0) return { ...NEUTRAL_TASTE_VECTOR };

  const accumulator = answers.reduce<TasteVector>(
    (vector, answer) => ({
      sweet: vector.sweet + (answer.tasteImpact.sweet ?? 0),
      spicy: vector.spicy + (answer.tasteImpact.spicy ?? 0),
      sour: vector.sour + (answer.tasteImpact.sour ?? 0),
      salty: vector.salty + (answer.tasteImpact.salty ?? 0),
      rich: vector.rich + (answer.tasteImpact.rich ?? 0),
      aromatic: vector.aromatic + (answer.tasteImpact.aromatic ?? 0),
    }),
    { sweet: 0, spicy: 0, sour: 0, salty: 0, rich: 0, aromatic: 0 },
  );

  const normalizer = answers.length;
  return {
    sweet: Math.max(0, Math.min(10, accumulator.sweet / normalizer + 5)),
    spicy: Math.max(0, Math.min(10, accumulator.spicy / normalizer + 5)),
    sour: Math.max(0, Math.min(10, accumulator.sour / normalizer + 5)),
    salty: Math.max(0, Math.min(10, accumulator.salty / normalizer + 5)),
    rich: Math.max(0, Math.min(10, accumulator.rich / normalizer + 5)),
    aromatic: Math.max(0, Math.min(10, accumulator.aromatic / normalizer + 5)),
  };
}

function explainTasteMatch(user: TasteVector, dish: TasteVector): string {
  const keys: (keyof TasteVector)[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];
  const dominant = keys
    .map((key) => ({ key, diff: Math.abs(user[key] - dish[key]) }))
    .sort((a, b) => a.diff - b.diff)[0]?.key;
  if (!dominant) return "Good overall profile match.";
  return `Closest match on ${dominant}.`;
}

function normalizeMenuEntry(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Most review rows one merchant read returns; longer histories are paged with `before`. */
const MERCHANT_INBOX_MAX_ROWS = 200;

async function fetchDishNamesById(
  client: SupabaseClient,
  dishIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = Array.from(new Set(dishIds.filter(Boolean)));
  if (ids.length === 0) return names;
  const { data, error } = await client.from("dishes").select("id,name").in("id", ids);
  // Dish names are context only: a failed lookup must not hide the reviews themselves.
  if (error) return names;
  (Array.isArray(data) ? (data as Row[]) : []).forEach((row) => {
    const id = asString(row.id);
    const name = asString(row.name);
    if (id && name) names.set(id, name);
  });
  return names;
}

function getMerchantAnalyticsSince(dateRange: MerchantAnalytics["dateRange"]): string | null {
  const now = new Date();
  if (dateRange === "today") {
    // Midnight in Singapore (UTC+8, no daylight saving), whatever the phone's own time zone is.
    const singaporeOffsetMs = 8 * 60 * 60 * 1000;
    const singaporeNow = new Date(now.getTime() + singaporeOffsetMs);
    singaporeNow.setUTCHours(0, 0, 0, 0);
    return new Date(singaporeNow.getTime() - singaporeOffsetMs).toISOString();
  }
  if (dateRange === "7d") {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (dateRange === "30d") {
    now.setDate(now.getDate() - 30);
    return now.toISOString();
  }
  return null;
}

function getMerchantAnalyticsSessionId(context?: { sessionId?: string; userId?: string }): string {
  return context?.sessionId ?? context?.userId ?? merchantAnonymousSessionId;
}

function mapMerchantAnalyticsPayload(
  payload: unknown,
  outletId: string,
  dateRange: MerchantAnalytics["dateRange"],
): MerchantAnalytics {
  const row = asRecord(payload);
  const previousPeriodComparison = asRecord(row.previousPeriodComparison);
  return {
    outletId: asString(row.outletId) ?? outletId,
    dateRange,
    profileVisits: asNumber(row.profileVisits) ?? 0,
    menuViews: asNumber(row.menuViews) ?? 0,
    dishViews: asNumber(row.dishViews) ?? 0,
    directionTaps: asNumber(row.directionTaps) ?? 0,
    saves: asNumber(row.saves) ?? 0,
    shares: asNumber(row.shares) ?? 0,
    contactTaps: asNumber(row.contactTaps) ?? 0,
    socialLinkTaps: asNumber(row.socialLinkTaps) ?? 0,
    postInteractions: asNumber(row.postInteractions) ?? 0,
    reviewCount: asNumber(row.reviewCount) ?? 0,
    averageRating: asNumber(row.averageRating) ?? 0,
    topDishes: asRowArray(row.topDishes).map((dish) => ({
      dishId: asString(dish.dishId) ?? "",
      name: asString(dish.name) ?? "",
      views: asNumber(dish.views) ?? 0,
      saves: asNumber(dish.saves) ?? 0,
    })),
    mostSearchedKeywords: asStringArray(row.mostSearchedKeywords),
    peakDiscoveryHours: Array.isArray(row.peakDiscoveryHours)
      ? row.peakDiscoveryHours
          .map((hour) => asNumber(hour))
          .filter((hour): hour is number => typeof hour === "number")
      : [],
    customerTasteTags: asRowArray(row.customerTasteTags).map((tagRow) => ({
      tag: asString(tagRow.tag) ?? "",
      count: asNumber(tagRow.count) ?? 0,
    })),
    previousPeriodComparison: {
      profileVisits: asNumber(previousPeriodComparison.profileVisits) ?? 0,
      menuViews: asNumber(previousPeriodComparison.menuViews) ?? 0,
      reviewCount: asNumber(previousPeriodComparison.reviewCount) ?? 0,
      averageRating: asNumber(previousPeriodComparison.averageRating) ?? 0,
    },
  };
}

function callbackBaseMatches(url: string, expectedRedirectTo: string): boolean {
  try {
    const parsed = new URL(url);
    const expected = new URL(expectedRedirectTo);
    return (
      parsed.protocol === expected.protocol &&
      parsed.hostname === expected.hostname &&
      normalizeCallbackPath(parsed.pathname) === normalizeCallbackPath(expected.pathname)
    );
  } catch {
    return false;
  }
}

function normalizeCallbackPath(path: string): string {
  if (!path) return "/";
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  return normalized || "/";
}

function hasEmailPasswordIdentity(user: {
  app_metadata?: { providers?: unknown; provider?: unknown };
  identities?: { provider?: string }[] | null;
}): boolean {
  if (user.identities?.some((identity) => identity.provider === "email")) return true;
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers)) return providers.includes("email");
  return user.app_metadata?.provider === "email";
}

// Bump when the taste quiz questions or answer scale change, so stored answers
// can be told apart. v2: the 4-step onboarding quiz (6 taste questions + diet).
const TASTE_QUIZ_VERSION = "v2";

// Keyboards (QuickType, autofill) often add a trailing space or a capital letter.
function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function exchangeRecoveryCodeIfPresent(client: SupabaseClient, token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;

  let code = trimmed;
  try {
    const parsed = new URL(trimmed);
    if (!callbackBaseMatches(parsed.toString(), AUTH_REDIRECTS.passwordReset)) {
      throw new Error("Password recovery callback URL was not trusted.");
    }
    const {
      accessToken,
      refreshToken,
      code: callbackCode,
    } = getAuthTokensFromCallback(parsed.toString());
    if (accessToken || refreshToken) {
      throw new Error("Password recovery token fragments are not accepted.");
    }
    code = callbackCode ?? "";
  } catch (error) {
    if (error instanceof Error && error.message.includes("Password recovery")) {
      throw error;
    }
  }

  if (!code) {
    throw new Error("Password recovery callback did not include a code.");
  }

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

function getOAuthStateFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const query = new URLSearchParams(parsed.search.startsWith("?") ? parsed.search.slice(1) : "");
    const hash = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : "");
    return hash.get("state") ?? query.get("state") ?? undefined;
  } catch {
    return undefined;
  }
}

function getAuthTokensFromCallback(url: string): {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {};
  }

  const query = new URLSearchParams(parsed.search.startsWith("?") ? parsed.search.slice(1) : "");
  const hash = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : "");

  return {
    accessToken: hash.get("access_token") ?? query.get("access_token") ?? undefined,
    refreshToken: hash.get("refresh_token") ?? query.get("refresh_token") ?? undefined,
    code: query.get("code") ?? hash.get("code") ?? undefined,
  };
}

const DEFAULT_MERCHANT_NOTIFICATION_PREFERENCES: MerchantNotificationPreferences = {
  newReviews: true,
  lowRatingAlerts: true,
  newComments: true,
  promotionUpdates: true,
  weeklyDigest: true,
  aiInsights: true,
};

function asMerchantRole(value: unknown): MerchantRole {
  const role = asString(value);
  return role === "manager" || role === "staff" ? role : "owner";
}

function asMerchantInviteStatus(value: unknown): MerchantTeamMember["inviteStatus"] {
  const status = asString(value);
  if (status === "accepted" || status === "active") return "accepted";
  if (status === "declined") return "declined";
  if (status === "removed") return "removed";
  return "pending";
}

function toMerchantVerification(
  row?: Row,
  evidence?: VerificationEvidence[],
): MerchantOutlet["verification"] {
  return {
    status: (asString(row?.status) as MerchantOutlet["verification"]["status"]) ?? "not_started",
    method: (asString(row?.method) as MerchantOutlet["verification"]["method"]) ?? undefined,
    evidence: evidence ?? [],
    submittedAt: asString(row?.submitted_at),
    verifiedAt: asString(row?.verified_at),
    rejectedAt: asString(row?.rejected_at),
    rejectionReason: asString(row?.rejection_reason),
    expiresAt: asString(row?.expires_at),
  };
}

async function fetchVerificationForOutlet(
  client: SupabaseClient,
  outletId: string,
): Promise<MerchantOutlet["verification"]> {
  return (
    (await fetchVerificationsForOutlets(client, [outletId])).get(outletId) ??
    toMerchantVerification()
  );
}

/** Verification and evidence for several outlets in two queries, not two per outlet. */
async function fetchVerificationsForOutlets(
  client: SupabaseClient,
  outletIds: string[],
): Promise<Map<string, MerchantOutlet["verification"]>> {
  const byOutletId = new Map<string, MerchantOutlet["verification"]>();
  const ids = Array.from(new Set(outletIds.filter(Boolean)));
  if (ids.length === 0) return byOutletId;

  const { data, error } = await client
    .from("merchant_verifications")
    .select("*")
    .in("outlet_id", ids);
  if (error) throw error;
  const verificationRows = Array.isArray(data) ? (data as Row[]) : [];
  const verificationIds = verificationRows
    .map((row) => asString(row.id))
    .filter((id): id is string => Boolean(id));

  const evidenceByVerificationId = new Map<string, VerificationEvidence[]>();
  if (verificationIds.length > 0) {
    const { data: evidenceRows, error: evidenceError } = await client
      .from("merchant_verification_evidence")
      .select("*")
      .in("verification_id", verificationIds);
    if (evidenceError) throw evidenceError;
    for (const row of Array.isArray(evidenceRows) ? (evidenceRows as Row[]) : []) {
      const verificationId = asString(row.verification_id) ?? "";
      const list = evidenceByVerificationId.get(verificationId) ?? [];
      list.push({
        id: asString(row.id) ?? "",
        method: (asString(row.method) as VerificationEvidence["method"]) ?? "video_walkaround",
        fileUrl: asString(row.file_url) ?? "",
        uploadedAt: asString(row.uploaded_at) ?? new Date().toISOString(),
        reviewNote: asString(row.review_note),
      });
      evidenceByVerificationId.set(verificationId, list);
    }
  }

  for (const row of verificationRows) {
    const outletId = asString(row.outlet_id);
    if (!outletId) continue;
    byOutletId.set(
      outletId,
      toMerchantVerification(row, evidenceByVerificationId.get(asString(row.id) ?? "") ?? []),
    );
  }
  return byOutletId;
}

function toSocialLinks(value: unknown): MerchantOutlet["socialLinks"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const platform = asString((item as Row | null)?.platform);
    const url = asString((item as Row | null)?.url);
    return platform && url ? [{ platform, url }] : [];
  });
}

/** A stored schedule, or undefined when the column is empty or not in the expected shape. */
function toOpeningSchedule(value: unknown): OpeningSchedule | undefined {
  const record = asRecord(value);
  if (!record.weekly || typeof record.weekly !== "object" || Array.isArray(record.weekly)) {
    return undefined;
  }
  const schedule = {
    weekly: record.weekly as OpeningSchedule["weekly"],
    special: Array.isArray(record.special) ? (record.special as OpeningSchedule["special"]) : [],
  };
  try {
    return validateOpeningSchedule(schedule) ? undefined : schedule;
  } catch {
    return undefined;
  }
}

async function toMerchantOutlet(
  client: SupabaseClient,
  row: Row,
  prefetchedVerification?: MerchantOutlet["verification"],
): Promise<MerchantOutlet> {
  const venueId = asString(row.venue_id);
  const venue = venueId ? supabaseRepository.getVenueById(venueId) : undefined;
  const venueDishes = venueId ? supabaseRepository.listDishesByVenue(venueId) : [];
  return {
    id: asString(row.id) ?? "",
    merchantAccountId: asString(row.merchant_account_id) ?? "",
    venueId,
    name: asString(row.name) ?? venue?.name ?? "",
    businessType: (asString(row.business_type) as MerchantOutlet["businessType"]) ?? "hawker_stall",
    buildingId: asString(row.building_id) ?? venue?.buildingId,
    unitNumber: asString(row.unit_number) ?? venue?.unitNumber,
    floor: asString(row.floor) ?? venue?.floor,
    address: asString(row.address),
    postalCode: asString(row.postal_code),
    coordinate:
      asNumber(row.latitude) !== undefined && asNumber(row.longitude) !== undefined
        ? { latitude: asNumber(row.latitude) ?? 0, longitude: asNumber(row.longitude) ?? 0 }
        : undefined,
    openingSchedule: toOpeningSchedule(row.opening_schedule),
    locationPrivacy:
      (asString(row.location_privacy) as MerchantOutlet["locationPrivacy"]) ?? "approximate",
    description: asString(row.description) ?? "",
    cuisineCategories: asStringArray(row.cuisine_categories),
    operatingHours: asString(row.operating_hours) ?? venue?.operatingHours ?? "",
    temporaryClosure: asString(row.temporary_closure),
    profilePhotoUrl: asString(row.profile_photo_url),
    coverPhotoUrl: asString(row.cover_photo_url),
    // The outlet has no gallery of its own; its profile and cover photos are the gallery.
    galleryUrls: [asString(row.profile_photo_url), asString(row.cover_photo_url)].filter(
      (url): url is string => Boolean(url),
    ),
    contactPhone: asString(row.contact_phone),
    contactEmail: asString(row.contact_email),
    socialLinks: toSocialLinks(row.social_links),
    deliveryLinks: venue?.deliveryLinks ?? [],
    dietaryLabels: [],
    tasteTags: [],
    signatureDishIds: venueDishes.slice(0, 3).map((dish) => dish.id),
    isLive: asBoolean(row.is_live) ?? false,
    verification:
      prefetchedVerification ?? (await fetchVerificationForOutlet(client, asString(row.id) ?? "")),
  };
}

async function getMerchantAccountRows(client: SupabaseClient): Promise<Row | null> {
  const userId = await getCurrentSupabaseUserId();
  if (!userId) return null;

  const direct = await client
    .from("merchant_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (direct.error) throw direct.error;
  if (direct.data) return direct.data as Row;

  const role = await client
    .from("merchant_roles")
    .select("merchant_account_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (role.error) throw role.error;
  const accountId = asString((role.data as Row | null)?.merchant_account_id);
  if (!accountId) return null;

  const account = await client
    .from("merchant_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();
  if (account.error) throw account.error;
  return (account.data as Row | null) ?? null;
}

async function getSupabaseMerchantAccount(
  client = requireSupabaseClient(),
): Promise<MerchantAccount | null> {
  const account = await getMerchantAccountRows(client);
  if (!account) return null;
  const { data: outletRows, error } = await client
    .from("merchant_outlets")
    .select("*")
    .eq("merchant_account_id", account.id);
  if (error) throw error;
  const rows = Array.isArray(outletRows) ? (outletRows as Row[]) : [];
  const verifications = await fetchVerificationsForOutlets(
    client,
    rows.map((row) => asString(row.id) ?? ""),
  );
  const outlets = await Promise.all(
    rows.map((row) =>
      toMerchantOutlet(
        client,
        row,
        verifications.get(asString(row.id) ?? "") ?? toMerchantVerification(),
      ),
    ),
  );
  return {
    id: asString(account.id) ?? "",
    userId: asString(account.user_id) ?? "",
    displayName: asString(account.display_name) ?? "",
    email: asString(account.email) ?? "",
    role: "owner",
    outlets,
    createdAt: asString(account.created_at) ?? new Date().toISOString(),
  };
}

/**
 * The merchant_verifications row a merchant (re)submits. It never carries the decision fields
 * (rejected_at, rejection_reason, verified_at, expires_at): the decision guard trigger refuses any
 * merchant write that changes them, so clearing them here made every resubmission after a
 * rejection fail with 42501. The old reason is only shown in the rejected/more-info states.
 */
export function buildVerificationSubmitPayload(outletId: string, method: string, now: Date) {
  return {
    outlet_id: outletId,
    status: "submitted" as const,
    method,
    submitted_at: now.toISOString(),
  };
}

/**
 * Keyset page on (created_at, id) for the merchant review lists. A plain `created_at < before`
 * skipped every row that shared the boundary timestamp with the last row of the previous page.
 */
function applyMerchantReviewKeyset<
  Q extends { lt(column: string, value: string): Q; or(filter: string): Q },
>(query: Q, before: string | undefined, beforeId: string | undefined): Q {
  if (!before) return query;
  if (!beforeId) return query.lt("created_at", before);
  return query.or(`created_at.lt."${before}",and(created_at.eq."${before}",id.lt."${beforeId}")`);
}

async function getMerchantOutletRow(client: SupabaseClient, outletId: string): Promise<Row> {
  if (UUID_PATTERN.test(outletId)) {
    const { data, error } = await client
      .from("merchant_outlets")
      .select("*")
      .eq("id", outletId)
      .single();
    if (error) throw error;
    return data as Row;
  }

  const account = await getMerchantAccountRows(client);
  const accountId = asString(account?.id);
  if (!accountId) {
    throw new Error("Merchant account is not available for the current Supabase user.");
  }

  const { data, error } = await client
    .from("merchant_outlets")
    .select("*")
    .eq("merchant_account_id", accountId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(`Merchant outlet ${outletId} was not found for the current Supabase user.`);
  }
  return data as Row;
}

function mapSupabaseDish(row: Row, venue?: Row, presentation?: DishPresentation): DishDetail {
  const gallery = presentation?.gallery ?? [];
  const imageUrl = gallery[0] ?? asString(row.image_url) ?? "";
  return {
    id: asString(row.id) ?? "",
    venueId: asString(row.venue_id) ?? asString(venue?.id) ?? "",
    buildingId: asString(row.building_id) ?? asString(venue?.building_id) ?? "",
    venueName: asString(venue?.name) ?? "",
    unitNumber: asString(venue?.unit_number) ?? "",
    floor: asString(venue?.floor) ?? "",
    name: asString(row.name) ?? "",
    imageUrl,
    blurhash: asString(row.blurhash),
    distanceMeters: asNumber(row.distance_meters) ?? 0,
    rating: asNumber(row.rating_avg) ?? 0,
    reviewCount: asNumber(row.review_count) ?? 0,
    price: asNumber(row.price) ?? 0,
    priceRange: asString(row.price_range) ?? "",
    liveCrowd: (asString(row.live_crowd) as DishDetail["liveCrowd"]) ?? undefined,
    tasteTags: asStringArray(row.taste_tags),
    tasteVector: presentation?.tasteVector ?? { ...NEUTRAL_TASTE_VECTOR },
    dietaryFlags: presentation?.dietaryFlags ?? [],
    gallery: gallery.length > 0 ? gallery : imageUrl ? [imageUrl] : [],
    description: asString(row.description),
    mustOrder: asBoolean(row.must_order) ?? false,
    availabilityFlags: asStringArray(row.availability_flags),
    reviews: [],
  };
}

async function fetchDishPresentationMap(
  client: SupabaseClient,
  dishIds: string[],
): Promise<Map<string, DishPresentation>> {
  const uniqueDishIds = Array.from(new Set(dishIds.filter(Boolean)));
  const presentationByDishId = new Map<string, DishPresentation>();
  if (uniqueDishIds.length === 0) return presentationByDishId;

  const [imageRows, vectorRows, linkRows, flagRows] = await Promise.all([
    client.from("dish_images").select("dish_id,url,sort_order").in("dish_id", uniqueDishIds),
    client
      .from("dish_taste_vectors")
      .select("dish_id,sweet,spicy,sour,salty,rich,aromatic")
      .in("dish_id", uniqueDishIds),
    client
      .from("dish_dietary_flags")
      .select("dish_id,dietary_flag_id")
      .in("dish_id", uniqueDishIds),
    client.from("dietary_flags").select("id,slug"),
  ]);

  const ensurePresentation = (dishId: string): DishPresentation => {
    const existing = presentationByDishId.get(dishId);
    if (existing) return existing;
    const next = { gallery: [], dietaryFlags: [] };
    presentationByDishId.set(dishId, next);
    return next;
  };

  if (!imageRows.error && Array.isArray(imageRows.data)) {
    (imageRows.data as Row[])
      .slice()
      .sort((left, right) => (asNumber(left.sort_order) ?? 0) - (asNumber(right.sort_order) ?? 0))
      .forEach((row) => {
        const dishId = asString(row.dish_id) ?? "";
        const url = asString(row.url) ?? "";
        if (!dishId || !url) return;
        const presentation = ensurePresentation(dishId);
        if (!presentation.gallery.includes(url)) presentation.gallery.push(url);
      });
  }

  if (!vectorRows.error && Array.isArray(vectorRows.data)) {
    (vectorRows.data as Row[]).forEach((row) => {
      const dishId = asString(row.dish_id) ?? "";
      if (!dishId) return;
      ensurePresentation(dishId).tasteVector = toTasteVector(row);
    });
  }

  const flagSlugById = new Map<string, string>();
  if (!flagRows.error && Array.isArray(flagRows.data)) {
    (flagRows.data as Row[]).forEach((row) => {
      const id = asString(row.id) ?? "";
      const slug = asString(row.slug) ?? "";
      if (id && slug) flagSlugById.set(id, slug);
    });
  }

  if (!linkRows.error && Array.isArray(linkRows.data)) {
    (linkRows.data as Row[]).forEach((row) => {
      const dishId = asString(row.dish_id) ?? "";
      const slug = flagSlugById.get(asString(row.dietary_flag_id) ?? "");
      if (!dishId || !slug) return;
      const presentation = ensurePresentation(dishId);
      if (!presentation.dietaryFlags.includes(slug as DietaryFlag)) {
        presentation.dietaryFlags.push(slug as DietaryFlag);
      }
    });
  }

  return presentationByDishId;
}

async function fetchVenueRow(client: SupabaseClient, venueId: string): Promise<Row | undefined> {
  const { data, error } = await client.from("venues").select("*").eq("id", venueId).maybeSingle();
  if (error) throw error;
  return (data as Row | null) ?? undefined;
}

async function requireLinkedMerchantOutlet(client: SupabaseClient, outletId: string): Promise<Row> {
  const outlet = await getMerchantOutletRow(client, outletId);
  if (!asString(outlet.venue_id)) {
    throw new Error("Merchant outlet is not linked to a consumer venue.");
  }
  return outlet;
}

async function listPromotionOutletDishIds(client: SupabaseClient, outlet: Row): Promise<string[]> {
  const venueId = asString(outlet.venue_id);
  if (!venueId) return [];
  const { data, error } = await client.from("dishes").select("id").eq("venue_id", venueId);
  if (error) throw error;
  return (Array.isArray(data) ? (data as Row[]) : [])
    .map((row) => asString(row.id))
    .filter((id): id is string => !!id);
}

function mapPopularVisitorPin(row: Row): PopularVisitorPin {
  return {
    id: asString(row.id) ?? "",
    outletId: asString(row.outlet_id) ?? "",
    venueId: asString(row.venue_id) ?? "",
    reviewId: asString(row.review_id) ?? "",
    sourceId: asString(row.source_id) ?? asString(row.review_id) ?? "",
    authorProfileId: asString(row.author_profile_id),
    authorName: asString(row.author_name) ?? "Hungry diner",
    authorAvatarUrl: asString(row.author_avatar_url),
    authorLocation: asString(row.author_location),
    reviewText: asString(row.review_text) ?? "",
    rating: asNumber(row.rating) ?? 0,
    dishName: asString(row.dish_name),
    visitedAt: asString(row.visited_at) ?? asString(row.created_at) ?? new Date().toISOString(),
    pinnedAt: asString(row.pinned_at) ?? new Date().toISOString(),
    sortOrder: asNumber(row.sort_order) ?? 0,
    isActive: asBoolean(row.is_active) ?? true,
  };
}

async function listSupabasePopularVisitorPinsForOutlet(
  client: SupabaseClient,
  outletId: string,
): Promise<PopularVisitorPin[]> {
  const { data, error } = await client
    .from("merchant_popular_visitor_pins")
    .select("*")
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("pinned_at", { ascending: false })
    .limit(6);
  if (error) throw error;
  return (Array.isArray(data) ? (data as Row[]) : []).map(mapPopularVisitorPin);
}

async function listSupabasePopularVisitorPinsForVenue(
  client: SupabaseClient,
  venueId: string,
): Promise<PopularVisitorPin[]> {
  const { data, error } = await client
    .from("merchant_popular_visitor_pins")
    .select("*")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("pinned_at", { ascending: false })
    .limit(6);
  if (error) throw error;
  return (Array.isArray(data) ? (data as Row[]) : []).map(mapPopularVisitorPin);
}

async function fetchSafeProfileRowsById(
  client: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, Row>> {
  const uniqueIds = Array.from(new Set(profileIds.filter((id) => UUID_PATTERN.test(id))));
  const profileById = new Map<string, Row>();
  if (uniqueIds.length === 0) return profileById;

  const { data, error } = await client
    .from("public_profiles")
    .select("id,display_name,avatar_url")
    .in("id", uniqueIds);
  if (error || !Array.isArray(data)) return profileById;

  (data as Row[]).forEach((row) => {
    const id = asString(row.id);
    if (id) profileById.set(id, row);
  });
  return profileById;
}

/** Random id so two dishes saved in the same millisecond, or on two phones, never collide. */
function createMerchantDishId(): string {
  return `merchant-dish-${createClientReviewId()}`;
}

function toTasteVectorJson(tasteVector: TasteVector | undefined): Row | null {
  if (tasteVector === undefined) return null;
  return {
    sweet: tasteVector.sweet,
    spicy: tasteVector.spicy,
    sour: tasteVector.sour,
    salty: tasteVector.salty,
    rich: tasteVector.rich,
    aromatic: tasteVector.aromatic,
  };
}

function buildDishPayload(outlet: Row, dish: Partial<DishDetail>): Row {
  const venueId = asString(outlet.venue_id) ?? "";
  const buildingId = asString(outlet.building_id) ?? "";
  const price = asNumber(dish.price) ?? 0;
  const imageUrl = dish.imageUrl ?? dish.gallery?.[0] ?? null;
  return {
    id: dish.id ?? createMerchantDishId(),
    venue_id: venueId,
    building_id: buildingId,
    name: dish.name ?? "New dish",
    description: dish.description ?? null,
    image_url: imageUrl,
    blurhash: dish.blurhash ?? null,
    price,
    price_range: dish.priceRange ?? `S$${price.toFixed(2)}`,
    taste_tags: dish.tasteTags ?? [],
    must_order: dish.mustOrder ?? false,
    availability_flags: dish.availabilityFlags ?? [],
  };
}

function buildDishUpdatePayload(updates: Partial<DishDetail>): Row {
  const payload: Row = {};
  if (updates.buildingId !== undefined) payload.building_id = updates.buildingId;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description || null;
  if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl || null;
  if (updates.gallery !== undefined && updates.imageUrl === undefined) {
    payload.image_url = updates.gallery[0] ?? null;
  }
  if (updates.blurhash !== undefined) payload.blurhash = updates.blurhash ?? null;
  if (updates.price !== undefined) payload.price = updates.price;
  if (updates.priceRange !== undefined) payload.price_range = updates.priceRange;
  if (updates.price !== undefined && updates.priceRange === undefined) {
    payload.price_range = `S$${updates.price.toFixed(2)}`;
  }
  if (updates.tasteTags !== undefined) payload.taste_tags = updates.tasteTags;
  if (updates.mustOrder !== undefined) payload.must_order = updates.mustOrder;
  if (updates.availabilityFlags !== undefined)
    payload.availability_flags = updates.availabilityFlags;
  return payload;
}

function isMerchantDishImageUrl(url: string): boolean {
  return /^https:\/\/[^/]+\/storage\/v1\/object\/public\/merchant-dish-images\//.test(url);
}

async function resolveMerchantDishGalleryUrls(
  client: SupabaseClient,
  outlet: Row,
  dishId: string,
  dish: Partial<DishDetail>,
): Promise<string[] | undefined> {
  if (dish.imageUrl === undefined && dish.gallery === undefined) return undefined;

  const requestedUrls = Array.from(
    new Set([dish.imageUrl, ...(dish.gallery ?? [])].filter((url): url is string => Boolean(url))),
  );
  if (requestedUrls.length === 0) return [];

  const userId = await getCurrentSupabaseUserId();
  const venueId = asString(outlet.venue_id) ?? "unlinked";
  const safeDishId = sanitizeStorageSegment(dishId);
  const uploadedUrls: string[] = [];

  for (let index = 0; index < requestedUrls.length; index += 1) {
    const url = requestedUrls[index];
    // Photos already uploaded to the merchant bucket are kept as they are, so
    // editing a dish's name or price does not force a re-upload.
    if (isMerchantDishImageUrl(url)) {
      uploadedUrls.push(url);
      continue;
    }
    assertLocalUserMediaUri(url, "Merchant dish image");
    if (!userId) throw new Error("You must be signed in to upload merchant dish images.");
    const extension = extensionFromUri(url);
    const uploaded = await uploadImageFromUri({
      client,
      bucket: "merchant-dish-images",
      path: `${userId}/${venueId}/${safeDishId}/image-${index}-${Date.now()}.${extension}`,
      uri: url,
    });
    uploadedUrls.push(uploaded.publicUrl);
  }

  return uploadedUrls;
}

async function saveMerchantDish(
  client: SupabaseClient,
  outlet: Row,
  dishId: string,
  fields: Row,
  children: {
    galleryUrls: string[] | undefined;
    dietaryFlags: DietaryFlag[] | undefined;
    tasteVector: TasteVector | undefined;
  },
): Promise<Row> {
  const venueId = asString(outlet.venue_id) ?? "";
  const dishFields: Row = { ...fields };
  delete dishFields.id;
  delete dishFields.venue_id;
  // One transaction: the dish, its photos, dietary labels and taste vector save together or not at all.
  const { error } = await client.rpc("merchant_save_dish", {
    p_dish_id: dishId,
    p_venue_id: venueId,
    p_building_id: asString(outlet.building_id) ?? asString(fields.building_id) ?? "",
    p_fields: dishFields,
    p_gallery_urls: children.galleryUrls ?? null,
    p_dietary_slugs:
      children.dietaryFlags === undefined ? null : Array.from(new Set(children.dietaryFlags)),
    p_taste_vector: toTasteVectorJson(children.tasteVector),
  });
  if (error) throw error;
  const { data, error: readError } = await client
    .from("dishes")
    .select("*")
    .eq("id", dishId)
    .eq("venue_id", venueId)
    .single();
  if (readError) throw readError;
  return data as Row;
}

async function setMerchantDishFlag(
  client: SupabaseClient,
  outlet: Row,
  dishId: string,
  flag: "sold_out" | "featured",
  enabled?: boolean,
): Promise<boolean> {
  const { data, error } = await client.rpc("merchant_set_dish_availability_flag", {
    p_dish_id: dishId,
    p_venue_id: asString(outlet.venue_id) ?? "",
    p_flag: flag,
    p_enabled: enabled ?? null,
  });
  if (error) throw error;
  return data === true;
}

function buildPromotionAnalytics(
  promotion: Pick<MerchantPromotion, "status" | "analytics">,
): NonNullable<MerchantPromotion["analytics"]> {
  if (promotion.analytics) return promotion.analytics;
  if (promotion.status === "draft" || promotion.status === "scheduled") {
    return { impressions: 0, clicks: 0, saves: 0, profileVisits: 0, dishViews: 0 };
  }
  return { impressions: 0, clicks: 0, saves: 0, profileVisits: 0, dishViews: 0 };
}

/** Ops moves a claim new -> contacted -> qualified -> converted (or rejected). */
function toClaimStatus(status: string | null): MerchantClaimStatus {
  switch (status) {
    case "new":
      return "submitted";
    case "contacted":
    case "qualified":
      return "in_review";
    case "converted":
      return "approved";
    case "rejected":
      return "rejected";
    default:
      return "none";
  }
}

function mapPublicMerchantProfile(row: Row): PublicMerchantProfile {
  return {
    outletId: asString(row.outlet_id) ?? "",
    description: asString(row.description),
    contactPhone: asString(row.contact_phone),
    contactEmail: asString(row.contact_email),
    socialLinks: toSocialLinks(row.social_links),
    cuisineCategories: asStringArray(row.cuisine_categories),
    profilePhotoUrl: asString(row.profile_photo_url),
    coverPhotoUrl: asString(row.cover_photo_url),
    temporaryClosure: asString(row.temporary_closure),
    isVerified: asBoolean(row.is_verified) ?? false,
  } satisfies PublicMerchantProfile;
}

function mapPromotion(row: Row): MerchantPromotion {
  const status = (asString(row.status) as PromotionStatus) ?? "draft";
  const analytics = {
    impressions: asNumber(row.impressions) ?? 0,
    clicks: asNumber(row.clicks) ?? 0,
    saves: asNumber(row.saves) ?? 0,
    profileVisits: asNumber(row.profile_visits) ?? 0,
    dishViews: asNumber(row.dish_views) ?? 0,
  };
  return {
    id: asString(row.id) ?? "",
    outletId: asString(row.outlet_id) ?? "",
    title: asString(row.title) ?? "",
    description: asString(row.description) ?? "",
    targetDishId: asString(row.target_dish_id),
    startDate: asString(row.start_date) ?? new Date().toISOString(),
    endDate: asString(row.end_date) ?? new Date().toISOString(),
    targetAudience: asStringArray(row.target_audience) as MerchantPromotion["targetAudience"],
    status,
    promotionItemType:
      asString(row.promotion_item_type) === "existing_menu_item"
        ? "existing_menu_item"
        : "new_item",
    originalPrice: asNumber(row.original_price),
    promotionalPrice: asNumber(row.promotional_price),
    finalPrice: asNumber(row.final_price),
    discountPercentage: asNumber(row.discount_percentage),
    isAvailable: asBoolean(row.is_available) ?? status === "active",
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
    analytics,
  };
}

function mapMerchantNotification(row: Row): MerchantNotification {
  return {
    id: asString(row.id) ?? "",
    merchantAccountId: asString(row.merchant_account_id) ?? "",
    outletId: asString(row.outlet_id),
    recipientUserId: asString(row.recipient_user_id),
    recipientEmail: asString(row.recipient_email),
    kind: (asString(row.kind) as MerchantNotification["kind"]) ?? "ai_insight",
    title: asString(row.title) ?? "",
    body: asString(row.body) ?? "",
    status: (asString(row.status) as MerchantNotification["status"]) ?? "unread",
    dedupeKey: asString(row.dedupe_key) ?? "",
    deepLink: asString(row.deep_link),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (asRecord(row.metadata) as Record<string, string | number | boolean | null>)
        : undefined,
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
  };
}

/**
 * The Settings weekly card. Review numbers come from the 7-day analytics, not from an inbox page:
 * the inbox read was all-time and capped, so "new reviews this week" counted old reviews.
 */
export function buildWeeklySummaryFromAnalytics(
  outletId: string,
  analytics: MerchantAnalytics,
  unrepliedReviews: number,
  promotions: MerchantPromotion[],
): MerchantWeeklySummary {
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
    newReviews: analytics.reviewCount,
    averageRating: analytics.averageRating,
    ratingChange: analytics.averageRating - analytics.previousPeriodComparison.averageRating,
    unrepliedReviews,
    promotionViews: promotions.reduce(
      (sum, promotion) => sum + (promotion.analytics?.impressions ?? 0),
      0,
    ),
    createdAt: now.toISOString(),
  };
}

async function signInWithOAuthProvider(provider: "google" | "apple"): Promise<Session> {
  const client = requireSupabaseClient();
  const redirectTo = AUTH_REDIRECTS.oauth;
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) {
    throw new Error("OAuth provider URL was not generated.");
  }

  const expectedState = getOAuthStateFromUrl(data.url);
  WebBrowser.maybeCompleteAuthSession();
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) {
    throw new Error("OAuth sign-in was cancelled.");
  }
  if (!callbackBaseMatches(result.url, redirectTo)) {
    throw new Error("OAuth callback URL was not trusted.");
  }
  if (expectedState && getOAuthStateFromUrl(result.url) !== expectedState) {
    throw new Error("OAuth callback state did not match the sign-in request.");
  }

  const { accessToken, refreshToken, code } = getAuthTokensFromCallback(result.url);
  if (accessToken || refreshToken) {
    throw new Error("OAuth callback token fragments are not accepted.");
  } else if (code) {
    const { data: exchangeData, error: exchangeError } =
      await client.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    const exchangedSession = exchangeData.session;
    if (!exchangedSession?.user) {
      throw new Error("OAuth flow completed but no active session was found.");
    }

    // Authentication is complete at this point. Provisioning and reading the
    // profile are non-critical and happen after the app shell is available.
    // Keep this chain ordered so a new OAuth account cannot hydrate before its
    // profile row has been created.
    const profileReady = ensureCurrentUserProfileRow(client, exchangedSession.user).then(() =>
      fetchUserProfile(client, exchangedSession.user.id, exchangedSession.user.email ?? undefined),
    );
    return toAppSessionFromAuthSession(
      exchangedSession,
      provisionalProfileFromAuthSession(exchangedSession),
      profileReady,
    );
  } else {
    throw new Error("OAuth callback did not include session credentials.");
  }
}

function participantKey(participant: ChatParticipant): string {
  return participant.kind === "merchant"
    ? `merchant:${participant.merchantAccountId ?? ""}`
    : `user:${participant.userId ?? ""}`;
}

function buildConversationDedupeKey(
  currentUserId: string,
  target: ChatParticipant,
  type: "user" | "merchant",
): string {
  if (type === "merchant") {
    return `merchant:${currentUserId}:${target.merchantAccountId ?? target.userId ?? ""}`;
  }
  return ["user", currentUserId, target.userId ?? ""].sort().join(":");
}

function toFallbackParticipant(row: Row, currentUserId: string): ChatParticipant {
  const participantKind = asString(row.participant_kind) === "merchant" ? "merchant" : "user";
  const userId = asString(row.participant_user_id);
  const merchantAccountId = asString(row.participant_merchant_account_id);
  return {
    kind: participantKind,
    userId,
    merchantAccountId,
    displayName:
      participantKind === "merchant"
        ? `Merchant ${merchantAccountId?.slice(0, 6) ?? ""}`.trim()
        : userId === currentUserId
          ? "You"
          : `User ${userId?.slice(0, 6) ?? ""}`.trim(),
    isCurrentUser: userId === currentUserId,
  };
}

async function hydrateChatParticipants(
  client: SupabaseClient,
  participantRows: Row[],
  currentUserId: string,
): Promise<Map<string, ChatParticipant>> {
  const userIds = Array.from(
    new Set(
      participantRows
        .map((row) => asString(row.participant_user_id))
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );
  const merchantIds = Array.from(
    new Set(
      participantRows
        .map((row) => asString(row.participant_merchant_account_id))
        .filter((merchantId): merchantId is string => Boolean(merchantId)),
    ),
  );

  const profileRows = new Map<string, Row>();
  if (userIds.length > 0) {
    const { data } = await client
      .from("public_profiles")
      .select("id,display_name,avatar_url")
      .in("id", userIds);
    (Array.isArray(data) ? (data as Row[]) : []).forEach((row) => {
      const id = asString(row.id);
      if (id) profileRows.set(id, row);
    });
  }

  const merchantRows = new Map<string, Row>();
  if (merchantIds.length > 0) {
    const { data } = await client
      .from("merchant_accounts")
      .select("id,display_name")
      .in("id", merchantIds);
    (Array.isArray(data) ? (data as Row[]) : []).forEach((row) => {
      const id = asString(row.id);
      if (id) merchantRows.set(id, row);
    });
  }

  const participants = new Map<string, ChatParticipant>();
  participantRows.forEach((row) => {
    const fallback = toFallbackParticipant(row, currentUserId);
    const profile = fallback.userId ? profileRows.get(fallback.userId) : undefined;
    const merchant = fallback.merchantAccountId
      ? merchantRows.get(fallback.merchantAccountId)
      : undefined;
    const participant: ChatParticipant = {
      ...fallback,
      displayName:
        asString(profile?.display_name) ?? asString(merchant?.display_name) ?? fallback.displayName,
      avatarUrl: asString(profile?.avatar_url) ?? fallback.avatarUrl,
    };
    participants.set(participantKey(participant), participant);
  });
  return participants;
}

function mapChatMessage(
  row: Row,
  currentUserId: string,
  participantsByKey: Map<string, ChatParticipant>,
): ChatMessage {
  const senderUserId = asString(row.sender_user_id);
  const senderMerchantAccountId = asString(row.sender_merchant_account_id);
  const senderKind = senderMerchantAccountId ? "merchant" : "user";
  const fallbackSender: ChatParticipant = {
    kind: senderKind,
    userId: senderUserId,
    merchantAccountId: senderMerchantAccountId,
    displayName:
      senderUserId === currentUserId
        ? "You"
        : senderKind === "merchant"
          ? `Merchant ${senderMerchantAccountId?.slice(0, 6) ?? ""}`.trim()
          : `User ${senderUserId?.slice(0, 6) ?? ""}`.trim(),
    isCurrentUser: senderUserId === currentUserId,
  };
  const sender = participantsByKey.get(participantKey(fallbackSender)) ?? fallbackSender;
  return {
    id: asString(row.id) ?? "",
    conversationId: asString(row.conversation_id) ?? "",
    body: asString(row.body) ?? "",
    sender,
    sentByCurrentUser: senderUserId === currentUserId,
    clientNonce: asString(row.client_nonce),
    deliveredAt: asString(row.delivered_at),
    readAt: asString(row.read_at),
    createdAt: asString(row.created_at) ?? new Date().toISOString(),
  };
}

async function listConversationParticipantRows(
  client: SupabaseClient,
  conversationIds?: string[],
): Promise<Row[]> {
  const query = client
    .from("conversation_participants")
    .select(
      "conversation_id,participant_kind,participant_user_id,participant_merchant_account_id,last_read_at,joined_at",
    );
  const { data, error } =
    conversationIds && conversationIds.length > 0
      ? await query.in("conversation_id", conversationIds)
      : await query;
  if (error) throw error;
  return Array.isArray(data) ? (data as Row[]) : [];
}

async function listMessagesForConversations(
  client: SupabaseClient,
  conversationIds: string[],
): Promise<Row[]> {
  if (conversationIds.length === 0) return [];
  const { data, error } = await client
    .from("messages")
    .select(
      "id,conversation_id,sender_user_id,sender_merchant_account_id,body,client_nonce,delivered_at,created_at",
    )
    .in("conversation_id", conversationIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? (data as Row[]) : [];
}

async function listReadReceiptsForMessages(
  client: SupabaseClient,
  conversationId: string,
  messageIds: string[],
): Promise<Map<string, string>> {
  if (messageIds.length === 0) return new Map();
  const { data, error } = await client
    .from("read_receipts")
    .select("message_id,read_at")
    .eq("conversation_id", conversationId)
    .in("message_id", messageIds)
    .order("read_at", { ascending: false });
  if (error) throw error;
  const readAtByMessageId = new Map<string, string>();
  (Array.isArray(data) ? (data as Row[]) : []).forEach((row) => {
    const messageId = asString(row.message_id);
    const readAt = asString(row.read_at);
    if (messageId && readAt && !readAtByMessageId.has(messageId)) {
      readAtByMessageId.set(messageId, readAt);
    }
  });
  return readAtByMessageId;
}

async function mapConversationRows(
  client: SupabaseClient,
  conversationRows: Row[],
  participantRows: Row[],
  messageRows: Row[],
  currentUserId: string,
): Promise<ChatConversation[]> {
  const participantsByKey = await hydrateChatParticipants(client, participantRows, currentUserId);
  return conversationRows
    .map((conversation) => {
      const conversationId = asString(conversation.id) ?? "";
      const participants = participantRows
        .filter((row) => asString(row.conversation_id) === conversationId)
        .map((row) => {
          const fallback = toFallbackParticipant(row, currentUserId);
          return participantsByKey.get(participantKey(fallback)) ?? fallback;
        });
      const ownParticipantRow = participantRows.find(
        (row) =>
          asString(row.conversation_id) === conversationId &&
          asString(row.participant_user_id) === currentUserId,
      );
      const lastReadAt = new Date(asString(ownParticipantRow?.last_read_at) ?? 0).getTime();
      const conversationMessages = messageRows.filter(
        (row) => asString(row.conversation_id) === conversationId,
      );
      const latestMessage = conversationMessages[conversationMessages.length - 1];
      const unreadCount = conversationMessages.filter((row) => {
        const sentByCurrentUser = asString(row.sender_user_id) === currentUserId;
        const createdAt = new Date(asString(row.created_at) ?? 0).getTime();
        return !sentByCurrentUser && (!Number.isFinite(lastReadAt) || createdAt > lastReadAt);
      }).length;
      const otherParticipant =
        participants.find((participant) => !participant.isCurrentUser) ?? participants[0];
      return {
        id: conversationId,
        type: asString(conversation.conversation_type) === "merchant" ? "merchant" : "user",
        title: otherParticipant?.displayName ?? "Conversation",
        avatarUrl: otherParticipant?.avatarUrl,
        participants,
        lastMessage: asString(latestMessage?.body),
        lastMessageAt: asString(latestMessage?.created_at),
        unreadCount,
        updatedAt: asString(conversation.updated_at) ?? new Date().toISOString(),
      } satisfies ChatConversation;
    })
    .filter((conversation) => conversation.id.length > 0)
    .sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
}

export const supabaseService: HungryService = {
  auth: {
    async signUp(email, password, name) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.signUp({
        email: normalizeAuthEmail(email),
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: AUTH_REDIRECTS.emailConfirm,
        },
      });
      if (error) throw error;
      // When email confirmation is required, Supabase returns no session yet.
      // Return null so the caller can show the "check your email" flow instead of throwing.
      return await toAppSession(client);
    },

    async resendVerificationEmail(email) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.resend({
        type: "signup",
        email: normalizeAuthEmail(email),
        options: {
          emailRedirectTo: AUTH_REDIRECTS.emailConfirm,
        },
      });
      if (error) throw error;
    },

    async confirmEmail(code) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
      const session = await toAppSession(client);
      if (!session) throw new Error("Email confirmed but no active session.");
      return session;
    },

    async verifyEmailCode(email, code, type) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.verifyOtp({
        email: normalizeAuthEmail(email),
        token: code.trim(),
        type,
      });
      if (error) throw error;
      return await toAppSession(client);
    },

    async signInWithEmailCode(email, options) {
      const client = requireSupabaseClient();
      const displayName = options?.displayName?.trim();
      const { error } = await client.auth.signInWithOtp({
        email: normalizeAuthEmail(email),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: AUTH_REDIRECTS.emailConfirm,
          // Applied only when this creates the account; an existing account keeps its name.
          ...(displayName ? { data: { display_name: displayName } } : {}),
        },
      });
      if (error) throw error;
    },

    async signIn(email, password) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.signInWithPassword({
        email: normalizeAuthEmail(email),
        password,
      });
      if (error) throw error;
      const session = await toAppSession(client);
      if (!session) throw new Error("Sign-in succeeded but no active session.");
      return session;
    },

    async signInWithGoogle() {
      return signInWithOAuthProvider("google");
    },

    async signInWithApple() {
      return signInWithOAuthProvider("apple");
    },

    async signOut(options) {
      const client = requireSupabaseClient();
      // supabase-js defaults to "global", which would end every device's session: a
      // plain sign-out only ends this one. "global" and "others" are explicit
      // choices, so a failed revoke is reported instead of quietly ending only this device.
      const scope = options?.scope ?? "local";
      const { error } = await client.auth.signOut({ scope });
      if (!error) return;
      if (scope !== "local") throw error;
      // A failed server revoke (offline) returns before supabase-js removes the stored
      // session, and a second signOut({ scope: "local" }) calls the server again and fails
      // the same way. Remove the stored session directly (this also emits SIGNED_OUT), so
      // the next launch does not sign the user back in.
      await (client.auth as unknown as { _removeSession(): Promise<void> })._removeSession();
    },

    async getAccountDeletionBlocker() {
      const { data, error } = await requireSupabaseClient().rpc("get_my_account_deletion_blocker");
      if (error) throw error;
      return data === "merchant_owner_must_transfer" ? "merchant_owner_must_transfer" : null;
    },

    async sendAccountDeletionCode() {
      const client = requireSupabaseClient();
      const { data, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const email = data.user?.email;
      if (!email) throw new Error(NO_ACCOUNT_EMAIL_MESSAGE);
      // An email OTP (not reauthenticate(), whose nonce only updateUser accepts) so the
      // code can be checked with verifyOtp. Works for Google and Apple accounts too.
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
    },

    async requestAccountDeletion(request) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to request account deletion.");
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const email = userData.user?.email;
      const code = request?.code?.trim();
      if (!email || !code) throw new Error("Enter the code we emailed you.");
      // Proves the person deleting can read the account's email, right before the RPC.
      const { data: verified, error: codeError } = await client.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (codeError) throw codeError;
      if (verified.user?.id !== userId) throw new Error("That code is for a different account.");

      // The server sets scheduled_for and status; a repeat request returns the pending date
      // (20261020050000_request_my_account_deletion.sql).
      const { data, error } = await client.rpc("request_my_account_deletion", {
        p_reason: request?.reason ?? "user_initiated_settings_flow",
      });
      if (error) throw error;
      const scheduledFor = asString(data);
      if (!scheduledFor) throw new Error("The deletion request did not return a date.");

      // The request is queued; a failed token unbind must not report the deletion
      // itself as failed. No sign-out here: the caller purges local data first,
      // records a confirmation notice, then signs out through the session store.
      await unregisterStoredPushToken(client).catch(() => undefined);
      // Ending every device's session happens in the caller, after its local purge.
      return { scheduledFor };
    },

    async getPendingAccountDeletion() {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return null;

      const { data, error } = await client
        .from("account_deletion_requests")
        .select("scheduled_for")
        .eq("user_id", userId)
        .eq("status", "requested")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const scheduledFor = asString((data as Row | null)?.scheduled_for);
      return scheduledFor ? { scheduledFor } : null;
    },

    async cancelAccountDeletion() {
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("cancel_my_account_deletion");
      if (error) throw error;
      return data === true;
    },

    async isAccountDeletionProcessing() {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return false;
      const { data, error } = await client
        .from("account_deletion_requests")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "processing")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },

    async forgotPassword(email) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.resetPasswordForEmail(normalizeAuthEmail(email), {
        redirectTo: AUTH_REDIRECTS.passwordReset,
      });
      if (error) throw error;
    },

    async exchangeRecoveryCode(token) {
      const client = requireSupabaseClient();
      await exchangeRecoveryCodeIfPresent(client, token);
    },

    async updatePassword(password) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    },

    async canChangePassword() {
      const client = getSupabaseClient();
      if (!client) return false;
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return false;
      return hasEmailPasswordIdentity(data.user);
    },

    async changePassword(currentPassword, newPassword) {
      const client = requireSupabaseClient();
      const { data, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const user = data.user;
      if (!user) throw new Error("You must be signed in to change your password.");
      if (!user.email || !hasEmailPasswordIdentity(user)) {
        throw new Error("This account signs in with Google or Apple and has no password.");
      }
      // Re-authenticate so a stolen unlocked session cannot silently swap the password.
      const { error: reauthError } = await client.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        // Only a wrong password is "incorrect"; a network error or rate limit must reach the
        // screen as itself.
        if (getAuthErrorCode(reauthError) === "invalid_credentials") {
          throw new Error("Current password is incorrect.");
        }
        throw reauthError;
      }
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },

    async requestEmailChange(newEmail) {
      const client = requireSupabaseClient();
      // Supabase (secure email change) emails links to both the current and new address;
      // auth.users.email changes only after they are opened.
      const { error } = await client.auth.updateUser(
        { email: newEmail.trim().toLowerCase() },
        { emailRedirectTo: AUTH_REDIRECTS.emailChange },
      );
      if (error) throw error;
    },

    async markOnboarded() {
      const client = requireSupabaseClient();
      // The stored session already carries user_metadata, so the check costs no request.
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user || user.user_metadata?.onboarded_at) return;
      const { error } = await client.auth.updateUser({
        data: { onboarded_at: new Date().toISOString() },
      });
      if (error) throw error;
    },
    async getPendingEmailChange() {
      const client = getSupabaseClient();
      if (!client) return null;
      const { data, error } = await client.auth.getUser();
      if (error) return null;
      // Supabase keeps the requested address in new_email until it is confirmed.
      return asString((data.user as { new_email?: unknown } | null)?.new_email) ?? null;
    },

    async getCurrentSession() {
      const client = getSupabaseClient();
      if (!client) return null;
      return toAppSession(client);
    },

    async refreshSession() {
      const client = getSupabaseClient();
      if (!client) return null;
      const { error } = await client.auth.refreshSession();
      if (error) throw error;
      return toAppSession(client);
    },
  },

  discovery: {
    async listBuildings(lat, lng, radiusMeters) {
      return (
        (await listBuildingsViaRpc(lat, lng, radiusMeters)) ?? supabaseRepository.listBuildings()
      );
    },

    async countVenuesInArea(lat, lng, radiusMeters, areaName) {
      const exactCount = await countVenuesInAreaViaRpc(lat, lng, radiusMeters, areaName);
      if (typeof exactCount === "number") return exactCount;

      const locationBuildings = await listBuildingsViaRpc(lat, lng, radiusMeters);
      if (locationBuildings) {
        return locationBuildings.reduce((total, building) => total + building.venueCount, 0);
      }
      return undefined;
    },

    async getBuildingDetail(id) {
      const rpcDetail = await getBuildingDetailViaRpc(id);
      if (rpcDetail) return rpcDetail;
      const building = supabaseRepository.listBuildings().find((item) => item.id === id);
      if (!building) return undefined;
      const venues = supabaseRepository.listVenuesByBuilding(id);
      const venueDishes = venues.flatMap((venue) => supabaseRepository.listDishesByVenue(venue.id));
      return {
        ...building,
        address: "",
        postalCode: "",
        operatingHours: "",
        description: undefined,
        famousDishes: venueDishes.slice(0, 4).map((dish) => dish.name),
        totalStalls: venues.length,
        openStalls: venues.filter((venue) => venue.isOpen).length,
        avgRating:
          venueDishes.length === 0
            ? 0
            : venueDishes.reduce((sum, dish) => sum + dish.rating, 0) / venueDishes.length,
      } satisfies BuildingDetail;
    },

    async getFloorPlan(buildingId, floor) {
      return getFloorPlan(buildingId, floor);
    },

    async listFloors(buildingId) {
      return (
        supabaseRepository.listBuildings().find((building) => building.id === buildingId)?.floors ??
        []
      );
    },

    async getVenue(id) {
      try {
        return (await getVenueByIdViaRpc(id)) ?? supabaseRepository.getVenueById(id);
      } catch (error) {
        // A failed read still shows the cached stall; with no cache the screen shows a retry.
        const cached = supabaseRepository.getVenueById(id);
        if (cached) return cached;
        throw error;
      }
    },

    async getVenuesByIds(ids) {
      const unique = [...new Set(ids)];
      const cached = new Map<string, VenueSummary>();
      const missing: string[] = [];
      for (const id of unique) {
        const venue = supabaseRepository.getVenueById(id);
        if (venue) cached.set(id, venue);
        else missing.push(id);
      }
      if (missing.length > 0) {
        // One batched read, never one call per stall. When it fails (offline, rate cap) this
        // throws: leaving the uncached stalls out would tell Saved and Followed stalls they closed.
        const fetched = await getVenuesByIdsViaRpc(missing);
        fetched?.forEach((venue) => cached.set(venue.id, venue));
      }
      return unique.flatMap((id) => cached.get(id) ?? []);
    },

    async getItemDetails({ dishIds, stallIds }) {
      const rows = await getItemDetailsViaRpc({ dishIds, stallIds });
      if (!rows) throw new Error("Couldn't load item details.");
      return rows.map((row) => ({
        dishId: typeof row.dish_id === "string" ? row.dish_id : undefined,
        stallId: typeof row.stall_id === "string" ? row.stall_id : undefined,
        name: typeof row.name === "string" ? row.name : undefined,
        stallName: typeof row.stall_name === "string" ? row.stall_name : undefined,
        price: row.price === null || row.price === undefined ? undefined : Number(row.price),
        imageUrl: typeof row.image_url === "string" ? row.image_url : undefined,
      }));
    },

    async getSavedDishCards(dishIds) {
      const cards = await getSavedDishCardsViaRpc(dishIds);
      if (!cards) throw new Error("Couldn't load your saved dishes.");
      return cards;
    },

    async listVenuesByBuilding(buildingId) {
      return (
        (await listVenuesByBuildingViaRpc(buildingId)) ??
        supabaseRepository.listVenuesByBuilding(buildingId)
      );
    },

    async getDish(id) {
      try {
        return (await getDishByIdViaRpc(id)) ?? supabaseRepository.getDishById(id);
      } catch (error) {
        // A failed read still shows the cached dish; with no cache the screen shows a retry.
        const cached = supabaseRepository.getDishById(id);
        if (cached) return cached;
        throw error;
      }
    },

    async listActivePromotionsForTarget(input) {
      const client = getSupabaseClient();
      if (!client) return [];
      // The stall page's list came back with the stall; a dish page asks for its own target.
      if (!input.dishId) {
        const inline = await getInlineMerchantReads(input.venueId);
        if (inline) return inline.promotions.map(mapPromotion);
      }
      const { data, error } = await client.rpc("list_customer_active_promotions", {
        p_venue_id: input.venueId,
        p_dish_id: input.dishId ?? null,
      });
      // Thrown, not swallowed: the page reports it and shows no promotions.
      if (error) throw error;
      return (Array.isArray(data) ? (data as Row[]) : []).map(mapPromotion);
    },

    async getPublicMerchantProfile(venueId) {
      const client = getSupabaseClient();
      if (!client || !venueId) return undefined;
      const inline = await getInlineMerchantReads(venueId);
      if (inline) return inline.profile ? mapPublicMerchantProfile(inline.profile) : undefined;
      const { data, error } = await client.rpc("get_public_merchant_profile", {
        p_venue_id: venueId,
      });
      // Thrown, not swallowed: a lost temporary closure must reach Sentry.
      if (error) throw error;
      const row = (Array.isArray(data) ? (data as Row[]) : [])[0];
      return row ? mapPublicMerchantProfile(row) : undefined;
    },

    async getVenueOpeningSchedule(venueId) {
      const client = getSupabaseClient();
      if (!client || !venueId) return undefined;
      const { data, error } = await client
        .from("venues")
        .select("opening_schedule")
        .eq("id", venueId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return undefined;
      return toOpeningSchedule((data as Row).opening_schedule);
    },

    async recordDishView(dishId, context) {
      const client = getSupabaseClient();
      if (!client) return;
      const sessionId = getMerchantAnalyticsSessionId(context);
      // Dish view tracking is analytics only; permission or network failures must not break detail screens.
      try {
        const { error } = await client.rpc("record_merchant_dish_view", {
          p_dish_id: dishId,
          p_session_id: sessionId,
        });
        if (error) {
          return;
        }
      } catch {
        return;
      }
    },

    async recordMerchantActionEvent(input: MerchantActionEventInput) {
      const client = getSupabaseClient();
      if (!client) return;
      const sessionId = getMerchantAnalyticsSessionId({
        sessionId: input.sessionId,
        userId: input.userId,
      });
      try {
        const { error } = await client.rpc("record_merchant_action_event", {
          p_event_type: input.eventType,
          p_session_id: sessionId,
          p_outlet_id: input.outletId ?? null,
          p_venue_id: input.venueId ?? null,
          p_dish_id: input.dishId ?? null,
          p_promotion_id: input.promotionId ?? null,
          p_source: input.source ?? "customer",
          p_metadata: input.metadata ?? {},
        });
        if (error) {
          return;
        }
      } catch {
        return;
      }
    },

    async listDishesByVenue(venueId) {
      try {
        return (
          (await listDishesByVenueViaRpc(venueId)) ?? supabaseRepository.listDishesByVenue(venueId)
        );
      } catch (error) {
        // Offline with no cached menu must not read as "No menu available".
        const cached = supabaseRepository.listDishesByVenue(venueId);
        if (cached.length > 0) return cached;
        throw error;
      }
    },

    async listDishesByVenuePage(venueId, cursor) {
      try {
        return (
          (await listDishesByVenuePageViaRpc(venueId, cursor)) ?? {
            dishes: cursor ? [] : supabaseRepository.listDishesByVenue(venueId),
          }
        );
      } catch (error) {
        // Offline on the first page: a cached menu is better than none. Later pages throw.
        const cached = cursor ? [] : supabaseRepository.listDishesByVenue(venueId);
        if (cached.length > 0) return { dishes: cached };
        throw error;
      }
    },

    async listPopularNearby(lat, lng) {
      return (await listPopularNearbyViaRpc(lat, lng)) ?? supabaseRepository.listPopularNearby();
    },

    async listDiscoveryFeedByLocation(request) {
      const rpcFeed = await listDiscoveryFeedByLocationViaRpc(request);
      if (rpcFeed) return rpcFeed;
      return getFallbackDiscoveryFeed(request);
    },

    async searchVenuesByLocation(request) {
      return searchVenuesByLocationViaRpc(request);
    },

    async searchDishes(filters: SearchFilters, tasteProfile: TasteVector): Promise<SearchResult[]> {
      const rpcResults = await searchDishesViaRpc(filters, tasteProfile);
      if (rpcResults) return rpcResults;
      const results = supabaseRepository.searchDishes(filters, tasteProfile);
      if (results.length === 0 && isSupabaseConfigured() && getSupabaseClient()) {
        // The RPC failed (offline, rate cap) and the cache has nothing: say so, so the screen
        // shows its retry and reports, rather than "No match found".
        throw new Error("Couldn't search dishes.");
      }
      return results.map((dish) => ({
        dish,
        score: similarityScore(dish.tasteVector, tasteProfile),
      }));
    },

    async decideForMe(tasteProfile, lat, lng) {
      const profile = await getCurrentUserProfileOrGuest();
      return supabaseRepository.getDecideForMe(tasteProfile, {
        dietaryFlags: profile.dietaryPreferences,
        neophiliaIndex: profile.tasteProfile?.neophiliaIndex ?? 5,
        radiusMeters: 500,
        latitude: lat,
        longitude: lng,
      });
    },
  },

  reviews: {
    async getReviewsForDish(dishId) {
      const client = requireSupabaseClient();
      const { data, error } = await client
        .from("reviews")
        .select(
          "id,user_id,dish_id,venue_id,author_name,rating,created_at,text,tags,would_recommend,merchant_reply_text,merchant_replied_at",
        )
        .eq("dish_id", dishId)
        .order("created_at", { ascending: false });
      if (error || !Array.isArray(data)) {
        return [];
      }
      return mapSupabaseReviewRows(client, data as Row[]);
    },

    async getUserReviews(userId, page) {
      const client = requireSupabaseClient();
      const viewerId = await getCurrentSupabaseUserId();
      const limit = Math.min(Math.max(page?.limit ?? USER_REVIEWS_PAGE_SIZE, 1), 500);
      const offset = Math.max(page?.offset ?? 0, 0);
      // Someone else's profile list goes through get_user_profile_reviews, which is
      // empty for a private account unless the viewer follows it (H39). Dish pages
      // keep showing every review. Older backends without the RPC use the table read.
      if (userId !== viewerId) {
        const rpc = await client
          .rpc("get_user_profile_reviews", { p_user_id: userId })
          .range(offset, offset + limit - 1);
        if (!rpc.error) {
          // Profile cards never show photos, so no photo rows are read or signed.
          return Array.isArray(rpc.data)
            ? attachOwnReviewModeration(
                client,
                await mapSupabaseReviewRows(client, rpc.data as Row[], { includePhotos: false }),
                viewerId,
              )
            : [];
        }
        // Only a backend without the RPC falls back. Any other error (the rate cap, a
        // network failure) is thrown, so the privacy rule and the cap are never skipped.
        if (rpc.error.code !== "42883" && rpc.error.code !== "PGRST202") throw rpc.error;
      }
      const { data, error } = await client
        .from("reviews")
        .select(
          "id,user_id,dish_id,venue_id,author_name,rating,created_at,text,tags,would_recommend,edited_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      // Thrown so a failed read is not shown as "No reviews yet".
      if (error) throw error;
      if (!Array.isArray(data)) return [];
      // Your own cards show the photo you posted (one batched photo read and one signing call
      // for the page). Someone else's profile cards never show photos, so none are read.
      return attachOwnReviewModeration(
        client,
        await mapSupabaseReviewRows(client, data as Row[], {
          includePhotos: Boolean(viewerId) && userId === viewerId,
        }),
        viewerId,
      );
    },

    async getMyReviewStats() {
      const client = requireSupabaseClient();
      if (!(await getCurrentSupabaseUserId())) return undefined;
      const { data, error } = await client.rpc("get_my_review_stats");
      // An older backend has no such function: the screen then shows the loaded reviews only.
      if (isMissingBackendObjectError(error)) return undefined;
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as Row | null | undefined;
      if (!row) return undefined;
      const reviewCount = asNumber(row.review_count) ?? 0;
      return {
        reviewCount,
        averageRating: reviewCount > 0 ? (asNumber(row.average_rating) ?? null) : null,
        ratingCounts: [
          asNumber(row.rating_1) ?? 0,
          asNumber(row.rating_2) ?? 0,
          asNumber(row.rating_3) ?? 0,
          asNumber(row.rating_4) ?? 0,
          asNumber(row.rating_5) ?? 0,
        ],
      } satisfies ReviewStats;
    },

    async submitReview(draft: SubmitReviewInput) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to submit reviews.");

      // The id is fixed before any write so photos can upload first and a
      // retry resumes the same review instead of duplicating it.
      const reviewId = draft.clientReviewId ?? createClientReviewId();
      const reviewRow: Row = {
        id: reviewId,
        user_id: userId,
        dish_id: draft.dishId,
        venue_id: draft.venueId,
        rating: draft.rating,
        text: draft.text,
        tags: normalizeReviewTags(draft.tags),
        would_recommend: draft.wouldRecommend ?? true,
      };

      // Upload before the review exists: reviews are public as soon as they are
      // inserted, so a failed upload must not leave a live, photo-less review.
      const uploadedPhotos = await uploadReviewPhotos(client, userId, reviewId, draft.photos);

      // A retry uploads under new object names, so photos from a failed attempt would be
      // left behind: remove them (best effort; the orphan purge catches any that remain).
      const discardUploadedPhotos = () =>
        removeUploadedObjects(client, "review-media", uploadedObjectPaths(uploadedPhotos));

      // One transaction: the review and its photo rows go in together, or neither does. The
      // server refuses a review with no photo and resumes the same review on a retry.
      const { data, error } = await client.rpc("submit_review", {
        p_review: {
          id: reviewId,
          dish_id: reviewRow.dish_id,
          venue_id: reviewRow.venue_id,
          rating: reviewRow.rating,
          text: reviewRow.text,
          tags: reviewRow.tags,
          would_recommend: reviewRow.would_recommend,
        },
        p_photos: uploadedPhotos.map((photo) => ({
          storage_path: photo.storage_path,
          thumb_path: photo.thumb_path ?? null,
        })),
      });
      if (isMissingBackendObjectError(error)) {
        // A backend that has not shipped submit_review yet: write the tables, as before.
        await submitReviewWithoutRpc(client, userId, reviewRow, uploadedPhotos);
        return;
      }
      if (error) {
        await discardUploadedPhotos();
        throw error;
      }
      // The review already had its photos (a retry whose first answer was lost): the files just
      // uploaded are not used.
      const photosAdded = asNumber((data as Row | null)?.photos_added) ?? uploadedPhotos.length;
      if (photosAdded === 0) await discardUploadedPhotos();
    },

    async listRecentReviews(options) {
      return (await fetchRecentReviewsPage(options)).entries;
    },

    async listRecentReviewsPage(options) {
      return fetchRecentReviewsPage(options);
    },

    async searchReviewsPage(options) {
      const client = requireSupabaseClient();
      const query = options.query.trim();
      if (query.length < REVIEW_SEARCH_MIN_LENGTH) return { entries: [], hasMore: false };
      const limit = Math.min(Math.max(Math.floor(options.limit ?? 50), 1), 100);
      const withPhotos = options.withPhotos ?? true;
      const { data, error } = await client.rpc("search_reviews", {
        p_query: query,
        p_before: options.before,
        p_before_id: options.before ? options.beforeId : undefined,
        p_limit: limit,
        p_with_photos: withPhotos,
      });
      if (isMissingBackendObjectError(error)) {
        // No search function yet: look through the newest reviews, as the grid did before.
        const page = await fetchRecentReviewsPageWithoutRpc({
          limit: 100,
          withPhotos,
          before: options.before,
          beforeId: options.beforeId,
        });
        return {
          ...page,
          entries: page.entries.filter((entry) => reviewMatchesQuery(entry, query)),
        };
      }
      if (error) throw error;
      return mapReviewFeedRpcPage(client, data, { withPhotos });
    },

    async getReviewById(reviewId) {
      if (!UUID_PATTERN.test(reviewId)) return null;
      const client = requireSupabaseClient();
      const { data, error } = await client
        .from("reviews")
        .select(REVIEW_FEED_COLUMNS)
        .eq("id", reviewId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [entry] = await buildRecentReviewEntries(client, [data as Row]);
      return entry ?? null;
    },

    async setReviewHelpful(reviewId, helpful) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to mark reviews helpful.");
      // Set the requested state instead of toggling, so a repeated tap never flips it back.
      if (!helpful) {
        const { error } = await client
          .from("review_helpful_votes")
          .delete()
          .eq("review_id", reviewId)
          .eq("user_id", userId);
        if (error) throw error;
        return;
      }
      const { error } = await client
        .from("review_helpful_votes")
        .upsert(
          { review_id: reviewId, user_id: userId },
          { onConflict: "review_id,user_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    },

    async updateReview(reviewId, patch) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to edit a review.");
      const normalized = normalizeReviewPatch(patch);
      const payload: Row = {};
      if (normalized.rating !== undefined) payload.rating = normalized.rating;
      if (normalized.text !== undefined) payload.text = normalized.text;
      if (normalized.tags !== undefined) payload.tags = normalized.tags;
      if (normalized.wouldRecommend !== undefined) {
        payload.would_recommend = normalized.wouldRecommend;
      }
      // RLS and the review guard trigger allow only the author's content fields.
      const { data, error } = await client
        .from("reviews")
        .update(payload)
        .eq("id", reviewId)
        .eq("user_id", userId)
        .select("id");
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Review not found, or it isn't yours to edit.");
      }
    },

    async deleteReview(reviewId) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to delete a review.");
      // Read the photo paths first: review_photos rows go with the review (cascade).
      const { data: photoRows } = await client
        .from("review_photos")
        .select("storage_bucket,storage_path")
        .eq("review_id", reviewId);
      const { data, error } = await client
        .from("reviews")
        .delete()
        .eq("id", reviewId)
        .eq("user_id", userId)
        .select("id");
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Review not found, or it isn't yours to delete.");
      }
      // Best effort: storage policies allow removing only the author's own prefix.
      const ownPrefix = `${userId}/`;
      const paths = (Array.isArray(photoRows) ? (photoRows as Row[]) : [])
        .filter((row) => asString(row.storage_bucket) === "review-media")
        .map((row) => asString(row.storage_path))
        .filter((path): path is string => Boolean(path?.startsWith(ownPrefix)));
      if (paths.length > 0) {
        const { error: removeError } = await client.storage.from("review-media").remove(paths);
        if (removeError) console.warn("Review photos were not removed", removeError.message);
      }
    },
  },

  profile: {
    async getProfile() {
      const client = getSupabaseClient();
      if (!client) return DEFAULT_GUEST_PROFILE;
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return DEFAULT_GUEST_PROFILE;
      return fetchUserProfile(client, userId);
    },

    async updateProfile(updates) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to update your profile.");
      const payload: Record<string, unknown> = { id: userId };
      if (updates.displayName !== undefined) payload.display_name = updates.displayName;
      // Empty clears it; the column's check constraint caps it at 150 characters.
      if (updates.bio !== undefined) payload.bio = updates.bio.trim() || null;
      // Email is not written here: it changes only through auth.requestEmailChange.
      if (updates.dietaryPreferences !== undefined) {
        payload.dietary_preferences = updates.dietaryPreferences;
      }
      if (updates.favouriteDishIds !== undefined)
        payload.favourite_dish_ids = updates.favouriteDishIds;
      if (updates.reviewedDishIds !== undefined)
        payload.reviewed_dish_ids = updates.reviewedDishIds;
      if (updates.tasteProfile !== undefined) payload.taste_profile = updates.tasteProfile;
      if (updates.avatarUrl !== undefined) {
        // An empty string removes the photo.
        payload.avatar_url =
          updates.avatarUrl === ""
            ? null
            : await uploadAvatarIfNeeded(client, userId, updates.avatarUrl);
      }
      if (Object.keys(payload).length > 1) {
        const { error } = await client.from("user_profiles").upsert(payload, { onConflict: "id" });
        if (error) throw error;
        if (typeof payload.avatar_url === "string") {
          await removePreviousAvatars(client, userId, payload.avatar_url);
        } else if (payload.avatar_url === null) {
          // Photo removed: no avatar file is current any more.
          await removePreviousAvatars(client, userId, "");
        }
      }
      if (updates.profileVisibility !== undefined) {
        const { error } = await client.from("privacy_settings").upsert(
          {
            user_id: userId,
            account_visibility: updates.profileVisibility,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) throw error;
      }

      return fetchUserProfile(client, userId);
    },

    async getPublicProfile(userId) {
      const client = getSupabaseClient();
      if (!client) return undefined;
      const { data, error } = await client
        .from("public_profiles")
        .select("id,display_name,avatar_url,bio,dishes_reviewed,stalls_visited,created_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      const row = (data ?? null) as Row | null;
      const id = row ? asString(row.id) : undefined;
      if (!row || !id) {
        // RLS hides a private account from non-followers: fall back to the minimal
        // card (name, avatar, private flag) so the profile can say it is private.
        const card = await client.rpc("get_profile_card", { p_user_id: userId });
        // A failed or rate-capped read is an error (the screen offers Retry), not "not found".
        if (card.error && card.error.code !== "42883" && card.error.code !== "PGRST202") {
          throw card.error;
        }
        const cardRow = !card.error && Array.isArray(card.data) ? (card.data[0] as Row) : null;
        const cardId = cardRow ? asString(cardRow.id) : undefined;
        if (!cardRow || !cardId) return undefined;
        return {
          id: cardId,
          displayName: asString(cardRow.display_name) ?? "Hungry member",
          avatarUrl: asString(cardRow.avatar_url),
          isPrivate: cardRow.is_private === true,
          canViewContent: cardRow.can_view_content === true,
        };
      }
      return {
        id,
        displayName: asString(row.display_name) ?? "Hungry member",
        avatarUrl: asString(row.avatar_url),
        bio: asString(row.bio),
        dishesReviewed: asNumber(row.dishes_reviewed),
        stallsVisited: asNumber(row.stalls_visited),
        createdAt: asString(row.created_at),
      };
    },

    async getTasteMatch(userId) {
      const client = getSupabaseClient();
      if (!client) return null;
      const { data, error } = await client.rpc("get_taste_match", { p_user_id: userId });
      // Nothing to show on an older backend; a rate cap or network error is a real error.
      if (isMissingBackendObjectError(error)) return null;
      if (error) throw error;
      const score = asNumber(data);
      return score === undefined ? null : Math.max(0, Math.min(100, Math.round(score)));
    },

    async listFavouriteDishIds(userId) {
      const client = getSupabaseClient();
      if (!client) return [];
      const { data, error } = await client
        .from("profile_favourite_dishes")
        .select("dish_id,position")
        .eq("user_id", userId)
        .order("position", { ascending: true });
      if (isMissingBackendObjectError(error)) return null;
      if (error) throw error;
      return Array.isArray(data) ? (data as Row[]).flatMap((r) => asString(r.dish_id) ?? []) : [];
    },

    async setFavouriteDishes(dishIds) {
      const client = requireSupabaseClient();
      const ids = [...new Set(dishIds.filter((id) => id.trim() !== ""))];
      const { error } = await client.rpc("set_profile_favourite_dishes", { p_dish_ids: ids });
      if (error) throw error;
      return ids;
    },

    async exportMyData() {
      // One server-side read scoped to auth.uid(); errors throw instead of dropping sections.
      const { data, error } = await requireSupabaseClient().rpc("export_my_data");
      if (error) throw error;
      const row = (data ?? null) as Row | null;
      if (!row || typeof row.data !== "object" || row.data === null) {
        throw new Error("The data export came back empty.");
      }
      return {
        exportVersion: asNumber(row.exportVersion) ?? 2,
        generatedAt: asString(row.generatedAt) ?? new Date().toISOString(),
        categories: asStringArray(row.categories),
        notIncluded: asStringArray(row.notIncluded),
        data: row.data as Record<string, unknown>,
      };
    },

    async updateDietaryPreferences(flags: DietaryFlag[]) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to update dietary preferences.");
      const { error } = await client
        .from("user_profiles")
        .upsert({ id: userId, dietary_preferences: flags }, { onConflict: "id" });
      if (error) throw error;
    },

    async updateMaxDishBudget(maxDishBudget: number | null) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to update your budget.");
      const { error } = await client
        .from("user_profiles")
        .upsert({ id: userId, max_dish_budget: maxDishBudget }, { onConflict: "id" });
      if (error) throw error;
    },

    async getGuestProfile() {
      return DEFAULT_GUEST_PROFILE;
    },

    async toggleFavourite(dishId: string, expectedUserId?: string) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to favourite dishes.");
      if (expectedUserId && userId !== expectedUserId) {
        throw new Error("Account changed before the favourite could be saved.");
      }

      const { data } = await client
        .from("user_favourite_dishes")
        .select("user_id,dish_id")
        .eq("user_id", userId)
        .eq("dish_id", dishId)
        .maybeSingle();

      if (data?.dish_id === dishId) {
        const { error } = await client
          .from("user_favourite_dishes")
          .delete()
          .eq("user_id", userId)
          .eq("dish_id", dishId);
        if (error) throw error;
        return false;
      }
      const { error } = await client
        .from("user_favourite_dishes")
        .upsert(
          { user_id: userId, dish_id: dishId },
          { onConflict: "user_id,dish_id", ignoreDuplicates: true },
        );
      if (error) throw error;
      return true;
    },

    async setFavourite(dishId: string, saved: boolean, expectedUserId?: string) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to favourite dishes.");
      if (expectedUserId && userId !== expectedUserId) {
        throw new Error("Account changed before the favourite could be saved.");
      }
      // One idempotent write for the state the user asked for: no read first, so a failed or
      // stale read can never turn "remove" into "save" (or two taps into a flip-flop).
      if (!saved) {
        const { error } = await client
          .from("user_favourite_dishes")
          .delete()
          .eq("user_id", userId)
          .eq("dish_id", dishId);
        if (error) throw error;
        return false;
      }
      const { error } = await client
        .from("user_favourite_dishes")
        .upsert(
          { user_id: userId, dish_id: dishId },
          { onConflict: "user_id,dish_id", ignoreDuplicates: true },
        );
      if (error) throw error;
      return true;
    },

    async addFavourites(dishIds: string[], expectedUserId?: string) {
      const ids = [...new Set(dishIds)];
      if (ids.length === 0) return;
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to favourite dishes.");
      if (expectedUserId && userId !== expectedUserId) {
        throw new Error("Account changed before the favourites could be saved.");
      }
      const { error } = await client.from("user_favourite_dishes").upsert(
        ids.map((dishId) => ({ user_id: userId, dish_id: dishId })),
        { onConflict: "user_id,dish_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    },

    async setDishTried(dishId: string, tried: boolean) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to mark dishes as tried.");
      // One atomic add/remove on the server; a reviewed dish stays in the list.
      const { data, error } = await client.rpc("set_dish_tried", {
        p_dish_id: dishId,
        p_tried: tried,
      });
      if (error) throw error;
      return asStringArray(data);
    },

    async getFavouriteDishIds() {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return [];
      return fetchFavouriteDishIdsForUser(client, userId);
    },

    async setStallFollow(stallId: string, following: boolean) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to follow stalls.");
      const { error } = following
        ? await client
            .from("stall_follows")
            .upsert(
              { user_id: userId, stall_id: stallId },
              { onConflict: "user_id,stall_id", ignoreDuplicates: true },
            )
        : await client.from("stall_follows").delete().eq("user_id", userId).eq("stall_id", stallId);
      if (error) throw error;
    },

    async getFollowedStallIds() {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return [];
      const { data, error } = await client
        .from("stall_follows")
        .select("stall_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((row: { stall_id: string }) => row.stall_id);
    },

    async updateTasteVector(vector: TasteVector) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to update taste vector.");

      const { error: vectorError } = await client.from("user_taste_vectors").upsert(
        {
          user_id: userId,
          sweet: vector.sweet,
          spicy: vector.spicy,
          sour: vector.sour,
          salty: vector.salty,
          rich: vector.rich,
          aromatic: vector.aromatic,
          vector: [
            vector.sweet,
            vector.spicy,
            vector.sour,
            vector.salty,
            vector.rich,
            vector.aromatic,
          ],
        },
        { onConflict: "user_id" },
      );
      if (vectorError) throw vectorError;

      const { error: profileError } = await client.from("user_profiles").upsert(
        {
          id: userId,
          sweet: vector.sweet,
          spicy: vector.spicy,
          sour: vector.sour,
          salty: vector.salty,
          rich: vector.rich,
          aromatic: vector.aromatic,
        },
        { onConflict: "id" },
      );
      if (profileError) throw profileError;
    },

    async updateTasteProfile(profile: TasteProfile) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to update taste profile.");
      await this.updateTasteVector(profile.vector);
      const { error } = await client
        .from("user_profiles")
        .upsert({ id: userId, taste_profile: profile }, { onConflict: "id" });
      if (error) throw error;
    },

    async recordQuizResponse(responses: Record<string, unknown>, tasteVector: TasteVector) {
      const client = getSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!client) return;
      // Throws (instead of dropping the answers) so a queued guest quiz survives until a write lands.
      if (!userId) throw new Error("You must be signed in to save quiz answers.");
      const { error } = await client.from("quiz_responses").insert({
        user_id: userId,
        quiz_version: TASTE_QUIZ_VERSION,
        responses,
        generated_taste_vector: tasteVectorToArray(tasteVector),
      });
      if (error) throw error;
    },
  },

  push: {
    async getPreferences() {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return { ...DEFAULT_PUSH_PREFERENCES };
      const { data, error } = await client
        .from("notification_preferences")
        .select(
          "stall_updates,weekly_picks,mealtime_suggestions,social_activity,quiet_start_hour,quiet_end_hour,weekly_cap",
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapPushPreferencesRow(data) : { ...DEFAULT_PUSH_PREFERENCES };
    },

    async updatePreferences(updates: Partial<PushPreferences>) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to change notification settings.");
      // Only the columns being changed go in the upsert (ON CONFLICT updates just those), so
      // a switch changed on another phone is never written back with a stale value.
      const row: Record<string, unknown> = { user_id: userId };
      if (updates.stallUpdates !== undefined) row.stall_updates = updates.stallUpdates;
      if (updates.weeklyPicks !== undefined) row.weekly_picks = updates.weeklyPicks;
      if (updates.mealtimeSuggestions !== undefined)
        row.mealtime_suggestions = updates.mealtimeSuggestions;
      if (updates.socialActivity !== undefined) row.social_activity = updates.socialActivity;
      if (updates.quietStartHour !== undefined) row.quiet_start_hour = updates.quietStartHour;
      if (updates.quietEndHour !== undefined) row.quiet_end_hour = updates.quietEndHour;
      if (updates.weeklyCap !== undefined) row.weekly_cap = updates.weeklyCap;
      const { data, error } = await client
        .from("notification_preferences")
        .upsert(row, { onConflict: "user_id" })
        .select(
          "stall_updates,weekly_picks,mealtime_suggestions,social_activity,quiet_start_hour,quiet_end_hour,weekly_cap",
        )
        .single();
      if (error) throw error;
      return mapPushPreferencesRow(data);
    },

    async registerPushToken(token: string, platform: "ios" | "android") {
      const client = requireSupabaseClient();
      const { error } = await client.rpc("register_push_token", {
        p_token: token,
        p_platform: platform,
      });
      if (error) throw error;
      await rememberRegisteredPushToken(token);
    },

    async unregisterPushToken() {
      await unregisterStoredPushToken(requireSupabaseClient());
    },

    async markOpened(notificationId: string) {
      const client = requireSupabaseClient();
      const { error } = await client.rpc("mark_notification_opened", { p_id: notificationId });
      if (error) throw error;
    },
  },

  lifecycle: {
    async recordAppOpen() {
      const client = requireSupabaseClient();
      if (!(await getCurrentSupabaseUserId())) return null;
      const { data, error } = await client.rpc("record_app_open");
      if (error) throw error;
      return mapLifecycleSnapshot(data);
    },

    async getWelcomeBackDishes(sinceDate: string): Promise<WelcomeBackDish[]> {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return [];
      const { data: follows, error: followsError } = await client
        .from("stall_follows")
        .select("stall_id")
        .eq("user_id", userId);
      if (followsError) throw followsError;
      const stallIds = (follows ?? []).map((row: { stall_id: string }) => row.stall_id);
      if (!stallIds.length) return [];

      const { data: newDishes, error: dishesError } = await client
        .from("dishes")
        .select("id,name,venue_id")
        .in("venue_id", stallIds)
        .gte("created_at", `${sinceDate}T00:00:00+08:00`)
        .order("created_at", { ascending: false })
        .limit(3);
      if (dishesError) throw dishesError;
      const rows = (newDishes ?? []) as { id: string; name: string; venue_id: string }[];
      if (!rows.length) return [];

      const { data: venues, error: venuesError } = await client
        .from("venues")
        .select("id,name")
        .in("id", [...new Set(rows.map((row) => row.venue_id))]);
      if (venuesError) throw venuesError;
      const venueNames = new Map(
        ((venues ?? []) as { id: string; name: string }[]).map((venue) => [venue.id, venue.name]),
      );
      return rows.map((row) => ({
        dishId: row.id,
        dishName: row.name,
        stallId: row.venue_id,
        stallName: venueNames.get(row.venue_id) ?? "",
      }));
    },
  },

  social: {
    async getBitesFeed(_lat?: number, _lng?: number, page?: BitesFeedPage) {
      const client = requireSupabaseClient();
      if (!(await getCurrentSupabaseUserId())) {
        const publicBites = await fetchPublicHomeFeedBites(client, page);
        if (publicBites) return publicBites;
      }
      const rpcBites = await fetchHomeSocialFeedBitesViaRpc(client, page);
      if (rpcBites) return rpcBites;
      // The plain posts read has no cursor: a later page would repeat the first.
      return page?.cursor ? [] : fetchPublishedPostBites(client);
    },

    async listUserPosts(userId: string, page?: { limit?: number; offset?: number }) {
      const client = requireSupabaseClient();
      return fetchPublishedPostBites(client, page?.limit ?? USER_POSTS_PAGE_SIZE, {
        authorId: userId,
        offset: page?.offset ?? 0,
      });
    },

    async postBite(draft: BiteDraft) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) {
        throw new Error("You must be signed in to publish a post.");
      }
      const user = await supabaseService.profile.getProfile();
      const dish = supabaseRepository.getDishById(draft.dishId);
      const venue = supabaseRepository.getVenueById(draft.venueId);
      const building = supabaseRepository
        .listBuildings()
        .find((item) => item.id === venue?.buildingId || item.id === dish?.buildingId);

      const author = draft.author ?? user;
      // No author in generated_content: readers take the author from public_profiles.
      const postMeta = {
        source: "post_composer",
        dish: {
          id: draft.dishId,
          name: dish?.name ?? "",
          price: dish?.price ?? 0,
          imageUrl: dish?.imageUrl,
        },
        venue: {
          id: draft.venueId,
          name: venue?.name ?? "",
          unitNumber: venue?.unitNumber ?? "",
          buildingId: venue?.buildingId ?? dish?.buildingId ?? "",
          buildingName: building?.name ?? "",
        },
        tasteStamp: draft.tasteStamp,
        // Only the poster's own rating is stored; no rating means no star on the post.
        rating: draft.rating > 0 ? draft.rating : undefined,
        tags: draft.tags ?? [],
        mediaType: draft.mediaType ?? "photo",
        mediaTypes: draft.mediaTypes ?? [],
        showFoodContextOverlay: draft.showFoodContextOverlay ?? true,
      };

      const initialPayload = {
        author_id: userId,
        post_type: "text",
        status: "draft",
        visibility: "public",
        caption: draft.caption,
        generated_content: postMeta,
        dish_id: draft.dishId,
        venue_id: draft.venueId,
        building_id: venue?.buildingId ?? dish?.buildingId ?? null,
      };

      // A client post id makes a retry resume this post instead of creating a second one.
      let clientPostId =
        draft.clientPostId && UUID_PATTERN.test(draft.clientPostId)
          ? draft.clientPostId
          : undefined;
      let resumeDraft = false;
      if (clientPostId) {
        const { data: existing, error: existingError } = await client
          .from("posts")
          .select("id,status,deleted_at")
          .eq("id", clientPostId)
          .eq("author_id", userId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing) {
          const existingStatus = asString((existing as Row).status);
          if (existingStatus === "published" && !(existing as Row).deleted_at) {
            // The earlier attempt published it and only its response was lost.
            const alreadyPublished = await supabaseService.social.getPostById(clientPostId);
            if (alreadyPublished) return alreadyPublished;
          }
          if (existingStatus === "draft") {
            resumeDraft = true;
          } else {
            // Not reusable (deleted): publish under a new id.
            clientPostId = undefined;
          }
        }
      }

      let postId = clientPostId ?? "";
      if (resumeDraft) {
        const { error: resumeError } = await client
          .from("posts")
          .update({
            caption: initialPayload.caption,
            generated_content: initialPayload.generated_content,
            dish_id: initialPayload.dish_id,
            venue_id: initialPayload.venue_id,
            building_id: initialPayload.building_id,
          })
          .eq("id", postId)
          .eq("author_id", userId);
        if (resumeError) throw resumeError;
        // Media rows from the earlier attempt are replaced by this attempt's uploads.
        const { error: clearError } = await client
          .from("post_media")
          .delete()
          .eq("post_id", postId);
        if (clearError) throw clearError;
      } else {
        const { data: postData, error: postError } = await client
          .from("posts")
          .insert((clientPostId ? { id: clientPostId, ...initialPayload } : initialPayload) as Row)
          .select("*")
          .maybeSingle();
        if (postError || !postData) throw postError ?? new Error("Failed to create post draft.");
        postId = asString((postData as Row).id) ?? "";
        if (!postId) {
          throw new Error("Failed to create post id.");
        }
      }

      const mediaUrls = draft.mediaUrls?.length
        ? draft.mediaUrls
        : [draft.photoUrl].filter(Boolean);
      const uploadedPaths: string[] = [];
      let media: Awaited<ReturnType<typeof buildPostMediaRows>>;
      let publishedPostData: unknown;
      const publishedAt = new Date().toISOString();
      try {
        media = await buildPostMediaRows(
          client,
          userId,
          postId,
          mediaUrls,
          draft.mediaTypes,
          draft.mediaType,
          uploadedPaths,
        );
        if (media.rows.length > 0) {
          const { error: mediaError } = await client.from("post_media").insert(media.rows);
          if (mediaError) throw mediaError;
        }

        const postType = postTypeForMedia(media.rows, media.canonicalMediaType);
        const publishResult = await client
          .from("posts")
          .update({
            post_type: postType,
            status: "published",
            published_at: publishedAt,
            updated_at: publishedAt,
          })
          .eq("id", postId)
          .select("*")
          .maybeSingle();
        publishedPostData = publishResult.data;
        if (publishResult.error || !publishedPostData) {
          throw publishResult.error ?? new Error("Failed to publish post.");
        }
      } catch (error) {
        // Leave no orphan draft or uploaded files behind (best effort; a scheduled purge
        // removes whatever is left after 24 hours). A retry starts clean.
        await removeUploadedObjects(client, "post-media", uploadedPaths);
        try {
          await client
            .from("posts")
            .delete()
            .eq("id", postId)
            .eq("author_id", userId)
            .eq("status", "draft");
        } catch {
          // Offline: the retry resumes this draft by its id.
        }
        throw error;
      }

      // The post is live: return now. Refreshing the whole catalog only matters for later
      // detail lookups, so it runs in the background instead of keeping the spinner up.
      void refreshSupabaseRepositoryCache().catch(() => undefined);

      const primaryMediaUrl = media.displayUrls[0] ?? draft.photoUrl;

      return {
        id: postId,
        authorId: userId,
        authorName: author.displayName,
        authorAvatar: author.avatarUrl,
        dishId: draft.dishId,
        dishName: dish?.name ?? "Unknown dish",
        venueId: draft.venueId,
        venueName: venue?.name ?? "Unknown venue",
        unitNumber: venue?.unitNumber ?? "",
        buildingId: venue?.buildingId ?? dish?.buildingId ?? "",
        buildingName: building?.name ?? "",
        photoUrl: primaryMediaUrl,
        mediaUrls: media.displayUrls.length > 0 ? media.displayUrls : [primaryMediaUrl],
        mediaType: media.canonicalMediaType,
        showFoodContextOverlay: draft.showFoodContextOverlay ?? true,
        caption: draft.caption,
        tags: draft.tags,
        tasteStamp: draft.tasteStamp,
        cravingCount: 0,
        savedCount: 0,
        rating: draft.rating,
        price: dish?.price ?? 0,
        expiresAt: publishedAt,
        createdAt: publishedAt,
      } satisfies Bite;
    },

    async getPostById(postId) {
      // Stall/legacy ids are not posts rows: not found, not an invalid-uuid error.
      if (!UUID_PATTERN.test(postId)) return null;
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("get_post_by_id", { p_post_id: postId });
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as Row | undefined) : undefined;
      return row ? mapFeedRpcRowToBite(client, row) : null;
    },

    async updatePost(postId, patch) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to edit a post.");
      const caption = sanitizeFreeText(patch.caption, POST_CAPTION_MAX_LENGTH);
      // posts_update_own RLS limits this to the author; the author filter makes a
      // foreign id a zero-row update, reported below instead of silently passing.
      const { error, count } = await client
        .from("posts")
        .update({ caption }, { count: "exact" })
        .eq("id", postId)
        .eq("author_id", userId)
        .is("deleted_at", null);
      if (error) throw error;
      if (count === 0) throw new Error("This post can no longer be edited.");
    },

    async deletePost(postId) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to delete a post.");
      // Soft delete: every read filters deleted_at, the Home feed trigger drops the
      // row, and reports and moderation history stay attached for review.
      const { error, count } = await client
        .from("posts")
        .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
        .eq("id", postId)
        .eq("author_id", userId)
        .is("deleted_at", null);
      if (error) throw error;
      if (count === 0) throw new Error("This post was already deleted.");
    },

    async reactToBite(biteId, reaction, active) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to react.");
      const table = reaction === "craving" ? "post_likes" : "post_saves";
      // Set the requested state instead of toggling: a stale or repeated tap can
      // never delete a like the viewer meant to keep.
      if (!active) {
        const { error } = await client
          .from(table)
          .delete()
          .eq("post_id", biteId)
          .eq("user_id", userId);
        if (error) throw error;
        return;
      }
      const { error } = await client
        .from(table)
        .upsert(
          { post_id: biteId, user_id: userId },
          { onConflict: "post_id,user_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    },

    async shareBite(biteId, options) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to share.");
      const { error } = await client.from("post_shares").insert({
        post_id: biteId,
        user_id: userId,
        share_channel: options?.channel ?? "in_app",
        target_conversation_id: options?.targetConversationId ?? null,
        target_user_id: options?.targetUserId ?? null,
      });
      if (error) throw error;
    },

    async getStories() {
      return getStoryCache();
    },

    async listStoryGalleryAssets() {
      return [...STORY_GALLERY_ASSETS];
    },

    async likeStory(storyId: string) {
      const stories = await getStoryCache();
      const target = stories.find((story) => story.id === storyId);
      if (!target) return;

      const nextStories = stories.map((story) => {
        if (story.id !== storyId) return story;
        const nextLiked = !story.interaction.liked;
        const likeCount = Math.max(0, story.interaction.likeCount + (nextLiked ? 1 : -1));
        return {
          ...story,
          interaction: {
            ...story.interaction,
            liked: nextLiked,
            likeCount,
          },
        };
      });

      persistStoryCache(nextStories);
    },

    async saveStory(storyId: string) {
      const stories = await getStoryCache();
      const target = stories.find((story) => story.id === storyId);
      if (!target) return;

      const nextStories = stories.map((story) => {
        if (story.id !== storyId) return story;
        return {
          ...story,
          interaction: {
            ...story.interaction,
            saved: !story.interaction.saved,
          },
        };
      });

      persistStoryCache(nextStories);
    },

    async shareStory(storyId: string) {
      const stories = await getStoryCache();
      const target = stories.find((story) => story.id === storyId);
      if (!target) return;

      const nextStories = stories.map((story) => {
        if (story.id !== storyId) return story;
        return {
          ...story,
          interaction: {
            ...story.interaction,
            shareCount: story.interaction.shareCount + 1,
          },
        };
      });

      persistStoryCache(nextStories);
    },

    async addStory(content: StoryContent) {
      const stories = await getStoryCache();
      const profile = await getCurrentUserProfileOrGuest();
      const newStory: Story = {
        id: `s_${Date.now()}`,
        displayName: profile.displayName,
        authorId: profile.id,
        authorProfileVisibility: profile.profileVisibility,
        avatarUrl: profile.avatarUrl,
        hasUnseen: false,
        isStall: false,
        isOwn: true,
        content,
        createdAt: new Date().toISOString(),
        interaction: { liked: false, saved: false, likeCount: 0, commentCount: 0, shareCount: 0 },
      };

      const nextStories = stories.filter((story) => !story.isOwn);
      nextStories.unshift(newStory);
      persistStoryCache(nextStories);
      return newStory;
    },

    async getLikedStories() {
      const stories = await getStoryCache();
      return stories.filter((story) => story.interaction.liked);
    },

    async getSavedStories() {
      const stories = await getStoryCache();
      return stories.filter((story) => story.interaction.saved);
    },

    async getSavedBites() {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return [];
      // Newest save first. The posts are read by id, not filtered out of the latest feed window,
      // so an older saved post still shows. Posts that are no longer readable drop out.
      const { data, error } = await client
        .from("post_saves")
        .select("post_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(SAVED_POSTS_LIMIT);
      // A failed read throws so the Saved > Posts tab shows an error with Retry, not "no posts".
      if (error) throw error;
      if (!Array.isArray(data)) return [];
      const savedIds = (data as Row[])
        .map((row) => asString(row.post_id))
        .filter((id): id is string => !!id);
      if (savedIds.length === 0) return [];
      const bites = await fetchPublishedPostBites(client, savedIds.length, { ids: savedIds });
      const biteById = new Map(bites.map((bite) => [bite.id, bite]));
      return savedIds.flatMap((id) => biteById.get(id) ?? []);
    },

    async getLikedBites() {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return [];
      const { data, error } = await client
        .from("post_likes")
        .select("post_id")
        .eq("user_id", userId);
      if (error || !Array.isArray(data)) return [];
      const likedIds = new Set(
        (data as Row[]).map((row) => asString(row.post_id)).filter((id): id is string => !!id),
      );
      return (await fetchPublishedPostBites(client)).filter((bite) => likedIds.has(bite.id));
    },

    async removeFollower(userId: string) {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) throw new Error("You must be signed in to remove a follower.");
      const { error } = await client.rpc("remove_follower", { p_follower_id: userId });
      if (error) throw error;
    },

    async searchProfiles(query: string, page?: { limit?: number; offset?: number }) {
      const client = requireSupabaseClient();
      const term = query.trim();
      if (term.length < 2) return [];
      const { data, error } = await client.rpc("search_profiles", {
        p_query: term,
        p_limit: page?.limit ?? 20,
        p_offset: page?.offset ?? 0,
      });
      if (error) throw error;
      if (!Array.isArray(data)) return [];
      return (data as Row[]).flatMap((row) => {
        const userId = asString(row.user_id);
        if (!userId) return [];
        return [
          {
            userId,
            displayName: asString(row.display_name) ?? "Hungry member",
            avatarUrl: asString(row.avatar_url),
          },
        ];
      });
    },

    async followUser(userId: string) {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) throw new Error("You must be signed in to follow users.");
      // follow_user writes "approved" for public accounts and "pending" for private ones;
      // a direct insert can only be "pending" under the follows RLS policy.
      const { data, error } = await client.rpc("follow_user", { p_target_user_id: userId });
      if (error) throw error;
      return data === "pending" ? "pending" : "approved";
    },

    async unfollowUser(userId: string) {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) throw new Error("You must be signed in to unfollow users.");
      const { error } = await client
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("followee_id", userId);
      if (error) throw error;
    },

    async listFollowers(userId: string, page?: { limit?: number; offset?: number }) {
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("list_user_followers", {
        p_user_id: userId,
        p_limit: page?.limit ?? 100,
        p_offset: page?.offset ?? 0,
      });
      // Thrown so screens can tell a failed read from an empty list.
      if (error) throw error;
      if (!Array.isArray(data)) return [];
      return (data as Row[]).map((row) => ({
        userId: asString(row.user_id) ?? "",
        displayName: asString(row.display_name) ?? "",
        avatarUrl: asString(row.avatar_url),
      }));
    },

    async listFollowing(userId: string, page?: { limit?: number; offset?: number }) {
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("list_user_following", {
        p_user_id: userId,
        p_limit: page?.limit ?? 100,
        p_offset: page?.offset ?? 0,
      });
      // Thrown so screens can tell a failed read from an empty list.
      if (error) throw error;
      if (!Array.isArray(data)) return [];
      return (data as Row[]).map((row) => ({
        userId: asString(row.user_id) ?? "",
        displayName: asString(row.display_name) ?? "",
        avatarUrl: asString(row.avatar_url),
      }));
    },

    async canViewFollowLists(userId: string) {
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("can_view_follow_lists", { p_user_id: userId });
      // Unknown visibility: assume visible so the screen falls back to its normal empty state.
      if (error) return true;
      return data !== false;
    },

    async getFollowCounts(userId: string) {
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("get_follow_counts", { p_user_id: userId });
      // A failed read (offline, rate cap) is an error for the caller to show and report;
      // null means only that the server has no row.
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) return null;
      const row = data[0] as Row;
      return {
        followersCount: asNumber(row.followers_count) ?? 0,
        followingCount: asNumber(row.following_count) ?? 0,
      };
    },

    async isFollowing(userId: string) {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) return false;
      const { data } = await client
        .from("follows")
        .select("followee_id")
        .eq("follower_id", currentUserId)
        .eq("followee_id", userId)
        .eq("status", "approved")
        .maybeSingle();
      return data !== null;
    },

    async getFollowStatus(userId: string) {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) return "none" as const;
      // The follows SELECT policy lets the follower read their own row.
      const { data, error } = await client
        .from("follows")
        .select("status")
        .eq("follower_id", currentUserId)
        .eq("followee_id", userId)
        .maybeSingle();
      if (error) throw error;
      const status = asString((data as Row | null)?.status);
      return status === "approved" ? "approved" : status === "pending" ? "pending" : "none";
    },

    async cancelFollowRequest(userId: string) {
      const client = requireSupabaseClient();
      const { error } = await client.rpc("cancel_follow_request", { p_target_user_id: userId });
      if (error) throw error;
    },

    async listFollowRequests(page?: { limit?: number; offset?: number }) {
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("list_incoming_follow_requests", {
        p_limit: page?.limit ?? 50,
        p_offset: page?.offset ?? 0,
      });
      if (error) throw error;
      if (!Array.isArray(data)) return [];
      return (data as Row[]).map((row) => ({
        userId: asString(row.user_id) ?? "",
        displayName: asString(row.display_name) ?? "",
        avatarUrl: asString(row.avatar_url),
        requestedAt: asString(row.requested_at) ?? "",
      }));
    },

    async getFollowRequestCount() {
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("count_incoming_follow_requests");
      if (error) throw error;
      return asNumber(data) ?? 0;
    },

    async approveFollowRequest(requesterId: string) {
      const client = requireSupabaseClient();
      const { error } = await client.rpc("approve_follow_request", {
        p_requester_id: requesterId,
      });
      if (error) throw error;
    },

    async declineFollowRequest(requesterId: string) {
      const client = requireSupabaseClient();
      const { error } = await client.rpc("decline_follow_request", {
        p_requester_id: requesterId,
      });
      if (error) throw error;
    },

    async createComment(postId: string, body: string, parentCommentId?: string) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to comment.");
      const { data, error } = await client
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: userId,
          body,
          parent_comment_id: parentCommentId ?? null,
        })
        .select("id, user_id, body, created_at, parent_comment_id")
        .single();
      if (error || !data) throw error ?? new Error("Failed to create comment.");
      const row = data as Row;
      const profile = await fetchUserProfile(client, userId);
      return {
        id: asString(row.id) ?? "",
        userId: asString(row.user_id) ?? userId,
        body: asString(row.body) ?? "",
        createdAt: asString(row.created_at) ?? new Date().toISOString(),
        parentCommentId: asString(row.parent_comment_id),
        authorName: profile.displayName,
        authorAvatarUrl: profile.avatarUrl,
      };
    },

    async deleteComment(commentId: string) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to delete a comment.");
      const { error } = await client
        .from("post_comments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("user_id", userId);
      if (error) throw error;
    },

    async listCommentsForPost(postId: string) {
      const client = requireSupabaseClient();
      const { data, error } = await client
        .from("post_comments")
        .select("id, user_id, body, created_at, parent_comment_id")
        .eq("post_id", postId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error || !data) return [];
      const rows = data as Row[];
      const authorIds = Array.from(
        new Set(rows.map((row) => asString(row.user_id)).filter((id): id is string => !!id)),
      );
      const publicProfileRows =
        authorIds.length > 0
          ? await client
              .from("public_profiles")
              .select("id, display_name, avatar_url")
              .in("id", authorIds)
              .then(({ data: profiles, error: profileError }) =>
                profileError || !Array.isArray(profiles) ? [] : (profiles as Row[]),
              )
          : [];
      const publicProfileById = new Map(
        publicProfileRows.map((profileRow) => [asString(profileRow.id) ?? "", profileRow]),
      );
      return rows.map((row) => {
        const userId = asString(row.user_id) ?? "";
        const publicProfile = publicProfileById.get(userId);
        return {
          id: asString(row.id) ?? "",
          userId,
          body: asString(row.body) ?? "",
          createdAt: asString(row.created_at) ?? "",
          parentCommentId: asString(row.parent_comment_id),
          authorName: asString(publicProfile?.display_name),
          authorAvatarUrl: asString(publicProfile?.avatar_url),
        };
      });
    },
  },

  chat: {
    async listConversations() {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) throw new Error("You must be signed in to view messages.");
      await ensureCurrentUserProfileRow(client);

      const participantRows = await listConversationParticipantRows(client);
      const conversationIds = Array.from(
        new Set(
          participantRows
            .map((row) => asString(row.conversation_id))
            .filter((id): id is string => Boolean(id)),
        ),
      );
      if (conversationIds.length === 0) return [];

      const { data, error } = await client
        .from("conversations")
        .select("id,conversation_type,subject_merchant_account_id,created_by_user_id,updated_at")
        .in("id", conversationIds);
      if (error) throw error;

      const messageRows = await listMessagesForConversations(client, conversationIds);
      return mapConversationRows(
        client,
        Array.isArray(data) ? (data as Row[]) : [],
        participantRows,
        messageRows,
        currentUserId,
      );
    },

    async openConversation(input) {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) throw new Error("You must be signed in to start a chat.");
      await ensureCurrentUserProfileRow(client);
      const type = input.type ?? (input.target.kind === "merchant" ? "merchant" : "user");
      const dedupeKey = buildConversationDedupeKey(currentUserId, input.target, type);

      const existing = await client
        .from("conversations")
        .select("id,conversation_type,subject_merchant_account_id,created_by_user_id,updated_at")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      if (existing.error) throw existing.error;

      let conversationRow = existing.data as Row | null;
      if (!conversationRow) {
        const { data, error } = await client
          .rpc("open_chat_conversation", {
            p_target_user_id: input.target.kind === "user" ? input.target.userId : null,
            p_target_merchant_account_id:
              input.target.kind === "merchant" ? input.target.merchantAccountId : null,
            p_conversation_type: type,
          })
          .maybeSingle();
        if (error || !data) throw error ?? new Error("Failed to create conversation.");
        conversationRow = data as Row;
      }

      const conversationId = asString(conversationRow.id);
      if (!conversationId) throw new Error("Conversation id is unavailable.");
      const participantRows = await listConversationParticipantRows(client, [conversationId]);
      const conversations = await mapConversationRows(
        client,
        [conversationRow],
        participantRows,
        await listMessagesForConversations(client, [conversationId]),
        currentUserId,
      );
      return conversations[0];
    },

    async listMessages(conversationId) {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) throw new Error("You must be signed in to view messages.");
      const participantRows = await listConversationParticipantRows(client, [conversationId]);
      const participantsByKey = await hydrateChatParticipants(
        client,
        participantRows,
        currentUserId,
      );
      const messageRows = await listMessagesForConversations(client, [conversationId]);
      const messageIds = messageRows
        .map((row) => asString(row.id))
        .filter((messageId): messageId is string => Boolean(messageId));
      const readAtByMessageId = await listReadReceiptsForMessages(
        client,
        conversationId,
        messageIds,
      );
      return messageRows.map((row) => {
        const messageId = asString(row.id);
        return mapChatMessage(
          {
            ...row,
            read_at: messageId ? readAtByMessageId.get(messageId) : undefined,
          },
          currentUserId,
          participantsByKey,
        );
      });
    },

    async sendMessage(input) {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) throw new Error("You must be signed in to send messages.");
      const body = input.body.trim();
      if (!body) throw new Error("Message cannot be empty.");

      const { data, error } = await client
        .rpc("send_chat_message", {
          p_conversation_id: input.conversationId,
          p_body: body,
          p_client_nonce: input.clientNonce ?? `${currentUserId}-${Date.now()}`,
          p_sender_merchant_account_id: input.senderMerchantAccountId ?? null,
        })
        .maybeSingle();
      if (error || !data) throw error ?? new Error("Failed to send message.");

      const participantRows = await listConversationParticipantRows(client, [input.conversationId]);
      const participantsByKey = await hydrateChatParticipants(
        client,
        participantRows,
        currentUserId,
      );
      return mapChatMessage(data as Row, currentUserId, participantsByKey);
    },

    async markConversationRead(conversationId) {
      const client = requireSupabaseClient();
      const currentUserId = await getCurrentSupabaseUserId();
      if (!currentUserId) return;
      // One statement on the server: two tabs marking the same chat read cannot race
      // into the unique receipt index.
      const { error } = await client.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
    },

    subscribeToConversation(conversationId, handlers: ChatSubscriptionHandlers) {
      const client = requireSupabaseClient();
      let currentUserId: string | null = null;
      void getCurrentSupabaseUserId().then((userId) => {
        currentUserId = userId;
      });
      const channel = client
        .channel(`conversation:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as Row;
            if (asString(row.deleted_at)) return;
            const userId = currentUserId ?? "";
            handlers.onMessage?.(mapChatMessage(row, userId, new Map()));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "read_receipts",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as Row;
            const messageId = asString(row.message_id);
            const readAt = asString(row.read_at);
            if (messageId && readAt) handlers.onReadReceipt?.(messageId, readAt);
          },
        )
        .subscribe((status, error) => {
          if (error) handlers.onError?.(error);
        });
      return {
        unsubscribe() {
          void client.removeChannel(channel);
        },
      };
    },
  },

  communitySafety: {
    async reportContent(request: ContentReportRequest) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to report content.");

      if (request.targetType === "post") {
        if (!UUID_PATTERN.test(request.targetId)) {
          throw new Error("Post reports require a valid post id.");
        }

        const { error } = await client.rpc("report_post", {
          p_post_id: request.targetId,
          p_reason_code: request.reason,
          p_details: request.targetAuthorKey
            ? `target_author_key:${request.targetAuthorKey}`
            : null,
        });
        if (error) throw error;
        return;
      }

      const { error } = await client.rpc("report_content", {
        p_target_type: request.targetType,
        p_target_id: request.targetId,
        p_reason: request.reason,
        p_target_author_key: request.targetAuthorKey ?? null,
      });
      if (error) throw error;
    },

    async blockUser(request: BlockUserRequest) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to block users.");
      // Server block checks compare blocked_user_key with the author's auth id.
      if (!UUID_PATTERN.test(request.blockedUserId)) {
        throw new Error("Blocking requires a valid user id.");
      }
      if (request.blockedUserId === userId) throw new Error("You cannot block yourself.");

      // One transaction: the block row, and the follows (both directions) it ends.
      const { error } = await client.rpc("block_user", {
        p_blocked_user_id: request.blockedUserId.toLowerCase(),
        p_reason: request.reason ?? "user_initiated_block",
      });
      if (error) throw error;
    },

    async unblockUser(blockedUserId: string) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to unblock users.");
      if (!UUID_PATTERN.test(blockedUserId)) {
        throw new Error("Unblocking requires a valid user id.");
      }
      const { error } = await client
        .from("user_blocks")
        .delete()
        .eq("blocker_id", userId)
        .eq("blocked_user_key", blockedUserId.toLowerCase());
      if (error) throw error;
    },

    async listBlockedUsers(): Promise<BlockedUserEntry[]> {
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("list_my_blocked_users");
      if (error) throw error;
      return asRowArray(data).map((row) => ({
        blockedUserId: asString(row.blocked_user_id) ?? "",
        displayName: asString(row.display_name),
        avatarUrl: asString(row.avatar_url),
        reason: asString(row.reason),
        createdAt: asString(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async listHiddenPosts(): Promise<HiddenPostEntry[]> {
      const client = requireSupabaseClient();
      const { data, error } = await client.rpc("list_my_hidden_posts");
      if (error) throw error;
      return asRowArray(data).map((row) => ({
        postId: asString(row.post_id) ?? "",
        caption: asString(row.caption),
        authorId: asString(row.author_id),
        authorName: asString(row.author_display_name),
        dishName: asString(row.dish_name),
        venueName: asString(row.venue_name),
        hiddenAt: asString(row.hidden_at) ?? new Date().toISOString(),
      }));
    },

    async hidePost(postId: string, reason?: string) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to hide posts.");
      if (!UUID_PATTERN.test(postId)) throw new Error("Post hiding requires a valid post id.");

      const { error } = await client.rpc("hide_post", {
        p_post_id: postId,
        p_reason: reason ?? "hidden_by_user",
      });
      if (error) throw error;
    },

    async unhidePost(postId: string) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to unhide posts.");
      if (!UUID_PATTERN.test(postId)) throw new Error("Post unhiding requires a valid post id.");

      const { error } = await client.rpc("unhide_post", {
        p_post_id: postId,
      });
      if (error) throw error;
    },

    async getBlockedUsers() {
      const client = requireSupabaseClient();
      const { data, error } = await client
        .from("user_blocks")
        .select("blocked_user_key, reason, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        blockedUserId: row.blocked_user_key as string,
        reason: row.reason as string | undefined,
        createdAt: row.created_at as string,
      }));
    },
  },

  contributions: {
    async submitDiscoveredStall(input) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) {
        throw new Error("You must be signed in to add a stall.");
      }
      if (!input.stallName.trim()) {
        throw new Error("Stall name is required.");
      }
      if (!input.imageUri.trim() || !isLocalUri(input.imageUri)) {
        throw new Error("Stall image must be uploaded from your device.");
      }

      const imageUris = Array.from(
        new Set(input.imageUris?.length ? input.imageUris : [input.imageUri]),
      );
      imageUris.forEach((uri) => {
        if (!uri.trim() || !isLocalUri(uri)) {
          throw new Error("Stall images must be uploaded from your device.");
        }
      });

      const uploadPrefix = `${userId}/${Date.now()}-${sanitizeStorageSegment(input.stallName)}`;
      // n-plus-one-ok: one storage upload per photo (at most six); there is no batch upload.
      const uploadResults = await Promise.allSettled(
        imageUris.map((uri, index) =>
          uploadImageFromUri({
            client,
            bucket: "user-stall-submission-images",
            path: `${uploadPrefix}-${index + 1}.${extensionFromUri(uri)}`,
            uri,
          }),
        ),
      );
      const uploadedImages = uploadResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      // A submission that is not saved must not leave its photos in storage.
      const removeUploadedImages = () =>
        uploadedImages.length
          ? client.storage
              .from("user-stall-submission-images")
              .remove(uploadedImages.map((image) => image.path))
              .then(
                () => undefined,
                () => undefined,
              )
          : Promise.resolve();
      const failedUpload = uploadResults.find((result) => result.status === "rejected");
      if (failedUpload) {
        await removeUploadedImages();
        throw (failedUpload as PromiseRejectedResult).reason;
      }
      const uploaded = uploadedImages[0];
      if (!uploaded) {
        throw new Error("Stall image must be uploaded from your device.");
      }
      const firstImageMimeType = input.imageMimeTypes?.[0] ?? input.imageMimeType ?? null;
      const galleryImages = uploadedImages.map((image, index) => ({
        url: image.publicUrl,
        bucket: "user-stall-submission-images",
        path: image.path,
        mimeType: input.imageMimeTypes?.[index] || (index === 0 ? input.imageMimeType : null),
      }));

      const rpcPayload = {
        p_stall_name: input.stallName,
        p_image_url: uploaded.publicUrl,
        p_image_storage_bucket: "user-stall-submission-images",
        p_image_storage_path: uploaded.path,
        p_image_mime_type: firstImageMimeType,
        p_gallery_images: galleryImages,
        p_source_url: input.sourceUrl ?? null,
        p_building_name: input.buildingName ?? null,
        p_area: input.area ?? null,
        p_address: input.address ?? null,
        p_postal_code: input.postalCode ?? null,
        p_unit_number: input.unitNumber ?? null,
        p_floor: input.floor ?? null,
        p_operating_hours: input.operatingHours ?? null,
        p_menu_items: input.menuItems ?? [],
        p_delivery_links: input.deliveryLinks ?? [],
        p_notes: input.notes ?? null,
      };

      const rpcPayloadWithoutGallery = {
        ...rpcPayload,
      };
      delete (rpcPayloadWithoutGallery as { p_gallery_images?: unknown }).p_gallery_images;

      const legacyRpcPayload = {
        ...rpcPayloadWithoutGallery,
      };
      delete (legacyRpcPayload as { p_postal_code?: string | null }).p_postal_code;

      const primarySubmit = await client
        .rpc("submit_user_stall_submission", rpcPayload)
        .maybeSingle();
      let finalResult: { data: unknown; error: PostgrestError | null } = primarySubmit;
      // Set when every direct insert failed on the schema: no row was written by it.
      let directInsertFailed = false;
      const isFunctionSchemaError = (error: PostgrestError | null | undefined) => {
        if (!error) return false;
        const message = error.message.toLowerCase();
        return (
          error.code === "42883" ||
          message.includes("could not find the function") ||
          (message.includes("function") && message.includes("does not exist"))
        );
      };

      const isInsertColumnSchemaError = (error: PostgrestError | null | undefined) => {
        if (!error) return false;
        const message = error.message.toLowerCase();
        return (
          message.includes("could not find the") &&
          message.includes("column") &&
          message.includes("schema cache") &&
          message.includes("of")
        );
      };

      const isColumnNotExistError = (error: PostgrestError | null | undefined) => {
        if (!error) return false;
        const message = error.message.toLowerCase();
        return message.includes("column") && message.includes("does not exist");
      };

      const shouldUseDirectInsertFallback = (error: PostgrestError | null | undefined) =>
        !!(error && (isFunctionSchemaError(error) || isInsertColumnSchemaError(error)));

      const isRetryableInsertSchemaError = (error: PostgrestError | null | undefined) =>
        !!(
          isInsertColumnSchemaError(error) ||
          isColumnNotExistError(error) ||
          error?.message.toLowerCase().includes("schema cache")
        );

      if (
        primarySubmit.error &&
        primarySubmit.error.code === "42883" &&
        primarySubmit.error.message.includes("submit_user_stall_submission")
      ) {
        finalResult = await client
          .rpc("submit_user_stall_submission", rpcPayloadWithoutGallery)
          .maybeSingle();
        if (uploadedImages.length > 1) {
          void client.storage
            .from("user-stall-submission-images")
            .remove(uploadedImages.slice(1).map((image) => image.path));
        }
      }

      if (
        finalResult.error &&
        finalResult.error.code === "42883" &&
        finalResult.error.message.includes("submit_user_stall_submission")
      ) {
        finalResult = await client
          .rpc("submit_user_stall_submission", legacyRpcPayload)
          .maybeSingle();
      }

      if (
        finalResult.error &&
        (shouldUseDirectInsertFallback(finalResult.error) ||
          isInsertColumnSchemaError(finalResult.error))
      ) {
        const submissionBaseRow: Record<string, unknown> = {
          user_id: userId,
          stall_name: input.stallName.trim(),
          image_url: uploaded.publicUrl,
          image_storage_bucket: "user-stall-submission-images",
          image_storage_path: uploaded.path,
          image_mime_type: firstImageMimeType,
          gallery_images: galleryImages,
          source_url: input.sourceUrl ?? null,
          building_name: input.buildingName ?? null,
          area: input.area ?? null,
          address: input.address ?? null,
          postal_code: input.postalCode ?? null,
          unit_number: input.unitNumber ?? null,
          floor: input.floor ?? null,
          operating_hours: input.operatingHours ?? null,
          menu_items: input.menuItems ?? [],
          delivery_links: input.deliveryLinks ?? [],
          notes: input.notes ?? null,
        };

        const submitDirectInsert = async (row: Record<string, unknown>) => {
          return client.from("user_stall_submissions").insert(row).select("*").maybeSingle();
        };

        const readMissingColumn = (errorMessage?: string): string | null => {
          if (!errorMessage) return null;
          const directMatch = errorMessage.match(
            /Could not find the ['"]([^'"]+)['"] column of .*? in the schema cache/i,
          );
          if (directMatch?.[1]) {
            return directMatch[1];
          }
          const postgresqlMatch = errorMessage.match(/column "([^"]+)" does not exist/i);
          if (postgresqlMatch?.[1]) {
            return postgresqlMatch[1];
          }
          return null;
        };

        let mutableInsertRow: Record<string, unknown> = { ...submissionBaseRow };
        let insertedRows: Record<string, unknown> | null = null;
        let insertError: PostgrestError | null = null;
        const attemptedColumns = new Set<string>();

        for (let i = 0; i < 5; i += 1) {
          const attempt = await submitDirectInsert(mutableInsertRow);
          if (!attempt.error) {
            insertedRows = attempt.data as Record<string, unknown> | null;
            insertError = null;
            break;
          }

          insertError = attempt.error;

          if (
            !isRetryableInsertSchemaError(attempt.error) ||
            typeof attempt.error.message !== "string"
          ) {
            break;
          }

          const missingColumn = readMissingColumn(attempt.error.message);
          if (!missingColumn) break;
          if (attemptedColumns.has(missingColumn)) break;
          attemptedColumns.add(missingColumn);
          delete mutableInsertRow[missingColumn];
        }

        if (insertedRows && Array.isArray(insertedRows)) {
          if (insertedRows.length > 0) {
            insertedRows = insertedRows[0] as Record<string, unknown>;
          } else {
            insertedRows = null;
          }
        }

        if (!insertError && insertedRows) {
          finalResult = { data: insertedRows, error: null };
        } else if (!insertError && !insertedRows) {
          finalResult = { data: null, error: null };
        } else if (insertError && isRetryableInsertSchemaError(insertError)) {
          directInsertFailed = true;
          finalResult = { data: null, error: null };
        } else {
          // Includes permission denied: the row was not saved, so this is a failure, not success.
          await removeUploadedImages();
          throw insertError;
        }
      }

      const { data, error } = finalResult;
      if (error) {
        await removeUploadedImages();
        throw error;
      }

      try {
        const fallbackMenuItems = input.menuItems ?? [];
        const fallbackDeliveryLinks = input.deliveryLinks ?? [];
        const fallbackSubmission: UserStallSubmission = {
          id: `submission_${Date.now()}`,
          userId,
          stallName: input.stallName.trim(),
          imageUrl: uploaded.publicUrl,
          galleryImageUrls: galleryImages.map((image) => image.url),
          imageStorageBucket: "user-stall-submission-images",
          imageStoragePath: uploaded.path,
          imageMimeType: firstImageMimeType ?? undefined,
          sourceUrl: input.sourceUrl ?? undefined,
          buildingName: input.buildingName ?? undefined,
          area: input.area ?? undefined,
          address: input.address ?? undefined,
          postalCode: input.postalCode ?? undefined,
          unitNumber: input.unitNumber ?? undefined,
          floor: input.floor ?? undefined,
          operatingHours: input.operatingHours,
          menuItems: fallbackMenuItems,
          deliveryLinks: fallbackDeliveryLinks,
          notes: input.notes ?? undefined,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // An empty result confirms nothing either: look the row up as for no data.
        if (!data || (Array.isArray(data) && data.length === 0)) {
          const fallbackWindowIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const normalizedStallName = input.stallName.trim().toLowerCase();

          const resolveByRecentFallback = async () => {
            const { data: fallbackRows, error: fallbackError } = await client
              .from("user_stall_submissions")
              .select("*")
              .eq("user_id", userId)
              .gte("created_at", fallbackWindowIso)
              .order("created_at", { ascending: false })
              .limit(20);
            if (fallbackError) return { data: null, error: null };
            const rows = Array.isArray(fallbackRows) ? (fallbackRows as Row[]) : [];
            const match = rows.find((row) => {
              if (!row || typeof row !== "object") return false;
              const rowStall = asString(asRecord(row).stall_name)?.trim().toLowerCase();
              const rowPath = asString(asRecord(row).image_storage_path);
              const rowUrl = asString(asRecord(row).image_url);
              if (rowStall && rowStall === normalizedStallName && rowPath === uploaded.path)
                return true;
              if (rowStall && rowStall === normalizedStallName && rowUrl === uploaded.publicUrl)
                return true;
              // A name alone could match an older submission of the same stall.
              return false;
            });
            if (!match) return { data: null, error: null };
            return { data: mapUserStallSubmission(client, asRecord(match)), error: null };
          };

          const resolveByImagePath = async () => {
            if (!uploaded.path) return { error: null, data: null };
            const { data: pathData, error: pathError } = await client
              .from("user_stall_submissions")
              .select("*")
              .eq("user_id", userId)
              .eq("image_storage_path", uploaded.path)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (pathError) return { error: null, data: null };
            if (pathData) {
              return { data: mapUserStallSubmission(client, asRecord(pathData)), error: null };
            }
            return { data: null, error: null };
          };

          const resolveByImageUrl = async () => {
            if (!uploaded.publicUrl) return { error: null, data: null };
            const { data: urlData, error: urlError } = await client
              .from("user_stall_submissions")
              .select("*")
              .eq("user_id", userId)
              .eq("image_url", uploaded.publicUrl)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (urlError) return { error: null, data: null };
            if (urlData) {
              return { data: mapUserStallSubmission(client, asRecord(urlData)), error: null };
            }
            return { data: null, error: null };
          };

          const imagePathFallback = await resolveByImagePath();
          if (imagePathFallback.data) return imagePathFallback.data;

          const imageUrlFallback = await resolveByImageUrl();
          if (imageUrlFallback.data) return imageUrlFallback.data;

          const recentFallback = await resolveByRecentFallback();
          if (recentFallback.data) return recentFallback.data;

          // Nothing confirms the row was saved; do not report a made-up submission as success.
          // When the insert itself failed, nothing refers to the uploaded photos: remove them.
          if (directInsertFailed) await removeUploadedImages();
          throw new StallSubmissionUnconfirmedError();
        }

        if (typeof data === "string") {
          const { data: rowById } = await client
            .from("user_stall_submissions")
            .select("*")
            .eq("user_id", userId)
            .eq("id", data)
            .maybeSingle();
          if (rowById) {
            return mapUserStallSubmission(client, asRecord(rowById));
          }
          // The RPC returned the saved row's id; keep it even when the read-back fails.
          return { ...fallbackSubmission, id: data };
        }

        if (Array.isArray(data)) {
          return mapUserStallSubmission(client, asRecord(data[0]));
        }

        const mapped = asRecord(data as Row | undefined);
        if (mapped.id) {
          return mapUserStallSubmission(client, mapped);
        }
        return fallbackSubmission;
      } catch (parseError) {
        if (parseError instanceof StallSubmissionUnconfirmedError) throw parseError;
        console.warn(
          "[submitDiscoveredStall] failed to parse rpc response, using fallback",
          parseError,
        );
        return {
          id: `submission_${Date.now()}`,
          userId,
          stallName: input.stallName.trim(),
          imageUrl: uploaded.publicUrl,
          galleryImageUrls: galleryImages.map((image) => image.url),
          imageStorageBucket: "user-stall-submission-images",
          imageStoragePath: uploaded.path,
          imageMimeType: firstImageMimeType ?? undefined,
          sourceUrl: input.sourceUrl ?? undefined,
          buildingName: input.buildingName ?? undefined,
          area: input.area ?? undefined,
          address: input.address ?? undefined,
          postalCode: input.postalCode ?? undefined,
          unitNumber: input.unitNumber ?? undefined,
          floor: input.floor ?? undefined,
          operatingHours: input.operatingHours,
          menuItems: input.menuItems ?? [],
          deliveryLinks: input.deliveryLinks ?? [],
          notes: input.notes ?? undefined,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    },

    async listMyDiscoveredStalls() {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return [];
      const { data, error } = await client
        .from("user_stall_submissions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as Row[]) : [];
      const presigned = await presignSubmissionPhotos(client, rows);
      return Promise.all(rows.map((row) => mapUserStallSubmission(client, row, presigned)));
    },
  },

  content: {
    async listArticles() {
      return supabaseRepository.listBlogPosts();
    },

    async listStallPosts() {
      return supabaseRepository.listStallPosts();
    },

    async listPopularVisitorPinsByVenue(venueId) {
      return listSupabasePopularVisitorPinsForVenue(requireSupabaseClient(), venueId);
    },

    async getArticle(id) {
      return supabaseRepository.listBlogPosts().find((article) => article.id === id);
    },
  },

  supply: {
    async submitCatalogCorrection(input) {
      const client = requireSupabaseClient();
      const { error } = await client.rpc("submit_catalog_correction", {
        p_venue_id: input.venueId,
        p_kind: input.kind,
        p_dish_id: input.dishId ?? null,
        p_note: input.note?.trim() || null,
      });
      if (error) throw error;
    },

    async submitMenuPhoto(input) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) {
        throw new Error("You must be signed in to submit a menu photo.");
      }
      if (!input.photoUri || !isLocalUri(input.photoUri)) {
        throw new Error("Menu photo must be a local device URI.");
      }

      assertValidMenuPhotoUpload({
        mimeType: input.photoMimeType,
        fileSizeBytes: input.photoFileSizeBytes,
      });

      const extension = input.photoUri.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `${userId}/${input.venueId}/${Date.now()}.${extension}`;
      const uploaded = await uploadImageFromUri({
        client,
        bucket: "menu-photos",
        path: storagePath,
        uri: input.photoUri,
      });

      const { data: submissionId, error: rpcError } = await client.rpc("submit_menu_photo", {
        p_venue_id: input.venueId,
        p_storage_path: uploaded.path,
        p_content_type: input.photoMimeType ?? null,
        p_size_bytes: input.photoFileSizeBytes ?? null,
      });
      if (rpcError || !submissionId) {
        throw rpcError ?? new Error("Failed to submit menu photo metadata.");
      }

      // Developer-only: kick off OCR asynchronously; draft extraction is service-role only.
      void client.functions
        .invoke("ingest-menu-photo", {
          body: { submissionId },
        })
        .catch(() => undefined);

      return {
        submissionId: String(submissionId),
        storagePath: uploaded.path,
      };
    },

    async submitMerchantClaimInterest(input) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) {
        throw new Error("You must be signed in to claim a stall.");
      }
      await ensureCurrentUserProfileRow(client);

      const claimPayload = {
        p_venue_id: input.venueId,
        p_contact_name: input.contactName ?? null,
        p_contact_phone: input.contactPhone ?? null,
        p_contact_email: input.contactEmail ?? null,
        p_uen: input.uen ?? null,
        p_notes: input.notes ?? null,
      };
      const { data: claimId, error: rpcError } = await client.rpc(
        "submit_merchant_claim_interest",
        claimPayload,
      );
      if (rpcError) {
        throw rpcError;
      }
      // The reused stall read says "no claim": the next read of this stall must be fresh.
      invalidateVenueDetail(input.venueId);

      return {
        claimId: claimId ? String(claimId) : null,
        status: claimId ? "created" : "already_exists",
      } as const;
    },

    async getMerchantClaimStatus(venueId) {
      const inline = await getInlineMerchantReads(venueId);
      if (inline) return toClaimStatus(inline.claimStatus);
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return "none";
      const { data, error } = await client
        .from("merchant_claim_interests")
        .select("status")
        .eq("venue_id", venueId)
        .eq("claimed_by", userId)
        .maybeSingle();
      if (error || !data) return "none";
      return toClaimStatus(asString((data as Row).status) ?? null);
    },

    async listDraftDishesQueue(venueId) {
      const client = requireSupabaseClient();
      const { data, error } = await client.functions.invoke("ops-dishes-draft", {
        body: {
          action: "list",
          venueId: venueId ?? null,
        },
      });
      if (error) throw error;
      const rows = Array.isArray((data as Row | undefined)?.rows)
        ? (((data as Row).rows as unknown[]) ?? [])
        : [];
      return rows
        .map((row) => row as Row)
        .map((row) => ({
          id: asString(row.id) ?? "",
          venueId: asString(row.venue_id) ?? "",
          sourcePhotoId: asString(row.source_photo_id) ?? null,
          name: asString(row.name) ?? "",
          nameNormalized:
            asString(row.name_normalized) ?? normalizeMenuEntry(asString(row.name) ?? ""),
          price: (() => {
            const cents = asNumber(row.price_cents);
            return cents === undefined ? null : cents / 100;
          })(),
          currency: asString(row.currency) ?? "SGD",
          modifiers: asStringArray(row.modifiers),
          extractionConfidence: asNumber(row.extraction_confidence) ?? 0,
          confidenceBumps: asNumber(row.confidence_bumps) ?? 0,
          reviewStatus:
            (asString(row.review_status) as
              | "pending"
              | "accepted"
              | "edited"
              | "rejected"
              | "promoted"
              | "duplicate") ?? "pending",
          duplicateOf: asString(row.duplicate_of) ?? null,
          createdAt: asString(row.created_at) ?? new Date().toISOString(),
        }))
        .filter((row) => row.id.length > 0 && row.venueId.length > 0 && row.name.length > 0);
    },

    async reviewDraftDish(draftDishId, decision, notes) {
      const client = requireSupabaseClient();
      const { error } = await client.functions.invoke("ops-dishes-draft", {
        body: {
          action: "review",
          draftDishId,
          decision,
          notes: notes ?? null,
        },
      });
      if (error) throw error;
    },
  },

  merchant: {
    async getMerchantAccount() {
      return getSupabaseMerchantAccount();
    },

    async getOutlets() {
      return (await getSupabaseMerchantAccount())?.outlets ?? [];
    },

    async switchOutlet(outletId) {
      const client = requireSupabaseClient();
      return toMerchantOutlet(client, await getMerchantOutletRow(client, outletId));
    },

    async getVerificationStatus(outletId) {
      const client = requireSupabaseClient();
      const outlet = await getMerchantOutletRow(client, outletId);
      return fetchVerificationForOutlet(client, asString(outlet.id) ?? outletId);
    },

    async submitVerification(outletId, evidence) {
      const client = requireSupabaseClient();
      const outlet = await getMerchantOutletRow(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;

      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to upload verification evidence.");
      const fileUrls = [evidence.fileUrl, ...(evidence.additionalFileUrls ?? [])].filter(Boolean);
      if (fileUrls.length === 0) throw new Error("Attach at least one file for verification.");
      fileUrls.forEach((fileUrl) =>
        assertLocalUserMediaUri(fileUrl, "Merchant verification evidence"),
      );

      const { data: existingVerification, error: existingError } = await client
        .from("merchant_verifications")
        .select("id")
        .eq("outlet_id", resolvedOutletId)
        .maybeSingle();
      if (existingError) throw existingError;

      let verificationId = asString((existingVerification as Row | null)?.id);
      if (!verificationId) {
        const { data: createdVerification, error: createError } = await client
          .from("merchant_verifications")
          .insert({
            outlet_id: resolvedOutletId,
            status: "draft",
            method: evidence.method,
          })
          .select("id")
          .single();
        if (createError) throw createError;
        verificationId = asString((createdVerification as Row | null)?.id);
      }
      if (!verificationId) {
        throw new Error("Unable to prepare verification evidence upload.");
      }

      // Upload every file first, then record them in one insert and flip the status once, so a
      // failed upload never leaves a submitted outlet with part of its evidence.
      const uploadedAt = Date.now();
      const uploadedPaths: string[] = [];
      for (let index = 0; index < fileUrls.length; index += 1) {
        const fileUrl = fileUrls[index];
        const uploadedEvidence = await uploadPostMediaFromUri({
          client,
          bucket: "merchant-verification-evidence",
          path: `${userId}/${resolvedOutletId}/${verificationId}-${uploadedAt}-${index}.${extensionFromUri(fileUrl)}`,
          uri: fileUrl,
        });
        uploadedPaths.push(uploadedEvidence.path);
      }
      const { error: evidenceError } = await client.from("merchant_verification_evidence").insert(
        uploadedPaths.map((path) => ({
          verification_id: verificationId,
          method: evidence.method,
          file_url: `supabase://merchant-verification-evidence/${path}`,
          storage_bucket: "merchant-verification-evidence",
          storage_path: path,
          uploaded_by: userId,
          review_note: evidence.reviewNote ?? null,
        })),
      );
      if (evidenceError) throw evidenceError;

      const { error } = await client
        .from("merchant_verifications")
        .upsert(buildVerificationSubmitPayload(resolvedOutletId, evidence.method, new Date()), {
          onConflict: "outlet_id",
        })
        .select("id")
        .single();
      if (error) throw error;
    },

    async resubmitVerification(outletId, evidence) {
      return this.submitVerification(outletId, evidence);
    },

    async updateBusinessProfile(outletId, updates) {
      const client = requireSupabaseClient();
      const currentOutlet = await getMerchantOutletRow(client, outletId);
      const resolvedOutletId = asString(currentOutlet.id) ?? outletId;
      const normalized = validateMerchantProfileUpdates(updates);
      const payload: Row = {};
      if (normalized.name !== undefined) payload.name = normalized.name;
      if (normalized.businessType !== undefined) payload.business_type = normalized.businessType;
      if (normalized.buildingId !== undefined) payload.building_id = normalized.buildingId;
      if (normalized.unitNumber !== undefined) payload.unit_number = normalized.unitNumber;
      if (normalized.floor !== undefined) payload.floor = normalized.floor;
      if (normalized.locationPrivacy !== undefined) {
        payload.location_privacy = normalized.locationPrivacy;
      }
      if (normalized.description !== undefined) payload.description = normalized.description;
      if (normalized.operatingHours !== undefined) {
        payload.operating_hours = normalized.operatingHours;
      }
      if (normalized.openingSchedule !== undefined) {
        payload.opening_schedule = normalized.openingSchedule;
      }
      if (normalized.address !== undefined) payload.address = normalized.address || null;
      if (normalized.postalCode !== undefined) payload.postal_code = normalized.postalCode || null;
      if (normalized.coordinate !== undefined) {
        payload.latitude = normalized.coordinate.latitude;
        payload.longitude = normalized.coordinate.longitude;
      }
      if (normalized.temporaryClosure !== undefined) {
        payload.temporary_closure = normalized.temporaryClosure || null;
      }
      if (normalized.contactPhone !== undefined) payload.contact_phone = normalized.contactPhone;
      if (normalized.contactEmail !== undefined) payload.contact_email = normalized.contactEmail;
      if (normalized.cuisineCategories !== undefined) {
        payload.cuisine_categories = normalized.cuisineCategories;
      }
      if (normalized.socialLinks !== undefined) payload.social_links = normalized.socialLinks;
      if (normalized.profilePhotoUrl !== undefined) {
        payload.profile_photo_url = normalized.profilePhotoUrl || null;
        if (normalized.profilePhotoUrl && isLocalUri(normalized.profilePhotoUrl)) {
          const userId = await getCurrentSupabaseUserId();
          if (!userId) throw new Error("You must be signed in to upload business photos.");
          const extension = extensionFromUri(normalized.profilePhotoUrl);
          const upload = await uploadImageFromUri({
            client,
            bucket: "merchant-stall-images",
            path: `${userId}/${resolvedOutletId}/profile-${Date.now()}.${extension}`,
            uri: normalized.profilePhotoUrl,
          });
          payload.profile_photo_url = upload.publicUrl;
        }
      }
      if (normalized.coverPhotoUrl !== undefined) {
        payload.cover_photo_url = normalized.coverPhotoUrl || null;
        if (normalized.coverPhotoUrl && isLocalUri(normalized.coverPhotoUrl)) {
          const userId = await getCurrentSupabaseUserId();
          if (!userId) throw new Error("You must be signed in to upload business photos.");
          const extension = extensionFromUri(normalized.coverPhotoUrl);
          const upload = await uploadImageFromUri({
            client,
            bucket: "merchant-stall-images",
            path: `${userId}/${resolvedOutletId}/cover-${Date.now()}.${extension}`,
            uri: normalized.coverPhotoUrl,
          });
          payload.cover_photo_url = upload.publicUrl;
        }
      }
      if (normalized.isLive !== undefined) payload.is_live = normalized.isLive;

      const { data, error } = await client
        .from("merchant_outlets")
        .update(payload)
        .eq("id", resolvedOutletId)
        .select("*")
        .single();
      if (error) throw error;

      const outlet = data as Row;
      // The verified-outlet sync trigger copies name, hours, unit and floor onto the venue
      // (with home-based location privacy applied); merchants never write venues directly.
      if (asString(outlet.venue_id)) await refreshSupabaseRepositoryCache();
      return toMerchantOutlet(client, outlet);
    },

    async getMenu(outletId) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const venueId = asString(outlet.venue_id) ?? "";
      const venue = await fetchVenueRow(client, venueId);
      const { data, error } = await client
        .from("dishes")
        .select("*")
        .eq("venue_id", venueId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as Row[]) : [];
      const presentationByDishId = await fetchDishPresentationMap(
        client,
        rows.map((row) => asString(row.id) ?? ""),
      );
      return rows.map((row) => ({
        ...mapSupabaseDish(row, venue, presentationByDishId.get(asString(row.id) ?? "")),
        isMerchantDraft: asBoolean(row.merchant_draft) ?? false,
      }));
    },

    async addDish(outletId, dish) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      // The editor passes a stable id, so a retried create edits the first try's row.
      const dishId = dish.id ?? createMerchantDishId();
      const galleryUrls = await resolveMerchantDishGalleryUrls(client, outlet, dishId, dish);
      const payload = buildDishPayload(outlet, {
        ...dish,
        id: dishId,
        imageUrl: galleryUrls?.[0] ?? dish.imageUrl,
        gallery: galleryUrls ?? dish.gallery,
      });
      const row = await saveMerchantDish(client, outlet, dishId, payload, {
        galleryUrls,
        dietaryFlags: dish.dietaryFlags,
        tasteVector: dish.tasteVector,
      });
      await refreshSupabaseRepositoryVenueDishes(asString(outlet.venue_id) ?? "");
      const presentationByDishId = await fetchDishPresentationMap(client, [dishId]);
      return mapSupabaseDish(
        row,
        await fetchVenueRow(client, asString(outlet.venue_id) ?? ""),
        presentationByDishId.get(dishId),
      );
    },

    async editDish(outletId, dishId, updates) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const venueId = asString(outlet.venue_id) ?? "";
      const galleryUrls = await resolveMerchantDishGalleryUrls(client, outlet, dishId, updates);
      const payload = buildDishUpdatePayload({
        ...updates,
        imageUrl: galleryUrls?.[0] ?? updates.imageUrl,
        gallery: galleryUrls ?? updates.gallery,
      });
      const row = await saveMerchantDish(client, outlet, dishId, payload, {
        galleryUrls,
        dietaryFlags: updates.dietaryFlags,
        tasteVector: updates.tasteVector,
      });
      await refreshSupabaseRepositoryVenueDishes(venueId);
      const presentationByDishId = await fetchDishPresentationMap(client, [dishId]);
      return mapSupabaseDish(
        row,
        await fetchVenueRow(client, venueId),
        presentationByDishId.get(dishId),
      );
    },

    async deleteDish(outletId, dishId) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      // Drafts are deleted; any other dish is archived so its reviews and saves are kept.
      const { error } = await client.rpc("merchant_remove_dish", {
        p_dish_id: dishId,
        p_venue_id: asString(outlet.venue_id) ?? "",
      });
      if (error) throw error;
      await refreshSupabaseRepositoryVenueDishes(asString(outlet.venue_id) ?? "");
    },

    async toggleSoldOut(outletId, dishId, soldOut) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      // One atomic UPDATE; the catalog trigger refreshes the diner card, so no full cache reload.
      return setMerchantDishFlag(client, outlet, dishId, "sold_out", soldOut);
    },

    async setDishesSoldOut(outletId, dishIds, soldOut) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      if (dishIds.length === 0) return [];
      // One UPDATE for the whole list; a dish the caller cannot edit is simply left out.
      const { data, error } = await client.rpc("merchant_set_dishes_availability_flag", {
        p_dish_ids: dishIds,
        p_venue_id: asString(outlet.venue_id) ?? "",
        p_flag: "sold_out",
        p_enabled: soldOut,
      });
      if (error) throw error;
      return Array.isArray(data) ? data.filter((id): id is string => typeof id === "string") : [];
    },

    async toggleFeatured(outletId, dishId, featured) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      return setMerchantDishFlag(client, outlet, dishId, "featured", featured);
    },

    async getOCRDrafts(outletId) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const { data, error } = await client
        .from("dishes_draft")
        .select("*")
        .eq("venue_id", asString(outlet.venue_id) ?? "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (Array.isArray(data) ? (data as Row[]) : []).map((row) => ({
        id: asString(row.id) ?? "",
        outletId,
        name: asString(row.name) ?? "",
        price: asNumber(row.price_cents) ? (asNumber(row.price_cents) ?? 0) / 100 : undefined,
        confidence: asNumber(row.extraction_confidence) ?? 0,
        sourcePhotoUrl: asString(row.source_photo_url) ?? "",
        // ocr_raw_text is the raw OCR line, not a customer-facing description.
        suggestedDescription: undefined,
        suggestedDietaryTags: [],
        suggestedTasteTags: [],
        status: (asString(row.review_status) === "rejected"
          ? "rejected"
          : asString(row.review_status) === "accepted"
            ? "accepted"
            : "pending") as OCRDishDraft["status"],
        createdAt: asString(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async acceptOCRDraft(draftId, edits) {
      const client = requireSupabaseClient();
      const { data, error } = await client
        .from("dishes_draft")
        .select("*")
        .eq("id", draftId)
        .single();
      if (error) throw error;
      const draft = data as Row;
      const venueId = asString(draft.venue_id) ?? "";
      const { data: outletData, error: outletError } = await client
        .from("merchant_outlets")
        .select("*")
        .eq("venue_id", venueId)
        .limit(1)
        .single();
      if (outletError) throw outletError;
      const outletId = asString((outletData as Row).id) ?? "";
      const dishId = asString(draft.promoted_dish_id) ?? `dish-from-${draftId}`;
      const findExistingDish = async () =>
        (await this.getMenu(outletId)).find((menuDish) => menuDish.id === dishId);
      // Already added (another device or a list tap): apply the editor's changes, not drop them.
      const withEdits = (existing: DishDetail) =>
        edits && Object.keys(edits).length > 0
          ? this.editDish(outletId, existing.id, edits)
          : existing;
      const reviewStatus = asString(draft.review_status);
      if (reviewStatus === "rejected") throw new Error("This draft was already rejected.");
      if (reviewStatus === "accepted" || reviewStatus === "promoted") {
        const existing = await findExistingDish();
        if (existing) return withEdits(existing);
      }
      let dish: DishDetail;
      try {
        dish = await this.addDish(outletId, {
          name: asString(draft.name) ?? "New dish",
          price: asNumber(draft.price_cents) ? (asNumber(draft.price_cents) ?? 0) / 100 : 0,
          tasteTags: [],
          ...edits,
          id: dishId,
        });
      } catch (insertError) {
        // A repeated tap races the first insert; return the dish it created.
        const existing = await findExistingDish();
        if (!existing) throw insertError;
        dish = await withEdits(existing);
      }
      const { error: updateError } = await client
        .from("dishes_draft")
        .update({ review_status: "accepted", promoted_dish_id: dish.id })
        .eq("id", draftId);
      if (updateError) throw updateError;
      return dish;
    },

    async acceptOCRDrafts(draftIds) {
      const client = requireSupabaseClient();
      const ids = [...new Set(draftIds)];
      const acceptedIds: string[] = [];
      const failedIds: string[] = [];
      if (ids.length === 0) return { acceptedIds, failedIds };

      // One read for every draft, one for the outlets and one menu read per outlet, instead of
      // repeating all three inside each accept.
      const { data: draftData, error: draftError } = await client
        .from("dishes_draft")
        .select("*")
        .in("id", ids);
      if (draftError) throw draftError;
      const draftById = new Map(
        (Array.isArray(draftData) ? (draftData as Row[]) : []).map((row) => [
          asString(row.id) ?? "",
          row,
        ]),
      );
      const venueIds = [
        ...new Set([...draftById.values()].map((row) => asString(row.venue_id) ?? "")),
      ].filter(Boolean);
      const { data: outletData, error: outletError } = await client
        .from("merchant_outlets")
        .select("*")
        .in("venue_id", venueIds);
      if (outletError) throw outletError;
      const outletIdByVenueId = new Map<string, string>();
      for (const row of Array.isArray(outletData) ? (outletData as Row[]) : []) {
        const venueId = asString(row.venue_id) ?? "";
        if (venueId && !outletIdByVenueId.has(venueId)) {
          outletIdByVenueId.set(venueId, asString(row.id) ?? "");
        }
      }
      const menuByOutletId = new Map<string, Map<string, DishDetail>>();
      await Promise.all(
        [...new Set(outletIdByVenueId.values())].map(async (outletId) => {
          const menu = await this.getMenu(outletId);
          menuByOutletId.set(outletId, new Map(menu.map((dish) => [dish.id, dish])));
        }),
      );

      const newlyAcceptedIds: string[] = [];
      for (const draftId of ids) {
        const draft = draftById.get(draftId);
        const outletId = outletIdByVenueId.get(asString(draft?.venue_id) ?? "");
        const menu = outletId ? menuByOutletId.get(outletId) : undefined;
        const reviewStatus = asString(draft?.review_status);
        if (!draft || !outletId || !menu || reviewStatus === "rejected") {
          failedIds.push(draftId);
          continue;
        }
        const dishId = asString(draft.promoted_dish_id) ?? `dish-from-${draftId}`;
        if ((reviewStatus === "accepted" || reviewStatus === "promoted") && menu.has(dishId)) {
          acceptedIds.push(draftId);
          continue;
        }
        try {
          // n-plus-one-ok: each dish saves through merchant_save_dish, one transaction per dish.
          const dish = await this.addDish(outletId, {
            name: asString(draft.name) ?? "New dish",
            price: asNumber(draft.price_cents) ? (asNumber(draft.price_cents) ?? 0) / 100 : 0,
            tasteTags: [],
            id: dishId,
          });
          menu.set(dish.id, dish);
          acceptedIds.push(draftId);
          newlyAcceptedIds.push(draftId);
        } catch {
          // The draft stays listed so the merchant can try it again.
          failedIds.push(draftId);
        }
      }

      if (newlyAcceptedIds.length > 0) {
        const { error: updateError } = await client
          .from("dishes_draft")
          .update({ review_status: "accepted" })
          .in("id", newlyAcceptedIds);
        if (updateError) console.warn("Could not mark photo drafts accepted", updateError.message);
      }
      return { acceptedIds, failedIds };
    },

    async rejectOCRDraft(draftId) {
      const { error } = await requireSupabaseClient()
        .from("dishes_draft")
        .update({ review_status: "rejected" })
        .eq("id", draftId);
      if (error) throw error;
    },

    async getInbox(outletId, filters) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const venueId = asString(outlet.venue_id) ?? "";
      // Only reviews exist today, so a non-review type filter has nothing to return.
      if (filters?.type && filters.type !== "review") return [];
      let query = client
        .from("reviews")
        .select(
          "id,dish_id,user_id,author_name,rating,text,tags,created_at,merchant_reply_text,merchant_replied_at",
        )
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (filters?.unrepliedOnly) query = query.is("merchant_reply_text", null);
      query = applyMerchantReviewKeyset(query, filters?.before, filters?.beforeId);
      // Never an unbounded read: callers page with `before` (the oldest created_at they hold).
      query = query.limit(
        Math.min(Math.max(1, filters?.limit ?? MERCHANT_INBOX_MAX_ROWS), MERCHANT_INBOX_MAX_ROWS),
      );
      const { data, error } = await query;
      if (error) throw error;
      const reviewRows = Array.isArray(data) ? (data as Row[]) : [];
      const dishNameById = await fetchDishNamesById(
        client,
        reviewRows.map((row) => asString(row.dish_id) ?? ""),
      );
      const interactions = reviewRows.map((row) => {
        const rating = asNumber(row.rating);
        // A deleted account's kept review is a bare rating, as on the dish page.
        const fromDeletedAccount = isDeletedAccountReviewRow(row);
        return {
          id: asString(row.id) ?? "",
          outletId,
          type: "review" as InteractionType,
          authorName: fromDeletedAccount
            ? "Deleted account"
            : (asString(row.author_name) ?? "Hungry diner"),
          rating,
          text: fromDeletedAccount ? "" : (asString(row.text) ?? ""),
          tags: fromDeletedAccount ? [] : asStringArray(row.tags),
          createdAt: asString(row.created_at) ?? new Date().toISOString(),
          dishName: dishNameById.get(asString(row.dish_id) ?? ""),
          reply: asString(row.merchant_reply_text)
            ? {
                text: asString(row.merchant_reply_text) ?? "",
                repliedAt: asString(row.merchant_replied_at) ?? new Date().toISOString(),
              }
            : undefined,
          sourceId: asString(row.id),
          sentiment:
            rating === undefined
              ? "neutral"
              : rating >= 4
                ? "positive"
                : rating <= 2
                  ? "negative"
                  : "neutral",
        } satisfies CustomerInteraction;
      });
      return interactions;
    },

    async replyToInteraction(interactionId, text) {
      const trimmedText = text.trim();
      if (!trimmedText) throw new Error("Reply text is required");
      if (trimmedText.length > MERCHANT_REPLY_MAX_LENGTH) {
        throw new Error(`Replies can be up to ${MERCHANT_REPLY_MAX_LENGTH} characters.`);
      }
      const { error } = await requireSupabaseClient()
        .from("reviews")
        .update({
          merchant_reply_text: trimmedText,
          merchant_replied_at: new Date().toISOString(),
        })
        .eq("id", interactionId);
      if (error) throw error;
    },

    async removeInteractionReply(interactionId) {
      const { error } = await requireSupabaseClient()
        .from("reviews")
        .update({ merchant_reply_text: null, merchant_replied_at: null })
        .eq("id", interactionId);
      if (error) throw error;
    },

    async reportInteraction(interactionId, reason) {
      const trimmedReason = reason.trim();
      if (!trimmedReason) throw new Error("Report reason is required");
      const { error } = await requireSupabaseClient().from("customer_interaction_reports").insert({
        interaction_id: interactionId,
        reason: trimmedReason,
      });
      if (error) throw error;
    },

    async listPopularVisitorCandidates(outletId, options) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;
      const venueId = asString(outlet.venue_id) ?? "";

      let candidateQuery = client
        .from("reviews")
        .select("id,user_id,dish_id,venue_id,author_name,rating,text,created_at")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      candidateQuery = applyMerchantReviewKeyset(
        candidateQuery,
        options?.before,
        options?.beforeId,
      );
      candidateQuery = candidateQuery.limit(
        Math.min(Math.max(1, options?.limit ?? MERCHANT_INBOX_MAX_ROWS), MERCHANT_INBOX_MAX_ROWS),
      );
      const { data, error } = await candidateQuery;
      if (error) throw error;

      const reviewRows = Array.isArray(data) ? (data as Row[]) : [];
      const activePins = await listSupabasePopularVisitorPinsForOutlet(client, resolvedOutletId);
      const activePinByReviewId = new Map(activePins.map((pin) => [pin.reviewId, pin]));
      const profileById = await fetchSafeProfileRowsById(
        client,
        reviewRows.map((row) => asString(row.user_id) ?? ""),
      );
      const dishIds = Array.from(
        new Set(reviewRows.map((row) => asString(row.dish_id)).filter(Boolean)),
      ) as string[];
      const dishNameById = new Map<string, string>();
      if (dishIds.length > 0) {
        const dishRows = await client.from("dishes").select("id,name").in("id", dishIds);
        if (dishRows.error) throw dishRows.error;
        (Array.isArray(dishRows.data) ? (dishRows.data as Row[]) : []).forEach((row) => {
          const id = asString(row.id);
          const name = asString(row.name);
          if (id && name) dishNameById.set(id, name);
        });
      }

      return reviewRows.map((row) => {
        const reviewId = asString(row.id) ?? "";
        const profileId = asString(row.user_id);
        const profile = profileId ? profileById.get(profileId) : undefined;
        const activePin = activePinByReviewId.get(reviewId);
        return {
          outletId: resolvedOutletId,
          venueId,
          reviewId,
          sourceId: reviewId,
          authorProfileId: profileId,
          authorName:
            asString(profile?.display_name) ?? asString(row.author_name) ?? "Hungry diner",
          reviewText: asString(row.text) ?? "",
          rating: asNumber(row.rating) ?? 0,
          dishName: dishNameById.get(asString(row.dish_id) ?? ""),
          visitedAt: asString(row.created_at) ?? new Date().toISOString(),
          isPinned: Boolean(activePin),
          pinId: activePin?.id,
          sortOrder: activePin?.sortOrder,
        } satisfies PopularVisitorCandidate;
      });
    },

    async listPopularVisitorPins(outletId) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      return listSupabasePopularVisitorPinsForOutlet(client, asString(outlet.id) ?? outletId);
    },

    async pinPopularVisitor(outletId, reviewId) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;
      const venueId = asString(outlet.venue_id) ?? "";

      const existingPin = await client
        .from("merchant_popular_visitor_pins")
        .select("*")
        .eq("outlet_id", resolvedOutletId)
        .eq("review_id", reviewId)
        .maybeSingle();
      if (existingPin.error) throw existingPin.error;
      const existingPinRow = existingPin.data as Row | null;
      if (existingPinRow && asBoolean(existingPinRow.is_active)) {
        return mapPopularVisitorPin(existingPinRow);
      }

      const activePins = await listSupabasePopularVisitorPinsForOutlet(client, resolvedOutletId);
      if (activePins.length >= 6) {
        throw new Error("A stall can feature up to 6 popular visitors.");
      }

      const { data: reviewData, error } = await client
        .from("reviews")
        .select("id,user_id,dish_id,venue_id,author_name,rating,text,created_at")
        .eq("id", reviewId)
        .eq("venue_id", venueId)
        .single();
      if (error) throw error;

      const reviewRow = reviewData as Row;
      const profileId = asString(reviewRow.user_id);
      const profileById = await fetchSafeProfileRowsById(client, profileId ? [profileId] : []);
      const profile = profileId ? profileById.get(profileId) : undefined;
      const safeProfileId = profile ? profileId : undefined;
      const dishId = asString(reviewRow.dish_id);
      let dishName: string | undefined;
      if (dishId) {
        const dishRow = await client.from("dishes").select("name").eq("id", dishId).maybeSingle();
        if (dishRow.error) throw dishRow.error;
        dishName = asString((dishRow.data as Row | null)?.name);
      }
      const nextSortOrder = activePins.reduce((max, pin) => Math.max(max, pin.sortOrder), -1) + 1;

      const { data: pinData, error: pinError } = await client
        .from("merchant_popular_visitor_pins")
        .upsert(
          {
            outlet_id: resolvedOutletId,
            venue_id: venueId,
            review_id: reviewId,
            source_id: reviewId,
            author_profile_id: safeProfileId ?? null,
            author_name:
              asString(profile?.display_name) ?? asString(reviewRow.author_name) ?? "Hungry diner",
            // Names only: the pin never copies a diner's profile photo.
            author_avatar_url: null,
            author_location: null,
            review_text: asString(reviewRow.text) ?? "",
            rating: asNumber(reviewRow.rating) ?? 0,
            dish_name: dishName ?? null,
            visited_at: asString(reviewRow.created_at) ?? new Date().toISOString(),
            pinned_at: new Date().toISOString(),
            sort_order: nextSortOrder,
            is_active: true,
          },
          { onConflict: "outlet_id,review_id" },
        )
        .select("*")
        .single();
      if (pinError) throw pinError;
      return mapPopularVisitorPin(pinData as Row);
    },

    async unpinPopularVisitor(pinId) {
      const { error } = await requireSupabaseClient()
        .from("merchant_popular_visitor_pins")
        .update({ is_active: false })
        .eq("id", pinId);
      if (error) throw error;
    },

    async reorderPopularVisitorPins(outletId, orderedPinIds) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;
      const activePins = await listSupabasePopularVisitorPinsForOutlet(client, resolvedOutletId);
      const activePinIds = new Set(activePins.map((pin) => pin.id));
      const uniqueOrderedIds = Array.from(
        new Set(orderedPinIds.filter((pinId) => activePinIds.has(pinId))),
      );
      const finalOrder = [
        ...uniqueOrderedIds,
        ...activePins.map((pin) => pin.id).filter((pinId) => !uniqueOrderedIds.includes(pinId)),
      ];

      // One UPDATE sets every pin's position.
      const { error: reorderError } = await client.rpc("reorder_popular_visitor_pins", {
        p_outlet_id: resolvedOutletId,
        p_pin_ids: finalOrder,
      });
      if (reorderError) throw reorderError;
      return listSupabasePopularVisitorPinsForOutlet(client, resolvedOutletId);
    },

    async getPromotions(outletId, status) {
      const client = requireSupabaseClient();
      const outlet = await getMerchantOutletRow(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;
      const query = client
        .from("merchant_promotions")
        .select("*")
        .eq("outlet_id", resolvedOutletId)
        .order("created_at", { ascending: false });
      const { data, error } = status ? await query.eq("status", status) : await query;
      if (error) throw error;
      return (Array.isArray(data) ? (data as Row[]) : []).map(mapPromotion);
    },

    async createPromotion(outletId, promo) {
      const client = requireSupabaseClient();
      const outlet = await getMerchantOutletRow(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;
      const validatedPromo = validateMerchantPromotionInput(promo, {
        outletDishIds: await listPromotionOutletDishIds(client, outlet),
      });
      const { data, error } = await client
        .from("merchant_promotions")
        .insert({
          outlet_id: resolvedOutletId,
          title: validatedPromo.title,
          description: validatedPromo.description,
          target_dish_id: validatedPromo.targetDishId ?? null,
          start_date: validatedPromo.startDate,
          end_date: validatedPromo.endDate,
          target_audience: validatedPromo.targetAudience,
          status: validatedPromo.status,
          promotion_item_type: validatedPromo.promotionItemType ?? "new_item",
          original_price: validatedPromo.originalPrice ?? null,
          promotional_price: validatedPromo.promotionalPrice ?? null,
          final_price: validatedPromo.finalPrice ?? validatedPromo.promotionalPrice ?? null,
          discount_percentage: validatedPromo.discountPercentage ?? null,
          is_available: validatedPromo.isAvailable ?? validatedPromo.status === "active",
          // Counters are server-only (analytics events increment them); the column defaults apply.
        })
        .select("*")
        .single();
      if (error) throw error;
      return mapPromotion(data as Row);
    },

    async updatePromotion(promoId, updates) {
      const client = requireSupabaseClient();
      const { data: currentData, error: currentError } = await client
        .from("merchant_promotions")
        .select("*")
        .eq("id", promoId)
        .single();
      if (currentError) throw currentError;
      const currentPromotion = mapPromotion(currentData as Row);
      const outlet = await getMerchantOutletRow(client, currentPromotion.outletId);
      const validatedUpdates = validateMerchantPromotionInput(
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
          outletDishIds: await listPromotionOutletDishIds(client, outlet),
        },
      );
      const payload: Row = {};
      if (updates.title !== undefined) payload.title = validatedUpdates.title;
      if (updates.description !== undefined) payload.description = validatedUpdates.description;
      if (updates.targetDishId !== undefined)
        payload.target_dish_id = validatedUpdates.targetDishId;
      if (updates.startDate !== undefined) payload.start_date = validatedUpdates.startDate;
      if (updates.endDate !== undefined) payload.end_date = validatedUpdates.endDate;
      if (updates.targetAudience !== undefined)
        payload.target_audience = validatedUpdates.targetAudience;
      if (updates.status !== undefined) payload.status = validatedUpdates.status;
      if (updates.promotionItemType !== undefined)
        payload.promotion_item_type = validatedUpdates.promotionItemType;
      if (updates.originalPrice !== undefined)
        payload.original_price = validatedUpdates.originalPrice;
      if (updates.promotionalPrice !== undefined)
        payload.promotional_price = validatedUpdates.promotionalPrice;
      if (updates.finalPrice !== undefined || updates.promotionalPrice !== undefined) {
        payload.final_price = validatedUpdates.finalPrice;
      }
      if (updates.discountPercentage !== undefined)
        payload.discount_percentage = validatedUpdates.discountPercentage;
      if (updates.isAvailable !== undefined) payload.is_available = validatedUpdates.isAvailable;
      const { data, error } = await client
        .from("merchant_promotions")
        .update(payload)
        .eq("id", promoId)
        .select("*")
        .single();
      if (error) throw error;
      return mapPromotion(data as Row);
    },

    async deletePromotion(promoId) {
      const client = requireSupabaseClient();
      // RLS (merchant_promotions_write_owner_or_manager_delete) limits this to the outlet's team.
      const { data, error } = await client
        .from("merchant_promotions")
        .delete()
        .eq("id", promoId)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Promotion not found or you cannot delete it.");
    },

    async getPromotionAnalytics(promoId) {
      const { data, error } = await requireSupabaseClient()
        .from("merchant_promotions")
        .select("*")
        .eq("id", promoId)
        .single();
      if (error) throw error;
      return mapPromotion(data as Row).analytics ?? buildPromotionAnalytics({ status: "draft" });
    },

    async getAnalytics(outletId, dateRange) {
      const client = requireSupabaseClient();
      const outlet = await getMerchantOutletRow(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;
      const since = getMerchantAnalyticsSince(dateRange);
      const { data, error } = await client.rpc("get_merchant_analytics", {
        p_outlet_id: resolvedOutletId,
        p_since: since,
        p_until: null,
      });
      if (error) throw error;
      return mapMerchantAnalyticsPayload(data, resolvedOutletId, dateRange);
    },

    async getDashboardSummary(outletId) {
      const client = requireSupabaseClient();
      const outlet = await getMerchantOutletRow(client, outletId);
      const { data, error } = await client.rpc("get_merchant_dashboard_summary", {
        p_outlet_id: asString(outlet.id) ?? outletId,
      });
      if (error) throw error;
      const row = (data ?? {}) as Row;
      const latest = row.latestReview as Row | null | undefined;
      return {
        menuCount: asNumber(row.menuCount) ?? 0,
        dishesWithoutImages: asNumber(row.dishesWithoutImages) ?? 0,
        unrepliedReviews: asNumber(row.unrepliedReviews) ?? 0,
        latestReview: latest
          ? {
              id: asString(latest.id) ?? "",
              authorName: asString(latest.authorName) ?? "Hungry diner",
              rating: asNumber(latest.rating),
              text: asString(latest.text) ?? "",
              createdAt: asString(latest.createdAt) ?? new Date().toISOString(),
            }
          : undefined,
      };
    },

    async getWeeklySummaryStats(outletId) {
      // Read-only: opening Settings must not write a summary row for every visit.
      const [analytics, summary, promotions] = await Promise.all([
        this.getAnalytics(outletId, "7d"),
        this.getDashboardSummary(outletId),
        this.getPromotions(outletId),
      ]);
      return buildWeeklySummaryFromAnalytics(
        outletId,
        analytics,
        summary.unrepliedReviews,
        promotions,
      );
    },

    async getMerchantNotifications(merchantAccountId) {
      const { data, error } = await requireSupabaseClient()
        .from("merchant_notifications")
        .select("*")
        .eq("merchant_account_id", merchantAccountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (Array.isArray(data) ? (data as Row[]) : []).map(mapMerchantNotification);
    },

    async generateDishDescription(dishName, ingredients) {
      const ingredientText = ingredients?.join(", ") || "fresh, quality ingredients";
      return `A delicious ${dishName} made with ${ingredientText}. Prepared fresh and ready for Hungry diners.`;
    },

    async suggestIngredients(dishName) {
      return dishName.toLowerCase().includes("wonton")
        ? ["egg noodles", "wonton wrappers", "minced pork", "char siu", "spring onions"]
        : ["salt", "pepper", "garlic", "oil"];
    },

    async suggestAllergens(ingredients) {
      return suggestAllergensFromIngredients(ingredients);
    },

    async suggestTags(dishName) {
      return dishName.toLowerCase().includes("wonton")
        ? ["Savoury", "Springy noodles", "Comfort food"]
        : ["Fresh", "Savoury"];
    },

    async generateAIReply(interactionId) {
      const { data } = await requireSupabaseClient()
        .from("reviews")
        .select("rating")
        .eq("id", interactionId)
        .maybeSingle();
      const rating = asNumber((data as Row | null)?.rating);
      if (rating !== undefined && rating <= 2) {
        return "We are sorry about your experience. We will review this with the team and improve.";
      }
      return "Thank you for sharing your feedback. We appreciate your support and hope to see you again.";
    },

    async getAIInsights(outletId) {
      const analytics = await this.getAnalytics(outletId, "7d");
      return [
        {
          id: `weekly-${outletId}`,
          outletId,
          type: "weekly_summary",
          title: "Last 7 days",
          body: `${analytics.reviewCount} customer ${analytics.reviewCount === 1 ? "review" : "reviews"} in the last 7 days.`,
          actionLabel: "Open analytics",
          actionTarget: "Analytics",
          createdAt: new Date().toISOString(),
          isDismissed: false,
        },
      ] satisfies AIBusinessInsight[];
    },

    async getWeeklySummary(outletId) {
      return (await this.getAIInsights(outletId))[0];
    },

    async getProfileSuggestions(outletId) {
      return (await this.getAIInsights(outletId)).filter(
        (insight) => insight.type === "profile_improvement",
      );
    },

    async getMenuCleanupSuggestions(outletId) {
      return (await this.getAIInsights(outletId)).filter(
        (insight) => insight.type === "menu_cleanup" || insight.type === "photo_enhancement",
      );
    },

    async getDemandInsights(outletId) {
      return (await this.getAIInsights(outletId)).filter(
        (insight) => insight.type === "demand_insight" || insight.type === "promotion_tip",
      );
    },

    async getTeamMembers(merchantAccountId) {
      const { data, error } = await requireSupabaseClient()
        .from("merchant_roles")
        .select("*")
        .eq("merchant_account_id", merchantAccountId);
      if (error) throw error;
      return (Array.isArray(data) ? (data as Row[]) : []).map((row) => ({
        id: asString(row.id) ?? "",
        merchantAccountId,
        userId: asString(row.user_id) ?? "",
        displayName: asString(row.display_name) ?? asString(row.email) ?? "Team member",
        email: asString(row.email) ?? "",
        role: asMerchantRole(row.role),
        addedAt: asString(row.created_at) ?? new Date().toISOString(),
        inviteStatus: asMerchantInviteStatus(row.invite_status),
        invitedAt: asString(row.invited_at),
        acceptedAt: asString(row.accepted_at),
        removedAt: asString(row.removed_at),
      }));
    },

    async addTeamMember(merchantAccountId, email, role, displayName) {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = displayName?.trim() ?? "";
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        throw new Error("Valid team member email is required");
      }
      if (!trimmedName) {
        throw new Error("Team member name is required");
      }
      const { data, error } = await requireSupabaseClient()
        .from("merchant_roles")
        .insert({
          merchant_account_id: merchantAccountId,
          user_id: null,
          email: normalizedEmail,
          display_name: trimmedName,
          role,
          invite_status: "pending",
          invited_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw error;
      const row = data as Row;
      const { error: notificationError } = await requireSupabaseClient()
        .from("merchant_notifications")
        .upsert(
          {
            merchant_account_id: merchantAccountId,
            recipient_email: normalizedEmail,
            kind: "team_invite",
            title: "You have been invited to manage a Hungry stall",
            body: `${trimmedName}, open Hungry to accept your merchant team invite.`,
            status: "sent",
            dedupe_key: `team-invite:${merchantAccountId}:${normalizedEmail}`,
            deep_link: MERCHANT_DEEP_LINKS.settings,
            metadata: {
              memberId: asString(row.id),
              role,
              delivery: "email",
            },
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true },
        );
      if (notificationError) throw notificationError;
      const { error: emailError } = await requireSupabaseClient().rpc(
        "enqueue_merchant_team_invite_email",
        {
          p_merchant_account_id: merchantAccountId,
          p_recipient_email: normalizedEmail,
          p_member_id: asString(row.id) ?? null,
          p_role: role,
          p_invitee_name: trimmedName,
        },
      );
      if (emailError) throw emailError;
      return {
        id: asString(row.id) ?? "",
        merchantAccountId,
        userId: asString(row.user_id) ?? "",
        displayName: asString(row.display_name) ?? trimmedName,
        email: asString(row.email) ?? normalizedEmail,
        role,
        inviteStatus: asMerchantInviteStatus(row.invite_status),
        invitedAt: asString(row.invited_at),
        acceptedAt: asString(row.accepted_at),
        removedAt: asString(row.removed_at),
        addedAt: asString(row.created_at) ?? new Date().toISOString(),
      };
    },

    async removeTeamMember(memberId) {
      const { error } = await requireSupabaseClient()
        .from("merchant_roles")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },

    async updateTeamMemberRole(memberId, role) {
      const { error } = await requireSupabaseClient()
        .from("merchant_roles")
        .update({ role })
        .eq("id", memberId);
      if (error) throw error;
    },

    async getNotificationPreferences(merchantAccountId) {
      const { data, error } = await requireSupabaseClient()
        .from("merchant_notification_preferences")
        .select("*")
        .eq("merchant_account_id", merchantAccountId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_MERCHANT_NOTIFICATION_PREFERENCES;
      const row = data as Row;
      return {
        newReviews: asBoolean(row.new_reviews) ?? true,
        lowRatingAlerts: asBoolean(row.low_rating_alerts) ?? true,
        newComments: asBoolean(row.new_comments) ?? true,
        promotionUpdates: asBoolean(row.promotion_updates) ?? true,
        weeklyDigest: asBoolean(row.weekly_digest) ?? true,
        aiInsights: asBoolean(row.ai_insights) ?? true,
      };
    },

    async updateNotificationPreferences(merchantAccountId, prefs) {
      const current = await this.getNotificationPreferences(merchantAccountId);
      const next = { ...current, ...prefs };
      const { error } = await requireSupabaseClient()
        .from("merchant_notification_preferences")
        .upsert(
          {
            merchant_account_id: merchantAccountId,
            new_reviews: next.newReviews,
            low_rating_alerts: next.lowRatingAlerts,
            new_comments: next.newComments,
            promotion_updates: next.promotionUpdates,
            weekly_digest: next.weeklyDigest,
            ai_insights: next.aiInsights,
          },
          { onConflict: "merchant_account_id" },
        );
      if (error) throw error;
    },
  },

  recommendations: {
    async getSlate(request) {
      const profile = await supabaseService.profile.getProfile();
      const client = getSupabaseClient();
      const liveItems = client
        ? await getLiveTasteRecommendations(client, request, profile)
        : undefined;

      return {
        surface: request.surface,
        generatedAt: new Date().toISOString(),
        items: liveItems ?? getRankedRecommendations(request, profile),
      };
    },

    async recordImpression(surface, dishIds, buckets) {
      const client = getSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      const ids = [...new Set(dishIds)].slice(0, 50);
      if (!client || !userId || ids.length === 0) return;
      const shownBuckets = Object.fromEntries(
        ids.filter((id) => buckets?.[id]).map((id) => [id, buckets?.[id]]),
      );
      const { error } = await client.from("recommendation_impressions").insert({
        user_id: userId,
        surface,
        dish_ids: ids,
        ...(Object.keys(shownBuckets).length > 0 ? { buckets: shownBuckets } : {}),
      });
      if (error) console.warn("Failed to record recommendation impression", error.message);
    },

    async getFoodHistory() {
      const client = getSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!client || !userId) return [];
      const { data, error } = await client.rpc("get_my_food_history", { p_limit: 300 });
      if (error || !Array.isArray(data)) {
        if (error) console.warn("Failed to load food history", error.message);
        return [];
      }
      return (data as Row[]).map((row) => ({
        dishId: String(row.dish_id ?? ""),
        foodType: typeof row.food_type === "string" ? row.food_type : undefined,
        venueId: typeof row.venue_id === "string" ? row.venue_id : undefined,
        evidence: Number(row.evidence ?? 0),
        absEvidence: Number(row.abs_evidence ?? 0),
        lastEventAt: String(row.last_event_at ?? new Date().toISOString()),
        dismissedUntil: typeof row.dismissed_until === "string" ? row.dismissed_until : undefined,
      }));
    },

    async resetFoodHistory() {
      const client = getSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!client || !userId) return;
      const { error } = await client.from("user_dish_affinities").delete().eq("user_id", userId);
      if (error) throw error;
    },

    async recordExplicitFeedback(feedback) {
      const profile = await supabaseService.profile.getProfile();
      const vectorBefore = clampTasteVector(feedback.userVectorBefore ?? profile.tasteVector);
      const createdAt = feedback.createdAt ?? new Date().toISOString();
      const persistedType = toPersistedFeedbackType(feedback);
      const dish = feedback.dishId ? supabaseRepository.getDishById(feedback.dishId) : undefined;
      if (!dish && feedback.feedbackType !== "search_query") {
        const event = createServiceTasteEvent({
          type: persistedType,
          feedback,
          vectorBefore,
          vectorAfter: vectorBefore,
          applied: false,
          createdAt,
          reason: "missing_dish",
        });
        await persistFeedbackEvent({
          persistedType,
          feedback,
          vectorBefore,
          vectorAfter: vectorBefore,
          applied: false,
          createdAt,
          reason: "missing_dish",
        });
        return {
          tasteVector: profile.tasteVector,
          event,
          applied: false,
          reason: "missing_dish",
        };
      }

      const searchVectors =
        feedback.feedbackType === "search_query" && feedback.query
          ? getRankedRecommendations(
              {
                surface: feedback.surface ?? "search",
                tasteProfile: profile.tasteVector,
                dietaryFlags: profile.dietaryPreferences,
                query: feedback.query,
                limit: 5,
              },
              profile,
            ).map((item) => item.dish.tasteVector)
          : [];
      const dishVector =
        dish?.tasteVector ??
        (searchVectors.length
          ? averageTasteVectors(searchVectors, profile.tasteVector)
          : undefined);

      if (!dishVector) {
        const event = createServiceTasteEvent({
          type: persistedType,
          feedback,
          vectorBefore,
          vectorAfter: vectorBefore,
          applied: false,
          createdAt,
          reason: "missing_signal",
        });
        await persistFeedbackEvent({
          persistedType,
          feedback,
          vectorBefore,
          vectorAfter: vectorBefore,
          applied: false,
          createdAt,
          reason: "missing_signal",
          dishId: dish?.id,
        });
        return {
          tasteVector: profile.tasteVector,
          event,
          applied: false,
          reason: "missing_signal",
        };
      }

      const client = getSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      const capped =
        feedback.applied === false
          ? feedback.reason === "capped"
          : client && userId
            ? await isLiveFeedbackCapped(client, userId, feedback, persistedType, createdAt)
            : false;
      const applied = feedback.applied !== undefined ? feedback.applied : !capped;
      const reason: TasteInteractionEvent["reason"] | undefined = !applied
        ? (feedback.reason ?? (capped ? "capped" : undefined))
        : undefined;
      const updatedVector = applied
        ? clampTasteVector(
            feedback.userVectorAfter ??
              processExplicitFeedbackCore(vectorBefore, {
                type: toCoreFeedbackType(feedback),
                dishVector,
                hawkerTags: feedback.hawkerTags,
                timestamp: createdAt ? new Date(createdAt).getTime() : Date.now(),
              }),
          )
        : vectorBefore;
      const event = createServiceTasteEvent({
        type: persistedType,
        feedback,
        vectorBefore,
        vectorAfter: updatedVector,
        applied,
        createdAt,
        reason,
      });
      const persistedWithRpc = await persistFeedbackEvent({
        persistedType,
        feedback,
        vectorBefore,
        vectorAfter: updatedVector,
        applied,
        createdAt,
        reason,
        dishId: dish?.id,
      });

      if (applied && !persistedWithRpc) {
        await supabaseService.profile.updateTasteVector(updatedVector);
      }
      return {
        tasteVector: updatedVector,
        event,
        applied,
        reason,
      };
    },
  },

  ai: {
    computeTasteVector(answers: QuizAnswer[]) {
      return buildTasteVectorFromAnswers(answers);
    },

    async getSmartRecommendations(ctx) {
      const dishes = listAllDishesFromRepository();
      return dishes
        .map((dish) => ({
          dish,
          score: similarityScore(ctx.tasteProfile, dish.tasteVector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(({ dish, score }) => ({
          dish,
          matchScore: score,
          matchReason: explainTasteMatch(ctx.tasteProfile, dish.tasteVector),
        }));
    },

    async adjustCommunityTasteVector(dishId, userRating, reviewId) {
      const rating = Object.fromEntries(
        Object.entries(userRating).filter(([, level]) => typeof level === "number"),
      );
      if (Object.keys(rating).length === 0) return;
      const client = requireSupabaseClient();
      const { error } = await client.rpc("submit_dish_taste_rating", {
        p_dish_id: dishId,
        p_rating: rating,
        p_review_id: reviewId ?? null,
      });
      if (error) throw error;
    },

    explainMatch(userVector, dishVector) {
      return explainTasteMatch(userVector, dishVector);
    },

    computeTasteProfile(answers) {
      return computeTasteProfileFromQuiz(answers);
    },

    async getContextualRecommendations(ctx) {
      const dishes = listAllDishesFromRepository();
      const ranked = runRecommendationPipeline(dishes, {
        userVector: ctx.tasteProfile.vector,
        dietaryFlags: ctx.dietaryFlags,
        neophiliaIndex: ctx.tasteProfile.neophiliaIndex,
        latitude: ctx.latitude,
        longitude: ctx.longitude,
        radiusMeters: ctx.radiusMeters ?? 500,
        excludeDishIds: ctx.excludeDishIds ?? [],
      });
      return ranked
        .map((item) => {
          const dish = dishes.find((candidate) => candidate.id === item.dishId);
          if (!dish) {
            return null;
          }
          return {
            dish,
            matchScore: item.score,
            matchPercent: item.matchPercent,
            matchReason: item.explanation,
            isSerendipitous: item.isSerendipitous,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    },

    async processExplicitFeedback(feedback) {
      const profile = await supabaseService.profile.getProfile();
      if (!feedback.dishId) return profile.tasteVector;
      const dish = supabaseRepository.getDishById(feedback.dishId);
      if (!dish) return profile.tasteVector;

      return processExplicitFeedbackCore(profile.tasteVector, {
        type: toCoreFeedbackType(feedback),
        dishVector: dish.tasteVector,
        timestamp: Date.now(),
      });
    },

    async processImplicitFeedback(_signals: ImplicitSignalInput[]) {
      const profile = await supabaseService.profile.getProfile();
      return profile.tasteVector;
    },

    async getTagSuggestions(dishId) {
      const dish = supabaseRepository.getDishById(dishId);
      if (!dish) return [] satisfies HawkerTasteTag[];
      const entries = Object.entries(dish.tasteVector) as [keyof TasteVector, number][];
      const tasteToTag: Record<keyof TasteVector, HawkerTasteTag> = {
        sweet: "gao",
        spicy: "hiam",
        sour: "sedap",
        salty: "shiok",
        rich: "lemak",
        aromatic: "wok_hei",
      };
      return entries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key]) => tasteToTag[key]);
    },

    async submitCommunityTags() {
      return;
    },

    async parseMoodQuery(query) {
      const client = getSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!client || !userId || query.trim().length < 2) return null;
      const { data, error } = await client.functions.invoke("mood-search", { body: { query } });
      if (error) {
        console.warn("Mood search unavailable", error.message);
        return null;
      }
      return parseMoodIntent((data as Row | undefined)?.intent);
    },
  },

  // ── Checklist ───────────────────────────────────────────────────────────────

  checklist: {
    async createChecklist(name: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("Sign in before creating a checklist.");
      const { data, error } = await client
        .from("checklists")
        .insert({ user_id: userId, name })
        .select()
        .single();
      if (error) throw error;
      return mapChecklist(data as Row);
    },

    async getChecklists() {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client
        .from("checklists")
        .select("*, checklist_items(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row) => mapChecklist(row as Row));
    },

    async getChecklist(id: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client.from("checklists").select("*").eq("id", id).single();
      if (error) throw error;
      return mapChecklist(data as Row);
    },

    async updateChecklist(id: string, name: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.from("checklists").update({ name }).eq("id", id);
      if (error) throw error;
    },

    async deleteChecklist(id: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.from("checklists").delete().eq("id", id);
      if (error) throw error;
    },

    async addChecklistItem(input: any) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client
        .from("checklist_items")
        .insert({
          checklist_id: input.checklistId,
          item_type: input.itemType,
          dish_id: input.dishId,
          stall_id: input.stallId,
          custom_text: input.customText,
          reminder_at: input.reminderAt,
          planned_visit_date: input.plannedVisitDate,
        })
        .select()
        .single();
      if (error) throw error;
      return mapChecklistItem(data as Row);
    },

    async getChecklistItems(checklistId: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client
        .from("checklist_items")
        .select("*")
        .eq("checklist_id", checklistId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []).map((row) => mapChecklistItem(row as Row));
    },

    async updateChecklistItem(id: string, updates: any) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const payload: Row = {};
      if (updates.itemType !== undefined) payload.item_type = updates.itemType;
      if (updates.dishId !== undefined) payload.dish_id = updates.dishId;
      if (updates.stallId !== undefined) payload.stall_id = updates.stallId;
      if (updates.customText !== undefined) payload.custom_text = updates.customText;
      if (updates.reminderAt !== undefined) payload.reminder_at = updates.reminderAt;
      if (updates.plannedVisitDate !== undefined) {
        payload.planned_visit_date = updates.plannedVisitDate;
      }
      const { error } = await client.from("checklist_items").update(payload).eq("id", id);
      if (error) throw error;
    },

    async markChecklistItemTried(id: string, tried = true) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client
        .from("checklist_items")
        .update({ tried_at: tried ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },

    async deleteChecklistItem(id: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.from("checklist_items").delete().eq("id", id);
      if (error) throw error;
    },

    async reorderChecklistItems(checklistId: string, itemIds: string[]) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.rpc("reorder_checklist_items", {
        p_checklist_id: checklistId,
        p_item_ids: itemIds,
      });
      if (error) throw error;
    },
  },

  // ── Portfolio ───────────────────────────────────────────────────────────────

  portfolio: {
    async createPortfolio(input: any) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("Sign in before creating a portfolio.");
      const { data, error } = await client
        .from("portfolios")
        .insert({
          owner_id: userId,
          name: input.name,
          description: input.description,
          type: input.type,
          visibility: input.visibility,
        })
        .select()
        .single();
      if (error) throw error;
      return mapPortfolio(data as Row);
    },

    async getPortfolios(filters?: any) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      // Item counts ride along, so list cards show real counts without opening each list.
      let query = client.from("portfolios").select("*, portfolio_items(count)");

      if (filters?.userId) {
        query = query.eq("owner_id", filters.userId);
      }
      if (filters?.visibility) {
        query = query.eq("visibility", filters.visibility);
      }
      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      if (filters?.ids) {
        if (filters.ids.length === 0) return [];
        query = query.in("id", filters.ids);
      }

      // Bounded: an unfiltered read must not pull every public list on the platform.
      query = query.order("created_at", { ascending: false }).limit(PORTFOLIO_LIST_LIMIT);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row: Row) => mapPortfolio(row));
    },

    async getPortfolio(id: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client
        .from("portfolios")
        .select("*, portfolio_items(count)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return mapPortfolio(data as Row);
    },

    async getPublicPortfolio(id: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      // Security definer RPC: works for signed-out visitors and only returns public lists.
      const { data, error } = await client.rpc("get_public_portfolio", { p_portfolio_id: id });
      if (error) throw error;
      if (!data || typeof data !== "object") return null;
      const row = data as Row;
      const items = Array.isArray(row.items) ? (row.items as Row[]) : [];
      return {
        id: String(row.id),
        name: String(row.name ?? ""),
        description: typeof row.description === "string" ? row.description : undefined,
        ownerDisplayName:
          typeof row.owner_display_name === "string" ? row.owner_display_name : undefined,
        type: ["recommendation", "ranking", "trail", "collection"].includes(String(row.type))
          ? (row.type as Portfolio["type"])
          : undefined,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
        items: items.map((item) => ({
          itemType: item.item_type === "stall" ? ("stall" as const) : ("dish" as const),
          dishId: typeof item.dish_id === "string" ? item.dish_id : undefined,
          stallId: typeof item.stall_id === "string" ? item.stall_id : undefined,
          name: String(item.name ?? "Untitled"),
          stallName: typeof item.stall_name === "string" ? item.stall_name : undefined,
          price: item.price === null || item.price === undefined ? undefined : Number(item.price),
          score: typeof item.score === "number" ? item.score : undefined,
          publicNotes: typeof item.public_notes === "string" ? item.public_notes : undefined,
          imageUrl: typeof item.image_url === "string" ? item.image_url : undefined,
          mapQuery: typeof item.map_query === "string" ? item.map_query : undefined,
        })),
      };
    },

    async updatePortfolio(id: string, updates: any, options?: PortfolioMutationOptions) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const payload: Row = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.visibility !== undefined) payload.visibility = updates.visibility;
      let query = client.from("portfolios").update(payload).eq("id", id);
      if (options?.expectedUpdatedAt) {
        query = query.eq("updated_at", options.expectedUpdatedAt);
      }
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw error;
      if (options?.expectedUpdatedAt && !data) throw portfolioEditConflictError();
    },

    async deletePortfolio(id: string, options?: PortfolioMutationOptions) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      let query = client.from("portfolios").delete().eq("id", id);
      if (options?.expectedUpdatedAt) {
        query = query.eq("updated_at", options.expectedUpdatedAt);
      }
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw error;
      if (options?.expectedUpdatedAt && !data) throw portfolioEditConflictError();
    },

    async publishPortfolio(id: string, options?: PortfolioMutationOptions) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.rpc("publish_portfolio_with_passport", {
        p_portfolio_id: id,
        p_expected_portfolio_updated_at: options?.expectedUpdatedAt,
      });
      if (error) throw error;
    },

    async addPortfolioItem(input: any, options?: PortfolioMutationOptions) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client.rpc("add_portfolio_item_with_passport", {
        p_portfolio_id: input.portfolioId,
        p_item_type: input.itemType,
        p_dish_id: input.dishId,
        p_stall_id: input.stallId,
        p_score: input.score,
        p_public_notes: input.publicNotes,
        p_private_notes: input.privateNotes,
        p_expected_portfolio_updated_at: options?.expectedUpdatedAt,
      });
      if (error) throw error;
      const insertedId = String(data ?? "");
      const { data: row, error: fetchError } = await client
        .from("portfolio_items")
        .select(PORTFOLIO_ITEM_COLUMNS)
        .eq("id", insertedId)
        .single();
      if (fetchError) throw fetchError;
      // The writer just saved these notes, so they are returned without another read.
      return {
        ...mapPortfolioItem(row as unknown as Row),
        privateNotes: input.privateNotes?.trim() || undefined,
      };
    },

    async getPortfolioItems(portfolioId: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client
        .from("portfolio_items")
        .select(PORTFOLIO_ITEM_COLUMNS)
        .eq("portfolio_id", portfolioId)
        .order("position", { ascending: true });
      if (error) throw error;
      const items = (data || []).map((row) => mapPortfolioItem(row as unknown as Row));
      return attachPortfolioPrivateNotes(client, portfolioId, items);
    },

    async getPortfolioItemsForPortfolios(portfolioIds: string[]) {
      const ids = [...new Set(portfolioIds)];
      if (ids.length === 0) return {};
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client
        .from("portfolio_items")
        .select(PORTFOLIO_ITEM_COLUMNS)
        .in("portfolio_id", ids)
        .order("position", { ascending: true });
      if (error) throw error;
      const grouped = new Map<string, PortfolioItem[]>(ids.map((id) => [id, []]));
      for (const row of data || []) {
        const item = mapPortfolioItem(row as unknown as Row);
        grouped.get(item.portfolioId)?.push(item);
      }
      const entries = await Promise.all(
        ids.map(
          async (id) =>
            // n-plus-one-ok: get_portfolio_private_notes takes one list id; an array version needs a migration.
            [id, await attachPortfolioPrivateNotes(client, id, grouped.get(id) ?? [])] as const,
        ),
      );
      return Object.fromEntries(entries);
    },

    async getPortfolioItemDetails(portfolioId: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client.rpc("get_portfolio_item_details", {
        p_portfolio_id: portfolioId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? (data as Row[]) : []).map((row) => ({
        dishId: typeof row.dish_id === "string" ? row.dish_id : undefined,
        stallId: typeof row.stall_id === "string" ? row.stall_id : undefined,
        name: typeof row.name === "string" ? row.name : undefined,
        stallName: typeof row.stall_name === "string" ? row.stall_name : undefined,
        price: row.price === null || row.price === undefined ? undefined : Number(row.price),
        imageUrl: typeof row.image_url === "string" ? row.image_url : undefined,
      }));
    },

    async updatePortfolioItem(id: string, updates: any, options?: PortfolioMutationOptions) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.rpc("update_portfolio_item_with_version", {
        p_item_id: id,
        p_score: updates.score,
        p_public_notes: updates.publicNotes,
        p_private_notes: updates.privateNotes,
        p_expected_portfolio_updated_at: options?.expectedUpdatedAt,
      });
      if (error) throw error;
    },

    async deletePortfolioItem(id: string, options?: PortfolioMutationOptions) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.rpc("delete_portfolio_item_with_version", {
        p_item_id: id,
        p_expected_portfolio_updated_at: options?.expectedUpdatedAt,
      });
      if (error) throw error;
    },

    async reorderPortfolioItems(
      portfolioId: string,
      itemIds: string[],
      options?: PortfolioMutationOptions,
    ) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.rpc("reorder_portfolio_items", {
        p_portfolio_id: portfolioId,
        p_item_ids: itemIds,
        p_expected_portfolio_updated_at: options?.expectedUpdatedAt,
      });
      if (error) throw error;
    },

    async addPortfolioCollaborator(
      portfolioId: string,
      userId: string,
      role: any,
      options?: PortfolioMutationOptions,
    ) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      await assertSupabasePortfolioVersion(client, portfolioId, options);
      const { error } = await client.from("portfolio_collaborators").insert({
        portfolio_id: portfolioId,
        user_id: userId,
        role,
      });
      if (error) throw error;
    },

    async removePortfolioCollaborator(
      portfolioId: string,
      userId: string,
      options?: PortfolioMutationOptions,
    ) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      await assertSupabasePortfolioVersion(client, portfolioId, options);
      const { error } = await client
        .from("portfolio_collaborators")
        .delete()
        .eq("portfolio_id", portfolioId)
        .eq("user_id", userId);
      if (error) throw error;
    },

    async updatePortfolioCollaboratorRole(
      portfolioId: string,
      userId: string,
      role: any,
      options?: PortfolioMutationOptions,
    ) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      await assertSupabasePortfolioVersion(client, portfolioId, options);
      // Only the owner's update policy matches; anyone else changes zero rows.
      const { data, error } = await client
        .from("portfolio_collaborators")
        .update({ role })
        .eq("portfolio_id", portfolioId)
        .eq("user_id", userId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Couldn't change that role.");
    },

    async getPortfolioCollaborators(portfolioId: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      // Joins display names/avatars; only the owner and collaborators get rows (20261019180000).
      const { data, error } = await client.rpc("list_portfolio_collaborators", {
        p_portfolio_id: portfolioId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? (data as Row[]) : []).map(mapPortfolioCollaborator);
    },

    async followPortfolio(portfolioId: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("Sign in before following a portfolio.");
      const { error } = await client
        .from("portfolio_follows")
        .upsert(
          { portfolio_id: portfolioId, user_id: userId },
          { onConflict: "portfolio_id,user_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    },

    async unfollowPortfolio(portfolioId: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("Sign in before unfollowing a portfolio.");
      const { error } = await client
        .from("portfolio_follows")
        .delete()
        .eq("portfolio_id", portfolioId)
        .eq("user_id", userId);
      if (error) throw error;
    },

    async getPortfolioFollows(portfolioId: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client
        .from("portfolio_follows")
        .select("*")
        .eq("portfolio_id", portfolioId);
      if (error) throw error;
      return (data || []).map((row) => mapPortfolioFollow(row as Row));
    },

    async getFollowedPortfolioIds() {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return [];
      const { data, error } = await client
        .from("portfolio_follows")
        .select("portfolio_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []).map((row) => String((row as Row).portfolio_id ?? ""));
    },

    async getSharedPortfolioIds(options?: { role?: "viewer" | "editor" }) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return [];
      let query = client
        .from("portfolio_collaborators")
        .select("portfolio_id")
        .eq("user_id", userId);
      if (options?.role) query = query.eq("role", options.role);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row) => String((row as Row).portfolio_id ?? ""));
    },

    async isFollowingPortfolio(portfolioId: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return false;
      const { data, error } = await client
        .from("portfolio_follows")
        .select("id")
        .eq("portfolio_id", portfolioId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },

    async flagPortfolio(portfolioId: string, reason: string, details?: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("Sign in before flagging a portfolio.");
      const { error } = await client.from("portfolio_flags").insert({
        portfolio_id: portfolioId,
        reporter_id: userId,
        reason,
        details,
      });
      if (error) throw error;
    },

    async getPortfolioFlags(filters?: any) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      let query = client.from("portfolio_flags").select("*");

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row) => mapPortfolioFlag(row as Row));
    },

    async resolvePortfolioFlag(flagId: string, resolution: "dismissed" | "removed") {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      // "removed" also takes the list down (unpublished and private), not just the flag.
      const { error } = await client.rpc("resolve_portfolio_flag", {
        p_flag_id: flagId,
        p_resolution: resolution,
      });
      if (error) throw error;
    },

    async searchPortfolios(query: string, filters?: any) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client.rpc("search_portfolios", {
        p_query: query,
        p_type: filters?.type,
        p_visibility: filters?.visibility,
      });
      if (error) throw error;
      return (data || []).map((row: Row) => mapPortfolio(row));
    },
  },

  // ── Passport ────────────────────────────────────────────────────────────────

  passport: {
    async getPassportStamps() {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client
        .from("passport_stamps")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row) => mapPassportStamp(row as Row));
    },

    async getPassportProgressEvents(categoryId?: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      let query = client
        .from("passport_progress_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row) => mapPassportProgressEvent(row as Row));
    },

    async recordProgress(categoryId: string, eventType: PassportEventType, referenceId?: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.rpc("record_passport_progress", {
        p_category_id: categoryId,
        p_event_type: eventType,
        p_reference_id: referenceId ?? null,
      });
      if (error) throw error;
    },
  },

  notifications: {
    async listActivityEvents(page?: { limit?: number; offset?: number }) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const limit = Math.min(Math.max(page?.limit ?? ACTIVITY_EVENTS_PAGE_SIZE, 1), 100);
      const offset = Math.max(page?.offset ?? 0, 0);
      const { data, error } = await client
        .from("activity_events")
        .select(
          `
          id,
          event_type,
          target_type,
          target_id,
          read_at,
          created_at,
          actor:actor_id (
            id,
            display_name,
            avatar_url
          )
        `,
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (isMissingActivityEventsSchemaError(error)) return [];
      if (error) throw error;
      // Reply events target a comment; resolve each to its post so the inbox
      // row can open it.
      const commentIds = [
        ...new Set(
          (data || [])
            .filter((row: any) => row.target_type === "comment" && row.target_id)
            .map((row: any) => String(row.target_id)),
        ),
      ];
      const postIdByCommentId = new Map<string, string>();
      if (commentIds.length > 0) {
        const comments = await client
          .from("post_comments")
          .select("id,post_id")
          .in("id", commentIds);
        if (!comments.error) {
          (comments.data ?? []).forEach((row: any) => {
            postIdByCommentId.set(String(row.id), String(row.post_id));
          });
        }
      }
      return (data || []).map((row: any) => ({
        postId:
          row.target_type === "comment"
            ? postIdByCommentId.get(String(row.target_id))
            : row.target_type === "post"
              ? (row.target_id as string)
              : undefined,
        id: row.id as string,
        actorId: row.actor?.id as string,
        actorName: (row.actor?.display_name as string) ?? "Unknown",
        actorAvatarUrl: row.actor?.avatar_url as string | undefined,
        eventType: row.event_type as
          | "new_like"
          | "new_comment"
          | "new_reply"
          | "new_follower"
          | "follow_request",
        targetType: row.target_type as "post" | "comment" | "profile",
        targetId: row.target_id as string,
        readAt: row.read_at as string | undefined,
        createdAt: row.created_at as string,
      }));
    },

    async markActivityRead(eventId: string) {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { error } = await client.rpc("mark_activity_read", { p_event_id: eventId });
      if (isMissingMarkActivityReadRpcError(error)) return;
      if (error) throw error;
    },

    async markAllActivityRead() {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase client not initialized");
      const { data, error } = await client.rpc("mark_all_activity_read");
      if (error) throw error;
      return typeof data === "number" ? data : 0;
    },
  },
};
