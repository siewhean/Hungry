import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppSymbol, AppText } from "@/components/ui";
import { SAVED_SORTS, SAVED_SORT_LABELS, type SavedSort } from "@/features/saved/savedDishes";
import { useHungryTheme } from "@/theme";

type Props = {
  value: SavedSort;
  /** False when location is off: Nearest is shown but tells the diner to turn location on. */
  hasLocation: boolean;
  onChange: (sort: SavedSort) => void;
};

/**
 * Sort as a pull-down button (arrow.up.arrow.down) instead of a row of chips. The menu opens
 * under the button as three radio rows with a check on the current one.
 */
export function SavedSortMenu({ value, hasLocation, onChange }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ alignItems: "flex-end", gap: spacing[1] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sort: ${SAVED_SORT_LABELS[value]}`}
        accessibilityHint="Opens the sort options"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[1],
          minHeight: 44,
          paddingHorizontal: spacing[2],
        }}
      >
        <AppSymbol name="sort" color={palette.orange} size={18} />
        <AppText variant="bodySmallBold" style={{ color: palette.orange }}>
          {SAVED_SORT_LABELS[value]}
        </AppText>
      </Pressable>
      {open ? (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Sort saved dishes"
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: componentRadii.card,
            borderWidth: 1,
            minWidth: 200,
            overflow: "hidden",
          }}
        >
          {SAVED_SORTS.map((key) => {
            const selected = key === value;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={
                  key === "nearest" && !hasLocation
                    ? "Nearest. Turn on location to use this."
                    : SAVED_SORT_LABELS[key]
                }
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => {
                  setOpen(false);
                  onChange(key);
                }}
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[2],
                  minHeight: 44,
                  paddingHorizontal: spacing[3],
                }}
              >
                <View style={{ width: 18 }}>
                  {selected ? <AppSymbol name="selected" color={palette.orange} size={16} /> : null}
                </View>
                <AppText variant="body">{SAVED_SORT_LABELS[key]}</AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
