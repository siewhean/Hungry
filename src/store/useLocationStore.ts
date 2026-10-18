import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import type { Coordinate } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

interface LocationState {
  permission: "unknown" | "granted" | "denied";
  currentLocation: Coordinate;
  manualLocation?: string;
  manualCoordinate?: Coordinate;
  gpsBadgeState: "live" | "manual" | "denied";
  /** When the GPS fix in currentLocation was taken (ms since epoch). */
  lastLocationFixAt?: number;
  grantLocation: (options?: { manualLocation?: string }) => Promise<boolean>;
  /**
   * Re-reads GPS when permission is already granted and the last fix is older
   * than LOCATION_REFRESH_MAX_AGE_MS. Never prompts. Resolves true on a new fix.
   */
  /** Skips when the last fix is fresh unless `force` (used on cold launch). */
  refreshLocation: (options?: { force?: boolean }) => Promise<boolean>;
  denyLocation: () => void;
  setManualLocation: (label: string) => void;
  setManualSelection: (label: string, coordinate: Coordinate) => void;
  resetLocationState: () => void;
}

const defaultLocation = { latitude: 1.2813, longitude: 103.8458 };

export const LOCATION_REFRESH_MAX_AGE_MS = 10 * 60 * 1000;

// Manual picks go to analytics at ~1 km precision, not the exact point.
function toCoarseCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

type ExpoLocationLike = {
  Accuracy: { Balanced: number };
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getForegroundPermissionsAsync?: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (options: { accuracy: number }) => Promise<{
    coords: { latitude: number; longitude: number };
  }>;
};

function loadExpoLocationModule(): ExpoLocationLike | null {
  try {
    const locationModule = require("expo-location") as Partial<ExpoLocationLike>;
    if (
      typeof locationModule.requestForegroundPermissionsAsync !== "function" ||
      typeof locationModule.getCurrentPositionAsync !== "function" ||
      !locationModule.Accuracy
    ) {
      return null;
    }
    return locationModule as ExpoLocationLike;
  } catch {
    return null;
  }
}

export function normalizeManualLocationLabel(label?: string) {
  const trimmed = label?.trim();
  return trimmed ? trimmed : undefined;
}

export function getGrantedLocationState(currentLocation: Coordinate) {
  return {
    permission: "granted" as const,
    currentLocation,
    gpsBadgeState: "live" as const,
  };
}

export function getDeniedLocationState(manualLocation?: string) {
  const normalizedManualLocation = normalizeManualLocationLabel(manualLocation);
  return {
    permission: "denied" as const,
    gpsBadgeState: normalizedManualLocation ? ("manual" as const) : ("denied" as const),
    ...(normalizedManualLocation ? { manualLocation: normalizedManualLocation } : {}),
  };
}

let refreshInFlight: Promise<boolean> | null = null;

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      permission: "unknown",
      currentLocation: defaultLocation,
      manualLocation: undefined,
      manualCoordinate: undefined,
      gpsBadgeState: "live",
      grantLocation: async (options) => {
        try {
          const Location = loadExpoLocationModule();
          if (!Location) {
            set(getDeniedLocationState(options?.manualLocation));
            trackAnalyticsEvent("location_permission_result", {
              result: "denied",
              reason: "module_unavailable",
            });
            return false;
          }

          const permission = await Location.requestForegroundPermissionsAsync();
          if (permission.status !== "granted") {
            set(getDeniedLocationState(options?.manualLocation));
            return false;
          }

          const result = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          set({
            ...getGrantedLocationState({
              latitude: result.coords.latitude,
              longitude: result.coords.longitude,
            }),
            manualLocation: normalizeManualLocationLabel(options?.manualLocation),
            manualCoordinate: undefined,
            lastLocationFixAt: Date.now(),
          });
          trackAnalyticsEvent("location_permission_result", { result: "granted" });
          return true;
        } catch {
          set(getDeniedLocationState(options?.manualLocation));
          trackAnalyticsEvent("location_permission_result", {
            result: "denied",
            reason: "exception",
          });
          return false;
        }
      },
      refreshLocation: (options) => {
        if (refreshInFlight) return refreshInFlight;
        const state = get();
        if (state.permission !== "granted") return Promise.resolve(false);
        if (
          !options?.force &&
          Date.now() - (state.lastLocationFixAt ?? 0) < LOCATION_REFRESH_MAX_AGE_MS
        ) {
          return Promise.resolve(false);
        }
        const Location = loadExpoLocationModule();
        const getPermission = Location?.getForegroundPermissionsAsync;
        if (!Location || typeof getPermission !== "function") return Promise.resolve(false);

        refreshInFlight = (async () => {
          try {
            const permission = await getPermission();
            if (permission.status !== "granted") {
              // Revoked in system settings since the last launch.
              set(getDeniedLocationState(get().manualLocation));
              return false;
            }
            const result = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (get().permission !== "granted") return false;
            set({
              currentLocation: {
                latitude: result.coords.latitude,
                longitude: result.coords.longitude,
              },
              lastLocationFixAt: Date.now(),
            });
            return true;
          } catch {
            return false;
          } finally {
            refreshInFlight = null;
          }
        })();
        return refreshInFlight;
      },
      denyLocation: () => {
        set({ permission: "denied", gpsBadgeState: "denied", manualCoordinate: undefined });
        trackAnalyticsEvent("location_permission_result", {
          result: "denied",
          source: "manual_deny",
        });
      },
      setManualLocation: (label) =>
        set({
          manualLocation: normalizeManualLocationLabel(label),
          manualCoordinate: undefined,
          gpsBadgeState: "manual",
        }),
      setManualSelection: (label, coordinate) => {
        set({
          permission: "denied",
          manualLocation: normalizeManualLocationLabel(label),
          manualCoordinate: coordinate,
          currentLocation: coordinate,
          gpsBadgeState: "manual",
        });
        trackAnalyticsEvent("location_permission_result", {
          result: "manual_selection",
          label,
          latitude: toCoarseCoordinate(coordinate.latitude),
          longitude: toCoarseCoordinate(coordinate.longitude),
        });
      },
      resetLocationState: () =>
        set({
          permission: "unknown",
          currentLocation: defaultLocation,
          manualLocation: undefined,
          manualCoordinate: undefined,
          gpsBadgeState: "live",
          lastLocationFixAt: undefined,
        }),
    }),
    {
      name: "hungry-location-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        permission: state.permission,
        currentLocation: state.currentLocation,
        manualLocation: state.manualLocation,
        manualCoordinate: state.manualCoordinate,
        gpsBadgeState: state.gpsBadgeState,
        lastLocationFixAt: state.lastLocationFixAt,
      }),
    },
  ),
);
