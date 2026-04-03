import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import type { BuildingSummary, DishDetail } from "@/types/domain";

export function useDiscoverData() {
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const buildings = mockRepository.listBuildings();
  const popularNearby = useDiscoveryStore((state) => state.popularNearby);
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const selectedFloor = useDiscoveryStore((state) => state.selectedFloor);
  const decideForMe = useDiscoveryStore((state) => state.decideForMe);

  return {
    profile,
    isAuthenticated,
    buildings,
    popularNearby,
    selectedBuilding,
    selectedFloor,
    decideForMe,
  };
}

export function getBuildingVenues(buildingId: string) {
  return mockRepository.listVenuesByBuilding(buildingId);
}

export function getBuildingDishes(buildingId: string) {
  const venues = getBuildingVenues(buildingId);

  return venues.map((venue) => mockRepository.getDishById(venue.topDishId)).filter(Boolean) as DishDetail[];
}

export function findBuildingById(buildingId: string): BuildingSummary | undefined {
  return mockRepository.listBuildings().find((building) => building.id === buildingId);
}

