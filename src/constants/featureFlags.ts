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

  // Archived (owner decision 2026-10-24): the social posts feed, Activity and Messages are
  // off by default; their code stays so a build can opt back in with `=1`.
  const socialFeedEnabled = surface("EXPO_PUBLIC_ENABLE_SOCIAL_FEED", false);
  const postCreationEnabled = surface("EXPO_PUBLIC_ENABLE_POSTS", true);
  const reviewCreationEnabled = surface("EXPO_PUBLIC_ENABLE_REVIEWS", true);
  const activityEnabled = surface("EXPO_PUBLIC_ENABLE_ACTIVITY", false);
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
    mapEnabled,
    hungryWheelEnabled,
    craveEnabled,
    wheelPartyEnabled: hungryWheelEnabled && nonProductionSurfaceEnabled,
    // Favourites are MVP scope: on in every environment. Writes are authenticated
    // and surface server success/failure.
    favouritesEnabled: true,
    notificationsEnabled: false,
    catalogDiagnosticsEnabled: appEnv !== "production",
    // Released (staging/production) builds ship without the camera permission and iOS usage
    // string (app.config.js), and expo-image-picker aborts the app if the camera is used
    // without them. Keep this in step with app.config.js; flip both together to ship the camera.
    cameraCaptureEnabled: appEnv === "development",
    mockMapboxEnabled: enabled(env, "EXPO_PUBLIC_MOCK_MAPBOX_ENABLED"),
    directMessagesEnabled: surface("EXPO_PUBLIC_ENABLE_MESSAGES", false),
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
