import { similarityScore } from "@/lib/ai/similarityScore";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/services/supabase/client";
import type { DataRepository } from "@/lib/services/types";
import type {
  BlogPost,
  BuildingSummary,
  DishDetail,
  DietaryFlag,
  SearchFilters,
  StallPost,
  TasteVector,
  UserProfile,
  VenueSummary,
} from "@/types/domain";

type Row = Record<string, unknown>;
type DishPresentation = {
  gallery: string[];
  dietaryFlags: DietaryFlag[];
  tasteVector?: TasteVector;
};

const DEFAULT_AUTH_PROFILE: UserProfile = {
  id: "supabase-user",
  displayName: "Hungry User",
  email: "",
  tasteVector: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
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

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => toString(item)).filter(Boolean);
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => toString(item)).filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function toRecord(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function mapTasteVector(row?: Row): TasteVector | undefined {
  if (!row) return undefined;
  return {
    sweet: toNumber(row.sweet, 5),
    spicy: toNumber(row.spicy, 5),
    sour: toNumber(row.sour, 5),
    salty: toNumber(row.salty, 5),
    rich: toNumber(row.rich, 5),
    aromatic: toNumber(row.aromatic, 5),
  };
}

let hydrated = false;
let hydrating = false;
let hydratedAt = 0;

// Supabase mode must not silently read from mock datasets.
let cachedBuildings: BuildingSummary[] = [];
let cachedVenues: VenueSummary[] = [];
let cachedDishes: DishDetail[] = [];
let cachedBlogPosts: BlogPost[] = [];
let cachedStallPosts: StallPost[] = [];

const REFRESH_TTL_MS = 45_000;

function mapBuilding(row: Row): BuildingSummary {
  return {
    id: toString(row.id),
    name: toString(row.name),
    type: (toString(row.building_type) as BuildingSummary["type"]) || "hawker_centre",
    coordinate: {
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
    },
    floors: toStringArray(row.floors),
    venueCount: toNumber(row.venue_count),
    isClosedToday: toBool(row.is_closed_today),
    heroDishId: toString(row.hero_dish_id),
  };
}

function mapVenue(row: Row): VenueSummary {
  return {
    id: toString(row.id),
    buildingId: toString(row.building_id),
    name: toString(row.name),
    unitNumber: toString(row.unit_number),
    floor: toString(row.floor),
    isOpen: toBool(row.is_open, true),
    liveCrowd: (toString(row.live_crowd) as VenueSummary["liveCrowd"]) || undefined,
    topDishId: toString(row.top_dish_id),
    operatingHours: toString(row.operating_hours),
    closureNotice: toString(row.closure_notice) || undefined,
    deliveryLinks: [],
  };
}

function mapDish(row: Row, venue?: VenueSummary, presentation?: DishPresentation): DishDetail {
  const gallery = presentation?.gallery ?? [];
  const imageUrl = toString(row.image_url) || gallery[0] || "";
  return {
    id: toString(row.id),
    venueId: toString(row.venue_id),
    buildingId: toString(row.building_id, venue?.buildingId ?? ""),
    venueName: venue?.name ?? "",
    unitNumber: venue?.unitNumber ?? "",
    floor: venue?.floor ?? "",
    name: toString(row.name),
    imageUrl,
    blurhash: toString(row.blurhash) || undefined,
    distanceMeters: toNumber(row.distance_meters),
    rating: toNumber(row.rating_avg, toNumber(row.rating)),
    reviewCount: toNumber(row.review_count),
    price: toNumber(row.price),
    priceRange: toString(row.price_range),
    liveCrowd: (toString(row.live_crowd) as DishDetail["liveCrowd"]) || undefined,
    tasteTags: toStringArray(row.taste_tags),
    tasteVector: presentation?.tasteVector ?? {
      sweet: 5,
      spicy: 5,
      sour: 5,
      salty: 5,
      rich: 5,
      aromatic: 5,
    },
    dietaryFlags: presentation?.dietaryFlags ?? [],
    gallery: gallery.length > 0 ? gallery : imageUrl ? [imageUrl] : [],
    description: toString(row.description) || undefined,
    mustOrder: toBool(row.must_order),
    availabilityFlags: toStringArray(row.availability_flags),
    reviews: [],
  };
}

function mapBlogPost(row: Row): BlogPost {
  return {
    id: toString(row.id),
    title: toString(row.title),
    excerpt: toString(row.excerpt),
    area: toString(row.area),
    sourceName: toString(row.source_name),
    sourceLogo: toString(row.source_logo),
    imageUrl: toString(row.image_url),
    url: toString(row.url),
    relatedVenueId: toString(row.related_venue_id) || undefined,
  };
}

function mapStallPost(row: Row): StallPost {
  const mediaUrls = toStringArray(row.media_urls);
  const tags = toStringArray(row.tags);

  return {
    id: toString(row.id),
    venueId: toString(row.venue_id),
    buildingId: toString(row.building_id),
    authorName: toString(row.author_name),
    authorLocation: toString(row.author_location),
    authorAvatarUrl: toString(row.author_avatar_url),
    mediaType: (toString(row.media_type) as StallPost["mediaType"]) || "photo",
    mediaUrl: toString(row.media_url),
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    caption: toString(row.caption),
    tags: tags.length > 0 ? tags : undefined,
    dishIds: toStringArray(row.dish_ids),
    createdAt: toString(row.created_at) || new Date().toISOString(),
  };
}

function groupRowsByStringKey(rows: Row[], key: string): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  rows.forEach((row) => {
    const value = toString(row[key]);
    if (!value) return;
    const current = grouped.get(value) ?? [];
    current.push(row);
    grouped.set(value, current);
  });
  return grouped;
}

