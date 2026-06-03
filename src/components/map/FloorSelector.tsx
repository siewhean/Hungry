import { FilterChipRail } from "@/components/ui";

export interface FloorSelectorProps {
  floors: string[];
  selectedFloor?: string;
  onSelectFloor?: (floor: string) => void;
  activeFloor?: string;
  onFloorChange?: (floor: string) => void;
}

export function FloorSelector({
  floors,
  selectedFloor,
  onSelectFloor,
  activeFloor,
  onFloorChange,
}: FloorSelectorProps) {
  const currentFloor = activeFloor ?? selectedFloor ?? "";
  const handleChange = onFloorChange ?? onSelectFloor;
  const options = floors.map((floor) => ({
    id: floor,
    label: floor.startsWith("L") ? `Level ${floor.replace("L", "")}` : floor,
    accessibilityLabel: `Select floor ${floor}`,
  }));

  return (
    <FilterChipRail
      options={options}
      selectedId={currentFloor}
      onSelect={(floor) => handleChange?.(floor)}
    />
  );
}
