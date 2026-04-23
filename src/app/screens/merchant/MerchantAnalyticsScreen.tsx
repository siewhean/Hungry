import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart3, LineChart, PieChart } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export function MerchantAnalyticsScreen() {
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[6] }}>
        <AppText variant="h1" style={{ fontWeight: "900" }}>
          Performance
        </AppText>

        {/* Chart Placeholders */}
        <View style={{ gap: spacing[4] }}>
          <View
            style={{
              backgroundColor: palette.surface,
              padding: spacing[4],
              borderRadius: radii.xl,
              gap: spacing[4],
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <BarChart3 size={20} color={palette.orange} />
              <AppText variant="bodyBold">Popular Hours</AppText>
            </View>
            <View
              style={{
                height: 150,
                backgroundColor: palette.bgSoft,
                borderRadius: radii.lg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText tone="muted">Chart: Peak traffic at 12:30 PM</AppText>
            </View>
          </View>

          <View
            style={{
              backgroundColor: palette.surface,
              padding: spacing[4],
              borderRadius: radii.xl,
              gap: spacing[4],
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <PieChart size={20} color={palette.amber} />
              <AppText variant="bodyBold">Customer Demographics</AppText>
            </View>
            <View
              style={{
                height: 150,
                backgroundColor: palette.bgSoft,
                borderRadius: radii.lg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText tone="muted">Chart: 65% Repeat Customers</AppText>
            </View>
          </View>

          <View
            style={{
              backgroundColor: palette.surface,
              padding: spacing[4],
              borderRadius: radii.xl,
              gap: spacing[4],
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LineChart size={20} color={palette.success} />
              <AppText variant="bodyBold">Monthly Growth</AppText>
            </View>
            <View
              style={{
                height: 150,
                backgroundColor: palette.bgSoft,
                borderRadius: radii.lg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText tone="muted">Chart: +15% views this month</AppText>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
