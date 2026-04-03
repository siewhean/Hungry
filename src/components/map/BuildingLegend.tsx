import { View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

export function BuildingLegend() {
  const { palette, radii, spacing } = useHungryTheme();

  const items = [
    { label: "Hawker centre", color: palette.orange },
    { label: "Food court", color: palette.teal },
    { label: "Restaurant", color: palette.textMuted },
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

