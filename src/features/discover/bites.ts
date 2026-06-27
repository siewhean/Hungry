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

const DISCOVER_FOOD_FALLBACK_IMAGES = {
  chickenRice: "https://upload.wikimedia.org/wikipedia/commons/7/71/Hainanese_Chicken_Rice.jpg",
  curry:
    "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&q=80&w=800",
  friedChicken:
    "https://images.unsplash.com/photo-1562967916-eb82221dfb92?auto=format&fit=crop&q=80&w=800",
  pastry:
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800",
  toast:
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&q=80&w=800",
  drink:
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&q=80&w=800",
  salad:
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800",
  vegetables:
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800",
  pizza:
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=800",
  burger:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800",
  sushi:
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=800",
  noodles:
    "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&q=80&w=800",
  pasta:
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
  cake: "https://images.unsplash.com/photo-1621236378699-8597fac6bb4d?auto=format&fit=crop&q=80&w=800",
} as const;

function isUsableDiscoverFoodImageUrl(value: string | undefined) {
  const trimmed = value?.trim();
  return Boolean(
    trimmed &&
    !trimmed.includes(",") &&
    trimmed !== HUNGRY_LOGO_IMAGE_URL &&
    /^https?:\/\//i.test(trimmed),
  );
}

export function resolveDiscoverFoodImageUrl(imageUrl: string | undefined, dishName: string) {
  if (isUsableDiscoverFoodImageUrl(imageUrl)) {
    return imageUrl?.trim() ?? "";
  }

  const normalizedName = dishName.toLowerCase();
  if (normalizedName.includes("chicken rice") || normalizedName.includes("hainanese")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.chickenRice;
  }
  if (normalizedName.includes("recipe chicken") || normalizedName.includes("fried chicken")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.friedChicken;
  }
  if (normalizedName.includes("curry puff") || normalizedName.includes("puff")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.pastry;
  }
  if (normalizedName.includes("curry")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.curry;
  }
  if (normalizedName.includes("toast")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.toast;
  }
  if (normalizedName.includes("tea") || normalizedName.includes("kopi")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.drink;
  }
  if (
    normalizedName.includes("floss") ||
    normalizedName.includes("bun") ||
    normalizedName.includes("cake") ||
    normalizedName.includes("pandan")
  ) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.cake;
  }
  if (
    normalizedName.includes("laksa") ||
    normalizedName.includes("noodle") ||
    normalizedName.includes("mala") ||
    normalizedName.includes("mee")
  ) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.noodles;
  }
  if (normalizedName.includes("burger") || normalizedName.includes("chop")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.burger;
  }
  if (normalizedName.includes("sushi") || normalizedName.includes("salmon")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.sushi;
  }
  if (normalizedName.includes("pizza")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.pizza;
  }
  if (normalizedName.includes("pasta")) {
    return DISCOVER_FOOD_FALLBACK_IMAGES.pasta;
  }

  return DISCOVER_FOOD_FALLBACK_IMAGES.vegetables;
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
  const photoUrl = resolveDiscoverFoodImageUrl(
    post?.mediaUrls?.[0] ?? post?.mediaUrl ?? dish.imageUrl,
    dish.name,
  );
  return {
    id: post ? `bite-${post.id}-${dish.id}` : `bite-${dish.id}`,
    authorId: post ? `author-${slugifyId(post.authorName)}` : `venue-${slugifyId(dish.venueName)}`,
    authorName: post?.authorName ?? dish.venueName,
    authorAvatar: post?.authorAvatarUrl ?? photoUrl,
    dishId: dish.id,
    dishName: dish.name,
    venueId: dish.venueId,
    venueName: dish.venueName,
    unitNumber: dish.unitNumber,
    buildingId: dish.buildingId,
    buildingName: post?.authorLocation ?? dish.venueName,
    photoUrl,
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

  return {
    ...bite,
    buildingId: dish.buildingId,
    dishId: dish.id,
    dishName: dish.name,
    photoUrl: resolveDiscoverFoodImageUrl(dish.imageUrl, dish.name),
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
      return {
        bite: {
          ...bite,
          photoUrl: resolveDiscoverFoodImageUrl(bite.photoUrl, bite.dishName),
        },
        dish: undefined,
      };
    }

    return {
      bite: {
        ...bite,
        buildingId: dish.buildingId,
        dishId: dish.id,
        dishName: dish.name,
        photoUrl: resolveDiscoverFoodImageUrl(dish.imageUrl, dish.name),
        price: dish.price,
        rating: dish.rating,
        unitNumber: dish.unitNumber,
        venueId: dish.venueId,
        venueName: dish.venueName,
      },
      dish,
    };
  });
  const bitesWithImages = syncedBites
    .map(({ bite }) => bite)
    .filter((bite) => Boolean(bite.photoUrl.trim()));

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
