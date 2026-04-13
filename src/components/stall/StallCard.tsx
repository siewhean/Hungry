import { Pressable, StyleSheet, View } from "react-native";
import { Clock3, MapPinned } from "lucide-react-native";

import type { VenueSummary, DishSummary } from "@/types/domain";
import { useHungryTheme } from "@/theme";
import { AppText, Badge, Card } from "../ui";
import { HygieneGradeBadge } from "./HygieneGradeBadge";

interface StallCardProps {
  venue: VenueSummary;
  topDish?: DishSummary;
  onPress?: () => void;
}

export function StallCard({ venue, topDish, onPress }: StallCardProps) {
  const { palette, spacing } = useHungryTheme();
  const styles = createStyles(spacing);

  return (
    <Card style={{ padding: spacing[3] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${venue.name}, unit ${venue.unitNumber}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          {
            opacity: pressed ? 0.96 : 1,
          },
        ]}
      >
        <View style={{ flex: 1, gap: spacing[2] }}>
          <View style={{ gap: spacing[1] }}>
            <AppText variant="h3">{venue.name}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {venue.unitNumber} · {venue.floor}
            </AppText>
          </View>
          <View style={styles.metaRow}>
            <HygieneGradeBadge grade={venue.hygieneGrade} />
            <Badge label={venue.isOpen ? "Open" : "Closed"} tone={venue.isOpen ? "success" : "warning"} />
          </View>
          <View style={styles.infoRow}>
            <Clock3 size={14} color={palette.textMuted} />
            <AppText variant="bodySmall" tone="secondary">
              {venue.operatingHours}
            </AppText>
          </View>
          {topDish ? (
            <View style={styles.infoRow}>
              <MapPinned size={14} color={palette.orange} />
              <AppText variant="bodySmall" tone="secondary">
                Top dish: {topDish.name}
              </AppText>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Card>
  );
}

const createStyles = (spacing: ReturnType<typeof useHungryTheme>["spacing"]) => StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1],
  },
});

