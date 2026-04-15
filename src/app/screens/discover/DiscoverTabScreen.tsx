import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { DiscoverHomeScreen } from "./DiscoverHomeScreen";
import { HomeMapScreen } from "./HomeMapScreen";

type DiscoverMode = "map" | "explore";

export function DiscoverTabScreen() {
  const insets = useSafeAreaInsets();
  const { palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const [mode, setMode] = useState<DiscoverMode>("map");

  return (
    <View style={styles.container}>
      {mode === "map" ? <HomeMapScreen /> : <DiscoverHomeScreen />}

      <View
        pointerEvents="box-none"
        style={[
          styles.toggleWrap,
          {
            bottom: insets.bottom + spacing[6],
            zIndex: zIndex.overlay,
          },
        ]}
      >
        <View
          style={[
            styles.toggleShell,
            {
              ...shadows.floating,
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.pill,
              gap: spacing[1],
              padding: spacing[1],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === "map" }}
            onPress={() => setMode("map")}
            style={[
              styles.togglePill,
              {
                backgroundColor: mode === "map" ? palette.orange : "transparent",
                borderRadius: radii.pill,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              },
            ]}
          >
            <AppText style={{ color: mode === "map" ? palette.white : palette.text, fontWeight: "700" }}>
              Map
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === "explore" }}
            onPress={() => setMode("explore")}
            style={[
              styles.togglePill,
              {
                backgroundColor: mode === "explore" ? palette.orange : "transparent",
                borderRadius: radii.pill,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              },
            ]}
          >
            <AppText style={{ color: mode === "explore" ? palette.white : palette.text, fontWeight: "700" }}>
              Explore
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggleWrap: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  toggleShell: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
  },
  togglePill: {
    alignItems: "center",
    justifyContent: "center",
  },
});
