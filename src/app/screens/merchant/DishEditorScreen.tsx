import React, { useCallback, useState, useEffect, useMemo } from "react";
import { View } from "react-native";
import { Camera, X } from "lucide-react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { MerchantImageField } from "@/components/merchant/MerchantImageField";
import {
  AppText,
  Button,
  ChipGroup,
  EmptyState,
  FormSwitchRow,
  InlineBanner,
  Input,
  Screen,
  Skeleton,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { useUIStore } from "@/store/useUIStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import {
  getDishSection,
  hasAvailabilityFlag,
  listMenuSections,
  withDishSection,
} from "@/features/merchant/menuSections";
import { formatDishPrice, parseDishPrice } from "@/features/merchant/dishPrice";
import { ALLERGEN_CHECK_DISCLAIMER } from "@/features/merchant/allergenKeywords";
import { createMerchantDishId, trackMerchantEvent } from "@/features/merchant/merchantTracking";
import { isLockedLiveDish, isVerificationCurrent } from "@/features/merchant/merchantGuards";
import { useMerchantDialog } from "@/features/merchant/useMerchantDialog";
import { isBlockedTextError } from "@/features/merchant/featuredDishes";
import { reportError } from "@/lib/monitoring/reportError";
import { useUnsavedChangesGuard } from "@/features/merchant/useUnsavedChangesGuard";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import type { DietaryFlag, DishDetail } from "@/types/domain";

type RouteProps = RouteProp<MerchantTabParamList, "DishEditor">;

