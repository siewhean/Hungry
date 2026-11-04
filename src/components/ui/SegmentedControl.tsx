import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import { AppSymbol, type AppSymbolName } from "./AppSymbol";
import { AppText } from "./AppText";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Read by screen readers instead of the label, e.g. "Want to try, 12 dishes". */
  accessibilityLabel?: string;
  /** Draws this symbol instead of the label (the label still names it for screen readers). */
  icon?: AppSymbolName;
  /** Fires as the finger lands, before the choice is made (for example to warm up a screen). */
  onPressIn?: () => void;
};

type Props<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Show dishes you want to try or have tried". */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Tighter segments sized by their label, for a control that shares a row with others. */
  compact?: boolean;
};

/**
 * Two or three views of the same data, as one rounded track with a raised thumb under the
 * chosen segment (the iOS segmented control look on every platform). Each segment is a 44pt
 * target and a tick of haptic confirms a change.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
  testID,
  compact = false,
}: Props<T>) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          backgroundColor: palette.bgSoft,
          borderRadius: componentRadii.button,
          flexDirection: "row",
          padding: 2,
        },
        // A compact control is as wide as its segments and never stretches to fill a row: a
        // grow-able segment inside an auto-width track fills the whole space it is offered.
        compact && { flexGrow: 0, flexShrink: 0 },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            onPressIn={option.onPressIn}
            onPress={() => {
              if (selected) return;
              selectHaptic();
              onChange(option.value);
            }}
            style={{
              alignItems: "center",
              backgroundColor: selected ? palette.surface : "transparent",
              borderColor: selected ? palette.border : "transparent",
              borderRadius: componentRadii.button - 2,
              borderWidth: 1,
              // Compact segments share the row by content, so a long label is not cut short. An
              // icon segment is a fixed 44pt target that never grows.
              ...(option.icon
                ? { flexBasis: "auto", flexGrow: 0, flexShrink: 0 }
                : compact
                  ? { flexBasis: "auto", flexGrow: 1, flexShrink: 1 }
                  : { flex: 1 }),
              justifyContent: "center",
              minHeight: 44 - 4,
              minWidth: option.icon ? 44 : undefined,
              paddingHorizontal: compact ? spacing[1] : spacing[2],
            }}
          >
            {option.icon ? (
              <AppSymbol
                name={option.icon}
                color={selected ? palette.orange : palette.textSecondary}
                size={18}
              />
            ) : (
              <AppText
                variant={selected ? "bodySmallBold" : "bodySmall"}
                numberOfLines={1}
                style={{ color: selected ? palette.text : palette.textSecondary }}
              >
                {option.label}
              </AppText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
