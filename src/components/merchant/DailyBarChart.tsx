import React from "react";
import { View } from "react-native";

import { AppText } from "@/components/ui";
import { buildDailyBars, describeDailySeries } from "@/features/merchant/performanceFormat";
import { useHungryTheme } from "@/theme";
import type { MerchantDailyPoint } from "@/types/domain";

const CHART_HEIGHT = 120;

/** Profile visits per Singapore day as bars. Each bar is a labelled image for screen readers. */
export function DailyBarChart({ series }: { series: readonly MerchantDailyPoint[] }) {
  const { palette, spacing, radii } = useHungryTheme();
  const bars = buildDailyBars(series);
  const summary = describeDailySeries(series);
  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodySmall" tone="muted">
        {summary}
      </AppText>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Profile visits per day. ${summary}`}
        style={{
          alignItems: "flex-end",
          flexDirection: "row",
          gap: bars.length > 14 ? 2 : spacing[1],
          height: CHART_HEIGHT,
        }}
      >
        {bars.map((bar) => (
          <View key={bar.date} style={{ flex: 1, height: "100%", justifyContent: "flex-end" }}>
            <View
              testID={`daily-bar-${bar.date}`}
              style={{
                backgroundColor: bar.value > 0 ? palette.orange : palette.bgSoft,
                borderRadius: radii.sm,
                height: Math.max(bar.value > 0 ? 4 : 2, Math.round(bar.ratio * CHART_HEIGHT)),
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: bars.length > 14 ? 2 : spacing[1] }}>
        {bars.map((bar) => (
          <View key={bar.date} style={{ alignItems: "center", flex: 1 }}>
            <AppText variant="micro" tone="muted" numberOfLines={1}>
              {bar.axisLabel}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
