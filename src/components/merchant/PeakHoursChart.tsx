import React from "react";
import { View } from "react-native";

import { AppText } from "@/components/ui";
import { buildPeakHourStrip } from "@/features/merchant/performanceFormat";
import { formatPeakHour } from "@/features/merchant/merchantReadiness";
import { useHungryTheme } from "@/theme";

const STRIP_HEIGHT = 44;
const AXIS_HOURS: Record<number, string> = { 0: "12 am", 6: "6 am", 12: "12 pm", 18: "6 pm" };

/**
 * The day in 24 columns, Singapore time, with the busiest hours filled in. The server sends which
 * hours are busiest, in order, not a count for every hour, so the strip shows when and not how many.
 */
export function PeakHoursChart({ peakHours }: { peakHours: readonly number[] }) {
  const { palette, radii, spacing } = useHungryTheme();
  const cells = buildPeakHourStrip(peakHours);
  const ordered = cells
    .filter((cell) => cell.isPeak)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((cell) => formatPeakHour(cell.hour));
  const summary =
    ordered.length > 0 ? `Busiest first: ${ordered.join(", ")}` : "No peak-hour data yet.";

  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodySmall" tone="muted">
        {summary}
      </AppText>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Busiest hours of the day. ${summary}`}
        style={{ gap: spacing[1] }}
      >
        <View
          style={{ alignItems: "flex-end", flexDirection: "row", gap: 2, height: STRIP_HEIGHT }}
        >
          {cells.map((cell) => (
            <View
              key={cell.hour}
              testID={`peak-hour-${cell.hour}`}
              style={{
                backgroundColor: cell.isPeak ? palette.info : palette.bgSoft,
                borderRadius: radii.sm,
                flex: 1,
                height: cell.isPeak ? STRIP_HEIGHT : 8,
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 2 }}>
          {cells.map((cell) => (
            <View key={cell.hour} style={{ flex: 1, overflow: "visible" }}>
              <AppText variant="micro" tone="muted" numberOfLines={1} style={{ width: 40 }}>
                {AXIS_HOURS[cell.hour] ?? ""}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
