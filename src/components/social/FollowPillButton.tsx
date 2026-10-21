import { Pressable, type StyleProp, type ViewStyle } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useHungryTheme } from "@/theme";

interface FollowPillButtonProps {
  label: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Already following or requested: a quiet surface button instead of the orange call to action. */
  muted?: boolean;
  minWidth?: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Follow / Following / Requested pill shared by profiles and the follower lists. */
export function FollowPillButton({
  label,
  accessibilityLabel,
  accessibilityHint,
  muted = false,
  minWidth = 78,
  onPress,
  style,
}: FollowPillButtonProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // With the 8pt hitSlop the tap target is at least 44pt.
      hitSlop={8}
      onPress={onPress}
      style={[
        {
          alignItems: "center",
          backgroundColor: muted ? palette.surface : palette.orange,
          borderColor: muted ? palette.border : palette.orange,
          borderRadius: componentRadii.button,
          borderWidth: 1,
          justifyContent: "center",
          minHeight: 36,
          minWidth,
          paddingHorizontal: spacing[3],
        },
        style,
      ]}
    >
      {/* Text on orange uses textOnOrange: white on orange is below 4.5:1 contrast. */}
      <AppText
        variant="micro"
        style={{ color: muted ? palette.text : palette.textOnOrange, fontWeight: "800" }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
