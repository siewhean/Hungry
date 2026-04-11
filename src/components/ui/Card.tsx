import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useHungryTheme } from "@/theme";

interface CardProps {
  style?: ViewStyle | ViewStyle[];
}

export function Card({ children, style }: PropsWithChildren<CardProps>) {
  const { palette, radii, shadows, spacing } = useHungryTheme();

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
          padding: spacing[5],
          gap: spacing[4],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
