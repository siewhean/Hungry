import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";

export function MapSurface({ children }: PropsWithChildren) {
  const { palette } = useHungryTheme();

  return (
    <View style={[styles.surface, { backgroundColor: palette.mapBg }]} accessibilityLabel="Map surface">
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    overflow: "hidden",
  },
});

