import Constants from "expo-constants";
import { Platform } from "react-native";
import { isE2eDeveloperLauncherBuildFor } from "./e2eDeveloperLauncherGate";

export { isE2eDeveloperLauncherBuildFor } from "./e2eDeveloperLauncherGate";

/**
 * The Developer Launcher is available to the dedicated Expo Web test build
 * only. Released artifacts never carry this development-and-mock config pair.
 */
export function isE2eDeveloperLauncherBuild() {
  const extra = Constants.expoConfig?.extra;

  return isE2eDeveloperLauncherBuildFor(extra, Platform.OS);
}

export function isE2eDeveloperLauncherRequested() {
  if (!isE2eDeveloperLauncherBuild() || typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem("hungry.e2eDeveloperLauncher") === "1";
  } catch {
    return false;
  }
}