function mapPostRowToStallPost(
  row: Row,
  mediaRows: Row[],
  venue?: VenueSummary,
  building?: BuildingSummary,
  dish?: DishDetail,
): StallPost {
  const meta = toRecord(row.generated_content);
  const authorMeta = toRecord(meta.author);
  const dishMeta = toRecord(meta.dish);
  const venueMeta = toRecord(meta.venue);
  const mediaUrls = mediaRows
    .slice()
    .sort((left, right) => toNumber(left.sort_order) - toNumber(right.sort_order))
    .map((mediaRow) => toString(mediaRow.public_url) || toString(mediaRow.storage_path))
    .filter(Boolean);
  const fallbackImage = dish?.imageUrl ?? toString(dishMeta.imageUrl);
  const mediaUrl = mediaUrls[0] ?? fallbackImage;
  const mediaType = mediaRows.some((mediaRow) => toString(mediaRow.media_type) === "video")
    ? "video"
    : "photo";

  return {
    id: toString(row.id),
    authorId: toString(row.author_id),
    venueId: toString(row.venue_id) || venue?.id || toString(venueMeta.id),
    buildingId:
      toString(row.building_id) ||
      venue?.buildingId ||
      dish?.buildingId ||
      toString(venueMeta.buildingId),
    authorName: toString(authorMeta.displayName, "Hungry User"),
    authorLocation: venue?.name || toString(venueMeta.name) || building?.name || "",
    authorAvatarUrl: toString(authorMeta.avatarUrl) || mediaUrl,
    mediaType,
    mediaUrl,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : mediaUrl ? [mediaUrl] : undefined,
    caption: toString(row.caption),
    tags: toStringArray(meta.tags),
    dishIds: [toString(row.dish_id) || dish?.id || toString(dishMeta.id)].filter(Boolean),
    createdAt: toString(row.published_at) || toString(row.created_at) || new Date().toISOString(),
    publishedStatus: "published",
    visibility: toString(row.visibility) === "private" ? "private" : "public",
    likeCount: toNumber(row.like_count),
    commentCount: toNumber(row.comment_count),
    savedCount: toNumber(row.save_count),
  };
}

function buildDishPresentationMap(
  imageRows: Row[],
  tasteVectorRows: Row[],
  dishDietaryFlagRows: Row[],
  dietaryFlagRows: Row[],
): Map<string, DishPresentation> {
  const presentationByDishId = new Map<string, DishPresentation>();
  const flagSlugById = new Map(
    dietaryFlagRows
      .map((row) => [toString(row.id), toString(row.slug)] as const)
      .filter(([id, slug]) => id.length > 0 && slug.length > 0),
  );

  const ensurePresentation = (dishId: string): DishPresentation => {
    const current = presentationByDishId.get(dishId);
    if (current) return current;
    const next = { gallery: [], dietaryFlags: [] };
    presentationByDishId.set(dishId, next);
    return next;
  };

  imageRows
    .slice()
    .sort((left, right) => toNumber(left.sort_order) - toNumber(right.sort_order))
    .forEach((row) => {
      const dishId = toString(row.dish_id);
      const url = toString(row.url);
      if (!dishId || !url) return;
      const presentation = ensurePresentation(dishId);
      if (!presentation.gallery.includes(url)) presentation.gallery.push(url);
    });

  tasteVectorRows.forEach((row) => {
    const dishId = toString(row.dish_id);
    if (!dishId) return;
    ensurePresentation(dishId).tasteVector = mapTasteVector(row);
  });

  dishDietaryFlagRows.forEach((row) => {
    const dishId = toString(row.dish_id);
    const slug = flagSlugById.get(toString(row.dietary_flag_id));
    if (!dishId || !slug) return;
    const presentation = ensurePresentation(dishId);
    if (!presentation.dietaryFlags.includes(slug as DietaryFlag)) {
      presentation.dietaryFlags.push(slug as DietaryFlag);
    }
  });

  return presentationByDishId;
}

