import { Pressable, View } from "react-native";
import { List, MapPinned } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export type DiscoverView = "list" | "map";

const OPTIONS: readonly { id: DiscoverView; label: string }[] = [
  { id: "list", label: "List" },
  { id: "map", label: "Map" },
];

/** List/Map switch shared by Discover (list) and the Discover map. */
export function DiscoverViewToggle({
  value,
  onChange,
  onPressInMap,
}: {
  value: DiscoverView;
  onChange: (next: DiscoverView) => void;
  onPressInMap?: () => void;
}) {
  const { palette, radii, shadows, spacing } = useHungryTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: "row",
        padding: spacing[0.5],
        ...shadows.card,
      }}
    >
      {OPTIONS.map((option) => {
        const selected = option.id === value;
        const color = selected ? palette.textOnOrange : palette.textSecondary;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityLabel={`${option.label} view`}
            accessibilityState={{ selected }}
            hitSlop={4}
            onPressIn={option.id === "map" ? onPressInMap : undefined}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(option.id);
            }}
            style={{
              alignItems: "center",
              backgroundColor: selected ? palette.orange : "transparent",
              borderRadius: radii.pill,
              flexDirection: "row",
              gap: spacing[1],
              minHeight: 36,
              paddingHorizontal: spacing[3],
            }}
          >
            {option.id === "list" ? (
              <List color={color} size={16} />
            ) : (
              <MapPinned color={color} size={16} />
            )}
            <AppText variant="bodySmall" style={{ color, fontWeight: "700" }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
