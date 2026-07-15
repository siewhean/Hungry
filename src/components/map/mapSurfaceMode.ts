import type { AppEnvironment } from "@/constants/featureFlags";

export type MapSurfaceMode = "live" | "mock" | "unavailable";

export function resolveMapSurfaceMode(
  appEnvironment: AppEnvironment,
  mockMapboxEnabled: boolean,
  accessToken: string | undefined,
): MapSurfaceMode {
  const hasAccessToken = Boolean(accessToken?.trim());

  if (appEnvironment === "production") {
    return hasAccessToken ? "live" : "unavailable";
  }

  return mockMapboxEnabled || !hasAccessToken ? "mock" : "live";
}
