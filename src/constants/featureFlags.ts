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
 * Release 0.1 deliberately exposes only the reliable food-decision loop in
 * staging and production. Development keeps the wider product surface for
 * continued implementation, while explicit staging opt-ins support focused
 * QA without silently widening the internal-alpha build.
 */
export function resolveFeatureFlags(
  appEnvRaw = process.env.EXPO_PUBLIC_APP_ENV,
  nodeEnv = process.env.NODE_ENV,
  env: FeatureFlagEnv = process.env,
) {
  const appEnv = resolveAppEnvironment(appEnvRaw?.trim().toLowerCase(), nodeEnv);
  const isDevelopment = appEnv === "development";
  const isReleasedEnvironment = appEnv === "staging" || appEnv === "production";
  const releaseOptIn = (key: string) => isDevelopment || enabled(env, key);

  const socialFeedEnabled = releaseOptIn("EXPO_PUBLIC_ENABLE_SOCIAL_FEED");
  const postCreationEnabled = releaseOptIn("EXPO_PUBLIC_ENABLE_POSTS");
  const reviewCreationEnabled = releaseOptIn("EXPO_PUBLIC_ENABLE_REVIEWS");
  const activityEnabled = releaseOptIn("EXPO_PUBLIC_ENABLE_ACTIVITY");
  const readsEnabled = releaseOptIn("EXPO_PUBLIC_ENABLE_READS");
  const mapEnabled = releaseOptIn("EXPO_PUBLIC_ENABLE_MAP");
  const hungryWheelEnabled = releaseOptIn("EXPO_PUBLIC_ENABLE_WHEEL");
  const craveEnabled = releaseOptIn("EXPO_PUBLIC_ENABLE_CRAVE");

  // Advanced surfaces stay development-only until their own release gates pass.
  const advancedDevelopmentSurfaceEnabled = isDevelopment;

  return {
    appEnv,
    release01CoreOnly: isReleasedEnvironment,
    socialFeedEnabled,
    postCreationEnabled,
    reviewCreationEnabled,
    activityEnabled,
    readsEnabled,
    mapEnabled,
    hungryWheelEnabled,
    craveEnabled,
    favouritesEnabled: true,
    notificationsEnabled: false,
    catalogDiagnosticsEnabled: appEnv !== "production",
    // Staging and production must exercise the same release-versioned catalog
    // path. Development can opt in while legacy screens remain available for
    // local comparison work.
    catalogReadV2:
      isReleasedEnvironment || enabled(env, "EXPO_PUBLIC_CATALOG_READ_V2"),
    mockMapboxEnabled: enabled(env, "EXPO_PUBLIC_MOCK_MAPBOX_ENABLED"),
    directMessagesEnabled: advancedDevelopmentSurfaceEnabled,
    commentsEnabled: advancedDevelopmentSurfaceEnabled,
    oauthProvidersEnabled: advancedDevelopmentSurfaceEnabled,
    floorplansEnabled: false,
    gamificationEnabled: advancedDevelopmentSurfaceEnabled,
    collectionsEnabled: advancedDevelopmentSurfaceEnabled,
    storiesEnabled: advancedDevelopmentSurfaceEnabled,
    merchantClaimCtaEnabled: advancedDevelopmentSurfaceEnabled,
    merchantCentreEnabled: advancedDevelopmentSurfaceEnabled,
    prototypeRoutesEnabled: advancedDevelopmentSurfaceEnabled,
  } as const;
}

export const FEATURE_FLAGS = resolveFeatureFlags();
