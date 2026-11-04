import { SegmentedControl } from "@/components/ui";
import type { SavedViewMode } from "@/store/useSavedViewStore";

type Props = {
  value: SavedViewMode;
  onChange: (mode: SavedViewMode) => void;
  accessibilityLabel: string;
  /** Fires as a finger lands on Map, so the map screen can be warmed up. */
  onPressInMap?: () => void;
};

/**
 * The List / Map switch: two icon segments (list.bullet, map). The one switch used wherever a
 * page can show its places as a list or on a map (Saved, Home, the map), always at the top right.
 */
export function SavedViewSwitch({ value, onChange, accessibilityLabel, onPressInMap }: Props) {
  return (
    <SegmentedControl
      compact
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChange={onChange}
      options={[
        { value: "list", label: "List", icon: "listView", accessibilityLabel: "List view" },
        {
          value: "map",
          label: "Map",
          icon: "mapView",
          accessibilityLabel: "Map view",
          onPressIn: onPressInMap,
        },
      ]}
    />
  );
}
