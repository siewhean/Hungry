import Constants from "expo-constants";

/**
 * The Developer Launcher is available to the dedicated Expo Web test build
 * only. Released artifacts never carry this development-and-mock config pair.
 */
export function isE2eDeveloperLauncherBuild() {
  const extra = Constants.expoConfig?.extra;

  return extra?.appEnv === "development" && extra?.e2eDeveloperLauncherEnabled === true;
}

export function isE2eDeveloperLauncherRequested() {
  if (!isE2eDeveloperLauncherBuild() || typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem("hungry.e2eDeveloperLauncher") === "1";
  } catch {
    return false;
  }
}
