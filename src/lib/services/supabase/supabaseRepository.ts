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
  UserProfile,
  VenueSummary,
} from "@/types/domain";

type Row = Record<string, unknown>;

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
  return [];
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

function mapDish(row: Row): DishDetail {
  const sweet = toNumber(row.sweet, 5);
  const spicy = toNumber(row.spicy, 5);
  const sour = toNumber(row.sour, 5);
  const salty = toNumber(row.salty, 5);
  const rich = toNumber(row.rich, 5);
  const aromatic = toNumber(row.aromatic, 5);
  const gallery = toStringArray(row.gallery);
  return {
    id: toString(row.id),
    venueId: toString(row.venue_id),
    buildingId: toString(row.building_id),
    venueName: toString(row.venue_name),
    unitNumber: toString(row.unit_number),
    floor: toString(row.floor),
    name: toString(row.name),
    imageUrl: toString(row.image_url),
    blurhash: toString(row.blurhash) || undefined,
    distanceMeters: toNumber(row.distance_meters),
    rating: toNumber(row.rating_avg, toNumber(row.rating)),
    reviewCount: toNumber(row.review_count),
    price: toNumber(row.price),
    priceRange: toString(row.price_range),
    liveCrowd: (toString(row.live_crowd) as DishDetail["liveCrowd"]) || undefined,
    tasteTags: toStringArray(row.taste_tags),
    tasteVector: { sweet, spicy, sour, salty, rich, aromatic },
    dietaryFlags: toStringArray(row.dietary_flags) as DietaryFlag[],
    gallery: gallery.length > 0 ? gallery : [toString(row.image_url)],
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
  return {
    id: toString(row.id),
    venueId: toString(row.venue_id),
    buildingId: toString(row.building_id),
    authorName: toString(row.author_name),
    authorLocation: toString(row.author_location),
    authorAvatarUrl: toString(row.author_avatar_url),
    mediaType: (toString(row.media_type) as StallPost["mediaType"]) || "photo",
    mediaUrl: toString(row.media_url),
    caption: toString(row.caption),
    dishIds: toStringArray(row.dish_ids),
    createdAt: toString(row.created_at) || new Date().toISOString(),
  };
}

async function refreshCache(force = false): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (hydrating) return;
  if (!force && hydrated && Date.now() - hydratedAt < REFRESH_TTL_MS) return;

  const client = getSupabaseClient();
  if (!client) return;
  hydrating = true;
  try {
    const [buildingsResult, venuesResult, dishesResult, blogResult, stallResult] =
      await Promise.all([
        client.from("buildings").select("*"),
        client.from("venues").select("*"),
        client
          .from("dishes")
          .select(
            [
              "id",
              "venue_id",
              "building_id",
              "name",
              "description",
              "image_url",
              "blurhash",
              "distance_meters",
              "rating_avg",
              "review_count",
              "price",
              "price_range",
              "live_crowd",
              "taste_tags",
              "must_order",
              "availability_flags",
              "sweet",
              "spicy",
              "sour",
              "salty",
              "rich",
              "aromatic",
              "venue_name",
              "unit_number",
              "floor",
              "dietary_flags",
              "gallery",
            ].join(","),
          ),
        client.from("blog_posts").select("*"),
        client.from("stall_posts").select("*"),
      ]);

    if (Array.isArray(buildingsResult.data) && !buildingsResult.error) {
      cachedBuildings = (buildingsResult.data as unknown as Row[]).map(mapBuilding);
    }
    if (Array.isArray(venuesResult.data) && !venuesResult.error) {
      cachedVenues = (venuesResult.data as unknown as Row[]).map(mapVenue);
    }
    if (Array.isArray(dishesResult.data) && !dishesResult.error) {
      cachedDishes = (dishesResult.data as unknown as Row[]).map(mapDish);
    }
    if (Array.isArray(blogResult.data) && !blogResult.error) {
      cachedBlogPosts = (blogResult.data as unknown as Row[]).map(mapBlogPost);
    }
    if (Array.isArray(stallResult.data) && !stallResult.error) {
      cachedStallPosts = (stallResult.data as unknown as Row[]).map(mapStallPost);
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

export const supabaseRepository: DataRepository = supabaseRepositoryImpl;
