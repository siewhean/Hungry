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
  grantLocation: (options?: { manualLocation?: string }) => Promise<boolean>;
  denyLocation: () => void;
  setManualLocation: (label: string) => void;
  setManualSelection: (label: string, coordinate: Coordinate) => void;
  resetLocationState: () => void;
}

const defaultLocation = { latitude: 1.2813, longitude: 103.8458 };

type ExpoLocationLike = {
  Accuracy: { Balanced: number };
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (options: { accuracy: number }) => Promise<{
    coords: { latitude: number; longitude: number };
  }>;
};

function loadExpoLocationModule(): ExpoLocationLike | null {
  try {
    const modulesCore = require("expo-modules-core") as {
      NativeModulesProxy?: Record<string, unknown>;
    };
    if (!modulesCore?.NativeModulesProxy?.ExpoLocation) {
      return null;
    }

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

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
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
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      },
      resetLocationState: () =>
        set({
          permission: "unknown",
          currentLocation: defaultLocation,
          manualLocation: undefined,
          manualCoordinate: undefined,
          gpsBadgeState: "live",
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
      }),
    },
  ),
);
