import { useMemo } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";

import { StallRailCard } from "@/components/discover/home/StallRailCard";
import { AppText } from "@/components/ui";
import { useItemDetailsState } from "@/features/checklistPortfolio/useItemLabels";
import { networkPickReason, networkSectionTitle } from "@/features/discover/networkPicks";
import { getDataRepository } from "@/lib/services/serviceProvider";
import type { NetworkStallPick } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

/** Fewer than this many named stalls and the rail is left out. */
export const NETWORK_PICKS_MIN = 2;
const NETWORK_PICKS_SHOWN = 8;

/**
 * Home's "Loved by people you follow" rail (or "Loved by diners with your taste" when the diner
 * follows nobody active). Stall names and photos come in one batched read for the whole rail,
 * with the stalls already on the phone painting first; a stall that cannot be named is left out.
 */
export function NetworkPicksSection({
  picks,
  cardWidth,
  gap,
  scrollStyle,
  onOpen,
}: {
  picks: readonly NetworkStallPick[];
  cardWidth: number;
  gap: number;
  /** Home's rails run edge to edge. */
  scrollStyle?: StyleProp<ViewStyle>;
  onOpen: (pick: NetworkStallPick, position: number) => void;
}) {
  const { spacing } = useHungryTheme();
  const shown = useMemo(() => picks.slice(0, NETWORK_PICKS_SHOWN), [picks]);
  const targets = useMemo(() => shown.map((pick) => ({ stallId: pick.venueId })), [shown]);
  const { details } = useItemDetailsState(targets);
  const repository = getDataRepository();

  const cards = shown.flatMap((pick) => {
    const cached = repository.getVenueById(pick.venueId);
    const name = details[pick.venueId]?.name ?? cached?.name;
    if (!name) return [];
    return [
      {
        pick,
        name,
        imageUrl: details[pick.venueId]?.imageUrl ?? cached?.imageUrl ?? undefined,
        logoUrl: cached?.logoUrl,
      },
    ];
  });
  if (cards.length < NETWORK_PICKS_MIN) return null;

  return (
    <View style={{ gap }} testID="home-network-picks">
      <AppText variant="h2" accessibilityRole="header">
        {networkSectionTitle(shown)}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={scrollStyle}
        contentContainerStyle={{ gap: spacing[3] }}
      >
        {cards.map(({ pick, name, imageUrl, logoUrl }, index) => {
          const reason = networkPickReason(pick);
          return (
            <View key={pick.venueId} testID={`home-network-pick-${pick.venueId}`}>
              <StallRailCard
                name={name}
                imageUrl={imageUrl}
                logoUrl={logoUrl}
                note={{ text: reason, accent: true }}
                width={cardWidth}
                accessibilityLabel={`Open ${name}. ${reason}`}
                onPress={() => onOpen(pick, index)}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
