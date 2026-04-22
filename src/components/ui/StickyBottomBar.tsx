import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHungryTheme } from "@/theme";
import { Button } from "./Button";

interface StickyBottomBarAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface StickyBottomBarProps {
  actions: StickyBottomBarAction[];
}

/**
 * Reusable sticky bottom action bar — safe area aware.
 * Used on StallDetail, BuildingDrillDown, and other detail screens.
 */
export function StickyBottomBar({ actions }: StickyBottomBarProps) {
  const { palette, spacing, shadows } = useHungryTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        shadows.floating,
        {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3],
          paddingBottom: Math.max(insets.bottom, spacing[4]),
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing[3] }]}>
        {actions.map((action) => (
          <View key={action.label} style={styles.actionFlex}>
            <Button
              label={action.label}
              onPress={action.onPress}
              variant={action.variant ?? "primary"}
              leftIcon={action.icon}
              disabled={action.disabled}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionFlex: {
    flex: 1,
  },
});
