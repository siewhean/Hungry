/**
 * MerchantDashboardScreen
 * Command center for stall owners.
 * Features large numbers, big buttons, and simple navigation.
 * Feedback-driven for 'Uncle Tan' and 'Ahmad'.
 */
import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Star,
  ClipboardList,
  Utensils,
  MessageSquare,
  Megaphone,
  Sparkles,
  Settings,
  QrCode,
  ChevronRight,
  X,
} from "lucide-react-native";

import { AppText, Skeleton, EmptyState } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { OutletSwitcher } from "@/components/merchant/OutletSwitcher";
import { prefetchMerchantTab, preloadRoute } from "@/features/navigation/prefetch";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getDataTrustDisclosure } from "@/lib/services/dataTrustDisclosure";
import type { CustomerInteraction, DishDetail, MerchantAnalytics } from "@/types/domain";
import {
  buildMerchantDashboardMetrics,
  getMetricDelta,
  type MetricTrend,
  getMerchantOutletStatus,
  getMerchantOutletStatusLabel,
  getMerchantProfileGaps,
  getUnrepliedReviews,
} from "@/features/merchant/merchantReadiness";

// ─── Segmented Control ────────────────────────────────────────────────────────

function DateRangeSelector({
  selected,
  onSelect,
}: {
  selected: "Today" | "7 Days" | "30 Days";
  onSelect: (val: "Today" | "7 Days" | "30 Days") => void;
}) {
  const { palette, spacing, radii } = useHungryTheme();
  const options = ["Today", "7 Days", "30 Days"] as const;

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: palette.surface,
        borderRadius: radii.pill,
        padding: 4,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onSelect(opt)}
          style={{
            flex: 1,
            paddingVertical: spacing[2],
            alignItems: "center",
            backgroundColor: selected === opt ? palette.orange : "transparent",
            borderRadius: radii.pill,
          }}
        >
          <AppText
            variant="bodySmallBold"
            style={{
              color: selected === opt ? palette.white : palette.textSecondary,
            }}
          >
            {opt}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Dashboard Card ──────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  subtext,
  icon,
  color,
  trend,
}: {
  title: string;
  value: string | React.ReactNode;
  subtext: string | React.ReactNode;
  icon: React.ReactNode;
  color: string;
  trend?: MetricTrend;
}) {
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  return (
    <View
      style={{
        borderColor: palette.border,
        borderWidth: 1,
        backgroundColor: palette.surface,
        borderRadius: componentRadii.card,
        padding: spacing[4],
        ...shadows.card,
      }}
    >
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: componentRadii.iconButton,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color + "15",
          }}
        >
          {icon}
        </View>
        {trend === "up" ? (
          <TrendingUp size={16} color={palette.success} accessibilityElementsHidden />
        ) : trend === "down" ? (
          <TrendingDown size={16} color={palette.error} accessibilityElementsHidden />
        ) : null}
      </View>
      <View style={{ marginTop: spacing[3] }}>
        {typeof value === "string" ? (
          <AppText variant="h2" style={{ fontWeight: "900" }}>
            {value}
          </AppText>
        ) : (
          <View style={{ height: 32, justifyContent: "center" }}>{value}</View>
        )}
        <AppText variant="bodySmallBold" style={{ color: palette.textSecondary }}>
          {title}
        </AppText>
        {typeof subtext === "string" ? (
          <AppText
            variant="micro"
            style={{
              color:
                trend === "up"
                  ? palette.success
                  : trend === "down"
                    ? palette.error
                    : palette.textSecondary,
              marginTop: 4,
            }}
          >
            {subtext}
          </AppText>
        ) : (
          <View style={{ height: 16, justifyContent: "center", marginTop: 4 }}>{subtext}</View>
        )}
      </View>
    </View>
  );
}

// ─── Action Card ─────────────────────────────────────────────────────────────

