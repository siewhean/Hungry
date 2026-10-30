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
  Sparkles,
} from "lucide-react-native";

import { AppText, IconButton, Screen, EmptyState, Skeleton } from "@/components/ui";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { reportError } from "@/lib/monitoring/reportError";
import { safeAsyncStorage } from "@/store/persistStorage";
import type { AIBusinessInsight } from "@/types/domain";

const dismissedInsightsKey = (outletId: string) => `hungry.merchant.dismissedInsights.${outletId}`;

async function readDismissedInsightIds(outletId: string): Promise<string[]> {
  try {
    const raw = await safeAsyncStorage.getItem(dismissedInsightsKey(outletId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

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
      setError("No active outlet selected for insights.");
      setIsLoading(false);
      return;
    }
    try {
      const [data, dismissedIds] = await Promise.all([
        getHungryService().merchant.getAIInsights(activeOutlet.id),
        readDismissedInsightIds(activeOutlet.id),
      ]);
      const dismissed = new Set(dismissedIds);
      setInsights(
        data.filter((i) => i.type !== "weekly_summary" && !i.isDismissed && !dismissed.has(i.id)),
      );

      // The weekly summary is one of the insights: no second read of the same analytics.
      setWeeklySummary(data.find((insight) => insight.type === "weekly_summary") ?? null);
    } catch (e) {
      reportError(e, { screen: "AIAssistant", action: "load_insights" });
      setError(e instanceof Error ? e.message : "Failed to load insights.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  if (error) {
    return (
      <Screen title="Insights">
        <EmptyState
          title="Unable to load insights"
          body="We could not load your insights."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="Merchant insights"
          ctaLabel="Retry"
          onPress={loadInsights}
        />
      </Screen>
    );
  }

  // Dismissals are remembered on this device per outlet, so a dismissed tip stays gone.
  const handleDismiss = (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    if (!activeOutlet) return;
    const outletId = activeOutlet.id;
    void readDismissedInsightIds(outletId).then((ids) =>
      Promise.resolve(
        safeAsyncStorage.setItem(
          dismissedInsightsKey(outletId),
          JSON.stringify(Array.from(new Set([...ids, id])).slice(-100)),
        ),
      ).catch(() => undefined),
    );
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
      case "CustomerInbox":
        navigation.navigate("CustomerInbox", { filter: "all" });
        break;
      case "CustomerInboxUnreplied":
        navigation.navigate("CustomerInbox", { filter: "unreplied" });
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
        return <AlertCircle size={20} color={palette.error} />;
      case "review_attention":
        return <MessageSquare size={20} color={palette.orange} />;
      default:
        return <Sparkles size={20} color={palette.orange} />;
    }
  };

  return (
    <Screen title="Insights">
      <View style={{ gap: spacing[6], width: "100%" }}>
        <AppText variant="body" tone="muted" style={{ paddingHorizontal: spacing[1] }}>
          A simple summary of your stall&apos;s own activity.
        </AppText>

        {isLoading && !weeklySummary ? (
          <Skeleton height={120} borderRadius={componentRadii.card} />
        ) : null}

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
                <BarChart2 size={16} color={palette.textOnOrange} />
              </View>
              <AppText variant="bodySmallBold" style={{ color: palette.orangeText }}>
                Summary
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

        {/* Rule-based tips from the stall's own data; the card below says so when there are none. */}
        {insights.length > 0 ? (
          <View style={{ gap: spacing[4] }}>
            <AppText variant="h3" style={{ fontWeight: "bold", paddingHorizontal: spacing[1] }}>
              Suggestions
            </AppText>
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
          </View>
        ) : !isLoading ? (
          <View
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              padding: spacing[4],
            }}
          >
            <AppText variant="bodyBold">Nothing needs your attention</AppText>
            <AppText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Your reviews are answered, your dishes have photos and your hours are set. New tips
              appear here as your stall changes.
            </AppText>
          </View>
        ) : null}

        <View
          style={{
            padding: spacing[4],
            backgroundColor: palette.bgSoft,
            borderRadius: componentRadii.card,
          }}
        >
          <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>
            Summaries are counted from your stall&apos;s own data. Nothing is published
            automatically.
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
});
