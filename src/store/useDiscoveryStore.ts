import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import type { BuildingSummary, DishDetail } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

interface MapFilters {
  nearMe: boolean;
  trendingOnly: boolean;
  hawkerOnly: boolean;
  mallOnly: boolean;
  topRated: boolean;
  openNow: boolean;
}

interface RecommendationCacheEntry {
  dishIds: string[];
  generatedAt: number;
  expiresAt: number;
}

const RECOMMENDATION_CACHE_TTL_MS = 5 * 60 * 1000;

interface DiscoveryState {
  selectedBuilding?: BuildingSummary;
  selectedFloor: string;
  highlightedStallVenueId?: string;
  decideForMe?: DishDetail;
  mapFilters: MapFilters;
  recommendationCache: Record<string, RecommendationCacheEntry>;
  setSelectedBuilding: (building?: BuildingSummary) => void;
  setSelectedFloor: (floor: string) => void;
  setHighlightedStallVenueId: (venueId?: string) => void;
  setDecideForMe: (dish?: DishDetail) => void;
  cacheRecommendationSlate: (geoCell: string, dishIds: string[]) => void;
  getCachedRecommendationSlate: (geoCell: string) => string[] | undefined;
  pruneExpiredRecommendations: () => void;
  toggleMapFilter: (filter: keyof MapFilters) => void;
}

const initialFilters: MapFilters = {
  nearMe: true,
  trendingOnly: false,
  hawkerOnly: false,
  mallOnly: false,
  topRated: false,
  openNow: false,
};

export const useDiscoveryStore = create<DiscoveryState>()(
  persist(
    (set, get) => ({
      selectedBuilding: undefined,
      selectedFloor: "L1",
      highlightedStallVenueId: undefined,
      decideForMe: undefined,
      mapFilters: initialFilters,
      recommendationCache: {},
      // Selecting a building is also done by code (deep links, screen mounts), so
      // map_pin_tapped is sent from the marker press handlers, not from here.
      setSelectedBuilding: (selectedBuilding) => set({ selectedBuilding }),
      setSelectedFloor: (selectedFloor) => {
        set((state) => {
          if (state.selectedBuilding && state.selectedFloor !== selectedFloor) {
            trackAnalyticsEvent("floor_switched", {
              building_id: state.selectedBuilding.id,
              from_floor: state.selectedFloor,
              to_floor: selectedFloor,
            });
          }
          return { selectedFloor };
        });
      },
      setHighlightedStallVenueId: (highlightedStallVenueId) => set({ highlightedStallVenueId }),
      setDecideForMe: (decideForMe) => set({ decideForMe }),
      cacheRecommendationSlate: (geoCell, dishIds) => {
        if (!dishIds.length) {
          return;
        }
        const now = Date.now();
        set((state) => ({
          recommendationCache: {
            ...state.recommendationCache,
            [geoCell]: {
              dishIds,
              generatedAt: now,
              expiresAt: now + RECOMMENDATION_CACHE_TTL_MS,
            },
          },
        }));
      },
      getCachedRecommendationSlate: (geoCell) => {
        const entry = get().recommendationCache[geoCell];
        if (!entry) {
          return undefined;
        }
        if (entry.expiresAt <= Date.now()) {
          return undefined;
        }
        return entry.dishIds;
      },
      pruneExpiredRecommendations: () => {
        const now = Date.now();
        set((state) => ({
          recommendationCache: Object.fromEntries(
            Object.entries(state.recommendationCache).filter(([, entry]) => entry.expiresAt > now),
          ),
        }));
      },
      toggleMapFilter: (filter) =>
        set((state) => ({
          mapFilters: {
            ...state.mapFilters,
            [filter]: !state.mapFilters[filter],
          },
        })),
    }),
    {
      name: "hungry-discovery-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        mapFilters: state.mapFilters,
      }),
    },
  ),
);
