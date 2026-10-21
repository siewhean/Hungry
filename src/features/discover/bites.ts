import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { Bite, DataRepository, SearchResult } from "@/lib/services/types";
import type { DishDetail, StallPost } from "@/types/domain";
import { runsPastHour } from "@/utils/operatingHours";

export type DiscoverCollection =
  | "quickBites"
  | "trending"
  | "editorChoice"
  | "budget"
  | "lateNight";

export type DiscoverBiteCollections = Record<DiscoverCollection, Bite[]>;

export const DISCOVER_CUISINE_FILTERS = [
  "All",
  "Local",
  "Halal",
  "Japanese",
  "Western",
  "Noodles",
  "Rice",
  "Spicy",
  "Dessert",
];

/** Dishes cost less than this for the Budget rail and its "See all". */
export const BUDGET_PRICE_CEILING = 8;
/** "Top rated" needs this rating and at least this many reviews behind it. */
export const TOP_RATED_MIN_RATING = 4.4;
export const TOP_RATED_MIN_REVIEWS = 3;
/** The late-night rail shows from 21:00 to 04:00 Singapore time. */
export const LATE_NIGHT_START_HOUR = 21;
export const LATE_NIGHT_END_HOUR = 4;
/** A stall counts as late-night when its listed hours run past this hour. */
const LATE_NIGHT_CLOSING_HOUR = 22;
/** How many stalls the Discover feed (and so every rail and "See all") reads. */
export const DISCOVER_FEED_LIMIT = 100;

/** True from 21:00 to 03:59; pass the Singapore hour, not the device's. */
export function isLateNightHour(hour: number) {
  return hour >= LATE_NIGHT_START_HOUR || hour < LATE_NIGHT_END_HOUR;
}

/** Venue opening hours by venue id, for rails built from a live feed. */
export type VenueHoursLookup = (venueId: string) => string | undefined;

/**
 * Late night = the stall's listed hours run past 22:00. When the hours cannot be
 * read, a dinner flag on the dish is the only signal left.
 */
export function isLateNightDish(
  dish: Pick<DishDetail, "availabilityFlags"> | undefined,
  operatingHours: string | undefined,
) {
  const byHours = runsPastHour(operatingHours, LATE_NIGHT_CLOSING_HOUR);
  if (byHours !== undefined) return byHours;
  return Boolean(dish?.availabilityFlags?.some((flag) => flag.toLowerCase().includes("dinner")));
}

const HUNGRY_LOGO_IMAGE_URL =
  "https://raw.githubusercontent.com/siewhean/Hungry/main/assets/images/Logo/hungry_logo_icon_transparent.png";

const DISCOVER_BLOCKED_IMAGE_HOSTS = [
  "images.unsplash.com",
  "source.unsplash.com",
  "picsum.photos",
  "upload.wikimedia.org",
] as const;

export type DiscoverCardImageSourceType =
  | "dish"
  | "dish_image"
  | "venue"
  | "building"
  | "representative_dish"
  | "local_fallback";

export type DiscoverCardImageCandidate = {
  imageUrl?: string | null;
  imageSourceType: Exclude<DiscoverCardImageSourceType, "local_fallback">;
};

export type DiscoverCardImage = {
  imageUrl: string;
  imageSourceType: DiscoverCardImageSourceType;
  candidateUrls: string[];
};

export function isUsableDiscoverImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes(",") || trimmed === HUNGRY_LOGO_IMAGE_URL) {
    return false;
  }

  let host = "";
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }

  return !DISCOVER_BLOCKED_IMAGE_HOSTS.some(
    (blockedHost) => host === blockedHost || host.endsWith(`.${blockedHost}`),
  );
}

function uniqueUsableImageUrls(candidates: readonly DiscoverCardImageCandidate[]) {
  const urls: string[] = [];
  candidates.forEach(({ imageUrl }) => {
    const trimmed = imageUrl?.trim();
    if (!trimmed || !isUsableDiscoverImageUrl(trimmed) || urls.includes(trimmed)) {
      return;
    }
    urls.push(trimmed);
  });
  return urls;
}

export function getDiscoverCardImage(
  candidates: readonly DiscoverCardImageCandidate[],
): DiscoverCardImage {
  const candidateUrls = uniqueUsableImageUrls(candidates);
  const selected = candidates.find(({ imageUrl }) => {
    const trimmed = imageUrl?.trim();
    return Boolean(trimmed && trimmed === candidateUrls[0]);
  });

  return {
    imageUrl: candidateUrls[0] ?? "",
    imageSourceType: selected?.imageSourceType ?? "local_fallback",
    candidateUrls,
  };
}

export function getDishImageCandidates(
  dish: Pick<DishDetail, "gallery" | "imageUrl">,
  imageSourceType: Exclude<DiscoverCardImageSourceType, "local_fallback"> = "dish",
): DiscoverCardImageCandidate[] {
  return [
    ...(dish.gallery ?? []).map((imageUrl) => ({
      imageUrl,
      imageSourceType: "dish_image" as const,
    })),
    { imageUrl: dish.imageUrl, imageSourceType },
  ];
}

