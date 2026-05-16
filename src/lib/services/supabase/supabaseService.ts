import type { SupabaseClient } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";

import { getFloorPlan } from "@/lib/geo/floorPlans";
import { similarityScore } from "@/lib/ai/similarityScore";
import { computeTasteProfileFromQuiz } from "@/lib/ai/tasteQuiz";
import {
  averageTasteVectors,
  processExplicitFeedback as processExplicitFeedbackCore,
  runRecommendationPipeline,
} from "@/lib/ai/tasteEngine";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import {
  refreshSupabaseRepositoryCache,
  supabaseRepository,
} from "@/lib/services/supabase/supabaseRepository";
import { getSupabaseClient } from "@/lib/services/supabase/client";
import {
  assertValidMenuPhotoUpload,
  uploadImageFromUri,
  uploadPostMediaFromUri,
} from "@/lib/services/supabase/mediaUpload";
import { validateMerchantProfileUpdates } from "@/features/merchant/profileValidation";
import type {
  Bite,
  BiteDraft,
  BlockUserRequest,
  BuildingDetail,
  ChatConversation,
  ChatMessage,
  ChatParticipant,
  ChatSubscriptionHandlers,
  ContentReportRequest,
  ExplicitFeedbackInput,
  HungryService,
  ImplicitSignalInput,
  QuizAnswer,
  RankedRecommendation,
  RecommendationSlateRequest,
  SearchResult,
  Session,
  SubmitReviewInput,
} from "@/lib/services/types";
import type {
  AIBusinessInsight,
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
  PromotionStatus,
  SearchFilters,
  TasteProfile,
  TasteInteractionEvent,
  TasteInteractionType,
  TasteVector,
  Story,
  StoryContent,
  UserProfile,
  VerificationEvidence,
} from "@/types/domain";

