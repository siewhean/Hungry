import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useHungryTheme } from "@/theme";
import { Chip } from "./Chip";
import type { FilterChipRailOption } from "./FilterChipRail";

interface ChipGroupProps<T extends string = string> {
  options: readonly FilterChipRailOption<T>[];
  selectedId?: T;
  selectedIds?: readonly T[];
  onSelect?: (id: T) => void;
  renderLeftIcon?: (option: FilterChipRailOption<T>, selected: boolean) => ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ChipGroup<T extends string = string>({
  options,
  selectedId,
  selectedIds,
  onSelect,
  renderLeftIcon,
  style,
}: ChipGroupProps<T>) {
  const { spacing } = useHungryTheme();

  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }, style]}>
      {options.map((option) => {
        const selected =
          selectedId === option.id || Boolean(selectedIds?.some((id) => id === option.id));

        return (
          <Chip
            key={option.id}
            label={option.label}
            accessibilityLabel={option.accessibilityLabel}
            selected={selected}
            onPress={onSelect ? () => onSelect(option.id) : undefined}
            leftIcon={renderLeftIcon ? renderLeftIcon(option, selected) : option.leftIcon}
          />
        );
      })}
    </View>
  );
}
