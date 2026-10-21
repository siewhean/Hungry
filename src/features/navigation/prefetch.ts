import { Image as ExpoImage } from "expo-image";

import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import type { DataRepository } from "@/lib/services/types";
import type { StallPost } from "@/types/domain";

type MerchantPrefetchRoute =
  | "Dashboard"
  | "Menu"
  | "Analytics"
  | "Profile"
  | "CustomerInbox"
  | "FeaturedVisitors"
  | "BusinessProfileEditor"
  | "VerificationCentre"
  | "PromotionList"
  | "AIAssistant"
  | "OCRDrafts"
  | "MerchantSettings"
  | string;

const prefetchedImages = new Set<string>();
const imagePrefetches = new Map<string, Promise<boolean>>();
const merchantPrefetches = new Set<string>();
const prefetchedDishDetails = new Set<string>();
const prefetchedStallDetails = new Set<string>();
const scheduledDishDetails = new Set<string>();
const scheduledStallDetails = new Set<string>();
const scheduledRoutePreloads = new Set<string>();
const PREFETCH_IDLE_TIMEOUT_MS = 700;
const PREFETCH_FALLBACK_DELAY_MS = 160;
const MAX_IDLE_PREFETCH_WORK_PER_TICK = 8;
let pendingIdlePrefetchWorkCount = 0;

function schedulePrefetchWork(callback: () => void) {
  if (pendingIdlePrefetchWorkCount >= MAX_IDLE_PREFETCH_WORK_PER_TICK) {
    return;
  }

  pendingIdlePrefetchWorkCount += 1;
  let didComplete = false;
  const cancel = scheduleIdleWork(callback, {
    timeout: PREFETCH_IDLE_TIMEOUT_MS,
    fallbackDelayMs: PREFETCH_FALLBACK_DELAY_MS,
    onComplete: () => {
      didComplete = true;
      pendingIdlePrefetchWorkCount = Math.max(0, pendingIdlePrefetchWorkCount - 1);
    },
  });

  return () => {
    cancel();
    if (!didComplete) {
      pendingIdlePrefetchWorkCount = Math.max(0, pendingIdlePrefetchWorkCount - 1);
    }
  };
}

function getRoutePreloadKey(routeName: string, params?: object) {
  if (!params) {
    return routeName;
  }

  try {
    return `${routeName}:${JSON.stringify(params)}`;
  } catch {
    return routeName;
  }
}

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

/** Clears expo-image's memory and disk caches (Settings > Clear local cache). */
export async function clearImageCache() {
  prefetchedImages.clear();
  await Promise.all([
    ExpoImage.clearDiskCache().catch(() => false),
    ExpoImage.clearMemoryCache().catch(() => false),
  ]);
}

export function prefetchImages(uris: (string | null | undefined)[], limit = 6) {
  uris
    .filter(Boolean)
    .slice(0, limit)
    .forEach((uri) => prefetchImage(uri));
}

export function prefetchDishDetail(dishId?: string | null, repository?: DataRepository) {
  // Supabase detail reads are paged per record; warming them from the
  // repository would hydrate the whole catalog.
  if (getServiceProvider().mode === "supabase") {
    return;
  }
  if (!dishId || prefetchedDishDetails.has(dishId) || scheduledDishDetails.has(dishId)) {
    return;
  }

  scheduledDishDetails.add(dishId);
  schedulePrefetchWork(() => {
    try {
      const dataRepository = repository ?? getDataRepository();
      const dish = dataRepository.getDishById(dishId);
      if (!dish) {
        return;
      }

      prefetchedDishDetails.add(dishId);
      prefetchImages([dish.imageUrl, ...dish.gallery], 5);
      const venue = dataRepository.getVenueById(dish.venueId);
      if (venue?.topDishId && venue.topDishId !== dishId) {
        prefetchImage(dataRepository.getDishById(venue.topDishId)?.imageUrl);
      }
    } catch {
      prefetchedDishDetails.delete(dishId);
    } finally {
      scheduledDishDetails.delete(dishId);
    }
  });
}