function hasRealDiscoverBiteImage(bite: Bite) {
  return bite.imageSourceType !== "local_fallback" && isUsableDiscoverImageUrl(bite.photoUrl);
}

function sortBitesByImagePriority<T extends Bite>(bites: readonly T[]) {
  return [...bites].sort((left, right) => {
    const imagePriority =
      Number(hasRealDiscoverBiteImage(right)) - Number(hasRealDiscoverBiteImage(left));
    if (imagePriority !== 0) return imagePriority;
    return 0;
  });
}

function slugifyId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseRelativeCreatedAt(value: string | undefined, fallbackIndex: number) {
  if (!value) {
    return new Date(Date.now() - (fallbackIndex + 1) * 30 * 60_000).toISOString();
  }

  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  const relative = value.match(/^(\d+)([hd]) ago$/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unitMs = relative[2].toLowerCase() === "d" ? 86_400_000 : 3_600_000;
    return new Date(Date.now() - amount * unitMs).toISOString();
  }

  return new Date(Date.now() - (fallbackIndex + 1) * 30 * 60_000).toISOString();
}

function findPostForDish(posts: StallPost[], dish: DishDetail) {
  return (
    posts.find((post) => post.dishIds.includes(dish.id)) ??
    posts.find((post) => post.venueId === dish.venueId)
  );
}

