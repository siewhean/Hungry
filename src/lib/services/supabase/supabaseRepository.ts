import { runRecommendationPipeline } from "@/lib/ai/tasteEngine";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/services/supabase/client";
import type {
  BuildingDetail,
  DataRepository,
  DiscoveryLocationFeed,
  DiscoveryLocationFeedRequest,
  SearchResult,
  VenueLocationSearchRequest,
} from "@/lib/services/types";
import type {
  BlogPost,
  BuildingSummary,
  DishDetail,
  DietaryFlag,
  FoodCredAction,
  MissionType,
  SearchFilters,
  StallInteraction,
  StallPost,
  TasteVector,
  UserFoodCred,
  UserMissionProgress,
  UserProfile,
  VenueSummary,
  WeeklyMission,
} from "@/types/domain";

type Row = Record<string, unknown>;
type DishPresentation = {
  gallery: string[];
  dietaryFlags: DietaryFlag[];
  tasteVector?: TasteVector;
};

const DEFAULT_AUTH_PROFILE_BASE: Omit<UserProfile, "id"> = {
  displayName: "Hungry User",
  email: "",
  profileVisibility: "public",
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
  ...DEFAULT_AUTH_PROFILE_BASE,
  id: "guest-user",
  displayName: "Guest",
  email: "guest@hungry.local",
};

function buildAuthenticatedProfile(userId: string): UserProfile {
  return {
    ...DEFAULT_AUTH_PROFILE_BASE,
    id: userId,
  };
}

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

function isCatalogDeliveryAppUrl(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("grab.com") ||
    normalized.includes("foodpanda.") ||
    normalized.includes("deliveroo.")
  );
}

function isCatalogMenuDisplayable(row: Row): boolean {
  const rightsStatus = toString(row.menu_rights_status, "unverified");
  const sourceUrl = toString(row.menu_source_url);
  return (
    toBool(row.menu_approved_for_display) &&
    ["merchant_owned", "operator_owned", "user_submitted", "permitted_api", "licensed"].includes(
      rightsStatus,
    ) &&
    (rightsStatus === "licensed" || !isCatalogDeliveryAppUrl(sourceUrl))
  );
}

function catalogDisplayImageUrl(row: Row, urlKey = "image_url"): string {
  const url = toString(row[urlKey]).trim();
  if (!url) return "";
  const rightsStatus = toString(row.media_rights_status, "unverified");
  const sourceUrl = toString(row.media_source_url);
  if (!toBool(row.media_approved_for_display)) return "";
  if (
    !["merchant_owned", "operator_owned", "user_submitted", "permitted_api", "licensed"].includes(
      rightsStatus,
    )
  ) {
    return "";
  }
  if (url.toLowerCase().includes("images.unsplash.com")) return "";
  if (isCatalogDeliveryAppUrl(`${url} ${sourceUrl}`) && rightsStatus !== "licensed") return "";
  return url;
}

function toRecord(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function toRowArray(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === "object")
    : [];
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
let hydrationPromise: Promise<void> | null = null;
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
    planningArea: toString(row.planning_area) || undefined,
    imageUrl: catalogDisplayImageUrl(row) || undefined,
  };
}

function mapVenue(row: Row): VenueSummary {
  return {
    id: toString(row.id),
    buildingId: toString(row.building_id),
    name: toString(row.name),
    unitNumber: toString(row.unit_number),
    floor: toString(row.floor),
    isOpen: toBool(row.is_open, false),
    liveCrowd: (toString(row.live_crowd) as VenueSummary["liveCrowd"]) || undefined,
    topDishId: toString(row.top_dish_id),
    operatingHours: toString(row.operating_hours),
    closureNotice: toString(row.closure_notice) || undefined,
    deliveryLinks: [],
    planningArea: toString(row.planning_area) || undefined,
    imageUrl: catalogDisplayImageUrl(row) || undefined,
    buildingName: toString(row.building_name) || undefined,
    address: toString(row.address) || undefined,
    postalCode: toString(row.postal_code) || undefined,
  };
}