type Row = Record<string, unknown>;
type DishPresentation = {
  gallery: string[];
  dietaryFlags: DietaryFlag[];
  tasteVector?: TasteVector;
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_AUTH_PROFILE: UserProfile = {
  id: "supabase-user",
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
  ...DEFAULT_AUTH_PROFILE,
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

async function ensureCurrentUserProfileRow(client: SupabaseClient): Promise<void> {
  let sessionData;
  try {
    ({ data: sessionData } = await client.auth.getSession());
  } catch {
    return;
  }
  const user = sessionData.session?.user;
  if (!user?.id) return;

  const payload = {
    id: user.id,
    email: user.email ?? null,
    display_name:
      (user.user_metadata?.name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      null,
  };

  const { error } = await client.from("user_profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    throw error;
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
  const favouriteDishIds = asStringArray(row.favourite_dish_ids);
  const reviewedDishIds = asStringArray(row.reviewed_dish_ids);
  const accountVisibility = asString(privacyRow.account_visibility);
  return {
    ...DEFAULT_AUTH_PROFILE,
    id: userId,
    displayName:
      asString(row.display_name) ?? asString(row.displayName) ?? DEFAULT_AUTH_PROFILE.displayName,
    email: asString(row.email) ?? email ?? "",
    avatarUrl: asString(row.avatar_url),
    profileVisibility: accountVisibility === "private" ? "private" : "public",
    tasteVector: toTasteVector(row),
    tasteProfile: (row.taste_profile as TasteProfile | undefined) ?? undefined,
    dietaryPreferences: asStringArray(row.dietary_preferences) as DietaryFlag[],
    favouriteDishIds,
    reviewedDishIds,
    stats: {
      dishesReviewed: asNumber(row.dishes_reviewed) ?? reviewedDishIds.length,
      stallsVisited: asNumber(row.stalls_visited) ?? 0,
      favouritesCount: asNumber(row.favourites_count) ?? favouriteDishIds.length,
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

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

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

function buildStorySeed(displayName: string, avatarUrl?: string): Story[] {
  const now = Date.now();
  return [
    {
      id: `s_${now}`,
      displayName,
      avatarUrl: avatarUrl,
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
      avatarUrl:
        "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=150&h=150&fit=crop",
      hasUnseen: true,
      isStall: true,
      content: {
        type: "image",
        url: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800&q=80",
      },
      createdAt: new Date(now - 3_600_000).toISOString(),
      interaction: { liked: false, saved: false, likeCount: 120, commentCount: 12, shareCount: 5 },
    },
    {
      id: `s_${now + 2}`,
      displayName: "Wei Ming",
      avatarUrl: "https://i.pravatar.cc/150?u=wm",
      hasUnseen: true,
      isStall: false,
      content: {
        type: "image",
        url: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80",
      },
      createdAt: new Date(now - 7_200_000).toISOString(),
      interaction: { liked: false, saved: false, likeCount: 45, commentCount: 3, shareCount: 1 },
    },
  ];
}

let supabaseStoryCache: Story[] | null = null;

async function getStoryCache(): Promise<Story[]> {
  if (supabaseStoryCache && supabaseStoryCache.length > 0) {
    return cloneStoryList(supabaseStoryCache.map(sanitizeStoryTimestamp).filter(isFreshStory));
  }
  const profile = await getCurrentUserProfileOrGuest();
  supabaseStoryCache = buildStorySeed(profile.displayName, profile.avatarUrl);
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
  await ensureCurrentUserProfileRow(client);
  const profile = await fetchUserProfile(client, session.user.id, session.user.email ?? undefined);
  return {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: new Date(session.expires_at ? session.expires_at * 1000 : Date.now()).toISOString(),
    profile,
  };
}

async function uploadReviewPhotos(
  client: SupabaseClient,
  userId: string,
  reviewId: string,
  photos: string[],
): Promise<string[]> {
  const uploaded: string[] = [];
  for (let index = 0; index < photos.length; index += 1) {
    const uri = photos[index];
    if (!uri) continue;
    if (!isLocalUri(uri)) {
      throw new Error("Review photos must be uploaded from local device files.");
    }
    const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${reviewId}/photo-${index}.${extension}`;
    const asset = await uploadImageFromUri({
      client,
      bucket: "review-media",
      path,
      uri,
    });
    uploaded.push(asset.publicUrl);
  }
  return uploaded;
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
  });
  return uploaded.publicUrl;
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

async function resolvePostMediaDisplayUrl(client: SupabaseClient, row: Row): Promise<string> {
  const bucket = asString(row.storage_bucket);
  const path = asString(row.storage_path) ?? "";
  const publicUrl = asString(row.public_url);
  if (bucket === "post-media" && path) {
    return (await createSignedStorageUrl(client, bucket, path)) ?? publicUrl ?? "";
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
): Promise<{
  rows: Row[];
  displayUrls: string[];
  canonicalMediaType: Bite["mediaType"];
}> {
  const rows: Row[] = [];
  const displayUrls: string[] = [];
  let hasVideo = false;

  for (let index = 0; index < mediaUrls.length; index += 1) {
    const uri = mediaUrls[index];
    if (!uri) continue;
    const mediaKind = postMediaTypeFromUri(uri, mediaTypes?.[index] ?? fallbackMediaType);
    hasVideo = hasVideo || mediaKind === "video";

    if (isLocalUri(uri)) {
      const extension = extensionFromUri(uri);
      const storagePath = `${userId}/${postId}/media-${index}-${Date.now()}.${extension}`;
      const uploaded = await uploadPostMediaFromUri({
        client,
        bucket: "post-media",
        path: storagePath,
        uri,
      });
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
      displayUrls.push(
        (await createSignedStorageUrl(client, "post-media", uploaded.path)) ?? uploaded.publicUrl,
      );
      continue;
    }

    throw new Error("Post media must be uploaded from local device files.");
  }

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

async function fetchPublishedPostBites(client: SupabaseClient, limit = 40): Promise<Bite[]> {
  const { data, error } = await client
    .from("posts")
    .select("*")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];

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

  const [dishRows, venueRows] = await Promise.all([
    dishIds.length > 0
      ? client
          .from("dishes")
          .select("id,name,price,rating_avg,rating,image_url,venue_id,building_id")
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

  const mediaByPostId = groupRowsByStringKey(mediaRows, "post_id");
  const dishById = new Map(dishRows.map((row) => [asString(row.id) ?? "", row]));
  const venueById = new Map(venueRows.map((row) => [asString(row.id) ?? "", row]));
  const buildingById = new Map(buildingRows.map((row) => [asString(row.id) ?? "", row]));

  return Promise.all(
    postRows.map(async (row) => {
      const meta = asRecord(row.generated_content);
      const authorMeta = asRecord(meta.author);
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
        authorName: asString(authorMeta.displayName) ?? "Hungry User",
        authorAvatar: asString(authorMeta.avatarUrl),
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
        caption: asString(row.caption) ?? "",
        tags: asStringArray(meta.tags),
        tasteStamp: tasteStampFromPostMeta(meta),
        cravingCount: asNumber(row.like_count) ?? 0,
        savedCount: asNumber(row.save_count) ?? 0,
        rating:
          asNumber(meta.rating) ?? asNumber(dishRow?.rating_avg) ?? asNumber(dishRow?.rating) ?? 0,
        price: asNumber(dishRow?.price) ?? asNumber(dishMeta.price) ?? 0,
        expiresAt:
          asString(row.published_at) ?? asString(row.created_at) ?? new Date().toISOString(),
        createdAt:
          asString(row.published_at) ?? asString(row.created_at) ?? new Date().toISOString(),
      } satisfies Bite;
    }),
  );
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
  profile: UserProfile = DEFAULT_AUTH_PROFILE,
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
      const dish = dishId ? supabaseRepository.getDishById(dishId) : undefined;
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
    p_radius_meters: request.radiusMeters ?? null,
    p_exclude_dish_ids: request.excludeDishIds ?? [],
    p_limit: request.limit ?? 20,
  });

  if (error) {
    console.warn("Failed to fetch live taste recommendations", error.message);
    return undefined;
  }
  if (!Array.isArray(data)) return undefined;

  const rows = data as Row[];
  let mapped = mapRecommendationRpcRows(rows);
  if (rows.length > 0 && mapped.length === 0) {
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

  console.warn("Failed to persist taste interaction event via RPC", error.message);
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
    console.warn("Failed to persist taste interaction event", insertError.message);
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

function getAuthEmailRedirectTo(): string {
  return process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim() || "hungry://auth/callback";
}

function callbackBaseMatches(url: string, expectedRedirectTo: string): boolean {
  try {
    const parsed = new URL(url);
    const expected = new URL(expectedRedirectTo);
    return (
      parsed.protocol === expected.protocol &&
      parsed.hostname === expected.hostname &&
      parsed.pathname === expected.pathname
    );
  } catch {
    return false;
  }
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
    code: query.get("code") ?? undefined,
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

function normalizeAvailabilityFlag(flag: string): string {
  return flag.toLowerCase().replace(/[\s-]+/g, "_");
}

function mergeAvailabilityFlag(currentFlags: string[], flag: string, enabled: boolean): string[] {
  const normalized = normalizeAvailabilityFlag(flag);
  const withoutFlag = currentFlags.filter(
    (currentFlag) => normalizeAvailabilityFlag(currentFlag) !== normalized,
  );
  return enabled ? [...withoutFlag, flag] : withoutFlag;
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
  const { data, error } = await client
    .from("merchant_verifications")
    .select("*")
    .eq("outlet_id", outletId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return toMerchantVerification();

  const { data: evidenceRows, error: evidenceError } = await client
    .from("merchant_verification_evidence")
    .select("*")
    .eq("verification_id", (data as Row).id);
  if (evidenceError) throw evidenceError;

  const evidence = (Array.isArray(evidenceRows) ? (evidenceRows as Row[]) : []).map((row) => ({
    id: asString(row.id) ?? "",
    method: (asString(row.method) as VerificationEvidence["method"]) ?? "video_walkaround",
    fileUrl: asString(row.file_url) ?? "",
    uploadedAt: asString(row.uploaded_at) ?? new Date().toISOString(),
    reviewNote: asString(row.review_note),
  }));
  return toMerchantVerification(data as Row, evidence);
}

async function toMerchantOutlet(client: SupabaseClient, row: Row): Promise<MerchantOutlet> {
  const venueId = asString(row.venue_id);
  const venue = venueId ? supabaseRepository.getVenueById(venueId) : undefined;
  const venueDishes = venueId ? supabaseRepository.listDishesByVenue(venueId) : [];
  return {
    id: asString(row.id) ?? "",
    merchantAccountId: asString(row.merchant_account_id) ?? "",
    name: asString(row.name) ?? venue?.name ?? "",
    businessType: (asString(row.business_type) as MerchantOutlet["businessType"]) ?? "hawker_stall",
    buildingId: asString(row.building_id) ?? venue?.buildingId,
    unitNumber: asString(row.unit_number) ?? venue?.unitNumber,
    floor: asString(row.floor) ?? venue?.floor,
    locationPrivacy:
      (asString(row.location_privacy) as MerchantOutlet["locationPrivacy"]) ?? "approximate",
    description: asString(row.description) ?? "",
    cuisineCategories: [],
    operatingHours: asString(row.operating_hours) ?? venue?.operatingHours ?? "",
    temporaryClosure: asString(row.temporary_closure),
    profilePhotoUrl: asString(row.profile_photo_url),
    coverPhotoUrl: asString(row.cover_photo_url),
    galleryUrls: [],
    contactPhone: asString(row.contact_phone),
    contactEmail: asString(row.contact_email),
    socialLinks: [],
    deliveryLinks: venue?.deliveryLinks ?? [],
    dietaryLabels: [],
    tasteTags: [],
    signatureDishIds: venueDishes.slice(0, 3).map((dish) => dish.id),
    isLive: asBoolean(row.is_live) ?? false,
    verification: await fetchVerificationForOutlet(client, asString(row.id) ?? ""),
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
  const outlets = await Promise.all(
    (Array.isArray(outletRows) ? (outletRows as Row[]) : []).map((row) =>
      toMerchantOutlet(client, row),
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
  const imageUrl = asString(row.image_url) ?? gallery[0] ?? "";
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

function buildDishPayload(outlet: Row, dish: Partial<DishDetail>): Row {
  const venueId = asString(outlet.venue_id) ?? "";
  const buildingId = asString(outlet.building_id) ?? "";
  const price = asNumber(dish.price) ?? 0;
  const imageUrl = dish.imageUrl ?? dish.gallery?.[0] ?? null;
  return {
    id: dish.id ?? `merchant-dish-${Date.now()}`,
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

async function replaceDishImages(
  client: SupabaseClient,
  dishId: string,
  galleryUrls: string[] | undefined,
): Promise<void> {
  if (galleryUrls === undefined) return;
  const { error: deleteError } = await client.from("dish_images").delete().eq("dish_id", dishId);
  if (deleteError) throw deleteError;
  const rows = galleryUrls
    .filter(Boolean)
    .map((url, sortOrder) => ({ dish_id: dishId, url, sort_order: sortOrder }));
  if (rows.length === 0) return;
  const { error } = await client.from("dish_images").insert(rows);
  if (error) throw error;
}

async function replaceDishDietaryFlags(
  client: SupabaseClient,
  dishId: string,
  dietaryFlags: DietaryFlag[] | undefined,
): Promise<void> {
  if (dietaryFlags === undefined) return;
  const uniqueFlags = Array.from(new Set(dietaryFlags));
  const { error: deleteError } = await client
    .from("dish_dietary_flags")
    .delete()
    .eq("dish_id", dishId);
  if (deleteError) throw deleteError;
  if (uniqueFlags.length === 0) return;

  const { data, error } = await client
    .from("dietary_flags")
    .select("id,slug")
    .in("slug", uniqueFlags);
  if (error) throw error;
  const idBySlug = new Map(
    (Array.isArray(data) ? (data as Row[]) : [])
      .map((row) => [asString(row.slug) ?? "", asString(row.id) ?? ""] as const)
      .filter(([slug, id]) => slug.length > 0 && id.length > 0),
  );
  const missingFlags = uniqueFlags.filter((flag) => !idBySlug.has(flag));
  if (missingFlags.length > 0) {
    throw new Error(`Unknown dietary flags: ${missingFlags.join(", ")}`);
  }

  const { error: insertError } = await client.from("dish_dietary_flags").insert(
    uniqueFlags.map((flag) => ({
      dish_id: dishId,
      dietary_flag_id: idBySlug.get(flag),
    })),
  );
  if (insertError) throw insertError;
}

async function replaceDishTasteVector(
  client: SupabaseClient,
  dishId: string,
  tasteVector: TasteVector | undefined,
): Promise<void> {
  if (tasteVector === undefined) return;
  const { error } = await client.from("dish_taste_vectors").upsert(
    {
      dish_id: dishId,
      sweet: tasteVector.sweet,
      spicy: tasteVector.spicy,
      sour: tasteVector.sour,
      salty: tasteVector.salty,
      rich: tasteVector.rich,
      aromatic: tasteVector.aromatic,
      vector: [
        tasteVector.sweet,
        tasteVector.spicy,
        tasteVector.sour,
        tasteVector.salty,
        tasteVector.rich,
        tasteVector.aromatic,
      ],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "dish_id" },
  );
  if (error) throw error;
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

function buildWeeklySummaryFromAnalytics(
  outletId: string,
  analytics: MerchantAnalytics,
  reviews: CustomerInteraction[],
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
    newReviews: reviews.length,
    averageRating: analytics.averageRating,
    ratingChange: analytics.averageRating - analytics.previousPeriodComparison.averageRating,
    unrepliedReviews: reviews.filter((review) => !review.reply).length,
    promotionViews: promotions.reduce(
      (sum, promotion) => sum + (promotion.analytics?.impressions ?? 0),
      0,
    ),
    createdAt: now.toISOString(),
  };
}

async function signInWithOAuthProvider(provider: "google" | "apple"): Promise<Session> {
  const client = requireSupabaseClient();
  const redirectTo = getAuthEmailRedirectTo();
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
  }
  if (code) {
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  } else {
    throw new Error("OAuth callback did not include session credentials.");
  }

  const session = await toAppSession(client);
  if (!session) {
    throw new Error("OAuth flow completed but no active session was found.");
  }
  return session;
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
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: getAuthEmailRedirectTo(),
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
        email,
        options: {
          emailRedirectTo: getAuthEmailRedirectTo(),
        },
      });
      if (error) throw error;
    },

    async signIn(email, password) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.signInWithPassword({ email, password });
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

    async signOut() {
      const client = requireSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async requestAccountDeletion(request) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to request account deletion.");

      const { error } = await client.from("account_deletion_requests").insert({
        user_id: userId,
        reason: request?.reason ?? "user_initiated_settings_flow",
      });
      if (error) throw error;

      await this.signOut();
    },

    async forgotPassword(email) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.resetPasswordForEmail(email);
      if (error) throw error;
    },

    async resetPassword(_token, password) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
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
    async listBuildings() {
      return supabaseRepository.listBuildings();
    },

    async getBuildingDetail(id) {
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
      return supabaseRepository.getVenueById(id);
    },

    async listVenuesByBuilding(buildingId) {
      return supabaseRepository.listVenuesByBuilding(buildingId);
    },

    async getDish(id) {
      return supabaseRepository.getDishById(id);
    },

    async recordDishView(dishId, context) {
      const client = getSupabaseClient();
      if (!client) return;
      const { data: dishRow, error: dishError } = await client
        .from("dishes")
        .select("id, venue_id")
        .eq("id", dishId)
        .maybeSingle();
      if (dishError) throw dishError;
      const venueId = asString((dishRow as Row | null)?.venue_id);
      if (!venueId) return;
      const { data: outletRow, error: outletError } = await client
        .from("merchant_outlets")
        .select("id, merchant_account_id")
        .eq("venue_id", venueId)
        .maybeSingle();
      if (outletError) throw outletError;
      const outletId = asString((outletRow as Row | null)?.id);
      const merchantAccountId = asString((outletRow as Row | null)?.merchant_account_id);
      if (!outletId || !merchantAccountId) return;
      const userId = context?.userId ?? (await getCurrentSupabaseUserId()) ?? undefined;
      const sessionId = context?.sessionId ?? userId ?? "anonymous";
      const dedupeWindow = new Date().toISOString().slice(0, 13);
      const { error } = await client.from("merchant_dish_view_events").upsert(
        {
          outlet_id: outletId,
          merchant_account_id: merchantAccountId,
          venue_id: venueId,
          dish_id: dishId,
          user_id: userId ?? null,
          session_id: sessionId,
          dedupe_key: `${dishId}:${sessionId}:${dedupeWindow}`,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      );
      if (error) throw error;
    },

    async listDishesByVenue(venueId) {
      return supabaseRepository.listDishesByVenue(venueId);
    },

    async listPopularNearby() {
      return supabaseRepository.listPopularNearby();
    },

    async searchDishes(filters: SearchFilters, tasteProfile: TasteVector): Promise<SearchResult[]> {
      const results = supabaseRepository.searchDishes(filters, tasteProfile);
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
      return supabaseRepository.getDishById(dishId)?.reviews ?? [];
    },

    async getUserReviews(userId) {
      const client = requireSupabaseClient();
      const { data, error } = await client.from("reviews").select("*").eq("user_id", userId);
      if (error || !Array.isArray(data)) {
        return [];
      }
      return (data as Row[]).map((row) => ({
        id: asString(row.id) ?? `${Date.now()}`,
        authorName: asString(row.author_name) ?? "Hungry User",
        rating: asNumber(row.rating) ?? 0,
        createdAt: asString(row.created_at) ?? new Date().toISOString(),
        text: asString(row.text) ?? "",
        tags: asStringArray(row.tags),
        wouldRecommend: asBoolean(row.would_recommend) ?? true,
        photos: asStringArray(row.photos),
      }));
    },

    async submitReview(draft: SubmitReviewInput) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to submit reviews.");

      const { data, error } = await client
        .from("reviews")
        .insert({
          user_id: userId,
          dish_id: draft.dishId,
          venue_id: draft.venueId,
          rating: draft.rating,
          text: draft.text,
          tags: draft.tags,
          would_recommend: true,
        })
        .select("id")
        .maybeSingle();
      if (error || !data?.id) {
        throw error ?? new Error("Review insert failed.");
      }

      const uploadedPhotoUrls = await uploadReviewPhotos(client, userId, data.id, draft.photos);
      if (uploadedPhotoUrls.length > 0) {
        const { error: photoInsertError } = await client.from("review_photos").insert(
          uploadedPhotoUrls.map((url, index) => ({
            review_id: data.id,
            url,
            sort_order: index,
          })),
        );
        if (photoInsertError) throw photoInsertError;
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
      if (updates.email !== undefined) payload.email = updates.email;
      if (updates.dietaryPreferences !== undefined) {
        payload.dietary_preferences = updates.dietaryPreferences;
      }
      if (updates.favouriteDishIds !== undefined)
        payload.favourite_dish_ids = updates.favouriteDishIds;
      if (updates.reviewedDishIds !== undefined)
        payload.reviewed_dish_ids = updates.reviewedDishIds;
      if (updates.tasteProfile !== undefined) payload.taste_profile = updates.tasteProfile;
      if (updates.avatarUrl !== undefined) {
        payload.avatar_url = await uploadAvatarIfNeeded(client, userId, updates.avatarUrl);
      }
      if (Object.keys(payload).length > 1) {
        const { error } = await client.from("user_profiles").upsert(payload, { onConflict: "id" });
        if (error) throw error;
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

      return fetchUserProfile(client, userId, updates.email);
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

    async getGuestProfile() {
      return DEFAULT_GUEST_PROFILE;
    },

    async toggleFavourite(dishId: string) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to favourite dishes.");

      const { data } = await client
        .from("user_favourite_dishes")
        .select("id")
        .eq("user_id", userId)
        .eq("dish_id", dishId)
        .maybeSingle();

      if (data?.id) {
        const { error } = await client.from("user_favourite_dishes").delete().eq("id", data.id);
        if (error) throw error;
        return false;
      }
      const { error } = await client
        .from("user_favourite_dishes")
        .insert({ user_id: userId, dish_id: dishId });
      if (error) throw error;
      return true;
    },

    async getFavouriteDishIds() {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) return [];
      const { data, error } = await client
        .from("user_favourite_dishes")
        .select("dish_id")
        .eq("user_id", userId);
      if (error || !Array.isArray(data)) return [];
      return (data as Row[])
        .map((row) => asString(row.dish_id))
        .filter((dishId): dishId is string => Boolean(dishId));
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
  },

  social: {
    async getBitesFeed() {
      const client = requireSupabaseClient();
      return fetchPublishedPostBites(client);
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
      const postMeta = {
        source: "post_composer",
        author: {
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
        },
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
        rating: draft.rating,
        tags: draft.tags ?? [],
        mediaType: draft.mediaType ?? "photo",
        mediaTypes: draft.mediaTypes ?? [],
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

      const { data: postData, error: postError } = await client
        .from("posts")
        .insert(initialPayload)
        .select("*")
        .maybeSingle();
      if (postError || !postData) throw postError ?? new Error("Failed to create post draft.");

      const postId = asString((postData as Row).id) ?? "";
      if (!postId) {
        throw new Error("Failed to create post id.");
      }

      const mediaUrls = draft.mediaUrls?.length
        ? draft.mediaUrls
        : [draft.photoUrl].filter(Boolean);
      const media = await buildPostMediaRows(
        client,
        userId,
        postId,
        mediaUrls,
        draft.mediaTypes,
        draft.mediaType,
      );
      if (media.rows.length > 0) {
        const { error: mediaError } = await client.from("post_media").insert(media.rows);
        if (mediaError) throw mediaError;
      }

      const publishedAt = new Date().toISOString();
      const postType = postTypeForMedia(media.rows, media.canonicalMediaType);
      const { data: publishedPostData, error: publishError } = await client
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
      if (publishError || !publishedPostData) {
        throw publishError ?? new Error("Failed to publish post.");
      }

      await refreshSupabaseRepositoryCache();

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

    async reactToBite(biteId, reaction) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to react.");
      const table = reaction === "craving" ? "post_likes" : "post_saves";
      const existing = await client
        .from(table)
        .select("post_id")
        .eq("post_id", biteId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if ((existing.data as Row | null)?.post_id) {
        const { error } = await client
          .from(table)
          .delete()
          .eq("post_id", biteId)
          .eq("user_id", userId);
        if (error) throw error;
        return;
      }
      const { error } = await client.from(table).insert({ post_id: biteId, user_id: userId });
      if (error) throw error;
    },

    async getStories() {
      return getStoryCache();
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

    async addStory(content: StoryContent) {
      const stories = await getStoryCache();
      const profile = await getCurrentUserProfileOrGuest();
      const newStory: Story = {
        id: `s_${Date.now()}`,
        displayName: profile.displayName,
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
      const { data, error } = await client
        .from("post_saves")
        .select("post_id")
        .eq("user_id", userId);
      if (error || !Array.isArray(data)) return [];
      const savedIds = new Set(
        (data as Row[]).map((row) => asString(row.post_id)).filter((id): id is string => !!id),
      );
      return (await fetchPublishedPostBites(client)).filter((bite) => savedIds.has(bite.id));
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
          .from("conversations")
          .insert({
            conversation_type: type,
            dedupe_key: dedupeKey,
            subject_merchant_account_id: input.target.merchantAccountId ?? null,
            created_by_user_id: currentUserId,
          })
          .select("id,conversation_type,subject_merchant_account_id,created_by_user_id,updated_at")
          .maybeSingle();
        if (error || !data) throw error ?? new Error("Failed to create conversation.");
        conversationRow = data as Row;

        const conversationId = asString(conversationRow.id);
        if (!conversationId) throw new Error("Conversation id missing after create.");
        const participantRows = [
          {
            conversation_id: conversationId,
            participant_kind: "user",
            participant_user_id: currentUserId,
            participant_merchant_account_id: null,
          },
          {
            conversation_id: conversationId,
            participant_kind: input.target.kind,
            participant_user_id: input.target.kind === "user" ? input.target.userId : null,
            participant_merchant_account_id:
              input.target.kind === "merchant" ? input.target.merchantAccountId : null,
          },
        ];
        const { error: participantError } = await client
          .from("conversation_participants")
          .insert(participantRows);
        if (participantError) throw participantError;
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

      const now = new Date().toISOString();
      const { data, error } = await client
        .from("messages")
        .insert({
          conversation_id: input.conversationId,
          sender_user_id: input.senderMerchantAccountId ? null : currentUserId,
          sender_merchant_account_id: input.senderMerchantAccountId ?? null,
          body,
          client_nonce: input.clientNonce ?? `${currentUserId}-${Date.now()}`,
          delivered_at: now,
        })
        .select(
          "id,conversation_id,sender_user_id,sender_merchant_account_id,body,client_nonce,delivered_at,created_at",
        )
        .maybeSingle();
      if (error || !data) throw error ?? new Error("Failed to send message.");

      const { error: updateError } = await client
        .from("conversations")
        .update({ updated_at: now })
        .eq("id", input.conversationId);
      if (updateError) throw updateError;

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
      const now = new Date().toISOString();
      const { error: participantError } = await client
        .from("conversation_participants")
        .update({ last_read_at: now })
        .eq("conversation_id", conversationId)
        .eq("participant_user_id", currentUserId);
      if (participantError) throw participantError;

      const { data, error } = await client
        .from("messages")
        .select("id,conversation_id,sender_user_id")
        .eq("conversation_id", conversationId)
        .is("deleted_at", null);
      if (error) throw error;
      const receiptRows = (Array.isArray(data) ? (data as Row[]) : [])
        .filter((row) => asString(row.sender_user_id) !== currentUserId)
        .map((row) => ({
          message_id: asString(row.id),
          conversation_id: conversationId,
          reader_user_id: currentUserId,
          read_at: now,
        }))
        .filter((row) => Boolean(row.message_id));
      if (receiptRows.length === 0) return;
      const messageIds = receiptRows
        .map((row) => row.message_id)
        .filter((messageId): messageId is string => Boolean(messageId));
      const { data: existingReceipts, error: existingError } = await client
        .from("read_receipts")
        .select("message_id")
        .eq("conversation_id", conversationId)
        .eq("reader_user_id", currentUserId)
        .in("message_id", messageIds);
      if (existingError) throw existingError;

      const existingMessageIds = new Set(
        (Array.isArray(existingReceipts) ? (existingReceipts as Row[]) : [])
          .map((row) => asString(row.message_id))
          .filter((messageId): messageId is string => Boolean(messageId)),
      );
      const missingReceiptRows = receiptRows.filter(
        (row) => row.message_id && !existingMessageIds.has(row.message_id),
      );
      if (missingReceiptRows.length === 0) return;

      const { error: receiptError } = await client.from("read_receipts").insert(missingReceiptRows);
      if (receiptError) throw receiptError;
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

      const { error } = await client.from("content_reports").insert({
        reporter_id: userId,
        target_type: request.targetType,
        target_id: request.targetId,
        target_author_key: request.targetAuthorKey,
        reason: request.reason,
      });
      if (error) throw error;
    },

    async blockUser(request: BlockUserRequest) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to block users.");

      const { error } = await client.from("user_blocks").upsert({
        blocker_id: userId,
        blocked_user_key: request.blockedUserKey,
        reason: request.reason ?? "user_initiated_block",
      });
      if (error) throw error;
    },
  },

  content: {
    async listArticles() {
      return supabaseRepository.listBlogPosts();
    },

    async listStallPosts() {
      return supabaseRepository.listStallPosts();
    },

    async getArticle(id) {
      return supabaseRepository.listBlogPosts().find((article) => article.id === id);
    },
  },

  supply: {
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

      return {
        claimId: claimId ? String(claimId) : null,
        status: claimId ? "created" : "already_exists",
      } as const;
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
      const { data, error } = await client
        .from("merchant_verifications")
        .upsert(
          {
            outlet_id: resolvedOutletId,
            status: "submitted",
            method: evidence.method,
            submitted_at: new Date().toISOString(),
            rejected_at: null,
            rejection_reason: null,
          },
          { onConflict: "outlet_id" },
        )
        .select("id")
        .single();
      if (error) throw error;

      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to upload verification evidence.");
      assertLocalUserMediaUri(evidence.fileUrl, "Merchant verification evidence");
      const evidenceExtension = extensionFromUri(evidence.fileUrl);
      const evidencePath = `${userId}/${resolvedOutletId}/${(data as Row).id}-${Date.now()}.${evidenceExtension}`;
      const uploadedEvidence = await uploadPostMediaFromUri({
        client,
        bucket: "merchant-verification-evidence",
        path: evidencePath,
        uri: evidence.fileUrl,
      });
      const { error: evidenceError } = await client.from("merchant_verification_evidence").insert({
        verification_id: (data as Row).id,
        method: evidence.method,
        file_url: `supabase://merchant-verification-evidence/${uploadedEvidence.path}`,
        storage_bucket: "merchant-verification-evidence",
        storage_path: uploadedEvidence.path,
        uploaded_by: userId,
        review_note: evidence.reviewNote ?? null,
      });
      if (evidenceError) throw evidenceError;
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
      if (normalized.temporaryClosure !== undefined) {
        payload.temporary_closure = normalized.temporaryClosure || null;
      }
      if (normalized.contactPhone !== undefined) payload.contact_phone = normalized.contactPhone;
      if (normalized.contactEmail !== undefined) payload.contact_email = normalized.contactEmail;
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
      const venueId = asString(outlet.venue_id);
      if (venueId) {
        const venuePayload: Row = {};
        if (normalized.name !== undefined) venuePayload.name = normalized.name;
        if (normalized.buildingId !== undefined) venuePayload.building_id = normalized.buildingId;
        if (normalized.unitNumber !== undefined) venuePayload.unit_number = normalized.unitNumber;
        if (normalized.floor !== undefined) venuePayload.floor = normalized.floor;
        if (normalized.operatingHours !== undefined) {
          venuePayload.operating_hours = normalized.operatingHours;
        }
        if (Object.keys(venuePayload).length > 0) {
          const { error: venueError } = await client
            .from("venues")
            .update(venuePayload)
            .eq("id", venueId);
          if (venueError) throw venueError;
          await refreshSupabaseRepositoryCache();
        }
      }
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
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as Row[]) : [];
      const presentationByDishId = await fetchDishPresentationMap(
        client,
        rows.map((row) => asString(row.id) ?? ""),
      );
      return rows.map((row) =>
        mapSupabaseDish(row, venue, presentationByDishId.get(asString(row.id) ?? "")),
      );
    },

    async addDish(outletId, dish) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const dishId = dish.id ?? `merchant-dish-${Date.now()}`;
      const galleryUrls = await resolveMerchantDishGalleryUrls(client, outlet, dishId, dish);
      const payload = buildDishPayload(outlet, {
        ...dish,
        id: dishId,
        imageUrl: galleryUrls?.[0] ?? dish.imageUrl,
        gallery: galleryUrls ?? dish.gallery,
      });
      const { data, error } = await client.from("dishes").insert(payload).select("*").single();
      if (error) throw error;
      await replaceDishImages(client, dishId, galleryUrls);
      await replaceDishDietaryFlags(client, dishId, dish.dietaryFlags);
      await replaceDishTasteVector(client, dishId, dish.tasteVector);
      await refreshSupabaseRepositoryCache();
      const presentationByDishId = await fetchDishPresentationMap(client, [dishId]);
      return mapSupabaseDish(
        data as Row,
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
      let row: Row;
      if (Object.keys(payload).length > 0) {
        const { data, error } = await client
          .from("dishes")
          .update(payload)
          .eq("id", dishId)
          .eq("venue_id", venueId)
          .select("*")
          .single();
        if (error) throw error;
        row = data as Row;
      } else {
        const { data, error } = await client
          .from("dishes")
          .select("*")
          .eq("id", dishId)
          .eq("venue_id", venueId)
          .single();
        if (error) throw error;
        row = data as Row;
      }
      await replaceDishImages(client, dishId, galleryUrls);
      await replaceDishDietaryFlags(client, dishId, updates.dietaryFlags);
      await replaceDishTasteVector(client, dishId, updates.tasteVector);
      await refreshSupabaseRepositoryCache();
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
      const { error } = await client
        .from("dishes")
        .delete()
        .eq("id", dishId)
        .eq("venue_id", asString(outlet.venue_id) ?? "");
      if (error) throw error;
      await refreshSupabaseRepositoryCache();
    },

    async toggleSoldOut(outletId, dishId) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const venueId = asString(outlet.venue_id) ?? "";
      const { data, error } = await client
        .from("dishes")
        .select("availability_flags")
        .eq("id", dishId)
        .eq("venue_id", venueId)
        .single();
      if (error) throw error;
      const current = asStringArray((data as Row).availability_flags);
      const enabled = !current.some((flag) => normalizeAvailabilityFlag(flag) === "sold_out");
      const { error: updateError } = await client
        .from("dishes")
        .update({ availability_flags: mergeAvailabilityFlag(current, "sold_out", enabled) })
        .eq("id", dishId)
        .eq("venue_id", venueId);
      if (updateError) throw updateError;
      await refreshSupabaseRepositoryCache();
      return enabled;
    },

    async toggleFeatured(outletId, dishId) {
      const client = requireSupabaseClient();
      const outlet = await requireLinkedMerchantOutlet(client, outletId);
      const venueId = asString(outlet.venue_id) ?? "";
      const { data, error } = await client
        .from("dishes")
        .select("availability_flags")
        .eq("id", dishId)
        .eq("venue_id", venueId)
        .single();
      if (error) throw error;
      const current = asStringArray((data as Row).availability_flags);
      const enabled = !current.some((flag) => normalizeAvailabilityFlag(flag) === "featured");
      const { error: updateError } = await client
        .from("dishes")
        .update({ availability_flags: mergeAvailabilityFlag(current, "featured", enabled) })
        .eq("id", dishId)
        .eq("venue_id", venueId);
      if (updateError) throw updateError;
      await refreshSupabaseRepositoryCache();
      return enabled;
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
        suggestedDescription: asString(row.ocr_raw_text),
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

    async acceptOCRDraft(draftId) {
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
      const dish = await this.addDish(asString((outletData as Row).id) ?? "", {
        id: `dish-from-${draftId}`,
        name: asString(draft.name) ?? "New dish",
        price: asNumber(draft.price_cents) ? (asNumber(draft.price_cents) ?? 0) / 100 : 0,
        tasteTags: [],
      });
      const { error: updateError } = await client
        .from("dishes_draft")
        .update({ review_status: "accepted", promoted_dish_id: dish.id })
        .eq("id", draftId);
      if (updateError) throw updateError;
      return dish;
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
      const { data, error } = await client
        .from("reviews")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      let interactions = (Array.isArray(data) ? (data as Row[]) : []).map((row) => {
        const rating = asNumber(row.rating);
        return {
          id: asString(row.id) ?? "",
          outletId,
          type: "review" as InteractionType,
          authorName: asString(row.author_name) ?? "Hungry diner",
          rating,
          text: asString(row.text) ?? "",
          tags: asStringArray(row.tags),
          createdAt: asString(row.created_at) ?? new Date().toISOString(),
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
      if (filters?.type) interactions = interactions.filter((item) => item.type === filters.type);
      if (filters?.unrepliedOnly) interactions = interactions.filter((item) => !item.reply);
      return interactions;
    },

    async replyToInteraction(interactionId, text) {
      const trimmedText = text.trim();
      if (!trimmedText) throw new Error("Reply text is required");
      const { error } = await requireSupabaseClient()
        .from("reviews")
        .update({
          merchant_reply_text: trimmedText,
          merchant_replied_at: new Date().toISOString(),
        })
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
      const analytics = buildPromotionAnalytics(promo);
      const { data, error } = await client
        .from("merchant_promotions")
        .insert({
          outlet_id: resolvedOutletId,
          title: promo.title,
          description: promo.description,
          target_dish_id: promo.targetDishId ?? null,
          start_date: promo.startDate,
          end_date: promo.endDate,
          target_audience: promo.targetAudience,
          status: promo.status,
          promotion_item_type: promo.promotionItemType ?? "new_item",
          original_price: promo.originalPrice ?? null,
          promotional_price: promo.promotionalPrice ?? null,
          final_price: promo.finalPrice ?? promo.promotionalPrice ?? null,
          discount_percentage: promo.discountPercentage ?? null,
          is_available: promo.isAvailable ?? promo.status === "active",
          impressions: analytics.impressions,
          clicks: analytics.clicks,
          saves: analytics.saves,
          profile_visits: analytics.profileVisits,
          dish_views: analytics.dishViews,
        })
        .select("*")
        .single();
      if (error) throw error;
      return mapPromotion(data as Row);
    },

    async updatePromotion(promoId, updates) {
      const payload: Row = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.targetDishId !== undefined) payload.target_dish_id = updates.targetDishId;
      if (updates.startDate !== undefined) payload.start_date = updates.startDate;
      if (updates.endDate !== undefined) payload.end_date = updates.endDate;
      if (updates.targetAudience !== undefined) payload.target_audience = updates.targetAudience;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.promotionItemType !== undefined)
        payload.promotion_item_type = updates.promotionItemType;
      if (updates.originalPrice !== undefined) payload.original_price = updates.originalPrice;
      if (updates.promotionalPrice !== undefined)
        payload.promotional_price = updates.promotionalPrice;
      if (updates.finalPrice !== undefined) payload.final_price = updates.finalPrice;
      if (updates.discountPercentage !== undefined)
        payload.discount_percentage = updates.discountPercentage;
      if (updates.isAvailable !== undefined) payload.is_available = updates.isAvailable;
      if (updates.analytics) {
        payload.impressions = updates.analytics.impressions;
        payload.clicks = updates.analytics.clicks;
        payload.saves = updates.analytics.saves;
        payload.profile_visits = updates.analytics.profileVisits;
        payload.dish_views = updates.analytics.dishViews;
      }
      const { data, error } = await requireSupabaseClient()
        .from("merchant_promotions")
        .update(payload)
        .eq("id", promoId)
        .select("*")
        .single();
      if (error) throw error;
      return mapPromotion(data as Row);
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
      const menu = await this.getMenu(outletId);
      const inbox = await this.getInbox(outletId);
      const outlet = await getMerchantOutletRow(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;
      const { data: viewRows } = await client
        .from("merchant_dish_view_events")
        .select("dish_id")
        .eq("outlet_id", resolvedOutletId);
      const viewCounts = new Map<string, number>();
      (Array.isArray(viewRows) ? (viewRows as Row[]) : []).forEach((row) => {
        const dishId = asString(row.dish_id);
        if (!dishId) return;
        viewCounts.set(dishId, (viewCounts.get(dishId) ?? 0) + 1);
      });
      const dishViewTotal = Array.from(viewCounts.values()).reduce((sum, count) => sum + count, 0);
      const reviewRatings = inbox
        .map((interaction) => interaction.rating)
        .filter((rating): rating is number => typeof rating === "number");
      return {
        outletId,
        dateRange,
        profileVisits: Math.floor(dishViewTotal / 2),
        menuViews: dishViewTotal,
        dishViews: dishViewTotal,
        directionTaps: 0,
        saves: 0,
        shares: 0,
        contactTaps: 0,
        socialLinkTaps: 0,
        postInteractions: inbox.length,
        reviewCount: reviewRatings.length,
        averageRating:
          reviewRatings.length === 0
            ? 0
            : reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length,
        topDishes: menu
          .map((dish) => ({
            dishId: dish.id,
            name: dish.name,
            views: viewCounts.get(dish.id) ?? 0,
            saves: 0,
          }))
          .sort((left, right) => right.views - left.views)
          .slice(0, 5),
        mostSearchedKeywords: menu.slice(0, 4).map((dish) => dish.name.toLowerCase()),
        peakDiscoveryHours: [],
        customerTasteTags: [],
        previousPeriodComparison: {
          profileVisits: 0,
          menuViews: 0,
          reviewCount: 0,
          averageRating: 0,
        },
      } satisfies MerchantAnalytics;
    },

    async getWeeklySummaryStats(outletId) {
      const analytics = await this.getAnalytics(outletId, "7d");
      const reviews = await this.getInbox(outletId, { type: "review" });
      const promotions = await this.getPromotions(outletId);
      return buildWeeklySummaryFromAnalytics(outletId, analytics, reviews, promotions);
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

    async syncLowRatingNotifications(outletId) {
      const client = requireSupabaseClient();
      const outlet = await getMerchantOutletRow(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;
      const merchantAccountId = asString(outlet.merchant_account_id) ?? "";
      const outletName = asString(outlet.name) ?? "Your stall";
      const reviews = await this.getInbox(outletId, { type: "review" });
      const lowReviews = reviews.filter(
        (review) => typeof review.rating === "number" && review.rating <= 2,
      );
      if (lowReviews.length === 0) return [];
      const rows = lowReviews.map((review) => ({
        merchant_account_id: merchantAccountId,
        outlet_id: resolvedOutletId,
        kind: "low_rating",
        title: `${outletName} received a low rating`,
        body: `${review.rating?.toFixed(1)} stars: ${review.text.slice(0, 120)}`,
        status: "unread",
        dedupe_key: `low-rating:${review.sourceId ?? review.id}`,
        deep_link: "MerchantTabs/CustomerInbox",
        metadata: {
          reviewId: review.sourceId ?? review.id,
          rating: review.rating,
          snippet: review.text,
        },
        created_at: review.createdAt,
      }));
      const { error } = await client
        .from("merchant_notifications")
        .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
      if (error) throw error;
      const keys = rows.map((row) => row.dedupe_key);
      const { data, error: readError } = await client
        .from("merchant_notifications")
        .select("*")
        .in("dedupe_key", keys)
        .order("created_at", { ascending: false });
      if (readError) throw readError;
      return (Array.isArray(data) ? (data as Row[]) : []).map(mapMerchantNotification);
    },

    async sendWeeklySummaryNotifications(outletId) {
      const client = requireSupabaseClient();
      const outlet = await getMerchantOutletRow(client, outletId);
      const resolvedOutletId = asString(outlet.id) ?? outletId;
      const merchantAccountId = asString(outlet.merchant_account_id) ?? "";
      const outletName = asString(outlet.name) ?? "Your stall";
      const summary = await this.getWeeklySummaryStats(outletId);
      const members = await this.getTeamMembers(merchantAccountId);
      const rows = members
        .filter((member) => member.inviteStatus !== "removed")
        .map((member) => ({
          merchant_account_id: merchantAccountId,
          outlet_id: resolvedOutletId,
          recipient_user_id: member.userId || null,
          recipient_email: member.email,
          kind: "weekly_summary",
          title: `${outletName} weekly summary is ready`,
          body: `${summary.totalViews.toLocaleString()} views, ${summary.newReviews} new reviews, ${summary.unrepliedReviews} unreplied reviews.`,
          status: "unread",
          dedupe_key: `weekly-summary:${summary.id}:${member.id}`,
          deep_link: "MerchantTabs/MerchantAnalytics",
          metadata: { summaryId: summary.id },
        }));
      if (rows.length === 0) return [];
      const { error } = await client
        .from("merchant_notifications")
        .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
      if (error) throw error;
      const emailRows = rows
        .filter((row) => row.recipient_email)
        .map((row) => ({
          merchant_account_id: merchantAccountId,
          outlet_id: resolvedOutletId,
          recipient_email: row.recipient_email,
          template: "weekly_summary",
          subject: row.title,
          body: row.body,
          status: "queued",
          dedupe_key: `email:${row.dedupe_key}`,
          metadata: row.metadata,
        }));
      if (emailRows.length > 0) {
        const { error: emailError } = await client
          .from("merchant_email_outbox")
          .upsert(emailRows, { onConflict: "dedupe_key", ignoreDuplicates: true });
        if (emailError) throw emailError;
      }
      const { data, error: readError } = await client
        .from("merchant_notifications")
        .select("*")
        .in(
          "dedupe_key",
          rows.map((row) => row.dedupe_key),
        )
        .order("created_at", { ascending: false });
      if (readError) throw readError;
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
      const lower = ingredients.map((ingredient) => ingredient.toLowerCase());
      return [
        ...(lower.some((ingredient) => ingredient.includes("egg")) ? ["Eggs"] : []),
        ...(lower.some((ingredient) => ingredient.includes("soy")) ? ["Soy"] : []),
        ...(lower.some((ingredient) => ingredient.includes("noodle")) ? ["Gluten"] : []),
      ];
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
          title: "Weekly summary",
          body: `${analytics.reviewCount} customer reviews and ${analytics.topDishes.length} menu items are linked to this outlet.`,
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
            deep_link: "MerchantTabs/MerchantSettings",
            metadata: {
              memberId: asString(row.id),
              role,
              delivery: "email",
            },
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true },
        );
      if (notificationError) throw notificationError;
      const { error: emailError } = await requireSupabaseClient()
        .from("merchant_email_outbox")
        .upsert(
          {
            merchant_account_id: merchantAccountId,
            recipient_email: normalizedEmail,
            template: "team_invite",
            subject: "You have been invited to manage a Hungry stall",
            body: `${trimmedName}, install or open Hungry to accept your merchant team invite.`,
            status: "queued",
            dedupe_key: `email:team-invite:${merchantAccountId}:${normalizedEmail}`,
            metadata: {
              memberId: asString(row.id),
              role,
              delivery: "email",
            },
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true },
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

    async adjustCommunityTasteVector() {
      return;
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
  },
};
