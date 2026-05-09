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
  Users,
  Star,
  ClipboardList,
  Utensils,
  MessageSquare,
  ChevronRight,
} from "lucide-react-native";

import { AppText, Skeleton } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useProfileStore } from "@/store/useProfileStore";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { OutletSwitcher } from "@/components/merchant/OutletSwitcher";
import { prefetchMerchantTab, preloadRoute } from "@/features/navigation/prefetch";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { MerchantAnalytics } from "@/types/domain";

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
}: {
  title: string;
  value: string | React.ReactNode;
  subtext: string | React.ReactNode;
  icon: React.ReactNode;
  color: string;
}) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  return (
    <View
      style={{
        borderColor: palette.border,
        borderWidth: 1,
        backgroundColor: palette.surface,
        borderRadius: radii.xl,
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
            borderRadius: radii.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color + "15",
          }}
        >
          {icon}
        </View>
        <TrendingUp size={16} color={palette.success} />
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
          <AppText variant="micro" style={{ color: palette.success, marginTop: 4 }}>
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
  const { palette, spacing, radii } = useHungryTheme();
  return (
    <Pressable
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: isUrgent ? palette.amber + "10" : palette.surface,
          borderRadius: radii.xl,
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
          borderRadius: 20,
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
  const { palette, spacing, radii } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const navigation = useNavigation<NativeStackNavigationProp<MerchantTabParamList>>();

  const [dateRange, setDateRange] = useState<"Today" | "7 Days" | "30 Days">("Today");
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const prefetchMerchantRoute = useCallback(
    (routeName: keyof MerchantTabParamList) => {
      prefetchMerchantTab(routeName, activeOutlet?.id, activeOutlet?.merchantAccountId);
      preloadRoute(navigation, routeName);
    },
    [activeOutlet?.id, activeOutlet?.merchantAccountId, navigation],
  );

  useEffect(() => {
    if (!activeOutlet) return;
    const fetchAnalytics = async () => {
      const mappedRange = dateRange === "Today" ? "today" : dateRange === "7 Days" ? "7d" : "30d";
      try {
        const data = await getHungryService().merchant.getAnalytics(activeOutlet.id, mappedRange);
        setAnalytics(data);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      }
    };
    fetchAnalytics();
  }, [activeOutlet, dateRange]);

  const views = analytics ? (
    (analytics.profileVisits + analytics.menuViews).toLocaleString()
  ) : (
    <Skeleton height={24} width={80} borderRadius={radii.sm} />
  );
  const viewsSubtext = analytics ? (
    dateRange === "Today" ? (
      "vs yesterday"
    ) : dateRange === "7 Days" ? (
      "vs last week"
    ) : (
      "vs last month"
    )
  ) : (
    <Skeleton height={12} width={60} borderRadius={radii.sm} />
  );

  const rating = analytics ? (
    analytics.averageRating.toFixed(1)
  ) : (
    <Skeleton height={24} width={40} borderRadius={radii.sm} />
  );
  const ratingSubtext = analytics ? (
    `${analytics.reviewCount} new reviews`
  ) : (
    <Skeleton height={12} width={80} borderRadius={radii.sm} />
  );

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
              Hello, {profile.displayName.split(" ")[0]}!
            </AppText>
            <OutletSwitcher />
          </View>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: palette.orange,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Utensils color={palette.white} size={24} />
          </View>
        </View>

        {/* Status Badge */}
        {activeOutlet?.verification.status === "verified" ? (
          <View
            style={[
              {
                backgroundColor: palette.successSoft,
                padding: spacing[3],
                borderRadius: radii.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
              },
            ]}
          >
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.success }}
            />
            <AppText variant="bodySmallBold" style={{ color: palette.success, flex: 1 }}>
              STALL IS LIVE & DISCOVERABLE
            </AppText>
          </View>
        ) : null}

        {/* Date Range Selector */}
        <DateRangeSelector selected={dateRange} onSelect={setDateRange} />

        {/* Primary Metrics */}
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              title="Views"
              value={views}
              subtext={viewsSubtext}
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

          {activeOutlet?.verification.status !== "verified" && (
            <ActionCard
              title="Verification Required"
              description="Verify your stall to make it discoverable to customers on the map."
              icon={<ClipboardList size={20} color={palette.amber} />}
              actionText="Complete Verification"
              onPressIn={() => prefetchMerchantRoute("VerificationCentre")}
              onPress={() => navigation.navigate("VerificationCentre")}
              isUrgent={true}
            />
          )}

          <ActionCard
            title="Incomplete Profile"
            description="Add your opening hours to help customers know when to visit."
            icon={<Utensils size={20} color={palette.orange} />}
            actionText="Edit Profile"
            onPressIn={() => prefetchMerchantRoute("BusinessProfileEditor")}
            onPress={() => navigation.navigate("BusinessProfileEditor")}
          />

          <ActionCard
            title="Unreplied Reviews"
            description="You have 2 new reviews waiting for your response."
            icon={<MessageSquare size={20} color={palette.textSecondary} />}
            actionText="Read Reviews"
            onPressIn={() => prefetchMerchantRoute("CustomerInbox")}
            onPress={() => navigation.navigate("CustomerInbox")}
          />
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
              borderRadius: radii.xl,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radii.lg,
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
              <AppText variant="bodySmall" style={{ color: "rgba(255,255,255,0.8)" }}>
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
              borderRadius: radii.xl,
              borderWidth: 2,
              borderColor: palette.orange,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radii.lg,
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

        {/* Recent Activity */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "800" }}>
            Recent Feedback
          </AppText>
          <Pressable
            onPressIn={() => prefetchMerchantRoute("CustomerInbox")}
            onPress={() => navigation.navigate("CustomerInbox")}
            style={({ pressed }) => [
              {
                backgroundColor: palette.surface,
                borderRadius: radii.xl,
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
                  borderRadius: 20,
                  backgroundColor: palette.bgSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppText style={{ fontWeight: "800" }}>S</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText variant="bodyBold">Sarah L.</AppText>
                  <AppText variant="micro" tone="muted">
                    2h ago
                  </AppText>
                </View>
                <AppText variant="bodySmall" numberOfLines={2}>
                  &quot;The wonton skin is so thin and the char siu is perfectly caramelised. My
                  favorite in Maxwell!&quot;
                </AppText>
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