function mapDish(row: Row, venue?: VenueSummary, presentation?: DishPresentation): DishDetail {
  const gallery = presentation?.gallery ?? [];
  const imageUrl = gallery[0] || catalogDisplayImageUrl(row) || "";
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

function mapReviewRows(value: unknown): DishDetail["reviews"] {
  return toRowArray(value).map((row) => ({
    id: toString(row.id),
    authorName: toString(row.authorName, toString(row.author_name, "Hungry User")),
    rating: toNumber(row.rating),
    createdAt: toString(row.createdAt, toString(row.created_at, new Date().toISOString())),
    text: toString(row.text),
    tags: toStringArray(row.tags),
    wouldRecommend: toBool(row.wouldRecommend ?? row.would_recommend, true),
    photos: toStringArray(row.photos),
  }));
}

function mapRpcDish(row: Row): DishDetail {
  const venue: VenueSummary = {
    id: toString(row.venue_id),
    buildingId: toString(row.building_id),
    name: toString(row.venue_name),
    unitNumber: toString(row.unit_number),
    floor: toString(row.floor),
    isOpen: toBool(row.is_open, false),
    liveCrowd: (toString(row.live_crowd) as VenueSummary["liveCrowd"]) || undefined,
    topDishId: "",
    operatingHours: "",
    closureNotice: undefined,
    deliveryLinks: [],
  };
  const gallery = toStringArray(row.gallery);
  const presentation: DishPresentation = {
    gallery,
    dietaryFlags: toStringArray(row.dietary_flags) as DietaryFlag[],
    tasteVector: mapTasteVector(toRecord(row.taste_vector)),
  };
  const dish = mapDish(
    {
      ...row,
      id: toString(row.dish_id),
      rating_avg: row.rating,
    },
    venue,
    presentation,
  );
  const reviews = mapReviewRows(row.reviews);
  return reviews.length > 0 ? { ...dish, reviews } : dish;
}

function mapRpcVenue(row: Row): VenueSummary {
  const deliveryRows = toRowArray(row.delivery_links);
  const building = toRecord(row.building);
  return {
    id: toString(row.venue_id),
    buildingId: toString(row.building_id),
    name: toString(row.name),
    unitNumber: toString(row.unit_number),
    floor: toString(row.floor),
    isOpen: toBool(row.is_open, false),
    liveCrowd: (toString(row.live_crowd) as VenueSummary["liveCrowd"]) || undefined,
    topDishId: toString(row.top_dish_id),
    operatingHours: toString(row.operating_hours),
    closureNotice: toString(row.closure_notice) || undefined,
    deliveryLinks: deliveryRows.map((delivery) => ({
      platform: toString(delivery.platform) as VenueSummary["deliveryLinks"][number]["platform"],
      nativeUrl: toString(delivery.nativeUrl, toString(delivery.native_url)),
      webUrl: toString(delivery.webUrl, toString(delivery.web_url)),
      affiliateEligible: toBool(delivery.affiliateEligible ?? delivery.affiliate_eligible),
    })),
    planningArea: toString(row.planning_area, toString(building.planningArea)) || undefined,
    imageUrl: catalogDisplayImageUrl(row) || undefined,
    buildingName: toString(row.building_name, toString(building.name)) || undefined,
    address: toString(row.address, toString(building.address)) || undefined,
    postalCode: toString(row.postal_code, toString(building.postalCode)) || undefined,
  };
}

function mapDiscoveryFeedVenue(row: Row): VenueSummary {
  return {
    id: toString(row.venue_id),
    buildingId: toString(row.building_id),
    name: toString(row.venue_name, toString(row.name)),
    unitNumber: toString(row.unit_number),
    floor: toString(row.floor),
    isOpen: toBool(row.is_open, false),
    liveCrowd: undefined,
    topDishId: toString(row.top_dish_id),
    operatingHours: "",
    closureNotice: undefined,
    deliveryLinks: [],
    planningArea: toString(row.planning_area) || undefined,
    imageUrl: toString(row.venue_image_url) || toString(row.building_image_url) || undefined,
    buildingName: toString(row.building_name) || undefined,
  };
}

function mapDiscoveryFeedDish(row: Row, venue: VenueSummary): DishDetail | undefined {
  const dishId = toString(row.top_dish_id);
  const dishName = toString(row.top_dish_name);
  if (!dishId || !dishName) return undefined;
  const gallery = [
    toString(row.top_dish_image),
    toString(row.top_dish_catalog_image),
    toString(row.representative_dish_image),
    toString(row.venue_image_url),
    toString(row.building_image_url),
  ].filter(
    (imageUrl, index, imageUrls) => imageUrl.length > 0 && imageUrls.indexOf(imageUrl) === index,
  );
  const imageUrl = gallery[0] ?? "";
  return mapDish(
    {
      id: dishId,
      venue_id: venue.id,
      building_id: venue.buildingId,
      name: dishName,
      image_url: imageUrl,
      distance_meters: row.distance_meters,
      rating_avg: row.top_dish_rating,
      review_count: row.top_dish_review_count,
      price: row.top_dish_price,
      price_range: "",
      live_crowd: row.live_crowd,
      taste_tags: row.cuisine_tags,
      must_order: true,
      availability_flags: [],
    },
    venue,
    { gallery, dietaryFlags: [] },
  );
}

function mapUserFoodCred(row: Row): UserFoodCred {
  return {
    userId: toString(row.user_id),
    totalPoints: toNumber(row.total_points),
    levelIndex: toNumber(row.level_index),
  };
}

function mapStallInteraction(row: Row): StallInteraction {
  return {
    userId: toString(row.user_id),
    stallId: toString(row.stall_id),
    isSaved: toBool(row.is_saved),
    isTried: toBool(row.is_tried),
    isReviewed: toBool(row.is_reviewed),
    savedAt: toString(row.saved_at) || undefined,
    triedAt: toString(row.tried_at) || undefined,
    reviewedAt: toString(row.reviewed_at) || undefined,
  };
}

function mapWeeklyMission(row: Row): WeeklyMission {
  return {
    id: toString(row.id),
    title: toString(row.title),
    description: toString(row.description),
    missionType: toString(row.mission_type) as MissionType,
    requirementCount: toNumber(row.requirement_count),
    rewardType: toString(row.reward_type) as WeeklyMission["rewardType"],
    rewardValue: toNumber(row.reward_value),
    weekStart: toString(row.week_start),
    weekEnd: toString(row.week_end),
    isActive: toBool(row.is_active),
  };
}

function mapMissionProgress(row: Row): UserMissionProgress {
  return {
    userId: toString(row.user_id),
    missionId: toString(row.mission_id),
    currentCount: toNumber(row.current_count),
    completedAt: toString(row.completed_at) || undefined,
  };
}

function mapBuildingDetail(row: Row): BuildingDetail {
  const building = mapBuilding(row);
  return {
    ...building,
    address: toString(row.address),
    postalCode: toString(row.postal_code),
    operatingHours: toString(row.operating_hours),
    description: toString(row.description) || undefined,
    famousDishes: toStringArray(row.famous_dishes),
    totalStalls: toNumber(row.total_stalls, building.venueCount),
    openStalls: toNumber(row.open_stalls),
    avgRating: toNumber(row.avg_rating),
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
    showFoodContextOverlay: meta.showFoodContextOverlay !== false,
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
      const url = catalogDisplayImageUrl(row, "url");
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
  if (!force && hydrated && Date.now() - hydratedAt < REFRESH_TTL_MS) return;
  if (hydrationPromise) return hydrationPromise;

  const client = getSupabaseClient();
  if (!client) return;
  hydrationPromise = (async () => {
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
        client
          .from("dish_images")
          .select(
            "dish_id,url,sort_order,media_approved_for_display,media_rights_status,media_source_url",
          )
          .order("sort_order"),
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
        cachedDishes = (dishesResult.data as unknown as Row[])
          .filter(isCatalogMenuDisplayable)
          .map((row) =>
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
      hydrationPromise = null;
    }
  })();
  return hydrationPromise;
}

function ensureHydrated(): void {
  if (!hydrated || Date.now() - hydratedAt > REFRESH_TTL_MS) {
    void refreshCache(!hydrated);
  }
}

async function rpcRows(functionName: string, args: Row): Promise<Row[] | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  const client = getSupabaseClient();
  if (!client) return undefined;
  const { data, error } = await client.rpc(functionName, args);
  if (error || !Array.isArray(data)) {
    if (error && !isExpectedDiscoveryRpcError(error)) {
      console.warn(`Supabase discovery RPC ${functionName} failed`, error.message);
    }
    return undefined;
  }
  return data as unknown as Row[];
}

function isExpectedDiscoveryRpcError(error: { code?: unknown; message?: unknown }): boolean {
  const message = String(error.message ?? "").toLowerCase();
  const code = String(error.code ?? "");
  return (
    code === "42883" ||
    message.includes("does not exist") ||
    message.includes('type "geography" does not exist')
  );
}

export async function countVenuesInAreaViaRpc(
  lat?: number,
  lng?: number,
  radiusMeters?: number,
  areaName?: string,
): Promise<number | undefined> {
  if (!isSupabaseConfigured()) {
    return undefined;
  }

  const client = getSupabaseClient();
  if (!client) return undefined;

  const normalizedAreaName = areaName?.trim();
  if (normalizedAreaName) {
    const { count, error } = await client
      .from("venues")
      .select("id", { count: "exact", head: true })
      .ilike("planning_area", normalizedAreaName);

    if (!error && typeof count === "number") return count;
    if (error) {
      console.warn("Supabase venue planning-area count failed", error.message);
    }
  }

  if (typeof lat !== "number" || typeof lng !== "number") {
    return undefined;
  }

  const { data, error } = await client.rpc("count_venues_in_area", {
    p_lat: lat,
    p_lng: lng,
    p_radius_meters: radiusMeters ?? null,
  });

  if (error) {
    if (!isExpectedDiscoveryRpcError(error)) {
      console.warn("Supabase discovery RPC count_venues_in_area failed", error.message);
    } else {
      console.debug("Supabase discovery RPC count_venues_in_area unavailable", error.message);
    }
    return undefined;
  }

  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "string") {
    const parsed = Number(data);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export async function searchDishesViaRpc(
  filters: SearchFilters,
  tasteProfile: TasteVector,
): Promise<SearchResult[] | undefined> {
  const rows = await rpcRows("search_dishes", {
    p_query: filters.query.trim() || null,
    p_lat: filters.latitude ?? null,
    p_lng: filters.longitude ?? null,
    p_radius_meters: filters.radius || null,
    p_dietary_flags: filters.dietaryFlags,
    p_limit: 20,
    p_cursor_score: null,
    p_cursor_id: null,
    p_venue_id: null,
    p_area_name: filters.areaName ?? null,
    p_cuisine_tags: filters.cuisineTags ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_open_only: filters.openOnly ?? false,
  });
  if (!rows) return undefined;
  return rows.map((row) => ({
    dish: mapRpcDish(row),
    score: toNumber(row.rank_score, similarityScoreFallback(mapRpcDish(row), tasteProfile)),
  }));
}

export async function listDiscoveryFeedByLocationViaRpc(
  request: DiscoveryLocationFeedRequest,
): Promise<DiscoveryLocationFeed | undefined> {
  const rows = await rpcRows("get_discovery_feed_by_location", {
    p_area_name: request.areaName?.trim() || null,
    p_lat: request.lat ?? null,
    p_lng: request.lng ?? null,
    p_radius_meters: request.radiusMeters ?? null,
    p_limit: request.limit ?? null,
  });
  if (!rows) return undefined;

  const venues = rows.map(mapDiscoveryFeedVenue);
  const results = rows
    .map((row, index) => {
      const venue = venues[index];
      const dish = mapDiscoveryFeedDish(row, venue);
      return dish
        ? {
            dish,
            score: toNumber(row.rank_score),
          }
        : undefined;
    })
    .filter((result): result is SearchResult => Boolean(result));

  return { venues, results };
}

export async function searchVenuesByLocationViaRpc(
  request: VenueLocationSearchRequest,
): Promise<VenueSummary[] | undefined> {
  const rows = await rpcRows("search_venues_by_location", {
    p_query: request.query?.trim() || null,
    p_area_name: request.areaName?.trim() || null,
    p_lat: request.lat ?? null,
    p_lng: request.lng ?? null,
    p_radius_meters: request.radiusMeters ?? null,
    p_limit: request.limit ?? null,
  });
  return rows?.map((row) =>
    mapRpcVenue({
      ...row,
      delivery_links: [],
    }),
  );
}

export async function getDishByIdViaRpc(dishId: string): Promise<DishDetail | undefined> {
  const rows = await rpcRows("get_dish_detail", { p_dish_id: dishId });
  return rows?.[0] ? mapRpcDish(rows[0]) : undefined;
}

export async function getVenueByIdViaRpc(venueId: string): Promise<VenueSummary | undefined> {
  const rows = await rpcRows("get_venue_detail", { p_venue_id: venueId });
  return rows?.[0] ? mapRpcVenue(rows[0]) : undefined;
}

export async function listBuildingsViaRpc(
  lat?: number,
  lng?: number,
  radiusMeters?: number,
): Promise<BuildingSummary[] | undefined> {
  const hasLocation = typeof lat === "number" && typeof lng === "number";
  const pageLimit = 100;
  const maxPages = 5;
  const rows: Row[] = [];
  let cursorDistance: number | null = null;
  let cursorId: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const pageRows = await rpcRows("list_buildings", {
      p_lat: hasLocation ? lat : null,
      p_lng: hasLocation ? lng : null,
      p_radius_meters: hasLocation ? (radiusMeters ?? null) : null,
      p_limit: pageLimit,
      p_cursor_distance_meters: cursorDistance,
      p_cursor_id: cursorId,
    });
    if (!pageRows) return undefined;
    rows.push(...pageRows);
    if (pageRows.length < pageLimit) break;
    const last = pageRows[pageRows.length - 1];
    cursorDistance = toNumber(last.cursor_distance_meters);
    cursorId = toString(last.cursor_id);
    if (!cursorId) break;
  }

  return rows.map(mapBuilding);
}

export async function getBuildingDetailViaRpc(
  buildingId: string,
): Promise<BuildingDetail | undefined> {
  const rows = await rpcRows("get_building_detail", { p_building_id: buildingId });
  return rows?.[0] ? mapBuildingDetail(rows[0]) : undefined;
}

export async function listVenuesByBuildingViaRpc(
  buildingId: string,
): Promise<VenueSummary[] | undefined> {
  const pageLimit = 100;
  const maxPages = 5;
  const rows: Row[] = [];
  let cursorFloorSort: number | null = null;
  let cursorId: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const pageRows = await rpcRows("list_venues_by_building", {
      p_building_id: buildingId,
      p_open_now: null,
      p_limit: pageLimit,
      p_cursor_floor_sort: cursorFloorSort,
      p_cursor_id: cursorId,
    });
    if (!pageRows) return undefined;
    rows.push(...pageRows);
    if (pageRows.length < pageLimit) break;
    const last = pageRows[pageRows.length - 1];
    cursorFloorSort = toNumber(last.cursor_floor_sort);
    cursorId = toString(last.cursor_id);
    if (!cursorId) break;
  }

  return rows.map(mapRpcVenue);
}

