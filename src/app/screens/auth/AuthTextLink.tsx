import { Pressable } from "react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** A plain accent-coloured text action with a 44pt target, for the links under an auth form. */
export function AuthTextLink({
  label,
  onPress,
  disabled = false,
  bold = false,
  hint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  bold?: boolean;
  hint?: string;
}) {
  const { spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[2] }}
    >
      <AppText variant={bold ? "bodyBold" : "body"} tone="accent" style={{ textAlign: "center" }}>
        {label}
      </AppText>
    </Pressable>
  );
}
