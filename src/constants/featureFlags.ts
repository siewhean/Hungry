export type AppEnvironment = "development" | "staging" | "production";

function resolveAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === "staging") return "staging";
  if (value === "production") return "production";
  return "development";
}

export function resolveFeatureFlags(appEnvRaw = process.env.EXPO_PUBLIC_APP_ENV) {
  const appEnv = resolveAppEnvironment(appEnvRaw?.trim().toLowerCase());
  const merchantClaimCtaEnabled = appEnv === "staging";

  return {
    readsEnabled: true,
    notificationsEnabled: false,
    mockMapboxEnabled: false,
    hungryWheelEnabled: true,
    directMessagesEnabled: false,
    commentsEnabled: true,
    craveEnabled: true,
    merchantClaimCtaEnabled,
  } as const;
}

export const FEATURE_FLAGS = resolveFeatureFlags();
