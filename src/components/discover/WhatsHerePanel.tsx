import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { AccessibleImage, AppText } from "@/components/ui";
import {
  PRICE_BANDS,
  cuisineOptions,
  filterHereStalls,
  stallPriceLabel,
  type HereFilters,
  type HereStall,
  type PriceBandId,
} from "@/features/discover/mallMode";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

interface WhatsHerePanelProps {
  placeName: string;
  stalls: HereStall[];
  /** One short line for the stall row, for example "Open now · 01-12". */
  getStallMeta: (stall: HereStall) => string;
  onOpenStall: (venueId: string) => void;
  onPrefetchStall?: (stall: HereStall) => void;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Every stall in the mall, with cuisine and price filters. */
export function WhatsHerePanel({
  placeName,
  stalls,
  getStallMeta,
  onOpenStall,
  onPrefetchStall,
}: WhatsHerePanelProps) {
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
  const togglePrice = (band: PriceBandId) => {
    selectHaptic();
    setFilters((current) => ({
      ...current,
      priceBand: current.priceBand === band ? undefined : band,
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
      <AppText variant="h2">{`All stalls at ${placeName}`}</AppText>
      {cuisines.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            {cuisines.map((cuisine) =>
              chip(titleCase(cuisine), filters.cuisine === cuisine, () => toggleCuisine(cuisine)),
            )}
          </View>
        </ScrollView>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          {PRICE_BANDS.map((band) =>
            chip(band.label, filters.priceBand === band.id, () => togglePrice(band.id)),
          )}
        </View>
      </ScrollView>
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
        visible.map((stall) => {
          const imageUrl = stall.venue.imageUrl ?? stall.topDish?.imageUrl;
          const price = stallPriceLabel(stall);
          return (
            <Pressable
              key={stall.venue.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${stall.venue.name}`}
              onPress={() => onOpenStall(stall.venue.id)}
              onPressIn={() => onPrefetchStall?.(stall)}
              style={{
                alignItems: "center",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing[3],
                padding: spacing[3],
              }}
            >
              <View
                style={{
                  backgroundColor: palette.bgSoft,
                  borderRadius: componentRadii.card,
                  height: 64,
                  overflow: "hidden",
                  width: 64,
                }}
              >
                {imageUrl ? (
                  <AccessibleImage
                    source={{ uri: imageUrl }}
                    decorative
                    contentFit="cover"
                    style={{ height: "100%", width: "100%" }}
                  />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyBold" numberOfLines={1}>
                  {stall.venue.name}
                </AppText>
                <AppText variant="micro" tone="secondary" numberOfLines={1}>
                  {getStallMeta(stall)}
                </AppText>
                {price ? (
                  <AppText variant="bodySmallBold" style={{ color: palette.accentText }}>
                    {price}
                  </AppText>
                ) : null}
              </View>
              <ChevronRight size={20} color={palette.textMuted} />
            </Pressable>
          );
        })
      )}
    </View>
  );
}
