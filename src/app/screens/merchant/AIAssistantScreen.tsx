import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
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

import { AppText, IconButton, Screen, EmptyState } from "@/components/ui";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { AIBusinessInsight } from "@/types/domain";

type MerchantNavigation = BottomTabNavigationProp<MerchantTabParamList>;

export function AIAssistantScreen() {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<MerchantNavigation>();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [insights, setInsights] = useState<AIBusinessInsight[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<AIBusinessInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (!activeOutlet) {
      setError("No active outlet selected for AI insights.");
      setIsLoading(false);
      return;
    }
    try {
      const data = await getHungryService().merchant.getAIInsights(activeOutlet.id);
      setInsights(data.filter((i) => i.type !== "weekly_summary" && !i.isDismissed));

      const summary = await getHungryService().merchant.getWeeklySummary(activeOutlet.id);
      setWeeklySummary(summary);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load AI insights.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  if (error) {
    return (
      <Screen title="AI Assistant">
        <EmptyState
          title="Unable to load AI assistant"
          body="We could not load your AI assistant data."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="AI assistant"
          ctaLabel="Retry"
          onPress={loadInsights}
        />
      </Screen>
    );
  }

  const handleDismiss = (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  };

  const handleInsightAction = (target?: string) => {
    switch (target) {
      case "PromotionBuilder":
        navigation.navigate("PromotionBuilder");
        break;
      case "Menu":
        navigation.navigate("Menu");
        break;
      case "BusinessProfileEditor":
        navigation.navigate("BusinessProfileEditor");
        break;
      case "Analytics":
        navigation.navigate("Analytics");
        break;
      default:
        navigation.navigate("Dashboard");
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
                borderRadius: componentRadii.card,
                padding: spacing[5] || 20,
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
              <View
                style={{
                  backgroundColor: palette.orange,
                  padding: 6,
                  borderRadius: componentRadii.iconButton,
                }}
              >
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
            <View
              style={[
                styles.emptyContainer,
                {
                  borderColor: palette.border,
                  borderRadius: componentRadii.card,
                  padding: spacing[8],
                },
              ]}
            >
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
                      borderRadius: componentRadii.card,
                      padding: spacing[4],
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
                          borderRadius: componentRadii.card,
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
                      accessibilityRole="button"
                      accessibilityLabel={insight.actionLabel}
                      onPress={() => handleInsightAction(insight.actionTarget)}
                      style={[
                        styles.actionButton,
                        {
                          borderColor: palette.border,
                          marginLeft: 48,
                          borderRadius: radii.pill,
                          paddingVertical: spacing[2],
                          paddingHorizontal: spacing[3],
                        },
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
            borderRadius: componentRadii.card,
          }}
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
    borderWidth: 1,
  },
  insightCard: {
    borderWidth: 1,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    alignSelf: "flex-start",
    gap: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
});
