import { DISCOVER_FIRST_PAGE_LIMIT } from "@/features/discover/bites";
import { getDiscoverReadArgs } from "@/features/discover/discoverReadArgs";
import { readDiscoverFirstPage } from "@/features/discover/feedCache";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { catalogRequestScope, requireCurrentCatalogScope } from "@/lib/services/catalogReads";
import { useLocationStore } from "@/store/useLocationStore";

type ReadArgs = ReturnType<typeof getDiscoverReadArgs>;

export function discoverFirstPageKey(scope: string, args: ReadArgs): string {
  return JSON.stringify([
    scope,
    args.areaName ?? null,
    args.geoCellLatitude,
    args.geoCellLongitude,
    args.radiusMeters,
  ]);
}

/** Splash and Home share a single 10-stall request, including its recently settled result. */
export function loadDiscoverFirstPage(scope: string, args: ReadArgs, fresh = false) {
  const discovery = getHungryService().discovery;
  return readDiscoverFirstPage(
    discoverFirstPageKey(scope, args),
    async () => {
      requireCurrentCatalogScope(scope);
      const feed = await discovery.listDiscoveryFeedByLocation({
        areaName: args.areaName,
        lat: args.geoCellLatitude,
        lng: args.geoCellLongitude,
        radiusMeters: args.radiusMeters,
        limit: DISCOVER_FIRST_PAGE_LIMIT,
        deferEnrichment: true,
      });
      requireCurrentCatalogScope(scope);
      return feed;
    },
    fresh,
  );
}

export async function warmHomeFeed(): Promise<void> {
  if (getServiceProvider().mode !== "supabase") return;
  const args = getDiscoverReadArgs(useLocationStore.getState());
  // Home owns the user-visible error or retry. Splash never delays navigation for this promise.
  await loadDiscoverFirstPage(catalogRequestScope(), args).catch(() => undefined);
}
