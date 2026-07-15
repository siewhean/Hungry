export type AppEnvironment = "development" | "staging" | "production";

export function resolveAppEnvironment(
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
  mockMapboxRaw = process.env.EXPO_PUBLIC_MOCK_MAPBOX_ENABLED,
) {
  const appEnv = resolveAppEnvironment(appEnvRaw?.trim().toLowerCase(), nodeEnv);
  const prototypeRoutesEnabled = appEnv !== "production";
  const nonProductionSurfaceEnabled = prototypeRoutesEnabled;
  const merchantClaimCtaEnabled = nonProductionSurfaceEnabled;
  const merchantCentreEnabled = nonProductionSurfaceEnabled;

  return {
    readsEnabled: nonProductionSurfaceEnabled,
    notificationsEnabled: false,
    mockMapboxEnabled: nonProductionSurfaceEnabled && mockMapboxRaw === "1",
    hungryWheelEnabled: nonProductionSurfaceEnabled,
    directMessagesEnabled: nonProductionSurfaceEnabled,
    commentsEnabled: nonProductionSurfaceEnabled,
    reviewRichMediaEnabled: nonProductionSurfaceEnabled,
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

export const APP_ENVIRONMENT = resolveAppEnvironment(
  process.env.EXPO_PUBLIC_APP_ENV,
  process.env.NODE_ENV,
);
export const FEATURE_FLAGS = resolveFeatureFlags();
