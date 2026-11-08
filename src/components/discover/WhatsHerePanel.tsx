import { useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { AppText, RailScrollView } from "@/components/ui";
import {
  cuisineOptions,
  filterHereStalls,
  type HereFilters,
  type HereStall,
} from "@/features/discover/mallMode";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";
import { AppSymbol } from "@/components/ui/AppSymbol";

interface WhatsHerePanelProps {
  placeName: string;
  stalls: HereStall[];
  /** The stall cards for the stalls that pass the filter: the same cards as the other stall rows. */
  renderStalls: (stalls: HereStall[]) => ReactNode;
  /** Opens the full list of the place's stalls; the title gets a chevron when given. */
  onSeeAll?: () => void;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Every stall in the mall, with a food type filter. */
export function WhatsHerePanel({ placeName, stalls, renderStalls, onSeeAll }: WhatsHerePanelProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const [filters, setFilters] = useState<HereFilters>({});
  const cuisines = useMemo(() => cuisineOptions(stalls), [stalls]);
  const visible = useMemo(() => filterHereStalls(stalls, filters), [filters, stalls]);

  const toggleCuisine = (cuisine: string) => {
    selectHaptic();
    setFilters((current) => ({
      ...current,
      cuisine: current.cuisine === cuisine ? undefined : cuisine,
    }));
  };

  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={`${label} filter`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        backgroundColor: selected ? palette.orange : palette.surface,
        borderColor: selected ? palette.orange : palette.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        minHeight: 36,
        justifyContent: "center",
        paddingHorizontal: spacing[3],
      }}
    >
      <AppText
        variant="bodySmallBold"
        style={{ color: selected ? palette.textOnOrange : palette.text }}
      >
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing[3] }} testID="whats-here-panel">
      {onSeeAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all stalls at ${placeName}`}
          hitSlop={8}
          onPress={onSeeAll}
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing[2],
            justifyContent: "space-between",
            minHeight: 44,
          }}
        >
          <AppText variant="h2" style={{ flexShrink: 1 }}>{`Stalls at ${placeName}`}</AppText>
          <AppSymbol
            name="chevron.right"
            fallback={ChevronRight}
            size={20}
            color={palette.textMuted}
          />
        </Pressable>
      ) : (
        <AppText variant="h2">{`Stalls at ${placeName}`}</AppText>
      )}
      {cuisines.length > 0 ? (
        <RailScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            {cuisines.map((cuisine) =>
              chip(titleCase(cuisine), filters.cuisine === cuisine, () => toggleCuisine(cuisine)),
            )}
          </View>
        </RailScrollView>
      ) : null}
      <AppText tone="muted" variant="bodySmall">
        {visible.length === 1 ? "1 stall" : `${visible.length} stalls`}
      </AppText>
      {visible.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            borderColor: palette.border,
            borderRadius: componentRadii.card,
            borderWidth: 1,
            gap: spacing[2],
            padding: spacing[5],
          }}
        >
          <AppText variant="bodyBold">No stalls match</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            onPress={() => setFilters({})}
          >
            <AppText style={{ color: palette.accentText }} variant="bodyBold">
              Clear filters
            </AppText>
          </Pressable>
        </View>
      ) : (
        renderStalls(visible)
      )}
    </View>
  );
}
