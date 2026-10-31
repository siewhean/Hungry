import { FEATURE_FLAGS } from "@/constants/featureFlags";

/**
 * Whether a map can be drawn properly in this build: a Mapbox token is set, or the build is a
 * dev/mock build where the approximate layout is expected. Without a token a release build only
 * shows "Map unavailable", so screens hide their Map switch instead of offering it.
 */
export function isLiveMapAvailable(): boolean {
  return (
    Boolean(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN) ||
    FEATURE_FLAGS.mockMapboxEnabled ||
    __DEV__
  );
}