export async function listDishesByVenueViaRpc(venueId: string): Promise<DishDetail[] | undefined> {
  const rows = await rpcRows("get_venue_detail", { p_venue_id: venueId });
  const venue = rows?.[0];
  if (!venue) return rows ? [] : undefined;
  return toRowArray(venue.dishes).map(mapRpcDish);
}

export async function listPopularNearbyViaRpc(
  lat?: number,
  lng?: number,
): Promise<DishDetail[] | undefined> {
  const rows = await rpcRows("search_dishes", {
    p_query: null,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
    p_radius_meters: 2500,
    p_dietary_flags: [],
    p_limit: 8,
    p_cursor_score: null,
    p_cursor_id: null,
    p_venue_id: null,
    p_area_name: null,
    p_cuisine_tags: null,
    p_max_price: null,
    p_open_only: false,
  });
  return rows?.map(mapRpcDish);
}

export async function listNearbyOpenVenuesViaRpc(
  lat?: number,
  lng?: number,
): Promise<VenueSummary[] | undefined> {
  const rows = await rpcRows("get_nearby_open_venues", {
    p_lat: lat ?? null,
    p_lng: lng ?? null,
    p_radius_meters: 2500,
    p_limit: 20,
    p_cursor_distance_meters: null,
    p_cursor_id: null,
  });
  return rows?.map((row) =>
    mapRpcVenue({
      ...row,
      venue_id: row.venue_id,
      delivery_links: [],
    }),
  );
}

