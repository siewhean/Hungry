import { getDataRepository } from "@/lib/services/serviceProvider";
import type { Bite, DataRepository } from "@/lib/services/types";
import type { DishDetail, StallPost } from "@/types/domain";

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
  return {
    id: post ? `bite-${post.id}-${dish.id}` : `bite-${dish.id}`,
    authorId: post ? `author-${slugifyId(post.authorName)}` : `venue-${slugifyId(dish.venueName)}`,
    authorName: post?.authorName ?? dish.venueName,
    authorAvatar: post?.authorAvatarUrl ?? post?.mediaUrl ?? dish.imageUrl,
    dishId: dish.id,
    dishName: dish.name,
    venueId: dish.venueId,
    venueName: dish.venueName,
    unitNumber: dish.unitNumber,
    buildingId: dish.buildingId,
    buildingName: post?.authorLocation ?? dish.venueName,
    photoUrl: post?.mediaUrls?.[0] ?? post?.mediaUrl ?? dish.imageUrl,
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

export function syncBiteWithDish(
  bite: Bite,
  repository: DataRepository = getDataRepository(),
): Bite {
  const dish = repository.getDishById(bite.dishId);
  if (!dish) return bite;

  return {
    ...bite,
    buildingId: dish.buildingId,
    dishId: dish.id,
    dishName: dish.name,
    photoUrl: dish.imageUrl,
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
      return { bite, dish: undefined };
    }

    return {
      bite: {
        ...bite,
        buildingId: dish.buildingId,
        dishId: dish.id,
        dishName: dish.name,
        photoUrl: dish.imageUrl,
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
