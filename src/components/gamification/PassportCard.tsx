/**
 * PassportCard — compact passport progress summary for the profile screen.
 *
 * Shows the first 3 categories with any progress.
 * Tapping navigates to the full PassportScreen.
 */

import { View, Pressable, StyleSheet } from "react-native";
import { ChevronRight, Stamp } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui/AppText";
import { usePassportStore, ALL_PASSPORT_CATEGORIES } from "@/store/usePassportStore";

interface PassportCardProps {
  onPress?: () => void;
}

export function PassportCard({ onPress }: PassportCardProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const progressMap = usePassportStore((s) => s.progressMap);

  // Show categories that have at least some tried stalls, sorted by triedCount desc
  const activeCategories = ALL_PASSPORT_CATEGORIES.filter(
    (cat) => (progressMap[cat.id]?.triedCount ?? 0) > 0,
  )
    .sort((a, b) => (progressMap[b.id]?.triedCount ?? 0) - (progressMap[a.id]?.triedCount ?? 0))
    .slice(0, 3);

  const totalStamps = Object.values(progressMap).reduce(
    (sum, p) => sum + p.earnedStampThresholds.length,
    0,
  );

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
          padding: spacing[4],
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.row, { justifyContent: "space-between", marginBottom: spacing[3] }]}>
        <View style={styles.row}>
          <Stamp size={18} color={palette.orange} style={{ marginRight: spacing[2] }} />
          <AppText variant="bodyBold">Hungry Passport</AppText>
        </View>
        <View style={styles.row}>
          {totalStamps > 0 && (
            <AppText tone="muted" variant="micro" style={{ marginRight: spacing[1] }}>
              {totalStamps} {totalStamps === 1 ? "stamp" : "stamps"}
            </AppText>
          )}
          <ChevronRight size={16} color={palette.textMuted} />
        </View>
      </View>

      {/* Category rows */}
      {activeCategories.length === 0 ? (
        <AppText tone="muted" variant="bodySmall">
          Start exploring to earn your first stamp
        </AppText>
      ) : (
        <View style={{ gap: spacing[2] }}>
          {activeCategories.map((cat) => {
            const progress = progressMap[cat.id];
            if (!progress) return null;
            const nextThreshold = cat.stampThresholds[progress.nextStampIndex] ?? null;
            const current = progress.triedCount;
            const progressFraction = nextThreshold ? current / nextThreshold : 1;

            return (
              <View key={cat.id} style={{ gap: spacing[1] }}>
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <AppText variant="bodySmall">{cat.name}</AppText>
                  <AppText tone="muted" variant="micro">
                    {current}/{nextThreshold ?? current}
                  </AppText>
                </View>
                <View
                  style={{
                    backgroundColor: palette.border,
                    borderRadius: radii.pill,
                    height: 4,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: palette.orange,
                      borderRadius: radii.pill,
                      height: 4,
                      width: `${Math.min(progressFraction * 100, 100)}%`,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {},
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
