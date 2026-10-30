/**
 * MerchantDashboardScreen
 * Command center for stall owners.
 * Features large numbers, big buttons, and simple navigation.
 * Feedback-driven for 'Uncle Tan' and 'Ahmad'.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, RefreshControl } from "react-native";
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
  ChevronRight,
  X,
} from "lucide-react-native";

import {
  AppText,
  Button,
  Skeleton,
  EmptyState,
  FilterChipRail,
  InlineBanner,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useUIStore } from "@/store/useUIStore";
import { ClosurePanel, type ClosureChoice } from "@/components/merchant/ClosurePanel";
import { getClosureLabel } from "@/features/merchant/closure";
import { formatCount } from "@/features/merchant/performanceFormat";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { OutletSwitcher } from "@/components/merchant/OutletSwitcher";
import { prefetchMerchantTab, preloadRoute } from "@/features/navigation/prefetch";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getDataTrustDisclosure } from "@/lib/services/dataTrustDisclosure";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import type {
  CustomerInteraction,
  MerchantAnalytics,
  MerchantDashboardSummary,
} from "@/types/domain";
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
import {
  formatAverageRating,
  formatReviewCountLabel,
  getMetricDelta,
  type MetricTrend,
  getMerchantOutletStatus,
  getMerchantOutletStatusLabel,
  getMerchantProfileGaps,
} from "@/features/merchant/merchantReadiness";

// ─── Date range ──────────────────────────────────────────────────────────────

type DashboardRange = "today" | "7d" | "30d";

// The shared chip rail gives each option a button role and selected state.
/** A translucent white tile on the orange card: a valid colour in both palettes. */
const ON_ORANGE_TILE = "rgba(255, 255, 255, 0.2)";

const DASHBOARD_RANGE_OPTIONS: { id: DashboardRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
];

const RANGE_COMPARISON_LABELS: Record<DashboardRange, string> = {
  today: "vs yesterday",
  "7d": "vs previous 7 days",
  "30d": "vs previous 30 days",
};

const RANGE_LABELS: Record<DashboardRange, string> = {
  today: "today",
  "7d": "in the last 7 days",
  "30d": "in the last 30 days",
};

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
      accessible
      accessibilityLabel={
        typeof value === "string" && typeof subtext === "string"
          ? `${title}: ${value}, ${subtext}`
          : title
      }
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
          <TrendingUp size={16} color={palette.success} />
        ) : trend === "down" ? (
          <TrendingDown size={16} color={palette.error} />
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
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionText: string;
  onPress: () => void;
  onPressIn?: () => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityHint={actionText}
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: palette.surface,
          borderRadius: componentRadii.button,
          padding: spacing[4],
          borderWidth: 1,
          borderColor: palette.border,
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
          backgroundColor: palette.bgSoft,
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
          <AppText variant="bodySmallBold" style={{ color: palette.orangeText }}>
            {actionText}
          </AppText>
          <ChevronRight size={14} color={palette.orangeText} />
        </View>
      </View>
    </Pressable>
  );
}

// ─── Inline reply card (merchant_inline_reply_v1 "inline" arm) ──────────────

