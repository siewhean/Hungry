import { useCallback, useState } from "react";

import { getServiceProvider } from "@/lib/services/serviceProvider";
import { CatalogDiscoverHome } from "./CatalogDiscoverHome";
import { DiscoverHomeScreen } from "./DiscoverHomeScreen";

/**
 * Every build shows the redesigned Home (DiscoverHomeScreen). In Supabase builds its rails come
 * from the live discovery feed; when that read fails, Home switches to the offline surface
 * (CatalogDiscoverHome), which reads the catalog and, during an outage, the bundled Excel copy.
 * Retry or pull-to-refresh there tries the live Home again.
 */
export function DiscoverEntryScreen() {
  const isSupabase = getServiceProvider().mode === "supabase";
  const [isLiveFeedUnavailable, setIsLiveFeedUnavailable] = useState(false);
  const showOfflineHome = useCallback(() => setIsLiveFeedUnavailable(true), []);
  const retryLiveHome = useCallback(() => setIsLiveFeedUnavailable(false), []);

  if (!isSupabase) return <DiscoverHomeScreen />;
  if (isLiveFeedUnavailable) return <CatalogDiscoverHome onRetryLive={retryLiveHome} />;
  return <DiscoverHomeScreen onLiveFeedUnavailable={showOfflineHome} />;
}
