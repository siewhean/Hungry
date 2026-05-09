import { Image as ExpoImage } from "expo-image";

import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { DataRepository } from "@/lib/services/types";
import type { StallPost } from "@/types/domain";

type MerchantPrefetchRoute =
  | "Dashboard"
  | "Menu"
  | "Analytics"
  | "Profile"
  | "CustomerInbox"
  | string;

const prefetchedImages = new Set<string>();
const imagePrefetches = new Map<string, Promise<boolean>>();
const merchantPrefetches = new Set<string>();

export function prefetchImage(uri?: string | null) {
  if (!uri || prefetchedImages.has(uri)) {
    return;
  }

  const current = imagePrefetches.get(uri);
  if (current) {
    return;
  }

  const prefetch = ExpoImage.prefetch(uri, { cachePolicy: "memory-disk" })
    .then((result) => {
      const success = Array.isArray(result) ? result.every(Boolean) : Boolean(result);
      if (success) {
        prefetchedImages.add(uri);
      }
      return success;
    })
    .catch(() => false)
    .finally(() => {
      imagePrefetches.delete(uri);
    });

  imagePrefetches.set(uri, prefetch);
}

export function prefetchImages(uris: (string | null | undefined)[], limit = 6) {
  uris
    .filter(Boolean)
    .slice(0, limit)
    .forEach((uri) => prefetchImage(uri));
}

export function prefetchDishDetail(
  dishId?: string | null,
  repository: DataRepository = getDataRepository(),
) {
  if (!dishId) {
    return;
  }

  const dish = repository.getDishById(dishId);
  if (!dish) {
    return;
  }

  prefetchImages([dish.imageUrl, ...dish.gallery], 5);
  const venue = repository.getVenueById(dish.venueId);
  if (venue?.topDishId && venue.topDishId !== dishId) {
    prefetchImage(repository.getDishById(venue.topDishId)?.imageUrl);
  }
}

export function prefetchStallDetail(
  venueId?: string | null,
  repository: DataRepository = getDataRepository(),
) {
  if (!venueId) {
    return;
  }

  const venue = repository.getVenueById(venueId);
  const dishes = repository.listDishesByVenue(venueId);
  prefetchImages(
    dishes.map((dish) => dish.imageUrl),
    6,
  );
  if (venue?.topDishId) {
    prefetchDishDetail(venue.topDishId, repository);
  }
}

export function prefetchPostDetail(
  post?: Pick<
    StallPost,
    "authorAvatarUrl" | "dishIds" | "mediaUrl" | "mediaUrls" | "venueId"
  > | null,
  repository: DataRepository = getDataRepository(),
) {
  if (!post) {
    return;
  }

  prefetchImages([post.authorAvatarUrl, post.mediaUrl, ...(post.mediaUrls ?? [])], 7);
  post.dishIds.slice(0, 3).forEach((dishId) => prefetchDishDetail(dishId, repository));
  prefetchStallDetail(post.venueId, repository);
}

export function preloadRoute(navigation: unknown, routeName: string, params?: object) {
  try {
    const preload =
      typeof navigation === "object" && navigation && "preload" in navigation
        ? (navigation.preload as unknown)
        : undefined;
    if (typeof preload === "function") {
      (preload as (routeName: string, params?: object) => void)(routeName, params);
    }
  } catch {
    // Prefetching must never block or alter navigation.
  }
}

export function prefetchMerchantTab(
  routeName: MerchantPrefetchRoute,
  outletId?: string | null,
  accountId?: string | null,
) {
  const key = `${routeName}:${outletId ?? "no-outlet"}:${accountId ?? "no-account"}`;
  if (merchantPrefetches.has(key)) {
    return;
  }
  merchantPrefetches.add(key);

  void (async () => {
    try {
      const merchant = getHungryService().merchant;
      if (routeName === "Dashboard" && outletId) {
        await merchant.getAnalytics(outletId, "7d");
        return;
      }
      if (routeName === "Menu" && outletId) {
        const dishes = await merchant.getMenu(outletId);
        prefetchImages(
          dishes.map((dish) => dish.imageUrl),
          8,
        );
        return;
      }
      if (routeName === "CustomerInbox" && outletId) {
        await merchant.getInbox(outletId);
        return;
      }
      if (routeName === "Profile" || routeName === "MerchantSettings") {
        await merchant.getMerchantAccount();
      }
    } catch {
      merchantPrefetches.delete(key);
    }
  })();
}