async function refreshCache(force = false): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (hydrating) return;
  if (!force && hydrated && Date.now() - hydratedAt < REFRESH_TTL_MS) return;

  const client = getSupabaseClient();
  if (!client) return;
  hydrating = true;
  try {
    const [
      buildingsResult,
      venuesResult,
      dishesResult,
      dishImagesResult,
      dishTasteVectorsResult,
      dishDietaryFlagsResult,
      dietaryFlagsResult,
      blogResult,
      stallResult,
      postsResult,
      postMediaResult,
    ] = await Promise.all([
      client.from("buildings").select("*"),
      client.from("venues").select("*"),
      client.from("dishes").select("*"),
      client.from("dish_images").select("dish_id,url,sort_order").order("sort_order"),
      client.from("dish_taste_vectors").select("dish_id,sweet,spicy,sour,salty,rich,aromatic"),
      client.from("dish_dietary_flags").select("dish_id,dietary_flag_id"),
      client.from("dietary_flags").select("id,slug"),
      client.from("blog_posts").select("*"),
      client.from("stall_posts").select("*"),
      client
        .from("posts")
        .select("*")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false }),
      client.from("post_media").select("*").order("sort_order", { ascending: true }),
    ]);

    if (Array.isArray(buildingsResult.data) && !buildingsResult.error) {
      cachedBuildings = (buildingsResult.data as unknown as Row[]).map(mapBuilding);
    }
    let mappedVenues = cachedVenues;
    if (Array.isArray(venuesResult.data) && !venuesResult.error) {
      mappedVenues = (venuesResult.data as unknown as Row[]).map(mapVenue);
      cachedVenues = mappedVenues;
    }
    if (Array.isArray(dishesResult.data) && !dishesResult.error) {
      const imageRows =
        Array.isArray(dishImagesResult.data) && !dishImagesResult.error
          ? (dishImagesResult.data as unknown as Row[])
          : [];
      const tasteVectorRows =
        Array.isArray(dishTasteVectorsResult.data) && !dishTasteVectorsResult.error
          ? (dishTasteVectorsResult.data as unknown as Row[])
          : [];
      const dishDietaryFlagRows =
        Array.isArray(dishDietaryFlagsResult.data) && !dishDietaryFlagsResult.error
          ? (dishDietaryFlagsResult.data as unknown as Row[])
          : [];
      const dietaryFlagRows =
        Array.isArray(dietaryFlagsResult.data) && !dietaryFlagsResult.error
          ? (dietaryFlagsResult.data as unknown as Row[])
          : [];
      const presentationByDishId = buildDishPresentationMap(
        imageRows,
        tasteVectorRows,
        dishDietaryFlagRows,
        dietaryFlagRows,
      );
      cachedDishes = (dishesResult.data as unknown as Row[]).map((row) =>
        mapDish(
          row,
          mappedVenues.find((venue) => venue.id === toString(row.venue_id)),
          presentationByDishId.get(toString(row.id)),
        ),
      );
    }
    if (Array.isArray(blogResult.data) && !blogResult.error) {
      cachedBlogPosts = (blogResult.data as unknown as Row[]).map(mapBlogPost);
    }
    const legacyStallPosts =
      Array.isArray(stallResult.data) && !stallResult.error
        ? (stallResult.data as unknown as Row[]).map(mapStallPost)
        : cachedStallPosts;
    if (Array.isArray(postsResult.data) && !postsResult.error) {
      const postRows = postsResult.data as unknown as Row[];
      const postMediaRows =
        Array.isArray(postMediaResult.data) && !postMediaResult.error
          ? (postMediaResult.data as unknown as Row[])
          : [];
      const mediaByPostId = groupRowsByStringKey(postMediaRows, "post_id");
      const postStallPosts = postRows.map((row) => {
        const venue = mappedVenues.find((item) => item.id === toString(row.venue_id));
        const dish = cachedDishes.find((item) => item.id === toString(row.dish_id));
        const building = cachedBuildings.find(
          (item) =>
            item.id === toString(row.building_id) ||
            item.id === venue?.buildingId ||
            item.id === dish?.buildingId,
        );
        return mapPostRowToStallPost(
          row,
          mediaByPostId.get(toString(row.id)) ?? [],
          venue,
          building,
          dish,
        );
      });
      const publishedIds = new Set(postStallPosts.map((post) => post.id));
      cachedStallPosts = [
        ...postStallPosts,
        ...legacyStallPosts.filter((post) => !publishedIds.has(post.id)),
      ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    } else {
      cachedStallPosts = legacyStallPosts;
    }

    hydrated = true;
    hydratedAt = Date.now();
  } finally {
    hydrating = false;
  }
}

