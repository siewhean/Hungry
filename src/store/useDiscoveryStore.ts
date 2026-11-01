import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import type { BuildingSummary, DishDetail } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

interface MapFilters {
  nearMe: boolean;
  trendingOnly: boolean;
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
  /** Building types the map is limited to (hawker_centre, mall...); empty means every kind. */
  establishmentTypes: string[];
  recommendationCache: Record<string, RecommendationCacheEntry>;
  setSelectedBuilding: (building?: BuildingSummary) => void;
  setSelectedFloor: (floor: string) => void;
  setHighlightedStallVenueId: (venueId?: string) => void;
  setDecideForMe: (dish?: DishDetail) => void;
  cacheRecommendationSlate: (geoCell: string, dishIds: string[]) => void;
  getCachedRecommendationSlate: (geoCell: string) => string[] | undefined;
  pruneExpiredRecommendations: () => void;
  toggleMapFilter: (filter: keyof MapFilters) => void;
  setEstablishmentTypes: (types: string[]) => void;
}

// "Near me" starts off and is never saved on: it only applies while the map sits
// on the diner's GPS position, which a later session cannot assume.
const initialFilters: MapFilters = {
  nearMe: false,
  trendingOnly: false,
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
      establishmentTypes: [],
      recommendationCache: {},
      setEstablishmentTypes: (establishmentTypes) => set({ establishmentTypes }),
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
        mapFilters: { ...state.mapFilters, nearMe: false },
        establishmentTypes: state.establishmentTypes,
      }),
      // Older installs saved nearMe: true; drop it on load.
      merge: (persisted, current) => {
        const saved = persisted as
          | Partial<Pick<DiscoveryState, "mapFilters" | "establishmentTypes">>
          | undefined;
        const savedFilters = saved?.mapFilters as
          | (MapFilters & { hawkerOnly?: boolean })
          | undefined;
        // The old "Hawker centres" switch becomes one chosen type.
        const migratedTypes = savedFilters?.hawkerOnly ? ["hawker_centre"] : [];
        if (savedFilters) delete savedFilters.hawkerOnly;
        return {
          ...current,
          mapFilters: { ...current.mapFilters, ...savedFilters, nearMe: false },
          establishmentTypes: Array.isArray(saved?.establishmentTypes)
            ? saved.establishmentTypes
            : migratedTypes,
        };
      },
    },
  ),
);
