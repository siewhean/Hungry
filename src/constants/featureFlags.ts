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

  return {
    readsEnabled: true,
    notificationsEnabled: false,
    mockMapboxEnabled: false,
    hungryWheelEnabled: true,
    directMessagesEnabled: false,
    commentsEnabled: true,
    craveEnabled: true,
    merchantClaimCtaEnabled,
    merchantCentreEnabled,
  } as const;
}

export const FEATURE_FLAGS = resolveFeatureFlags();
