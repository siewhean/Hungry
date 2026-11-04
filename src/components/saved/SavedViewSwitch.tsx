import { SegmentedControl } from "@/components/ui";
import type { SavedViewMode } from "@/store/useSavedViewStore";

type Props = {
  value: SavedViewMode;
  onChange: (mode: SavedViewMode) => void;
  accessibilityLabel: string;
};

/** List / Map as two icon segments (list.bullet, map), small enough to share a row. */
export function SavedViewSwitch({ value, onChange, accessibilityLabel }: Props) {
  return (
    <SegmentedControl
      compact
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChange={onChange}
      options={[
        { value: "list", label: "List", icon: "listView", accessibilityLabel: "List view" },
        { value: "map", label: "Map", icon: "mapView", accessibilityLabel: "Map view" },
      ]}
    />
  );
}
