import { useCallback, useState } from "react";

import { getServiceProvider } from "@/lib/services/serviceProvider";
import { DiscoverHomeScreen } from "./DiscoverHomeScreen";
import { HomeOfflineScreen } from "./HomeOfflineScreen";

/**
 * Every build shows the redesigned Home (DiscoverHomeScreen). In Supabase builds its rails come
 * from the live discovery feed; when that read fails, Home switches to the offline page
 * (HomeOfflineScreen), which says what went wrong and keeps saved dishes and the last visit's
 * stalls in reach. Try again, pull to refresh, or the connection coming back tries the live
 * Home again.
 */
export function DiscoverEntryScreen() {
  const isSupabase = getServiceProvider().mode === "supabase";
  const [isLiveFeedUnavailable, setIsLiveFeedUnavailable] = useState(false);
  const showOfflineHome = useCallback(() => setIsLiveFeedUnavailable(true), []);
  const retryLiveHome = useCallback(() => setIsLiveFeedUnavailable(false), []);

  if (!isSupabase) return <DiscoverHomeScreen />;
  if (isLiveFeedUnavailable) return <HomeOfflineScreen onRetry={retryLiveHome} />;
  return <DiscoverHomeScreen onLiveFeedUnavailable={showOfflineHome} />;
}
