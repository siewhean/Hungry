import type { SupabaseClient } from "@supabase/supabase-js";

import { getFloorPlan } from "@/lib/geo/floorPlans";
import { similarityScore } from "@/lib/ai/similarityScore";
import { computeTasteProfileFromQuiz } from "@/lib/ai/tasteQuiz";
import {
  processExplicitFeedback,
  processImplicitFeedback,
  runRecommendationPipeline,
} from "@/lib/ai/tasteEngine";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { supabaseRepository } from "@/lib/services/supabase/supabaseRepository";
import { getSupabaseClient } from "@/lib/services/supabase/client";
import {
  assertValidMenuPhotoUpload,
  uploadImageFromUri,
} from "@/lib/services/supabase/mediaUpload";
import type {
  Bite,
  BiteDraft,
  BuildingDetail,
  HungryService,
  ImplicitSignalInput,
  QuizAnswer,
  SearchResult,
  Session,
  SubmitReviewInput,
} from "@/lib/services/types";
import type {
  DietaryFlag,
  DishDetail,
  HawkerTasteTag,
  SearchFilters,
  TasteProfile,
  TasteVector,
  UserProfile,
} from "@/types/domain";

type Row = Record<string, unknown>;

const DEFAULT_AUTH_PROFILE: UserProfile = {
  id: "supabase-user",
  displayName: "Hungry User",
  email: "",
  tasteVector: { ...NEUTRAL_TASTE_VECTOR },
  dietaryPreferences: [],
  favouriteDishIds: [],
  reviewedDishIds: [],
  stats: { dishesReviewed: 0, stallsVisited: 0, favouritesCount: 0 },
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

function isLocalUri(value: string): boolean {
  return value.startsWith("file://") || value.startsWith("content://") || value.startsWith("/");
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
  const session = await client.auth.getSession();
  return session.data.session?.user?.id ?? null;
}

async function fetchUserProfile(client: SupabaseClient, userId: string, email?: string) {
  const { data } = await client.from("user_profiles").select("*").eq("id", userId).maybeSingle();
  const row = (data ?? {}) as Row;
  const favouriteDishIds = asStringArray(row.favourite_dish_ids);
  const reviewedDishIds = asStringArray(row.reviewed_dish_ids);
  return {
    ...DEFAULT_AUTH_PROFILE,
    id: userId,
    displayName:
      asString(row.display_name) ?? asString(row.displayName) ?? DEFAULT_AUTH_PROFILE.displayName,
    email: asString(row.email) ?? email ?? "",
    avatarUrl: asString(row.avatar_url),
    tasteVector: toTasteVector(row),
    tasteProfile: (row.taste_profile as TasteProfile | undefined) ?? undefined,
    dietaryPreferences: asStringArray(row.dietary_preferences) as DietaryFlag[],
    favouriteDishIds,
    reviewedDishIds,
    stats: {
      dishesReviewed: asNumber(row.dishes_reviewed) ?? reviewedDishIds.length,
      stallsVisited: asNumber(row.stalls_visited) ?? 0,
      favouritesCount: asNumber(row.favourites_count) ?? favouriteDishIds.length,
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

async function toAppSession(client: SupabaseClient): Promise<Session | null> {
  const { data } = await client.auth.getSession();
  const session = data.session;
  if (!session?.user) return null;
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
      uploaded.push(uri);
      continue;
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
  if (!avatarUri || !isLocalUri(avatarUri)) {
    return avatarUri;
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

function listAllDishesFromRepository(): DishDetail[] {
  return supabaseRepository
    .listBuildings()
    .flatMap((building) => supabaseRepository.listVenuesByBuilding(building.id))
    .flatMap((venue) => supabaseRepository.listDishesByVenue(venue.id));
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

function getOpsDraftApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_OPS_DISHES_DRAFT_API_KEY?.trim() ??
    process.env.OPS_DISHES_DRAFT_API_KEY?.trim() ??
    ""
  );
}

export const supabaseService: HungryService = {
  auth: {
    async signUp(email, password, name) {
      const client = requireSupabaseClient();
      const { error } = await client.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      });
      if (error) throw error;
      // When email confirmation is required, Supabase returns no session yet.
      // Return null so the caller can show the "check your email" flow instead of throwing.
      return await toAppSession(client);
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
      const client = requireSupabaseClient();
      const { error } = await client.auth.signInWithOAuth({ provider: "google" });
      if (error) throw error;
      const session = await toAppSession(client);
      if (!session) {
        throw new Error("OAuth flow started. Complete provider redirect to create a session.");
      }
      return session;
    },

    async signInWithApple() {
      const client = requireSupabaseClient();
      const { error } = await client.auth.signInWithOAuth({ provider: "apple" });
      if (error) throw error;
      const session = await toAppSession(client);
      if (!session) {
        throw new Error("OAuth flow started. Complete provider redirect to create a session.");
      }
      return session;
    },

    async signOut() {
      const client = requireSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
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
      const { error } = await client.from("user_profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

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
      const { data, error } = await client
        .from("bites")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error || !Array.isArray(data)) return [];

      return (data as Row[]).map((row) => ({
        id: asString(row.id) ?? `bite-${Date.now()}`,
        authorId: asString(row.author_id) ?? "unknown-author",
        authorName: asString(row.author_name) ?? "Hungry User",
        authorAvatar: asString(row.author_avatar),
        dishId: asString(row.dish_id) ?? "",
        dishName: asString(row.dish_name) ?? "Unknown dish",
        venueId: asString(row.venue_id) ?? "",
        venueName: asString(row.venue_name) ?? "Unknown venue",
        unitNumber: asString(row.unit_number) ?? "",
        buildingId: asString(row.building_id) ?? "",
        buildingName: asString(row.building_name) ?? "",
        photoUrl:
          asString(row.photo_url) ??
          "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=1200&auto=format&fit=crop",
        caption: asString(row.caption) ?? "",
        tasteStamp: {
          sweet: asNumber(row.sweet) ?? 5,
          spicy: asNumber(row.spicy) ?? 5,
          sour: asNumber(row.sour) ?? 5,
          salty: asNumber(row.salty) ?? 5,
          rich: asNumber(row.rich) ?? 5,
          aromatic: asNumber(row.aromatic) ?? 5,
        },
        cravingCount: asNumber(row.craving_count) ?? 0,
        savedCount: asNumber(row.saved_count) ?? 0,
        rating: asNumber(row.rating) ?? 0,
        price: asNumber(row.price) ?? 0,
        expiresAt: asString(row.expires_at) ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
        createdAt: asString(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async postBite(draft: BiteDraft) {
      const client = requireSupabaseClient();
      const user = await supabaseService.profile.getProfile();
      const dish = supabaseRepository.getDishById(draft.dishId);
      const venue = supabaseRepository.getVenueById(draft.venueId);
      const building = supabaseRepository
        .listBuildings()
        .find((item) => item.id === venue?.buildingId || item.id === dish?.buildingId);

      const photoUrl = isLocalUri(draft.photoUrl)
        ? (
            await uploadImageFromUri({
              client,
              bucket: "bites-media",
              path: `${user.id}/bite-${Date.now()}.jpg`,
              uri: draft.photoUrl,
            })
          ).publicUrl
        : draft.photoUrl;

      const payload = {
        author_id: user.id,
        author_name: user.displayName,
        dish_id: draft.dishId,
        dish_name: dish?.name ?? "",
        venue_id: draft.venueId,
        venue_name: venue?.name ?? "",
        unit_number: venue?.unitNumber ?? "",
        building_id: venue?.buildingId ?? dish?.buildingId ?? "",
        building_name: building?.name ?? "",
        photo_url: photoUrl,
        caption: draft.caption,
        sweet: draft.tasteStamp.sweet,
        spicy: draft.tasteStamp.spicy,
        sour: draft.tasteStamp.sour,
        salty: draft.tasteStamp.salty,
        rich: draft.tasteStamp.rich,
        aromatic: draft.tasteStamp.aromatic,
        rating: draft.rating,
        price: dish?.price ?? 0,
      };
      const { data, error } = await client.from("bites").insert(payload).select("*").maybeSingle();
      if (error || !data) throw error ?? new Error("Failed to create bite.");

      return {
        id: asString(data.id) ?? `bite-${Date.now()}`,
        authorId: asString(data.author_id) ?? user.id,
        authorName: asString(data.author_name) ?? user.displayName,
        authorAvatar: asString(data.author_avatar),
        dishId: asString(data.dish_id) ?? draft.dishId,
        dishName: asString(data.dish_name) ?? dish?.name ?? "Unknown dish",
        venueId: asString(data.venue_id) ?? draft.venueId,
        venueName: asString(data.venue_name) ?? venue?.name ?? "Unknown venue",
        unitNumber: asString(data.unit_number) ?? venue?.unitNumber ?? "",
        buildingId: asString(data.building_id) ?? venue?.buildingId ?? dish?.buildingId ?? "",
        buildingName: asString(data.building_name) ?? building?.name ?? "",
        photoUrl: asString(data.photo_url) ?? photoUrl,
        caption: asString(data.caption) ?? draft.caption,
        tasteStamp: draft.tasteStamp,
        cravingCount: asNumber(data.craving_count) ?? 0,
        savedCount: asNumber(data.saved_count) ?? 0,
        rating: asNumber(data.rating) ?? draft.rating,
        price: asNumber(data.price) ?? dish?.price ?? 0,
        expiresAt: asString(data.expires_at) ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
        createdAt: asString(data.created_at) ?? new Date().toISOString(),
      } satisfies Bite;
    },

    async reactToBite(biteId, reaction) {
      const client = requireSupabaseClient();
      const userId = await getCurrentSupabaseUserId();
      if (!userId) throw new Error("You must be signed in to react.");
      const { error } = await client.from("bite_reactions").upsert(
        {
          bite_id: biteId,
          user_id: userId,
          reaction,
        },
        { onConflict: "bite_id,user_id,reaction" },
      );
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
        p_byte_size: input.photoFileSizeBytes ?? null,
        p_source_review_dish_id: input.dishId ?? null,
        p_source_review_text: input.reviewText ?? null,
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

    async listDraftDishesQueue(venueId) {
      const client = requireSupabaseClient();
      const opsApiKey = getOpsDraftApiKey();
      const { data, error } = await client.functions.invoke("ops-dishes-draft", {
        headers: opsApiKey ? { "x-ops-api-key": opsApiKey } : undefined,
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
      const opsApiKey = getOpsDraftApiKey();
      const { error } = await client.functions.invoke("ops-dishes-draft", {
        headers: opsApiKey ? { "x-ops-api-key": opsApiKey } : undefined,
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
      const dish = supabaseRepository.getDishById(feedback.dishId);
      if (!dish) return profile.tasteVector;

      let feedbackType: Parameters<typeof processExplicitFeedback>[1]["type"] = "saved";
      if (feedback.feedbackType === "save") feedbackType = "saved";
      if (feedback.feedbackType === "unsave") feedbackType = "unsaved";
      if (feedback.feedbackType === "rating") {
        const rating = feedback.rating ?? 3;
        if (rating >= 5) feedbackType = "rating_5_star";
        else if (rating >= 4) feedbackType = "rating_4_star";
        else if (rating >= 3) feedbackType = "rating_3_star";
        else if (rating >= 2) feedbackType = "rating_2_star";
        else feedbackType = "rating_1_star";
      }
      if (feedback.feedbackType === "hawker_tag") {
        feedbackType = "hawker_tag_positive";
      }

      return processExplicitFeedback(profile.tasteVector, {
        type: feedbackType,
        dishVector: dish.tasteVector,
        timestamp: Date.now(),
      });
    },

    async processImplicitFeedback(signals: ImplicitSignalInput[]) {
      const profile = await supabaseService.profile.getProfile();
      const mappedSignals = signals
        .map((signal) => {
          const dish = supabaseRepository.getDishById(signal.dishId);
          if (!dish) return null;
          return {
            type: signal.type,
            dishVector: dish.tasteVector,
            timestamp: signal.timestamp,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (mappedSignals.length === 0) {
        return profile.tasteVector;
      }
      return processImplicitFeedback(profile.tasteVector, mappedSignals);
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
