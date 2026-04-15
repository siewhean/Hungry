import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getDataRepository } from "@/lib/services/serviceProvider";
import type { BuildingSummary, DishDetail } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

interface MapFilters {
  nearMe: boolean;
  hawkerOnly: boolean;
  topRated: boolean;
  openNow: boolean;
}

interface DiscoveryState {
  selectedBuilding?: BuildingSummary;
  selectedFloor: string;
  highlightedStallVenueId?: string;
  popularNearby: DishDetail[];
  decideForMe?: DishDetail;
  mapFilters: MapFilters;
  setSelectedBuilding: (building?: BuildingSummary) => void;
  setSelectedFloor: (floor: string) => void;
  setHighlightedStallVenueId: (venueId?: string) => void;
  setDecideForMe: (dish?: DishDetail) => void;
  toggleMapFilter: (filter: keyof MapFilters) => void;
}

const initialFilters: MapFilters = {
  nearMe: true,
  hawkerOnly: false,
  topRated: false,
  openNow: false,
};

export const useDiscoveryStore = create<DiscoveryState>()(
  persist(
    (set) => ({
      selectedBuilding: undefined,
      selectedFloor: "L1",
      highlightedStallVenueId: undefined,
      popularNearby: getDataRepository().listPopularNearby(),
      decideForMe: undefined,
      mapFilters: initialFilters,
      setSelectedBuilding: (selectedBuilding) => {
        set({ selectedBuilding });
        if (selectedBuilding) {
          trackAnalyticsEvent("map_pin_tapped", {
            building_id: selectedBuilding.id,
            building_type: selectedBuilding.type,
          });
        }
      },
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
    }
  )
);