export function prefetchStallDetail(venueId?: string | null, repository?: DataRepository) {
  // Supabase detail reads are paged per record; warming them from the
  // repository would hydrate the whole catalog.
  if (getServiceProvider().mode === "supabase") {
    return;
  }
  if (!venueId || prefetchedStallDetails.has(venueId) || scheduledStallDetails.has(venueId)) {
    return;
  }

  scheduledStallDetails.add(venueId);
  schedulePrefetchWork(() => {
    try {
      const dataRepository = repository ?? getDataRepository();
      prefetchedStallDetails.add(venueId);
      const venue = dataRepository.getVenueById(venueId);
      const dishes = dataRepository.listDishesByVenue(venueId);
      prefetchImages(
        dishes.map((dish) => dish.imageUrl),
        6,
      );
      if (venue?.topDishId) {
        prefetchDishDetail(venue.topDishId, dataRepository);
      }
    } catch {
      prefetchedStallDetails.delete(venueId);
    } finally {
      scheduledStallDetails.delete(venueId);
    }
  });
}

export function prefetchPostDetail(
  post?: Pick<
    StallPost,
    "authorAvatarUrl" | "dishIds" | "mediaUrl" | "mediaUrls" | "venueId"
  > | null,
  repository?: DataRepository,
) {
  if (!post) {
    return;
  }

  schedulePrefetchWork(() => {
    const dataRepository = repository ?? getDataRepository();
    prefetchImages([post.authorAvatarUrl, post.mediaUrl, ...(post.mediaUrls ?? [])], 7);
    post.dishIds.slice(0, 3).forEach((dishId) => prefetchDishDetail(dishId, dataRepository));
    prefetchStallDetail(post.venueId, dataRepository);
  });
}

/**
 * Routes whose mount effects send analytics, write store state or run a search.
 * A preload mounts the screen, so a mere touch would fire those effects (H60).
 */
export const NON_PRELOADABLE_ROUTES: ReadonlySet<string> = new Set([
  "DecideForMeResult",
  // Mounting the Mapbox screen off screen starts two catalog reads, even for a light press.
  "DiscoverMap",
  "MapZoomedIn",
  "QuickBites",
]);

export function preloadRoute(navigation: unknown, routeName: string, params?: object) {
  if (NON_PRELOADABLE_ROUTES.has(routeName)) {
    return;
  }
  const preloadKey = getRoutePreloadKey(routeName, params);
  if (scheduledRoutePreloads.has(preloadKey)) {
    return;
  }

  scheduledRoutePreloads.add(preloadKey);
  schedulePrefetchWork(() => {
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
    } finally {
      scheduledRoutePreloads.delete(preloadKey);
    }
  });
}

export function prefetchBrowseResults(
  query: string,
  navigation?: unknown,
  options?: { browseMode?: "dishes" | "stalls" },
) {
  const normalizedQuery = query.trim();
  // The catalog is server-paged, so there is no local index to warm: preload
  // only the results route that will request the first page.
  if (navigation && normalizedQuery) {
    preloadRoute(navigation, "SearchResults", {
      browseMode: options?.browseMode ?? "stalls",
      initialQuery: normalizedQuery,
    });
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

  schedulePrefetchWork(() => {
    void (async () => {
      try {
        const merchant = getHungryService().merchant;
        if (routeName === "Dashboard" && outletId) {
          // Same range the Dashboard opens on ("Today"), plus its action-card counts.
          await Promise.all([
            merchant.getAnalytics(outletId, "today"),
            merchant.getDashboardSummary(outletId),
          ]);
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
        if (routeName === "Analytics" && outletId) {
          await merchant.getAnalytics(outletId, "7d");
          return;
        }
        if (routeName === "CustomerInbox" && outletId) {
          await merchant.getInbox(outletId);
          return;
        }
        if (routeName === "FeaturedVisitors" && outletId) {
          await Promise.all([
            merchant.listPopularVisitorPins(outletId),
            merchant.listPopularVisitorCandidates(outletId),
          ]);
          return;
        }
        if (routeName === "PromotionList" && outletId) {
          await merchant.getPromotions(outletId);
          return;
        }
        if (routeName === "AIAssistant" && outletId) {
          await Promise.all([
            merchant.getAIInsights(outletId),
            merchant.getWeeklySummary(outletId),
          ]);
          return;
        }
        if (routeName === "OCRDrafts" && outletId) {
          await merchant.getOCRDrafts(outletId);
          return;
        }
        if (routeName === "MerchantSettings" && accountId) {
          await Promise.all([
            merchant.getNotificationPreferences(accountId),
            merchant.getTeamMembers(accountId),
          ]);
          return;
        }
        if (
          routeName === "Profile" ||
          routeName === "BusinessProfileEditor" ||
          routeName === "VerificationCentre"
        ) {
          await merchant.getMerchantAccount();
        }
      } catch {
        merchantPrefetches.delete(key);
      }
    })();
  });
}
