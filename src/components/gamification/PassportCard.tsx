/**
 * PassportCard — compact passport progress summary for the profile screen.
 *
 * Shows the first 3 categories with any progress.
 * Tapping navigates to the full PassportScreen.
 */

import { View, Pressable, StyleSheet } from "react-native";
import { ChevronRight, Stamp } from "lucide-react-native";

import { useMemo } from "react";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui/AppText";
import { usePassportStore, ALL_PASSPORT_CATEGORIES } from "@/store/usePassportStore";
import { PassportStampBadge } from "@/components/gamification/PassportStampBadge";
import { getEarnedPassportStamps, getNextPassportStamp } from "@/constants/passportConfig";

interface PassportCardProps {
  onPress?: () => void;
  onPressIn?: () => void;
}

export function PassportCard({ onPress, onPressIn }: PassportCardProps) {
  const { componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const progressMap = usePassportStore((s) => s.progressMap);
  const earnedStamps = useMemo(() => getEarnedPassportStamps(progressMap), [progressMap]);
  const nextStamp = useMemo(() => getNextPassportStamp(progressMap), [progressMap]);

  // Show categories that have at least some tried stalls, sorted by triedCount desc
  const activeCategories = useMemo(() => {
    const filtered = ALL_PASSPORT_CATEGORIES.filter(
      (cat) => (progressMap[cat.id]?.triedCount ?? 0) > 0,
    );
    const sorted = [...filtered].sort(
      (a, b) => (progressMap[b.id]?.triedCount ?? 0) - (progressMap[a.id]?.triedCount ?? 0),
    );
    return sorted.slice(0, 3);
  }, [progressMap]);

  const totalStamps = earnedStamps.length;

  return (
    <Pressable
      accessibilityLabel="View Hungry Passport"
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [
        shadows.card,
        styles.card,
        {
          backgroundColor: pressed ? palette.orangeLight : palette.surface,
          borderColor: totalStamps > 0 ? palette.orange : palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          padding: spacing[4],
          gap: spacing[3],
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.row, { justifyContent: "space-between" }]}>
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

      <View
        style={[
          styles.coverStrip,
          {
            backgroundColor: palette.orange,
            borderColor: palette.orangeDark,
            borderRadius: radii.md,
            gap: spacing[2],
            padding: spacing[3],
          },
        ]}
      >
        <View style={styles.coverCopy}>
          <AppText variant="micro" style={{ color: palette.textOnPrimary, fontWeight: "800" }}>
            FOOD TRAILS
          </AppText>
          <AppText variant="bodySmallBold" style={{ color: palette.textOnPrimary }}>
            Stamp your Singapore eats
          </AppText>
        </View>
        {earnedStamps.slice(0, 2).map((stamp) => (
          <PassportStampBadge key={stamp.id} stamp={stamp} earned size="sm" />
        ))}
      </View>

      {/* Category rows */}
      {activeCategories.length === 0 ? (
        <View style={{ gap: spacing[1] }}>
          <AppText tone="muted" variant="bodySmall">
            Start exploring to earn your first stamp
          </AppText>
          {nextStamp ? (
            <AppText variant="micro" style={{ color: palette.orange }}>
              Next: {nextStamp.category.name}
            </AppText>
          ) : null}
        </View>
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
  coverCopy: {
    flex: 1,
  },
  coverStrip: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
