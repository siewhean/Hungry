import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { Bite, DataRepository } from "@/lib/services/types";
import type {
  DietaryFlag,
  DishDetail,
  SearchCategory,
  StallPost,
  TasteVector,
} from "@/types/domain";

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

const COLLECTION_SEARCH_CATEGORIES: Record<DiscoverCollection, SearchCategory[]> = {
  quickBites: ["local favourites"],
  trending: ["local favourites"],
  editorChoice: ["local favourites"],
  budget: ["local favourites"],
  lateNight: ["late night"],
};

const COLLECTION_SEARCH_QUERY: Record<DiscoverCollection, string> = {
  quickBites: "",
  trending: "",
  editorChoice: "",
  budget: "",
  lateNight: "late night",
};

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

export async function getDiscoverBitesFromSearch(
  collection: DiscoverCollection,
  options: {
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    tasteVector?: TasteVector;
    dietaryFlags?: DietaryFlag[];
  } = {},
): Promise<Bite[]> {
  const tasteVector = options.tasteVector ?? NEUTRAL_TASTE_VECTOR;
  const maxPrice = collection === "budget" ? 8 : undefined;
  const results = await getHungryService().discovery.searchDishes(
    {
      query: COLLECTION_SEARCH_QUERY[collection],
      categories: COLLECTION_SEARCH_CATEGORIES[collection],
      dietaryFlags: options.dietaryFlags ?? [],
      tasteValues: tasteVector,
      radius: options.radiusMeters ?? 3000,
      latitude: options.latitude,
      longitude: options.longitude,
      maxPrice,
      openOnly: collection === "lateNight" ? false : undefined,
    },
    tasteVector,
  );

  return results
    .map((result) => result.dish)
    .filter((dish) => (maxPrice ? dish.price <= maxPrice : true))
    .map((dish, index) => dishToBite(dish, undefined, index));
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

export function getDiscoverBiteDistance(
  bite: Bite,
  repository: DataRepository = getDataRepository(),
) {
  return repository.getDishById(bite.dishId)?.distanceMeters ?? 0;
}

export function getDiscoverBiteCollection(
  collection: DiscoverCollection,
  bites: Bite[] = getDiscoverBites(),
  repository: DataRepository = getDataRepository(),
) {
  return getDiscoverBiteCollections(bites, repository)[collection];
}

export function getDiscoverBiteCollections(
  bites: Bite[] = getDiscoverBites(),
  repository: DataRepository = getDataRepository(),
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
        unitNumber: dish.unitNumber,
        venueId: dish.venueId,
        venueName: dish.venueName,
      },
      dish,
    };
  });
  const bitesWithImages = syncedBites.map(({ bite }) => bite);

  const lateNight = syncedBites
    .filter(({ bite, dish }) => {
      return (
        dish?.availabilityFlags.some((flag) => flag.toLowerCase().includes("dinner")) ||
        bite.dishName.toLowerCase().includes("satay") ||
        bite.dishName.toLowerCase().includes("laksa") ||
        bite.dishName.toLowerCase().includes("mala")
      );
    })
    .map(({ bite }) => bite);

  return {
    quickBites: bitesWithImages,
    budget: bitesWithImages.filter((bite) => bite.price < 8),
    editorChoice: bitesWithImages.filter((bite) => bite.rating >= 4.4),
    trending: [...bitesWithImages].sort((a, b) => b.cravingCount - a.cravingCount),
    lateNight,
  };
}
