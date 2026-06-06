export type AppEnvironment = "development" | "staging" | "production";

function resolveAppEnvironment(
  value: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): AppEnvironment {
  if (value === "staging") return "staging";
  if (value === "production") return "production";
  if (value === "development") return "development";
  return nodeEnv === "development" ? "development" : "production";
}

export function resolveFeatureFlags(
  appEnvRaw = process.env.EXPO_PUBLIC_APP_ENV,
  nodeEnv = process.env.NODE_ENV,
) {
  const appEnv = resolveAppEnvironment(appEnvRaw?.trim().toLowerCase(), nodeEnv);
  const prototypeRoutesEnabled = appEnv !== "production";
  const nonProductionSurfaceEnabled = prototypeRoutesEnabled;
  const merchantClaimCtaEnabled = nonProductionSurfaceEnabled;
  const merchantCentreEnabled = nonProductionSurfaceEnabled;

  return {
    readsEnabled: true,
    notificationsEnabled: false,
    mockMapboxEnabled: process.env.EXPO_PUBLIC_MOCK_MAPBOX_ENABLED === "1",
    hungryWheelEnabled: true,
    directMessagesEnabled: nonProductionSurfaceEnabled,
    commentsEnabled: nonProductionSurfaceEnabled,
    oauthProvidersEnabled: nonProductionSurfaceEnabled,
    floorplansEnabled: false,
    craveEnabled: true,
    gamificationEnabled: nonProductionSurfaceEnabled,
    collectionsEnabled: nonProductionSurfaceEnabled,
    storiesEnabled: nonProductionSurfaceEnabled,
    merchantClaimCtaEnabled,
    merchantCentreEnabled,
    prototypeRoutesEnabled,
  } as const;
}

export const FEATURE_FLAGS = resolveFeatureFlags();
