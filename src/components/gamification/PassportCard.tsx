/**
 * PassportCard — compact Hungry Passport preview for the profile screen.
 *
 * Uses the orange passport + immigration stamp visual language and keeps the
 * existing progress store as the source of truth.
 */

import { View, Pressable, StyleSheet } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui/AppText";
import { usePassportStore, ALL_PASSPORT_CATEGORIES } from "@/store/usePassportStore";
import { GITHUB_ORANGE, HungryPassportVisual } from "@/components/gamification/HungryPassportVisual";

interface PassportCardProps {
  onPress?: () => void;
}

export function PassportCard({ onPress }: PassportCardProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const progressMap = usePassportStore((s) => s.progressMap);

  const totalStamps = Object.values(progressMap).reduce(
    (sum, p) => sum + p.earnedStampThresholds.length,
    0,
  );
  const triedTotal = Object.values(progressMap).reduce((sum, p) => sum + p.triedCount, 0);
  const activeCategories = ALL_PASSPORT_CATEGORIES.filter(
    (cat) => (progressMap[cat.id]?.triedCount ?? 0) > 0,
  );
  const headline =
    totalStamps > 0
      ? `${totalStamps} ${totalStamps === 1 ? "stamp" : "stamps"} collected`
      : triedTotal > 0
        ? "Passport journey started"
        : "Start exploring to earn your first stamp";

  return (
    <Pressable
      accessibilityLabel="View Hungry Passport"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        shadows.card,
        styles.card,
        {
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderColor: palette.border,
          borderRadius: radii.xl,
          borderWidth: 1,
          padding: spacing[3],
        },
      ]}
    >
      <View style={[styles.row, { justifyContent: "space-between", marginBottom: spacing[3] }]}>
        <View style={{ flex: 1, paddingRight: spacing[2] }}>
          <AppText variant="bodyBold">Hungry Passport</AppText>
          <AppText tone="muted" variant="micro" style={styles.subtitle}>
            {headline}
          </AppText>
        </View>
        <View style={[styles.viewBadge, { backgroundColor: GITHUB_ORANGE }]}> 
          <AppText variant="micro" style={styles.viewBadgeText}>
            VIEW
          </AppText>
          <ChevronRight size={14} color="#FFF6D6" />
        </View>
      </View>

      <HungryPassportVisual
        categories={activeCategories.length > 0 ? activeCategories : ALL_PASSPORT_CATEGORIES}
        progressMap={progressMap}
        variant="card"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {},
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
  subtitle: {
    letterSpacing: 0.4,
    marginTop: 2,
  },
  viewBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 2,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  viewBadgeText: {
    color: "#FFF6D6",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    lineHeight: 12,
  },
});
