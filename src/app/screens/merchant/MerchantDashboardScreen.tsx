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
        <AppText variant="micro" tone="muted">
          {subtext}
        </AppText>
      </View>
    </View>
  );
}

// ─── MerchantDashboardScreen ──────────────────────────────────────────────────

export function MerchantDashboardScreen() {
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[6] }}>
        {/* Header */}
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <View>
            <AppText variant="h1" style={{ fontWeight: "900" }}>
              Hello, Uncle Tan!
            </AppText>
            <AppText variant="body" tone="muted">
              Wonton Mee Stall #01-12
            </AppText>
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
        <View
          style={{
            backgroundColor: palette.successSoft,
            padding: spacing[3],
            borderRadius: radii.lg,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
          }}
        >
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.success }}
          />
          <AppText variant="bodySmallBold" style={{ color: palette.success }}>
            STALL IS LIVE & DISCOVERABLE
          </AppText>
        </View>

        {/* Primary Metrics */}
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              title="Today's Views"
              value="1,284"
              subtext="+12% from yesterday"
              icon={<Users size={24} color={palette.orange} />}
              color={palette.orange}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard
              title="Avg Rating"
              value="4.8"
              subtext="Based on 42 reviews"
              icon={<Star size={24} color={palette.amber} />}
              color={palette.amber}
            />
          </View>
        </View>

        {/* Quick Actions (Big Buttons for Uncle Tan) */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3" style={{ fontWeight: "800" }}>
            Quick Actions
          </AppText>

          <Pressable
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
