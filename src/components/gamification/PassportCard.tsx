/**
 * PassportCard — the profile's Hungry Passport, drawn like an explorer's travel passport:
 * a dark cover with a gold crest, an open page of stamp slots and trail progress.
 *
 * Shows the first 3 categories with any progress.
 * Tapping navigates to the full PassportScreen.
 */

import { Platform, View, Pressable, StyleSheet } from "react-native";
import { ChevronRight, Compass, Stamp } from "lucide-react-native";

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
  // Three stamp slots on the open page: earned stamps first, then empty dashed rings.
  const slots = Array.from({ length: STAMP_SLOTS }, (_, index) => earnedStamps[index]);

  return (
    <Pressable
      accessibilityLabel="View Hungry Passport"
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [
        shadows.card,
        {
          backgroundColor: palette.passportCover,
          borderRadius: componentRadii.card,
          gap: spacing[3],
          opacity: pressed ? 0.92 : 1,
          padding: spacing[4],
        },
      ]}
    >
      {/* Cover: gold foil crest and title, like a travel passport */}
      <View style={[styles.row, { gap: spacing[3] }]}>
        <View
          style={{
            alignItems: "center",
            borderColor: palette.passportGold,
            borderRadius: radii.pill,
            borderWidth: 2,
            height: 52,
            justifyContent: "center",
            width: 52,
          }}
        >
          <Compass size={28} color={palette.passportGold} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText
            variant="bodyBold"
            style={{ color: palette.passportGold, letterSpacing: 3, textTransform: "uppercase" }}
          >
            Hungry Passport
          </AppText>
          <AppText variant="micro" style={{ color: palette.passportGold, letterSpacing: 1.5 }}>
            FOOD EXPLORER · SINGAPORE
          </AppText>
        </View>
        <View style={[styles.row, { gap: spacing[1] }]}>
          {totalStamps > 0 ? (
            <AppText variant="micro" style={{ color: palette.passportGold }}>
              {totalStamps} {totalStamps === 1 ? "stamp" : "stamps"}
            </AppText>
          ) : null}
          <ChevronRight size={16} color={palette.passportGold} />
        </View>
      </View>

      {/* Open visa page: stamp slots and trail progress */}
      <View
        style={{
          backgroundColor: palette.passportPage,
          borderRadius: radii.md,
          gap: spacing[3],
          padding: spacing[3],
        }}
      >
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          {slots.map((stamp, index) =>
            stamp ? (
              <View
                key={stamp.id}
                style={{ transform: [{ rotate: index % 2 ? "4deg" : "-5deg" }] }}
              >
                <PassportStampBadge stamp={stamp} earned size="sm" />
              </View>
            ) : (
              <View
                key={`slot-${index}`}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  alignItems: "center",
                  borderColor: palette.passportInk,
                  borderRadius: radii.pill,
                  borderStyle: "dashed",
                  borderWidth: 1.5,
                  height: 56,
                  justifyContent: "center",
                  opacity: 0.45,
                  width: 56,
                }}
              >
                <Stamp size={20} color={palette.passportInk} />
              </View>
            ),
          )}
        </View>

        {activeCategories.length === 0 ? (
          <View style={{ gap: spacing[1] }}>
            <AppText variant="bodySmall" style={{ color: palette.passportInk }}>
              Start exploring to earn your first stamp
            </AppText>
            {nextStamp ? (
              <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700" }}>
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
                    <AppText variant="bodySmall" style={{ color: palette.passportInk }}>
                      {cat.name}
                    </AppText>
                    <AppText variant="micro" style={{ color: palette.passportInk }}>
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
      </View>

      {/* Machine-readable line along the bottom of the page */}
      <AppText
        variant="micro"
        numberOfLines={1}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          color: palette.passportGold,
          fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
          letterSpacing: 1,
          opacity: 0.8,
        }}
      >
        {`P<SGP<HUNGRY<<FOOD<EXPLORER<<<<${String(totalStamps).padStart(2, "0")}<<<`}
      </AppText>
    </Pressable>
  );
}

const STAMP_SLOTS = 3;

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
