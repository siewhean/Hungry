import { StyleSheet, View, type ViewProps } from "react-native";

import { useHungryTheme } from "@/theme";

interface CardProps extends ViewProps {}

export function Card({ children, style, ...props }: CardProps) {
  const { palette, radii, shadows, spacing } = useHungryTheme();

  return (
    <View
      style={[
        styles.card,
        {
          ...shadows.card,
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
          padding: spacing[5],
          gap: spacing[4],
        },
        style,
      ]}
      {...props}
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