/** The newest unreplied review with a Reply button, in place of the unreplied count card. */
export function MerchantInlineReplyCard({
  review,
  unrepliedCount,
  onReply,
}: {
  review: CustomerInteraction;
  unrepliedCount: number;
  onReply: (review: CustomerInteraction) => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const rating = typeof review.rating === "number" && review.rating > 0 ? review.rating : null;
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: componentRadii.button,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: palette.border,
        gap: spacing[2],
      }}
    >
      <AppText variant="bodyBold">
        {unrepliedCount === 1
          ? "1 review is waiting for your reply"
          : `${unrepliedCount} reviews are waiting for your reply`}
      </AppText>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[2] }}>
        <AppText variant="bodySmallBold">{review.authorName}</AppText>
        {rating ? (
          <AppText variant="bodySmall" tone="muted" accessibilityLabel={`Rated ${rating} out of 5`}>
            {"★".repeat(rating)}
          </AppText>
        ) : null}
      </View>
      <AppText variant="bodySmall" numberOfLines={2}>
        {review.text}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reply to ${review.authorName}`}
        onPress={() => onReply(review)}
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          minHeight: 44,
          justifyContent: "center",
          paddingHorizontal: spacing[4],
          borderRadius: componentRadii.button,
          backgroundColor: palette.orange,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <AppText variant="bodySmallBold" style={{ color: palette.textOnOrange }}>
          Reply
        </AppText>
      </Pressable>
    </View>
  );
}

// ─── MerchantDashboardScreen ──────────────────────────────────────────────────

export function MerchantDashboardScreen() {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  // Contact details are not persisted: until this session synced the account they are unknown.
  const contactKnown = useMerchantStore((state) => state.accountSyncedAt !== null);
  const navigation = useNavigation<NativeStackNavigationProp<MerchantTabParamList>>();
  const isFocused = useIsFocused();

  const [dateRange, setDateRange] = useState<DashboardRange>("today");
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [summary, setSummary] = useState<MerchantDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useUIStore((state) => state.showToast);
  const updateOutletProfile = useMerchantStore((state) => state.updateOutletProfile);
  const [isClosurePanelOpen, setIsClosurePanelOpen] = useState(false);
  const [isSavingClosure, setIsSavingClosure] = useState(false);
  // Only the newest request may write state: a slow "30 Days" reply must not overwrite "Today".
  const latestRequestId = useRef(0);
  const prefetchMerchantRoute = useCallback(
    (routeName: keyof MerchantTabParamList) => {
      prefetchMerchantTab(routeName, activeOutlet?.id, activeOutlet?.merchantAccountId);
      preloadRoute(navigation, routeName);
    },
    [activeOutlet?.id, activeOutlet?.merchantAccountId, navigation],
  );

  // "Pause store": a closure replaces any free-text closure, and reopening clears both.
  const saveClosure = useCallback(
    async (choice: ClosureChoice) => {
      if (!activeOutlet) return;
      setIsSavingClosure(true);
      try {
        const updated = await getHungryService().merchant.updateBusinessProfile(activeOutlet.id, {
          closedUntil: choice.kind === "open" ? null : choice.closedUntil,
          temporaryClosure: "",
        });
        updateOutletProfile(activeOutlet.id, updated);
        trackMerchantEvent("merchant_closure_set", activeOutlet.id, { kind: choice.kind });
        showToast({
          message:
            choice.kind === "open"
              ? "You are open again. Diners see your normal hours."
              : `Done. Diners see "${getClosureLabel(choice.closedUntil) ?? "Closed"}".`,
          tone: "success",
        });
        setIsClosurePanelOpen(false);
      } catch (e) {
        reportError(e, { screen: "MerchantDashboard", action: "set_closure" });
        showToast({ message: "Couldn't update your status. Try again.", tone: "error" });
      } finally {
        setIsSavingClosure(false);
      }
    },
    [activeOutlet, showToast, updateOutletProfile],
  );

  const activeOutletId = activeOutlet?.id;

  const loadDashboard = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setError(null);
    setIsLoading(true);
    if (!activeOutletId) {
      setError("No active outlet selected.");
      setAnalytics(null);
      setIsLoading(false);
      return;
    }

    try {
      const service = getHungryService();
      // Analytics carries the range's own rating and review count; the summary carries the
      // all-time counts behind the action cards. No full menu or inbox download.
      const [data, counts] = await Promise.all([
        service.merchant.getAnalytics(activeOutletId, dateRange),
        service.merchant.getDashboardSummary(activeOutletId),
      ]);
      if (requestId !== latestRequestId.current) return;
      setAnalytics(data);
      setSummary(counts);
    } catch (err) {
      if (requestId !== latestRequestId.current) return;
      reportError(err, { screen: "MerchantDashboard", action: "load_dashboard" });
      setError(err instanceof Error ? err.message : "Failed to load dashboard analytics.");
    } finally {
      if (requestId === latestRequestId.current) setIsLoading(false);
    }
  }, [activeOutletId, dateRange]);

  // Refetch on every focus: a reply, dish edit or outlet change elsewhere updates the cards.
  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useFocusEffect(
    useCallback(() => {
      trackMerchantEvent("merchant_dashboard_viewed", activeOutletId);
    }, [activeOutletId]),
  );

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard]);

  const unrepliedCount = summary?.unrepliedReviews ?? 0;
  // Exposure only for merchants who actually see the card: focused, loaded, reviews waiting.
  // Latched once reached, so a focus refetch or range change (which sets isLoading) never drops
  // an inline merchant back to the control card mid-session.
  const [replyEligible, setReplyEligible] = useState(false);
  useEffect(() => {
    if (!replyEligible && isFocused && !isLoading && summary !== null && unrepliedCount > 0) {
      setReplyEligible(true);
    }
  }, [isFocused, isLoading, replyEligible, summary, unrepliedCount]);
  const replyVariant = useExperimentVariant("merchant_inline_reply_v1", {
    enabled: replyEligible,
  });
  const [inlineReview, setInlineReview] = useState<CustomerInteraction | null>(null);
  useEffect(() => {
    // Only the inline arm pays for the extra read.
    if (replyVariant !== "inline" || !activeOutletId || unrepliedCount === 0) {
      setInlineReview(null);
      return;
    }
    let isMounted = true;
    getHungryService()
      .merchant.getInbox(activeOutletId, { type: "review", unrepliedOnly: true, limit: 1 })
      .then((rows) => {
        if (isMounted) setInlineReview(rows[0] ?? null);
      })
      .catch((err) => {
        reportError(err, { screen: "MerchantDashboard", action: "load_inline_review" });
      });
    return () => {
      isMounted = false;
    };
  }, [activeOutletId, replyVariant, unrepliedCount]);

  // A failed refresh with numbers already on screen shows a banner; only a first load that
  // failed replaces the screen.
  if (error && !analytics) {
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

  // One headline number, named the same as on Performance: profile visits.
  const views = analytics ? (
    formatCount(analytics.profileVisits)
  ) : (
    <Skeleton height={24} width={80} borderRadius={radii.sm} />
  );
  const viewsDelta = analytics
    ? getMetricDelta(analytics.profileVisits, analytics.previousPeriodComparison.profileVisits)
    : undefined;
  const viewsComparison = RANGE_COMPARISON_LABELS[dateRange];
  const viewsSubtext = viewsDelta ? (
    `${viewsDelta.label} ${viewsComparison}`
  ) : (
    <Skeleton height={12} width={60} borderRadius={radii.sm} />
  );

  const rating = analytics ? (
    formatAverageRating(analytics.averageRating, analytics.reviewCount)
  ) : (
    <Skeleton height={24} width={40} borderRadius={radii.sm} />
  );
  const ratingSubtext = analytics ? (
    formatReviewCountLabel(analytics.reviewCount, RANGE_LABELS[dateRange])
  ) : (
    <Skeleton height={12} width={80} borderRadius={radii.sm} />
  );
  const outletName = activeOutlet?.name?.trim() || "Your stall";
  const outletStatus = getMerchantOutletStatus(activeOutlet);
  const statusText =
    getClosureLabel(activeOutlet?.closedUntil) ?? getMerchantOutletStatusLabel(outletStatus);
  const statusColor =
    outletStatus === "open" || outletStatus === "live"
      ? palette.success
      : outletStatus === "closed"
        ? palette.warning
        : palette.textMuted;
  const statusBg =
    outletStatus === "open" || outletStatus === "live"
      ? palette.successSoft
      : outletStatus === "closed"
        ? palette.amber + "20"
        : palette.bgSoft;
  const profileGaps =
    activeOutlet && summary ? getMerchantProfileGaps(activeOutlet, summary, { contactKnown }) : [];
  const hasActionCards = profileGaps.length > 0 || unrepliedCount > 0;
  const latestFeedback = summary?.latestReview;
  const analyticsDisclosure = getDataTrustDisclosure("merchantAnalytics");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[6] }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refreshDashboard()}
            tintColor={palette.orange}
          />
        }
      >
        {error ? (
          <InlineBanner tone="error" message={`Couldn't refresh the dashboard. ${error}`} />
        ) : null}
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

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isClosurePanelOpen }}
          accessibilityLabel={`Stall status: ${statusText}. ${isClosurePanelOpen ? "Hide" : "Change"} status`}
          onPress={() => setIsClosurePanelOpen((open) => !open)}
          style={{
            alignSelf: "flex-start",
            backgroundColor: statusBg,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1.5],
            borderRadius: radii.pill,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[1.5],
            minHeight: 44,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
          <AppText variant="bodySmallBold" style={{ color: statusColor }}>
            {statusText}
          </AppText>
          <ChevronRight
            color={statusColor}
            size={16}
            style={{ transform: [{ rotate: isClosurePanelOpen ? "-90deg" : "90deg" }] }}
          />
        </Pressable>
        {isClosurePanelOpen && activeOutlet ? (
          <ClosurePanel outlet={activeOutlet} isSaving={isSavingClosure} onChoose={saveClosure} />
        ) : null}

        {/* Date Range Selector */}
        <FilterChipRail
          options={DASHBOARD_RANGE_OPTIONS}
          selectedId={dateRange}
          onSelect={setDateRange}
          gap={spacing[2]}
        />
        <AppText variant="micro" tone="muted">
          {analyticsDisclosure}
        </AppText>

        {/* Primary Metrics */}
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              title="Profile visits"
              value={views}
              subtext={viewsSubtext}
              trend={viewsDelta?.trend}
              icon={<Users size={24} color={palette.orange} />}
              color={palette.orange}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard
              title="Avg rating"
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
            To do
          </AppText>

          {profileGaps.length > 0 ? (
            <ActionCard
              title="Incomplete profile"
              description={`Missing: ${profileGaps.map((gap) => gap.label).join(", ")}`}
              icon={<Utensils size={20} color={palette.orange} />}
              actionText="Edit profile"
              onPressIn={() => prefetchMerchantRoute("BusinessProfileEditor")}
              onPress={() => navigation.navigate("BusinessProfileEditor")}
            />
          ) : null}

          {unrepliedCount > 0 && replyVariant === "inline" && inlineReview ? (
            <MerchantInlineReplyCard
              review={inlineReview}
              unrepliedCount={unrepliedCount}
              onReply={(review) =>
                navigation.navigate("CustomerInbox", {
                  filter: "unreplied",
                  replyToId: review.id,
                })
              }
            />
          ) : unrepliedCount > 0 ? (
            <ActionCard
              title="Unreplied reviews"
              description={`${unrepliedCount} review${unrepliedCount === 1 ? "" : "s"} waiting for your response.`}
              icon={<MessageSquare size={20} color={palette.textSecondary} />}
              actionText="Read reviews"
              onPressIn={() => prefetchMerchantRoute("CustomerInbox")}
              onPress={() => navigation.navigate("CustomerInbox", { filter: "unreplied" })}
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
            Quick actions
          </AppText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage menu. Update prices or add new dishes"
            onPressIn={() => prefetchMerchantRoute("Menu")}
            onPress={() => navigation.navigate("Menu")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing[4],
              gap: spacing[3],
              // orangeControl keeps white text above 4.5:1 in both palettes (R4-8).
              backgroundColor: palette.orangeControl,
              borderRadius: componentRadii.button,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: componentRadii.iconButton,
                backgroundColor: ON_ORANGE_TILE,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ClipboardList color={palette.white} size={28} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3" style={{ color: palette.white, fontWeight: "800" }}>
                Manage menu
              </AppText>
              <AppText variant="bodySmall" style={{ color: palette.white }}>
                Update prices or add new dishes
              </AppText>
            </View>
            <ChevronRight color={palette.white} size={24} />
          </Pressable>
        </View>

        {/* Business Tools */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "800" }}>
            Business tools
          </AppText>

          <ActionCard
            title="Promotions"
            description="Create and manage offers for nearby customers."
            icon={<Megaphone size={20} color={palette.orange} />}
            actionText="Open promotions"
            onPressIn={() => prefetchMerchantRoute("PromotionList")}
            onPress={() => navigation.navigate("PromotionList")}
          />

          <ActionCard
            title="Featured visitors"
            description="Pin popular visitor reviews to your public stall page."
            icon={<Users size={20} color={palette.orange} />}
            actionText="Manage visitors"
            onPressIn={() => prefetchMerchantRoute("FeaturedVisitors")}
            onPress={() => navigation.navigate("FeaturedVisitors")}
          />

          <ActionCard
            title="Insights"
            description="See a simple summary of your stall's recent activity."
            icon={<Sparkles size={20} color={palette.orange} />}
            actionText="View insights"
            onPressIn={() => prefetchMerchantRoute("AIAssistant")}
            onPress={() => navigation.navigate("AIAssistant")}
          />

          <ActionCard
            title="Merchant settings"
            description="Alerts, verification and account."
            icon={<Settings size={20} color={palette.textSecondary} />}
            actionText="Open settings"
            onPressIn={() => prefetchMerchantRoute("MerchantSettings")}
            onPress={() => navigation.navigate("MerchantSettings")}
          />
        </View>

        {/* Recent Activity */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
          >
            <AppText variant="h3" style={{ fontWeight: "800" }}>
              Recent reviews
            </AppText>
            <Button
              label="See all"
              variant="ghost"
              size="sm"
              onPressIn={() => prefetchMerchantRoute("CustomerInbox")}
              onPress={() => navigation.navigate("CustomerInbox", { filter: "all" })}
            />
          </View>
          {latestFeedback ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Latest review from ${latestFeedback.authorName}: ${latestFeedback.text}`}
              onPressIn={() => prefetchMerchantRoute("CustomerInbox")}
              onPress={() => navigation.navigate("CustomerInbox", { filter: "all" })}
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
