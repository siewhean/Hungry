import React, { useState, useEffect } from "react";
import { View, ScrollView, TextInput, StyleSheet, Alert, Switch, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Calendar } from "lucide-react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";

import { AppText, Button, IconButton, Screen, Chip } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { hungryService } from "@/lib/services/mock/mockService";
import type { MerchantPromotion, PromotionTargetAudience, PromotionStatus } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type RouteProps = RouteProp<MerchantTabParamList, "PromotionBuilder">;

export function PromotionBuilderScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const promotionId = route.params?.promotionId;
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDishId, setTargetDishId] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  );
  const [status, setStatus] = useState<PromotionStatus>("draft");
  const [targetAudiences, setTargetAudiences] = useState<Set<PromotionTargetAudience>>(
    new Set(["nearby_users"]),
  );

  useEffect(() => {
    async function loadPromotion() {
      if (promotionId && activeOutlet) {
        try {
          // We fetch all and find, since there's no single getPromotion mock yet
          const promos = await hungryService.merchant.getPromotions(activeOutlet.id);
          const promo = promos.find((p) => p.id === promotionId);
          if (promo) {
            setTitle(promo.title);
            setDescription(promo.description);
            setTargetDishId(promo.targetDishId);
            setStartDate(promo.startDate.split("T")[0]);
            setEndDate(promo.endDate.split("T")[0]);
            setStatus(promo.status);
            setTargetAudiences(new Set(promo.targetAudience));
          }
        } catch (e) {
          Alert.alert("Error", "Failed to load promotion details.");
        }
      }
      setIsLoading(false);
    }
    loadPromotion();
  }, [promotionId, activeOutlet]);

  const toggleAudience = (audience: PromotionTargetAudience) => {
    setTargetAudiences((prev) => {
      const next = new Set(prev);
      if (next.has(audience)) {
        next.delete(audience);
      } else {
        next.add(audience);
      }
      return next;
    });
  };

  const handleSave = async (publish: boolean) => {
    if (!activeOutlet) return;
    if (!title.trim() || !description.trim()) {
      Alert.alert("Validation", "Title and description are required.");
      return;
    }
    if (targetAudiences.size === 0) {
      Alert.alert("Validation", "Select at least one target audience.");
      return;
    }

    setIsSaving(true);
    try {
      const newStatus = publish ? "active" : "draft";

      const promoData: Omit<MerchantPromotion, "id" | "createdAt" | "analytics"> = {
        outletId: activeOutlet.id,
        title,
        description,
        targetDishId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        status: newStatus,
        targetAudience: Array.from(targetAudiences),
      };

      if (promotionId) {
        await hungryService.merchant.updatePromotion(promotionId, promoData);
      } else {
        await hungryService.merchant.createPromotion(activeOutlet.id, promoData as any);
      }

      Alert.alert("Success", `Promotion ${publish ? "published" : "saved as draft"}!`);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", "Failed to save promotion.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Screen style={{ backgroundColor: palette.bg }}>
        <AppText>Loading...</AppText>
      </Screen>
    );
  }

  const renderAudienceToggle = (id: PromotionTargetAudience, label: string, desc: string) => {
    const isSelected = targetAudiences.has(id);
    return (
      <Pressable
        onPress={() => toggleAudience(id)}
        style={[
          styles.audienceCard,
          {
            backgroundColor: palette.surface,
            borderColor: isSelected ? palette.orange : palette.border,
            borderRadius: radii.md,
          },
        ]}
      >
        <View style={{ flex: 1, paddingRight: spacing[3] }}>
          <AppText variant="bodyBold" style={{ color: isSelected ? palette.orange : palette.text }}>
            {label}
          </AppText>
          <AppText variant="micro" tone="muted" style={{ marginTop: 2 }}>
            {desc}
          </AppText>
        </View>
        <Switch
          value={isSelected}
          onValueChange={() => toggleAudience(id)}
          trackColor={{ true: palette.orange, false: palette.border }}
        />
      </Pressable>
    );
  };

  return (
    <Screen style={{ backgroundColor: palette.bg }}>
      <View style={[styles.header, { paddingTop: spacing[3], paddingHorizontal: spacing[4] }]}>
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={24} color={palette.text} />}
          onPress={() => navigation.goBack()}
        />
        <AppText variant="h2" style={{ fontWeight: "800" }}>
          {promotionId ? "Edit Promo" : "New Promo"}
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[4], paddingBottom: 100 }}
      >
        {/* Preview Card */}
        <View style={{ marginBottom: spacing[2] }}>
          <AppText
            variant="bodySmallBold"
            tone="muted"
            style={{ marginBottom: spacing[2], textTransform: "uppercase" }}
          >
            Preview
          </AppText>
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: palette.surface,
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
                marginBottom: spacing[2],
              }}
            >
              <View
                style={{
                  backgroundColor: palette.orange,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: radii.sm,
                }}
              >
                <AppText variant="bodySmallBold" style={{ color: palette.white }}>
                  PROMO
                </AppText>
              </View>
              <AppText variant="bodySmall" tone="muted">
                {activeOutlet?.name}
              </AppText>
            </View>
            <AppText variant="bodyBold">{title || "Your Promotion Title"}</AppText>
            <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
              {description || "Add a description to tell customers why they should visit."}
            </AppText>
            <AppText
              variant="micro"
              style={{ color: palette.orange, marginTop: spacing[2], fontWeight: "bold" }}
            >
              Valid {startDate} to {endDate}
            </AppText>
          </View>
        </View>

        <View>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
            Promotion Title *
          </AppText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 20% off all noodles"
            placeholderTextColor={palette.textMuted}
          />
        </View>

        <View>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
            Description *
          </AppText>
          <TextInput
            style={[
              styles.input,
              {
                height: 80,
                textAlignVertical: "top",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="e.g. Show this post to get 20% off your total bill when you order any noodle dish between 2pm-5pm."
            placeholderTextColor={palette.textMuted}
          />
        </View>

        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Start Date
            </AppText>
            <View
              style={[
                styles.dateInput,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: radii.md,
                },
              ]}
            >
              <Calendar size={18} color={palette.textSecondary} />
              <TextInput
                style={{ flex: 1, color: palette.text, fontSize: 16 }}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              End Date
            </AppText>
            <View
              style={[
                styles.dateInput,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: radii.md,
                },
              ]}
            >
              <Calendar size={18} color={palette.textSecondary} />
              <TextInput
                style={{ flex: 1, color: palette.text, fontSize: 16 }}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
        </View>

        <View style={{ marginTop: spacing[2] }}>
          <AppText variant="bodyBold" style={{ marginBottom: spacing[1] }}>
            Target Audience
          </AppText>
          <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[3] }}>
            Who should see this promotion in their feed?
          </AppText>

          <View style={{ gap: spacing[2] }}>
            {renderAudienceToggle(
              "nearby_users",
              "Nearby Users",
              "People currently within 2km of your stall",
            )}
            {renderAudienceToggle("followers", "Followers", "Users who have followed your profile")}
            {renderAudienceToggle(
              "saved_stall_users",
              "Saved Stall Users",
              "People who have bookmarked your stall or dishes",
            )}
            {renderAudienceToggle(
              "taste_match_users",
              "Taste Match",
              "AI-targeted users whose taste profile matches your menu",
            )}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: palette.surface, borderTopColor: palette.border },
        ]}
      >
        <Button
          label={isSaving ? "Saving..." : "Save as Draft"}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => handleSave(false)}
          disabled={isSaving}
        />
        <Button
          label={isSaving ? "Publishing..." : "Publish Now"}
          variant="primary"
          style={{ flex: 1 }}
          onPress={() => handleSave(true)}
          disabled={isSaving}
        />
      </View>
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  previewCard: {
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  audienceCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 32,
  },
});
