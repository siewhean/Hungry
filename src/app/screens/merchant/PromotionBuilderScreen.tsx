import React, { useCallback, useState, useEffect } from "react";
import { View, StyleSheet, Alert, Pressable } from "react-native";
import { Calendar, X } from "lucide-react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import {
  AppText,
  Button,
  ChipGroup,
  EmptyState,
  FormSwitchRow,
  Input,
  Screen,
} from "@/components/ui";
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
import {
  promotionBoundaryToDateOnly,
  toSingaporeDateOnly,
  toSingaporePromotionBoundary,
  validateMerchantPromotionInput,
} from "@/features/merchant/promotionValidation";

type RouteProps = RouteProp<MerchantTabParamList, "PromotionBuilder">;
type PromotionItemType = NonNullable<MerchantPromotion["promotionItemType"]>;

const PROMOTION_ITEM_TYPE_OPTIONS: readonly { id: PromotionItemType; label: string }[] = [
  { id: "new_item", label: "New item" },
  { id: "existing_menu_item", label: "Existing menu item" },
];

export function PromotionBuilderScreen() {
  const { componentRadii, palette, spacing } = useHungryTheme();
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
  const [startDate, setStartDate] = useState(() => toSingaporeDateOnly());
  const [endDate, setEndDate] = useState(() =>
    toSingaporeDateOnly(new Date(Date.now() + 7 * 86400000)),
  );
  const [status, setStatus] = useState<PromotionStatus>("draft");
  const [error, setError] = useState<string | null>(null);
  // Audience targeting is not enforced anywhere yet, so the builder no longer offers it;
  // existing values are preserved on edit.
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
        setStartDate(promotionBoundaryToDateOnly(promo.startDate, "start"));
        setEndDate(promotionBoundaryToDateOnly(promo.endDate, "end"));
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
            startDate: toSingaporePromotionBoundary(startDate, "start"),
            endDate: toSingaporePromotionBoundary(endDate, "end"),
            status: "active",
          })
        : "draft";

      const promoData = validateMerchantPromotionInput({
        title,
        description,
        targetDishId,
        startDate: toSingaporePromotionBoundary(startDate, "start"),
        endDate: toSingaporePromotionBoundary(endDate, "end"),
        status: newStatus,
        targetAudience: Array.from(targetAudiences),
        promotionItemType,
        originalPrice: parsedOriginalPrice,
        promotionalPrice: parsedPromotionalPrice,
        finalPrice: parsedPromotionalPrice ?? parsedOriginalPrice,
        discountPercentage: parsedDiscount,
        isAvailable,
      });

      if (promotionId) {
        await getHungryService().merchant.updatePromotion(promotionId, promoData);
      } else {
        await getHungryService().merchant.createPromotion(activeOutlet.id, promoData);
      }

      Alert.alert("Success", `Promotion ${publish ? "published" : "saved as draft"}!`);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save promotion.");
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

  const selectedDish = menu.find((dish) => dish.id === targetDishId);
  const previewPromotion: MerchantPromotion = {
    id: promotionId ?? "preview",
    outletId: activeOutlet?.id ?? "",
    title,
    description,
    targetDishId,
    startDate: toSingaporePromotionBoundary(startDate, "start"),
    endDate: toSingaporePromotionBoundary(endDate, "end"),
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
          <Input
            label="Promotion Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 20% off all noodles"
          />
        </View>

        <View>
          <Input
            label="Description *"
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="e.g. Show this post to get 20% off your total bill when you order any noodle dish."
            style={{ minHeight: 80, textAlignVertical: "top" }}
          />
        </View>

        <View style={{ gap: spacing[3] }}>
          <AppText variant="bodyBold">Promotion Item</AppText>
          <ChipGroup
            options={PROMOTION_ITEM_TYPE_OPTIONS}
            selectedId={promotionItemType}
            onSelect={setPromotionItemType}
          />

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
              <Input
                label="Original Price"
                keyboardType="decimal-pad"
                value={originalPrice}
                onChangeText={setOriginalPrice}
                placeholder="6.50"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Final Price"
                keyboardType="decimal-pad"
                value={promotionalPrice}
                onChangeText={setPromotionalPrice}
                placeholder="5.50"
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Discount %"
                keyboardType="decimal-pad"
                value={discountPercentage}
                onChangeText={setDiscountPercentage}
                placeholder="15"
              />
            </View>
            <FormSwitchRow
              label="Available"
              value={isAvailable}
              onValueChange={setIsAvailable}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Start Date"
              value={startDate}
              onChangeText={(text) => {
                setStartDate(text);
                setDateErrors((prev) => ({ ...prev, start: false }));
              }}
              placeholder="YYYY-MM-DD"
              leftIcon={<Calendar size={18} color={palette.textSecondary} />}
              error={dateErrors.start}
              errorText="Format: YYYY-MM-DD"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="End Date"
              value={endDate}
              onChangeText={(text) => {
                setEndDate(text);
                setDateErrors((prev) => ({ ...prev, end: false }));
              }}
              placeholder="YYYY-MM-DD"
              leftIcon={<Calendar size={18} color={palette.textSecondary} />}
              error={dateErrors.end}
              errorText="Format: YYYY-MM-DD"
            />
          </View>
        </View>

        <AppText variant="bodySmall" tone="muted">
          Runs all day on Singapore time, from 00:00 on the start date to 23:59 on the end date.
          Live promotions are shown to everyone who views your stall or the promoted dish.
        </AppText>

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
  previewCard: {
    borderWidth: 1,
    borderStyle: "dashed",
  },
  menuItemOption: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