function dishToBite(dish: DishDetail, post: StallPost | undefined, index: number): Bite {
  const createdAt = parseRelativeCreatedAt(post?.createdAt, index);
  const image = getDiscoverCardImage(getDishImageCandidates(dish));
  return {
    id: post ? `bite-${post.id}-${dish.id}` : `bite-${dish.id}`,
    authorId: post ? `author-${slugifyId(post.authorName)}` : `venue-${slugifyId(dish.venueName)}`,
    authorName: post?.authorName ?? dish.venueName,
    authorAvatar: post?.authorAvatarUrl ?? image.imageUrl,
    dishId: dish.id,
    dishName: dish.name,
    venueId: dish.venueId,
    venueName: dish.venueName,
    unitNumber: dish.unitNumber,
    buildingId: dish.buildingId,
    buildingName: post?.authorLocation ?? dish.venueName,
    photoUrl: image.imageUrl,
    mediaUrls: image.candidateUrls,
    imageSourceType: image.imageSourceType,
    caption: post?.caption ?? dish.description ?? dish.name,
    tasteStamp: dish.tasteVector,
    cravingCount: dish.reviewCount,
    savedCount: Math.floor(dish.reviewCount / 4),
    rating: dish.rating,
    price: dish.price,
    expiresAt: new Date(new Date(createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt,
  };
}

function listRepositoryDishes(repository: DataRepository) {
  return repository
    .listBuildings()
    .flatMap((building) =>
      repository
        .listVenuesByBuilding(building.id)
        .flatMap((venue) => repository.listDishesByVenue(venue.id)),
    );
}

export function getDiscoverBites(repository: DataRepository = getDataRepository()): Bite[] {
  const posts = repository.listStallPosts();
  return listRepositoryDishes(repository).map((dish, index) =>
    dishToBite(dish, findPostForDish(posts, dish), index),
  );
}

/** One card per stall: the Discover feed gives each stall's top dish. */
export function searchResultToDiscoverBite(result: SearchResult, index: number): Bite {
  const { dish } = result;
  const createdAt = new Date(Date.now() - (index + 1) * 15 * 60_000).toISOString();
  const normalizedRating = Number.isFinite(dish.rating) ? dish.rating : 0;
  const reviewCount = Number.isFinite(dish.reviewCount) ? dish.reviewCount : 0;
  const image = getDiscoverCardImage(getDishImageCandidates(dish));

  return {
    id: `discover-${dish.id}`,
    authorId: `venue-${dish.venueId}`,
    authorName: dish.venueName,
    authorAvatar: image.imageUrl,
    dishId: dish.id,
    dishName: dish.name,
    venueId: dish.venueId,
    venueName: dish.venueName,
    unitNumber: dish.unitNumber,
    buildingId: dish.buildingId,
    buildingName: dish.venueName,
    photoUrl: image.imageUrl,
    mediaUrls: image.candidateUrls,
    imageSourceType: image.imageSourceType,
    caption: dish.description ?? dish.name,
    tasteStamp: dish.tasteVector,
    // Reviews only: "Most reviewed" must not rank on a ranking score.
    cravingCount: reviewCount,
    savedCount: Math.max(0, Math.floor(reviewCount / 4)),
    rating: normalizedRating,
    price: dish.price,
    expiresAt: new Date(new Date(createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt,
    distanceMeters: dish.distanceMeters,
  };
}

/**
 * The bites behind a rail's "See all": the same feed read the Discover rails use,
 * so the list holds the same stalls in the same order. `isFallback` is true when
 * the live read failed and the saved cache answered.
 */
export async function getDiscoverFeedBites(options: {
  areaName?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters: number;
}): Promise<{ bites: Bite[]; venueHours: VenueHoursLookup; isFallback: boolean }> {
  const feed = await getHungryService().discovery.listDiscoveryFeedByLocation({
    areaName: options.areaName,
    lat: options.latitude,
    lng: options.longitude,
    radiusMeters: options.radiusMeters,
    limit: DISCOVER_FEED_LIMIT,
  });
  const hoursByVenueId = new Map(
    (feed?.venues ?? []).map((venue) => [venue.id, venue.operatingHours] as const),
  );
  return {
    bites: (feed?.results ?? []).map(searchResultToDiscoverBite),
    venueHours: (venueId) => hoursByVenueId.get(venueId) || undefined,
    isFallback: Boolean(feed?.isFallback),
  };
}

export function syncBiteWithDish(
  bite: Bite,
  repository: DataRepository = getDataRepository(),
): Bite {
  const dish = repository.getDishById(bite.dishId);
  if (!dish) return bite;
  const image = getDiscoverCardImage(getDishImageCandidates(dish));

  return {
    ...bite,
    buildingId: dish.buildingId,
    dishId: dish.id,
    dishName: dish.name,
    photoUrl: image.imageUrl,
    mediaUrls: image.candidateUrls,
    imageSourceType: image.imageSourceType,
    price: dish.price,
    rating: dish.rating,
    unitNumber: dish.unitNumber,
    venueId: dish.venueId,
    venueName: dish.venueName,
  };
}

/** Distance in metres, or undefined when nothing measured it (never a fake 0m). */
export function getDiscoverBiteDistance(
  bite: Bite,
  repository: DataRepository = getDataRepository(),
): number | undefined {
  const distance = bite.distanceMeters ?? repository.getDishById(bite.dishId)?.distanceMeters;
  return typeof distance === "number" && distance > 0 ? distance : undefined;
}

export function getDiscoverBiteCollection(
  collection: DiscoverCollection,
  bites: Bite[] = getDiscoverBites(),
  repository: DataRepository = getDataRepository(),
  venueHours?: VenueHoursLookup,
) {
  return getDiscoverBiteCollections(bites, repository, venueHours)[collection];
}

export function getDiscoverBiteCollections(
  bites: Bite[] = getDiscoverBites(),
  repository: DataRepository = getDataRepository(),
  venueHours: VenueHoursLookup = (venueId) => repository.getVenueById?.(venueId)?.operatingHours,
): DiscoverBiteCollections {
  const syncedBites = bites.map((bite) => {
    const dish = repository.getDishById(bite.dishId);
    if (!dish) {
      const image = getDiscoverCardImage([
        { imageUrl: bite.photoUrl, imageSourceType: "dish" },
        ...(bite.mediaUrls ?? []).map((imageUrl) => ({
          imageUrl,
          imageSourceType: "dish_image" as const,
        })),
      ]);
      return {
        bite: {
          ...bite,
          photoUrl: image.imageUrl,
          mediaUrls: image.candidateUrls,
          imageSourceType: image.imageSourceType,
        },
        dish: undefined,
      };
    }

    const image = getDiscoverCardImage(getDishImageCandidates(dish));
    return {
      bite: {
        ...bite,
        buildingId: dish.buildingId,
        dishId: dish.id,
        dishName: dish.name,
        photoUrl: image.imageUrl,
        mediaUrls: image.candidateUrls,
        imageSourceType: image.imageSourceType,
        price: dish.price,
        rating: dish.rating,
        cravingCount: dish.reviewCount,
        unitNumber: dish.unitNumber,
        venueId: dish.venueId,
        venueName: dish.venueName,
      },
      dish,
    };
  });
  const bitesWithImages = syncedBites.map(({ bite }) => bite);
  const imagePriorityBites = sortBitesByImagePriority(bitesWithImages);

  const lateNight = syncedBites
    .filter(({ bite, dish }) => isLateNightDish(dish, venueHours(bite.venueId)))
    .map(({ bite }) => bite);

  return {
    // Every dish near the diner, photos first. The rail is called "Near you".
    quickBites: imagePriorityBites,
    budget: sortBitesByImagePriority(
      bitesWithImages.filter((bite) => bite.price < BUDGET_PRICE_CEILING),
    ),
    // A rating only counts with some reviews behind it: one 5-star review is not "top rated".
    editorChoice: sortBitesByImagePriority(
      bitesWithImages.filter(
        (bite) => bite.rating >= TOP_RATED_MIN_RATING && bite.cravingCount >= TOP_RATED_MIN_REVIEWS,
      ),
    ),
    // Review count only; a dish with no reviews is not "most reviewed".
    trending: bitesWithImages
      .filter((bite) => bite.cravingCount > 0)
      .sort((a, b) => b.cravingCount - a.cravingCount || b.rating - a.rating),
    lateNight: sortBitesByImagePriority(lateNight),
  };
}
