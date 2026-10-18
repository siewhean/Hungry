export type AppEnvironment = "development" | "staging" | "production";

type FeatureFlagEnv = Record<string, string | undefined>;

function resolveAppEnvironment(
  value: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): AppEnvironment {
  if (value === "staging") return "staging";
  if (value === "production") return "production";
  if (value === "development") return "development";
  return nodeEnv === "development" ? "development" : "production";
}

function enabled(env: FeatureFlagEnv, key: string): boolean {
  return env[key]?.trim() === "1";
}

/**
 * Surface flags keep the Release 0.1 per-surface gating mechanism, but their
 * default values follow main's product decisions. A build profile may still
 * narrow a surface explicitly with `EXPO_PUBLIC_ENABLE_*=0` (for example the
 * internal-alpha EAS profile, which also sets `EXPO_PUBLIC_RELEASE_01_CORE_ONLY=1`)
 * or widen it with `=1`.
 */
export function resolveFeatureFlags(
  appEnvRaw = process.env.EXPO_PUBLIC_APP_ENV,
  nodeEnv = process.env.NODE_ENV,
  env: FeatureFlagEnv = process.env,
) {
  const appEnv = resolveAppEnvironment(appEnvRaw?.trim().toLowerCase(), nodeEnv);
  const prototypeRoutesEnabled = appEnv !== "production";
  const nonProductionSurfaceEnabled = prototypeRoutesEnabled;
  const surface = (key: string, defaultValue: boolean) => {
    const value = env[key]?.trim();
    if (value === "1") return true;
    if (value === "0") return false;
    return defaultValue;
  };

  const socialFeedEnabled = surface("EXPO_PUBLIC_ENABLE_SOCIAL_FEED", true);
  const postCreationEnabled = surface("EXPO_PUBLIC_ENABLE_POSTS", true);
  const reviewCreationEnabled = surface("EXPO_PUBLIC_ENABLE_REVIEWS", true);
  const activityEnabled = surface("EXPO_PUBLIC_ENABLE_ACTIVITY", true);
  const readsEnabled = surface("EXPO_PUBLIC_ENABLE_READS", true);
  const mapEnabled = surface("EXPO_PUBLIC_ENABLE_MAP", true);
  // Wheel solo spin ships everywhere. Group parties are an in-memory mock (a /join
  // link can't reach another phone), so hosting/joining stays out of production.
  const hungryWheelEnabled = surface("EXPO_PUBLIC_ENABLE_WHEEL", true);
  // Crave is only reachable from merchant mode today, so keep it out of production.
  const craveEnabled = surface("EXPO_PUBLIC_ENABLE_CRAVE", nonProductionSurfaceEnabled);

  return {
    appEnv,
    // Narrow Release 0.1 core-only surface (read-only detail, release profile,
    // no tab swipe). Off by default to follow main; a build profile opts in.
    release01CoreOnly: enabled(env, "EXPO_PUBLIC_RELEASE_01_CORE_ONLY"),
    socialFeedEnabled,
    postCreationEnabled,
    reviewCreationEnabled,
    activityEnabled,
    readsEnabled,
    mapEnabled,
    hungryWheelEnabled,
    craveEnabled,
    wheelPartyEnabled: hungryWheelEnabled && nonProductionSurfaceEnabled,
    // Favourites are MVP scope: on in every environment. Writes are authenticated
    // and surface server success/failure.
    favouritesEnabled: true,
    notificationsEnabled: false,
    catalogDiagnosticsEnabled: appEnv !== "production",
    // Enable only after the release-versioned catalog migration is published.
    // Production never falls back to a partial client-side catalog cache.
    catalogReadV2: enabled(env, "EXPO_PUBLIC_CATALOG_READ_V2"),
    mockMapboxEnabled: enabled(env, "EXPO_PUBLIC_MOCK_MAPBOX_ENABLED"),
    directMessagesEnabled: nonProductionSurfaceEnabled,
    commentsEnabled: nonProductionSurfaceEnabled,
    oauthProvidersEnabled: nonProductionSurfaceEnabled,
    floorplansEnabled: false,
    gamificationEnabled: nonProductionSurfaceEnabled,
    collectionsEnabled: nonProductionSurfaceEnabled,
    // Hungry Portfolios (user lists) and their public share links ship in production.
    portfoliosEnabled: true,
    // Opt-in push alerts when a followed stall's merchant changes its menu.
    stallAlertsEnabled: true,
    storiesEnabled: nonProductionSurfaceEnabled,
    merchantClaimCtaEnabled: nonProductionSurfaceEnabled,
    merchantCentreEnabled: nonProductionSurfaceEnabled,
    prototypeRoutesEnabled,
  } as const;
}

export const FEATURE_FLAGS = resolveFeatureFlags();
