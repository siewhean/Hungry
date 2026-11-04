import { Pressable, View } from "react-native";

import { AppSymbol, AppText } from "@/components/ui";
import type { VenueSummary } from "@/types/domain";
import { useHungryTheme } from "@/theme";

const MAX_STALLS = 5;

type Props = {
  stalls: readonly VenueSummary[];
  onReview: (stall: VenueSummary) => void;
};

/**
 * The Reviews tab before anyone has reviewed: the stalls the diner has been to, each one tap from
 * its review, so the empty tab is a to-do list rather than a dead end. Nothing without visits.
 */
export function ReviewFirstList({ stalls, onReview }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const shown = stalls.slice(0, MAX_STALLS);
  if (shown.length === 0) return null;
  return (
    <View style={{ gap: spacing[2], paddingHorizontal: spacing[4] }} testID="review-first-list">
      <AppText variant="h3" accessibilityRole="header">
        Places you have been
      </AppText>
      {shown.map((stall) => (
        <Pressable
          key={stall.id}
          accessibilityRole="button"
          accessibilityLabel={`Review ${stall.name}`}
          onPress={() => onReview(stall)}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: palette.bgSoft,
            borderRadius: radii.md,
            flexDirection: "row",
            gap: spacing[3],
            minHeight: 56,
            opacity: pressed ? 0.7 : 1,
            paddingHorizontal: spacing[3],
          })}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold" numberOfLines={1}>
              {stall.name}
            </AppText>
            {stall.buildingName || stall.address ? (
              <AppText variant="micro" tone="secondary" numberOfLines={1}>
                {stall.buildingName || stall.address}
              </AppText>
            ) : null}
          </View>
          <AppText variant="bodySmallBold" tone="accent">
            Review
          </AppText>
          <AppSymbol name="chevronRight" size={16} color={palette.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}
