import React, { useCallback, useState, useEffect, useMemo } from "react";
import { View, StyleSheet, Alert, Pressable } from "react-native";
import { X } from "lucide-react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { PromotionDateField } from "@/components/merchant/PromotionDateField";
import { CustomerPromotionCard } from "@/components/promotion/CustomerPromotionCard";

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
import { resolvePromotionRuntimeStatus } from "@/features/merchant/merchantReadiness";
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
import { useUnsavedChangesGuard } from "@/features/merchant/useUnsavedChangesGuard";
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

/** Discount implied by the two prices, so the merchant never has to make three fields agree. */
function computeDiscount(originalPrice: string, finalPrice: string): number | undefined {
  const original = Number(originalPrice);
  const final = Number(finalPrice);
  if (!originalPrice || !finalPrice || !Number.isFinite(original) || !Number.isFinite(final)) {
    return undefined;
  }
  if (original <= 0 || final < 0 || final > original) return undefined;
  return Math.round(((original - final) / original) * 100);
}

export function PromotionBuilderScreen() {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const navigation = useNavigation<BottomTabNavigationProp<MerchantTabParamList>>();
  const route = useRoute<RouteProps>();
  const promotionId = route.params?.promotionId;
  // "Duplicate" opens a new draft prefilled from another promotion.
  const duplicateFromId = promotionId ? undefined : route.params?.duplicateFromId;
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const updateOutletProfile = useMerchantStore((state) => state.updateOutletProfile);

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
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

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
      const sourceId = promotionId ?? duplicateFromId;
      if (!sourceId) return;
      const promo = promos.find((p) => p.id === sourceId);
      if (promo) {
        setTitle(promo.title);
        setDescription(promo.description);
        setTargetDishId(promo.targetDishId);
        // A duplicate keeps the content but starts as a fresh draft on the default dates.
        if (promotionId) {
          setStartDate(promotionBoundaryToDateOnly(promo.startDate, "start"));
          setEndDate(promotionBoundaryToDateOnly(promo.endDate, "end"));
          setStatus(promo.status);
        }
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
  }, [promotionId, duplicateFromId, activeOutlet]);

  useEffect(() => {
    void loadPromotion();
  }, [loadPromotion]);

  const computedDiscount = computeDiscount(originalPrice, promotionalPrice);
  const formSnapshot = useMemo(
    () =>
      JSON.stringify([
        title,
        description,
        targetDishId,
        promotionItemType,
        originalPrice,
        promotionalPrice,
        discountPercentage,
        isAvailable,
        startDate,
        endDate,
      ]),
    [
      title,
      description,
      targetDishId,
      promotionItemType,
      originalPrice,
      promotionalPrice,
      discountPercentage,
      isAvailable,
      startDate,
      endDate,
    ],
  );
  useEffect(() => {
    if (!isLoading && savedSnapshot === null) setSavedSnapshot(formSnapshot);
  }, [formSnapshot, isLoading, savedSnapshot]);
  const isDirty = savedSnapshot !== null && savedSnapshot !== formSnapshot && !isSaving;
  const leaveEditor = useCallback(() => navigation.goBack(), [navigation]);
  const confirmLeave = useUnsavedChangesGuard(isDirty, leaveEditor);
  const runtimeStatus = resolvePromotionRuntimeStatus({
    startDate: toSingaporePromotionBoundary(startDate, "start"),
    endDate: toSingaporePromotionBoundary(endDate, "end"),
    status,
  });

  const runPromotionAction = async (action: () => Promise<unknown>, failureTitle: string) => {
    setIsSaving(true);
    try {
      await action();
      setSavedSnapshot(formSnapshot);
      navigation.goBack();
    } catch (e) {
      Alert.alert(failureTitle, e instanceof Error ? e.message : "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndNow = () => {
    if (!promotionId) return;
    Alert.alert("End promotion now?", "Diners will stop seeing it straight away.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End now",
        style: "destructive",
        onPress: () =>
          void runPromotionAction(
            () => getHungryService().merchant.updatePromotion(promotionId, { status: "ended" }),
            "Could not end promotion",
          ),
      },
    ]);
  };

  const handleMoveToDrafts = () => {
    if (!promotionId) return;
    void runPromotionAction(
      () => getHungryService().merchant.updatePromotion(promotionId, { status: "draft" }),
      "Could not move promotion to drafts",
    );
  };

  const handleDelete = () => {
    if (!promotionId) return;
    Alert.alert("Delete promotion?", "This permanently removes it and its numbers.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void runPromotionAction(
            () => getHungryService().merchant.deletePromotion(promotionId),
            "Could not delete promotion",
          ),
      },
    ]);
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
      // With both prices set the discount is derived from them; otherwise it is typed.
      const parsedDiscount =
        computedDiscount ?? (discountPercentage ? Number(discountPercentage) : undefined);
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
        trackMerchantEvent("merchant_promotion_created", activeOutlet.id, {
          duplicated: Boolean(duplicateFromId),
        });
      }
      if (publish) {
        trackMerchantEvent("merchant_promotion_published", activeOutlet.id, {
          status: newStatus,
        });
      }
      setSavedSnapshot(formSnapshot);

      if (publish && !activeOutlet.isLive) {
        // Diners only see promotions of stalls shown on Hungry: offer the one-tap fix.
        const outletId = activeOutlet.id;
        Alert.alert(
          "Published, but not visible to diners",
          'Your stall is hidden, so diners will not see this promotion until you turn on "Show on Hungry".',
          [
            { text: "Not now", style: "cancel", onPress: () => navigation.goBack() },
            {
              text: "Show on Hungry",
              onPress: async () => {
                try {
                  const updated = await getHungryService().merchant.updateBusinessProfile(
                    outletId,
                    { isLive: true },
                  );
                  updateOutletProfile(outletId, updated);
                } catch (e) {
                  Alert.alert(
                    "Could not show your stall",
                    e instanceof Error ? e.message : "Please try again.",
                  );
                }
                navigation.goBack();
              },
            },
          ],
        );
        return;
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
      <Screen title={promotionId ? "Edit Promotion" : "New Promotion"}>
        <AppText tone="muted">Loading promotion details...</AppText>
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
    discountPercentage:
      computedDiscount ?? (discountPercentage ? Number(discountPercentage) : undefined),
    isAvailable,
  };

  return (
    <Screen title={promotionId ? "Edit Promotion" : "New Promotion"} onBackPress={confirmLeave}>
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
          {/* The same card diners see on the stall page. */}
          <CustomerPromotionCard
            promotion={{
              ...previewPromotion,
              title: title || "Your Promotion Title",
              description:
                description || "Add a description to tell customers why they should visit.",
            }}
          />
          <AppText
            variant="micro"
            style={{ color: palette.orangeText, marginTop: spacing[2], fontWeight: "bold" }}
          >
            Valid {startDate} to {endDate} (Singapore time)
          </AppText>
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
                  accessibilityRole="radio"
                  accessibilityState={{ checked: targetDishId === dish.id }}
                  accessibilityLabel={`${dish.name}, ${dish.priceRange}`}
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
              {computedDiscount !== undefined ? (
                <View style={{ gap: spacing[1] }}>
                  <AppText variant="bodySmallBold">Discount</AppText>
                  <AppText variant="bodyBold" accessibilityLiveRegion="polite">
                    {computedDiscount}% off
                  </AppText>
                  <AppText variant="micro" tone="muted">
                    Worked out from the two prices.
                  </AppText>
                </View>
              ) : (
                <Input
                  label="Discount %"
                  keyboardType="decimal-pad"
                  value={discountPercentage}
                  onChangeText={setDiscountPercentage}
                  placeholder="15"
                />
              )}
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
            <PromotionDateField
              label="Start Date"
              value={startDate}
              onChange={(text) => {
                setStartDate(text);
                setDateErrors((prev) => ({ ...prev, start: false }));
              }}
              error={dateErrors.start}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PromotionDateField
              label="End Date"
              value={endDate}
              minimumDate={startDate}
              onChange={(text) => {
                setEndDate(text);
                setDateErrors((prev) => ({ ...prev, end: false }));
              }}
              error={dateErrors.end}
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

        {promotionId ? (
          <View style={{ gap: spacing[2] }}>
            {runtimeStatus === "active" ? (
              <Button
                label="End now"
                variant="secondary"
                onPress={handleEndNow}
                disabled={isSaving}
              />
            ) : null}
            {runtimeStatus === "scheduled" ? (
              <Button
                label="Move to drafts"
                variant="secondary"
                onPress={handleMoveToDrafts}
                disabled={isSaving}
              />
            ) : null}
            <Button
              label="Duplicate"
              variant="secondary"
              onPress={() =>
                navigation.navigate("PromotionBuilder", { duplicateFromId: promotionId })
              }
              disabled={isSaving}
            />
            <Button
              label="Delete promotion"
              variant="destructive"
              onPress={handleDelete}
              disabled={isSaving}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  menuItemOption: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
