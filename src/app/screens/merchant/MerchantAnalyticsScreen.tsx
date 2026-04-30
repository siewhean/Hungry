import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart3, LineChart, PieChart, TrendingUp, Heart, Eye } from "lucide-react-native";
import Svg, { Polyline } from "react-native-svg";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const POPULAR_HOURS = [
  { time: "11a", value: 0.3 },
  { time: "12p", value: 0.8 },
  { time: "1p", value: 1.0 },
  { time: "2p", value: 0.5 },
  { time: "5p", value: 0.4 },
  { time: "6p", value: 0.7 },
  { time: "7p", value: 0.9 },
  { time: "8p", value: 0.6 },
];

const MONTHLY_GROWTH = [40, 45, 60, 55, 70, 85, 100]; // normalized 0-100

const DEMOGRAPHICS = {
  returning: 65,
  new: 35,
};

const TOP_DISHES = [
  { id: "1", name: "Signature Char Siew Rice", views: 842, saves: 124 },
  { id: "2", name: "Roasted Pork Belly", views: 521, saves: 89 },
  { id: "3", name: "Wonton Noodle Soup", views: 312, saves: 45 },
];

const TASTE_PROFILE = [
  { label: "Rich", score: 8.5 },
  { label: "Salty", score: 7.2 },
  { label: "Sweet", score: 6.0 },
  { label: "Aromatic", score: 5.5 },
];

export function MerchantAnalyticsScreen() {
  const { palette, spacing, radii, shadows } = useHungryTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[6] }}>
        <AppText variant="h1" style={{ fontWeight: "900" }}>
          Performance
        </AppText>

        <View style={{ gap: spacing[4] }}>
          {/* Popular Hours Bar Chart */}
          <View
            style={{
              backgroundColor: palette.surface,
              padding: spacing[4],
              borderRadius: radii.xl,
              gap: spacing[4],
              borderWidth: 1,
              borderColor: palette.border,
              ...shadows.card,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <BarChart3 size={20} color={palette.orange} />
              <AppText variant="bodyBold">Popular Hours</AppText>
            </View>
            <View
              style={{
                height: 120,
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
                paddingTop: spacing[4],
              }}
            >
              {POPULAR_HOURS.map((item, index) => (
                <View key={index} style={{ alignItems: "center", gap: 4 }}>
                  <View
                    style={{
                      width: 24,
                      height: 100 * item.value,
                      backgroundColor: item.value > 0.7 ? palette.orange : palette.orangeLight,
                      borderRadius: radii.sm,
                    }}
                  />
                  <AppText variant="micro" tone="muted">
                    {item.time}
                  </AppText>
                </View>
              ))}
            </View>
          </View>

          {/* Customer Demographics Horizontal Bar */}
          <View
            style={{
              backgroundColor: palette.surface,
              padding: spacing[4],
              borderRadius: radii.xl,
              gap: spacing[4],
              borderWidth: 1,
              borderColor: palette.border,
              ...shadows.card,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <PieChart size={20} color={palette.amber} />
              <AppText variant="bodyBold">Customer Demographics</AppText>
            </View>

            <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
              <View
                style={{
                  flexDirection: "row",
                  height: 24,
                  borderRadius: radii.pill,
                  overflow: "hidden",
                }}
              >
                <View style={{ flex: DEMOGRAPHICS.returning, backgroundColor: palette.amber }} />
                <View style={{ flex: DEMOGRAPHICS.new, backgroundColor: palette.amber + "40" }} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.amber }}
                  />
                  <AppText variant="bodySmallBold">{DEMOGRAPHICS.returning}% Returning</AppText>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: palette.amber + "40",
                    }}
                  />
                  <AppText variant="bodySmallBold" tone="muted">
                    {DEMOGRAPHICS.new}% New
                  </AppText>
                </View>
              </View>
            </View>
          </View>

          {/* Monthly Growth Line Chart */}
          <View
            style={{
              backgroundColor: palette.surface,
              padding: spacing[4],
              borderRadius: radii.xl,
              gap: spacing[4],
              borderWidth: 1,
              borderColor: palette.border,
              ...shadows.card,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <LineChart size={20} color={palette.success} />
                <AppText variant="bodyBold">Monthly Growth</AppText>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <TrendingUp size={16} color={palette.success} />
                <AppText variant="bodySmallBold" style={{ color: palette.success }}>
                  +15%
                </AppText>
              </View>
            </View>

            <View
              style={{
                height: 100,
                marginTop: spacing[2],
                backgroundColor: palette.bgSoft,
                borderRadius: radii.lg,
                overflow: "hidden",
              }}
            >
              <Svg height="100%" width="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <Polyline
                  points={MONTHLY_GROWTH.map(
                    (val, i) => `${(i / (MONTHLY_GROWTH.length - 1)) * 100},${100 - val}`,
                  ).join(" ")}
                  fill="none"
                  stroke={palette.success}
                  strokeWidth="3"
                />
              </Svg>
            </View>
          </View>

          {/* Top Dishes */}
          <View
            style={{
              backgroundColor: palette.surface,
              padding: spacing[4],
              borderRadius: radii.xl,
              gap: spacing[4],
              borderWidth: 1,
              borderColor: palette.border,
              ...shadows.card,
            }}
          >
            <AppText variant="h3" style={{ fontWeight: "800" }}>
              Top Dishes
            </AppText>
            <View style={{ gap: spacing[3] }}>
              {TOP_DISHES.map((dish, index) => (
                <View
                  key={dish.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
                >
                  <AppText variant="bodyBold" style={{ color: palette.textSecondary, width: 20 }}>
                    #{index + 1}
                  </AppText>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodySmallBold">{dish.name}</AppText>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Eye size={14} color={palette.textSecondary} />
                      <AppText variant="micro" tone="muted">
                        {dish.views}
                      </AppText>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Heart size={14} color={palette.orange} />
                      <AppText variant="micro" tone="muted">
                        {dish.saves}
                      </AppText>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Customer Taste Tags */}
          <View
            style={{
              backgroundColor: palette.surface,
              padding: spacing[4],
              borderRadius: radii.xl,
              gap: spacing[4],
              borderWidth: 1,
              borderColor: palette.border,
              ...shadows.card,
            }}
          >
            <AppText variant="h3" style={{ fontWeight: "800" }}>
              Customer Taste Profile
            </AppText>
            <AppText variant="bodySmall" tone="muted" style={{ marginTop: -8 }}>
              Based on users who favorited your stall
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {TASTE_PROFILE.map((tag) => (
                <View
                  key={tag.label}
                  style={{
                    backgroundColor: palette.bgSoft,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: palette.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AppText variant="bodySmallBold">{tag.label}</AppText>
                  <View
                    style={{
                      backgroundColor: palette.orange,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: radii.sm,
                    }}
                  >
                    <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                      {tag.score}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
