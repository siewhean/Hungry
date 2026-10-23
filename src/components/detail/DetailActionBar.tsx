import type { ComponentType } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/AppText";
import { confirmHaptic, tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

export type DetailAction = {
  id: string;
  label: string;
  /** Lucide-style icon: receives size, color and an optional fill. */
  icon: ComponentType<{ size?: number; color?: string; fill?: string }>;
  onPress: () => void;
  /** True once the diner has done this (saved, liked, tried): shown in the brand colour. */
  active?: boolean;
  /** Fill the icon when active (bookmark, heart). */
  fillWhenActive?: boolean;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** "checkbox" for a tried toggle; defaults to button. */
  role?: "button" | "checkbox";
};

type Props = {
  actions: DetailAction[];
  testID?: string;
};

/**
 * The sticky bottom bar on dish and stall pages: icon over a short label, evenly spaced on a white
 * bar. Turning an action on plays a soft confirm; opening something plays a light tap.
 */
export function DetailActionBar({ actions, testID }: Props) {
  const { palette, spacing, typography } = useHungryTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: palette.surface,
        borderTopColor: palette.border,
        borderTopWidth: 1,
        bottom: 0,
        flexDirection: "row",
        left: 0,
        paddingBottom: Math.max(insets.bottom, spacing[3]),
        paddingHorizontal: spacing[2],
        paddingTop: spacing[2],
        position: "absolute",
        right: 0,
      }}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const color = action.active ? palette.orange : palette.text;
        return (
          <Pressable
            key={action.id}
            accessibilityHint={action.accessibilityHint}
            accessibilityLabel={action.accessibilityLabel ?? action.label}
            accessibilityRole={action.role ?? "button"}
            accessibilityState={
              action.role === "checkbox"
                ? { checked: Boolean(action.active), disabled: action.disabled }
                : { selected: Boolean(action.active), disabled: action.disabled }
            }
            disabled={action.disabled || action.loading}
            onPress={() => {
              if (action.fillWhenActive || action.role === "checkbox") {
                if (!action.active) confirmHaptic();
                else tapHaptic();
              } else {
                tapHaptic();
              }
              action.onPress();
            }}
            style={({ pressed }) => ({
              alignItems: "center",
              flex: 1,
              gap: spacing[1],
              justifyContent: "center",
              minHeight: 48,
              opacity: pressed ? 0.7 : action.disabled ? 0.5 : 1,
              paddingVertical: spacing[1],
            })}
          >
            {action.loading ? (
              <ActivityIndicator color={palette.orange} size="small" />
            ) : (
              <Icon
                color={color}
                fill={action.active && action.fillWhenActive ? palette.orange : "none"}
                size={22}
              />
            )}
            <AppText
              numberOfLines={1}
              style={{
                ...typography.micro,
                color,
                fontWeight: action.active ? "700" : "500",
              }}
            >
              {action.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
