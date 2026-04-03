import { create } from "zustand";

import type { Coordinate } from "@/types/domain";

interface LocationState {
  permission: "unknown" | "granted" | "denied";
  currentLocation: Coordinate;
  manualLocation?: string;
  gpsBadgeState: "live" | "manual" | "denied";
  grantLocation: () => void;
  denyLocation: () => void;
  setManualLocation: (label: string) => void;
}

const defaultLocation = { latitude: 1.2813, longitude: 103.8458 };

export const useLocationStore = create<LocationState>((set) => ({
  permission: "unknown",
  currentLocation: defaultLocation,
  manualLocation: undefined,
  gpsBadgeState: "live",
  grantLocation: () => set({ permission: "granted", gpsBadgeState: "live" }),
  denyLocation: () => set({ permission: "denied", gpsBadgeState: "denied" }),
  setManualLocation: (label) =>
    set({
      manualLocation: label,
      gpsBadgeState: "manual",
    }),
}));

