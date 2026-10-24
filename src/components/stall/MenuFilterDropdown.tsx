import { useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react-native";

import { AppText } from "@/components/ui/AppText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

export type MenuDietaryOption = { flag: string; label: string; dishCount: number };

type Props = {
  categories: readonly string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  /** The "show everything" category, e.g. "All". */
  allCategory: string;
  dietaryOptions: readonly MenuDietaryOption[];
  activeDietaryFlags: readonly string[];
  onDietaryFlagsChange: (flags: string[]) => void;
  /** Dishes the current filters leave, for the sheet's "Show N dishes" button. */
  resultCount: number;
};

/** "All dishes" / "Noodles · Vegetarian" / "Noodles +2". */
export function menuFilterSummary(
  activeCategory: string,
  allCategory: string,
  dietaryLabels: readonly string[],
): string {
  const parts = [activeCategory === allCategory ? "All dishes" : activeCategory];
  if (dietaryLabels.length === 1) parts.push(dietaryLabels[0]);
  if (dietaryLabels.length > 1) return `${parts[0]} +${dietaryLabels.length}`;
  return parts.join(" · ");
}

/**
 * One dropdown for the stall menu: pick a category and any dietary needs in a sheet,
 * instead of two rows of chips.
 */
export function MenuFilterDropdown({
  categories,
  activeCategory,
  onCategoryChange,
  allCategory,
  dietaryOptions,
  activeDietaryFlags,
  onDietaryFlagsChange,
  resultCount,
}: Props) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const activeLabels = dietaryOptions
    .filter((option) => activeDietaryFlags.includes(option.flag))
    .map((option) => option.label);
  const summary = menuFilterSummary(activeCategory, allCategory, activeLabels);
  const filtered = activeCategory !== allCategory || activeDietaryFlags.length > 0;

  const toggleFlag = (flag: string) => {
    selectHaptic();
    onDietaryFlagsChange(
      activeDietaryFlags.includes(flag)
        ? activeDietaryFlags.filter((value) => value !== flag)
        : [...activeDietaryFlags, flag],
    );
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Filter menu, ${summary}`}
        accessibilityHint="Opens category and dietary filters"
        onPress={() => sheetRef.current?.present()}
        style={({ pressed }) => ({
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: filtered ? palette.orangeLight : palette.surface,
          borderColor: filtered ? palette.orange : palette.border,
          borderRadius: radii.pill,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing[2],
          minHeight: 44,
          paddingHorizontal: spacing[4],
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <SlidersHorizontal color={filtered ? palette.orange : palette.text} size={16} />
        <AppText variant="bodySmallBold">{summary}</AppText>
        <ChevronDown color={palette.textMuted} size={16} />
      </Pressable>

      <BottomSheet ref={sheetRef} accessibilityLabel="Filter menu" snapPoints={["70%"]}>
        <ScrollView contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[4] }}>
          <View
            style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
          >
            <AppText variant="h2">Filter menu</AppText>
            {filtered ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
                hitSlop={8}
                onPress={() => {
                  selectHaptic();
                  onCategoryChange(allCategory);
                  onDietaryFlagsChange([]);
                }}
                style={{ justifyContent: "center", minHeight: 44 }}
              >
                <AppText variant="bodySmallBold" tone="accent">
                  Clear
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <View style={{ gap: spacing[1] }}>
            <AppText variant="bodySmallBold" tone="secondary">
              Category
            </AppText>
            {categories.map((category) => {
              const selected = category === activeCategory;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={category === allCategory ? "All dishes" : category}
                  onPress={() => {
                    selectHaptic();
                    onCategoryChange(category);
                  }}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: pressed ? palette.bgSoft : "transparent",
                    borderRadius: componentRadii.input,
                    flexDirection: "row",
                    minHeight: 48,
                    paddingHorizontal: spacing[2],
                  })}
                >
                  <AppText variant={selected ? "bodyBold" : "body"} style={{ flex: 1 }}>
                    {category === allCategory ? "All dishes" : category}
                  </AppText>
                  {selected ? <Check color={palette.orange} size={18} /> : null}
                </Pressable>
              );
            })}
          </View>

          {dietaryOptions.length > 0 ? (
            <View style={{ gap: spacing[1] }}>
              <AppText variant="bodySmallBold" tone="secondary">
                Dietary
              </AppText>
              {dietaryOptions.map((option) => {
                const checked = activeDietaryFlags.includes(option.flag);
                return (
                  <Pressable
                    key={option.flag}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`${option.label}, ${option.dishCount} ${option.dishCount === 1 ? "dish" : "dishes"}`}
                    onPress={() => toggleFlag(option.flag)}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: pressed ? palette.bgSoft : "transparent",
                      borderRadius: componentRadii.input,
                      flexDirection: "row",
                      gap: spacing[3],
                      minHeight: 48,
                      paddingHorizontal: spacing[2],
                    })}
                  >
                    <View
                      style={{
                        alignItems: "center",
                        backgroundColor: checked ? palette.orange : "transparent",
                        borderColor: checked ? palette.orange : palette.textMuted,
                        borderRadius: 6,
                        borderWidth: 1.5,
                        height: 22,
                        justifyContent: "center",
                        width: 22,
                      }}
                    >
                      {checked ? <Check color={palette.textOnOrange} size={14} /> : null}
                    </View>
                    <AppText variant="body" style={{ flex: 1 }}>
                      {option.label}
                    </AppText>
                    <AppText variant="bodySmall" tone="muted">
                      {option.dishCount}
                    </AppText>
                  </Pressable>
                );
              })}
              <AppText variant="micro" tone="muted">
                Labels come from the stall or our catalogue. Check with the stall if it matters to
                you.
              </AppText>
            </View>
          ) : null}

          <Button
            label={resultCount === 1 ? "Show 1 dish" : `Show ${resultCount} dishes`}
            onPress={() => sheetRef.current?.dismiss()}
          />
        </ScrollView>
      </BottomSheet>
    </>
  );
}
