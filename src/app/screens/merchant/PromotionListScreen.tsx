import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, ChevronLeft, Calendar, Users, Target, BarChart2 } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppText, Button, IconButton, Chip, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { hungryService } from "@/lib/services/mock/mockService";
import type { MerchantPromotion, PromotionStatus } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "PromotionList">;

export function PromotionListScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const insets = useSafeAreaInsets();

  const [promotions, setPromotions] = useState<MerchantPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<PromotionStatus>("active");

  const loadPromotions = useCallback(async () => {
    if (!activeOutlet) return;
    setIsLoading(true);
    try {
      const data = await hungryService.merchant.getPromotions(activeOutlet.id);
      setPromotions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadPromotions();
    });
    return unsubscribe;
  }, [navigation, loadPromotions]);

  const filteredPromotions = promotions.filter((p) => p.status === filter);

  const getStatusColor = (status: PromotionStatus) => {
    switch (status) {
      case "active":
        return palette.success;
      case "scheduled":
        return palette.info;
      case "draft":
        return palette.textSecondary;
      case "ended":
        return palette.textMuted;
      default:
        return palette.text;
    }
  };

  const getStatusBgColor = (status: PromotionStatus) => {
    switch (status) {
      case "active":
        return palette.successSoft;
      case "scheduled":
        return palette.infoSoft;
      case "draft":
        return palette.bgSoft;
      case "ended":
        return palette.bgSoft;
      default:
        return palette.bgSoft;
    }
  };

  const renderFilter = (status: PromotionStatus, label: string) => (
    <View style={{ marginRight: spacing[2] }}>
      <Chip label={label} selected={filter === status} onPress={() => setFilter(status)} />
    </View>
  );

  return (
    <Screen style={{ backgroundColor: palette.bg }}>
      <View style={[styles.header, { paddingTop: spacing[3], paddingHorizontal: spacing[4] }]}>
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={24} color={palette.text} />}
          onPress={() => navigation.goBack()}
        />
        <AppText variant="h1" style={{ fontWeight: "800" }}>
          Promotions
        </AppText>
        <IconButton
          accessibilityLabel="Create promotion"
          icon={<Plus size={24} color={palette.orange} />}
          onPress={() => navigation.navigate("PromotionBuilder")}
        />
      </View>

      <View
        style={{
          backgroundColor: palette.bg,
          paddingHorizontal: spacing[4],
          paddingBottom: spacing[3],
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderFilter("active", "Active")}
          {renderFilter("scheduled", "Scheduled")}
          {renderFilter("draft", "Drafts")}
          {renderFilter("ended", "Ended")}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[4], paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadPromotions} />}
      >
        {filteredPromotions.length === 0 && !isLoading ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: palette.bgSoft }]}>
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
          filteredPromotions.map((promo) => (
            <Pressable
              key={promo.id}
              onPress={() => navigation.navigate("PromotionBuilder", { promotionId: promo.id })}
              style={[
                styles.promoCard,
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
                <View style={{ backgroundColor: getStatusBgColor(promo.status), borderRadius: 16 }}>
                  <Chip
                    label={promo.status.charAt(0).toUpperCase() + promo.status.slice(1)}
                    selected={false}
                  />
                </View>
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
              </View>

              {promo.analytics && (
                <View
                  style={[
                    styles.analyticsBox,
                    { backgroundColor: palette.bgSoft, borderRadius: radii.md },
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
          ))
        )}
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
  promoCard: {
    padding: 16,
    borderWidth: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsBox: {
    padding: 12,
  },
  statItem: {
    alignItems: "center",
  },
});
