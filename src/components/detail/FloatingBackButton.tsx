import type { ComponentType } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackSymbol } from "@/components/dish/dishSymbols";
import { PressableScale } from "@/components/ui/PressableScale";
import { tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
  /** The stall page puts Share in the opposite corner with the same round button. */
  icon?: ComponentType<{ color?: string; size?: number }>;
  side?: "left" | "right";
  /**
   * Animated style for the round chip behind the glyph (its opacity). The header fades the chip
   * out as the bar fades in, so no ring or shadow is left over the bar. The glyph stays.
   */
  chipStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
};

/** The only chrome on dish and stall pages: a round back button floating over the photo. */
export function FloatingBackButton({
  onPress,
  accessibilityLabel = "Go back",
  icon: Icon = BackSymbol,
  side = "left",
  chipStyle,
}: Props) {
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={{
        alignItems: "center",
        height: 44,
        justifyContent: "center",
        [side]: spacing[4],
        position: "absolute",
        top: insets.top + spacing[2],
        width: 44,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          shadows.card,
          { backgroundColor: palette.surface, borderRadius: radii.pill },
          chipStyle,
        ]}
      />
      <Icon color={palette.text} size={22} />
    </PressableScale>
  );
}
