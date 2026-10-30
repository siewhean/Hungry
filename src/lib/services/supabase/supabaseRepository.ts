import { runRecommendationPipeline } from "@/lib/ai/tasteEngine";
import { getDistanceMetersFromBuildingId } from "@/lib/geo/distance";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/services/supabase/client";
import { validateOpeningSchedule } from "@/utils/openingSchedule";
import type {
  BuildingDetail,
  DataRepository,
  DiscoveryLocationFeed,
  DiscoveryLocationFeedRequest,
  SavedDishCard,
  SearchResult,
  VenueLocationSearchRequest,
  VenueMenuCursor,
  VenueMenuPage,
} from "@/lib/services/types";
import type {
  BlogPost,
  BuildingSummary,
  DishDetail,
  DietaryFlag,
  FoodCredAction,
  MissionType,
  OpeningSchedule,
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
  tasteConfidence?: number;
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

/**
 * Whether a raw `dishes` row may appear in the diner catalog cache. A dish the merchant removed
 * from the menu keeps its row (archived_at set) so reviews and saves survive; it must not show.
 */
export function isCatalogMenuDisplayable(row: Row): boolean {
  const rightsStatus = toString(row.menu_rights_status, "unverified");
  const sourceUrl = toString(row.menu_source_url);
  return (
    (row.archived_at === null || row.archived_at === undefined || row.archived_at === "") &&
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
// Built once per catalog load, so per-venue lookups don't scan every dish.
let dishesByVenueIndex: { source: DishDetail[]; byVenueId: Map<string, DishDetail[]> } | null =
  null;

function getDishesByVenueIndex(): Map<string, DishDetail[]> {
  if (!dishesByVenueIndex || dishesByVenueIndex.source !== cachedDishes) {
    const byVenueId = new Map<string, DishDetail[]>();
    cachedDishes.forEach((dish) => {
      const list = byVenueId.get(dish.venueId);
      if (list) list.push(dish);
      else byVenueId.set(dish.venueId, [dish]);
    });
    dishesByVenueIndex = { source: cachedDishes, byVenueId };
  }
  return dishesByVenueIndex.byVenueId;
}

// Detail screens look up by id on every render: index the caches instead of scanning.
let venueByIdIndex: { source: VenueSummary[]; byId: Map<string, VenueSummary> } | null = null;
let dishByIdIndex: { source: DishDetail[]; byId: Map<string, DishDetail> } | null = null;

function getVenueByIdIndex(): Map<string, VenueSummary> {
  if (!venueByIdIndex || venueByIdIndex.source !== cachedVenues) {
    venueByIdIndex = {
      source: cachedVenues,
      byId: new Map(cachedVenues.map((venue) => [venue.id, venue])),
    };
  }
  return venueByIdIndex.byId;
}

let venuesByBuildingIndex: {
  source: VenueSummary[];
  byBuilding: Map<string, VenueSummary[]>;
} | null = null;

function getVenuesByBuildingIndex(): Map<string, VenueSummary[]> {
  if (!venuesByBuildingIndex || venuesByBuildingIndex.source !== cachedVenues) {
    const byBuilding = new Map<string, VenueSummary[]>();
    for (const venue of cachedVenues) {
      const list = byBuilding.get(venue.buildingId);
      if (list) list.push(venue);
      else byBuilding.set(venue.buildingId, [venue]);
    }
    venuesByBuildingIndex = { source: cachedVenues, byBuilding };
  }
  return venuesByBuildingIndex.byBuilding;
}

function getDishByIdIndex(): Map<string, DishDetail> {
  if (!dishByIdIndex || dishByIdIndex.source !== cachedDishes) {
    dishByIdIndex = {
      source: cachedDishes,
      byId: new Map(cachedDishes.map((dish) => [dish.id, dish])),
    };
  }
  return dishByIdIndex.byId;
}
let cachedStallPosts: StallPost[] = [];

const REFRESH_TTL_MS = 45_000;
const CACHED_POST_LIMIT = 100;

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
    logoUrl: toString(row.logo_url) || undefined,
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
    foodTypeTag: toString(row.food_type) || undefined,
    ...(row.course ? { course: toString(row.course) } : {}),
    ...(toStringArray(row.cuisine_tags).length
      ? { cuisineTags: toStringArray(row.cuisine_tags) }
      : {}),
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
    tasteConfidence: presentation?.tasteConfidence,
    dietaryFlags: presentation?.dietaryFlags ?? [],
    gallery: gallery.length > 0 ? gallery : imageUrl ? [imageUrl] : [],
    description: toString(row.description) || undefined,
    mustOrder: toBool(row.must_order),
    availabilityFlags: toStringArray(row.availability_flags),
    reviews: [],
    updatedAt: toString(row.updated_at) || undefined,
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
    // get_dish_detail returns null for seed/curated vectors (fully trusted).
    tasteConfidence:
      row.taste_confidence === null || row.taste_confidence === undefined
        ? undefined
        : toNumber(row.taste_confidence),
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

/**
 * A dish card from a get_taste_recommendations row (the RPC returns what a card shows, so no
 * catalog download is needed to show the first picks). The photo is already rights-checked and
 * the stall pin is the venue's own, else its building's.
 */
export function mapTasteCardRow(row: Row): DishDetail {
  const image = toString(row.image_url);
  const dish = mapRpcDish({ ...row, gallery: image ? [image] : [] });
  const latitude = toOptionalCoordinate(row.latitude);
  const longitude = toOptionalCoordinate(row.longitude);
  return latitude !== undefined && longitude !== undefined
    ? { ...dish, venuePin: { latitude, longitude } }
    : dish;
}

/** A weekly schedule from the venues.opening_schedule column; undefined when absent or malformed. */
function toVenueOpeningSchedule(value: unknown): OpeningSchedule | undefined {
  const record = toRecord(value);
  if (!record.weekly || typeof record.weekly !== "object" || Array.isArray(record.weekly)) {
    return undefined;
  }
  const schedule: OpeningSchedule = {
    weekly: record.weekly as OpeningSchedule["weekly"],
    special: Array.isArray(record.special) ? (record.special as OpeningSchedule["special"]) : [],
  };
  try {
    return validateOpeningSchedule(schedule) ? undefined : schedule;
  } catch {
    return undefined;
  }
}

function toOptionalCoordinate(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number !== 0 ? number : undefined;
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
    // get_venue_detail sends the already-checked photo as display_image_url.
    imageUrl: toString(row.display_image_url).trim() || catalogDisplayImageUrl(row) || undefined,
    logoUrl: toString(row.logo_url) || undefined,
    buildingName: toString(row.building_name, toString(building.name)) || undefined,
    address: toString(row.address, toString(building.address)) || undefined,
    postalCode: toString(row.postal_code, toString(building.postalCode)) || undefined,
    openingSchedule: toVenueOpeningSchedule(row.opening_schedule),
    latitude: toOptionalCoordinate(row.latitude),
    longitude: toOptionalCoordinate(row.longitude),
  };
}

function mapLocationSearchVenue(row: Row): VenueSummary {
  return {
    ...mapRpcVenue({
      ...row,
      delivery_links: [],
    }),
    logoUrl: toString(row.logo_url) || undefined,
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
    // Real hours (get_discovery_feed_by_location returns them), so open state is
    // worked out in Singapore time instead of read from the stored is_open copy.
    operatingHours: toString(row.operating_hours),
    closureNotice: undefined,
    deliveryLinks: [],
    planningArea: toString(row.planning_area) || undefined,
    imageUrl: toString(row.venue_image_url) || toString(row.building_image_url) || undefined,
    logoUrl: toString(row.venue_logo_url, toString(row.logo_url)) || undefined,
    buildingName: toString(row.building_name) || undefined,
    distanceMeters: row.distance_meters == null ? undefined : toNumber(row.distance_meters),
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
    // Discover's Halal and Dietary Needs chips read these flags on the stall's top dish.
    { gallery, dietaryFlags: toStringArray(row.top_dish_dietary_flags) as DietaryFlag[] },
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
  author?: Row,
): StallPost {
  const meta = toRecord(row.generated_content);
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
    authorName: toString(author?.display_name) || "Hungry User",
    authorLocation: venue?.name || toString(venueMeta.name) || building?.name || "",
    authorAvatarUrl: toString(author?.avatar_url) || mediaUrl,
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
    const presentation = ensurePresentation(dishId);
    presentation.tasteVector = mapTasteVector(row);
    // Confidence only describes AI-tagged vectors. Seed/curated ('default') vectors and older
    // databases without the column are fully trusted.
    presentation.tasteConfidence =
      row.confidence == null || toString(row.source) === "default"
        ? undefined
        : toNumber(row.confidence);
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

// The viewer's saved and liked posts can be older than the newest
// CACHED_POST_LIMIT; load them too so Saved/Liked grids and their detail views
// keep working.
async function loadViewerReactedPostRows(
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
  alreadyLoadedIds: Set<string>,
): Promise<Row[]> {
  const { data: sessionData } = await client.auth.getSession();
  const viewerId = sessionData.session?.user?.id;
  if (!viewerId) return [];
  const [savesResult, likesResult] = await Promise.all([
    client.from("post_saves").select("post_id").eq("user_id", viewerId),
    client.from("post_likes").select("post_id").eq("user_id", viewerId),
  ]);
  const reactedIds = new Set<string>();
  for (const result of [savesResult, likesResult]) {
    if (!Array.isArray(result.data) || result.error) continue;
    for (const row of result.data as unknown as Row[]) {
      const postId = toString(row.post_id);
      if (postId && !alreadyLoadedIds.has(postId)) reactedIds.add(postId);
    }
  }
  if (reactedIds.size === 0) return [];
  const { data, error } = await client
    .from("posts")
    .select("*")
    .in("id", [...reactedIds])
    .eq("status", "published")
    .is("deleted_at", null);
  return Array.isArray(data) && !error ? (data as unknown as Row[]) : [];
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
        stallResult,
        postsResult,
        hiddenPostsResult,
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
        client.from("dish_taste_vectors").select("*"),
        client.from("dish_dietary_flags").select("dish_id,dietary_flag_id"),
        client.from("dietary_flags").select("id,slug"),
        client.from("stall_posts").select("*"),
        // Bounded: only the newest posts are cached for detail lookups. The Home
        // feed itself reads the paged RPC.
        client
          .from("posts")
          .select("*")
          .eq("status", "published")
          .is("deleted_at", null)
          .order("published_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(CACHED_POST_LIMIT),
        // RLS returns only the viewer's own hides (none when signed out).
        client.from("hidden_posts").select("post_id"),
      ]);
      const hiddenPostIds = new Set(
        Array.isArray(hiddenPostsResult.data) && !hiddenPostsResult.error
          ? (hiddenPostsResult.data as unknown as Row[]).map((row) => toString(row.post_id))
          : [],
      );
      const recentPostRows =
        Array.isArray(postsResult.data) && !postsResult.error
          ? (postsResult.data as unknown as Row[])
          : [];
      const viewerPostRows = await loadViewerReactedPostRows(
        client,
        new Set(recentPostRows.map((row) => toString(row.id))),
      );
      const cachedPostRows = [...recentPostRows, ...viewerPostRows];
      const cachedPostIds = cachedPostRows.map((row) => toString(row.id)).filter(Boolean);
      // Media only for the cached posts, not the whole table.
      const postMediaResult =
        cachedPostIds.length > 0
          ? await client
              .from("post_media")
              .select("*")
              .in("post_id", cachedPostIds)
              .order("sort_order", { ascending: true })
          : { data: [] as Row[], error: null };
      // Post authors come from their profile, never from client-written generated_content.
      const cachedAuthorIds = [
        ...new Set(cachedPostRows.map((row) => toString(row.author_id)).filter(Boolean)),
      ];
      const postAuthorsResult =
        cachedAuthorIds.length > 0
          ? await client
              .from("public_profiles")
              .select("id,display_name,avatar_url")
              .in("id", cachedAuthorIds)
          : { data: [] as Row[], error: null };
      const postAuthorById = new Map(
        (Array.isArray(postAuthorsResult.data) && !postAuthorsResult.error
          ? (postAuthorsResult.data as unknown as Row[])
          : []
        ).map((row) => [toString(row.id), row]),
      );

      if (Array.isArray(buildingsResult.data) && !buildingsResult.error) {
        cachedBuildings = (buildingsResult.data as unknown as Row[]).map(mapBuilding);
      }
      let mappedVenues = cachedVenues;
      if (Array.isArray(venuesResult.data) && !venuesResult.error) {
        mappedVenues = (venuesResult.data as unknown as Row[]).map(mapVenue);
        cachedVenues = mappedVenues;
      }
      const venueById = new Map(mappedVenues.map((venue) => [venue.id, venue]));
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
              venueById.get(toString(row.venue_id)),
              presentationByDishId.get(toString(row.id)),
            ),
          );
      }
      const legacyStallPosts =
        Array.isArray(stallResult.data) && !stallResult.error
          ? (stallResult.data as unknown as Row[]).map(mapStallPost)
          : cachedStallPosts;
      if (Array.isArray(postsResult.data) && !postsResult.error) {
        const postRows = cachedPostRows.filter((row) => !hiddenPostIds.has(toString(row.id)));
        const postMediaRows =
          Array.isArray(postMediaResult.data) && !postMediaResult.error
            ? (postMediaResult.data as unknown as Row[])
            : [];
        const mediaByPostId = groupRowsByStringKey(postMediaRows, "post_id");
        const dishById = new Map(cachedDishes.map((dish) => [dish.id, dish]));
        const buildingById = new Map(cachedBuildings.map((building) => [building.id, building]));
        const postStallPosts = postRows.map((row) => {
          const venue = venueById.get(toString(row.venue_id));
          const dish = dishById.get(toString(row.dish_id));
          const building =
            buildingById.get(toString(row.building_id)) ??
            buildingById.get(venue?.buildingId ?? "") ??
            buildingById.get(dish?.buildingId ?? "");
          return mapPostRowToStallPost(
            row,
            mediaByPostId.get(toString(row.id)) ?? [],
            venue,
            building,
            dish,
            postAuthorById.get(toString(row.author_id)),
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
    // Indexed equality on lower(trim(planning_area)); the ILIKE read below is the
    // fallback until the RPC is deployed.
    const { data: areaCount, error: areaCountError } = await client.rpc(
      "count_venues_in_planning_area",
      { p_area_name: normalizedAreaName },
    );
    if (!areaCountError && typeof areaCount === "number" && Number.isFinite(areaCount)) {
      return areaCount;
    }

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
  const hasLocation = typeof filters.latitude === "number" && typeof filters.longitude === "number";
  const query = filters.query.trim();
  const rows = await rpcRows("search_dishes", {
    p_query: query || null,
    p_lat: filters.latitude ?? null,
    p_lng: filters.longitude ?? null,
    // Without a location the RPC would compare the radius against the stored
    // dishes.distance_meters column, which is not the distance from the user.
    // Text queries search everywhere; only location browsing is radius-bound.
    // p_radius_meters is a Postgres integer; a larger "no limit" radius means null.
    p_radius_meters:
      hasLocation && !query && filters.radius > 0 && filters.radius <= 2_147_483_647
        ? Math.round(filters.radius)
        : null,
    p_dietary_flags: filters.dietaryFlags,
    // search_dishes caps p_limit at 50.
    p_limit: Math.min(50, Math.max(1, Math.round(filters.limit ?? 20))),
    p_cursor_score: null,
    p_cursor_id: null,
    p_venue_id: null,
    p_area_name: filters.areaName ?? null,
    p_cuisine_tags: filters.cuisineTags ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_open_only: filters.openOnly ?? false,
    // Sent only when the quiz asked, so a backend without the filters keeps working for search.
    ...(filters.cuisineKeywords?.length ? { p_cuisine_keywords: filters.cuisineKeywords } : {}),
    ...(filters.stapleKeywords?.length ? { p_staple_keywords: filters.stapleKeywords } : {}),
  });
  if (!rows) return undefined;
  return rows.map((row) => ({
    dish: mapRpcDish(row),
    score: toNumber(row.rank_score, similarityScoreFallback(mapRpcDish(row), tasteProfile)),
  }));
}

/**
 * Dietary flag slugs for a set of dishes in two batched reads (the link rows for these ids, and
 * the small flag list). Undefined when either read fails, so the caller keeps what it had.
 */
async function loadDishDietaryFlagsByDishId(
  dishIds: string[],
): Promise<Map<string, string[]> | undefined> {
  const client = getSupabaseClient();
  if (!client || dishIds.length === 0) return undefined;
  const [linkResult, flagResult] = await Promise.all([
    client.from("dish_dietary_flags").select("dish_id,dietary_flag_id").in("dish_id", dishIds),
    client.from("dietary_flags").select("id,slug"),
  ]);
  if (
    linkResult.error ||
    flagResult.error ||
    !Array.isArray(linkResult.data) ||
    !Array.isArray(flagResult.data)
  ) {
    console.warn("Supabase discovery dietary flags read failed");
    return undefined;
  }
  const slugById = new Map(
    (flagResult.data as unknown as Row[]).map((row) => [toString(row.id), toString(row.slug)]),
  );
  const flagsByDishId = new Map<string, string[]>();
  for (const row of linkResult.data as unknown as Row[]) {
    const dishId = toString(row.dish_id);
    const slug = slugById.get(toString(row.dietary_flag_id));
    if (!dishId || !slug) continue;
    const flags = flagsByDishId.get(dishId) ?? [];
    if (!flags.includes(slug)) flags.push(slug);
    flagsByDishId.set(dishId, flags);
  }
  return flagsByDishId;
}

export async function listDiscoveryFeedByLocationViaRpc(
  request: DiscoveryLocationFeedRequest,
): Promise<DiscoveryLocationFeed | undefined> {
  let rows = await rpcRows("get_discovery_feed_by_location", {
    p_area_name: request.areaName?.trim() || null,
    p_lat: request.lat ?? null,
    p_lng: request.lng ?? null,
    p_radius_meters: request.radiusMeters ?? null,
    p_limit: request.limit ?? null,
    // Sent only inside a place, so everyone else keeps working against the older signature.
    ...(request.buildingId ? { p_building_id: request.buildingId } : {}),
  });
  if (!rows) return undefined;

  // 20261021190000 rebuilt the feed without top_dish_dietary_flags (still missing in
  // 20261022040100), so the Halal and Dietary needs chips matched nothing on live data. While
  // the column is missing, this page's top-dish flags come from one batched read.
  if (rows.length > 0 && !rows.some((row) => "top_dish_dietary_flags" in row)) {
    const dishIds = [...new Set(rows.map((row) => toString(row.top_dish_id)).filter(Boolean))];
    const flagsByDishId = await loadDishDietaryFlagsByDishId(dishIds);
    if (flagsByDishId) {
      rows = rows.map((row) => ({
        ...row,
        top_dish_dietary_flags: flagsByDishId.get(toString(row.top_dish_id)) ?? [],
      }));
    }
  }

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
  return rows?.map(mapLocationSearchVenue);
}

/**
 * Undefined means "no such dish". Throws when the configured RPC itself failed,
 * so a network error is never shown as "this dish was removed".
 */
export async function getDishByIdViaRpc(dishId: string): Promise<DishDetail | undefined> {
  const rows = await rpcRows("get_dish_detail", { p_dish_id: dishId });
  if (!rows && isSupabaseConfigured() && getSupabaseClient()) {
    throw new Error("Couldn't load this dish.");
  }
  return rows?.[0] ? mapRpcDish(rows[0]) : undefined;
}

/** search_dishes caps a page at 50 rows. */
const VENUE_MENU_PAGE_SIZE = 50;
/** Up to 500 menu items per stall (1 embedded page + 9 more). */
const VENUE_MENU_MAX_EXTRA_PAGES = 9;

/** How long one get_venue_detail result is reused (venue + menu on the same open). */
const VENUE_DETAIL_REUSE_MS = 30_000;
const venueDetailRequests = new Map<string, { at: number; rows: Promise<Row[] | undefined> }>();

/** getVenue and listDishesByVenue share one get_venue_detail call per stall open. */
function getVenueDetailRows(venueId: string): Promise<Row[] | undefined> {
  const now = Date.now();
  const cached = venueDetailRequests.get(venueId);
  if (cached && now - cached.at < VENUE_DETAIL_REUSE_MS) return cached.rows;
  const rows = rpcRows("get_venue_detail", { p_venue_id: venueId }).then((result) => {
    // Never reuse a failure: the next open retries.
    if (!result) venueDetailRequests.delete(venueId);
    return result;
  });
  venueDetailRequests.set(venueId, { at: now, rows });
  return rows;
}

/** Forgets the reused get_venue_detail result, so the next read of that stall is fresh. */
export function invalidateVenueDetail(venueId: string): void {
  venueDetailRequests.delete(venueId);
}

/**
 * The merchant reads get_venue_detail returns with the stall (profile, promotions, own claim
 * status), when that call is already in flight or fresh for this stall. Undefined means "ask the
 * separate RPCs": no detail call was made (a dish page asking about its stall), the call failed,
 * or the database predates the columns. Never starts a get_venue_detail call of its own: it embeds
 * a 50-dish page.
 */
export async function getInlineMerchantReads(venueId: string): Promise<
  | {
      profile: Row | null;
      promotions: Row[];
      claimStatus: string | null;
    }
  | undefined
> {
  const cached = venueDetailRequests.get(venueId);
  if (!cached || Date.now() - cached.at >= VENUE_DETAIL_REUSE_MS) return undefined;
  const row = (await cached.rows)?.[0];
  if (!row || !("merchant_profile" in row)) return undefined;
  const profile = row.merchant_profile;
  const promotions = row.active_promotions;
  const claimStatus = row.claim_status;
  return {
    profile: profile && typeof profile === "object" ? (profile as Row) : null,
    promotions: Array.isArray(promotions) ? (promotions as Row[]) : [],
    claimStatus: typeof claimStatus === "string" ? claimStatus : null,
  };
}

/** Throws when the configured get_venue_detail RPC failed (offline, timeout). */
async function getVenueDetailRowsOrThrow(venueId: string): Promise<Row[] | undefined> {
  const rows = await getVenueDetailRows(venueId);
  if (!rows && isSupabaseConfigured() && getSupabaseClient()) {
    throw new Error("Couldn't load this stall.");
  }
  return rows;
}

/**
 * Undefined means "no such stall". Throws when the configured RPC failed, so a
 * network error is never shown as "Stall not found".
 */
export async function getVenueByIdViaRpc(venueId: string): Promise<VenueSummary | undefined> {
  const rows = await getVenueDetailRowsOrThrow(venueId);
  return rows?.[0] ? mapRpcVenue(rows[0]) : undefined;
}

const VENUE_SUMMARIES_BATCH = 50;

/**
 * Stall summaries for many ids (up to 50) in one get_venue_summaries call (no menus). Undefined
 * when Supabase is not configured. Throws when the configured RPC failed (offline, rate cap), so
 * callers show a retry instead of treating every stall as closed or gone.
 */
export async function getVenuesByIdsViaRpc(
  venueIds: string[],
): Promise<VenueSummary[] | undefined> {
  const unique = [...new Set(venueIds)];
  if (unique.length === 0) return [];
  // The RPC reads at most 50 stalls, so a longer list (a big Saved list) goes out as a few
  // calls, side by side, instead of dropping the rest as "may have closed".
  const chunks: string[][] = [];
  for (let start = 0; start < unique.length; start += VENUE_SUMMARIES_BATCH) {
    chunks.push(unique.slice(start, start + VENUE_SUMMARIES_BATCH));
  }
  const results = await Promise.all(
    chunks.map((ids) =>
      // n-plus-one-ok: one call per 50 ids, the RPC's own cap, issued together
      rpcRows("get_venue_summaries", { p_venue_ids: ids }),
    ),
  );
  if (results.some((rows) => !rows)) {
    if (isSupabaseConfigured() && getSupabaseClient())
      throw new Error("Couldn't load these stalls.");
    return undefined;
  }
  return results.flatMap((rows) => (rows ?? []).map(mapRpcVenue));
}

/** Name, photo, stall and price for many dishes and stalls in one get_item_details call. */
export async function getItemDetailsViaRpc(input: {
  dishIds: string[];
  stallIds: string[];
}): Promise<Row[] | undefined> {
  const dishIds = [...new Set(input.dishIds)];
  const stallIds = [...new Set(input.stallIds)];
  if (dishIds.length === 0 && stallIds.length === 0) return [];
  // The RPC reads at most 200 of each kind, so a longer list (a profile with hundreds of
  // reviews) goes out as a few calls, side by side, instead of dropping the rest.
  const chunks: { dishes: string[]; stalls: string[] }[] = [];
  for (let start = 0; start < Math.max(dishIds.length, stallIds.length); start += 200) {
    chunks.push({
      dishes: dishIds.slice(start, start + 200),
      stalls: stallIds.slice(start, start + 200),
    });
  }
  const results = await Promise.all(
    chunks.map(({ dishes, stalls }) =>
      // n-plus-one-ok: one call per 200 ids, the RPC's own cap, issued together
      rpcRows("get_item_details", { p_dish_ids: dishes, p_stall_ids: stalls }),
    ),
  );
  if (results.some((rows) => !rows)) return undefined;
  return results.flatMap((rows) => rows ?? []);
}

/** get_item_details and get_venue_summaries read at most this many ids per call. */
const DISH_BATCH_SIZE = 200;
const VENUE_BATCH_SIZE = 50;

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += size)
    chunks.push(ids.slice(start, start + size));
  return chunks;
}

/**
 * Saved-dish cards in a few batched reads: names, photos and prices (get_item_details), each
 * dish's stall and rating (one table read per 200 dishes) and the stalls' places
 * (get_venue_summaries per 50). Never one request per dish. Dishes that are gone are left out.
 * Undefined when any read fails, so the page shows a retry instead of a short list.
 */
export async function getSavedDishCardsViaRpc(
  dishIds: string[],
): Promise<SavedDishCard[] | undefined> {
  const ids = [...new Set(dishIds)];
  if (ids.length === 0) return [];
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return undefined;
  const details = await getItemDetailsViaRpc({ dishIds: ids, stallIds: [] });
  if (!details) return undefined;

  const refResults = await Promise.all(
    chunkIds(ids, DISH_BATCH_SIZE).map((chunk) =>
      // n-plus-one-ok: one read per 200 ids, issued together
      client.from("dishes").select("id,venue_id,rating_avg,review_count").in("id", chunk),
    ),
  );
  const refs = new Map<string, Row>();
  for (const result of refResults) {
    if (result.error || !Array.isArray(result.data)) return undefined;
    for (const row of result.data as Row[]) refs.set(toString(row.id), row);
  }

  const venueIds = [
    ...new Set([...refs.values()].map((row) => toString(row.venue_id)).filter(Boolean)),
  ];
  const venueResults = await Promise.all(
    chunkIds(venueIds, VENUE_BATCH_SIZE).map((chunk) =>
      // n-plus-one-ok: get_venue_summaries caps 50 ids per call, so larger sets go in chunks
      rpcRows("get_venue_summaries", { p_venue_ids: chunk }),
    ),
  );
  if (venueResults.some((rows) => !rows)) return undefined;
  const venueRows = new Map<string, Row>(
    venueResults.flatMap((rows) => rows ?? []).map((row) => [toString(row.venue_id), row]),
  );

  return details.flatMap((detail) => {
    const id = toString(detail.dish_id);
    const ref = refs.get(id);
    if (!id || !ref) return [];
    const venueId = toString(ref.venue_id) || undefined;
    const venueRow = venueId ? venueRows.get(venueId) : undefined;
    const venue = venueRow ? mapRpcVenue(venueRow) : undefined;
    const building = toRecord(venueRow?.building);
    const reviewCount = toNumber(ref.review_count);
    return [
      {
        id,
        name: toString(detail.name),
        venueId,
        venueName: toString(detail.stall_name) || venue?.name,
        buildingName: venue?.buildingName,
        unitNumber: venue?.unitNumber || undefined,
        address: venue?.address,
        postalCode: venue?.postalCode,
        price:
          detail.price === null || detail.price === undefined ? undefined : Number(detail.price),
        imageUrl: toString(detail.image_url) || undefined,
        rating: reviewCount > 0 ? toNumber(ref.rating_avg) : undefined,
        reviewCount,
        isOpen: venue?.isOpen,
        // The stall's own point, else its building's (the summary's building carries both).
        latitude: venue?.latitude ?? toOptionalCoordinate(building.latitude),
        longitude: venue?.longitude ?? toOptionalCoordinate(building.longitude),
      } satisfies SavedDishCard,
    ];
  });
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

/**
 * search_dishes rows put the stall photo in image_url/gallery when the dish has
 * none. A dish without its own photo shows NoDishPhoto, never the stall photo.
 */
function withoutVenuePhotoFallback(row: Row, venueImageUrl: string): Row {
  if (!venueImageUrl) return row;
  const gallery = toStringArray(row.gallery).filter((url) => url !== venueImageUrl);
  return {
    ...row,
    image_url: toString(row.image_url) === venueImageUrl ? null : row.image_url,
    gallery,
  };
}

/** Throws when the configured RPC failed, so offline never reads as "No menu". */
export async function listDishesByVenueViaRpc(venueId: string): Promise<DishDetail[] | undefined> {
  const rows = await getVenueDetailRowsOrThrow(venueId);
  const venue = rows?.[0];
  if (!venue) return rows ? [] : undefined;
  // Copy: the venue row is shared with getVenue through the request cache.
  const dishRows = [...toRowArray(venue.dishes)];
  // get_venue_detail embeds one search_dishes page (50). A full page means the menu
  // may be longer: keep reading pages with the same keyset cursor so no dish is lost.
  const seen = new Set(dishRows.map((row) => toString(row.dish_id)));
  let lastPage = dishRows;
  for (let index = 0; index < VENUE_MENU_MAX_EXTRA_PAGES; index += 1) {
    if (lastPage.length < VENUE_MENU_PAGE_SIZE) break;
    const last = lastPage[lastPage.length - 1];
    const next = await rpcRows("search_dishes", {
      p_query: null,
      p_lat: null,
      p_lng: null,
      p_radius_meters: null,
      p_dietary_flags: [],
      p_limit: VENUE_MENU_PAGE_SIZE,
      p_cursor_score: toNumber(last.cursor_score ?? last.rank_score),
      p_cursor_id: toString(last.cursor_id ?? last.dish_id),
      p_venue_id: venueId,
      p_area_name: null,
      p_cuisine_tags: null,
      p_max_price: null,
      p_open_only: false,
    });
    if (!next || next.length === 0) break;
    const fresh = next.filter((row) => !seen.has(toString(row.dish_id)));
    if (fresh.length === 0) break;
    fresh.forEach((row) => seen.add(toString(row.dish_id)));
    dishRows.push(...fresh);
    lastPage = next;
  }
  const venueImageUrl = catalogDisplayImageUrl(venue);
  return dishRows.map((row) => mapRpcDish(withoutVenuePhotoFallback(row, venueImageUrl)));
}

function venueMenuCursor(row: Row, venueImageUrl: string): VenueMenuCursor {
  return {
    score: toNumber(row.cursor_score ?? row.rank_score),
    id: toString(row.cursor_id ?? row.dish_id),
    venueImageUrl: venueImageUrl || undefined,
  };
}

/**
 * One page of a stall's menu. No cursor: the page embedded in get_venue_detail (shared with
 * getVenue). With a cursor: the next search_dishes page. A failed page throws, so the caller
 * can say the menu is incomplete instead of showing a short menu as the whole thing.
 * Undefined when Supabase is not configured.
 */
export async function listDishesByVenuePageViaRpc(
  venueId: string,
  cursor?: VenueMenuCursor,
): Promise<VenueMenuPage | undefined> {
  if (!cursor) {
    const rows = await getVenueDetailRowsOrThrow(venueId);
    const venue = rows?.[0];
    if (!venue) return rows ? { dishes: [] } : undefined;
    const dishRows = toRowArray(venue.dishes);
    const venueImageUrl = catalogDisplayImageUrl(venue);
    const last = dishRows[dishRows.length - 1];
    return {
      dishes: dishRows.map((row) => mapRpcDish(withoutVenuePhotoFallback(row, venueImageUrl))),
      nextCursor:
        last && dishRows.length >= VENUE_MENU_PAGE_SIZE
          ? venueMenuCursor(last, venueImageUrl)
          : undefined,
    };
  }
  if (!isSupabaseConfigured()) return undefined;
  const client = getSupabaseClient();
  if (!client) return undefined;
  const { data, error } = await client.rpc("search_dishes", {
    p_query: null,
    p_lat: null,
    p_lng: null,
    p_radius_meters: null,
    p_dietary_flags: [],
    p_limit: VENUE_MENU_PAGE_SIZE,
    p_cursor_score: cursor.score,
    p_cursor_id: cursor.id,
    p_venue_id: venueId,
    p_area_name: null,
    p_cuisine_tags: null,
    p_max_price: null,
    p_open_only: false,
  });
  if (error) throw error;
  const pageRows = Array.isArray(data) ? (data as unknown as Row[]) : [];
  const venueImageUrl = cursor.venueImageUrl ?? "";
  const last = pageRows[pageRows.length - 1];
  return {
    dishes: pageRows.map((row) => mapRpcDish(withoutVenuePhotoFallback(row, venueImageUrl))),
    nextCursor:
      last && pageRows.length >= VENUE_MENU_PAGE_SIZE
        ? venueMenuCursor(last, venueImageUrl)
        : undefined,
  };
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
    return [...(getVenuesByBuildingIndex().get(buildingId) ?? [])];
  },

  getVenueById(venueId: string): VenueSummary | undefined {
    ensureHydrated();
    return getVenueByIdIndex().get(venueId);
  },

  getDishById(dishId: string): DishDetail | undefined {
    ensureHydrated();
    return getDishByIdIndex().get(dishId);
  },

  listDishesByVenue(venueId: string): DishDetail[] {
    ensureHydrated();
    return [...(getDishesByVenueIndex().get(venueId) ?? [])];
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
    // dishes.distance_meters is a stored column, not the distance from the user.
    // When the caller passes a location, measure from the dish's building instead.
    const origin =
      typeof filters.latitude === "number" && typeof filters.longitude === "number"
        ? { latitude: filters.latitude, longitude: filters.longitude }
        : undefined;
    const buildingCoordinatesById = new Map(
      origin
        ? cachedBuildings
            .filter(({ coordinate }) => coordinate.latitude !== 0 || coordinate.longitude !== 0)
            .map((building) => [building.id, building.coordinate])
        : [],
    );
    const locatedDishes = origin
      ? cachedDishes.map((dish) => ({
          ...dish,
          distanceMeters: getDistanceMetersFromBuildingId(
            origin,
            dish.buildingId,
            buildingCoordinatesById,
            dish.distanceMeters,
          ),
        }))
      : cachedDishes;
    const matched = locatedDishes.filter((dish) => {
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

  /** Reads was removed; blog posts are no longer fetched on hydrate. */
  listBlogPosts(): BlogPost[] {
    return [];
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

export function invalidateSupabaseRepositoryCache(): void {
  hydrated = false;
  hydratedAt = 0;
  void refreshCache(true);
}

/**
 * Reload only one venue's dishes into the cache. A merchant dish save changes that venue's menu
 * and nothing else, so it does not need the whole catalog, posts and blog download again.
 */
export async function refreshSupabaseRepositoryVenueDishes(venueId: string): Promise<void> {
  if (!venueId || !isSupabaseConfigured()) return;
  // Nothing cached yet: the first full hydration will load this venue with everything else.
  if (!hydrated) return;
  const client = getSupabaseClient();
  if (!client) return;
  const dishesResult = await client.from("dishes").select("*").eq("venue_id", venueId);
  if (dishesResult.error || !Array.isArray(dishesResult.data)) {
    // Fall back to the full reload rather than leave a stale menu.
    await refreshSupabaseRepositoryCache();
    return;
  }
  const dishRows = (dishesResult.data as unknown as Row[]).filter(isCatalogMenuDisplayable);
  const dishIds = dishRows.map((row) => toString(row.id)).filter(Boolean);
  const [imagesResult, tasteResult, dishFlagsResult, flagsResult] =
    dishIds.length > 0
      ? await Promise.all([
          client
            .from("dish_images")
            .select(
              "dish_id,url,sort_order,media_approved_for_display,media_rights_status,media_source_url",
            )
            .in("dish_id", dishIds)
            .order("sort_order"),
          client.from("dish_taste_vectors").select("*").in("dish_id", dishIds),
          client
            .from("dish_dietary_flags")
            .select("dish_id,dietary_flag_id")
            .in("dish_id", dishIds),
          client.from("dietary_flags").select("id,slug"),
        ])
      : [null, null, null, null];
  const rowsOf = (result: { data: unknown; error: unknown } | null): Row[] =>
    result && Array.isArray(result.data) && !result.error ? (result.data as unknown as Row[]) : [];
  const presentationByDishId = buildDishPresentationMap(
    rowsOf(imagesResult),
    rowsOf(tasteResult),
    rowsOf(dishFlagsResult),
    rowsOf(flagsResult),
  );
  const venue = cachedVenues.find((candidate) => candidate.id === venueId);
  const mapped = dishRows.map((row) =>
    mapDish(row, venue, presentationByDishId.get(toString(row.id))),
  );
  cachedDishes = [...cachedDishes.filter((dish) => dish.venueId !== venueId), ...mapped];
}

export async function refreshSupabaseRepositoryCache(): Promise<void> {
  hydrated = false;
  hydratedAt = 0;
  await refreshCache(true);
}

export const supabaseRepository: DataRepository = supabaseRepositoryImpl;
