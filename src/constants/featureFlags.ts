export type AppEnvironment = "development" | "staging" | "production";

function resolveAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === "staging") return "staging";
  if (value === "production") return "production";
  return "development";
}

export function resolveFeatureFlags(appEnvRaw = process.env.EXPO_PUBLIC_APP_ENV) {
  const appEnv = resolveAppEnvironment(appEnvRaw?.trim().toLowerCase());
  const merchantClaimCtaEnabled =
    appEnv === "staging" || (typeof __DEV__ !== "undefined" && __DEV__ === true);

  const merchantCentreEnabled =
    appEnv === "staging" || (typeof __DEV__ !== "undefined" && __DEV__ === true);

  const prototypeRoutesEnabled =
    appEnv !== "production" || (typeof __DEV__ !== "undefined" && __DEV__ === true);
  const nonProductionSurfaceEnabled = prototypeRoutesEnabled;

  return {
    readsEnabled: true,
    notificationsEnabled: false,
    mockMapboxEnabled: false,
    hungryWheelEnabled: true,
    directMessagesEnabled: false,
    commentsEnabled: nonProductionSurfaceEnabled,
    oauthProvidersEnabled: nonProductionSurfaceEnabled,
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
