import React, { useState, useEffect } from "react";
import { View, ScrollView, TextInput, StyleSheet, Alert, Switch, Pressable } from "react-native";
import { Calendar } from "lucide-react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { AppText, Button, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
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
  const [dateErrors, setDateErrors] = useState({ start: false, end: false });

  useEffect(() => {
    async function loadPromotion() {
      if (promotionId && activeOutlet) {
        try {
          const promos = await getHungryService().merchant.getPromotions(activeOutlet.id);
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
    void loadPromotion();
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
    if (!title || !description || !startDate || !endDate) {
      Alert.alert("Missing Fields", "Please fill out all required fields.");
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const isStartValid = dateRegex.test(startDate);
    const isEndValid = dateRegex.test(endDate);

    setDateErrors({ start: !isStartValid, end: !isEndValid });

    if (!isStartValid || !isEndValid) {
      Alert.alert("Invalid Date", "Please ensure dates are in YYYY-MM-DD format.");
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
        startDate: `${startDate}T00:00:00Z`,
        endDate: `${endDate}T23:59:59Z`,
        status: newStatus,
        targetAudience: Array.from(targetAudiences),
      };

      if (promotionId) {
        await getHungryService().merchant.updatePromotion(promotionId, promoData);
      } else {
        await getHungryService().merchant.createPromotion(activeOutlet.id, promoData as any);
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
      <Screen title="Loading...">
        <AppText>Fetching promotion details...</AppText>
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
            backgroundColor: isSelected ? palette.orangeLight : palette.surface,
            borderColor: isSelected ? palette.orange : palette.border,
            borderRadius: radii.md,
            padding: spacing[4],
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
    <Screen title={promotionId ? "Edit Promotion" : "New Promotion"}>
      <View style={{ gap: spacing[5], width: "100%" }}>
        {/* Preview Card */}
        <View>
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
                padding: spacing[4],
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
                borderRadius: radii.md,
                padding: spacing[3],
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
                borderRadius: radii.md,
                padding: spacing[3],
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
                  borderColor: dateErrors.start ? palette.error : palette.border,
                  borderRadius: radii.md,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                },
              ]}
            >
              <Calendar size={18} color={palette.textSecondary} />
              <TextInput
                style={{ flex: 1, color: palette.text, fontSize: 16 }}
                value={startDate}
                onChangeText={(text) => {
                  setStartDate(text);
                  setDateErrors((prev) => ({ ...prev, start: false }));
                }}
                placeholder="YYYY-MM-DD"
              />
            </View>
            {dateErrors.start && (
              <AppText variant="micro" style={{ color: palette.error, marginTop: spacing[1] }}>
                Format: YYYY-MM-DD
              </AppText>
            )}
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
                  borderColor: dateErrors.end ? palette.error : palette.border,
                  borderRadius: radii.md,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                },
              ]}
            >
              <Calendar size={18} color={palette.textSecondary} />
              <TextInput
                style={{ flex: 1, color: palette.text, fontSize: 16 }}
                value={endDate}
                onChangeText={(text) => {
                  setEndDate(text);
                  setDateErrors((prev) => ({ ...prev, end: false }));
                }}
                placeholder="YYYY-MM-DD"
              />
            </View>
            {dateErrors.end && (
              <AppText variant="micro" style={{ color: palette.error, marginTop: spacing[1] }}>
                Format: YYYY-MM-DD
              </AppText>
            )}
          </View>
        </View>

        <View>
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

        <View style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[4] }}>
          <Button
            label={isSaving ? "Saving..." : "Save as Draft"}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => void handleSave(false)}
            disabled={isSaving}
          />
          <Button
            label={isSaving ? "Publishing..." : "Publish Now"}
            variant="primary"
            style={{ flex: 1 }}
            onPress={() => void handleSave(true)}
            disabled={isSaving}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    fontSize: 16,
  },
  previewCard: {
    borderWidth: 1,
    borderStyle: "dashed",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    gap: 8,
  },
  audienceCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
  },
});