const DIETARY_OPTIONS: { label: string; value: DietaryFlag }[] = [
  // Self-declared: there is no certificate check, so it must not read as MUIS halal certification.
  { label: "Muslim-friendly (self-declared)", value: "halal" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
  { label: "Pork-free", value: "pork_free" },
  { label: "Nut-free", value: "nut_free" },
  { label: "Gluten-free", value: "gluten_free" },
  { label: "Dairy-free", value: "dairy_free" },
  { label: "Shellfish-free", value: "shellfish_free" },
];

function parseCommaSeparated(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

const SUGGESTED_SECTIONS = ["Mains", "Sides", "Drinks", "Desserts", "Sets"];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function DishEditorScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const dishId = route.params?.dishId;
  // A menu-scan draft is only published when the merchant saves the editor.
  const ocrDraftId = dishId ? undefined : route.params?.ocrDraftId;
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const { showAlert, dialog } = useMerchantDialog();
  const showToast = useUIStore((state) => state.showToast);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The dish id is not on this outlet's menu (removed, or another stall's dish).
  const [isMissing, setIsMissing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; price?: string }>({});
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  // Ingredients only feed the allergen check; they are never saved.
  const [ingredients, setIngredients] = useState("");
  // Diner-facing tags, saved as the dish's taste tags.
  const [tags, setTags] = useState("");
  // Made once per editor: a retried "Add" saves the dish the first attempt created.
  const [newDishId] = useState(createMerchantDishId);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [section, setSection] = useState("");
  const [existingSections, setExistingSections] = useState<string[]>([]);
  const [otherFlags, setOtherFlags] = useState<string[]>([]);
  const [dietaryFlags, setDietaryFlags] = useState<DietaryFlag[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  // A live dish before verification: the database refuses the edit, so the form is read-only.
  const [isLockedLive, setIsLockedLive] = useState(false);
  const [showAllergenCheck, setShowAllergenCheck] = useState(false);

  const loadDish = useCallback(async () => {
    setError(null);
    setIsMissing(false);
    setIsLockedLive(false);
    if (!activeOutlet) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Read through the merchant menu: dishes that are not yet visible to diners
      // (pending verification) are still editable by their owner.
      const menu = await getHungryService().merchant.getMenu(activeOutlet.id);
      setExistingSections(listMenuSections(menu.map((item) => item.availabilityFlags)));
      if (ocrDraftId) {
        const drafts = await getHungryService().merchant.getOCRDrafts(activeOutlet.id);
        const draft = drafts.find((item) => item.id === ocrDraftId);
        if (draft) {
          setName(draft.name);
          setPrice(draft.price ? draft.price.toFixed(2) : "");
          setDescription(draft.suggestedDescription ?? "");
          setTags((draft.suggestedTasteTags ?? []).join(", "));
          setDietaryFlags(draft.suggestedDietaryTags ?? []);
        }
        return;
      }
      if (!dishId) return;
      // Only this outlet's own menu: a removed dish, or another stall's dish, is not editable.
      const dish = menu.find((item) => item.id === dishId);
      if (!dish) {
        setIsMissing(true);
      } else {
        const dishImageUrl = dish.imageUrl || dish.gallery?.[0] || "";
        setName(dish.name);
        setPrice(dish.price ? dish.price.toFixed(2) : "");
        setDescription(dish.description ?? "");
        setTags(dish.tasteTags.join(", "));
        setImageUrl(dishImageUrl);
        setOriginalImageUrl(dishImageUrl);
        setSection(getDishSection(dish.availabilityFlags) ?? "");
        setOtherFlags(
          (dish.availabilityFlags ?? []).filter(
            (flag) =>
              !hasAvailabilityFlag([flag], "sold_out") && !hasAvailabilityFlag([flag], "featured"),
          ),
        );
        setDietaryFlags(dish.dietaryFlags ?? []);
        setIsAvailable(!hasAvailabilityFlag(dish.availabilityFlags, "sold_out"));
        setIsFeatured(hasAvailabilityFlag(dish.availabilityFlags, "featured"));
        setIsLockedLive(isLockedLiveDish(dish, isVerificationCurrent(activeOutlet.verification)));
      }
    } catch (e) {
      reportError(e, { screen: "DishEditor", action: "load_dish" });
      setError(e instanceof Error ? e.message : "Failed to load dish details.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet, dishId, ocrDraftId]);

  useEffect(() => {
    void loadDish();
  }, [loadDish]);

  const formSnapshot = useMemo(
    () =>
      JSON.stringify([
        name,
        price,
        description,
        tags,
        imageUrl,
        section,
        dietaryFlags,
        isAvailable,
        isFeatured,
      ]),
    [name, price, description, tags, imageUrl, section, dietaryFlags, isAvailable, isFeatured],
  );
  // The first snapshot after loading is the saved state; anything else is an unsaved edit.
  useEffect(() => {
    if (!isLoading && savedSnapshot === null) setSavedSnapshot(formSnapshot);
  }, [formSnapshot, isLoading, savedSnapshot]);
  const isDirty = savedSnapshot !== null && savedSnapshot !== formSnapshot && !isSaving;
  const leaveEditor = useCallback(() => navigation.goBack(), [navigation]);
  const confirmLeave = useUnsavedChangesGuard(isDirty, leaveEditor, showAlert);

  const handleSave = async () => {
    if (!activeOutlet) return;
    const parsedPrice = parseDishPrice(price);
    // Shown on the fields themselves, not in an alert.
    const nextErrors = {
      name: name.trim() ? undefined : "Dish name is required.",
      price:
        parsedPrice === null ? "Enter a price between S$0.01 and S$9,999, e.g. 5.50." : undefined,
    };
    setFieldErrors(nextErrors);
    if (nextErrors.name || parsedPrice === null) return;

    setIsSaving(true);
    try {
      const trimmedImageUrl = imageUrl.trim();
      const imageChanged = trimmedImageUrl !== originalImageUrl;
      const updates: Partial<DishDetail> = {
        name: name.trim(),
        price: parsedPrice,
        priceRange: formatDishPrice(parsedPrice),
        description: description.trim(),
        // Only send the photo when it changed; an unchanged photo is already stored.
        ...(imageChanged || !dishId
          ? { imageUrl: trimmedImageUrl, gallery: trimmedImageUrl ? [trimmedImageUrl] : [] }
          : {}),
        tasteTags: parseCommaSeparated(tags),
        dietaryFlags,
        availabilityFlags: withDishSection(
          [
            ...otherFlags,
            ...(!isAvailable ? ["sold_out"] : []),
            ...(isFeatured ? ["featured"] : []),
          ],
          section,
        ),
      };

      if (dishId) {
        await getHungryService().merchant.editDish(activeOutlet.id, dishId, updates);
        trackMerchantEvent("merchant_dish_updated", activeOutlet.id);
      } else if (ocrDraftId) {
        await getHungryService().merchant.acceptOCRDraft(ocrDraftId, updates);
        trackMerchantEvent("merchant_ocr_draft_accepted", activeOutlet.id, { edited: true });
      } else {
        await getHungryService().merchant.addDish(activeOutlet.id, { ...updates, id: newDishId });
        trackMerchantEvent("merchant_dish_created", activeOutlet.id, {
          has_photo: Boolean(trimmedImageUrl),
        });
      }
      setSavedSnapshot(formSnapshot);

      if (isVerificationCurrent(activeOutlet.verification)) {
        // The common case is one tap less: back to the menu with a short confirmation.
        navigation.goBack();
        showToast({
          message: dishId ? "Saved. Diners see it now." : "Dish added. Diners see it now.",
          tone: "success",
        });
      } else {
        // Not visible to diners yet: this one needs to be read, so it stays a dialog.
        showAlert(
          dishId ? "Dish updated" : "Dish added",
          "Saved. Diners will see your menu once Hungry verifies your stall.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
      }
    } catch (e) {
      // A refused blocked word is the merchant's text, shown back to them, not a failure to report.
      if (!isBlockedTextError(e)) reportError(e, { screen: "DishEditor", action: "save_dish" });
      showAlert("Could not save dish", errorMessage(e, "Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!activeOutlet || !dishId) return;
    showAlert(
      "Remove from menu?",
      `Remove ${name || "this dish"} from your menu? Diner reviews and saves are kept.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setIsSaving(true);
            try {
              await getHungryService().merchant.deleteDish(activeOutlet.id, dishId);
              trackMerchantEvent("merchant_dish_deleted", activeOutlet.id);
              navigation.goBack();
            } catch (e) {
              reportError(e, { screen: "DishEditor", action: "remove_dish" });
              showAlert("Could not remove dish", errorMessage(e, "Please try again."));
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleSuggestAllergens = async () => {
    const ingredientList = parseCommaSeparated(ingredients);
    if (ingredientList.length === 0) {
      showAlert("Notice", "Add ingredients before running the allergen check.");
      return;
    }
    let allergens: string[];
    try {
      allergens = await getHungryService().merchant.suggestAllergens(ingredientList);
    } catch (e) {
      reportError(e, { screen: "DishEditor", action: "suggest_allergens" });
      showAlert("Check unavailable", errorMessage(e, "Please try again."));
      return;
    }
    showAlert(
      "Ingredient check",
      allergens.length > 0
        ? `Possible allergens: ${allergens.join(", ")}. ${ALLERGEN_CHECK_DISCLAIMER}`
        : `No allergen keywords matched. That does not mean the dish is allergen-free. ${ALLERGEN_CHECK_DISCLAIMER}`,
    );
  };

  const toggleDietaryFlag = (flag: DietaryFlag) => {
    setDietaryFlags((current) =>
      current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag],
    );
  };

  if (isLoading) {
    return (
      <Screen title={dishId ? "Edit dish" : "Add dish"}>
        <View accessibilityLabel="Loading dish details" style={{ gap: spacing[4], width: "100%" }}>
          <Skeleton height={56} borderRadius={radii.lg} />
          <Skeleton height={56} borderRadius={radii.lg} />
          <Skeleton height={160} borderRadius={radii.lg} />
          <Skeleton height={56} borderRadius={radii.lg} />
        </View>
      </Screen>
    );
  }

  if (isMissing) {
    return (
      <Screen title="Edit dish">
        <EmptyState
          title="This dish is no longer on your menu"
          body="It may have been removed. Go back to your menu to see the dishes you can edit."
          ctaLabel="Back to menu"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Dish">
        <EmptyState
          title="Failed to load dish"
          body="Your dish details could not be loaded."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="Dish editor"
          ctaLabel="Retry"
          onPress={loadDish}
        />
      </Screen>
    );
  }

  return (
    <Screen title={dishId ? "Edit dish" : "Add dish"} onBackPress={confirmLeave}>
      <View style={{ gap: spacing[5], width: "100%" }}>
        {isLockedLive ? (
          <View style={{ gap: spacing[2] }}>
            <InlineBanner
              tone="info"
              message="Verify your stall to edit dishes that diners already see. You can still remove this dish."
            />
            <Button
              label="Open verification"
              variant="secondary"
              fullWidth={false}
              onPress={() =>
                (navigation as { navigate: (name: string) => void }).navigate("VerificationCentre")
              }
            />
          </View>
        ) : null}

        <View
          pointerEvents={isLockedLive ? "none" : "auto"}
          style={{ gap: spacing[5], opacity: isLockedLive ? 0.6 : 1 }}
        >
          <MerchantImageField
            label="Dish photo"
            rationale="Hungry needs access to your photo library to add a photo of this dish."
            value={imageUrl}
            onChange={setImageUrl}
            isSaving={isSaving}
            icon={<Camera size={24} color={palette.textMuted} />}
          />

          <View>
            <Input
              label="Dish name *"
              value={name}
              onChangeText={setName}
              errorText={fieldErrors.name}
              error={Boolean(fieldErrors.name)}
              placeholder="e.g. Signature Wonton Mee"
            />
          </View>

          <View>
            <Input
              label="Price (S$) *"
              value={price}
              onChangeText={setPrice}
              errorText={fieldErrors.price}
              error={Boolean(fieldErrors.price)}
              keyboardType="decimal-pad"
              placeholder="e.g. 5.50"
            />
          </View>

          <View>
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Describe your dish to make it sound appetizing..."
              style={{ minHeight: 100, textAlignVertical: "top" }}
            />
          </View>

          <View>
            <Input
              label="Menu section"
              value={section}
              onChangeText={setSection}
              maxLength={32}
              placeholder="e.g. Noodles, Drinks"
            />
            <View style={{ marginTop: spacing[2] }}>
              <ChipGroup
                options={Array.from(new Set([...existingSections, ...SUGGESTED_SECTIONS])).map(
                  (option) => ({ id: option, label: option }),
                )}
                selectedIds={section ? [section] : []}
                onSelect={(option) => setSection((current) => (current === option ? "" : option))}
              />
            </View>
          </View>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Ingredient indicators
            </AppText>
            <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[3] }}>
              Choose customer-facing labels for dietary needs and ingredient exclusions. These are
              your own declarations, and Hungry does not check them against any certification.
            </AppText>
            <ChipGroup
              options={DIETARY_OPTIONS.map((option) => ({
                id: option.value,
                label: option.label,
              }))}
              selectedIds={dietaryFlags}
              onSelect={toggleDietaryFlag}
            />
          </View>

          <View>
            <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
              Tags
            </AppText>
            <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[2] }}>
              Shown to diners on the dish, e.g. spicy, comfort food.
            </AppText>
            <Input
              accessibilityLabel="Tags"
              value={tags}
              onChangeText={setTags}
              placeholder="Comma separated (e.g. spicy, springy noodles)"
              multiline
            />
          </View>

          <View>
            {showAllergenCheck ? (
              <>
                <AppText variant="bodyBold" style={{ marginBottom: spacing[2] }}>
                  Ingredients
                </AppText>
                <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[2] }}>
                  Used for the allergen check only. Not shown to diners.
                </AppText>
                <Input
                  accessibilityLabel="Ingredients"
                  value={ingredients}
                  onChangeText={setIngredients}
                  placeholder="Comma separated (e.g. noodles, pork, wonton)"
                  multiline
                />
                <Button
                  label="Check ingredient indicators"
                  variant="secondary"
                  fullWidth={false}
                  onPress={handleSuggestAllergens}
                  style={{ marginTop: spacing[2] }}
                />
              </>
            ) : (
              <Button
                label="Check ingredients for allergens"
                variant="secondary"
                fullWidth={false}
                onPress={() => setShowAllergenCheck(true)}
              />
            )}
          </View>

          <FormSwitchRow
            label="Available for sale"
            description="Turn off to mark as sold out"
            value={isAvailable}
            onValueChange={setIsAvailable}
          />

          <FormSwitchRow
            label="Featured dish"
            description="Shows first on your menu with a Stall's pick badge"
            value={isFeatured}
            onValueChange={setIsFeatured}
          />
        </View>

        {isLockedLive ? null : (
          <Button
            label={isSaving ? "Saving..." : "Save dish"}
            variant="primary"
            fullWidth
            onPress={handleSave}
            disabled={isSaving}
            style={{ marginTop: spacing[4] }}
          />
        )}
        {dishId ? (
          <Button
            label="Remove from menu"
            variant="destructive"
            fullWidth
            onPress={handleDelete}
            disabled={isSaving}
          />
        ) : null}
      </View>
      {dialog}
    </Screen>
  );
}
