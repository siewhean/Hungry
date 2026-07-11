import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Plus, Calendar, Users, Target, BarChart2, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  AppText,
  Button,
  IconButton,
  FilterChipRail,
  Screen,
  EmptyState,
  StatusChip,
  type StatusChipTone,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { MerchantPromotion, PromotionStatus } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import {
  getPromotionPricing,
  resolvePromotionRuntimeStatus,
} from "@/features/merchant/merchantReadiness";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "PromotionList">;

const PROMOTION_FILTER_OPTIONS: { id: PromotionStatus; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "scheduled", label: "Scheduled" },
  { id: "draft", label: "Drafts" },
  { id: "ended", label: "Ended" },
];

function getPromotionStatusTone(status: PromotionStatus): StatusChipTone {
  switch (status) {
    case "active":
      return "success";
    case "scheduled":
      return "info";
    case "draft":
      return "neutral";
    case "ended":
      return "neutral";
    default:
      return "neutral";
  }
}

export function PromotionListScreen() {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [promotions, setPromotions] = useState<MerchantPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PromotionStatus>("active");

  const loadPromotions = useCallback(async () => {
    if (!activeOutlet) {
      setPromotions([]);
      setIsLoading(false);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const data = await getHungryService().merchant.getPromotions(activeOutlet.id);
      setPromotions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load promotions.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    void loadPromotions();
  }, [loadPromotions]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      void loadPromotions();
    });
    return unsubscribe;
  }, [navigation, loadPromotions]);

  if (error) {
    return (
      <Screen title="Promotions">
        <EmptyState
          title="Failed to load promotions"
          body="Your promotions list is unavailable right now."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="Promotion list"
          ctaLabel="Retry"
          onPress={loadPromotions}
        />
      </Screen>
    );
  }

  const promotionsWithRuntimeStatus = promotions.map((promotion) => ({
    ...promotion,
    status: resolvePromotionRuntimeStatus(promotion),
  }));
  const filteredPromotions = promotionsWithRuntimeStatus.filter((p) => p.status === filter);

  return (
    <Screen
      title="Promotions"
      headerRight={
        <IconButton
          accessibilityLabel="Create promotion"
          icon={<Plus size={24} color={palette.orange} />}
          onPress={() => navigation.navigate("PromotionBuilder")}
        />
      }
    >
      <View style={{ gap: spacing[4], width: "100%" }}>
        {/* Filters */}
        <FilterChipRail
          options={PROMOTION_FILTER_OPTIONS}
          selectedId={filter}
          onSelect={setFilter}
          gap={spacing[2]}
        />

        <View style={{ gap: spacing[4], paddingBottom: 100 }}>
          {filteredPromotions.length === 0 && !isLoading ? (
            <View
              style={[
                styles.emptyContainer,
                { paddingTop: spacing[8], paddingHorizontal: spacing[8] },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: palette.bgSoft, borderRadius: componentRadii.iconButton },
                ]}
              >
                <Target size={40} color={palette.textMuted} />
              </View>
              <AppText variant="bodyBold" style={{ marginTop: spacing[4] }}>
                No {filter} promotions
              </AppText>
              <AppText
                variant="bodySmall"
                tone="muted"
                style={{ textAlign: "center", marginTop: spacing[1] }}
              >
                Create a promotion to attract more customers and boost your sales.
              </AppText>
              <Button
                label="Create Promotion"
                variant="primary"
                style={{ marginTop: spacing[4] }}
                onPress={() => navigation.navigate("PromotionBuilder")}
              />
            </View>
          ) : (
            filteredPromotions.map((promo) => {
              const pricing = getPromotionPricing(promo);
              return (
                <Pressable
                  key={promo.id}
                  onPress={() => navigation.navigate("PromotionBuilder", { promotionId: promo.id })}
                  style={[
                    styles.promoCard,
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
                      marginBottom: spacing[3],
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: spacing[3] }}>
                      <AppText variant="bodyBold">{promo.title}</AppText>
                      <AppText
                        variant="bodySmall"
                        tone="muted"
                        numberOfLines={2}
                        style={{ marginTop: 2 }}
                      >
                        {promo.description}
                      </AppText>
                    </View>
                    <StatusChip
                      label={promo.status.charAt(0).toUpperCase() + promo.status.slice(1)}
                      tone={getPromotionStatusTone(promo.status)}
                    />
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing[3],
                      marginBottom: promo.analytics ? spacing[4] : 0,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Calendar size={14} color={palette.textSecondary} />
                      <AppText variant="micro" tone="muted">
                        {new Date(promo.startDate).toLocaleDateString()} -{" "}
                        {new Date(promo.endDate).toLocaleDateString()}
                      </AppText>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Users size={14} color={palette.textSecondary} />
                      <AppText variant="micro" tone="muted">
                        {promo.targetAudience.length} segments
                      </AppText>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Target size={14} color={palette.textSecondary} />
                      <AppText variant="micro" tone="muted">
                        {promo.promotionItemType === "existing_menu_item"
                          ? "Menu item promotion"
                          : "New promotional item"}
                      </AppText>
                    </View>
                  </View>

                  <AppText variant="bodySmallBold" style={{ marginBottom: spacing[3] }}>
                    {pricing.label}
                  </AppText>

                  {promo.analytics && (
                    <View
                      style={[
                        styles.analyticsBox,
                        {
                          backgroundColor: palette.bgSoft,
                          borderRadius: componentRadii.card,
                          padding: spacing[3],
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: spacing[2],
                        }}
                      >
                        <BarChart2 size={14} color={palette.textSecondary} />
                        <AppText variant="bodySmallBold" tone="muted">
                          Performance
                        </AppText>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <View style={styles.statItem}>
                          <AppText variant="bodyBold">{promo.analytics.impressions}</AppText>
                          <AppText variant="micro" tone="muted">
                            Views
                          </AppText>
                        </View>
                        <View style={styles.statItem}>
                          <AppText variant="bodyBold">{promo.analytics.clicks}</AppText>
                          <AppText variant="micro" tone="muted">
                            Clicks
                          </AppText>
                        </View>
                        <View style={styles.statItem}>
                          <AppText variant="bodyBold">{promo.analytics.saves}</AppText>
                          <AppText variant="micro" tone="muted">
                            Saves
                          </AppText>
                        </View>
                        <View style={styles.statItem}>
                          <AppText variant="bodyBold">{promo.analytics.profileVisits}</AppText>
                          <AppText variant="micro" tone="muted">
                            Visits
                          </AppText>
                        </View>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  promoCard: {
    borderWidth: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsBox: {},
  statItem: {
    alignItems: "center",
    flex: 1,
  },
});
