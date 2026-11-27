import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getServiceProvider } from "@/lib/services/serviceProvider";
import { DiscoverHomeScreen } from "./DiscoverHomeScreen";
import { HomeOfflineScreen } from "./HomeOfflineScreen";

type HomePhase = "live" | "offline" | "retrying";

/**
 * Every build shows the redesigned Home (DiscoverHomeScreen). In Supabase builds its rails come
 * from the live discovery feed; when that read fails, Home switches to the offline page
 * (HomeOfflineScreen), which says what went wrong and keeps saved dishes in reach. Try again, pull
 * to refresh, or the connection coming back loads the live Home again behind the offline page:
 * the page stays up with a working button until the feed answers, instead of flickering.
 */
export function DiscoverEntryScreen() {
  const isSupabase = getServiceProvider().mode === "supabase";
  const [phase, setPhase] = useState<HomePhase>("live");
  const showOfflineHome = useCallback(() => setPhase("offline"), []);
  const showLiveHome = useCallback(() => setPhase("live"), []);
  const retryLiveHome = useCallback(() => setPhase("retrying"), []);

  if (!isSupabase) return <DiscoverHomeScreen />;
  if (phase === "live") {
    return <DiscoverHomeScreen onLiveFeedUnavailable={showOfflineHome} />;
  }
  return (
    <View style={styles.fill}>
      <HomeOfflineScreen onRetry={retryLiveHome} retrying={phase === "retrying"} />
      {phase === "retrying" ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.hiddenHome}
        >
          <DiscoverHomeScreen
            onLiveFeedReady={showLiveHome}
            onLiveFeedUnavailable={showOfflineHome}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hiddenHome: { ...StyleSheet.absoluteFill, opacity: 0 },
});
