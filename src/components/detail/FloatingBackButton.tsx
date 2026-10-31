import type { ComponentType } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
  /** The stall page puts Share in the opposite corner with the same round button. */
  icon?: ComponentType<{ color?: string; size?: number }>;
  side?: "left" | "right";
};

/** The only chrome on dish and stall pages: a round back button floating over the photo. */
export function FloatingBackButton({
  onPress,
  accessibilityLabel = "Go back",
  icon: Icon = ArrowLeft,
  side = "left",
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
      style={[
        shadows.card,
        {
          alignItems: "center",
          backgroundColor: palette.surface,
          borderRadius: radii.pill,
          height: 44,
          justifyContent: "center",
          [side]: spacing[4],
          position: "absolute",
          top: insets.top + spacing[2],
          width: 44,
        },
      ]}
    >
      <Icon color={palette.text} size={22} />
    </PressableScale>
  );
}
