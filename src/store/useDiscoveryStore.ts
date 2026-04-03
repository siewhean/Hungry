import { create } from "zustand";

import { mockRepository } from "@/lib/services/mock/repositories";
import type { BuildingSummary, DishDetail } from "@/types/domain";

interface DiscoveryState {
  selectedBuilding?: BuildingSummary;
  selectedFloor: string;
  popularNearby: DishDetail[];
  decideForMe?: DishDetail;
  setSelectedBuilding: (building?: BuildingSummary) => void;
  setSelectedFloor: (floor: string) => void;
  setDecideForMe: (dish?: DishDetail) => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set) => ({
  selectedBuilding: undefined,
  selectedFloor: "L1",
  popularNearby: mockRepository.listPopularNearby(),
  decideForMe: undefined,
  setSelectedBuilding: (selectedBuilding) => set({ selectedBuilding }),
  setSelectedFloor: (selectedFloor) => set({ selectedFloor }),
  setDecideForMe: (decideForMe) => set({ decideForMe }),
}));

