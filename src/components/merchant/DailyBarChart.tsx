import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui";
import { selectHaptic } from "@/lib/haptics";
import { buildDailyBars, describeDailySeries } from "@/features/merchant/performanceFormat";
import { useHungryTheme } from "@/theme";
import type { MerchantDailyPoint } from "@/types/domain";

const CHART_HEIGHT = 120;

/**
 * Profile visits per Singapore day as bars. With `previous` (the same number of days before),
 * a lighter bar behind each day shows that day of the period before. Tap a bar to read its
 * number; each bar is a button with its own spoken label.
 */
export function DailyBarChart({
  series,
  previous,
}: {
  series: readonly MerchantDailyPoint[];
  previous?: readonly MerchantDailyPoint[] | null;
}) {
  const { palette, spacing, radii } = useHungryTheme();
  const bars = buildDailyBars(series, previous);
  const compared = bars.some((bar) => bar.previousValue !== undefined);
  const summary = describeDailySeries(series);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = bars.find((bar) => bar.date === selectedDate);
  const gap = bars.length > 14 ? 2 : spacing[1];

  // A new range or a refresh draws a different chart: drop the old selection.
  useEffect(() => setSelectedDate(null), [series]);

  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodySmall" tone="muted" accessibilityLiveRegion="polite">
        {selected ? selected.accessibilityLabel : summary}
      </AppText>
      <View style={{ alignItems: "flex-end", flexDirection: "row", gap, height: CHART_HEIGHT }}>
        {bars.map((bar) => {
          const dimmed = selected !== undefined && selected.date !== bar.date;
          return (
            <Pressable
              key={bar.date}
              accessibilityRole="button"
              accessibilityLabel={bar.accessibilityLabel}
              accessibilityState={{ selected: selected?.date === bar.date }}
              onPress={() => {
                selectHaptic();
                setSelectedDate((current) => (current === bar.date ? null : bar.date));
              }}
              style={{ flex: 1, height: "100%", justifyContent: "flex-end" }}
            >
              {bar.previousValue !== undefined ? (
                <View
                  testID={`daily-prev-${bar.date}`}
                  style={{
                    backgroundColor: palette.border,
                    borderRadius: radii.sm,
                    bottom: 0,
                    height: Math.max(2, Math.round(bar.previousRatio * CHART_HEIGHT)),
                    left: 0,
                    position: "absolute",
                    right: 0,
                  }}
                />
              ) : null}
              <View
                testID={`daily-bar-${bar.date}`}
                style={{
                  backgroundColor: bar.value > 0 ? palette.orange : palette.bgSoft,
                  borderRadius: radii.sm,
                  height: Math.max(bar.value > 0 ? 4 : 2, Math.round(bar.ratio * CHART_HEIGHT)),
                  opacity: dimmed ? 0.45 : 1,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap }}>
        {bars.map((bar) => (
          <View key={bar.date} style={{ alignItems: "center", flex: 1 }}>
            <AppText variant="micro" tone="muted" numberOfLines={1}>
              {bar.axisLabel}
            </AppText>
          </View>
        ))}
      </View>
      {compared ? (
        <AppText variant="micro" tone="muted">
          Grey bars are the same days in the period before.
        </AppText>
      ) : null}
    </View>
  );
}
