import React, { useCallback, useMemo, useState, useEffect } from "react";
import { Alert, Pressable, View, StyleSheet, ScrollView } from "react-native";
import { BarChart3, TrendingUp, PieChart, Star, Users, Clock, Flame, X } from "lucide-react-native";

import { AppText, Screen, Card, Chip, Skeleton, EmptyState } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getDataTrustDisclosure } from "@/lib/services/dataTrustDisclosure";
import type { MerchantAnalytics } from "@/types/domain";

function formatDelta(current: number, previous: number, options: { decimals?: number } = {}) {
  if (previous <= 0) {
    return current > 0 ? "New" : "0%";
  }

  const change = ((current - previous) / previous) * 100;
  const value = Math.abs(change).toFixed(options.decimals ?? 0);
  if (change > 0) return `+${value}%`;
  if (change < 0) return `-${value}%`;
  return "0%";
}

function formatSaveRate(saves: number, profileVisits: number) {
  if (profileVisits <= 0) return "0% save rate";
  return `${((saves / profileVisits) * 100).toFixed(1)}% save rate`;
}

export function MerchantAnalyticsScreen() {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<"today" | "7d" | "30d">("7d");
  const [error, setError] = useState<string | null>(null);
  const analyticsDisclosure = getDataTrustDisclosure("merchantAnalytics");

  const loadAnalytics = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    if (!activeOutlet) {
      setAnalytics(null);
      setError("No active outlet selected for analytics.");
      setIsLoading(false);
      return;
    }
    try {
      const data = await getHungryService().merchant.getAnalytics(activeOutlet.id, range);
      setAnalytics(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet, range]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const discoveryMix = useMemo(() => {
    if (!analytics) return [];

    const items = [
      { label: "Profiles", value: analytics.profileVisits, color: palette.orange },
      { label: "Menus", value: analytics.menuViews, color: palette.info },
      { label: "Dishes", value: analytics.dishViews, color: palette.amber },
      { label: "Directions", value: analytics.directionTaps, color: palette.success },
    ];
    const total = items.reduce((sum, item) => sum + item.value, 0);

    return items.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.value / total) * 100) : 0,
    }));
  }, [analytics, palette.amber, palette.info, palette.orange, palette.success]);

  if (error) {
    return (
      <Screen title="Analytics">
        <EmptyState
          title="Failed to load analytics"
          body="Your analytics data is unavailable at the moment."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="Merchant analytics"
          ctaLabel="Retry"
          onPress={loadAnalytics}
        />
      </Screen>
    );
  }

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
            <Skeleton height={100} width="47%" borderRadius={componentRadii.card} />
            <Skeleton height={100} width="47%" borderRadius={componentRadii.card} />
            <Skeleton height={100} width="47%" borderRadius={componentRadii.card} />
            <Skeleton height={100} width="47%" borderRadius={componentRadii.card} />
          </View>
          <Skeleton height={200} borderRadius={componentRadii.card} />
        </View>
      </Screen>
    );
  }

  const openDetail = (title: string, body: string) => {
    Alert.alert(title, body);
  };

  return (
    <Screen title="Performance" scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing[4], gap: spacing[6] }}
      >
        {/* Range Selector */}
        <View style={{ flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[1] }}>
          <Chip label="Today" selected={range === "today"} onPress={() => setRange("today")} />
          <Chip label="7 Days" selected={range === "7d"} onPress={() => setRange("7d")} />
          <Chip label="30 Days" selected={range === "30d"} onPress={() => setRange("30d")} />
        </View>
        <AppText variant="micro" tone="muted" style={{ paddingHorizontal: spacing[1] }}>
          {analyticsDisclosure}
        </AppText>

        <View style={{ gap: spacing[4] }}>
          {/* Key Metrics Grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
            <MetricCard
              label="Visits"
              value={analytics.profileVisits.toString()}
              trend={formatDelta(
                analytics.profileVisits,
                analytics.previousPeriodComparison.profileVisits,
              )}
              icon={<Users size={16} color={palette.orange} />}
              onSeeMore={() =>
                openDetail(
                  "Detailed views",
                  `${analytics.profileVisits} profile visits, ${analytics.menuViews} menu views, and ${analytics.dishViews} dish views for this range.`,
                )
              }
            />
            <MetricCard
              label="Menu Views"
              value={analytics.menuViews.toString()}
              trend={formatDelta(analytics.menuViews, analytics.previousPeriodComparison.menuViews)}
              icon={<BarChart3 size={16} color={palette.info} />}
              onSeeMore={() =>
                openDetail(
                  "Menu analytics",
                  `${analytics.menuViews} menu views. Top dish: ${analytics.topDishes[0]?.name ?? "No dish data yet"}.`,
                )
              }
            />
            <MetricCard
              label="Avg Rating"
              value={analytics.averageRating.toFixed(1)}
              trend={formatDelta(
                analytics.averageRating,
                analytics.previousPeriodComparison.averageRating,
                { decimals: 1 },
              )}
              icon={<Star size={16} color={palette.amber} />}
              onSeeMore={() =>
                openDetail(
                  "Rating trend",
                  `${analytics.averageRating.toFixed(1)} average rating from ${analytics.reviewCount} reviews.`,
                )
              }
            />
            <MetricCard
              label="Saves"
              value={analytics.saves.toString()}
              trend={formatSaveRate(analytics.saves, analytics.profileVisits)}
              icon={<TrendingUp size={16} color={palette.success} />}
              onSeeMore={() =>
                openDetail(
                  "Save performance",
                  `${analytics.saves} saves and ${analytics.shares} shares for this range.`,
                )
              }
            />
          </View>

          {/* Discovery Mix */}
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                padding: spacing[5],
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: spacing[4],
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <PieChart size={20} color={palette.amber} />
                <AppText variant="bodyBold">Discovery Mix</AppText>
              </View>
              <Pressable
                onPress={() =>
                  openDetail(
                    "Discovery mix",
                    discoveryMix.map((item) => `${item.label}: ${item.percentage}%`).join("\n"),
                  )
                }
              >
                <AppText variant="micro" style={{ color: palette.orange, fontWeight: "800" }}>
                  See More
                </AppText>
              </Pressable>
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
                {discoveryMix.map((item) => (
                  <View
                    key={item.label}
                    style={{
                      flex: Math.max(item.percentage, 1),
                      backgroundColor: item.color,
                    }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                {discoveryMix.map((item) => (
                  <View
                    key={item.label}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <View
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }}
                    />
                    <AppText variant="micro" tone="muted">
                      {item.percentage}% {item.label}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Top Dishes */}
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                padding: spacing[5],
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: spacing[4],
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Flame size={20} color={palette.orange} />
                <AppText variant="bodyBold">Top Performing Dishes</AppText>
              </View>
              <Pressable
                onPress={() =>
                  openDetail(
                    "Dish performance",
                    analytics.topDishes.length
                      ? analytics.topDishes
                          .map((dish, index) => `${index + 1}. ${dish.name}: ${dish.views} views`)
                          .join("\n")
                      : "No dish-level view data yet.",
                  )
                }
              >
                <AppText variant="micro" style={{ color: palette.orange, fontWeight: "800" }}>
                  See More
                </AppText>
              </Pressable>
            </View>
            <View style={{ gap: spacing[3] }}>
              {analytics.topDishes.map((dish, idx) => (
                <View
                  key={dish.dishId}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
                >
                  <AppText variant="bodyBold" style={{ width: 20, color: palette.textMuted }}>
                    {idx + 1}
                  </AppText>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyBold">{dish.name}</AppText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <AppText variant="bodySmallBold">{dish.views} views</AppText>
                    <AppText variant="micro" tone="muted">
                      {dish.saves} saves
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Customer Taste Tags */}
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                padding: spacing[5],
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: spacing[4],
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Star size={20} color={palette.amber} />
                <AppText variant="bodyBold">Customer Taste Profile</AppText>
              </View>
              <Pressable
                onPress={() =>
                  openDetail(
                    "Customer taste profile",
                    analytics.customerTasteTags.length
                      ? analytics.customerTasteTags
                          .map((tag) => `${tag.tag}: ${tag.count}`)
                          .join("\n")
                      : "No customer taste-tag data yet.",
                  )
                }
              >
                <AppText variant="micro" style={{ color: palette.orange, fontWeight: "800" }}>
                  See More
                </AppText>
              </Pressable>
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
                  <View
                    style={{
                      backgroundColor: palette.surface,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: radii.pill,
                    }}
                  >
                    <AppText variant="micro" tone="muted">
                      {tagObj.count}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Peak Discovery Hours */}
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                padding: spacing[5],
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: spacing[4],
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Clock size={20} color={palette.info} />
                <AppText variant="bodyBold">Peak Discovery Hours</AppText>
              </View>
              <Pressable
                onPress={() =>
                  openDetail(
                    "Peak discovery hours",
                    analytics.peakDiscoveryHours.length
                      ? analytics.peakDiscoveryHours.join(", ")
                      : "No peak-hour data yet.",
                  )
                }
              >
                <AppText variant="micro" style={{ color: palette.orange, fontWeight: "800" }}>
                  See More
                </AppText>
              </Pressable>
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
                    borderRadius: componentRadii.button,
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
  onSeeMore,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
  onSeeMore: () => void;
}) {
  const { componentRadii, palette, spacing, radii, shadows } = useHungryTheme();
  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          padding: spacing[4],
          ...shadows.card,
        },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View
          style={{
            backgroundColor: palette.bgSoft,
            padding: 6,
            borderRadius: componentRadii.iconButton,
          }}
        >
          {icon}
        </View>
        <View style={{ alignItems: "flex-end", gap: spacing[1] }}>
          <AppText
            variant="micro"
            style={{
              color: trend.startsWith("+")
                ? palette.success
                : trend.startsWith("-")
                  ? palette.error
                  : palette.textMuted,
              fontWeight: "700",
            }}
          >
            {trend}
          </AppText>
          <Pressable onPress={onSeeMore}>
            <AppText variant="micro" style={{ color: palette.orange, fontWeight: "800" }}>
              See More
            </AppText>
          </Pressable>
        </View>
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
