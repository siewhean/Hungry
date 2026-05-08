import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { BarChart3, TrendingUp, PieChart, Star, Users, Clock, Flame } from "lucide-react-native";

import { AppText, Screen, Card, Chip, Skeleton } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { MerchantAnalytics } from "@/types/domain";

const DEMOGRAPHICS = { returning: 65, new: 35 };

export function MerchantAnalyticsScreen() {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<"today" | "7d" | "30d">("7d");

  useEffect(() => {
    async function loadAnalytics() {
      if (activeOutlet) {
        setIsLoading(true);
        try {
          const data = await getHungryService().merchant.getAnalytics(activeOutlet.id, range);
          setAnalytics(data);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      }
    }
    void loadAnalytics();
  }, [activeOutlet, range]);

  if (isLoading || !analytics) {
    return (
      <Screen title="Analytics">
        <View style={{ padding: spacing[4], gap: spacing[4] }}>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <Skeleton height={32} width={80} borderRadius={radii.pill} />
            <Skeleton height={32} width={80} borderRadius={radii.pill} />
            <Skeleton height={32} width={80} borderRadius={radii.pill} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
             <Skeleton height={100} width="47%" borderRadius={radii.lg} />
             <Skeleton height={100} width="47%" borderRadius={radii.lg} />
             <Skeleton height={100} width="47%" borderRadius={radii.lg} />
             <Skeleton height={100} width="47%" borderRadius={radii.lg} />
          </View>
          <Skeleton height={200} borderRadius={radii.lg} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Performance" scroll={false}>
      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[6] }}>
        {/* Range Selector */}
        <View style={{ flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[1] }}>
          <Chip label="Today" selected={range === "today"} onPress={() => setRange("today")} />
          <Chip label="7 Days" selected={range === "7d"} onPress={() => setRange("7d")} />
          <Chip label="30 Days" selected={range === "30d"} onPress={() => setRange("30d")} />
        </View>

        <View style={{ gap: spacing[4] }}>
          {/* Key Metrics Grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
            <MetricCard
              label="Visits"
              value={analytics.profileVisits.toString()}
              trend="+12%"
              icon={<Users size={16} color={palette.orange} />}
            />
            <MetricCard
              label="Menu Views"
              value={analytics.menuViews.toString()}
              trend="+8%"
              icon={<BarChart3 size={16} color={palette.info} />}
            />
            <MetricCard
              label="Avg Rating"
              value={analytics.averageRating.toFixed(1)}
              trend="Stable"
              icon={<Star size={16} color={palette.amber} />}
            />
            <MetricCard
              label="Saves"
              value={analytics.saves.toString()}
              trend="+24%"
              icon={<TrendingUp size={16} color={palette.success} />}
            />
          </View>

          {/* Demographics Card */}
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.xl,
                padding: spacing[5],
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: spacing[4],
              }}
            >
              <PieChart size={20} color={palette.amber} />
              <AppText variant="bodyBold">Customer Demographics</AppText>
            </View>

            <View style={{ gap: spacing[2] }}>
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

          {/* Top Dishes */}
          <View style={[styles.chartCard, { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radii.xl, padding: spacing[5] }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing[4] }}>
              <Flame size={20} color={palette.orange} />
              <AppText variant="bodyBold">Top Performing Dishes</AppText>
            </View>
            <View style={{ gap: spacing[3] }}>
              {analytics.topDishes.map((dish, idx) => (
                <View key={dish.dishId} style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                  <AppText variant="bodyBold" style={{ width: 20, color: palette.textMuted }}>{idx + 1}</AppText>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyBold">{dish.name}</AppText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <AppText variant="bodySmallBold">{dish.views} views</AppText>
                    <AppText variant="micro" tone="muted">{dish.saves} saves</AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Customer Taste Tags */}
          <View style={[styles.chartCard, { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radii.xl, padding: spacing[5] }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing[4] }}>
              <Star size={20} color={palette.amber} />
              <AppText variant="bodyBold">Customer Taste Profile</AppText>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {analytics.customerTasteTags.map((tagObj) => (
                <View
                  key={tagObj.tag}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: palette.bgSoft,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radii.pill,
                    gap: spacing[2],
                  }}
                >
                  <AppText variant="bodySmallBold">{tagObj.tag}</AppText>
                  <View style={{ backgroundColor: palette.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill }}>
                    <AppText variant="micro" tone="muted">{tagObj.count}</AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Peak Discovery Hours */}
          <View style={[styles.chartCard, { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radii.xl, padding: spacing[5] }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing[4] }}>
              <Clock size={20} color={palette.info} />
              <AppText variant="bodyBold">Peak Discovery Hours</AppText>
            </View>
            <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[4] }}>
              When customers are viewing your stall
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {analytics.peakDiscoveryHours.map((hour) => (
                <View
                  key={hour}
                  style={{
                    backgroundColor: palette.info + "20",
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radii.md,
                  }}
                >
                  <AppText variant="bodySmallBold" style={{ color: palette.info }}>
                    {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function MetricCard({
  label,
  value,
  trend,
  icon,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
}) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
          padding: spacing[4],
          ...shadows.card,
        },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ backgroundColor: palette.bgSoft, padding: 6, borderRadius: radii.md }}>
          {icon}
        </View>
        <AppText
          variant="micro"
          style={{
            color: trend.startsWith("+") ? palette.success : palette.textMuted,
            fontWeight: "700",
          }}
        >
          {trend}
        </AppText>
      </View>
      <View style={{ marginTop: spacing[3] }}>
        <AppText variant="h2" style={{ fontWeight: "900" }}>
          {value}
        </AppText>
        <AppText
          variant="micro"
          tone="muted"
          style={{ textTransform: "uppercase", marginTop: 2, fontWeight: "700" }}
        >
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    width: "47.5%",
    borderWidth: 1,
  },
  chartCard: {
    borderWidth: 1,
  },
});
