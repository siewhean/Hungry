import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check, Search } from "lucide-react-native";

import { AppText, Chip, EmptyState, Input } from "@/components/ui";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag } from "@/types/domain";
import {
  BUDGET_OPTIONS,
  POPULAR_DIETARY_FLAGS,
  SORTED_DIETARY_OPTIONS,
  filterDietaryOptions,
} from "./dietaryOptions";

interface DietaryStepProps {
  selected: DietaryFlag[];
  onToggle: (flag: DietaryFlag) => void;
  onClear: () => void;
  budget: number | undefined;
  onBudgetChange: (value: number | undefined) => void;
  /** false: the slider onboarding asks the budget on its own screen after this one. */
  showBudget?: boolean;
}

/**
 * "Any dietary needs?" and the usual budget: a wrapping grid of chips, "No restrictions" as
 * the empty state, the nine popular diets in view and the other 20 behind "More diets" with a
 * search. The budget sits right below, so it is on screen without scrolling on a normal phone.
 */
export function DietaryStep({
  selected,
  onToggle,
  onClear,
  budget,
  onBudgetChange,
  showBudget = true,
}: DietaryStepProps) {
  const { palette, spacing } = useHungryTheme();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const visible = expanded
    ? searching
      ? filterDietaryOptions(query, selected)
      : SORTED_DIETARY_OPTIONS
    : filterDietaryOptions("", selected);
  const hiddenCount = SORTED_DIETARY_OPTIONS.length - visible.length;

  return (
    <View style={{ gap: spacing[3], paddingHorizontal: spacing[3] }}>
      <AppText variant="bodySmall" tone="muted">
        Allergen details can be incomplete, so always check with the stall.
      </AppText>
      {expanded ? (
        <Input
          placeholder="Search dietary restrictions"
          value={query}
          onChangeText={setQuery}
          leftIcon={<Search color={palette.textMuted} size={16} />}
        />
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {searching ? null : (
          <DietChip
            label="No restrictions"
            accessibilityLabel="Dietary preference None"
            hint="Double tap to clear your dietary preferences"
            selected={selected.length === 0}
            onPress={onClear}
          />
        )}
        {visible.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <DietChip
              key={option.value}
              label={option.label}
              accessibilityLabel={`Dietary preference ${option.label}`}
              hint={
                isSelected
                  ? "Double tap to remove this dietary preference"
                  : "Double tap to add this dietary preference"
              }
              selected={isSelected}
              onPress={() => onToggle(option.value)}
            />
          );
        })}
        {!expanded && hiddenCount > 0 ? (
          <Chip
            label={`More diets (${hiddenCount})`}
            accessibilityLabel={`Show ${hiddenCount} more dietary preferences`}
            onPress={() => setExpanded(true)}
          />
        ) : null}
      </View>
      {searching && visible.length === 0 ? (
        <EmptyState title="No match" body="Try another word, like halal, vegetarian or nuts." />
      ) : null}
      {showBudget ? (
        <>
          <AppText variant="h3" style={{ marginTop: spacing[1] }}>
            Usual budget per dish
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {BUDGET_OPTIONS.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                accessibilityLabel={`Budget ${option.label}`}
                selected={budget === option.value}
                onPress={() => onBudgetChange(option.value)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function DietChip({
  label,
  accessibilityLabel,
  hint,
  selected,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { componentRadii, componentSizes, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      onPress={() => {
        selectHaptic();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={hint}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      style={{
        alignItems: "center",
        backgroundColor: selected ? palette.orangeLight : palette.surface,
        borderColor: selected ? palette.orange : palette.border,
        borderRadius: componentRadii.button,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[1],
        justifyContent: "center",
        minHeight: componentSizes.touchTarget,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
      }}
    >
      {selected ? <Check color={palette.orange} size={14} /> : null}
      <AppText
        style={{
          color: selected ? palette.orange : palette.textSecondary,
          fontWeight: selected ? "700" : "500",
        }}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
