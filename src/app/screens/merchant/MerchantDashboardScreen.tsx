/**
 * MerchantDashboardScreen
 * Command center for stall owners.
 * Features large numbers, big buttons, and simple navigation.
 * Feedback-driven for 'Uncle Tan' and 'Ahmad'.
 */
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
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

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useProfileStore } from "@/store/useProfileStore";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { OutletSwitcher } from "@/components/merchant/OutletSwitcher";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useState } from "react";

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

function MetricCard({ title, value, subtext, icon, color }: any) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: palette.surface,
          borderRadius: radii.xl,
          padding: spacing[4],
          ...shadows.card,
        },
      ]}
    >
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <View style={[styles.iconBox, { backgroundColor: color + "15" }]}>{icon}</View>
        <TrendingUp size={16} color={palette.success} />
      </View>
      <View style={{ marginTop: spacing[3] }}>
        <AppText variant="h2" style={{ fontWeight: "900" }}>
          {value}
        </AppText>
        <AppText variant="bodySmallBold" style={{ color: palette.textSecondary }}>
          {title}
        </AppText>
        <AppText variant="micro" style={{ color: palette.success, marginTop: 4 }}>
          {subtext}
        </AppText>
      </View>
    </View>
  );
}

// ─── Action Card ─────────────────────────────────────────────────────────────

function ActionCard({ title, description, icon, actionText, onPress, isUrgent = false }: any) {
  const { palette, spacing, radii } = useHungryTheme();
  return (
    <Pressable
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

  // Mock data based on dateRange
  const views = dateRange === "Today" ? "1,284" : dateRange === "7 Days" ? "8,432" : "34,291";
  const viewsSubtext =
    dateRange === "Today"
      ? "+12% from yesterday"
      : dateRange === "7 Days"
        ? "+5% from last week"
        : "+18% from last month";

  const rating = dateRange === "Today" ? "4.8" : dateRange === "7 Days" ? "4.7" : "4.8";
  const ratingSubtext =
    dateRange === "Today"
      ? "2 new reviews"
      : dateRange === "7 Days"
        ? "14 new reviews"
        : "42 new reviews";

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
              onPress={() => navigation.navigate("VerificationCentre")}
              isUrgent={true}
            />
          )}

          <ActionCard
            title="Incomplete Profile"
            description="Add your opening hours to help customers know when to visit."
            icon={<Utensils size={20} color={palette.orange} />}
            actionText="Edit Profile"
            onPress={() => navigation.navigate("BusinessProfileEditor")}
          />

          <ActionCard
            title="Unreplied Reviews"
            description="You have 2 new reviews waiting for your response."
            icon={<MessageSquare size={20} color={palette.textSecondary} />}
            actionText="Read Reviews"
            onPress={() => navigation.navigate("CustomerInbox")}
          />
        </View>

        {/* Quick Actions (Big Buttons for Uncle Tan) */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "800" }}>
            Quick Actions
          </AppText>

          <Pressable
            onPress={() => navigation.navigate("Menu")}
            style={[styles.bigButton, { backgroundColor: palette.orange, borderRadius: radii.xl }]}
          >
            <View style={styles.bigButtonIcon}>
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
            onPress={() => navigation.navigate("CustomerInbox")}
            style={[
              styles.bigButton,
              {
                backgroundColor: palette.surface,
                borderRadius: radii.xl,
                borderWidth: 2,
                borderColor: palette.orange,
              },
            ]}
          >
            <View style={[styles.bigButtonIcon, { backgroundColor: palette.orangeLight }]}>
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
          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: radii.xl,
              padding: spacing[4],
              gap: spacing[4],
              borderWidth: 1,
              borderColor: palette.border,
            }}
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
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bigButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  bigButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});
