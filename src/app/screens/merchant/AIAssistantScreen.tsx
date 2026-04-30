import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, Pressable, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Image as ImageIcon,
  MessageSquare,
  ChevronRight,
  X,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppText, Button, IconButton, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { hungryService } from "@/lib/services/mock/mockService";
import type { AIBusinessInsight } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

// Need to import missing icons at the top that were referenced in the code
import { BarChart2, CheckCircle2 } from "lucide-react-native";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "AIAssistant">;

export function AIAssistantScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const insets = useSafeAreaInsets();

  const [insights, setInsights] = useState<AIBusinessInsight[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<AIBusinessInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadInsights = useCallback(async () => {
    if (!activeOutlet) return;
    setIsLoading(true);
    try {
      const data = await hungryService.merchant.getAIInsights(activeOutlet.id);
      setInsights(data.filter((i) => i.type !== "weekly_summary" && !i.isDismissed));

      const summary = await hungryService.merchant.getWeeklySummary(activeOutlet.id);
      setWeeklySummary(summary);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const handleDismiss = (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAction = (insight: AIBusinessInsight) => {
    if (!insight.actionTarget) return;

    // Navigate based on actionTarget
    switch (insight.actionTarget) {
      case "Menu":
        navigation.navigate("Menu");
        break;
      case "BusinessProfileEditor":
        navigation.navigate("BusinessProfileEditor");
        break;
      case "PromotionBuilder":
        navigation.navigate("PromotionBuilder");
        break;
      case "CustomerInbox":
        navigation.navigate("CustomerInbox");
        break;
      default:
        Alert.alert("Action", "Navigating to feature...");
    }
  };

  const getInsightIcon = (type: AIBusinessInsight["type"]) => {
    switch (type) {
      case "demand_insight":
        return <TrendingUp size={20} color={palette.orange} />;
      case "profile_improvement":
        return <AlertCircle size={20} color={palette.info} />;
      case "photo_enhancement":
        return <ImageIcon size={20} color={palette.success} />;
      case "promotion_tip":
        return <Sparkles size={20} color={palette.orange} />;
      case "menu_cleanup":
        return <MessageSquare size={20} color={palette.error} />;
      default:
        return <Sparkles size={20} color={palette.orange} />;
    }
  };

  return (
    <Screen style={{ backgroundColor: palette.bg }}>
      <View style={[styles.header, { paddingTop: spacing[3], paddingHorizontal: spacing[4] }]}>
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={24} color={palette.text} />}
          onPress={() => navigation.goBack()}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Sparkles size={20} color={palette.orange} />
          <AppText variant="h2" style={{ fontWeight: "800" }}>
            AI Assistant
          </AppText>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[4], paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadInsights} />}
      >
        <AppText variant="body" tone="muted" style={{ marginBottom: spacing[2] }}>
          AI-powered insights to help you optimize your menu, attract more customers, and boost
          sales.
        </AppText>

        {weeklySummary && (
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: palette.orangeLight,
                borderColor: palette.orange,
                borderRadius: radii.lg,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
                marginBottom: spacing[3],
              }}
            >
              <View style={{ backgroundColor: palette.orange, padding: 6, borderRadius: radii.sm }}>
                <BarChart2 size={16} color={palette.white} />
              </View>
              <AppText variant="bodySmallBold" style={{ color: palette.orange }}>
                WEEKLY DIGEST
              </AppText>
            </View>
            <AppText
              variant="h3"
              style={{ fontWeight: "bold", marginBottom: spacing[2], color: palette.text }}
            >
              {weeklySummary.title}
            </AppText>
            <AppText variant="body" style={{ color: palette.text }}>
              {weeklySummary.body}
            </AppText>
          </View>
        )}

        <View style={{ marginTop: spacing[2] }}>
          <AppText variant="h3" style={{ fontWeight: "bold", marginBottom: spacing[3] }}>
            Actionable Insights
          </AppText>

          {insights.length === 0 && !isLoading ? (
            <View style={styles.emptyContainer}>
              <CheckCircle2 size={48} color={palette.success} />
              <AppText variant="bodyBold" style={{ marginTop: spacing[3] }}>
                You&apos;re all set!
              </AppText>
              <AppText
                variant="bodySmall"
                tone="muted"
                style={{ textAlign: "center", marginTop: 4 }}
              >
                Check back later for new insights based on customer data.
              </AppText>
            </View>
          ) : (
            <View style={{ gap: spacing[3] }}>
              {insights.map((insight) => (
                <View
                  key={insight.id}
                  style={[
                    styles.insightCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: radii.lg,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: spacing[2],
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing[2],
                        flex: 1,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: palette.bgSoft,
                          padding: 8,
                          borderRadius: radii.md,
                        }}
                      >
                        {getInsightIcon(insight.type)}
                      </View>
                      <AppText variant="bodyBold" style={{ flex: 1 }}>
                        {insight.title}
                      </AppText>
                    </View>
                    <Pressable onPress={() => handleDismiss(insight.id)} hitSlop={10}>
                      <X size={18} color={palette.textMuted} />
                    </Pressable>
                  </View>

                  <AppText
                    variant="body"
                    tone="muted"
                    style={{ marginBottom: insight.actionLabel ? spacing[3] : 0, marginLeft: 44 }}
                  >
                    {insight.body}
                  </AppText>

                  {insight.actionLabel && (
                    <Pressable
                      onPress={() => handleAction(insight)}
                      style={[
                        styles.actionButton,
                        { borderColor: palette.border, marginLeft: 44, borderRadius: radii.pill },
                      ]}
                    >
                      <AppText variant="bodySmallBold">{insight.actionLabel}</AppText>
                      <ChevronRight size={16} color={palette.text} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <View
          style={{
            padding: spacing[4],
            backgroundColor: palette.bgSoft,
            borderRadius: radii.md,
            marginTop: spacing[4],
          }}
        >
          <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>
            AI insights are generated automatically based on your stall&apos;s data. These are
            suggestions and drafts; nothing is published automatically.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  summaryCard: {
    padding: 20,
    borderWidth: 1,
  },
  insightCard: {
    padding: 16,
    borderWidth: 1,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    borderStyle: "dashed",
  },
});
