export type E2eDeveloperLauncherExtra = {
  appEnv?: unknown;
  e2eDeveloperLauncherEnabled?: unknown;
};

/**
 * A local-storage value alone never authorizes the launcher. It is available
 * only to the compiled development Expo Web E2E build.
 */
export function isE2eDeveloperLauncherBuildFor(
  extra: E2eDeveloperLauncherExtra | undefined,
  platform: string,
) {
  return (
    platform === "web" &&
    extra?.appEnv === "development" &&
    extra?.e2eDeveloperLauncherEnabled === true
  );
}
