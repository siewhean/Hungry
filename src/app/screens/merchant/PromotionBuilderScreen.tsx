import React, { useCallback, useState, useEffect } from "react";
import { View, TextInput, StyleSheet, Alert, Switch, Pressable } from "react-native";
import { Calendar, X } from "lucide-react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { AppText, Button, Screen, EmptyState } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type {
  DishDetail,
  MerchantPromotion,
  PromotionTargetAudience,
  PromotionStatus,
} from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import {
  getPromotionPricing,
  resolvePromotionRuntimeStatus,
} from "@/features/merchant/merchantReadiness";

type RouteProps = RouteProp<MerchantTabParamList, "PromotionBuilder">;

export function PromotionBuilderScreen() {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const promotionId = route.params?.promotionId;
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDishId, setTargetDishId] = useState<string | undefined>(undefined);
  const [menu, setMenu] = useState<DishDetail[]>([]);
  const [promotionItemType, setPromotionItemType] =
    useState<MerchantPromotion["promotionItemType"]>("new_item");
  const [originalPrice, setOriginalPrice] = useState("");
  const [promotionalPrice, setPromotionalPrice] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  );
  const [status, setStatus] = useState<PromotionStatus>("draft");
  const [error, setError] = useState<string | null>(null);
  const [targetAudiences, setTargetAudiences] = useState<Set<PromotionTargetAudience>>(
    new Set(["nearby_users"]),
  );
  const [dateErrors, setDateErrors] = useState({ start: false, end: false });

  const loadPromotion = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    if (!activeOutlet) {
      setError("No active outlet selected for this promotion.");
      setIsLoading(false);
      return;
    }

    try {
      const [promos, menuItems] = await Promise.all([
        getHungryService().merchant.getPromotions(activeOutlet.id),
        getHungryService().merchant.getMenu(activeOutlet.id),
      ]);
      setMenu(menuItems);
      if (!promotionId) return;
      const promo = promos.find((p) => p.id === promotionId);
      if (promo) {
        setTitle(promo.title);
        setDescription(promo.description);
        setTargetDishId(promo.targetDishId);
        setStartDate(promo.startDate.split("T")[0]);
        setEndDate(promo.endDate.split("T")[0]);
        setStatus(promo.status);
        setTargetAudiences(new Set(promo.targetAudience));
        setPromotionItemType(promo.promotionItemType ?? "new_item");
        setOriginalPrice(promo.originalPrice?.toString() ?? "");
        setPromotionalPrice(
          promo.promotionalPrice?.toString() ?? promo.finalPrice?.toString() ?? "",
        );
        setDiscountPercentage(promo.discountPercentage?.toString() ?? "");
        setIsAvailable(promo.isAvailable ?? true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load promotion details.");
    } finally {
      setIsLoading(false);
    }
  }, [promotionId, activeOutlet]);

  useEffect(() => {
    void loadPromotion();
  }, [loadPromotion]);

  const setAudienceSelected = (audience: PromotionTargetAudience, selected: boolean) => {
    setTargetAudiences((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(audience);
      } else {
        next.delete(audience);
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
      const parsedOriginalPrice = originalPrice ? Number(originalPrice) : undefined;
      const parsedPromotionalPrice = promotionalPrice ? Number(promotionalPrice) : undefined;
      const parsedDiscount = discountPercentage ? Number(discountPercentage) : undefined;
      if (
        [parsedOriginalPrice, parsedPromotionalPrice, parsedDiscount].some(
          (value) => value !== undefined && !Number.isFinite(value),
        )
      ) {
        Alert.alert("Invalid price", "Enter valid numbers for price and discount fields.");
        return;
      }
      const newStatus = publish
        ? resolvePromotionRuntimeStatus({
            startDate: `${startDate}T00:00:00Z`,
            endDate: `${endDate}T23:59:59Z`,
            status: "active",
          })
        : "draft";

      const promoData: Omit<MerchantPromotion, "id" | "outletId" | "createdAt" | "analytics"> = {
        title,
        description,
        targetDishId,
        startDate: `${startDate}T00:00:00Z`,
        endDate: `${endDate}T23:59:59Z`,
        status: newStatus,
        targetAudience: Array.from(targetAudiences),
        promotionItemType,
        originalPrice: parsedOriginalPrice,
        promotionalPrice: parsedPromotionalPrice,
        finalPrice: parsedPromotionalPrice ?? parsedOriginalPrice,
        discountPercentage: parsedDiscount,
        isAvailable,
      };

      if (promotionId) {
        await getHungryService().merchant.updatePromotion(promotionId, promoData);
      } else {
        await getHungryService().merchant.createPromotion(activeOutlet.id, promoData);
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

  if (error) {
    return (
      <Screen title="Error">
        <EmptyState
          title="Failed to load promotion"
          body="The promotion could not be loaded right now."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="Promotion builder"
          ctaLabel="Retry"
          onPress={loadPromotion}
        />
      </Screen>
    );
  }

  const renderAudienceToggle = (id: PromotionTargetAudience, label: string, desc: string) => {
    const isSelected = targetAudiences.has(id);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${isSelected ? "Remove" : "Add"} audience ${label}`}
        accessibilityState={{ selected: isSelected }}
        onPress={() => setAudienceSelected(id, !isSelected)}
        style={[
          styles.audienceCard,
          {
            backgroundColor: palette.surface,
            borderColor: isSelected ? palette.success : palette.border,
            borderRadius: componentRadii.card,
            padding: spacing[4],
          },
        ]}
      >
        <View style={{ flex: 1, paddingRight: spacing[3] }}>
          <AppText variant="bodyBold" style={{ color: palette.text }}>
            {label}
          </AppText>
          <AppText variant="micro" tone="muted" style={{ marginTop: 2 }}>
            {desc}
          </AppText>
        </View>
        <Switch
          value={isSelected}
          onValueChange={(value) => setAudienceSelected(id, value)}
          trackColor={{ true: palette.success, false: palette.border }}
        />
      </Pressable>
    );
  };

  const selectedDish = menu.find((dish) => dish.id === targetDishId);
  const previewPromotion: MerchantPromotion = {
    id: promotionId ?? "preview",
    outletId: activeOutlet?.id ?? "",
    title,
    description,
    targetDishId,
    startDate: `${startDate}T00:00:00Z`,
    endDate: `${endDate}T23:59:59Z`,
    targetAudience: Array.from(targetAudiences),
    status,
    createdAt: new Date().toISOString(),
    promotionItemType,
    originalPrice: originalPrice ? Number(originalPrice) : selectedDish?.price,
    promotionalPrice: promotionalPrice ? Number(promotionalPrice) : undefined,
    finalPrice: promotionalPrice ? Number(promotionalPrice) : selectedDish?.price,
    discountPercentage: discountPercentage ? Number(discountPercentage) : undefined,
    isAvailable,
  };
  const pricePreview = getPromotionPricing(previewPromotion);

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
                borderRadius: componentRadii.card,
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
                  borderRadius: componentRadii.button,
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
            <AppText variant="bodySmallBold" style={{ marginTop: spacing[2], color: palette.text }}>
              {pricePreview.label}
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
                borderRadius: componentRadii.card,
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
                borderRadius: componentRadii.card,
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

        <View style={{ gap: spacing[3] }}>
          <AppText variant="bodyBold">Promotion Item</AppText>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            {(["new_item", "existing_menu_item"] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setPromotionItemType(type)}
                style={[
                  styles.typeOption,
                  {
                    backgroundColor: promotionItemType === type ? palette.bgSoft : palette.surface,
                    borderColor: promotionItemType === type ? palette.success : palette.border,
                    borderRadius: componentRadii.card,
                    padding: spacing[3],
                  },
                ]}
              >
                <AppText variant="bodySmallBold">
                  {type === "new_item" ? "New item" : "Existing menu item"}
                </AppText>
              </Pressable>
            ))}
          </View>

          {promotionItemType === "existing_menu_item" ? (
            <View style={{ gap: spacing[2] }}>
              <AppText variant="bodySmall" tone="muted">
                Select the dish this promotion applies to.
              </AppText>
              {menu.map((dish) => (
                <Pressable
                  key={dish.id}
                  onPress={() => {
                    setTargetDishId(dish.id);
                    setOriginalPrice(dish.price.toString());
                  }}
                  style={[
                    styles.menuItemOption,
                    {
                      backgroundColor: targetDishId === dish.id ? palette.bgSoft : palette.surface,
                      borderColor: targetDishId === dish.id ? palette.success : palette.border,
                      borderRadius: componentRadii.card,
                      padding: spacing[3],
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodySmallBold">{dish.name}</AppText>
                    <AppText variant="micro" tone="muted">
                      {dish.description || dish.tasteTags.slice(0, 3).join(", ")}
                    </AppText>
                  </View>
                  <AppText variant="bodySmallBold">{dish.priceRange}</AppText>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodySmallBold" style={{ marginBottom: spacing[1] }}>
                Original Price
              </AppText>
              <TextInput
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: componentRadii.card,
                    color: palette.text,
                    padding: spacing[3],
                  },
                ]}
                value={originalPrice}
                onChangeText={setOriginalPrice}
                placeholder="6.50"
                placeholderTextColor={palette.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodySmallBold" style={{ marginBottom: spacing[1] }}>
                Final Price
              </AppText>
              <TextInput
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: componentRadii.card,
                    color: palette.text,
                    padding: spacing[3],
                  },
                ]}
                value={promotionalPrice}
                onChangeText={setPromotionalPrice}
                placeholder="5.50"
                placeholderTextColor={palette.textMuted}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodySmallBold" style={{ marginBottom: spacing[1] }}>
                Discount %
              </AppText>
              <TextInput
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: componentRadii.card,
                    color: palette.text,
                    padding: spacing[3],
                  },
                ]}
                value={discountPercentage}
                onChangeText={setDiscountPercentage}
                placeholder="15"
                placeholderTextColor={palette.textMuted}
              />
            </View>
            <View style={[styles.availabilityRow, { paddingTop: spacing[4] }]}>
              <AppText variant="bodySmallBold">Available</AppText>
              <Switch
                value={isAvailable}
                onValueChange={setIsAvailable}
                trackColor={{ true: palette.success, false: palette.border }}
              />
            </View>
          </View>
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
                  borderRadius: componentRadii.card,
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
                  borderRadius: componentRadii.card,
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
              "Users whose taste profile matches your menu",
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
  typeOption: {
    borderWidth: 1,
    flex: 1,
  },
  menuItemOption: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  availabilityRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
