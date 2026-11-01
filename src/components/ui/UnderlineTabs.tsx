import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

export type UnderlineTab<T extends string> = {
  value: T;
  label: string;
  /** Read by screen readers instead of the label, e.g. "Show dishes". */
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  tabs: readonly UnderlineTab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers. */
  accessibilityLabel: string;
  /** Tabs share the full width (a top bar). Off, they sit together in the middle. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const UNDERLINE_WIDTH = 28;

/**
 * Text tabs with a short underline under the chosen one, the way TikTok and Instagram show
 * sections ("Following | For You"). Each tab is a 44pt target and a tick of haptic confirms a
 * change.
 */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  accessibilityLabel,
  fill = false,
  style,
  testID,
}: Props<T>) {
  const { palette, spacing } = useHungryTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          borderBottomColor: palette.border,
          borderBottomWidth: 1,
          flexDirection: "row",
          justifyContent: fill ? undefined : "center",
          gap: fill ? 0 : spacing[6],
        },
        style,
      ]}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => {
              if (selected) return;
              selectHaptic();
              onChange(tab.value);
            }}
            style={{
              alignItems: "center",
              flex: fill ? 1 : undefined,
              justifyContent: "center",
              minHeight: 44,
              paddingHorizontal: fill ? spacing[2] : 0,
            }}
          >
            <AppText
              variant={selected ? "bodyBold" : "body"}
              numberOfLines={1}
              style={{ color: selected ? palette.text : palette.textSecondary }}
            >
              {tab.label}
            </AppText>
            <View
              style={{
                backgroundColor: selected ? palette.orange : "transparent",
                borderRadius: 1,
                bottom: 0,
                height: 2,
                position: "absolute",
                width: UNDERLINE_WIDTH,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
