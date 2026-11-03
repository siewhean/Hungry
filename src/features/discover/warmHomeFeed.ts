import { DISCOVER_FEED_LIMIT, DISCOVER_FIRST_PAGE_LIMIT } from "@/features/discover/bites";
import { getDiscoverReadArgs } from "@/features/discover/discoverReadArgs";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";

/**
 * Starts Home's first reads while the Splash screen is still up, for a diner who is signed in and
 * will land on Home. Home asks for the same stalls a moment later, joins these reads instead of
 * repeating them (see shareInFlight), and so draws as soon as it opens.
 *
 * The returned promise settles when the nearest stalls have landed, fail or not; it never rejects,
 * so Splash can wait on it without a try/catch. The request fields and their order must match
 * the ones useDiscoverFeed sends, because the shared read is keyed on the request.
 */
export function warmHomeFeed(): Promise<void> {
  if (getServiceProvider().mode !== "supabase") return Promise.resolve();
  const location = useLocationStore.getState();
  const args = getDiscoverReadArgs(location);
  const discovery = getHungryService().discovery;
  const feedRequest = {
    areaName: args.areaName,
    lat: args.geoCellLatitude,
    lng: args.geoCellLongitude,
    radiusMeters: args.radiusMeters,
    buildingId: undefined,
  };
  // The count and full feed are started now too (Home reads all three), but only the nearest
  // stalls are waited for.
  void discovery
    .countVenuesInArea(
      args.geoCellLatitude,
      args.geoCellLongitude,
      args.radiusMeters,
      args.areaName,
    )
    .catch(() => undefined);
  void discovery
    .listDiscoveryFeedByLocation({ ...feedRequest, limit: DISCOVER_FEED_LIMIT })
    .catch(() => undefined);
  return discovery
    .listDiscoveryFeedByLocation({ ...feedRequest, limit: DISCOVER_FIRST_PAGE_LIMIT })
    .then(
      () => undefined,
      () => undefined,
    );
}