function ensureHydrated(): void {
  if (!hydrated || Date.now() - hydratedAt > REFRESH_TTL_MS) {
    void refreshCache(!hydrated);
  }
}

const supabaseRepositoryImpl: DataRepository = {
  getProfile(isAuthenticated: boolean): UserProfile {
    ensureHydrated();
    return isAuthenticated ? DEFAULT_AUTH_PROFILE : DEFAULT_GUEST_PROFILE;
  },

  listBuildings(): BuildingSummary[] {
    ensureHydrated();
    return cachedBuildings;
  },

  listVenuesByBuilding(buildingId: string): VenueSummary[] {
    ensureHydrated();
    return cachedVenues.filter((venue) => venue.buildingId === buildingId);
  },

  getVenueById(venueId: string): VenueSummary | undefined {
    ensureHydrated();
    return cachedVenues.find((venue) => venue.id === venueId);
  },

  getDishById(dishId: string): DishDetail | undefined {
    ensureHydrated();
    return cachedDishes.find((dish) => dish.id === dishId);
  },

  listDishesByVenue(venueId: string): DishDetail[] {
    ensureHydrated();
    return cachedDishes.filter((dish) => dish.venueId === venueId);
  },

  listPopularNearby(): DishDetail[] {
    ensureHydrated();
    return [...cachedDishes]
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, 8);
  },

  searchDishes(filters: SearchFilters, tasteProfile): DishDetail[] {
    ensureHydrated();
    const query = filters.query.trim().toLowerCase();
    const matched = cachedDishes.filter((dish) => {
      const matchesQuery = !query || dish.name.toLowerCase().includes(query);
      const matchesDietary =
        filters.dietaryFlags.length === 0 ||
        filters.dietaryFlags.every((flag) => dish.dietaryFlags.includes(flag));
      const matchesCategory =
        filters.categories.length === 0 ||
        filters.categories.some((category) =>
          `${dish.name} ${dish.tasteTags.join(" ")}`.toLowerCase().includes(category.split(" ")[0]),
        );
      return (
        matchesQuery &&
        matchesDietary &&
        matchesCategory &&
        dish.distanceMeters <= (filters.radius || Number.MAX_SAFE_INTEGER)
      );
    });
    return matched.sort((a, b) => {
      const scoreA = similarityScore(a.tasteVector, filters.tasteValues || tasteProfile);
      const scoreB = similarityScore(b.tasteVector, filters.tasteValues || tasteProfile);
      return scoreB - scoreA;
    });
  },

  getDecideForMe(tasteProfile, options) {
    ensureHydrated();
    const excluded = new Set(options?.excludeDishIds ?? []);
    const withinRadius = cachedDishes.filter(
      (dish) =>
        !excluded.has(dish.id) &&
        dish.distanceMeters <= (options?.radiusMeters ?? Number.MAX_SAFE_INTEGER),
    );
    const ranked = [...withinRadius].sort(
      (left, right) =>
        similarityScore(right.tasteVector, tasteProfile) -
        similarityScore(left.tasteVector, tasteProfile),
    );
    return ranked[0];
  },

  listBlogPosts(): BlogPost[] {
    ensureHydrated();
    return cachedBlogPosts;
  },

  listStallPosts(): StallPost[] {
    ensureHydrated();
    return cachedStallPosts;
  },
};

// Kick off hydration on module load for low-latency first read.
ensureHydrated();

export function invalidateSupabaseRepositoryCache(): void {
  hydrated = false;
  hydratedAt = 0;
  void refreshCache(true);
}

export async function refreshSupabaseRepositoryCache(): Promise<void> {
  hydrated = false;
  hydratedAt = 0;
  await refreshCache(true);
}

export const supabaseRepository: DataRepository = supabaseRepositoryImpl;
