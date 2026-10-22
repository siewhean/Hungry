import React, { useCallback, useState, useEffect, useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
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
  Skeleton,
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
import { useMerchantDialog } from "@/features/merchant/useMerchantDialog";
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

/** Dishes shown in the picker before "Show more": a long menu is not rendered in one go. */
const DISH_PICKER_PAGE_SIZE = 20;

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
  const { showAlert, dialog } = useMerchantDialog();

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
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    dates?: string;
    price?: string;
  }>({});
  const [visibleDishCount, setVisibleDishCount] = useState(DISH_PICKER_PAGE_SIZE);
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
  const confirmLeave = useUnsavedChangesGuard(isDirty, leaveEditor, showAlert);
  const runtimeStatus = resolvePromotionRuntimeStatus({
    startDate: toSingaporePromotionBoundary(startDate, "start"),
    endDate: toSingaporePromotionBoundary(endDate, "end"),
    status,
  });
  // Saving a live or scheduled promotion as a draft takes it down, so it is offered as Unpublish.
  const isLivePromotion =
    Boolean(promotionId) && (runtimeStatus === "active" || runtimeStatus === "scheduled");

  const runPromotionAction = async (action: () => Promise<unknown>, failureTitle: string) => {
    setIsSaving(true);
    try {
      await action();
      setSavedSnapshot(formSnapshot);
      navigation.goBack();
    } catch (e) {
      showAlert(failureTitle, e instanceof Error ? e.message : "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndNow = () => {
    if (!promotionId) return;
    showAlert("End promotion now?", "Diners will stop seeing it straight away.", [
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

  const handleUnpublish = () => {
    showAlert(
      "Unpublish this promotion?",
      "Diners will stop seeing it straight away. It is saved as a draft, and you can publish it again later.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unpublish", style: "destructive", onPress: () => void handleSave(false) },
      ],
    );
  };

  const handleDelete = () => {
    if (!promotionId) return;
    showAlert("Delete promotion?", "This permanently removes it and its numbers.", [
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
    // Problems are shown next to the fields, not in an alert.
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const isStartValid = dateRegex.test(startDate);
    const isEndValid = dateRegex.test(endDate);
    const nextErrors = {
      title: title.trim() ? undefined : "Add a title.",
      description: description.trim() ? undefined : "Add a description.",
      dates: isStartValid && isEndValid ? undefined : "Enter both dates as YYYY-MM-DD.",
    };
    setDateErrors({ start: !isStartValid, end: !isEndValid });
    setFieldErrors(nextErrors);
    if (nextErrors.title || nextErrors.description || nextErrors.dates) return;

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
        setFieldErrors({ price: "Enter valid numbers for price and discount fields." });
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
        showAlert(
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
                  showAlert(
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
      showAlert("Success", `Promotion ${publish ? "published" : "saved as draft"}!`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      showAlert("Error", e instanceof Error ? e.message : "Failed to save promotion.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Screen title={promotionId ? "Edit Promotion" : "New Promotion"}>
        <View accessibilityLabel="Loading promotion details" style={{ gap: spacing[4] }}>
          <Skeleton height={140} borderRadius={componentRadii.card} />
          <Skeleton height={56} borderRadius={componentRadii.input} />
          <Skeleton height={96} borderRadius={componentRadii.input} />
          <Skeleton height={56} borderRadius={componentRadii.input} />
        </View>
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
            error={Boolean(fieldErrors.title)}
            errorText={fieldErrors.title}
            placeholder="e.g. 20% off all noodles"
          />
        </View>

        <View>
          <Input
            label="Description *"
            value={description}
            onChangeText={setDescription}
            error={Boolean(fieldErrors.description)}
            errorText={fieldErrors.description}
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
              {menu.slice(0, visibleDishCount).map((dish) => (
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
              {menu.length > visibleDishCount ? (
                <Button
                  label={`Show more dishes (${menu.length - visibleDishCount})`}
                  variant="ghost"
                  onPress={() => setVisibleDishCount((count) => count + DISH_PICKER_PAGE_SIZE)}
                />
              ) : null}
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

          {fieldErrors.price ? (
            <AppText
              variant="bodySmall"
              style={{ color: palette.errorText }}
              accessibilityLiveRegion="polite"
            >
              {fieldErrors.price}
            </AppText>
          ) : null}

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

        {fieldErrors.dates ? (
          <AppText
            variant="bodySmall"
            style={{ color: palette.errorText }}
            accessibilityLiveRegion="polite"
          >
            {fieldErrors.dates}
          </AppText>
        ) : null}

        <AppText variant="bodySmall" tone="muted">
          Runs all day on Singapore time, from 00:00 on the start date to 23:59 on the end date.
          Live promotions are shown to everyone who views your stall or the promoted dish.
        </AppText>

        <View style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[4] }}>
          <Button
            label={isSaving ? "Saving..." : isLivePromotion ? "Unpublish" : "Save as Draft"}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={isLivePromotion ? handleUnpublish : () => void handleSave(false)}
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
      {dialog}
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
