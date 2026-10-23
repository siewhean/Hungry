import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
};

/** The only chrome on dish and stall pages: a round back button floating over the photo. */
export function FloatingBackButton({ onPress, accessibilityLabel = "Go back" }: Props) {
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        shadows.card,
        {
          alignItems: "center",
          backgroundColor: palette.surface,
          borderRadius: radii.pill,
          height: 44,
          justifyContent: "center",
          left: spacing[4],
          position: "absolute",
          top: insets.top + spacing[2],
          transform: [{ scale: pressed ? 0.92 : 1 }],
          width: 44,
        },
      ]}
    >
      <ArrowLeft color={palette.text} size={22} />
    </Pressable>
  );
}