function ActionCard({
  title,
  description,
  icon,
  actionText,
  onPress,
  onPressIn,
  isUrgent = false,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionText: string;
  onPress: () => void;
  onPressIn?: () => void;
  isUrgent?: boolean;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: isUrgent ? palette.amber + "10" : palette.surface,
          borderRadius: componentRadii.button,
          padding: spacing[4],
          borderWidth: 1,
          borderColor: isUrgent ? palette.amber : palette.border,
          flexDirection: "row",
          gap: spacing[3],
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: componentRadii.iconButton,
          backgroundColor: isUrgent ? palette.amber + "20" : palette.bgSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyBold" style={{ color: palette.text }}>
          {title}
        </AppText>
        <AppText variant="bodySmall" style={{ color: palette.textSecondary, marginTop: 2 }}>
          {description}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing[2], gap: 4 }}>
          <AppText
            variant="bodySmallBold"
            style={{ color: isUrgent ? palette.amber : palette.orange }}
          >
            {actionText}
          </AppText>
          <ChevronRight size={14} color={isUrgent ? palette.amber : palette.orange} />
        </View>
      </View>
    </Pressable>
  );
}

// ─── MerchantDashboardScreen ──────────────────────────────────────────────────

export function MerchantDashboardScreen() {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const navigation = useNavigation<NativeStackNavigationProp<MerchantTabParamList>>();

  const [dateRange, setDateRange] = useState<"Today" | "7 Days" | "30 Days">("Today");
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [menu, setMenu] = useState<DishDetail[]>([]);
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefetchMerchantRoute = useCallback(
    (routeName: keyof MerchantTabParamList) => {
      prefetchMerchantTab(routeName, activeOutlet?.id, activeOutlet?.merchantAccountId);
      preloadRoute(navigation, routeName);
    },
    [activeOutlet?.id, activeOutlet?.merchantAccountId, navigation],
  );

  const mappedRange = dateRange === "Today" ? "today" : dateRange === "7 Days" ? "7d" : "30d";

  const loadDashboard = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    if (!activeOutlet) {
      setError("No active outlet selected.");
      setAnalytics(null);
      setIsLoading(false);
      return;
    }

    try {
      const service = getHungryService();
      const [data, menuItems, inboxItems] = await Promise.all([
        service.merchant.getAnalytics(activeOutlet.id, mappedRange),
        service.merchant.getMenu(activeOutlet.id),
        service.merchant.getInbox(activeOutlet.id),
      ]);
      setMenu(menuItems);
      setInteractions(inboxItems);
      setAnalytics(buildMerchantDashboardMetrics(data, inboxItems));
      void service.merchant
        .syncLowRatingNotifications(activeOutlet.id)
        .catch((notificationError) => {
          console.error("Failed to sync low-rating notifications:", notificationError);
        });
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet, mappedRange]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
        <EmptyState
          title="Unable to load dashboard"
          body="Merchant dashboard data could not be loaded."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="Merchant dashboard"
          ctaLabel="Retry"
          onPress={loadDashboard}
        />
      </SafeAreaView>
    );
  }

  if (isLoading && !analytics) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
        <Skeleton
          height={180}
          width="100%"
          style={{ margin: 16, borderRadius: componentRadii.card }}
        />
        <Skeleton
          height={180}
          width="100%"
          style={{ margin: 16, borderRadius: componentRadii.card }}
        />
      </SafeAreaView>
    );
  }

  const views = analytics ? (
    (analytics.profileVisits + analytics.menuViews).toLocaleString()
  ) : (
    <Skeleton height={24} width={80} borderRadius={radii.sm} />
  );
  const viewsDelta = analytics
    ? getMetricDelta(
        analytics.profileVisits + analytics.menuViews,
        analytics.previousPeriodComparison.profileVisits +
          analytics.previousPeriodComparison.menuViews,
      )
    : undefined;
  const viewsComparison =
    dateRange === "Today"
      ? "vs yesterday"
      : dateRange === "7 Days"
        ? "vs previous 7 days"
        : "vs previous 30 days";
  const viewsSubtext = viewsDelta ? (
    `${viewsDelta.label} ${viewsComparison}`
  ) : (
    <Skeleton height={12} width={60} borderRadius={radii.sm} />
  );

  const rating = analytics ? (
    analytics.averageRating.toFixed(1)
  ) : (
    <Skeleton height={24} width={40} borderRadius={radii.sm} />
  );
  const ratingSubtext = analytics ? (
    `${analytics.reviewCount} ${analytics.reviewCount === 1 ? "review" : "reviews"}`
  ) : (
    <Skeleton height={12} width={80} borderRadius={radii.sm} />
  );
  const outletName = activeOutlet?.name?.trim() || "Your Stall";
  const outletStatus = getMerchantOutletStatus(activeOutlet);
  const outletStatusLabel = getMerchantOutletStatusLabel(outletStatus);
  const statusColor =
    outletStatus === "open"
      ? palette.success
      : outletStatus === "closed"
        ? palette.amber
        : palette.textMuted;
  const statusBg =
    outletStatus === "open"
      ? palette.successSoft
      : outletStatus === "closed"
        ? palette.amber + "20"
        : palette.bgSoft;
  const profileGaps = activeOutlet ? getMerchantProfileGaps(activeOutlet, menu) : [];
  const unrepliedReviews = getUnrepliedReviews(interactions);
  const hasActionCards =
    activeOutlet?.verification.status !== "verified" ||
    profileGaps.length > 0 ||
    unrepliedReviews.length > 0;
  const latestFeedback = interactions[0];
  const analyticsDisclosure = getDataTrustDisclosure("merchantAnalytics");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[6] }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 1, alignItems: "flex-start", gap: spacing[2] }}>
            <AppText variant="h1" style={{ fontWeight: "900" }}>
              {outletName}
            </AppText>
            <OutletSwitcher />
          </View>
        </View>

        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: statusBg,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1.5],
            borderRadius: radii.pill,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[1.5],
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
          <AppText variant="bodySmallBold" style={{ color: statusColor }}>
            {outletStatusLabel}
          </AppText>
        </View>

        {/* Date Range Selector */}
        <DateRangeSelector selected={dateRange} onSelect={setDateRange} />
        <AppText variant="micro" tone="muted">
          {analyticsDisclosure}
        </AppText>

        {/* Primary Metrics */}
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              title="Views"
              value={views}
              subtext={viewsSubtext}
              trend={viewsDelta?.trend}
              icon={<Users size={24} color={palette.orange} />}
              color={palette.orange}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard
              title="Avg Rating"
              value={rating}
              subtext={ratingSubtext}
              icon={<Star size={24} color={palette.amber} />}
              color={palette.amber}
            />
          </View>
        </View>

        {/* Action Cards (Dynamic Urgent Tasks) */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "800" }}>
            Actionable Insights
          </AppText>

          {activeOutlet?.verification.status !== "verified" ? (
            <ActionCard
              title="Verification Required"
              description="Verify your stall to make it discoverable to customers on the map."
              icon={<ClipboardList size={20} color={palette.amber} />}
              actionText="Complete Verification"
              onPressIn={() => prefetchMerchantRoute("VerificationCentre")}
              onPress={() => navigation.navigate("VerificationCentre")}
              isUrgent={true}
            />
          ) : null}

          {profileGaps.length > 0 ? (
            <ActionCard
              title="Incomplete Profile"
              description={`Missing: ${profileGaps.map((gap) => gap.label).join(", ")}`}
              icon={<Utensils size={20} color={palette.orange} />}
              actionText="Edit Profile"
              onPressIn={() => prefetchMerchantRoute("BusinessProfileEditor")}
              onPress={() => navigation.navigate("BusinessProfileEditor")}
            />
          ) : null}

          {unrepliedReviews.length > 0 ? (
            <ActionCard
              title="Unreplied Reviews"
              description={`${unrepliedReviews.length} review${unrepliedReviews.length === 1 ? "" : "s"} waiting for your response.`}
              icon={<MessageSquare size={20} color={palette.textSecondary} />}
              actionText="Read Reviews"
              onPressIn={() => prefetchMerchantRoute("CustomerInbox")}
              onPress={() => navigation.navigate("CustomerInbox")}
            />
          ) : null}

          {!hasActionCards ? (
            <View
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                padding: spacing[4],
              }}
            >
              <AppText variant="bodyBold">All caught up</AppText>
              <AppText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
                Your profile is complete and every review has a reply.
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Quick Actions (Big Buttons for Uncle Tan) */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "800" }}>
            Quick Actions
          </AppText>

          <Pressable
            onPressIn={() => prefetchMerchantRoute("Menu")}
            onPress={() => navigation.navigate("Menu")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing[4],
              gap: spacing[3],
              backgroundColor: palette.orange,
              borderRadius: componentRadii.button,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: componentRadii.iconButton,
                backgroundColor: palette.orangeLight + "40",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ClipboardList color={palette.white} size={28} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3" style={{ color: palette.white, fontWeight: "800" }}>
                Manage Menu
              </AppText>
              <AppText variant="bodySmall" style={{ color: palette.inverseTextSecondary }}>
                Update prices or add new dishes
              </AppText>
            </View>
            <ChevronRight color={palette.white} size={24} />
          </Pressable>

          <Pressable
            onPressIn={() => prefetchMerchantRoute("CustomerInbox")}
            onPress={() => navigation.navigate("CustomerInbox")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing[4],
              gap: spacing[3],
              backgroundColor: palette.surface,
              borderRadius: componentRadii.button,
              borderWidth: 2,
              borderColor: palette.orange,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: componentRadii.iconButton,
                backgroundColor: palette.orangeLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MessageSquare color={palette.orange} size={28} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3" style={{ color: palette.text, fontWeight: "800" }}>
                Recent Reviews
              </AppText>
              <AppText variant="bodySmall" tone="muted">
                Read and reply to your customers
              </AppText>
            </View>
            <ChevronRight color={palette.textMuted} size={24} />
          </Pressable>
        </View>

        {/* Business Tools */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "800" }}>
            Business Tools
          </AppText>

          <ActionCard
            title="Promotions"
            description="Create and manage offers for nearby customers."
            icon={<Megaphone size={20} color={palette.orange} />}
            actionText="Open Promotions"
            onPressIn={() => prefetchMerchantRoute("PromotionList")}
            onPress={() => navigation.navigate("PromotionList")}
          />

          <ActionCard
            title="Featured Visitors"
            description="Pin popular visitor reviews to your public stall page."
            icon={<Users size={20} color={palette.orange} />}
            actionText="Manage Visitors"
            onPressIn={() => prefetchMerchantRoute("FeaturedVisitors")}
            onPress={() => navigation.navigate("FeaturedVisitors")}
          />

          <ActionCard
            title="Insights"
            description="See a simple summary of your stall's recent activity."
            icon={<Sparkles size={20} color={palette.orange} />}
            actionText="View Insights"
            onPressIn={() => prefetchMerchantRoute("AIAssistant")}
            onPress={() => navigation.navigate("AIAssistant")}
          />

          <ActionCard
            title="Merchant Settings"
            description="Manage staff access, alerts, verification, and account actions."
            icon={<Settings size={20} color={palette.textSecondary} />}
            actionText="Open Settings"
            onPressIn={() => prefetchMerchantRoute("MerchantSettings")}
            onPress={() => navigation.navigate("MerchantSettings")}
          />

          <ActionCard
            title="In-App Ordering"
            description="Preview the QR ordering setup before the pilot opens."
            icon={<QrCode size={20} color={palette.textSecondary} />}
            actionText="Preview Ordering"
            onPressIn={() => prefetchMerchantRoute("OrdersComingSoon")}
            onPress={() => navigation.navigate("OrdersComingSoon")}
          />
        </View>

        {/* Recent Activity */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "800" }}>
            Recent Feedback
          </AppText>
          {latestFeedback ? (
            <Pressable
              onPressIn={() => prefetchMerchantRoute("CustomerInbox")}
              onPress={() => navigation.navigate("CustomerInbox")}
              style={({ pressed }) => [
                {
                  backgroundColor: palette.surface,
                  borderRadius: componentRadii.button,
                  padding: spacing[4],
                  gap: spacing[4],
                  borderWidth: 1,
                  borderColor: palette.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={{ flexDirection: "row", gap: spacing[3] }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: componentRadii.iconButton,
                    backgroundColor: palette.bgSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppText style={{ fontWeight: "800" }}>
                    {latestFeedback.authorName.slice(0, 1).toUpperCase()}
                  </AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText variant="bodyBold">{latestFeedback.authorName}</AppText>
                    <AppText variant="micro" tone="muted">
                      {new Date(latestFeedback.createdAt).toLocaleDateString()}
                    </AppText>
                  </View>
                  <AppText variant="bodySmall" numberOfLines={2}>
                    {latestFeedback.text}
                  </AppText>
                </View>
              </View>
            </Pressable>
          ) : (
            <View
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                padding: spacing[4],
              }}
            >
              <AppText variant="bodyBold">No customer feedback yet</AppText>
              <AppText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
                Reviews and questions will appear here once diners interact with your stall.
              </AppText>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