function similarityScoreFallback(dish: DishDetail, tasteProfile: TasteVector): number {
  const axes = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"] as const;
  const distance = axes.reduce(
    (sum, axis) => sum + Math.abs(dish.tasteVector[axis] - tasteProfile[axis]),
    0,
  );
  return Math.max(0, 1 - distance / (axes.length * 10));
}

const supabaseRepositoryImpl: DataRepository = {
  getProfile(isAuthenticated: boolean, userId?: string | null): UserProfile {
    ensureHydrated();
    if (!isAuthenticated || !userId) {
      return DEFAULT_GUEST_PROFILE;
    }
    return buildAuthenticatedProfile(userId);
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
    const ranked = runRecommendationPipeline(matched, {
      userVector: filters.tasteValues || tasteProfile,
      dietaryFlags: filters.dietaryFlags,
      radiusMeters: filters.radius || Number.MAX_SAFE_INTEGER,
      neophiliaIndex: 5,
    });

    return ranked
      .map((result) => matched.find((dish) => dish.id === result.dishId))
      .filter((dish): dish is DishDetail => Boolean(dish));
  },

  getDecideForMe(tasteProfile, options) {
    ensureHydrated();
    const ranked = runRecommendationPipeline(cachedDishes, {
      userVector: tasteProfile,
      dietaryFlags: options?.dietaryFlags ?? [],
      neophiliaIndex: options?.neophiliaIndex ?? 5,
      latitude: options?.latitude,
      longitude: options?.longitude,
      radiusMeters: options?.radiusMeters,
      excludeDishIds: options?.excludeDishIds,
    });
    return ranked[0] ? cachedDishes.find((dish) => dish.id === ranked[0]?.dishId) : undefined;
  },

  listBlogPosts(): BlogPost[] {
    ensureHydrated();
    return cachedBlogPosts;
  },

  listStallPosts(): StallPost[] {
    ensureHydrated();
    return cachedStallPosts;
  },

  async getStallInteraction(userId: string, stallId: string): Promise<StallInteraction | null> {
    if (!isSupabaseConfigured()) return null;
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .from("user_stall_interactions")
      .select("user_id,stall_id,is_saved,is_tried,is_reviewed,saved_at,tried_at,reviewed_at")
      .eq("user_id", userId)
      .eq("stall_id", stallId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapStallInteraction(data as Row) : null;
  },

  async listStallInteractions(userId: string): Promise<StallInteraction[]> {
    if (!isSupabaseConfigured()) return [];
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from("user_stall_interactions")
      .select("user_id,stall_id,is_saved,is_tried,is_reviewed,saved_at,tried_at,reviewed_at")
      .eq("user_id", userId);
    if (error) throw error;
    return (Array.isArray(data) ? (data as Row[]) : []).map(mapStallInteraction);
  },

  async getUserFoodCred(userId: string): Promise<UserFoodCred | null> {
    if (!isSupabaseConfigured()) return null;
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .from("user_food_cred")
      .select("user_id,total_points,level_index")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapUserFoodCred(data as Row) : null;
  },

  async listActiveMissions(): Promise<WeeklyMission[]> {
    if (!isSupabaseConfigured()) return [];
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from("weekly_missions")
      .select(
        "id,title,description,mission_type,requirement_count,reward_type,reward_value,week_start,week_end,is_active",
      )
      .eq("is_active", true)
      .order("week_start", { ascending: false });
    if (error) throw error;
    return (Array.isArray(data) ? (data as Row[]) : []).map(mapWeeklyMission);
  },

  async listUserMissionProgress(userId: string): Promise<UserMissionProgress[]> {
    if (!isSupabaseConfigured()) return [];
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from("user_mission_progress")
      .select("user_id,mission_id,current_count,completed_at")
      .eq("user_id", userId);
    if (error) throw error;
    return (Array.isArray(data) ? (data as Row[]) : []).map(mapMissionProgress);
  },

  async awardFoodCred(
    action: FoodCredAction,
    relatedEntityId?: string,
    relatedEntityType?: "stall" | "review" | "post" | "collection" | "mission",
    points?: number,
  ): Promise<{ totalPoints: number; levelIndex: number; pointsAwarded: number } | null> {
    if (!isSupabaseConfigured()) return null;
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .rpc("award_food_cred", {
        p_source_action: action,
        p_related_entity_id: relatedEntityId ?? null,
        p_related_entity_type: relatedEntityType ?? null,
        p_points: points ?? null,
      })
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as Row;
    return {
      totalPoints: toNumber(row.total_points),
      levelIndex: toNumber(row.level_index),
      pointsAwarded: toNumber(row.points_awarded),
    };
  },

  async upsertStallInteraction(
    _userId: string,
    stallId: string,
    patch: Partial<Pick<StallInteraction, "isSaved" | "isTried" | "isReviewed">>,
  ): Promise<StallInteraction | null> {
    if (!isSupabaseConfigured()) return null;
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .rpc("upsert_stall_interaction", {
        p_stall_id: stallId,
        p_is_saved: patch.isSaved ?? null,
        p_is_tried: patch.isTried ?? null,
        p_is_reviewed: patch.isReviewed ?? null,
      })
      .maybeSingle();
    if (error) throw error;
    return data ? mapStallInteraction(data as Row) : null;
  },

  async incrementMissionProgress(_userId: string, missionType: MissionType): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.rpc("increment_mission_progress", {
      p_mission_type: missionType,
    });
    if (error) throw error;
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
