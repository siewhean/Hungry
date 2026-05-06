import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, Pressable, Alert } from "react-native";
import {
  TrendingUp,
  AlertCircle,
  Image as ImageIcon,
  MessageSquare,
  ChevronRight,
  X,
  BarChart2,
  CheckCircle2,
  Sparkles,
} from "lucide-react-native";

import { AppText, IconButton, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { AIBusinessInsight } from "@/types/domain";

export function AIAssistantScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [insights, setInsights] = useState<AIBusinessInsight[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<AIBusinessInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadInsights = useCallback(async () => {
    if (!activeOutlet) return;
    setIsLoading(true);
    try {
      const data = await getHungryService().merchant.getAIInsights(activeOutlet.id);
      setInsights(data.filter((i) => i.type !== "weekly_summary" && !i.isDismissed));

      const summary = await getHungryService().merchant.getWeeklySummary(activeOutlet.id);
      setWeeklySummary(summary);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const handleDismiss = (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
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
    <Screen title="AI Assistant">
      <View style={{ gap: spacing[6], width: "100%" }}>
        <AppText variant="body" tone="muted" style={{ paddingHorizontal: spacing[1] }}>
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

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "bold", paddingHorizontal: spacing[1] }}>
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
                        gap: spacing[3],
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
                    <IconButton
                      icon={<X size={18} color={palette.textMuted} />}
                      onPress={() => handleDismiss(insight.id)}
                      accessibilityLabel="Dismiss insight"
                    />
                  </View>

                  <AppText
                    variant="body"
                    tone="muted"
                    style={{ marginBottom: spacing[3], marginLeft: 48 }}
                  >
                    {insight.body}
                  </AppText>

                  {insight.actionLabel && (
                    <Pressable
                      onPress={() => Alert.alert("Action", `Navigate to ${insight.actionTarget}`)}
                      style={[
                        styles.actionButton,
                        { borderColor: palette.border, marginLeft: 48, borderRadius: radii.pill },
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
          style={{ padding: spacing[4], backgroundColor: palette.bgSoft, borderRadius: radii.md }}
        >
          <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>
            AI insights are generated automatically based on your stall&apos;s data. These are
            suggestions and drafts; nothing is published automatically.
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    gap: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    borderStyle: "dashed",
  },
});
