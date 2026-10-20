import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, View, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { BarChart3, TrendingUp, PieChart, Star, Users, Clock, Flame, X } from "lucide-react-native";

import { AppText, Screen, FilterChipRail, Skeleton, EmptyState } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getDataTrustDisclosure } from "@/lib/services/dataTrustDisclosure";
import { formatPeakHour } from "@/features/merchant/merchantReadiness";
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
import type { MerchantAnalytics } from "@/types/domain";

type AnalyticsRange = "today" | "7d" | "30d";
type DetailKey = "visits" | "menu" | "rating" | "saves" | "funnel" | "dishes" | "tags" | "hours";

const SCREEN_TITLE = "Performance";

const ANALYTICS_RANGE_OPTIONS: { id: AnalyticsRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
];

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

/** Spoken form of a trend label, so the change is not carried by colour alone. */
function describeTrend(trend: string): string {
  if (trend.startsWith("+")) return `up ${trend.slice(1)}`;
  if (trend.startsWith("-")) return `down ${trend.slice(1)}`;
  return trend;
}

function SeeMoreButton({
  expanded,
  label,
  onPress,
}: {
  expanded: boolean;
  label: string;
  onPress: () => void;
}) {
  const { palette } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? "Hide" : "See more"}: ${label}`}
      accessibilityState={{ expanded }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      onPress={onPress}
      style={{ minHeight: 24, justifyContent: "center" }}
    >
      <AppText variant="micro" style={{ color: palette.orangeText, fontWeight: "800" }}>
        {expanded ? "Hide" : "See More"}
      </AppText>
    </Pressable>
  );
}

export function MerchantAnalyticsScreen() {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const activeOutletId = activeOutlet?.id;

  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<DetailKey | null>(null);
  // Only the newest request may write state: a slow earlier range must not overwrite this one.
  const latestRequestId = useRef(0);
  const analyticsDisclosure = getDataTrustDisclosure("merchantAnalytics");

  const loadAnalytics = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setError(null);
    setIsLoading(true);

    if (!activeOutletId) {
      setAnalytics(null);
      setError("No active outlet selected for analytics.");
      setIsLoading(false);
      return;
    }
    try {
      const data = await getHungryService().merchant.getAnalytics(activeOutletId, range);
      if (requestId !== latestRequestId.current) return;
      setAnalytics(data);
    } catch (e) {
      if (requestId !== latestRequestId.current) return;
      setError(e instanceof Error ? e.message : "Failed to load analytics.");
      console.error(e);
    } finally {
      if (requestId === latestRequestId.current) setIsLoading(false);
    }
  }, [activeOutletId, range]);

  // Refetch on focus so numbers are current after changes made elsewhere.
  useFocusEffect(
    useCallback(() => {
      void loadAnalytics();
    }, [loadAnalytics]),
  );

  const toggleDetail = (key: DetailKey) => setExpanded((current) => (current === key ? null : key));

  // Profile visit -> menu view -> dish view -> directions is a funnel, not shares of one total:
  // each bar is sized against the largest step and labelled with its own count.
  const discoveryFunnel = useMemo(() => {
    if (!analytics) return [];
    const steps = [
      { label: "Profile visits", value: analytics.profileVisits, color: palette.orange },
      { label: "Menu views", value: analytics.menuViews, color: palette.info },
      { label: "Dish views", value: analytics.dishViews, color: palette.amber },
      { label: "Direction taps", value: analytics.directionTaps, color: palette.success },
    ];
    const max = Math.max(...steps.map((step) => step.value), 0);
    return steps.map((step) => ({ ...step, ratio: max > 0 ? step.value / max : 0 }));
  }, [analytics, palette.amber, palette.info, palette.orange, palette.success]);

  if (error) {
    return (
      <Screen title={SCREEN_TITLE}>
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

  // Skeleton only on the first load; a range change keeps the last numbers on screen.
  if (!analytics) {
    return (
      <Screen title={SCREEN_TITLE}>
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

  const cardStyle = [
    styles.chartCard,
    {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: componentRadii.card,
      padding: spacing[5],
    },
  ];
  const cardHeaderStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
    marginBottom: spacing[4],
  };
  const detailText = (text: string) => (
    <AppText variant="bodySmall" tone="muted" style={{ marginTop: spacing[3] }}>
      {text}
    </AppText>
  );

  return (
    <Screen title={SCREEN_TITLE} scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing[4], gap: spacing[6] }}
      >
        {/* Range Selector */}
        <FilterChipRail
          options={ANALYTICS_RANGE_OPTIONS}
          selectedId={range}
          onSelect={(next) => {
            setRange(next);
            trackMerchantEvent("merchant_dashboard_viewed", activeOutletId, {
              surface: "performance",
              range: next,
            });
          }}
          gap={spacing[2]}
        />
        <AppText variant="micro" tone="muted" style={{ paddingHorizontal: spacing[1] }}>
          {isLoading ? "Updating… " : ""}
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
              expanded={expanded === "visits"}
              onSeeMore={() => toggleDetail("visits")}
              detail={`${analytics.profileVisits} profile visits, ${analytics.menuViews} menu views and ${analytics.dishViews} dish views.`}
            />
            <MetricCard
              label="Menu Views"
              value={analytics.menuViews.toString()}
              trend={formatDelta(analytics.menuViews, analytics.previousPeriodComparison.menuViews)}
              icon={<BarChart3 size={16} color={palette.info} />}
              expanded={expanded === "menu"}
              onSeeMore={() => toggleDetail("menu")}
              detail={`Top dish: ${analytics.topDishes[0]?.name ?? "no dish data yet"}.`}
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
              expanded={expanded === "rating"}
              onSeeMore={() => toggleDetail("rating")}
              detail={`From ${analytics.reviewCount} ${analytics.reviewCount === 1 ? "review" : "reviews"} in this range (${analytics.previousPeriodComparison.reviewCount} the period before).`}
            />
            <MetricCard
              label="Saves"
              value={analytics.saves.toString()}
              trend={formatSaveRate(analytics.saves, analytics.profileVisits)}
              icon={<TrendingUp size={16} color={palette.success} />}
              expanded={expanded === "saves"}
              onSeeMore={() => toggleDetail("saves")}
              detail={`${analytics.saves} saves and ${analytics.shares} shares.`}
            />
          </View>

          {/* Discovery Funnel */}
          <View style={cardStyle}>
            <View style={cardHeaderStyle}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <PieChart size={20} color={palette.amber} />
                <AppText variant="bodyBold" accessibilityRole="header">
                  Discovery Funnel
                </AppText>
              </View>
              <SeeMoreButton
                expanded={expanded === "funnel"}
                label="Discovery funnel"
                onPress={() => toggleDetail("funnel")}
              />
            </View>

            <View style={{ gap: spacing[3] }}>
              {discoveryFunnel.map((step) => (
                <View
                  key={step.label}
                  accessible
                  accessibilityLabel={`${step.label}: ${step.value}`}
                  style={{ gap: spacing[1] }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText variant="micro" tone="muted">
                      {step.label}
                    </AppText>
                    <AppText variant="micro" style={{ fontWeight: "700" }}>
                      {step.value}
                    </AppText>
                  </View>
                  <View
                    style={{
                      height: 10,
                      borderRadius: radii.pill,
                      backgroundColor: palette.bgSoft,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.round(step.ratio * 100)}%`,
                        height: "100%",
                        backgroundColor: step.color,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
            {expanded === "funnel"
              ? detailText(
                  analytics.profileVisits > 0
                    ? `${Math.round((analytics.menuViews / analytics.profileVisits) * 100)}% of profile visits opened your menu; ${analytics.directionTaps} asked for directions.`
                    : "No profile visits in this range yet.",
                )
              : null}
          </View>

          {/* Top Dishes */}
          <View style={cardStyle}>
            <View style={cardHeaderStyle}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Flame size={20} color={palette.orange} />
                <AppText variant="bodyBold" accessibilityRole="header">
                  Top Performing Dishes
                </AppText>
              </View>
              <SeeMoreButton
                expanded={expanded === "dishes"}
                label="Top performing dishes"
                onPress={() => toggleDetail("dishes")}
              />
            </View>
            <View style={{ gap: spacing[3] }}>
              {analytics.topDishes.length === 0 ? (
                <AppText variant="bodySmall" tone="muted">
                  No dish-level view data yet.
                </AppText>
              ) : null}
              {(expanded === "dishes" ? analytics.topDishes : analytics.topDishes.slice(0, 3)).map(
                (dish, idx) => (
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
                ),
              )}
            </View>
          </View>

          {/* Customer Taste Tags */}
          <View style={cardStyle}>
            <View style={cardHeaderStyle}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Star size={20} color={palette.amber} />
                <AppText variant="bodyBold" accessibilityRole="header">
                  Customer Taste Profile
                </AppText>
              </View>
              <SeeMoreButton
                expanded={expanded === "tags"}
                label="Customer taste profile"
                onPress={() => toggleDetail("tags")}
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {analytics.customerTasteTags.length === 0 ? (
                <AppText variant="bodySmall" tone="muted">
                  No customer taste-tag data yet.
                </AppText>
              ) : null}
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
            {expanded === "tags"
              ? detailText(
                  "Tags come from diners' reviews and from the dishes they viewed in this range.",
                )
              : null}
          </View>

          {/* Peak Discovery Hours */}
          <View style={cardStyle}>
            <View style={cardHeaderStyle}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Clock size={20} color={palette.info} />
                <AppText variant="bodyBold" accessibilityRole="header">
                  Peak Discovery Hours
                </AppText>
              </View>
              <SeeMoreButton
                expanded={expanded === "hours"}
                label="Peak discovery hours"
                onPress={() => toggleDetail("hours")}
              />
            </View>
            <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[4] }}>
              When customers are viewing your stall (Singapore time)
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {analytics.peakDiscoveryHours.length === 0 ? (
                <AppText variant="bodySmall" tone="muted">
                  No peak-hour data yet.
                </AppText>
              ) : null}
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
                    {formatPeakHour(hour)}
                  </AppText>
                </View>
              ))}
            </View>
            {expanded === "hours"
              ? detailText(
                  "Busiest hours first. Each hour counts stall, menu and dish views that started in it.",
                )
              : null}
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
  detail,
  expanded,
  onSeeMore,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
  detail: string;
  expanded: boolean;
  onSeeMore: () => void;
}) {
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
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
            accessibilityLabel={describeTrend(trend)}
            style={{
              color: trend.startsWith("+")
                ? palette.success
                : trend.startsWith("-")
                  ? palette.error
                  : palette.textMuted,
              fontWeight: "700",
            }}
          >
            {trend.startsWith("+") ? "▲ " : trend.startsWith("-") ? "▼ " : ""}
            {trend}
          </AppText>
          <SeeMoreButton expanded={expanded} label={label} onPress={onSeeMore} />
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
        {expanded ? (
          <AppText variant="micro" tone="muted" style={{ marginTop: spacing[2] }}>
            {detail}
          </AppText>
        ) : null}
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
