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
    // Wheel solo spin ships everywhere. Group parties are an in-memory mock (a /join
    // link can't reach another phone), so hosting/joining stays out of production.
    wheelPartyEnabled: nonProductionSurfaceEnabled,
    directMessagesEnabled: nonProductionSurfaceEnabled,
    commentsEnabled: nonProductionSurfaceEnabled,
    oauthProvidersEnabled: nonProductionSurfaceEnabled,
    floorplansEnabled: false,
    // Crave is only reachable from merchant mode today, so keep it out of production.
    craveEnabled: nonProductionSurfaceEnabled,
    gamificationEnabled: nonProductionSurfaceEnabled,
    collectionsEnabled: nonProductionSurfaceEnabled,
    // Hungry Portfolios (user lists) and their public share links ship in production.
    portfoliosEnabled: true,
    // Opt-in push alerts when a followed stall's merchant changes its menu.
    stallAlertsEnabled: true,
    storiesEnabled: nonProductionSurfaceEnabled,
    merchantClaimCtaEnabled,
    merchantCentreEnabled,
    prototypeRoutesEnabled,
  } as const;
}

export const FEATURE_FLAGS = resolveFeatureFlags();
