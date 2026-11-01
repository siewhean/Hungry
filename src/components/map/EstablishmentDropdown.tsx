import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { AppSymbol, AppText } from "@/components/ui";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

/** The kinds of place a stall can sit in, as the catalog names them. */
export const ESTABLISHMENT_OPTIONS = [
  { value: "hawker_centre", label: "Hawker centre" },
  { value: "food_court", label: "Food court" },
  { value: "kopitiam", label: "Kopitiam" },
  { value: "mall", label: "Mall" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "bar_bistro", label: "Bar and bistro" },
  { value: "standalone", label: "Standalone shop" },
] as const;

/** The chip's label: the one chosen kind, a count, or the prompt. */
export function establishmentChipLabel(selected: readonly string[]): string {
  if (selected.length === 0) return "Place type";
  if (selected.length === 1) {
    return ESTABLISHMENT_OPTIONS.find((option) => option.value === selected[0])?.label ?? "1 type";
  }
  return `${selected.length} place types`;
}

/**
 * A dropdown of checkboxes under the map's filter chips: tick any number of place types and the
 * map narrows at once. "Clear" empties the choice; the chip toggles it open and closed.
 */
export function EstablishmentDropdown({
  selected,
  onChange,
}: {
  selected: readonly string[];
  onChange: (types: string[]) => void;
}) {
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const toggle = (value: string) => {
    selectHaptic();
    onChange(
      selected.includes(value) ? selected.filter((type) => type !== value) : [...selected, value],
    );
  };
  return (
    <View
      accessibilityLabel="Place types"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        overflow: "hidden",
        ...shadows.floating,
      }}
      testID="establishment-dropdown"
    >
      {ESTABLISHMENT_OPTIONS.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            onPress={() => toggle(option.value)}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[3],
              minHeight: 44,
              paddingHorizontal: spacing[4],
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: checked ? palette.orange : "transparent",
                borderColor: checked ? palette.orange : palette.border,
                borderRadius: 6,
                borderWidth: 1.5,
                height: 22,
                justifyContent: "center",
                width: 22,
              }}
            >
              {checked ? (
                <AppSymbol
                  name="checkmark"
                  fallback={Check}
                  color={palette.textOnOrange}
                  size={14}
                />
              ) : null}
            </View>
            <AppText style={{ flex: 1 }}>{option.label}</AppText>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityLabel="Clear place types"
        accessibilityRole="button"
        accessibilityState={{ disabled: selected.length === 0 }}
        disabled={selected.length === 0}
        onPress={() => {
          selectHaptic();
          onChange([]);
        }}
        style={{
          alignItems: "center",
          borderTopColor: palette.border,
          borderTopWidth: 1,
          justifyContent: "center",
          minHeight: 44,
          opacity: selected.length === 0 ? 0.4 : 1,
        }}
      >
        <AppText tone="accent" style={{ fontWeight: "700" }}>
          Clear
        </AppText>
      </Pressable>
    </View>
  );
}
