import { create } from "zustand";
import { persist } from "zustand/middleware";

import { mockRepository } from "@/lib/services/mock/repositories";
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
      popularNearby: mockRepository.listPopularNearby(),
      decideForMe: undefined,
      mapFilters: initialFilters,
      setSelectedBuilding: (selectedBuilding) => set({ selectedBuilding }),
      setSelectedFloor: (selectedFloor) => set({ selectedFloor }),
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
