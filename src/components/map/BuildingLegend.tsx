import { View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface PinColors {
  orange: string;
  teal: string;
  navy: string;
  textMuted: string;
}

/** Pin colour by what the place is; the legend below draws the same mapping. */
export function getBuildingPinColor(buildingType: string | undefined, palette: PinColors) {
  if (buildingType === "hawker_centre") return palette.orange;
  if (buildingType === "food_court") return palette.teal;
  return palette.textMuted;
}

/** Zoomed-out groups of places are drawn in navy so no pin colour is reused for them. */
export function getClusterPinColor(palette: PinColors) {
  return palette.navy;
}

export function BuildingLegend() {
  const { palette, radii, spacing } = useHungryTheme();

  const items = [
    { label: "Hawker centre", color: getBuildingPinColor("hawker_centre", palette) },
    { label: "Food court", color: getBuildingPinColor("food_court", palette) },
    { label: "Other places", color: getBuildingPinColor(undefined, palette) },
    { label: "Group of places", color: getClusterPinColor(palette) },
  ];

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            alignItems: "center",
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radii.pill,
            borderWidth: 1,
            flexDirection: "row",
            gap: spacing[2],
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
          }}
        >
          <View
            style={{
              backgroundColor: item.color,
              borderRadius: radii.pill,
              height: 10,
              width: 10,
            }}
          />
          <AppText variant="bodySmall" tone="secondary">
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
